import fs from 'node:fs';
import path from 'node:path';
import {verify} from '../core/util.mjs';
import {VERSION} from '../core/version.mjs';

const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const mdc = s => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const loc = s => (s?.file ? `${s.file}${s.line ? ':' + s.line : ''}` : 'n/a');
const hash = r => r.integrity?.hash || 'NONE';
const kindOf = r => r.format || 'unknown';

const TITLES = {
  'lineagesutra.scan.v1': 'Lineage scan',
  'lineagesutra.impact.v1': 'Change impact',
  'lineagesutra.upstream.v1': 'Upstream trace',
  'lineagesutra.contract.v1': 'Contract check',
  'lineagesutra.compare.v1': 'Graph comparison',
  'lineagesutra.audit.v1': 'Independent audit report'
};
const status = r => r.result || r.verdict || (r.format === 'lineagesutra.audit.v1' ? r.overall : null) || 'SUPPORTED_SUBSET_ONLY';

// ---- Markdown -----------------------------------------------------------------------------------------------
function table(head, rows) {
  if (!rows.length) return '_None._\n\n';
  return `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rows.map(r => `| ${r.map(mdc).join(' | ')} |`).join('\n')}\n\n`;
}

export function markdown(report) {
  const f = kindOf(report);
  let out = `# LineageSutra AI - ${TITLES[f] || f}\n\n**Format:** \`${f}\`  \n**Review status:** ${status(report)}  \n**Tool:** lineagesutra-ai ${VERSION} (created by Vatsal Shah)\n\n`;
  if (f === 'lineagesutra.audit.v1') return markdownAudit(report, out);
  if (report.summary) out += Object.entries(report.summary).filter(([, v]) => typeof v !== 'object' || v === null).map(([k, v]) => `- ${k}: ${v}`).join('\n') + '\n\n';
  if (report.summary?.coverage) out += `- coverage: supported-subset ${report.summary.coverage.supportedSubset}, partial ${report.summary.coverage.partial}, unknown ${report.summary.coverage.unknown}\n\n`;
  if (report.target) out += `**Change target:** \`${report.target.table}${report.target.column ? '.' + report.target.column : ''}\`${report.target.change ? ` (${report.target.change})` : ''}${report.target.found === false ? ' - NOT FOUND in graph' : ''}\n\n`;
  if (report.nodes?.length) out += '## Datasets\n\n' + table(['Dataset', 'Kind', 'Certainty', 'Source', 'Columns'], report.nodes.map(n => [`\`${n.id}\``, n.kind, n.certainty, loc(n.source), n.columns.join(', ')]));
  if (report.edges?.length) out += '## Relationships\n\n' + table(['From', 'To', 'Type', 'Kind', 'Role', 'Certainty', 'Source'], report.edges.map(e => [`\`${e.from}\``, `\`${e.to}\``, e.type, e.kind || '', e.role || '', e.certainty, loc(e.source)]));
  if (report.impacted) out += '## Directly evidenced impacts (confirmed, static)\n\n' + table(['Node', 'Kind', 'Hops', 'Source', 'Proof path'], report.impacted.map(h => [`\`${h.node}\``, h.kind || h.type, h.depth ?? '', loc(h.source), (h.path || []).map(p => `${p.from} -> ${p.to}`).join(' ; ')]));
  if (report.possible) out += '## Possible impacts (not proven at field level)\n\n' + table(['Node', 'Certainty', 'Reason', 'Source'], report.possible.map(h => [`\`${h.node}\``, h.certainty, h.reason || '', loc(h.source)]));
  if (report.checklist?.length) out += '## Review checklist\n\n' + report.checklist.map(x => `- [ ] ${x}`).join('\n') + '\n\n';
  if (report.regressionTestIdeas?.length) out += '## Regression test ideas (suggestions only)\n\n' + report.regressionTestIdeas.map(x => `- ${x}`).join('\n') + '\n\n';
  if (report.upstream) out += '## Upstream columns / datasets\n\n' + table(['Node', 'Kind', 'Hops', 'Origin'], report.upstream.map(u => [`\`${u.node}\``, u.kind, u.depth, u.origin ? 'yes' : 'no']));
  if (report.indirectInfluences?.length) out += '## Indirect influences\n\n' + table(['Node', 'Role', 'Source'], report.indirectInfluences.map(x => [`\`${x.node}\``, x.role, loc(x.source)]));
  if (report.findings) out += '## Contract findings\n\n' + table(['Dataset', 'Field', 'Status', 'Reason'], report.findings.map(x => [x.dataset, x.field || '*', x.status, x.reason]));
  if (report.notRun?.length) out += '## Checks not run\n\n' + table(['Dataset', 'Check', 'Reason'], report.notRun.map(x => [x.dataset, x.check, x.reason]));
  if (f === 'lineagesutra.compare.v1') {
    out += '## Edges added\n\n' + (report.added.map(x => `- \`${x}\``).join('\n') || '_None._') + '\n\n## Edges removed\n\n' + (report.removed.map(x => `- \`${x}\``).join('\n') || '_None._') + '\n\n';
    out += '## Breaking changes (consumers affected in the BEFORE graph)\n\n' + table(['Removed', 'Consumers'], (report.breaking || []).map(b => [b.removedColumn || b.removedDataset, b.consumers.join(', ')]));
  }
  if (report.warnings?.length) out += '## Unresolved / unsupported SQL\n\n' + table(['File', 'Line', 'Kind', 'Detail'], report.warnings.map(w => [w.file, w.line ?? '', w.kind, w.detail]));
  const notes = report.limits || report.limitations || report.notes;
  if (notes) out += '## Limitations\n\n' + notes.map(x => '- ' + x).join('\n') + '\n\n';
  return out + `Integrity: SHA-256 \`${hash(report)}\` (tamper evidence, not a signature)\n`;
}

