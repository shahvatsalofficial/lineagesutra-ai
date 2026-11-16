#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scan, impact, upstream, contractsCheck, compare, verify, importDbtManifest, VERSION} from '../core/index.mjs';
import {runAudit} from '../core/audit.mjs';
import {save, markdown} from '../reporting/index.mjs';
import {serve} from '../server/index.mjs';
import {serveMcp} from '../server/mcp.mjs';
import {installSkills} from '../../scripts/install-skills.mjs';

const BOOL = new Set(['help', 'version', 'force', 'quiet', 'strict', 'with-tests', 'json', 'fail-on-breaking']);
const FORMATS = ['json', 'md', 'html', 'mmd'];

export function parseArgs(argv) {
  const out = {_: []};
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-h') { out.help = true; continue; }
    if (x === '-v') { out.version = true; continue; }
    if (!x.startsWith('--')) { out._.push(x); continue; }
    const eq = x.indexOf('=');
    const key = (eq > 0 ? x.slice(2, eq) : x.slice(2));
    if (eq > 0) out[key] = x.slice(eq + 1);
    else if (BOOL.has(key)) out[key] = true;
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`Option --${key} needs a value`);
    else out[key] = argv[++i];
  }
  return out;
}

const HELP = `LineageSutra AI ${VERSION} - offline, read-only SQL lineage and schema-change impact (no API key, no network)
Created by Vatsal Shah. Apache-2.0.

Usage: lineagesutra <command> [options]

Commands:
  doctor                                   Check this host (Node version, offline guarantees, bundled skills)
  scan     --root <sql-dir> [--out <file>] [--format json|md|html|mmd] [--strict] [--max-files N]
  dbt      --input <manifest.json> [--out <file>]       Metadata-only dbt manifest import
  impact   --input <lineage.json> --table <t> [--column <c>] [--change rename|drop|type|modify]
           [--out <file>] [--fail-on confirmed|possible|any]
  upstream --input <lineage.json> --table <t> [--column <c>] [--out <file>]
  contract --input <lineage.json> --contract <contracts.json> [--out <file>]
  compare  --before <old.json> --after <new.json> [--out <file>] [--fail-on-breaking]
  verify   --input <report.json>           Check the SHA-256 seal of any report
  audit    [--root <sql-dir>] --out <dir> [--with-tests] [--force] [--quiet]
                                           Independent self-audit; writes audit-report.json/.md/.html
  install-skills --ide claude|cursor|codex|gemini|copilot|opencode --project <dir>
  serve    --input <report.json> [--port 8787]          Loopback read-only API (needs LINEAGESUTRA_TOKEN)
  mcp      --root <sql-dir>                             Read-only MCP server over stdio
  --version | --help

Output format is inferred from the --out extension (.json .md .html .mmd) unless --format is given.
Exit codes: 0 ok, 1 audit failed, 2 usage or input error, 3 --fail-on / --strict / --fail-on-breaking gate tripped.
Every result is static analysis of SQL text. A human reviews before any production change.
`;

function load(file) {
  const resolved = path.resolve(file);
  const stat = fs.statSync(resolved);
  if (stat.size > 200_000_000) throw new Error('Input file is too large');
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (e) { throw new Error(`Cannot read JSON from ${file}: ${e.message}`); }
}

function pickFormat(a) {
  const f = a.format || (a.out ? ({'.md': 'md', '.html': 'html', '.htm': 'html', '.mmd': 'mmd'})[path.extname(a.out).toLowerCase()] : null) || 'json';
  if (!FORMATS.includes(f)) throw new Error(`Unsupported output format "${f}" (choose ${FORMATS.join(', ')})`);
  return f;
}

function emit(result, a, log) {
  const format = pickFormat(a);
  if (a.out) { save(a.out, result, format); log(`Wrote ${a.out}`); }
  else log(format === 'json' ? JSON.stringify(result, null, 2) : format === 'mmd' ? 'Mermaid output needs --out' : markdown(result));
}

function need(a, ...keys) {
  for (const k of keys) if (!a[k]) throw new Error(`--${k} is required (run "lineagesutra --help")`);
}

