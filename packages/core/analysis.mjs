import {seal, verify, normalize} from './util.mjs';

const NAME = /^[\p{L}\p{N}_$@]+(\.[\p{L}\p{N}_$@]+)*$/u;
const COL = /^[\p{L}\p{N}_$@]+$/u;
const CHANGES = new Set(['rename', 'drop', 'type', 'modify']);
const byStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const datasetOf = id => id.split('.').slice(0, -1).join('.') || id;

function index(report) {
  const colOut = new Map(), colIn = new Map(), tableOut = new Map(), tableIn = new Map(), indirectOut = new Map();
  const add = (m, k, e) => { if (!m.has(k)) m.set(k, []); m.get(k).push(e); };
  for (const e of report.edges || []) {
    if (e.type === 'column') { add(colOut, e.from, e); add(colIn, e.to, e); }
    else if (e.type === 'table') { add(tableOut, e.from, e); add(tableIn, e.to, e); }
    else if (e.type === 'indirect') add(indirectOut, e.from, e);
  }
  return {colOut, colIn, tableOut, tableIn, indirectOut};
}

function resolveTable(report, t) {
  const ids = new Set((report.nodes || []).map(n => n.id));
  for (const e of report.edges || []) { if (e.type === 'table') { ids.add(e.from); ids.add(e.to); } }
  if (ids.has(t)) return {id: t, found: true};
  const hits = [...ids].filter(k => k.endsWith('.' + t) || t.endsWith('.' + k));
  if (hits.length === 1) return {id: hits[0], found: true, matchedBy: 'qualified-suffix'};
  return {id: t, found: false, ambiguous: hits.length > 1 ? hits : undefined};
}

function bfs(start, next) {
  const hits = [], seen = new Set([start]);
  const queue = [{id: start, path: []}];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of next(cur.id) || []) {
      const to = e.to;
      if (seen.has(to)) continue;
      seen.add(to);
      const p = [...cur.path, e];
      hits.push({node: to, path: p});
      queue.push({id: to, path: p});
    }
  }
  return hits;
}

const proof = p => p.map(e => ({from: e.from, to: e.to, kind: e.kind || e.type, ...(e.role ? {role: e.role} : {}), source: e.source}));
const pathKind = p => (p.every(e => e.kind === 'direct') ? 'direct' : 'derived');

function checklist(change, confirmed, possible) {
  const verb = {rename: 'Update the reference in', drop: 'BREAKING - remove or replace the dependency in', type: 'Verify type compatibility and casts in', modify: 'Review the expression in'}[change];
  const items = [];
  for (const h of confirmed) items.push(`${verb} \`${h.node}\` (${h.source?.file}:${h.source?.line}), reached via ${h.path.length} hop(s).`);
  for (const p of possible.filter(x => x.certainty === 'possible-indirect')) items.push(`Review ${p.role} clause of \`${p.node}\` (${p.source?.file}:${p.source?.line}): changing the column can change which rows it returns.`);
  const tbl = possible.filter(x => x.certainty === 'possible-table-level').map(x => x.node);
  if (tbl.length) items.push(`Check whether these downstream datasets use the column in constructs the parser could not prove: ${tbl.map(x => '`' + x + '`').join(', ')}.`);
  return items;
}

