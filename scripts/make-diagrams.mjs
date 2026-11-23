// Generates SVG diagrams for the documentation from REAL tool output (scan/impact/compare/gold results).
// Run: node scripts/make-diagrams.mjs   -> documents/LineageSutra-AI/assets/*.svg
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scan, impact, compare} from '../packages/core/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'documents', 'LineageSutra-AI', 'assets');
fs.mkdirSync(out, {recursive: true});
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const STYLE = `:root{--bg:#f7f9fc;--card:#fff;--ink:#14202b;--mute:#5b6b79;--line:#c5d0da;--brand:#0b5fff;--ok:#0a7a3d;--okbg:#e3f6ea;--warn:#946000;--warnbg:#fff2d6;--bad:#b3261e;--badbg:#fde7e5;--info:#1b4f9c;--infobg:#e4eefc}
@media(prefers-color-scheme:dark){:root{--bg:#0f1720;--card:#16212d;--ink:#e6edf5;--mute:#9db0c3;--line:#2c3d50;--brand:#6ea3ff;--ok:#6fdc9a;--okbg:#10301f;--warn:#f1c460;--warnbg:#33290f;--bad:#ff8f87;--badbg:#3a1714;--info:#8db8ff;--infobg:#11264a}}
text{fill:var(--ink);font:13px system-ui,Segoe UI,sans-serif}.s{font-size:11px;fill:var(--mute)}.b{font-weight:700}.h{font-size:16px;font-weight:700}.c{text-anchor:middle}
.bg{fill:var(--bg)}.card{fill:var(--card);stroke:var(--line);stroke-width:1.5}.ok{fill:var(--okbg);stroke:var(--ok);stroke-width:1.5}.warn{fill:var(--warnbg);stroke:var(--warn);stroke-width:1.5}.bad{fill:var(--badbg);stroke:var(--bad);stroke-width:1.5}.info{fill:var(--infobg);stroke:var(--info);stroke-width:1.5}
.ln{stroke:var(--mute);stroke-width:1.6;fill:none}.lok{stroke:var(--ok);stroke-width:2.4;fill:none}.lbad{stroke:var(--bad);stroke-width:2.4;fill:none}.lwarn{stroke:var(--warn);stroke-width:2.2;fill:none;stroke-dasharray:6 4}.ld{stroke:var(--line);stroke-width:1.4;fill:none}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}`;
const DEFS = '<defs><marker id="a" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#8a99a8"/></marker></defs>';
const svg = (w, h, label, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><style>${STYLE}</style>${DEFS}<rect class="bg" width="${w}" height="${h}" rx="14"/>${body}</svg>`;
const box = (x, y, w, h, cls, lines) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>` + lines.map((l, i) => `<text class="c${i === 0 ? ' b' : ' s'}" x="${x + w / 2}" y="${y + h / 2 + (i - (lines.length - 1) / 2) * 17 + 4}">${esc(l)}</text>`).join('');
const arrow = (x1, y1, x2, y2, cls = 'ln') => `<path class="${cls}" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#a)"/>`;
const curve = (x1, y1, x2, y2, cls) => { const m = (x1 + x2) / 2; return `<path class="${cls}" d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}"/>`; };
const MEDIA = /@media\(prefers-color-scheme:dark\)\{(:root\{[^}]*\})\}/;
const write = (name, s) => { fs.writeFileSync(path.join(out, name), s.replace(MEDIA, "")); fs.writeFileSync(path.join(out, name.replace(".svg", "-dark.svg")), s.replace(MEDIA, "$1")); };

const g = scan(path.join(root, 'fixtures/sample/sql'));
const imp = impact(g, {table: 'customers', column: 'email', change: 'rename'});

