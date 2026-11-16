import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {scan, scanSources, impact, upstream, compare, contractsCheck, verify, seal, parseSQL, tokenize} from '../packages/core/index.mjs';
import {runGold} from '../packages/core/gold.mjs';

const url = p => fileURLToPath(new URL(p, import.meta.url));
const before = scan(url('../fixtures/sample/sql/'));
const after = scan(url('../fixtures/migration/after/'));
const src = text => scanSources([{path: 'a.sql', text}], {label: 't'});

test('gold corpus: every hand-labelled case matches exactly', () => {
  const g = runGold(url('../fixtures/gold/cases.json'));
  const failing = g.results.filter(r => !r.pass).map(r => `${r.id}: missing ${r.missing} extra ${r.extra}`);
  assert.deepEqual(failing, []);
  assert.equal(g.fp, 0);
  assert.equal(g.fn, 0);
  assert(g.cases >= 50);
});

test('tokenizer drops comments and hides string contents', () => {
  const t = tokenize("select a /* from x */ , 'from y' -- from z\n from t").tokens.map(x => x.v);
  assert.deepEqual(t, ['select', 'a', ',', 'str', 'from', 't']);
});
test('tokenizer: bracket identifier vs array subscript', () => {
  assert.equal(tokenize('select [my col] from [t]').tokens.filter(t => t.t === 'qid').length, 2);
  assert.equal(tokenize('select arr[1] from t').tokens.filter(t => t.t === 'qid').length, 0);
});
test('tokenizer: jinja markers become tmpl tokens and set the flag', () => {
  const r = tokenize("select {{ ref('x') }} from {% if a %}t{% endif %}");
  assert(r.flags.templated);
  assert.equal(r.tokens.filter(t => t.t === 'tmpl').length, 3);
});
test('tokenizer: token limit stops hostile input', () => {
  assert.throws(() => tokenize('a '.repeat(500_000)), /token limit/);
});
test('parser reports line and column of edges', () => {
  const p = parseSQL('create table t(a int);\n\ncreate view v as\nselect\n  a\nfrom t;');
  const e = p.edges.find(x => x.type === 'column');
  assert.equal(e.source.line, 5);
  assert.equal(e.source.col, 3);
});
test('parser captures DDL types and NOT NULL', () => {
  const n = parseSQL('create table t(id int primary key, name varchar(20) not null, amt decimal(10,2));').nodes[0];
  assert.equal(n.columnTypes.name, 'varchar(20)');
  assert.equal(n.columnTypes.amt, 'decimal(10, 2)');
  assert.deepEqual(n.notNull.sort(), ['id', 'name']);
});
test('parser never throws on garbage; it warns', () => {
  for (const sql of ['', ';;;', '(((', ')))', 'create view', 'create table', 'insert into', 'select from where', 'create view v as select (', '\u0000\u0001']) {
    assert(Array.isArray(parseSQL(sql).warnings));
  }
});
test('duplicate declaration in one file warns', () => {
  assert(parseSQL('create table a(x int); create table a(y int);').warnings.some(w => w.kind === 'duplicate'));
});
test('cycle between views is reported', () => {
  assert(src('create view a as select * from b; create view b as select * from a;').warnings.some(w => w.kind === 'cycle'));
});
test('undeclared sources become explicit external nodes', () => {
  const ext = src('create view v as select x from ext;').nodes.find(n => n.id === 'ext');
  assert.equal(ext.kind, 'external');
  assert.equal(ext.certainty, 'inferred-from-reference');
});
test('sensitivity hints come from column names only and are labelled hints', () => {
  assert.deepEqual(src('create table u(id int, email text, phone_number text);').nodes[0].sensitivityHints, ['email', 'phone_number']);
});
test('scan seal is independent of file order', () => {
  const files = [{path: 'a.sql', text: 'create table t(a int);'}, {path: 'b.sql', text: 'create view v as select a from t;'}];
  assert.equal(scanSources(files).integrity.hash, scanSources([...files].reverse()).integrity.hash);
});
test('cross-file wildcard resolves through producers regardless of path order', () => {
  const g = scanSources([{path: 'a_consumer.sql', text: 'create view v2 as select * from v1;'}, {path: 'z_producer.sql', text: 'create view v1 as select a from t; create table t(a int);'}]);
  assert(g.edges.some(e => e.from === 'v1.a' && e.to === 'v2.a'));
  assert.equal(g.warnings.length, 0);
});