function markdownAudit(r, head) {
  let out = head + `**Overall:** ${r.overall}  \n**Checks:** ${r.totals.passed} passed, ${r.totals.failed} failed, ${r.totals.notRun} not run of ${r.totals.checks}\n\n> ${r.statement}\n\n`;
  for (const s of r.sections) {
    out += `## ${s.title}\n\n**Status:** ${s.status}\n\n${s.summary}\n\n`;
    if (s.table) out += table(s.table.columns, s.table.rows);
    if (s.bullets?.length) out += s.bullets.map(b => `- ${b}`).join('\n') + '\n\n';
  }
  out += '## Environment\n\n' + table(['Key', 'Value'], Object.entries(r.environment).map(([k, v]) => [k, String(v)]));
  out += '## Reproduce\n\n' + r.reproduce.map(c => '```bash\n' + c + '\n```').join('\n\n') + '\n\n';
  out += '## Honest limits\n\n' + r.limits.map(x => '- ' + x).join('\n') + '\n\n';
  return out + `Integrity: SHA-256 \`${hash(r)}\` (tamper evidence, not a signature)\n`;
}

export function mermaid(report) {
  if (!report.nodes) throw new Error('Expected graph');
  const safe = s => String(s).replace(/[^\w.\-]/g, '_');
  let text = 'flowchart LR\n';
  for (const n of report.nodes) text += `  ${safe(n.id)}["${safe(n.id)}"]\n`;
  for (const e of report.edges.filter(x => x.type === 'table')) text += `  ${safe(e.from)} --> ${safe(e.to)}\n`;
  return text;
}