// ---- dataset/column graph renderer (real data) ----
function graph(report, {highlight = new Set(), subtitle}) {
  const nodes = report.nodes.filter(n => n.kind !== 'external');
  const layer = new Map(nodes.map(n => [n.id, 0]));
  for (let p = 0; p < nodes.length; p++) for (const e of report.edges) if (e.type === 'table' && layer.has(e.from) && layer.has(e.to) && layer.get(e.to) < layer.get(e.from) + 1) layer.set(e.to, layer.get(e.from) + 1);
  const cols = [];
  for (const n of nodes) (cols[layer.get(n.id)] ||= []).push(n);
  const BW = 200, RH = 22, HH = 30, GX = 130, GY = 26, TOP = 56;
  const pos = new Map();
  let H = 0;
  cols.forEach((c, x) => { let y = TOP; for (const n of c) { const h = HH + n.columns.length * RH + 8; pos.set(n.id, {x: 30 + x * (BW + GX), y, h}); y += h + GY; } H = Math.max(H, y); });
  const W = 60 + cols.length * (BW + GX) - GX;
  const anchor = (id, side) => { const dsId = id.split('.').slice(0, -1).join('.'), col = id.split('.').at(-1); const p = pos.get(dsId), n = nodes.find(z => z.id === dsId); if (!p || !n) return null; const i = n.columns.indexOf(col); return {x: p.x + (side === 'r' ? BW : 0), y: p.y + HH + i * RH + RH / 2 + 4}; };
  let body = `<text class="h" x="30" y="30">${esc(subtitle)}</text>`;
  for (const e of report.edges.filter(x => x.type === 'column')) {
    const a = anchor(e.from, 'r'), b = anchor(e.to, 'l'); if (!a || !b) continue;
    const hot = highlight.has(`${e.from}>${e.to}`);
    body += curve(a.x, a.y, b.x, b.y, hot ? 'lbad' : 'ld');
  }
  for (const n of nodes) {
    const p = pos.get(n.id);
    body += `<rect class="card" x="${p.x}" y="${p.y}" width="${BW}" height="${p.h}" rx="10"/><text class="b" x="${p.x + 12}" y="${p.y + 20}">${esc(n.id)}</text><text class="s" x="${p.x + BW - 10}" y="${p.y + 20}" text-anchor="end">${esc(n.kind)}</text>`;
    n.columns.forEach((c, i) => {
      const hot = [...highlight].some(h => h.startsWith(`${n.id}.${c}>`) || h.endsWith(`>${n.id}.${c}`));
      body += `${hot ? `<rect class="bad" x="${p.x + 6}" y="${p.y + HH + i * RH + 3}" width="${BW - 12}" height="${RH - 2}" rx="5"/>` : ''}<text class="mono" x="${p.x + 14}" y="${p.y + HH + i * RH + RH / 2 + 8}">${esc(c)}</text>`;
    });
  }
  return svg(W, Math.max(H, 120), subtitle, body);
}
write('lineage-graph.svg', graph(g, {subtitle: 'Column-level lineage of the bundled sample (real scan output)'}));
const hot = new Set();
for (const h of imp.impacted) for (const p of h.path) hot.add(`${p.from}>${p.to}`);
write('blast-radius.svg', graph(g, {highlight: hot, subtitle: 'Blast radius of renaming customers.email (red = confirmed static impact)'}));

