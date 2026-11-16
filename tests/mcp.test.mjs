import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {respond, TOOLS} from '../packages/server/mcp.mjs';
import {scan} from '../packages/core/index.mjs';

const root = fileURLToPath(new URL('../fixtures/sample/sql/', import.meta.url));
const cli = fileURLToPath(new URL('../packages/cli/index.mjs', import.meta.url));
const call = (name, args) => respond(root, {jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name, arguments: args}});
const text = r => JSON.parse(r.result.content[0].text);

test('mcp: initialize negotiates a known protocol version and advertises tools only', () => {
  const r = respond(root, {jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-03-26'}});
  assert.equal(r.result.protocolVersion, '2025-03-26');
  assert.deepEqual(Object.keys(r.result.capabilities), ['tools']);
  assert.equal(respond(root, {jsonrpc: '2.0', id: 2, method: 'initialize', params: {protocolVersion: '1999-01-01'}}).result.protocolVersion, '2025-06-18');
});
test('mcp: notifications get no response', () => assert.equal(respond(root, {jsonrpc: '2.0', method: 'notifications/initialized'}), null));
test('mcp: tools/list exposes only read-only tools with strict JSON schemas', () => {
  const r = respond(root, {jsonrpc: '2.0', id: 3, method: 'tools/list'});
  assert.equal(r.result.tools.length, TOOLS.length);
  assert(r.result.tools.every(t => t.inputSchema.type === 'object' && t.inputSchema.additionalProperties === false));
  assert(!r.result.tools.some(t => /write|delete|exec|run|connect/i.test(t.name)));
});
test('mcp: downstream_impact returns proof-carrying findings', () => {
  const r = text(call('downstream_impact', {table: 'customers', column: 'email', change: 'rename'}));
  assert.equal(r.confirmed.length, 3);
  assert(r.confirmed[0].path.length >= 1);
});
test('mcp: upstream_dependencies and checklist work', () => {
  assert.deepEqual(text(call('upstream_dependencies', {table: 'email_metrics', column: 'address'})).origins, ['customers.email']);
  assert(text(call('generate_change_checklist', {table: 'customers', column: 'email'})).checklist.length > 0);
});
test('mcp: verify_evidence detects tampering', () => {
  const g = scan(root);
  assert.equal(text(call('verify_evidence', {report: JSON.stringify(g)})).verified, true);
  g.nodes.pop();
  assert.equal(text(call('verify_evidence', {report: JSON.stringify(g)})).verified, false);
});
test('mcp: tools ignore any path argument, so scope cannot be widened', () => {
  assert.equal(text(call('scan_repository', {root: '/etc'})).summary.sqlFiles, 4);
});
test('mcp: bad arguments become isError results; unknown tool and method become errors', () => {
  assert.equal(call('downstream_impact', {}).result.isError, true);
  assert.equal(call('delete_everything', {}).error.code, -32602);
  assert.equal(respond(root, {jsonrpc: '2.0', id: 9, method: 'resources/list'}).error.code, -32601);
  assert.equal(respond(root, {id: 1}).error.code, -32600);
});
test('mcp: end-to-end over stdio with the real CLI process', async () => {
  const child = spawn(process.execPath, [cli, 'mcp', '--root', root], {stdio: ['pipe', 'pipe', 'pipe']});
  const lines = [];
  let buf = '';
  child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = m => child.stdin.write(JSON.stringify(m) + '\n');
  send({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 't', version: '1'}}});
  send({jsonrpc: '2.0', method: 'notifications/initialized'});
  send({jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'get_parser_coverage', arguments: {}}});
  child.stdin.write('not json\n');
  for (let i = 0; i < 100 && lines.length < 3; i++) await new Promise(r => setTimeout(r, 100));
  child.kill();
  assert.equal(lines.length, 3);
  assert.equal(lines[0].id, 1);
  assert.equal(JSON.parse(lines[1].result.content[0].text).coverage.supportedSubset, 4);
  assert.equal(lines[2].error.code, -32700);
});
