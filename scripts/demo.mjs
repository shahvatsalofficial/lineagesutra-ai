// Offline demo: rename customers.email and show why two downstream data products need review.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scan, impact, upstream, contractsCheck, verify} from '../packages/core/index.mjs';
import {save} from '../packages/reporting/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'examples/reports');
fs.mkdirSync(out, {recursive: true});
const graph = scan(path.join(root, 'fixtures/sample/sql'));
const change = impact(graph, {table: 'customers', column: 'email', change: 'rename'});
const trace = upstream(graph, {table: 'email_metrics', column: 'address'});
const contracts = contractsCheck(graph, JSON.parse(fs.readFileSync(path.join(root, 'fixtures/sample/contracts.json'), 'utf8')));
for (const [name, obj] of [['lineage', graph], ['impact', change], ['upstream', trace], ['contracts', contracts]]) for (const ext of ['json', 'md', 'html']) save(path.join(out, `${name}.${ext}`), obj, ext);
save(path.join(out, 'table-graph.mmd'), graph, 'mmd');
if (![graph, change, trace, contracts].every(verify)) throw new Error('Demo report seal failure');
console.log(JSON.stringify({result: change.result, sourceFiles: graph.sources.length, datasets: graph.nodes.length, edges: graph.edges.length, warnings: graph.warnings.length, confirmedImpacts: change.impacted.map(x => x.node), possibleImpacts: change.possible.map(x => x.node), upstreamOrigins: trace.origins, contractFindings: contracts.findings.length, output: out}, null, 2));