test('impact: confirmed path carries proof with source lines', () => {
  const i = impact(before, {table: 'customers', column: 'email', change: 'rename'});
  const deep = i.impacted.find(x => x.node === 'email_metrics.address');
  assert.equal(deep.depth, 2);
  assert.deepEqual(deep.path.map(p => p.from), ['customers.email', 'customers_public.email']);
  assert(deep.path.every(p => p.source.file && p.source.line));
  assert(i.checklist.length >= 3);
  assert(i.checklist[0].includes('Update the reference'));
});
test('impact: change type drives checklist wording', () => {
  assert(impact(before, {table: 'customers', column: 'email', change: 'drop'}).checklist[0].startsWith('BREAKING'));
  assert.throws(() => impact(before, {table: 'customers', column: 'email', change: 'explode'}), /Invalid --change/);
});
test('impact: unknown table is reported, not silently empty', () => {
  const i = impact(before, {table: 'nope', column: 'x'});
  assert.equal(i.result, 'TARGET_NOT_FOUND');
  assert.equal(i.target.found, false);
});
test('impact: indirect filter use is possible, not confirmed', () => {
  const g = src('create table t(a int, b int); create view v as select a from t where b > 0; create view w as select a from v;');
  const i = impact(g, {table: 't', column: 'b'});
  assert.equal(i.impacted.length, 0);
  assert(i.possible.some(p => p.node === 'v' && p.certainty === 'possible-indirect' && p.role === 'filter'));
  assert(i.possible.some(p => p.node === 'w' && p.certainty === 'possible-table-level'));
});
test('impact: qualified table suffix resolves to the declared dataset', () => {
  const i = impact(src('create table s.t(a int); create view s.v as select a from s.t;'), {table: 't', column: 'a'});
  assert.equal(i.target.table, 's.t');
  assert.equal(i.impacted.length, 1);
});
test('impact: sensitive-name hints are surfaced', () => {
  assert(impact(before, {table: 'customers', column: 'email'}).sensitivityHints.includes('customers.email'));
});
test('impact on a cyclic graph terminates', () => {
  const g = src('create table t(a int); create view x as select a from y; create view y as select a from x;');
  assert.doesNotThrow(() => impact(g, {table: 't', column: 'a'}));
});
test('impact: table mode lists downstream datasets with hop counts', () => {
  const i = impact(before, {table: 'customers'});
  assert.deepEqual(i.impacted.map(x => `${x.node}:${x.depth}`), ['campaign_recipients:1', 'customers_public:1', 'email_metrics:2']);
});
test('impact: seal is valid', () => assert(verify(impact(before, {table: 'customers', column: 'email'}))));

test('upstream: traces a column back to its origin', () => {
  const u = upstream(before, {table: 'email_metrics', column: 'address'});
  assert.deepEqual(u.origins, ['customers.email']);
  assert.equal(u.upstream.length, 2);
  assert(verify(u));
});
test('upstream: unknown target flagged', () => assert.equal(upstream(before, {table: 'zzz', column: 'a'}).result, 'TARGET_NOT_FOUND'));

test('compare (DriftRadar): renamed column breaks all consumers', () => {
  const c = compare(before, after);
  assert.equal(c.verdict, 'BREAKING_CHANGES_DETECTED');
  const b = c.breaking.find(x => x.removedColumn === 'customers.email');
  assert.deepEqual(b.consumers.sort(), ['campaign_recipients.email', 'customers_public.email', 'email_metrics.address']);
  assert.deepEqual(c.columnChanges.find(x => x.dataset === 'customers'), {dataset: 'customers', removed: ['email'], added: ['contact_email']});
});
test('compare: identical graphs are clean', () => assert.equal(compare(before, before).verdict, 'NO_BREAKING_CHANGES_IN_SUPPORTED_SUBSET'));
test('compare: removed dataset with consumers is breaking', () => {
  const a = src('create table t(a int); create view v as select a from t;');
  const b = src('create view v as select a from t;');
  assert(compare(a, b).breaking.some(x => x.removedDataset === 't'));
});