// ---- pipeline ----
{
  const bs = [['SQL files', 'or dbt manifest', 'info'], ['Tokenizer', 'comments dropped', 'card'], ['Parser', 'queries, joins, CTEs', 'card'], ['Scan', 'cross-file schemas', 'card'], ['Sealed graph', 'SHA-256 seal', 'ok']];
  let b = '<text class="h" x="30" y="30">How LineageSutra AI turns SQL into evidence</text>';
  bs.forEach((x, i) => { b += box(30 + i * 190, 60, 150, 62, x[2], [x[0], x[1]]); if (i < bs.length - 1) b += arrow(180 + i * 190, 91, 220 + i * 190, 91); });
  b += box(790, 190, 150, 62, 'card', ['impact', 'what breaks?']) + box(790, 270, 150, 62, 'card', ['upstream', 'where from?']) + box(570, 190, 150, 62, 'card', ['compare', 'drift in CI']) + box(570, 270, 150, 62, 'card', ['contract', 'declared rules']);
  b += `<path class="ln" d="M865,122 L865,150 L865,190" marker-end="url(#a)"/><path class="ln" d="M865,150 L645,150 L645,190" marker-end="url(#a)"/>`;
  b += box(250, 190, 250, 62, 'ok', ['Reports', 'Markdown + HTML + JSON']) + box(250, 270, 250, 62, 'warn', ['Warnings', 'what it refused to guess']);
  b += `<path class="ln" d="M570,221 L500,221" marker-end="url(#a)"/><path class="ln" d="M865,332 L865,360 L375,360 L375,332" marker-end="url(#a)"/>`;
  b += '<text class="s" x="30" y="392">No network. No database. No row data. Every stage is deterministic; the same files always give the same seal.</text>';
  write('pipeline.svg', svg(980, 410, 'Pipeline from SQL files to sealed graph, analyses and reports', b));
}

// ---- edge kinds ----
{
  const cards = [['direct', 'ok', 'SELECT email FROM customers', 'customers.email  =>  v.email', 'Plain copy. Rename or drop breaks it.'], ['derived', 'info', 'SELECT upper(email) AS e FROM customers', 'customers.email  =>  v.e', 'Expression, aggregate, window or subquery. The value changes if the input changes.'], ['indirect', 'warn', 'SELECT id FROM customers WHERE email LIKE \'%@x\'', 'customers.email  ~>  v (dataset)', 'Decides which rows exist, or how they group and order. Reported as possible.']];
  let b = '<text class="h" x="30" y="30">Three kinds of dependency</text>';
  cards.forEach((c, i) => { const x = 30 + i * 320; b += `<rect class="${c[1]}" x="${x}" y="56" width="296" height="170" rx="12"/><text class="b" x="${x + 16}" y="82" style="font-size:16px">${c[0]}</text><text class="mono" x="${x + 16}" y="110">${esc(c[2].length > 36 ? c[2].slice(0, 35) + '...' : c[2])}</text><text class="mono b" x="${x + 16}" y="140">${esc(c[3])}</text>`; const words = c[4].split(' '); let line = '', y = 170; for (const w of words) { if ((line + w).length > 38) { b += `<text class="s" x="${x + 16}" y="${y}">${esc(line)}</text>`; line = ''; y += 16; } line += w + ' '; } b += `<text class="s" x="${x + 16}" y="${y}">${esc(line)}</text>`; });
  write('edge-kinds.svg', svg(980, 250, 'Direct, derived and indirect dependency kinds with examples', b));
}

// ---- decision flowchart ----
{
  let b = '<text class="h" x="30" y="30">How an impact finding is classified</text>';
  b += box(30, 56, 220, 58, 'info', ['Change column C of table T', 'rename / drop / type']);
  b += arrow(250, 85, 310, 85) + box(310, 56, 260, 58, 'card', ['Is C copied or computed in a', 'parsed SELECT item downstream?']);
  b += `<text class="s" x="580" y="76">yes</text>` + arrow(570, 85, 640, 85) + box(640, 56, 220, 58, 'bad', ['CONFIRMED (static)', 'proof path + file:line']);
  b += `<text class="s" x="446" y="140">no</text>` + arrow(440, 114, 440, 160);
  b += box(310, 160, 260, 58, 'card', ['Is C used in WHERE, JOIN,', 'GROUP, HAVING or ORDER?']);
  b += `<text class="s" x="580" y="180">yes</text>` + arrow(570, 189, 640, 189) + box(640, 160, 220, 58, 'warn', ['POSSIBLE (indirect)', 'dataset rows may change']);
  b += `<text class="s" x="446" y="244">no</text>` + arrow(440, 218, 440, 264);
  b += box(310, 264, 260, 58, 'card', ['Is a table downstream of T', 'with unparsed or unknown SQL?']);
  b += `<text class="s" x="580" y="284">yes</text>` + arrow(570, 293, 640, 293) + box(640, 264, 220, 58, 'warn', ['POSSIBLE (table-level)', 'check with the owner']);
  b += `<text class="s" x="446" y="348">no</text>` + arrow(440, 322, 440, 368) + box(310, 368, 260, 58, 'ok', ['No dependency found in the', 'supported subset - read warnings']);
  write('decision-flow.svg', svg(900, 450, 'Flowchart: confirmed versus possible impact classification', b));
}

