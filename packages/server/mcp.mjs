// Minimal read-only MCP server over stdio (newline-delimited JSON-RPC 2.0). No network, no writes, no SDK dependency.
// The scan root is fixed at start-up; tools never accept file-system paths, so a model cannot widen its own scope.
// Verified with a scripted JSON-RPC client (tests/mcp.test.mjs). NOT validated with MCP Inspector or a third-party client.
import readline from 'node:readline';
import {scan, impact, upstream, verify, VERSION} from '../core/index.mjs';

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const str = {type: 'string', minLength: 1, maxLength: 256};
export const TOOLS = [
  {name: 'scan_repository', description: 'Scan the configured SQL root (read-only) and return the sealed lineage summary: datasets, edge counts, parser coverage and warnings.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'get_parser_coverage', description: 'Return which declared datasets are fully parsed, partial or unknown, and every warning explaining what the parser refused to guess.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'downstream_impact', description: 'List confirmed (static, column-level) and possible downstream impacts of changing a table or column, with proof paths.', inputSchema: {type: 'object', properties: {table: str, column: str, change: {enum: ['rename', 'drop', 'type', 'modify']}}, required: ['table'], additionalProperties: false}},
  {name: 'upstream_dependencies', description: 'Trace the upstream sources of a table or column.', inputSchema: {type: 'object', properties: {table: str, column: str}, required: ['table'], additionalProperties: false}},
  {name: 'generate_change_checklist', description: 'Return a human review checklist for a proposed column change. Suggestions only; nothing is executed or modified.', inputSchema: {type: 'object', properties: {table: str, column: str, change: {enum: ['rename', 'drop', 'type', 'modify']}}, required: ['table', 'column'], additionalProperties: false}},
  {name: 'verify_evidence', description: 'Check the SHA-256 seal of a lineagesutra JSON report passed as a string.', inputSchema: {type: 'object', properties: {report: {type: 'string', maxLength: 8000000}}, required: ['report'], additionalProperties: false}}
];

export function handleCall(root, name, args = {}) {
  const need = (k, v) => { if (typeof v !== 'string' || !v) throw new Error(`Missing or invalid argument: ${k}`); return v; };
  switch (name) {
    case 'scan_repository': { const g = scan(root); return {format: g.format, seal: g.integrity.hash, summary: g.summary, warnings: g.warnings.length}; }
    case 'get_parser_coverage': { const g = scan(root); return {coverage: g.summary.coverage, datasets: g.nodes.map(n => ({id: n.id, certainty: n.certainty})), warnings: g.warnings}; }
    case 'downstream_impact': { const r = impact(scan(root), {table: need('table', args.table), column: args.column, change: args.change || 'modify'}); return {result: r.result, confirmed: r.impacted, possible: r.possible, notes: r.notes}; }
    case 'upstream_dependencies': { const r = upstream(scan(root), {table: need('table', args.table), column: args.column}); return {result: r.result, upstream: r.upstream, origins: r.origins}; }
    case 'generate_change_checklist': { const r = impact(scan(root), {table: need('table', args.table), column: need('column', args.column), change: args.change || 'modify'}); return {checklist: r.checklist, regressionTestIdeas: r.regressionTestIdeas, note: 'Suggestions only. Nothing was executed or modified.'}; }
    case 'verify_evidence': { let doc; try { doc = JSON.parse(need('report', args.report)); } catch { throw new Error('report is not valid JSON'); } return {verified: verify(doc)}; }
    default: throw Object.assign(new Error(`Unknown tool: ${name}`), {code: -32602});
  }
}

export function respond(root, msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return {jsonrpc: '2.0', id: msg?.id ?? null, error: {code: -32600, message: 'Invalid Request'}};
  const id = msg.id;
  const isNote = id === undefined;
  const ok = result => (isNote ? null : {jsonrpc: '2.0', id, result});
  const err = (code, message) => (isNote ? null : {jsonrpc: '2.0', id, error: {code, message}});
  switch (msg.method) {
    case 'initialize': {
      const want = msg.params?.protocolVersion;
      return ok({protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0], capabilities: {tools: {listChanged: false}}, serverInfo: {name: 'lineagesutra', version: VERSION}, instructions: 'Read-only SQL lineage tools scoped to one directory chosen by the user at start-up. Results are static analysis evidence for human review.'});
    }
    case 'notifications/initialized': case 'notifications/cancelled': return null;
    case 'ping': return ok({});
    case 'tools/list': return ok({tools: TOOLS});
    case 'tools/call': {
      const name = msg.params?.name;
      if (!TOOLS.some(t => t.name === name)) return err(-32602, `Unknown tool: ${name}`);
      try { return ok({content: [{type: 'text', text: JSON.stringify(handleCall(root, name, msg.params?.arguments || {}), null, 2)}], isError: false}); }
      catch (e) { return ok({content: [{type: 'text', text: `Error: ${e.message}`}], isError: true}); }
    }
    default: return err(-32601, `Method not found: ${msg.method}`);
  }
}

export function serveMcp(root, {input = process.stdin, output = process.stdout} = {}) {
  const rl = readline.createInterface({input, crlfDelay: Infinity});
  rl.on('line', line => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { output.write(JSON.stringify({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}) + '\n'); return; }
    const out = Array.isArray(msg) ? msg.map(m => respond(root, m)).filter(Boolean) : respond(root, msg);
    if (out && (!Array.isArray(out) || out.length)) output.write(JSON.stringify(out) + '\n');
  });
  return rl;
}
