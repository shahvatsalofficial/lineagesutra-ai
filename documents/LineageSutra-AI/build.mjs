#!/usr/bin/env node
// Builds the documentation website (html/) from md/ with zero dependencies.
// Run from the repo root:  npm run proof && node scripts/make-diagrams.mjs && node documents/LineageSutra-AI/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..', '..');
const MD = path.join(HERE, 'md'), OUT = path.join(HERE, 'html'), SITE = path.join(HERE, 'site');
const REPO = 'https://github.com/shahvatsalofficial/lineagesutra-ai';
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const env = rd(path.join(PROJECT, 'docs/proof/environment.json')), gold = rd(path.join(PROJECT, 'docs/proof/gold-results.json')), aud = rd(path.join(PROJECT, 'docs/proof/audit-report.json'));
const perf = aud.sections.find(x => x.id === 'performance').table.rows;
const med = re => (String(perf.find(x => re.test(x[0]))[2]).match(/median (\d+) ms/) || [])[1];
const vars = {VERSION: env.version, NODE: env.node, PLATFORM: env.platform, RECORDED: env.recordedAt, TESTS: env.tests, PASS: env.pass, FAIL: env.fail, SKIPPED: env.skipped, GOLD_CASES: gold.cases, GOLD_PASSED: gold.passed, GOLD_EDGES: gold.truePositives, CHECKS_PASSED: aud.totals.passed, CHECKS_FAILED: aud.totals.failed, CHECKS_NOTRUN: aud.totals.notRun, SCAN_MS: med(/scan of 2,000/), IMPACT_MS: med(/impact traversal/)};
for (const [k, v] of Object.entries(vars)) if (v === undefined || v === 'undefined') throw new Error('Missing value for ' + k);
const fill = s => s.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vars)) throw new Error('Unknown placeholder ' + k); return String(vars[k]); });

// ---- assets ----
fs.mkdirSync(OUT, {recursive: true});
for (const e of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, e), {recursive: true, force: true}); // keep OUT itself: a dev server may hold it open
fs.mkdirSync(path.join(OUT, 'assets'), {recursive: true});
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), {recursive: true}); fs.copyFileSync(a, b); };
fs.cpSync(path.join(HERE, 'assets'), path.join(OUT, 'assets'), {recursive: true});
cp(path.join(SITE, 'site.css'), path.join(OUT, 'assets/site.css'));
cp(path.join(SITE, 'site.js'), path.join(OUT, 'assets/site.js'));
for (const f of fs.readdirSync(path.join(PROJECT, 'docs/proof'))) {
  const src = path.join(PROJECT, 'docs/proof', f);
  cp(src, path.join(OUT, f.startsWith('cli-') || f.startsWith('audit-report') ? 'samples' : 'test-results', f));
}