// ---- gold corpus chart ----
{
  const gold = JSON.parse(fs.readFileSync(path.join(root, 'docs/proof/gold-results.json'), 'utf8'));
  const tags = new Map();
  for (const r of gold.results) for (const t of r.tags.length ? r.tags : ['untagged']) { const x = tags.get(t) || {n: 0, p: 0}; x.n++; if (r.pass) x.p++; tags.set(t, x); }
  const rows = [...tags].sort((a, b) => b[1].n - a[1].n);
  const BH = 24;
  let b = `<text class="h" x="30" y="30">Gold corpus: ${gold.passed}/${gold.cases} cases exact, ${gold.truePositives} expected edges, ${gold.falsePositives} false, ${gold.falseNegatives} missed</text>`;
  rows.forEach(([t, x], i) => { const y = 56 + i * (BH + 8), w = 520; b += `<text x="30" y="${y + 17}">${esc(t)}</text><rect class="card" x="150" y="${y}" width="${w}" height="${BH}" rx="6"/><rect class="ok" x="150" y="${y}" width="${w * x.p / x.n}" height="${BH}" rx="6"/><text class="s" x="${150 + w + 12}" y="${y + 17}">${x.p}/${x.n} exact</text>`; });
  b += `<text class="s" x="30" y="${56 + rows.length * (BH + 8) + 18}">Author-labelled regression corpus, not an independent benchmark. Labels were written before the parser was run.</text>`;
  write('gold-corpus.svg', svg(840, 90 + rows.length * (BH + 8), 'Gold corpus accuracy by tag', b));
}

// ---- performance ----
{
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs/proof/audit-report.json'), 'utf8'));
  const rows = audit.sections.find(s => s.id === 'performance').table.rows;
  const num = re => Number((String(rows.find(r => re.test(r[0]))[2]).match(/median (\d+) ms/) || [])[1]);
  const items = [['Scan: 2,000 chained views', num(/scan of 2,000/), 30000], ['Impact: 20,000-dataset graph', num(/impact traversal/), 5000]];
  let b = '<text class="h" x="30" y="30">Measured speed vs. budget (median, this machine, synthetic data)</text>';
  items.forEach(([l, v, budget], i) => { const y = 64 + i * 64, w = 560; b += `<text x="30" y="${y + 4}">${esc(l)}</text><rect class="card" x="30" y="${y + 14}" width="${w}" height="22" rx="6"/><rect class="ok" x="30" y="${y + 14}" width="${Math.max(4, w * v / budget)}" height="22" rx="6"/><text class="s" x="${30 + w + 12}" y="${y + 30}">${v} ms of ${budget} ms budget</text>`; });
  write('performance.svg', svg(900, 200, 'Performance versus budget', b));
}

// ---- CI gate ----
{
  let b = '<text class="h" x="30" y="30">Breaking-change gate in a pull request</text>';
  const s = [['Pull request', 'changes .sql files', 'info'], ['scan --strict', 'new graph', 'card'], ['compare', 'baseline vs new', 'card']];
  s.forEach((x, i) => { b += box(30 + i * 210, 60, 170, 60, x[2], [x[0], x[1]]); if (i < 2) b += arrow(200 + i * 210, 90, 240 + i * 210, 90); });
  b += arrow(620, 90, 670, 90) + box(670, 60, 230, 60, 'card', ['--fail-on-breaking', 'any consumer lost a column?']);
  b += `<text class="s" x="690" y="148">yes (exit 3)</text>` + arrow(740, 120, 740, 170) + box(640, 170, 260, 64, 'bad', ['Job fails', 'drift.html lists every consumer']);
  b += `<text class="s" x="920" y="148">no (exit 0)</text><path class="ln" d="M880,120 L880,150 L930,150 L930,260 L520,260" />` + box(300, 236, 220, 48, 'ok', ['Merge allowed', 'reviewers can still read drift.html']);
  write('ci-gate.svg', svg(1000, 310, 'CI gate flow for breaking schema changes', b));
}

