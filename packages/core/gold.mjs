import fs from 'node:fs';
import {scanSources} from './scan.mjs';

export function edgeLabel(e) {
  if (e.type === 'column') return `col:${e.from}>${e.to}:${e.kind}${e.role ? '@' + e.role : ''}`;
  if (e.type === 'indirect') return `ind:${e.from}>${e.to}:${e.role}`;
  return `tbl:${e.from}>${e.to}`;
}

// 95% Wilson score interval for a proportion.
export function wilson(k, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

export function runGold(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const results = [];
  let tp = 0, fp = 0, fn = 0;
  for (const c of doc.cases) {
    let report, error = null;
    try { report = scanSources([{path: 'case.sql', text: c.sql}], {label: c.id}); } catch (e) { error = e.message; }
    const got = report ? new Set(report.edges.map(edgeLabel)) : new Set();
    const want = c.edges ? new Set(c.edges) : null;
    let ctp = 0, cfp = 0, cfn = 0;
    const missing = [], extra = [];
    if (want) {
      for (const x of want) { if (got.has(x)) ctp++; else { cfn++; missing.push(x); } }
      for (const x of got) if (!want.has(x)) { cfp++; extra.push(x); }
      tp += ctp; fp += cfp; fn += cfn;
    }
    const kinds = new Set(report?.warnings.map(w => w.kind));
    const warnOk = (c.warn || []).every(k => kinds.has(k));
    const cleanOk = !c.clean || (report && report.warnings.length === 0);
    results.push({id: c.id, tags: c.tags || [], pass: !error && !missing.length && !extra.length && warnOk && cleanOk, tp: ctp, fp: cfp, fn: cfn, missing, extra, warnings: report?.warnings.map(w => `${w.kind}: ${w.detail}`) || [], error, warnOk, cleanOk});
  }
  const precision = tp + fp ? tp / (tp + fp) : 1, recall = tp + fn ? tp / (tp + fn) : 1;
  return {
    cases: results.length, passed: results.filter(r => r.pass).length, tp, fp, fn,
    precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0,
    precisionCI: wilson(tp, tp + fp), recallCI: wilson(tp, tp + fn), results
  };
}