// ---- markdown ----
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const figure = (alt, src) => `<figure class="fig"><div class="scroll" tabindex="0" role="group" aria-label="${esc(alt)}"><img class="lt" src="${src}" alt="${esc(alt)}" loading="lazy"><img class="dk" src="${src.replace('.svg', '-dark.svg')}" alt="" aria-hidden="true" loading="lazy"></div><figcaption>${esc(alt)}</figcaption></figure>`;
function inline(t) {
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = esc(t);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/&lt;(https?:\/\/[^&]+)&gt;/g, '<a href="$1">$1</a>');
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${esc(codes[i])}</code>`);
}
function md2html(src) {
  const L = src.split(/\r?\n/), o = [], heads = [];
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (l.startsWith('```')) { const buf = []; i++; while (i < L.length && !L[i].startsWith('```')) buf.push(L[i++]); i++; o.push(`<div class="code"><button class="copy" data-act="copy" type="button" aria-label="Copy code">Copy</button><pre><code>${esc(buf.join('\n'))}</code></pre></div>`); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { const n = m[1].length, id = slug(m[2]); if (n === 2 || n === 3) heads.push({n, id, t: m[2]}); o.push(`<h${n} id="${id}">${inline(m[2])}${n > 1 ? `<a class="anc" href="#${id}" aria-label="Link to this section">#</a>` : ''}</h${n}>`); i++; continue; }
    if ((m = l.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/))) { o.push(figure(m[1], m[2])); i++; continue; }
    if (l.startsWith('|') && L[i + 1] && /^\|[\s:|-]+\|?$/.test(L[i + 1])) {
      const row = s => s.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|'));
      const h = row(l); i += 2; const rows = [];
      while (i < L.length && L[i].startsWith('|')) rows.push(row(L[i++]));
      o.push(`<div class="scroll" tabindex="0"><table><thead><tr>${h.map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^\s*[-*]\s+/.test(l)) { const items = []; while (i < L.length && /^\s*[-*]\s+/.test(L[i])) items.push(L[i++].replace(/^\s*[-*]\s+/, '')); o.push(`<ul>${items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`); continue; }
    if (/^\d+\.\s+/.test(l)) { const items = []; while (i < L.length && /^\d+\.\s+/.test(L[i])) items.push(L[i++].replace(/^\d+\.\s+/, '')); o.push(`<ol>${items.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`); continue; }
    if (l.startsWith('>')) { o.push(`<blockquote><p>${inline(l.replace(/^>\s?/, ''))}</p></blockquote>`); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = [l]; i++;
    while (i < L.length && L[i].trim() && !/^(#|```|\||>|!\[|\s*[-*]\s|\d+\.\s)/.test(L[i])) buf.push(L[i++]);
    o.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return {html: o.join('\n'), heads};
}

// ---- pages ----
const GROUPS = [['Get started', ['00', '17']], ['Understand', ['01', '02', '03', '14']], ['Use it', ['05', '15', '16']], ['Reference', ['04', '06', '07', '08', '12', '13']], ['Project', ['09', '10', '11']]];
const files = fs.readdirSync(MD).filter(f => f.endsWith('.md')).sort();
const pages = files.map(f => {
  const raw = fill(fs.readFileSync(path.join(MD, f), 'utf8'));
  const {html, heads} = md2html(raw);
  const title = (raw.match(/^#\s+(.*)/m) || [, f])[1];
  const blurb = (raw.split(/\r?\n/).find(l => l.trim() && !/^(#|\||`|!\[|>|-|\d+\.)/.test(l)) || '').replace(/[*`_]/g, '').slice(0, 150);
  return {slug: f.replace(/\.md$/, ''), num: f.slice(0, 2), title, html, heads, blurb};
});
const byNum = n => pages.find(p => p.num === n);

const ICON = {logo: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 6c6 0 6 6 10 6M7 18c6 0 6-6 10-6"/></svg>', menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>', sun: '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>', moon: '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>', gh: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="18" height="18"><path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.800 0c2.200-1.500 3.200-1.200 3.200-1.200.6 1.600.2 2.800.1 3.100.8.8 1.200 1.800 1.200 3.100 0 4.400-2.700 5.400-5.300 5.700.4.4.8 1.100.8 2.200v3.200c0 .3.2.7.8.6A11.500 11.500 0 0 0 12 .5z"/></svg>'};

const head = (title, desc) => `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="theme-color" content="#ffffff"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%232563eb'/%3E%3Ccircle cx='9' cy='10' r='3' fill='white'/%3E%3Ccircle cx='9' cy='22' r='3' fill='white'/%3E%3Ccircle cx='23' cy='16' r='3' fill='white'/%3E%3C/svg%3E"><script>try{var t=localStorage.getItem('ls-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}</script><link rel="stylesheet" href="assets/site.css"></head>`;
const header = (cur) => `<a class="skip" href="#main">Skip to content</a><header class="top"><div class="in"><button class="ib menu" type="button" data-act="menu" aria-label="Open navigation" aria-expanded="false">${ICON.menu}</button><a class="brand" href="index.html"><span class="logo">${ICON.logo}</span>LineageSutra AI<small>v${vars.VERSION}</small></a><nav class="links" aria-label="Primary"><a href="00-start-here.html"${cur === '00' ? ' aria-current="page"' : ''}>Start here</a><a href="15-real-world-scenarios.html"${cur === '15' ? ' aria-current="page"' : ''}>Scenarios</a><a href="16-ci-recipes.html"${cur === '16' ? ' aria-current="page"' : ''}>CI recipes</a><a href="samples/audit-report.html">Audit sample</a></nav><span class="sp"></span><a class="btn gh" href="${REPO}" style="min-height:40px;padding:.4rem .9rem">${ICON.gh} GitHub</a><button class="ib theme" type="button" data-act="theme" aria-label="Toggle light and dark theme">${ICON.sun}${ICON.moon}</button></div></header>`;
const footer = `<footer class="site"><div class="in"><strong>LineageSutra AI ${vars.VERSION}</strong><span>Created by Vatsal Shah &middot; Apache-2.0 &middot; offline, read-only, evidence-first SQL lineage</span><span>Figures come from the recorded test and audit run of ${esc(vars.RECORDED.slice(0, 10))} on ${esc(vars.PLATFORM)}, Node ${esc(vars.NODE)}. Static analysis is evidence for human review, not a guarantee.</span><span><a href="${REPO}">GitHub</a> &middot; <a href="samples/audit-report.html">Sample audit report</a> &middot; <a href="test-results/test-run.tap">Raw test log</a></span></div></footer><script src="assets/site.js" defer></script>`;

function sidebar(cur) {
  let s = '<aside class="side" aria-label="Documentation"><a href="index.html">Home</a>';
  for (const [g, nums] of GROUPS) { s += `<h4>${g}</h4>`; for (const n of nums) { const p = byNum(n); if (p) s += `<a href="${p.slug}.html"${p.slug === cur ? ' aria-current="page"' : ''}>${esc(p.title)}</a>`; } }
  return s + '</aside><div class="scrim" data-act="scrim"></div>';
}

const order = pages.map(p => p.slug);
pages.forEach((p, i) => {
  const prev = pages[i - 1], next = pages[i + 1];
  const toc = p.heads.filter(h => h.n === 2);
  const tocHtml = toc.length > 1 ? `<nav class="toc" aria-label="On this page"><h4>On this page</h4>${toc.map(h => `<a href="#${h.id}">${esc(h.t.replace(/[`*]/g, ''))}</a>`).join('')}</nav>` : '<div class="toc"></div>';
  const pager = `<nav class="pager" aria-label="Pages">${prev ? `<a href="${prev.slug}.html"><small>Previous</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="nx" href="${next.slug}.html"><small>Next</small>${esc(next.title)}</a>` : '<span></span>'}</nav>`;
  const cur = p.num;
  fs.writeFileSync(path.join(OUT, p.slug + '.html'), `${head(p.title + ' - LineageSutra AI', p.blurb)}<body>${header(cur)}<div class="shell">${sidebar(p.slug)}<article id="main">${p.html}${pager}</article>${tocHtml}</div>${footer}</body></html>`);
});
void order;

// ---- landing page ----
const sc = byNum('15'), start = byNum('00');
const cmd = 'npx lineagesutra-ai scan --root ./sql --out lineage.html';
const feat = [['L', 'Column-level lineage', 'See which column feeds which, across views, CTEs, joins, set operations and window functions, with file, line and column for every edge.'], ['!', 'Change impact', 'Rename, drop or retype a column and get confirmed impacts with proof paths, possible impacts, a review checklist and test ideas.'], ['Δ', 'DriftRadar for CI', 'Compare two scans. If a removed column still has consumers, the job exits 3 and the report lists every one.'], ['?', 'Unknown stays unknown', 'Ambiguous columns, dynamic SQL and templates become visible warnings. The tool never invents a confident edge.'], ['#', 'Sealed, reproducible reports', 'Markdown, HTML and JSON with a SHA-256 seal. Same SQL, same seal, any file order. verify catches edits.'], ['AI', 'Built for AI agents', 'A read-only MCP server and 25 portable Agent Skills. No tool takes a file path, so an agent cannot wander.']];
const landing = `${head('LineageSutra AI - know what breaks before you change a column', 'Offline, evidence-first SQL data lineage and schema-change impact analysis. Column-level lineage, proof paths, audit reports in Markdown, HTML and JSON. No API key, no network, no database.')}<body>${header('')}
<main id="main">
<section class="hero"><div class="in"><span class="eyebrow"><span class="dot"></span>Open source &middot; offline &middot; v${vars.VERSION}</span>
<h1>Know what breaks <em>before</em> you change a column.</h1>
<p class="lead">LineageSutra AI reads your SQL, maps column-level lineage, and shows exactly which views, tables and columns a change would hit, with proof. No API key. No network. No database connection.</p>
<div class="cta"><a class="btn p" href="${start.slug}.html">Start in 5 minutes</a><a class="btn" href="${REPO}">${ICON.gh} View on GitHub</a><a class="btn" href="samples/audit-report.html">See a real audit report</a></div>
<div class="cmd"><code>${esc(cmd)}</code><button class="copy" type="button" data-act="copy" data-text="${esc(cmd)}">Copy</button></div>
<div class="chips"><span class="chip"><b>${vars.PASS}</b> tests passing</span><span class="chip"><b>${vars.GOLD_PASSED}/${vars.GOLD_CASES}</b> gold cases exact</span><span class="chip"><b>0</b> runtime dependencies</span><span class="chip"><b>Apache-2.0</b></span></div></div></section>

<section class="blk"><div class="in"><h2>Rename a column. See the blast radius.</h2><p class="sub">Real output from the bundled sample: renaming <code>customers.email</code> breaks three columns in three views. Red lines are confirmed by the SQL text, each with a proof path.</p>
<div class="show">${figure('Blast radius of renaming customers.email (red lines are confirmed static impacts)', 'assets/blast-radius.svg')}</div>
<div class="pillrow"><span class="pill bad">Confirmed: proven column path</span><span class="pill warn">Possible: filter, join or table-level</span><span class="pill ok">Warnings: what it could not read</span></div></div></section>

<section class="blk alt"><div class="in"><h2>Everything you need, nothing you have to trust blindly</h2><p class="sub">Built for people who approve schema changes and have been burned by a confident guess.</p>
<div class="grid c3">${feat.map(f => `<div class="card"><span class="ico">${esc(f[0])}</span><h3>${esc(f[1])}</h3><p>${esc(f[2])}</p></div>`).join('')}</div></div></section>

<section class="blk"><div class="in"><h2>How it works</h2><p class="sub">Plain files in, sealed evidence out. Every stage is deterministic.</p>
<div class="show">${figure('Pipeline from SQL files to sealed graph, analyses and reports', 'assets/pipeline.svg')}</div>
<ol class="steps"><li><strong>Scan.</strong> A tokenizer and parser read CREATE, CTAS and INSERT SQL, resolve columns across files and record direct, derived and indirect dependencies.</li><li><strong>Ask.</strong> Run impact, upstream, compare or contract against the sealed graph.</li><li><strong>Decide.</strong> Read the HTML or Markdown report, start with the warnings, and review the confirmed and possible lists.</li></ol></div></section>

<section class="blk alt"><div class="in"><h2>Real situations, real output</h2><p class="sub">Nine scenarios, each with the commands and the result.</p>
<div class="grid c3"><a class="card" href="${sc.slug}.html#1-can-i-rename-this-column-on-friday"><span class="ico">1</span><h3>Can I rename this column on Friday?</h3><p>Find every dependent column before you open the ticket.</p></a><a class="card" href="${sc.slug}.html#2-the-pull-request-that-quietly-drops-a-column"><span class="ico">2</span><h3>The PR that quietly drops a column</h3><p>Fail the build and list every broken consumer.</p></a><a class="card" href="${sc.slug}.html#8-an-ai-coding-agent-that-must-not-wander"><span class="ico">8</span><h3>An AI agent that must not wander</h3><p>Read-only MCP tools with no file-path arguments.</p></a></div>
<p style="text-align:center;margin-top:1.5rem"><a class="btn" href="${sc.slug}.html">All scenarios</a> <a class="btn" href="16-ci-recipes.html">CI recipes</a></p></div></section>

<section class="blk"><div class="in"><h2>Trust it because you can check it</h2><p class="sub">Every number below is regenerated by <code>npm run proof</code> and is reproducible with one command.</p>
<div class="grid c4"><div class="card stat"><b>${vars.PASS}</b><span>automated tests passing (${vars.FAIL} failing)</span></div><div class="card stat"><b>${vars.GOLD_PASSED}/${vars.GOLD_CASES}</b><span>gold cases exact, ${vars.GOLD_EDGES} edges, 0 false</span></div><div class="card stat"><b>${vars.CHECKS_PASSED}</b><span>audit checks passed, ${vars.CHECKS_NOTRUN} listed as not run</span></div><div class="card stat"><b>${vars.SCAN_MS} ms</b><span>to scan 2,000 chained views (synthetic)</span></div></div>
<p class="sub" style="margin-top:1.5rem">The gold corpus is author-labelled and small, so it is a regression check, not an independent benchmark. The seal detects edits; it does not prove authorship. The audit says what it did <em>not</em> verify, in every report.</p>
<p style="text-align:center"><a class="btn" href="samples/audit-report.html">Open the sample audit</a> <a class="btn" href="${byNum('13').slug}.html">Assurance and evidence</a></p></div></section>

<section class="blk alt"><div class="in"><h2>All documentation</h2><p class="sub">From the five-minute tour to the threat model.</p>
<div class="grid c3">${pages.map(p => `<a class="card" href="${p.slug}.html"><h3>${esc(p.title)}</h3><p>${esc(p.blurb)}</p></a>`).join('')}</div></div></section>
</main>${footer}</body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), landing);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// rendered md + README
fs.mkdirSync(path.join(HERE, 'md-rendered'), {recursive: true});
for (const f of files) fs.writeFileSync(path.join(HERE, 'md-rendered', f), fill(fs.readFileSync(path.join(MD, f), 'utf8')));
fs.writeFileSync(path.join(HERE, 'README.md'), `# LineageSutra AI - documents

Documentation set for **LineageSutra AI ${vars.VERSION}**.

- Website: \`html/index.html\` (light by default, dark toggle, responsive; also published on GitHub Pages)
- Markdown sources: \`md/\`; rendered with numbers filled in: \`md-rendered/\`
- Diagrams: \`assets/*.svg\` (light) and \`assets/*-dark.svg\`, generated from real output by \`scripts/make-diagrams.mjs\`
- Rebuild from the repo root: \`npm run proof && node scripts/make-diagrams.mjs && node documents/LineageSutra-AI/build.mjs\`

Project: ${REPO}
`);
console.log(`built ${pages.length} pages + index`);