// ---- DriftRadar rename ----
{
  const after = scan(path.join(root, 'fixtures/migration/after'));
  const cmp = compare(g, after);
  const cons = cmp.breaking.find(x => x.removedColumn === 'customers.email')?.consumers || [];
  let b = '<text class="h" x="30" y="30">DriftRadar: what a column rename breaks (real compare output)</text>';
  b += box(30, 56, 240, 110, 'card', ['BEFORE  customers', 'id, email, created_at']) + arrow(270, 111, 330, 111) + box(330, 56, 260, 110, 'warn', ['AFTER  customers', 'id, contact_email, created_at', 'email removed, contact_email added']);
  b += arrow(460, 166, 460, 210);
  cons.forEach((c, i) => { b += box(30 + i * 300, 210, 270, 50, 'bad', [c, 'still reads customers.email']); b += `<path class="lbad" d="M${165 + i * 300},210 L460,176" opacity=".35"/>`; });
  b += `<text class="s" x="30" y="296">Verdict: ${esc(cmp.verdict)}. With --fail-on-breaking the CI job exits 3 and lists these consumers.</text>`;
  write('drift-rename.svg', svg(930, 316, 'Rename of customers.email breaks three consumers', b));
}

// ---- ambiguity ----
{
  let b = '<text class="h" x="30" y="30">Unknown stays unknown: the parser refuses to guess</text>';
  b += `<rect class="card" x="30" y="56" width="420" height="120" rx="10"/><text class="mono" x="46" y="86">CREATE VIEW v AS</text><text class="mono" x="46" y="108">SELECT id</text><text class="mono" x="46" y="130">FROM a JOIN b ON a.id = b.id;</text><text class="s" x="46" y="158">Which table does the bare "id" belong to?</text>`;
  b += arrow(450, 116, 520, 116) + box(520, 56, 380, 56, 'ok', ['Recorded: join dependency', 'a.id and b.id (indirect, role: join)']) + box(520, 124, 380, 56, 'warn', ['Warning: column-unknown', 'no edge is invented for "id"']);
  b += '<text class="s" x="30" y="206">A wrong confident edge is worse than a visible gap. Add the CREATE TABLE statements to the scanned folder and the ambiguity disappears.</text>';
  write('ambiguity.svg', svg(930, 226, 'Ambiguous column becomes a warning instead of an edge', b));
}

// ---- architecture layers ----
{
  let b = '<text class="h" x="30" y="30">Five layers, built from the inside out</text>';
  const L = [['E  Hosted dashboard + server', 'not started', 'card'], ['D  Hosts: CLI, Node API, MCP, loopback HTTP, skill installer', 'implemented', 'ok'], ['C  Agent Skills: 25 skills, 20 role files', 'authored, host activation untested', 'warn'], ['B  Adapters: dbt manifest (done), SQLGlot / OpenLineage (planned)', 'partly implemented', 'warn'], ['A  Trusted local core: tokenizer, parser, scan, impact, seal', 'implemented, tested', 'ok']];
  L.forEach((l, i) => { b += `<rect class="${l[2]}" x="${30 + i * 18}" y="${56 + i * 60}" width="${760 - i * 36}" height="50" rx="10"/><text class="b" x="${48 + i * 18}" y="${78 + i * 60}">${esc(l[0])}</text><text class="s" x="${48 + i * 18}" y="${96 + i * 60}">${esc(l[1])}</text>`; });
  write('layers.svg', svg(820, 370, 'Architecture layers and implementation state', b));
}
console.log(fs.readdirSync(out).join('\n'));