export async function main(argv = process.argv.slice(2), io = {}) {
  const log = io.log || console.log, errlog = io.err || console.error;
  try {
    const a = parseArgs(argv);
    const cmd = a._[0];
    if (a.version || cmd === 'version') { log(`lineagesutra-ai ${VERSION}`); return 0; }
    if (!cmd || cmd === 'help' || a.help) { log(HELP); return 0; }

    if (cmd === 'doctor') {
      const major = Number(process.versions.node.split('.')[0]);
      const skillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills');
      log(JSON.stringify({name: 'LineageSutra AI', version: VERSION, node: process.version, nodeSupported: major >= 20, platform: process.platform, arch: process.arch, cpuCount: os.availableParallelism?.() || os.cpus().length, offline: true, externalDatabaseConnections: false, networkCallsInCore: false, bundledSkills: fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).length : 0}, null, 2));
      return major >= 20 ? 0 : 2;
    }
    if (cmd === 'install' || cmd === 'install-skills') {
      const result = installSkills({host: a.host || a.ide, target: a.target || a.project});
      log(JSON.stringify(result, null, 2));
      return 0;
    }
    if (cmd === 'serve') {
      if (!a.input || !process.env.LINEAGESUTRA_TOKEN) throw new Error('--input and LINEAGESUTRA_TOKEN environment variable required');
      const srv = await serve({reportPath: path.resolve(a.input), token: process.env.LINEAGESUTRA_TOKEN, port: a.port ? Number(a.port) : 8787});
      log(`Local read-only API at http://127.0.0.1:${srv.address().port} (Authorization: Bearer <token>)`);
      return 0;
    }
    if (cmd === 'mcp') {
      need(a, 'root');
      const root = fs.realpathSync(a.root);
      errlog(`lineagesutra MCP server (read-only) scoped to ${root}`);
      serveMcp(root);
      return 0;
    }
    if (cmd === 'verify') {
      need(a, 'input');
      const ok = verify(load(a.input));
      log(ok ? 'VERIFIED: SHA-256 seal matches (tamper evidence only, not a signature)' : 'FAILED: seal missing or does not match');
      return ok ? 0 : 2;
    }
    if (cmd === 'audit') {
      const report = await runAudit({root: a.root || null, withTests: !!a['with-tests']});
      if (a.out) {
        const dir = path.resolve(a.out);
        fs.mkdirSync(dir, {recursive: true});
        const targets = ['json', 'md', 'html'].map(x => path.join(dir, `audit-report.${x}`));
        if (!a.force) for (const t of targets) if (fs.existsSync(t)) throw new Error(`${path.relative(process.cwd(), t)} exists; pass --force to overwrite`);
        for (const x of ['json', 'md', 'html']) save(path.join(dir, `audit-report.${x}`), report, x);
        if (!a.quiet) log(`Wrote ${path.join(a.out, 'audit-report.json')}, .md and .html`);
      } else if (!a.quiet) log(markdown(report));
      if (!a.quiet) log(`AUDIT ${report.overall}: ${report.totals.passed} passed, ${report.totals.failed} failed, ${report.totals.notRun} not run`);
      return report.overall === 'PASS' ? 0 : 1;
    }

    let result, gate = 0;
    if (cmd === 'scan') {
      need(a, 'root');
      result = scan(a.root, a['max-files'] ? {maxFiles: Number(a['max-files'])} : {});
      if (a.strict && result.warnings.length) gate = 3;
    } else if (cmd === 'dbt') {
      need(a, 'input');
      result = importDbtManifest(fs.readFileSync(path.resolve(a.input), 'utf8'));
    } else if (cmd === 'impact') {
      need(a, 'input', 'table');
      result = impact(load(a.input), {table: a.table, column: a.column, change: a.change});
      const f = a['fail-on'];
      if (f && !['confirmed', 'possible', 'any'].includes(f)) throw new Error('--fail-on must be confirmed, possible or any');
      if ((f === 'confirmed' && result.impacted.length) || (f === 'possible' && result.possible.length) || (f === 'any' && (result.impacted.length || result.possible.length))) gate = 3;
    } else if (cmd === 'upstream') {
      need(a, 'input', 'table');
      result = upstream(load(a.input), {table: a.table, column: a.column});
    } else if (cmd === 'contract') {
      need(a, 'input', 'contract');
      result = contractsCheck(load(a.input), load(a.contract));
    } else if (cmd === 'compare') {
      need(a, 'before', 'after');
      result = compare(load(a.before), load(a.after));
      if (a['fail-on-breaking'] && result.breaking.length) gate = 3;
    } else throw new Error(`Unknown command: ${cmd} (run "lineagesutra --help")`);
    emit(result, a, log);
    if (gate) errlog(`LineageSutra: gate tripped (exit 3) - ${cmd === 'scan' ? `${result.warnings.length} warning(s) under --strict` : 'findings present'}`);
    return gate;
  } catch (e) {
    errlog(`LineageSutra: ${e.message}`);
    return 2;
  }
}

function isMain() {
  if (!process.argv[1]) return false;
  try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}
if (isMain()) main().then(code => { if (code) process.exitCode = code; });