export function impact(report, {table, column, change = 'modify'} = {}) {
  if (!verify(report)) throw new Error('Source graph integrity invalid');
  const t0 = normalize(table || '');
  if (!t0 || !NAME.test(t0)) throw new Error('Provide a valid --table');
  const c = column ? normalize(column) : null;
  if (c && !COL.test(c)) throw new Error('Invalid --column');
  if (!CHANGES.has(change)) throw new Error(`Invalid --change (choose ${[...CHANGES].join(', ')})`);
  const res = resolveTable(report, t0);
  const t = res.id;
  const ix = index(report);
  const start = c ? `${t}.${c}` : t;
  const confirmed = [], possibleMap = new Map();
  const addPossible = p => { const prev = possibleMap.get(p.node); if (!prev || (prev.certainty === 'possible-table-level' && p.certainty === 'possible-indirect')) possibleMap.set(p.node, p); };
  const tableDesc = from => bfs(from, id => ix.tableOut.get(id));

  if (c) {
    const colHits = bfs(start, id => ix.colOut.get(id));
    const reached = new Set([start, ...colHits.map(h => h.node)]);
    for (const h of colHits) {
      const last = h.path[h.path.length - 1];
      confirmed.push({dataset: datasetOf(h.node), field: h.node.split('.').at(-1), node: h.node, type: 'column', kind: pathKind(h.path), role: h.path.find(e => e.role)?.role, certainty: 'supported-subset', depth: h.path.length, source: last.source, path: proof(h.path)});
    }
    const confirmedDs = new Set(confirmed.map(h => h.dataset));
    const indirectDs = [];
    for (const id of reached) for (const e of ix.indirectOut.get(id) || []) {
      indirectDs.push(e.to);
      addPossible({dataset: e.to, field: null, node: e.to, type: 'indirect', role: e.role, certainty: 'possible-indirect', reason: `Column is used in a ${e.role} dependency; every column of ${e.to} may be affected`, source: e.source});
    }
    for (const from of [t, ...indirectDs]) for (const h of tableDesc(from)) {
      if (confirmedDs.has(h.node) || h.node === t) continue;
      addPossible({dataset: h.node, field: null, node: h.node, type: 'table', certainty: 'possible-table-level', reason: 'Table dependency exists; a field-specific reference was not proven', source: h.path.at(-1).source});
    }
    for (const id of indirectDs) for (const h of tableDesc(id)) if (!confirmedDs.has(h.node) && h.node !== t) addPossible({dataset: h.node, field: null, node: h.node, type: 'table', certainty: 'possible-table-level', reason: `Downstream of ${id}, whose rows depend on the column`, source: h.path.at(-1).source});
  } else {
    for (const h of tableDesc(t)) confirmed.push({dataset: h.node, field: null, node: h.node, type: 'table', kind: 'table', certainty: 'supported-subset', depth: h.path.length, source: h.path.at(-1).source, path: proof(h.path)});
  }
  const possible = [...possibleMap.values()].sort((a, b) => byStr(a.node, b.node));
  confirmed.sort((a, b) => a.depth - b.depth || byStr(a.node, b.node));
  const targetNode = (report.nodes || []).find(n => n.id === t);
  const sensitive = c && targetNode?.sensitivityHints?.includes(c) ? [start] : [];
  for (const h of confirmed) if (h.field && /(^|_)(email|ssn|phone|dob|passport|card|password|token|secret|address|name)(_|$)/.test(h.field)) sensitive.push(h.node);
  return seal({
    format: 'lineagesutra.impact.v1',
    inputIntegrity: report.integrity.hash,
    target: {table: t, column: c, change, found: res.found, ...(res.matchedBy ? {matchedBy: res.matchedBy} : {}), ...(res.ambiguous ? {ambiguousWith: res.ambiguous} : {})},
    result: res.found ? 'HUMAN_REVIEW_REQUIRED' : 'TARGET_NOT_FOUND',
    summary: {confirmed: confirmed.length, possible: possible.length, sensitiveNameHints: sensitive.length},
    impacted: confirmed,
    possible,
    sensitivityHints: [...new Set(sensitive)].sort(byStr),
    checklist: checklist(change, confirmed, possible),
    regressionTestIdeas: [...new Set(confirmed.filter(h => h.field).map(h => h.dataset))].map(d => `In a non-production copy, compare row counts and column checksums of \`${d}\` before and after the change. (Suggestion only; nothing was executed.)`),
    warnings: report.warnings,
    notes: [
      'Confirmed findings are exact supported-subset column edges (static SQL evidence), not a database test.',
      'Possible findings are indirect (filter/join/group) or dataset-level; they are not proof of field-level use.',
      'Unsupported SQL, dynamic SQL and templates may hide additional downstream impacts. Column-name sensitivity hints are not classifications.'
    ]
  });
}

export function upstream(report, {table, column} = {}) {
  if (!verify(report)) throw new Error('Source graph integrity invalid');
  const t0 = normalize(table || '');
  if (!t0 || !NAME.test(t0)) throw new Error('Provide a valid --table');
  const c = column ? normalize(column) : null;
  if (c && !COL.test(c)) throw new Error('Invalid --column');
  const res = resolveTable(report, t0);
  const ix = index(report);
  const start = c ? `${res.id}.${c}` : res.id;
  const hits = c ? bfs(start, id => (ix.colIn.get(id) || []).map(e => ({...e, to: e.from}))) : bfs(start, id => (ix.tableIn.get(id) || []).map(e => ({...e, to: e.from})));
  const out = hits.map(h => ({node: h.node, dataset: c ? datasetOf(h.node) : h.node, field: c ? h.node.split('.').at(-1) : null, depth: h.path.length, kind: c ? pathKind(h.path) : 'table', origin: !(c ? ix.colIn : ix.tableIn).has(h.node), path: h.path.map(e => ({from: e.from, to: e.to, kind: e.kind || e.type, source: e.source}))}));
  out.sort((a, b) => a.depth - b.depth || byStr(a.node, b.node));
  const indirect = [];
  if (c) for (const e of report.edges.filter(x => x.type === 'indirect' && x.to === res.id)) indirect.push({node: e.from, role: e.role, source: e.source});
  return seal({
    format: 'lineagesutra.upstream.v1',
    inputIntegrity: report.integrity.hash,
    target: {table: res.id, column: c, found: res.found},
    result: res.found ? 'SUPPORTED_SUBSET_TRACE' : 'TARGET_NOT_FOUND',
    upstream: out,
    origins: out.filter(x => x.origin).map(x => x.node),
    indirectInfluences: indirect,
    notes: ['Upstream trace follows static column edges only; runtime-only inputs are not visible.']
  });
}