test('contract: type mismatch against DDL', () => {
  const g = src('create table t(id int, name varchar(20) not null);');
  const r = contractsCheck(g, {datasets: [{name: 't', requiredColumns: [{name: 'id', type: 'bigint'}, {name: 'name', type: 'varchar(20)', nullable: false}]}]});
  assert.deepEqual(r.findings.map(f => f.status), ['type-mismatch']);
});
test('contract: nullability requirement not met', () => {
  const g = src('create table t(id int);');
  assert.equal(contractsCheck(g, {datasets: [{name: 't', requiredColumns: [{name: 'id', nullable: false}]}]}).findings[0].status, 'nullability-mismatch');
});
test('contract: forbidden column present', () => {
  const g = src('create table t(id int, ssn text);');
  assert.equal(contractsCheck(g, {datasets: [{name: 't', requiredColumns: ['id'], forbiddenColumns: ['ssn']}]}).findings[0].status, 'forbidden-present');
});
test('contract: freshness SLA and missing owner are NOT_RUN, never PASS', () => {
  const g = src('create table t(id int);');
  const r = contractsCheck(g, {datasets: [{name: 't', requiredColumns: ['id'], freshnessSla: 'PT1H'}]});
  assert.equal(r.verdict, 'SUPPORTED_SUBSET_CHECK_PASSED');
  assert.deepEqual(r.notRun.map(x => x.check).sort(), ['freshness', 'owner']);
});
test('contract: external dataset is unverified', () => {
  const g = src('create view v as select a from ext;');
  assert.equal(contractsCheck(g, {datasets: [{name: 'ext', requiredColumns: ['a']}]}).findings[0].status, 'unverified');
});

test('seal: unicode, nested and ordering stability', () => {
  assert.equal(seal({b: {y: 1, x: 'é'}, a: [1, 2]}).integrity.hash, seal({a: [1, 2], b: {x: 'é', y: 1}}).integrity.hash);
});

test('property: adding edges never shrinks the confirmed impact set (200 random graphs)', () => {
  let s = 7;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let n = 0; n < 200; n++) {
    const nodes = Array.from({length: 8}, (_, i) => ({id: `d${i}`, kind: 'table', columns: ['x'], certainty: 'supported-subset', source: {file: 'f', line: 1}}));
    const mk = () => { const a = Math.floor(rnd() * 8), b = Math.floor(rnd() * 8); return {from: `d${a}.x`, to: `d${b}.x`, type: 'column', kind: 'direct', certainty: 'supported-subset', source: {file: 'f', line: 1}}; };
    const edges = Array.from({length: 6}, mk);
    const g1 = seal({format: 'lineagesutra.scan.v1', nodes, edges, warnings: [], sources: []});
    const g2 = seal({format: 'lineagesutra.scan.v1', nodes, edges: [...edges, mk()], warnings: [], sources: []});
    const a = new Set(impact(g1, {table: 'd0', column: 'x'}).impacted.map(x => x.node));
    const b = new Set(impact(g2, {table: 'd0', column: 'x'}).impacted.map(x => x.node));
    for (const x of a) assert(b.has(x));
  }
});

test('fuzz: 1500 seeded token streams never throw a non-Error and never hang', () => {
  let s = 99;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const vocab = ['select', 'from', 'create', 'view', 'table', 'as', 'join', 'on', 'where', 'with', 'union', 'insert', 'into', '(', ')', ',', ';', '.', '*', 'a', 'b', 't', "'x'", '"q"', '[b]', '`c`', '{{', '}}', '--', '/*', '::', 'over', 'case', 'when', 'end', 'cast', 'group', 'by', '1', '$$'];
  for (let i = 0; i < 1500; i++) {
    const sql = Array.from({length: 1 + Math.floor(rnd() * 60)}, () => vocab[Math.floor(rnd() * vocab.length)]).join(' ');
    const t0 = performance.now();
    try { parseSQL(sql); } catch (e) { assert(e instanceof Error && !(e instanceof TypeError) && !(e instanceof RangeError), `${e} on ${sql}`); }
    assert(performance.now() - t0 < 1000, `slow input: ${sql}`);
  }
});

test('migration fixture exists', () => {
  assert(fs.existsSync(url('../fixtures/migration/after/00_customers.sql')));
});
