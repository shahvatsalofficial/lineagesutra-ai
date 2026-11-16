// Regenerates docs/proof/*: a real test run (TAP + summary), environment, CLI transcripts, gold-corpus scores and benchmarks.
// Nothing here is hand-edited. Run: npm run proof
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runGold} from '../packages/core/gold.mjs';
import {runAudit} from '../packages/core/audit.mjs';
import {save} from '../packages/reporting/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'proof');
fs.mkdirSync(out, {recursive: true});
const run = args => spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8', timeout: 600000});

const tap = run(['--test', '--test-reporter=tap', ...fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.mjs')).sort().map(f => 'tests/' + f)]);
fs.writeFileSync(path.join(out, 'test-run.tap'), tap.stdout);
const n = k => Number((tap.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? NaN);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const env = {tool: pkg.name, version: pkg.version, node: process.version, platform: `${process.platform}/${process.arch}`, os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model?.trim(), recordedAt: new Date().toISOString(), tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped'), exitCode: tap.status};
fs.writeFileSync(path.join(out, 'environment.json'), JSON.stringify(env, null, 2) + '\n');

const gold = runGold(path.join(root, 'fixtures', 'gold', 'cases.json'));
fs.writeFileSync(path.join(out, 'gold-results.json'), JSON.stringify({cases: gold.cases, passed: gold.passed, truePositives: gold.tp, falsePositives: gold.fp, falseNegatives: gold.fn, precision: gold.precision, recall: gold.recall, f1: gold.f1, precisionCI95: gold.precisionCI, recallCI95: gold.recallCI, results: gold.results.map(r => ({id: r.id, tags: r.tags, pass: r.pass, tp: r.tp, fp: r.fp, fn: r.fn}))}, null, 2) + '\n');

const sample = (name, args) => {
  const r = run(['packages/cli/index.mjs', ...args]);
  fs.writeFileSync(path.join(out, name), `$ lineagesutra ${args.join(' ')}\n(exit ${r.status})\n\n${r.stdout}${r.stderr}`);
};
const g = path.join(os.tmpdir(), 'lineagesutra-proof-graph.json');
sample('cli-version.txt', ['--version']);
sample('cli-doctor.txt', ['doctor']);
sample('cli-scan.txt', ['scan', '--root', 'fixtures/sample/sql', '--out', g]);
sample('cli-impact-rename.txt', ['impact', '--input', g, '--table', 'customers', '--column', 'email', '--change', 'rename']);
sample('cli-upstream.txt', ['upstream', '--input', g, '--table', 'email_metrics', '--column', 'address']);
sample('cli-verify.txt', ['verify', '--input', g]);
sample('cli-scan-strict-fail.txt', ['scan', '--root', 'fixtures/unsupported', '--strict']);
fs.rmSync(g, {force: true});

const audit = await runAudit({withTests: false});
for (const ext of ['json', 'md', 'html']) save(path.join(out, `audit-report.${ext}`), audit, ext);
console.log(JSON.stringify({tests: env.tests, pass: env.pass, fail: env.fail, goldPassed: `${gold.passed}/${gold.cases}`, precision: gold.precision, recall: gold.recall, audit: audit.overall, out}, null, 2));
if (env.fail || audit.overall !== 'PASS') process.exitCode = 1;
