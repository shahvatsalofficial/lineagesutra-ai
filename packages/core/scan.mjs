import fs from 'node:fs';
import path from 'node:path';
import {FORMAT_VERSION, PARSER_VERSION, VERSION} from './version.mjs';
import {sha256, seal, assertInside} from './util.mjs';
import {parseSQL} from './parser.mjs';

const SKIP_DIRS = new Set(['node_modules', 'target', 'dist', 'venv', 'vendor', 'build', 'coverage']);
const SENSITIVE_NAME = /(^|_)(email|e_?mail|ssn|social_security|phone|mobile|dob|birth|passport|card|iban|account_number|password|passwd|secret|token|api_key|address|first_name|last_name|full_name|salary|tax_id|national_id|ip_address)(_|$)/;

export function discover(root, {maxFiles = 500, maxBytes = 2_000_000} = {}) {
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 5000) throw new Error('Invalid maxFiles');
  const real = fs.realpathSync(root);
  if (!fs.statSync(real).isDirectory()) throw new Error('Root must be directory');
  const found = [];
  const stack = [real];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const target = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(target); continue; }
      if (!e.isFile() || !e.name.toLowerCase().endsWith('.sql')) continue;
      const st = fs.statSync(target);
      if (st.size > maxBytes) throw new Error(`SQL file limit exceeded: ${e.name}`);
      found.push(target);
      if (found.length > maxFiles) throw new Error('Maximum SQL file count exceeded');
    }
  }
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const byStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const edgeKey = e => `${e.type}|${e.from}|${e.to}|${e.kind || ''}|${e.role || ''}`;
const datasetOf = id => id.split('.').slice(0, -1).join('.') || id;

function findCycles(nodeIds, tableEdges) {
  const adj = new Map(nodeIds.map(n => [n, []]));
  for (const e of tableEdges) { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); if (!adj.has(e.to)) adj.set(e.to, []); }
  const color = new Map(), cycles = [];
  const stack = [];
  const visit = start => {
    const work = [[start, 0]];
    color.set(start, 1); stack.push(start);
    while (work.length) {
      const top = work[work.length - 1];
      const [n, idx] = top;
      const next = adj.get(n)[idx];
      if (next === undefined) { color.set(n, 2); stack.pop(); work.pop(); continue; }
      top[1]++;
      const c = color.get(next);
      if (c === 1) cycles.push([...stack.slice(stack.indexOf(next)), next]);
      else if (!c) { color.set(next, 1); stack.push(next); work.push([next, 0]); }
    }
  };
  for (const n of [...adj.keys()].sort(byStr)) if (!color.get(n)) visit(n);
  return cycles;
}

function orderProducersFirst(files, nodes, edges) {
  const fileOf = new Map(nodes.map(n => [n.id, n.source.file]));
  const deps = new Map(files.map(f => [f.path, new Set()]));
  for (const e of edges) if (e.type === 'table') { const a = fileOf.get(e.from), b = fileOf.get(e.to); if (a && b && a !== b && deps.has(b)) deps.get(b).add(a); }
  const done = new Set(), out = [];
  const byPath = new Map(files.map(f => [f.path, f]));
  let left = files.map(f => f.path);
  while (left.length) {
    const ready = left.filter(p => [...deps.get(p)].every(d => done.has(d)));
    const take = ready.length ? ready : [left[0]];
    for (const p of take) { done.add(p); out.push(byPath.get(p)); }
    left = left.filter(p => !done.has(p));
  }
  return out;
}