// ---- HTML ---------------------------------------------------------------------------------------------------
export const CSS = `:root{--bg:#f5f7fa;--card:#fff;--ink:#0f1c2e;--mute:#516173;--line:#d9e1e8;--brand:#0b5fff;--ok:#0a7a3d;--okbg:#e3f6ea;--warn:#8a5a00;--warnbg:#fff2d6;--bad:#b3261e;--badbg:#fde7e5;--info:#1b4f9c;--infobg:#e4eefc;--code:#eef2f6}
@media(prefers-color-scheme:dark){:root{--bg:#0c1219;--card:#131c27;--ink:#e6edf5;--mute:#9db0c3;--line:#26364a;--brand:#6ea3ff;--ok:#6fdc9a;--okbg:#10301f;--warn:#f1c460;--warnbg:#33290f;--bad:#ff8f87;--badbg:#3a1714;--info:#8db8ff;--infobg:#11264a;--code:#1a2634}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--brand)}.skip{position:absolute;left:-999px;top:0;background:var(--brand);color:#fff;padding:.5rem 1rem}.skip:focus{left:0;z-index:9}
header.top{background:linear-gradient(135deg,#0b1f3a,#0b5fff);color:#fff;padding:2rem 1rem}header.top .in,main,footer .in{max-width:1120px;margin:0 auto;padding:0 1rem}
header.top h1{margin:.2rem 0;font-size:clamp(1.5rem,4vw,2.2rem)}header.top p{margin:.2rem 0;opacity:.9}.eyebrow{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
main{padding-top:1.5rem;padding-bottom:3rem}section.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.25rem 1.5rem;margin:1.25rem 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}
h2{margin:.1rem 0 .8rem;font-size:1.25rem}h3{font-size:1.05rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem}
.stat{background:var(--code);border-radius:12px;padding:.8rem 1rem}.stat b{display:block;font-size:1.6rem;line-height:1.2}.stat span{color:var(--mute);font-size:.85rem}
.badge{display:inline-block;border-radius:999px;padding:.1rem .65rem;font-size:.78rem;font-weight:650;border:1px solid transparent;white-space:nowrap}
.b-ok{background:var(--okbg);color:var(--ok);border-color:var(--ok)}.b-warn{background:var(--warnbg);color:var(--warn);border-color:var(--warn)}.b-bad{background:var(--badbg);color:var(--bad);border-color:var(--bad)}.b-info{background:var(--infobg);color:var(--info);border-color:var(--info)}
.banner{border-radius:12px;padding:.9rem 1.1rem;margin:1rem 0;border:1px solid;font-weight:600}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px}table{border-collapse:collapse;width:100%;font-size:.9rem}caption{text-align:left;padding:.6rem .8rem;font-weight:650;color:var(--mute)}
th,td{padding:.5rem .75rem;text-align:left;vertical-align:top;border-top:1px solid var(--line)}th{background:var(--code);position:sticky;top:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
code,pre{font:.86em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);border-radius:6px}code{padding:.05rem .35rem}pre{padding:.8rem;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere}
ul.clean{padding-left:1.2rem}ul.clean li{margin:.25rem 0}.mute{color:var(--mute)}footer{border-top:1px solid var(--line);padding:1.5rem 0;color:var(--mute);font-size:.85rem}
svg.graph{width:100%;height:auto;max-height:560px;background:var(--code);border-radius:10px}svg.graph text{fill:var(--ink);font:12px system-ui,sans-serif}svg.graph .nd{fill:var(--card);stroke:var(--brand);stroke-width:1.5}svg.graph .ext{stroke:var(--warn);stroke-dasharray:4 3}svg.graph .ed{stroke:var(--mute);fill:none;stroke-width:1.4}
details{margin:.5rem 0}summary{cursor:pointer;font-weight:600}:focus-visible{outline:3px solid var(--brand);outline-offset:2px}
@media print{body{background:#fff;color:#000}header.top{background:#fff;color:#000;border-bottom:2px solid #000}section.card{box-shadow:none;break-inside:avoid}.skip{display:none}}`;