function checkColumn(node, spec, findings, dsName) {
  const col = typeof spec === 'string' ? {name: spec} : spec;
  if (!col || typeof col.name !== 'string') throw new Error('Invalid column');
  const name = normalize(col.name);
  if (!node.columns.includes(name)) {
    findings.push({dataset: dsName, field: col.name, status: node.certainty === 'supported-subset' ? 'missing' : 'unverified', reason: 'Required column not observed in supported SQL subset'});
    return;
  }
  const declared = node.columnTypes?.[name];
  if (col.type && declared !== undefined && normalize(col.type).replace(/\s+/g, '') !== declared.replace(/\s+/g, '')) findings.push({dataset: dsName, field: col.name, status: 'type-mismatch', reason: `Contract says ${col.type}; DDL declares ${declared}`});
  else if (col.type && declared === undefined) findings.push({dataset: dsName, field: col.name, status: 'unverified', reason: 'Type can only be checked against CREATE TABLE DDL; this dataset has no declared types'});
  if (col.nullable === false && node.notNull && !node.notNull.includes(name)) findings.push({dataset: dsName, field: col.name, status: 'nullability-mismatch', reason: 'Contract requires NOT NULL; DDL does not declare it'});
}

export function contractsCheck(report, contract) {
  if (!verify(report)) throw new Error('Source graph integrity invalid');
  if (!contract || !Array.isArray(contract.datasets) || contract.datasets.length > 1000) throw new Error('Expected contract.datasets array');
  const findings = [], notRun = [];
  const lookup = new Map(report.nodes.map(x => [x.id, x]));
  for (const item of contract.datasets) {
    if (!item || typeof item.name !== 'string' || !Array.isArray(item.requiredColumns)) throw new Error('Invalid contract entry');
    const node = lookup.get(normalize(item.name));
    if (!node) { findings.push({dataset: item.name, field: null, status: 'missing', reason: 'No dataset declaration found'}); continue; }
    if (node.kind === 'external') { findings.push({dataset: item.name, field: null, status: 'unverified', reason: 'Dataset is referenced but not declared in the scanned sources'}); continue; }
    for (const c of item.requiredColumns) checkColumn(node, c, findings, item.name);
    for (const f of item.forbiddenColumns || []) if (node.columns.includes(normalize(f))) findings.push({dataset: item.name, field: f, status: 'forbidden-present', reason: 'Column is forbidden by the contract'});
    if (item.owner === undefined || item.owner === '') notRun.push({dataset: item.name, check: 'owner', status: 'not-run', reason: 'No owner declared in the contract'});
    if (item.freshnessSla) notRun.push({dataset: item.name, check: 'freshness', status: 'not-run', reason: 'Freshness SLA is declared only; no runtime observation exists. SQL column names cannot prove freshness.'});
  }
  return seal({
    format: 'lineagesutra.contract.v1',
    inputIntegrity: report.integrity.hash,
    findings,
    notRun,
    verdict: findings.length ? 'REVIEW_REQUIRED' : 'SUPPORTED_SUBSET_CHECK_PASSED',
    limitations: ['A passing contract check is limited to extracted metadata; no database tests or freshness measurement were performed']
  });
}

const key = e => `${e.type}:${e.from}->${e.to}${e.kind ? '#' + e.kind : ''}${e.role ? '@' + e.role : ''}`;

export function compare(a, b) {
  if (!verify(a) || !verify(b)) throw new Error('Report integrity verification failed');
  const ea = new Set(a.edges.map(key)), eb = new Set(b.edges.map(key));
  const declared = r => new Map(r.nodes.filter(n => n.kind !== 'external').map(n => [n.id, n]));
  const na = declared(a), nb = declared(b);
  const datasetsAdded = [...nb.keys()].filter(k => !na.has(k)).sort(byStr);
  const datasetsRemoved = [...na.keys()].filter(k => !nb.has(k)).sort(byStr);
  const columnChanges = [];
  for (const [id, n] of na) {
    const m = nb.get(id);
    if (!m) continue;
    const removed = n.columns.filter(c => !m.columns.includes(c)), added = m.columns.filter(c => !n.columns.includes(c));
    if (removed.length || added.length) columnChanges.push({dataset: id, removed, added});
  }
  // DriftRadar: which consumers (in the BEFORE graph) used a column that disappeared?
  const ix = index(a);
  const breaking = [];
  for (const ch of columnChanges) for (const col of ch.removed) {
    const hits = bfs(`${ch.dataset}.${col}`, id => ix.colOut.get(id));
    if (hits.length) breaking.push({removedColumn: `${ch.dataset}.${col}`, consumers: hits.map(h => h.node)});
  }
  for (const id of datasetsRemoved) {
    const hits = bfs(id, x => ix.tableOut.get(x));
    if (hits.length) breaking.push({removedDataset: id, consumers: hits.map(h => h.node)});
  }
  return seal({
    format: 'lineagesutra.compare.v1',
    left: a.integrity.hash,
    right: b.integrity.hash,
    added: [...eb].filter(x => !ea.has(x)).sort(byStr),
    removed: [...ea].filter(x => !eb.has(x)).sort(byStr),
    datasetsAdded, datasetsRemoved, columnChanges, breaking,
    verdict: breaking.length ? 'BREAKING_CHANGES_DETECTED' : 'NO_BREAKING_CHANGES_IN_SUPPORTED_SUBSET',
    status: 'static-diff-only'
  });
}
