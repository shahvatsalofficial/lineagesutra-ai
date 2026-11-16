import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

// Canonical JSON: keys sorted by code point (locale independent), so hashes are stable across machines.
export function stable(value) {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = v[k];
      return out;
    }
    return v;
  });
}

// The seal gives tamper evidence. It is NOT a signature: anyone can recompute it. See docs/EVIDENCE_MODEL.md.
export function seal(record) {
  const copy = {...record};
  delete copy.integrity;
  return {...copy, integrity: {algorithm: 'sha256', hash: sha256(stable(copy))}};
}

export function verify(record) {
  if (!record || typeof record !== 'object' || record.integrity?.algorithm !== 'sha256') return false;
  const copy = {...record};
  delete copy.integrity;
  return sha256(stable(copy)) === record.integrity.hash;
}

// Documented normalization policy: strip quoting characters and fold to lower case.
export function normalize(name = '') {
  return String(name).replace(/["`\[\]]/g, '').toLowerCase().trim();
}

export function assertInside(root, p) {
  const r = fs.realpathSync(root);
  const s = fs.realpathSync(p);
  if (s !== r && !s.startsWith(r + path.sep)) throw new Error('Selected input escapes authorized root');
  return s;
}

// Blank out string literals and comments (keeping newlines) without evaluating anything.
export function scrub(sql) {
  let out = '', i = 0, quote = null;
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    if (quote) {
      if (c === '\n') { out += '\n'; i++; continue; }
      if (c === quote) { if (n === quote) { out += '  '; i += 2; continue; } quote = null; }
      out += ' '; i++; continue;
    }
    if (c === "'") { quote = c; out += ' '; i++; continue; }
    if (c === '-' && n === '-') { while (i < sql.length && sql[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') {
      out += '  '; i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) { out += sql[i] === '\n' ? '\n' : ' '; i++; }
      if (i < sql.length) { out += '  '; i += 2; }
      continue;
    }
    out += c; i++;
  }
  return out;
}