export function scanSources(input, {label = 'sources'} = {}) {
  // input: [{path, text}] with posix-relative paths. Sorted so output never depends on caller order.
  let files = [...input].sort((a, b) => byStr(a.path, b.path));
  const sources = files.map(f => ({path: f.path, sha256: sha256(f.text), bytes: Buffer.byteLength(f.text)}));
  // Cross-file schema resolution: parse files in order while carrying the schema registry forward, then re-order
  // files so producers come before consumers (from the edges just found) and repeat until the schemas stop changing.
  let registry = new Map();
  let result = null;
  let converged = false;
  let prevSig = null;
  for (let pass = 0; pass < 6; pass++) {
    const nodes = [], edges = [], warnings = [], hints = new Map();
    for (const f of files) {
      const p = parseSQL(f.text, f.path, {registry});
      nodes.push(...p.nodes); edges.push(...p.edges); warnings.push(...p.warnings);
      hints.set(f.path, p.dialectHints);
      registry = p.registry;
    }
    result = {nodes, edges, warnings, hints};
    const sig = nodes.map(n => `${n.id}|${n.certainty}|${n.columns.join(',')}`).sort().join('\n');
    if (sig === prevSig) { converged = true; break; }
    prevSig = sig;
    files = orderProducersFirst(files, nodes, edges);
  }
  const {nodes, edges, warnings, hints} = result;
  if (!converged) warnings.push({file: label, kind: 'unsupported', detail: 'Cross-file schema resolution did not converge in 6 passes; wildcard expansion may be incomplete'});
  for (const s of sources) s.dialectHints = hints.get(s.path) || [];

  // Cross-file duplicate declarations: keep the first, warn for the rest.
  const seen = new Map(), unique = [];
  for (const n of nodes) {
    if (seen.has(n.id)) { warnings.push({file: n.source.file, kind: 'duplicate', detail: `Duplicate dataset declaration ${n.id} (first declared in ${seen.get(n.id)})`, line: n.source.line}); continue; }
    seen.set(n.id, n.source.file); unique.push(n);
  }
  const dedupEdges = [], ek = new Set();
  for (const e of edges) { const k = edgeKey(e); if (!ek.has(k)) { ek.add(k); dedupEdges.push(e); } }

  // Explicit missing nodes: datasets referenced but not declared in scanned sources.
  const declared = new Set(unique.map(n => n.id));
  const referenced = new Map();
  for (const e of dedupEdges) {
    if (e.type === 'table' || e.type === 'indirect') {
      const d = e.type === 'table' ? e.from : datasetOf(e.from);
      if (!declared.has(d)) referenced.set(d, referenced.get(d) || new Set());
    }
    if (e.type === 'column' || e.type === 'indirect') {
      const d = datasetOf(e.from);
      if (!declared.has(d)) { if (!referenced.has(d)) referenced.set(d, new Set()); referenced.get(d).add(e.from.slice(d.length + 1)); }
    }
    if (e.type === 'table' && !declared.has(e.to)) referenced.set(e.to, referenced.get(e.to) || new Set());
  }
  for (const [id, cols] of referenced) unique.push({id, kind: 'external', columns: [...cols].sort(byStr), source: {file: null, line: null}, certainty: 'inferred-from-reference'});

  for (const n of unique) {
    const hints = n.columns.filter(c => SENSITIVE_NAME.test(c));
    if (hints.length) n.sensitivityHints = hints;
  }
  unique.sort((a, b) => byStr(a.id, b.id));
  dedupEdges.sort((a, b) => byStr(edgeKey(a), edgeKey(b)));
  const tableEdges = dedupEdges.filter(e => e.type === 'table');
  for (const cyc of findCycles(unique.map(n => n.id), tableEdges)) warnings.push({file: label, kind: 'cycle', detail: `Dependency cycle: ${cyc.join(' -> ')}`});
  warnings.sort((a, b) => byStr(a.file || '', b.file || '') || byStr(a.kind, b.kind) || (a.line || 0) - (b.line || 0) || byStr(a.detail, b.detail));

  const declaredNodes = unique.filter(n => n.kind !== 'external');
  const cov = {supportedSubset: 0, partial: 0, unknown: 0};
  for (const n of declaredNodes) cov[n.certainty === 'supported-subset' ? 'supportedSubset' : n.certainty === 'partial' ? 'partial' : 'unknown']++;
  return seal({
    format: FORMAT_VERSION,
    tool: {name: 'lineagesutra-ai', version: VERSION, parser: PARSER_VERSION},
    mode: 'offline-source-analysis',
    rootLabel: label,
    summary: {
      sqlFiles: files.length,
      datasets: unique.length,
      declaredDatasets: declaredNodes.length,
      externalDatasets: unique.length - declaredNodes.length,
      dependencies: dedupEdges.length,
      tableEdges: tableEdges.length,
      columnEdges: dedupEdges.filter(e => e.type === 'column').length,
      indirectEdges: dedupEdges.filter(e => e.type === 'indirect').length,
      warnings: warnings.length,
      coverage: cov
    },
    sources,
    nodes: unique,
    edges: dedupEdges,
    warnings,
    limits: [
      'Supported subset: CREATE TABLE/VIEW [AS SELECT], CTAS, INSERT ... SELECT, CTEs, subqueries, JOINs, set operations, expressions, window functions and wildcard expansion where schemas are declared in the scanned sources. This does not certify any SQL dialect.',
      'Edges are static observations of SQL text. Column edges are marked direct (plain copy) or derived (expression); WHERE/JOIN/GROUP/HAVING/ORDER dependencies are marked indirect.',
      'Dynamic SQL, dbt/Jinja templates, stored procedures, MERGE/UPDATE, table functions, PIVOT and recursive CTEs are reported as warnings, never as confident edges.',
      'No database connection, row data, query execution, freshness measurement or production verification is performed. The SHA-256 seal is tamper evidence, not a signature.'
    ]
  });
}

export function scan(root, opts = {}) {
  const base = fs.realpathSync(root);
  const files = discover(base, opts);
  const loaded = files.map(f => {
    assertInside(base, f);
    return {path: path.relative(base, f).split(path.sep).join('/'), text: fs.readFileSync(f, 'utf8').replace(/^﻿/, '')};
  });
  return scanSources(loaded, {label: path.basename(base)});
}
