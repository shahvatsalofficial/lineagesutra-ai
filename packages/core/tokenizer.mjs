// Dependency-free SQL tokenizer. It never evaluates SQL. Comments are dropped, string contents become opaque
// 'str' tokens, and template markers ({{ }}, {% %}) become 'tmpl' tokens so callers can mark them unknown.
export const MAX_TOKENS = 400_000;
const ID_START = /[\p{L}_]/u;
const ID_PART = /[\p{L}\p{N}_$]/u;
const OPS3 = ['->>', '<=>'];
const OPS2 = ['::', '<>', '<=', '>=', '!=', '||', '->', '=>', ':='];

export function tokenize(sql) {
  const toks = [];
  let i = 0, line = 1, col = 1;
  const flags = {templated: false, dollarQuoted: false, backtick: false, bracket: false, doubleColon: false};
  const adv = n => { for (let k = 0; k < n; k++) { if (sql[i] === '\n') { line++; col = 1; } else col++; i++; } };
  const push = (t, v, l, c, extra) => {
    if (toks.length >= MAX_TOKENS) throw new Error('SQL token limit exceeded');
    toks.push({t, v, line: l, col: c, ...extra});
  };
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1], l = line, cl = col;
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === ' ') { adv(1); continue; }
    if (c === '-' && n === '-') { while (i < sql.length && sql[i] !== '\n') adv(1); continue; }
    if (c === '/' && n === '*') {
      adv(2);
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) adv(1);
      adv(2); continue;
    }
    if (c === '{' && (n === '{' || n === '%' || n === '#')) {
      const close = n === '{' ? '}}' : n === '%' ? '%}' : '#}';
      const end = sql.indexOf(close, i + 2);
      const stop = end < 0 ? sql.length : end + 2;
      flags.templated = true;
      adv(stop - i);
      push('tmpl', 'tmpl', l, cl); continue;
    }
    if (c === "'") {
      adv(1);
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { adv(2); continue; }
        if (sql[i] === '\\' && sql[i + 1] === "'") { adv(2); continue; }
        if (sql[i] === "'") { adv(1); break; }
        adv(1);
      }
      push('str', 'str', l, cl); continue;
    }
    if (c === '$' && (n === '$' || /[A-Za-z_]/.test(n || ''))) {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 64));
      if (m) {
        const end = sql.indexOf(m[0], i + m[0].length);
        const stop = end < 0 ? sql.length : end + m[0].length;
        flags.dollarQuoted = true;
        adv(stop - i); push('str', 'str', l, cl); continue;
      }
    }
    if (c === '"' || c === '`') {
      const q = c; let v = ''; adv(1);
      while (i < sql.length) {
        if (sql[i] === q && sql[i + 1] === q) { v += q; adv(2); continue; }
        if (sql[i] === q) { adv(1); break; }
        v += sql[i]; adv(1);
      }
      if (q === '`') flags.backtick = true;
      push('qid', v.toLowerCase(), l, cl, {raw: v}); continue;
    }
    if (c === '[') {
      const prev = toks.at(-1);
      const closeAt = sql.indexOf(']', i + 1);
      const inner = closeAt > 0 ? sql.slice(i + 1, closeAt) : '';
      const adjacent = i > 0 && !/\s/.test(sql[i - 1]);
      const subscript = adjacent && prev && (prev.t === 'id' || prev.t === 'qid' || prev.v === ')' || prev.v === ']');
      if (!subscript && inner && !/[\[\]\n]/.test(inner)) {
        flags.bracket = true; adv(closeAt + 1 - i);
        push('qid', inner.toLowerCase(), l, cl, {raw: inner}); continue;
      }
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(n || ''))) {
      let j = i;
      while (j < sql.length && /[0-9a-zA-Z_.]/.test(sql[j])) j++;
      const raw = sql.slice(i, j);
      adv(j - i); push('num', 'num', l, cl, {raw}); continue;
    }
    if (ID_START.test(c) || (c === '@' && ID_START.test(n || ''))) {
      let j = i + 1;
      while (j < sql.length && ID_PART.test(sql[j])) j++;
      const word = sql.slice(i, j);
      adv(j - i);
      push('id', word.toLowerCase(), l, cl, {raw: word});
      continue;
    }
    const three = sql.slice(i, i + 3), two = sql.slice(i, i + 2);
    if (OPS3.includes(three)) { adv(3); push('op', three, l, cl); continue; }
    if (OPS2.includes(two)) { if (two === '::') flags.doubleColon = true; adv(2); push('op', two, l, cl); continue; }
    adv(1); push('op', c, l, cl);
  }
  return {tokens: toks, flags};
}
