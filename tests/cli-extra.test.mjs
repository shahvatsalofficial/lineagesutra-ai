import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verify} from '../packages/core/index.mjs';
import {parseArgs, main} from '../packages/cli/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'packages/cli/index.mjs');
const sample = path.join(root, 'fixtures/sample/sql');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], {encoding: 'utf8'});
const tmp = fn => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lin-cli2-')); try { return fn(d); } finally { fs.rmSync(d, {recursive: true, force: true}); } };

test('cli --version prints the package version', () => {
  const r = run('--version');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `lineagesutra-ai ${JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version}`);
});
test('cli infers format from the --out extension', () => tmp(d => {
  assert.equal(run('scan', '--root', sample, '--out', path.join(d, 'r.html')).status, 0);
  assert(fs.readFileSync(path.join(d, 'r.html'), 'utf8').startsWith('<!doctype html>'));
  assert.equal(run('scan', '--root', sample, '--out', path.join(d, 'r.md')).status, 0);
  assert(fs.readFileSync(path.join(d, 'r.md'), 'utf8').startsWith('# LineageSutra AI'));
}));
test('cli accepts --key=value and rejects options missing a value', () => {
  assert.equal(parseArgs(['scan', '--root=x']).root, 'x');
  assert.throws(() => parseArgs(['scan', '--root']), /needs a value/);
});
test('cli impact --fail-on confirmed exits 3 when impacts exist, 0 otherwise', () => tmp(d => {
  const g = path.join(d, 'g.json');
  run('scan', '--root', sample, '--out', g);
  assert.equal(run('impact', '--input', g, '--table', 'customers', '--column', 'email', '--fail-on', 'confirmed', '--out', path.join(d, 'i.json')).status, 3);
  assert.equal(run('impact', '--input', g, '--table', 'customers', '--column', 'created_at', '--fail-on', 'confirmed', '--out', path.join(d, 'i2.json')).status, 0);
  assert.equal(run('impact', '--input', g, '--table', 'customers', '--fail-on', 'bogus').status, 2);
}));
test('cli scan --strict exits 3 when the parser had to warn', () => tmp(d => {
  fs.mkdirSync(path.join(d, 'sql'));
  fs.writeFileSync(path.join(d, 'sql', 'a.sql'), 'create view v as select * from ext;');
  assert.equal(run('scan', '--root', path.join(d, 'sql'), '--strict', '--out', path.join(d, 'o', 'g.json')).status, 3);
  assert.equal(run('scan', '--root', sample, '--strict', '--out', path.join(d, 'o', 'ok.json')).status, 0);
}));
test('cli compare --fail-on-breaking detects the renamed column', () => tmp(d => {
  const a = path.join(d, 'a.json'), b = path.join(d, 'b.json');
  run('scan', '--root', sample, '--out', a);
  run('scan', '--root', path.join(root, 'fixtures/migration/after'), '--out', b);
  const r = run('compare', '--before', a, '--after', b, '--fail-on-breaking', '--out', path.join(d, 'c.md'));
  assert.equal(r.status, 3);
  assert(fs.readFileSync(path.join(d, 'c.md'), 'utf8').includes('customers.email'));
}));
test('cli upstream writes a sealed trace', () => tmp(d => {
  const g = path.join(d, 'g.json');
  run('scan', '--root', sample, '--out', g);
  assert.equal(run('upstream', '--input', g, '--table', 'email_metrics', '--column', 'address', '--out', path.join(d, 'u.json')).status, 0);
  assert(verify(JSON.parse(fs.readFileSync(path.join(d, 'u.json'), 'utf8'))));
}));
test('cli verify rejects a non-JSON file', () => tmp(d => {
  fs.writeFileSync(path.join(d, 'x.json'), 'nope');
  assert.equal(run('verify', '--input', path.join(d, 'x.json')).status, 2);
}));
test('cli audit writes json, md and html, refuses overwrite without --force', () => tmp(d => {
  const out = path.join(d, 'audit');
  const r = run('audit', '--out', out, '--quiet');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of ['audit-report.json', 'audit-report.md', 'audit-report.html']) assert(fs.existsSync(path.join(out, f)), f);
  const j = JSON.parse(fs.readFileSync(path.join(out, 'audit-report.json'), 'utf8'));
  assert(verify(j));
  assert.equal(j.overall, 'PASS');
  assert.equal(j.totals.failed, 0);
  assert(fs.readFileSync(path.join(out, 'audit-report.html'), 'utf8').includes('What was NOT verified'));
  assert(fs.readFileSync(path.join(out, 'audit-report.md'), 'utf8').includes('## Honest limits'));
  assert.equal(run('audit', '--out', out, '--quiet').status, 2);
  assert.equal(run('audit', '--out', out, '--quiet', '--force').status, 0);
}));
test('cli audit --root audits a user repository', () => tmp(d => {
  const out = path.join(d, 'a');
  assert.equal(run('audit', '--root', sample, '--out', out, '--quiet').status, 0);
  const j = JSON.parse(fs.readFileSync(path.join(out, 'audit-report.json'), 'utf8'));
  assert(j.sections.some(s => s.id === 'repository'));
}));
test('main() works in-process and returns exit codes', async () => {
  const lines = [];
  assert.equal(await main(['--version'], {log: x => lines.push(x)}), 0);
  assert.equal(await main(['nonsense'], {log() {}, err: x => lines.push(x)}), 2);
  assert(lines.some(l => /Unknown command/.test(l)));
});
test('cli dbt imports a manifest and records the schema version', () => tmp(d => {
  const o = path.join(d, 'dbt.json');
  assert.equal(run('dbt', '--input', path.join(root, 'fixtures/sample/dbt-manifest.json'), '--out', o).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(o, 'utf8')).summary.dbtSchemaVersion, 12);
}));
test('cli bin runs through a symlink (npm bin shim behaviour)', {skip: process.platform === 'win32'}, () => tmp(d => {
  const link = path.join(d, 'lineagesutra');
  fs.symlinkSync(cli, link);
  const r = spawnSync(process.execPath, [link, '--version'], {encoding: 'utf8'});
  assert.equal(r.status, 0);
  assert(r.stdout.includes('lineagesutra-ai'));
}));