const badge = (txt, cls) => `<span class="badge b-${cls}">${esc(txt)}</span>`;
const certBadge = c => badge(c, c === 'supported-subset' || c === 'PASS' || c === 'verified' ? 'ok' : /possible|partial|inferred|WARN|not-run|NOT_RUN/.test(c) ? 'warn' : /unknown|missing|FAIL|BLOCKED/.test(c) ? 'bad' : 'info');
function htable(caption, head, rows, empty = 'None.') {
  if (!rows.length) return `<p class="mute">${esc(empty)}</p>`;
  return `<div class="tw" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const sec = (id, title, body) => `<section class="card" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${body}</section>`;
const stat = (v, l) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;

function svgGraph(report) {
  const edges = report.edges.filter(e => e.type === 'table');
  const ids = new Set(edges.flatMap(e => [e.from, e.to]));
  if (!ids.size) return '<p class="mute">No dataset-level dependencies to draw.</p>';
  if (ids.size > 120) return `<p class="mute">Graph has ${ids.size} datasets, too many to draw legibly. Use the Mermaid export (<code>--format mmd</code>) or the tables below.</p>`;
  const layer = new Map([...ids].map(i => [i, 0]));
  for (let p = 0; p < ids.size; p++) { let ch = false; for (const e of edges) if (layer.get(e.to) < layer.get(e.from) + 1 && layer.get(e.from) + 1 < ids.size) { layer.set(e.to, layer.get(e.from) + 1); ch = true; } if (!ch) break; }
  const cols = [];
  for (const [i, l] of [...layer].sort((a, b) => (a[0] < b[0] ? -1 : 1))) (cols[l] ||= []).push(i);
  const W = 200, H = 34, GX = 90, GY = 16;
  const pos = new Map();
  cols.forEach((c, x) => (c || []).forEach((id, y) => pos.set(id, {x: 20 + x * (W + GX), y: 20 + y * (H + GY)})));
  const width = 40 + cols.length * (W + GX) - GX, height = 40 + Math.max(...cols.map(c => (c || []).length)) * (H + GY) - GY;
  const ext = new Set(report.nodes.filter(n => n.kind === 'external').map(n => n.id));
  const lines = edges.map(e => { const a = pos.get(e.from), b = pos.get(e.to); const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2; const mx = (x1 + x2) / 2; return `<path class="ed" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" marker-end="url(#ar)"/>`; }).join('');
  const boxes = [...pos].map(([id, p]) => `<g><rect class="nd${ext.has(id) ? ' ext' : ''}" x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="8"/><text x="${p.x + 10}" y="${p.y + 21}">${esc(id.length > 28 ? id.slice(0, 27) + '...' : id)}</text><title>${esc(id)}</title></g>`).join('');
  return `<svg class="graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="Dataset dependency graph with ${ids.size} datasets and ${edges.length} dependencies. The same data is listed in the tables below."><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" style="color:var(--mute)"/></marker></defs>${lines}${boxes}</svg><p class="mute">Solid boxes are declared in scanned SQL; dashed boxes are referenced but not declared (external).</p>`;
}

function body(report) {
  const f = kindOf(report);
  let b = '';
  const st = status(report);
  const bannerCls = /NOT_FOUND|BREAKING|FAIL/.test(st) ? 'bad' : /REVIEW|PARTIAL/.test(st) ? 'warn' : 'ok';
  b += `<div class="banner" style="background:var(--${bannerCls === 'bad' ? 'badbg' : bannerCls === 'warn' ? 'warnbg' : 'okbg'});color:var(--${bannerCls === 'ok' ? 'ok' : bannerCls});border-color:var(--${bannerCls === 'ok' ? 'ok' : bannerCls})" role="status">Review status: ${esc(st)}. Static analysis of SQL text only; a human must review before any production change.</div>`;
  if (report.summary) {
    const s = report.summary;
    b += '<div class="grid" aria-label="Summary">' + Object.entries(s).filter(([, v]) => typeof v === 'number').map(([k, v]) => stat(v, k.replace(/([A-Z])/g, ' $1').toLowerCase())).join('') + '</div>';
    if (s.coverage) b += `<p class="mute">Parser coverage on declared datasets: ${certBadge('supported-subset')} ${s.coverage.supportedSubset} &nbsp; ${certBadge('partial')} ${s.coverage.partial} &nbsp; ${certBadge('unknown')} ${s.coverage.unknown}</p>`;
  }
  if (report.target) b = `<p><strong>Change target:</strong> <code>${esc(report.target.table)}${report.target.column ? '.' + esc(report.target.column) : ''}</code> ${report.target.change ? badge(report.target.change, 'info') : ''} ${report.target.found === false ? badge('NOT FOUND', 'bad') : ''}</p>` + b;
  if (f === 'lineagesutra.scan.v1') {
    b += sec('graph', 'Dataset dependency graph', svgGraph(report));
    b += sec('datasets', 'Datasets', htable('Datasets', ['Dataset', 'Kind', 'Certainty', 'Source', 'Columns', 'Name hints'], report.nodes.map(n => [`<code>${esc(n.id)}</code>`, esc(n.kind), certBadge(n.certainty), esc(loc(n.source)), esc(n.columns.join(', ')), n.sensitivityHints ? badge(n.sensitivityHints.join(', '), 'warn') : ''])));
    b += sec('edges', 'Column and dataset relationships', htable('Relationships', ['From', 'To', 'Type', 'Kind', 'Role', 'Certainty', 'Source'], report.edges.map(e => [`<code>${esc(e.from)}</code>`, `<code>${esc(e.to)}</code>`, esc(e.type), e.kind ? badge(e.kind, e.kind === 'direct' ? 'ok' : 'info') : '', esc(e.role || ''), certBadge(e.certainty), esc(loc(e.source))])));
  }
  if (report.impacted) b += sec('confirmed', 'Confirmed static impacts', htable('Confirmed impacts', ['Node', 'Kind', 'Hops', 'Source', 'Proof path'], report.impacted.map(h => [`<code>${esc(h.node)}</code>`, badge(h.kind || h.type, h.kind === 'direct' ? 'ok' : 'info'), esc(h.depth ?? ''), esc(loc(h.source)), `<small>${(h.path || []).map(p => `<code>${esc(p.from)}</code> &rarr; <code>${esc(p.to)}</code>`).join('<br>')}</small>`]), 'No confirmed impacts in the supported SQL subset.'));
  if (report.possible) b += sec('possible', 'Possible impacts (not proven at field level)', htable('Possible impacts', ['Node', 'Certainty', 'Reason', 'Source'], report.possible.map(h => [`<code>${esc(h.node)}</code>`, certBadge(h.certainty), esc(h.reason || ''), esc(loc(h.source))]), 'None.'));
  if (report.checklist?.length) b += sec('checklist', 'Review checklist', `<ul class="clean">${report.checklist.map(x => `<li>&#9744; ${esc(x)}</li>`).join('')}</ul>`);
  if (report.regressionTestIdeas?.length) b += sec('tests', 'Regression test ideas (suggestions only)', `<ul class="clean">${report.regressionTestIdeas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  if (report.upstream) b += sec('upstream', 'Upstream trace', htable('Upstream', ['Node', 'Kind', 'Hops', 'Origin'], report.upstream.map(u => [`<code>${esc(u.node)}</code>`, esc(u.kind), esc(u.depth), u.origin ? badge('origin', 'ok') : '']), 'No upstream edges found.'));
  if (report.findings) b += sec('findings', 'Contract findings', htable('Findings', ['Dataset', 'Field', 'Status', 'Reason'], report.findings.map(x => [esc(x.dataset), esc(x.field || '*'), badge(x.status, 'bad'), esc(x.reason)]), 'No findings within the supported metadata subset.'));
  if (report.notRun?.length) b += sec('notrun', 'Checks not run', htable('Not run', ['Dataset', 'Check', 'Reason'], report.notRun.map(x => [esc(x.dataset), esc(x.check), esc(x.reason)])));
  if (f === 'lineagesutra.compare.v1') {
    b += sec('breaking', 'Breaking changes', htable('Breaking changes', ['Removed', 'Consumers in the BEFORE graph'], (report.breaking || []).map(x => [`<code>${esc(x.removedColumn || x.removedDataset)}</code>`, esc(x.consumers.join(', '))]), 'None detected in the supported subset.'));
    b += sec('delta', 'Edge delta', `<h3>Added (${report.added.length})</h3><ul class="clean">${report.added.map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ul><h3>Removed (${report.removed.length})</h3><ul class="clean">${report.removed.map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ul>`);
  }
  if (report.warnings?.length) b += sec('warnings', 'Unresolved or unsupported SQL', htable('Warnings', ['File', 'Line', 'Kind', 'Detail'], report.warnings.map(w => [esc(w.file), esc(w.line ?? ''), badge(w.kind, 'warn'), esc(w.detail)])));
  const notes = report.limits || report.limitations || report.notes;
  if (notes) b += sec('limits', 'Limitations', `<ul class="clean">${notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  return b;
}

function auditBody(r) {
  let b = `<div class="banner" style="background:var(--${r.overall === 'PASS' ? 'okbg' : 'badbg'});color:var(--${r.overall === 'PASS' ? 'ok' : 'bad'});border-color:var(--${r.overall === 'PASS' ? 'ok' : 'bad'})" role="status">Overall: ${esc(r.overall)} - ${r.totals.passed} passed, ${r.totals.failed} failed, ${r.totals.notRun} not run (${r.totals.checks} checks)</div><p>${esc(r.statement)}</p>`;
  b += '<div class="grid">' + r.scorecard.map(s => stat(s.value, s.label)).join('') + '</div>';
  b += `<nav aria-label="Sections"><ul class="clean">${r.sections.map(s => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a> ${certBadge(s.status)}</li>`).join('')}</ul></nav>`;
  for (const s of r.sections) {
    let inner = `<p>${esc(s.summary)}</p>`;
    if (s.table) inner += htable(s.title, s.table.columns, s.table.rows.map(row => row.map(c => (/^(PASS|FAIL|NOT_RUN|WARN)$/.test(String(c)) ? certBadge(String(c)) : esc(c)))));
    if (s.bullets?.length) inner += `<ul class="clean">${s.bullets.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    b += sec(s.id, s.title, `<p>${certBadge(s.status)}</p>${inner}`);
  }
  b += sec('env', 'Environment', htable('Environment', ['Key', 'Value'], Object.entries(r.environment).map(([k, v]) => [esc(k), esc(String(v))])));
  b += sec('reproduce', 'Reproduce this audit yourself', r.reproduce.map(c => `<pre><code>${esc(c)}</code></pre>`).join(''));
  b += sec('limits', 'Honest limits', `<ul class="clean">${r.limits.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  return b;
}

export function html(report) {
  const f = kindOf(report);
  const title = `LineageSutra AI - ${TITLES[f] || f}`;
  const inner = f === 'lineagesutra.audit.v1' ? auditBody(report) : body(report);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${CSS}</style></head>
<body><a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="in"><div class="eyebrow">LineageSutra AI &middot; v${esc(VERSION)} &middot; offline, read-only</div><h1>${esc(TITLES[f] || f)}</h1><p>Trace what flows. Understand what breaks. Evidence-first SQL lineage by Vatsal Shah.</p></div></header>
<main id="main">${inner}</main>
<footer><div class="in"><p>Format <code>${esc(f)}</code> &middot; Integrity SHA-256 <code>${esc(hash(report))}</code> (tamper evidence, not a signature) &middot; Verify with <code>lineagesutra verify --input report.json</code></p><p>Generated by lineagesutra-ai ${esc(VERSION)} &middot; Apache-2.0 &middot; Created by Vatsal Shah. Static analysis is evidence for human review, never a guarantee.</p></div></footer></body></html>
`;
}

export function save(out, report, fmt) {
  if (!verify(report)) throw new Error('Invalid report integrity');
  const file = path.resolve(out);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const bodyText = fmt === 'md' ? markdown(report) : fmt === 'html' ? html(report) : fmt === 'mmd' ? mermaid(report) : JSON.stringify(report, null, 2) + '\n';
  fs.writeFileSync(file, bodyText, 'utf8');
  return out;
}
