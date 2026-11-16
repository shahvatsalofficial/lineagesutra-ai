// Static SQL lineage extraction (supported subset). Never executes SQL, never connects to a database.
//
// Supported: CREATE [OR REPLACE] [MATERIALIZED|TEMP] TABLE/VIEW, CTAS, INSERT ... SELECT, CTEs (incl. chained),
// subqueries in FROM and in expressions, JOINs (ON/USING), UNION/INTERSECT/EXCEPT, wildcard expansion when the
// schema is declared in the scanned sources, expressions, aggregates, CASE, CAST, window functions, and
// WHERE/GROUP BY/HAVING/QUALIFY/ORDER BY/JOIN ON as *indirect* dependencies.
// Anything else is reported as a warning. Unknown never silently becomes a confident edge.
import {tokenize} from './tokenizer.mjs';
import {normalize} from './util.mjs';

const MAX_DEPTH = 40;
const CLAUSE_STOP = new Set(['where', 'group', 'having', 'qualify', 'window', 'order', 'limit', 'offset', 'fetch', 'for', 'returning', 'union', 'intersect', 'except', 'minus', 'into', 'lock']);
const SETOPS = new Set(['union', 'intersect', 'except', 'minus']);
const JOIN_WORDS = new Set(['join', 'inner', 'left', 'right', 'full', 'cross', 'natural', 'outer', 'semi', 'anti', 'asof', 'straight_join']);
const NOT_ALIAS = new Set([...CLAUSE_STOP, ...JOIN_WORDS, 'on', 'using', 'from', 'select', 'as', 'tablesample', 'pivot', 'unpivot', 'lateral', 'with', 'set', 'values']);
const KEYWORDS = new Set(['and', 'or', 'not', 'in', 'is', 'null', 'like', 'ilike', 'rlike', 'regexp', 'similar', 'to', 'between', 'case', 'when', 'then', 'else', 'end', 'distinct', 'all', 'any', 'some', 'exists', 'as', 'true', 'false', 'unknown', 'asc', 'desc', 'nulls', 'first', 'last', 'escape', 'collate', 'over', 'partition', 'by', 'order', 'rows', 'range', 'groups', 'unbounded', 'preceding', 'following', 'current', 'row', 'interval', 'at', 'time', 'zone', 'filter', 'within', 'group', 'from', 'for', 'ignore', 'respect', 'current_date', 'current_time', 'current_timestamp', 'localtime', 'localtimestamp', 'array', 'only', 'using', 'select', 'where', 'on', 'exclude', 'ties', 'others', 'no', 'separator', 'both', 'leading', 'trailing']);
const TYPE_CONT = new Set(['precision', 'varying', 'with', 'without', 'time', 'zone', 'unsigned', 'signed', 'local']);
const DATEPARTS = new Set(['year', 'month', 'day', 'hour', 'minute', 'second', 'week', 'quarter', 'epoch', 'dow', 'doy', 'millisecond', 'microsecond', 'century', 'decade']);
const TYPE_LITERAL = new Set(['date', 'time', 'timestamp', 'datetime', 'timestamptz', 'interval']);
const COL_CONSTRAINT = new Set(['not', 'null', 'default', 'primary', 'references', 'unique', 'check', 'constraint', 'generated', 'collate', 'comment', 'identity', 'auto_increment', 'autoincrement', 'on', 'as', 'encode', 'sortkey', 'distkey']);
const TABLE_CONSTRAINT = new Set(['primary', 'foreign', 'unique', 'constraint', 'check', 'key', 'index', 'like', 'exclude', 'period', 'fulltext', 'spatial', 'partition', 'cluster']);

const isKw = (t, w) => !!t && t.t === 'id' && t.v === w;
const isOp = (t, v) => !!t && t.t === 'op' && t.v === v;
const isIdent = t => !!t && (t.t === 'id' || t.t === 'qid');

function matchClose(toks, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < toks.length; i++) {
    if (isOp(toks[i], '(')) depth++;
    else if (isOp(toks[i], ')') && --depth === 0) return i;
  }
  return -1;
}

function skipType(toks, i) {
  if (!isIdent(toks[i])) return i;
  i++;
  for (;;) {
    if (isOp(toks[i], '.') && isIdent(toks[i + 1])) { i += 2; continue; }
    if (toks[i]?.t === 'id' && TYPE_CONT.has(toks[i].v)) { i++; continue; }
    if (isOp(toks[i], '(')) { const e = matchClose(toks, i); if (e < 0) return toks.length; i = e + 1; continue; }
    if (isOp(toks[i], '[') && isOp(toks[i + 1], ']')) { i += 2; continue; }
    return i;
  }
}

// ---- expression scanning -------------------------------------------------------------------------------------
function scanExpr(toks) {
  const refs = [], subs = [];
  let other = 0, depth = 0, winDepth = -1, pendingWindow = false;
  for (let i = 0; i < toks.length;) {
    const k = toks[i];
    if (k.t === 'str' || k.t === 'num') { other++; i++; continue; }
    if (k.t === 'tmpl') { refs.push({tmpl: true, line: k.line, col: k.col}); i++; continue; }
    if (k.t === 'op') {
      if (k.v === '(') {
        if (isKw(toks[i + 1], 'select') || isKw(toks[i + 1], 'with')) {
          const e = matchClose(toks, i);
          const end = e < 0 ? toks.length : e;
          subs.push({toks: toks.slice(i + 1, end), window: winDepth >= 0});
          i = end + 1; other++; continue;
        }
        depth++;
        if (pendingWindow) { winDepth = depth; pendingWindow = false; }
      } else if (k.v === ')') { if (winDepth === depth) winDepth = -1; depth--; }
      else if (k.v === '::') { i = skipType(toks, i + 1); other++; continue; }
      other++; i++; continue;
    }
    if (k.t === 'id') {
      if (k.v === 'as' && depth > 0) { i = skipType(toks, i + 1); other++; continue; }
      if (k.v === 'over') { if (isOp(toks[i + 1], '(')) pendingWindow = true; else if (isIdent(toks[i + 1])) i++; other++; i++; continue; }
      if (k.v === 'interval') { i++; if (toks[i]?.t === 'str' || toks[i]?.t === 'num') i++; if (toks[i]?.t === 'id' && DATEPARTS.has(toks[i].v)) i++; other++; continue; }
      if (TYPE_LITERAL.has(k.v) && toks[i + 1]?.t === 'str') { i += 2; other++; continue; }
      if (KEYWORDS.has(k.v)) { other++; i++; continue; }
      if (DATEPARTS.has(k.v) && isOp(toks[i - 1], '(') && isKw(toks[i + 1], 'from')) { other++; i++; continue; }
    }
    // identifier chain
    const parts = [k.v];
    let j = i + 1, star = false;
    while (isOp(toks[j], '.')) {
      if (isIdent(toks[j + 1])) { parts.push(toks[j + 1].v); j += 2; }
      else if (isOp(toks[j + 1], '*')) { star = true; j += 2; break; }
      else break;
    }
    if (star) { refs.push({parts, star: true, line: k.line, col: k.col}); i = j; other++; continue; }
    if (isOp(toks[j], '(')) { other++; i = j; continue; }
    if (isOp(toks[j], '=>')) { other++; i = j + 1; continue; }
    refs.push({parts, line: k.line, col: k.col, window: winDepth >= 0});
    i = j;
  }
  return {refs, subs, plain: refs.length === 1 && other === 0 && subs.length === 0 && !refs[0].star && !refs[0].tmpl};
}

function splitTop(toks, sep = ',') {
  const out = [];
  let cur = [], depth = 0;
  for (const t of toks) {
    if (isOp(t, '(')) depth++;
    else if (isOp(t, ')')) depth--;
    if (depth === 0 && isOp(t, sep)) { out.push(cur); cur = []; } else cur.push(t);
  }
  if (cur.length) out.push(cur);
  return out;
}

function splitAlias(item) {
  const n = item.length;
  if (n >= 3 && isKw(item[n - 2], 'as') && (isIdent(item[n - 1]) || item[n - 1].t === 'str')) {
    return {expr: item.slice(0, n - 2), alias: item[n - 1].t === 'str' ? null : item[n - 1].v, hasAlias: true};
  }
  if (n >= 2) {
    const last = item[n - 1], prev = item[n - 2];
    const lastOk = (last.t === 'qid') || (last.t === 'id' && !KEYWORDS.has(last.v));
    const prevOk = prev.t === 'qid' || prev.t === 'str' || prev.t === 'num' || isOp(prev, ')') || isOp(prev, ']') || isKw(prev, 'end') || (prev.t === 'id' && !KEYWORDS.has(prev.v));
    if (lastOk && prevOk && !isOp(prev, '.')) return {expr: item.slice(0, n - 1), alias: last.v, hasAlias: true};
  }
  return {expr: item, alias: null, hasAlias: false};
}

// ---- parser context --------------------------------------------------------------------------------------------
class Ctx {
  constructor(file, registry) {
    this.file = file;
    this.registry = registry;
    this.warnings = [];
    this.nodes = [];
    this.edges = [];
  }
  warn(kind, detail, tok) {
    const w = {file: this.file, kind, detail};
    if (tok?.line) w.line = tok.line;
    this.warnings.push(w);
  }
  resolveDataset(parts, tok) {
    const name = parts.join('.');
    if (this.registry.has(name)) return name;
    const hits = [...this.registry.keys()].filter(k => k.endsWith('.' + name) || name.endsWith('.' + k));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) this.warn('dependency-ambiguous', `Reference ${name} matches ${hits.join(', ')}; kept as written`, tok);
    return name;
  }
}

const emptyRel = () => ({cols: [], complete: true, indirect: [], deps: new Map()});

function sourceHas(src, col) {
  if (src.kind === 'dataset') {
    if (!src.reg) return 'maybe';
    if (src.reg.columns.includes(col)) return 'yes';
    return src.reg.complete ? 'no' : 'maybe';
  }
  if (src.rel.placeholder) return 'maybe';
  if (src.rel.cols.some(c => c.name === col)) return 'yes';
  return src.rel.complete ? 'no' : 'maybe';
}

function qualifierMatches(src, q) {
  return src.alias === q || src.name === q || src.name.endsWith('.' + q) || q.endsWith('.' + src.name);
}

function inputsOf(src, col) {
  if (src.kind === 'dataset') return [{id: `${src.name}.${col}`, kind: 'direct'}];
  const c = src.rel.cols.find(x => x.name === col);
  return c ? c.inputs.map(x => ({...x})) : [];
}

// Resolve one column reference to upstream column inputs, or {error}.
function resolveRef(parts, sources, outer) {
  const col = parts[parts.length - 1];
  const qual = parts.length > 1 ? parts.slice(0, -1).join('.') : null;
  const pools = [sources, ...(outer ? [outer] : [])];
  for (const pool of pools) {
    let cands = qual ? pool.filter(s => qualifierMatches(s, qual)) : pool;
    if (qual && cands.length === 0) continue;
    if (qual && cands.length > 1) return {error: `ambiguous source qualifier ${qual}`};
    const yes = cands.filter(s => sourceHas(s, col) === 'yes');
    const maybe = cands.filter(s => sourceHas(s, col) === 'maybe');
    if (yes.length === 1 && maybe.length === 0) return {inputs: inputsOf(yes[0], col), src: yes[0]};
    if (yes.length === 0 && maybe.length === 1) return {inputs: inputsOf(maybe[0], col), src: maybe[0], unverified: true};
    if (yes.length + maybe.length > 1) return {error: 'ambiguous/unresolved column owner'};
    if (qual) return {error: `column ${col} not found in ${qual}`};
  }
  return {error: 'unresolved column reference'};
}

// ---- query parsing ---------------------------------------------------------------------------------------------
function parseQuery(s, env) {
  if (env.depth > MAX_DEPTH) { env.cx.warn('unsupported', 'Query nesting exceeds safety limit'); return {...emptyRel(), complete: false}; }
  const ctes = new Map(env.ctes);
  if (isKw(s.t[s.i], 'with')) {
    s.i++;
    let recursive = false;
    if (isKw(s.t[s.i], 'recursive')) { recursive = true; s.i++; }
    for (;;) {
      const nameTok = s.t[s.i];
      if (!isIdent(nameTok)) { env.cx.warn('parse', 'Malformed WITH clause', nameTok); break; }
      s.i++;
      let colNames = null;
      if (isOp(s.t[s.i], '(')) { const e = matchClose(s.t, s.i); colNames = splitTop(s.t.slice(s.i + 1, e < 0 ? s.t.length : e)).map(x => x[0]?.v); s.i = e < 0 ? s.t.length : e + 1; }
      if (isKw(s.t[s.i], 'as')) s.i++;
      if (isKw(s.t[s.i], 'not')) s.i++;
      if (isKw(s.t[s.i], 'materialized')) s.i++;
      if (!isOp(s.t[s.i], '(')) { env.cx.warn('parse', `CTE ${nameTok.v} has no body`, nameTok); break; }
      const e = matchClose(s.t, s.i);
      const body = s.t.slice(s.i + 1, e < 0 ? s.t.length : e);
      s.i = e < 0 ? s.t.length : e + 1;
      if (recursive) {
        ctes.set(nameTok.v, {cols: [], complete: false, indirect: [], deps: new Map(), placeholder: true});
        env.cx.warn('unsupported', `Recursive CTE ${nameTok.v}: self-reference lineage is not expanded`, nameTok);
      }
      const rel = parseQuery({t: body, i: 0}, {...env, ctes, depth: env.depth + 1});
      if (colNames) rel.cols.forEach((c, k) => { if (colNames[k]) c.name = colNames[k]; });
      ctes.set(nameTok.v, rel);
      if (isOp(s.t[s.i], ',')) { s.i++; continue; }
      break;
    }
  }
  let rel = parseSelectCore(s, {...env, ctes});
  while (SETOPS.has(s.t[s.i]?.v) && s.t[s.i]?.t === 'id') {
    s.i++;
    if (isKw(s.t[s.i], 'all') || isKw(s.t[s.i], 'distinct')) s.i++;
    const right = parseSelectCore(s, {...env, ctes});
    rel = mergeSetOp(rel, right, env.cx);
  }
  // Trailing ORDER BY / LIMIT / OFFSET / FETCH after a set operation reference output names only.
  while (s.i < s.t.length && !isOp(s.t[s.i], ';') && !isOp(s.t[s.i], ')')) s.i++;
  return rel;
}

function mergeSetOp(a, b, cx) {
  const out = {cols: [], complete: a.complete && b.complete, indirect: [...a.indirect, ...b.indirect], deps: new Map([...a.deps, ...b.deps])};
  if (a.cols.length !== b.cols.length) {
    cx.warn('column-unknown', `Set operation branches have ${a.cols.length} vs ${b.cols.length} columns; positional lineage not trusted`);
    out.complete = false;
    out.cols = a.cols.map(c => ({...c, inputs: [...c.inputs]}));
    return out;
  }
  out.cols = a.cols.map((c, k) => {
    const seen = new Set();
    const inputs = [];
    for (const x of [...c.inputs, ...b.cols[k].inputs]) {
      const key = `${x.id}|${x.kind}|${x.role || ''}`;
      if (!seen.has(key)) { seen.add(key); inputs.push(x); }
    }
    return {name: c.name, inputs, partial: c.partial || b.cols[k].partial};
  });
  return out;
}

function captureClause(s) {
  const start = s.i;
  let depth = 0;
  while (s.i < s.t.length) {
    const t = s.t[s.i];
    if (isOp(t, '(')) depth++;
    else if (isOp(t, ')')) { if (depth === 0) break; depth--; }
    else if (isOp(t, ';')) break;
    else if (depth === 0 && t.t === 'id' && (CLAUSE_STOP.has(t.v) || (t.v === 'on' && false))) break;
    s.i++;
  }
  return s.t.slice(start, s.i);
}

function parseSelectCore(s, env) {
  const cx = env.cx;
  if (isOp(s.t[s.i], '(')) {
    const e = matchClose(s.t, s.i);
    const inner = s.t.slice(s.i + 1, e < 0 ? s.t.length : e);
    s.i = e < 0 ? s.t.length : e + 1;
    return parseQuery({t: inner, i: 0}, {...env, depth: env.depth + 1});
  }
  if (!isKw(s.t[s.i], 'select')) {
    cx.warn('unsupported', `Expected SELECT, found ${s.t[s.i]?.raw ?? s.t[s.i]?.v ?? 'end of statement'}`, s.t[s.i]);
    s.i = s.t.length;
    return {...emptyRel(), complete: false};
  }
  const selTok = s.t[s.i++];
  for (;;) {
    const t = s.t[s.i];
    if (isKw(t, 'all') || isKw(t, 'distinct') || isKw(t, 'straight_join')) {
      s.i++;
      if (isKw(t, 'distinct') && isKw(s.t[s.i], 'on') && isOp(s.t[s.i + 1], '(')) { const e = matchClose(s.t, s.i + 1); s.i = e < 0 ? s.t.length : e + 1; cx.warn('indirect-dependency-unknown', 'DISTINCT ON expressions are not tracked as indirect dependencies', t); }
      continue;
    }
    if (isKw(t, 'top')) { s.i++; if (isOp(s.t[s.i], '(')) { const e = matchClose(s.t, s.i); s.i = e < 0 ? s.t.length : e + 1; } else s.i++; if (isKw(s.t[s.i], 'percent')) s.i++; if (isKw(s.t[s.i], 'with') && isKw(s.t[s.i + 1], 'ties')) s.i += 2; continue; }
    break;
  }
  const listStart = s.i;
  let depth = 0;
  while (s.i < s.t.length) {
    const t = s.t[s.i];
    if (isOp(t, '(')) depth++;
    else if (isOp(t, ')')) { if (depth === 0) break; depth--; }
    else if (depth === 0 && (isOp(t, ';') || (t.t === 'id' && (t.v === 'from' || CLAUSE_STOP.has(t.v))))) break;
    s.i++;
  }
  const listToks = s.t.slice(listStart, s.i);
  const sources = [], joinClauses = [], deps = new Map(), derivedIndirect = [];
  if (isKw(s.t[s.i], 'from')) { s.i++; parseFrom(s, env, sources, joinClauses, deps, derivedIndirect); }
  const clauses = [];
  while (s.i < s.t.length) {
    const t = s.t[s.i];
    if (isOp(t, ')') || isOp(t, ';')) break;
    if (t.t === 'id' && SETOPS.has(t.v)) break;
    if (isKw(t, 'where')) { s.i++; clauses.push({role: 'filter', toks: captureClause(s)}); continue; }
    if (isKw(t, 'group') && isKw(s.t[s.i + 1], 'by')) { s.i += 2; clauses.push({role: 'group', toks: captureClause(s)}); continue; }
    if (isKw(t, 'having')) { s.i++; clauses.push({role: 'having', toks: captureClause(s)}); continue; }
    if (isKw(t, 'qualify')) { s.i++; clauses.push({role: 'filter', toks: captureClause(s)}); continue; }
    if (isKw(t, 'order') && isKw(s.t[s.i + 1], 'by')) { s.i += 2; clauses.push({role: 'order', toks: captureClause(s)}); continue; }
    s.i++;
    captureClause(s); // WINDOW / LIMIT / OFFSET / FETCH / FOR ... carry no column lineage
  }

  const inner = {...env, outer: [...sources, ...(env.outer || [])], depth: env.depth + 1};
  const outer = env.outer || null;
  const ctxSources = sources;
  const resolve = (parts, tok, where) => {
    const r = resolveRef(parts, ctxSources, outer);
    if (r.error) cx.warn('column-unknown', `${where}: ${parts.join('.')}: ${r.error}`, tok);
    return r;
  };
  const addSub = (sub, role, cols, into) => {
    for (const d of sub.deps) deps.set(d[0], d[1]);
    for (const c of sub.cols) for (const x of c.inputs) into.push({...x, kind: 'derived', role});
    for (const x of sub.indirect) into.push({...x, kind: 'derived', role: x.role});
  };

  const cols = [];
  let complete = true;
  const indirect = [...derivedIndirect];
  for (const itemToks of splitTop(listToks)) {
    if (!itemToks.length) continue;
    const star = itemToks.length === 1 && isOp(itemToks[0], '*') ? {qual: null}
      : itemToks.length === 3 && isIdent(itemToks[0]) && isOp(itemToks[1], '.') && isOp(itemToks[2], '*') ? {qual: itemToks[0].v}
      : null;
    const starExt = !star && itemToks.some((t, k) => isOp(t, '*') && (k === 0 || isOp(itemToks[k - 1], '.')) && (isKw(itemToks[k + 1], 'except') || isKw(itemToks[k + 1], 'exclude') || isKw(itemToks[k + 1], 'replace') || isKw(itemToks[k + 1], 'rename')));
    if (star || starExt) {
      if (starExt) { cx.warn('column-unknown', 'SELECT * EXCEPT/EXCLUDE/REPLACE is not expanded', itemToks[0]); complete = false; continue; }
      const pool = star.qual ? sources.filter(x => qualifierMatches(x, star.qual)) : sources;
      if (pool.length === 0) { cx.warn('column-unknown', `Wildcard ${star.qual ? star.qual + '.*' : '*'} matches no source`, itemToks[0]); complete = false; continue; }
      for (const src of pool) {
        const known = src.kind === 'dataset' ? src.reg : (src.rel.placeholder ? null : {columns: src.rel.cols.map(c => c.name), complete: src.rel.complete});
        if (!known || !known.complete) {
          cx.warn('column-unknown', `Wildcard over ${src.name} cannot be expanded (schema ${known ? 'incomplete' : 'not declared in scanned sources'})`, itemToks[0]);
          complete = false;
          if (known) for (const c of known.columns) cols.push({name: c, inputs: inputsOf(src, c), partial: false});
          continue;
        }
        for (const c of known.columns) cols.push({name: c, inputs: inputsOf(src, c), partial: false});
      }
      continue;
    }
    const {expr, alias} = splitAlias(itemToks);
    const sc = scanExpr(expr);
    let partial = false;
    const inputs = [];
    for (const ref of sc.refs) {
      if (ref.tmpl) { partial = true; continue; }
      if (ref.star) { partial = true; cx.warn('column-unknown', `${ref.parts.join('.')}.* inside an expression is not tracked`, expr[0]); continue; }
      const r = resolve(ref.parts, {line: ref.line, col: ref.col}, 'select item');
      if (r.error) { partial = true; continue; }
      for (const x of r.inputs) inputs.push({...x, kind: sc.plain ? x.kind : 'derived', ...(ref.window ? {role: 'window'} : {}), line: ref.line, col: ref.col});
    }
    for (const sub of sc.subs) {
      const rel = parseQuery({t: sub.toks, i: 0}, {...inner, anonOk: true});
      addSub(rel, 'subquery', cols, inputs);
      if (!rel.complete) partial = true;
    }
    let name = alias;
    if (!name && sc.plain) name = sc.refs[0].parts.at(-1);
    if (!name && !env.anonOk) { partial = true; complete = false; cx.warn('column-unknown', 'Unnamed output expression; give it an alias', itemToks[0]); }
    cols.push({name, inputs, partial});
  }
  // Indirect dependencies from clauses.
  const add = (ref, role, tok) => {
    const r = resolveRef(ref.parts, ctxSources, outer);
    if (r.error) {
      if (!(env.aliasNames?.has(ref.parts[0])) && !cols.some(c => c.name === ref.parts[0] && ref.parts.length === 1)) cx.warn('column-unknown', `${role}: ${ref.parts.join('.')}: ${r.error}`, tok);
      return;
    }
    for (const x of r.inputs) indirect.push({id: x.id, role, line: ref.line, col: ref.col});
  };
  const scanClause = (toks, role) => {
    const sc = scanExpr(toks);
    for (const ref of sc.refs) if (!ref.tmpl && !ref.star) add(ref, role, {line: ref.line, col: ref.col});
    for (const sub of sc.subs) {
      const rel = parseQuery({t: sub.toks, i: 0}, {...inner, anonOk: true});
      for (const d of rel.deps) deps.set(d[0], d[1]);
      for (const c of rel.cols) for (const x of c.inputs) indirect.push({id: x.id, role, line: toks[0]?.line, col: toks[0]?.col});
      for (const x of rel.indirect) indirect.push({id: x.id, role, line: x.line, col: x.col});
    }
  };
  for (const jc of joinClauses) {
    if (jc.using) {
      for (const colName of jc.using) for (const src of sources) if (sourceHas(src, colName) !== 'no') for (const x of inputsOf(src, colName)) indirect.push({id: x.id, role: 'join', line: jc.line, col: jc.col});
    } else scanClause(jc.toks, 'join');
  }
  for (const c of clauses) scanClause(c.toks, c.role);
  const seen = new Set();
  const ind = indirect.filter(x => { const k = `${x.id}|${x.role}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (sources.length === 0 && listToks.length === 0) cx.warn('column-unknown', 'Empty SELECT list', selTok);
  return {cols, complete, indirect: ind, deps};
}

function parseFrom(s, env, sources, joinClauses, deps, derivedIndirect) {
  const cx = env.cx;
  const addRel = (rel, alias, name, tok) => {
    for (const d of rel.deps) deps.set(d[0], d[1]);
    for (const x of rel.indirect) derivedIndirect.push(x);
    sources.push({kind: 'rel', alias: alias || name, name: name || alias || '(subquery)', rel});
    void tok;
  };
  const readAlias = () => {
    let alias = null;
    if (isKw(s.t[s.i], 'as')) s.i++;
    const t = s.t[s.i];
    if (isIdent(t) && !(t.t === 'id' && NOT_ALIAS.has(t.v))) { alias = t.v; s.i++; }
    let colNames = null;
    if (alias && isOp(s.t[s.i], '(')) { const e = matchClose(s.t, s.i); colNames = splitTop(s.t.slice(s.i + 1, e < 0 ? s.t.length : e)).map(x => x[0]?.v); s.i = e < 0 ? s.t.length : e + 1; }
    return {alias, colNames};
  };
  const parseItem = () => {
    let lateral = false;
    if (isKw(s.t[s.i], 'lateral')) { lateral = true; s.i++; }
    const t = s.t[s.i];
    if (!t) { cx.warn('parse', 'Missing table after FROM/JOIN'); return; }
    if (isOp(t, '(')) {
      const e = matchClose(s.t, s.i);
      const body = s.t.slice(s.i + 1, e < 0 ? s.t.length : e);
      s.i = e < 0 ? s.t.length : e + 1;
      if (isKw(body[0], 'select') || isKw(body[0], 'with') || isOp(body[0], '(')) {
        const rel = parseQuery({t: body, i: 0}, {...env, outer: lateral ? [...sources, ...(env.outer || [])] : env.outer, depth: env.depth + 1});
        const {alias, colNames} = readAlias();
        if (colNames) rel.cols.forEach((c, k) => { if (colNames[k]) c.name = colNames[k]; });
        addRel(rel, alias, alias, t);
      } else {
        parseFrom({t: body, i: 0}, env, sources, joinClauses, deps, derivedIndirect);
        readAlias();
      }
      return;
    }
    if (t.t === 'tmpl') { s.i++; cx.warn('unsupported', 'Templated relation cannot be resolved', t); const {alias} = readAlias(); sources.push({kind: 'rel', alias: alias || '(template)', name: alias || '(template)', rel: {cols: [], complete: false, indirect: [], deps: new Map()}}); return; }
    if (!isIdent(t)) { cx.warn('parse', `Unexpected token in FROM: ${t.v}`, t); s.i++; return; }
    const parts = [t.v];
    s.i++;
    while (isOp(s.t[s.i], '.') && isIdent(s.t[s.i + 1])) { parts.push(s.t[s.i + 1].v); s.i += 2; }
    if (isOp(s.t[s.i], '(')) {
      const e = matchClose(s.t, s.i);
      s.i = e < 0 ? s.t.length : e + 1;
      cx.warn('unsupported', `Table function ${parts.join('.')}() is not analyzed`, t);
      const {alias} = readAlias();
      sources.push({kind: 'rel', alias: alias || parts.join('.'), name: parts.join('.'), rel: {cols: [], complete: false, indirect: [], deps: new Map()}});
      return;
    }
    const {alias, colNames} = readAlias();
    for (const w of ['tablesample', 'pivot', 'unpivot']) if (isKw(s.t[s.i], w)) { cx.warn('unsupported', `${w.toUpperCase()} is not analyzed`, s.t[s.i]); const e = isOp(s.t[s.i + 1], '(') ? matchClose(s.t, s.i + 1) : s.i; s.i = e < 0 ? s.t.length : e + 1; }
    if (isKw(s.t[s.i], 'with') && isOp(s.t[s.i + 1], '(')) { const e = matchClose(s.t, s.i + 1); s.i = e < 0 ? s.t.length : e + 1; }
    const name = parts.join('.');
    if (parts.length === 1 && env.ctes.has(name)) { addRel(env.ctes.get(name), alias, name, t); return; }
    const ds = cx.resolveDataset(parts, t);
    deps.set(ds, deps.get(ds) || {line: t.line, col: t.col});
    if (colNames) cx.warn('unsupported', `Column alias list on table ${ds} is not applied`, t);
    sources.push({kind: 'dataset', alias: alias || parts.at(-1), name: ds, reg: cx.registry.get(ds) || null});
  };
  parseItem();
  for (;;) {
    const t = s.t[s.i];
    if (isOp(t, ',')) { s.i++; parseItem(); continue; }
    if (t?.t === 'id' && JOIN_WORDS.has(t.v)) {
      let sawJoin = false;
      while (s.t[s.i]?.t === 'id' && JOIN_WORDS.has(s.t[s.i].v)) { if (s.t[s.i].v === 'join' || s.t[s.i].v === 'straight_join') sawJoin = true; s.i++; if (sawJoin) break; }
      if ((isKw(s.t[s.i], 'apply'))) { cx.warn('unsupported', 'CROSS/OUTER APPLY is not analyzed', s.t[s.i]); s.i++; }
      parseItem();
      for (;;) {
        if (isKw(s.t[s.i], 'on')) {
          const on = s.t[s.i++];
          const start = s.i; let depth = 0;
          while (s.i < s.t.length) {
            const x = s.t[s.i];
            if (isOp(x, '(')) depth++;
            else if (isOp(x, ')')) { if (depth === 0) break; depth--; }
            else if (isOp(x, ';')) break;
            else if (depth === 0 && x.t === 'id' && (CLAUSE_STOP.has(x.v) || JOIN_WORDS.has(x.v))) break;
            else if (depth === 0 && isOp(x, ',')) break;
            s.i++;
          }
          joinClauses.push({toks: s.t.slice(start, s.i), line: on.line, col: on.col});
          continue;
        }
        if (isKw(s.t[s.i], 'using') && isOp(s.t[s.i + 1], '(')) {
          const u = s.t[s.i];
          const e = matchClose(s.t, s.i + 1);
          joinClauses.push({using: splitTop(s.t.slice(s.i + 2, e < 0 ? s.t.length : e)).map(x => x[0]?.v).filter(Boolean), line: u.line, col: u.col});
          s.i = e < 0 ? s.t.length : e + 1;
          continue;
        }
        break;
      }
      continue;
    }
    break;
  }
}

// ---- statements ------------------------------------------------------------------------------------------------
function ddlColumns(toks, cx) {
  const columns = [], types = {}, notNull = [];
  for (const def of splitTop(toks)) {
    const first = def[0];
    if (!first) continue;
    if (first.t === 'id' && TABLE_CONSTRAINT.has(first.v)) {
      const hard = ['primary', 'foreign', 'constraint', 'check', 'exclude', 'period', 'fulltext', 'spatial', 'like'].includes(first.v);
      if (hard || isOp(def[1], '(') || (first.v === 'unique' && (isKw(def[1], 'key') || isKw(def[1], 'index')))) continue;
    }
    if (!isIdent(first)) continue;
    const name = first.v;
    if (columns.includes(name)) cx.warn('duplicate-column', `Duplicate column ${name} in table definition`, first);
    columns.push(name);
    let j = 1;
    const typeToks = [];
    while (j < def.length && !(def[j].t === 'id' && COL_CONSTRAINT.has(def[j].v))) { typeToks.push(def[j]); j++; }
    types[name] = typeToks.map(x => x.t === 'op' ? x.v : (x.raw ?? x.v)).join('').replace(/,/g, ', ').toLowerCase();
    for (let k = j; k < def.length - 1; k++) if (isKw(def[k], 'not') && isKw(def[k + 1], 'null')) notNull.push(name);
    if (def.slice(j).some((x, k, a) => isKw(x, 'primary') && isKw(a[k + 1], 'key')) && !notNull.includes(name)) notNull.push(name);
  }
  return {columns, types, notNull};
}

function readName(toks, i) {
  if (!isIdent(toks[i])) return null;
  const parts = [toks[i].v];
  let j = i + 1;
  while (isOp(toks[j], '.') && isIdent(toks[j + 1])) { parts.push(toks[j + 1].v); j += 2; }
  return {parts, next: j, tok: toks[i]};
}

function emitLineage(cx, target, rel, tok, mapping) {
  const src = {file: cx.file, line: tok.line, col: tok.col};
  const seen = new Set();
  const push = e => { const k = `${e.type}|${e.from}|${e.to}|${e.kind || ''}|${e.role || ''}`; if (!seen.has(k)) { seen.add(k); cx.edges.push(e); } };
  for (const [d, loc] of rel.deps) if (d !== target) push({from: d, to: target, type: 'table', certainty: 'supported-subset', source: {file: cx.file, line: loc.line, col: loc.col}}); else cx.warn('cycle', `${target} reads from itself`, tok);
  rel.cols.forEach((c, k) => {
    const name = mapping ? mapping[k] : c.name;
    if (!name) return;
    for (const x of c.inputs) push({from: x.id, to: `${target}.${name}`, type: 'column', kind: x.kind, ...(x.role ? {role: x.role} : {}), certainty: 'supported-subset', source: {file: cx.file, line: x.line ?? src.line, col: x.col ?? src.col}});
  });
  for (const x of rel.indirect) push({from: x.id, to: target, type: 'indirect', role: x.role, certainty: 'supported-subset', source: {file: cx.file, line: x.line ?? src.line, col: x.col ?? src.col}});
}

function parseStatement(toks, cx) {
  const first = toks[0];
  if (!first || first.t !== 'id') { if (first) cx.warn('unsupported', 'Statement does not start with a keyword', first); return; }
  const before = cx.warnings.length;
  const env = {cx, ctes: new Map(), outer: null, depth: 0};
  if (first.v === 'create') {
    let i = 1;
    let materialized = false, kind = null;
    while (i < toks.length) {
      const v = toks[i].t === 'id' ? toks[i].v : '';
      if (v === 'table' || v === 'view') { kind = v; i++; break; }
      if (['function', 'procedure', 'trigger', 'package', 'macro'].includes(v)) { cx.warn('unsupported', `CREATE ${v.toUpperCase()} bodies are not analyzed`, toks[i]); return; }
      if (['index', 'schema', 'database', 'sequence', 'type', 'extension', 'role', 'user', 'stage', 'policy', 'domain', 'unique', 'warehouse', 'tag'].includes(v) && !['or', 'replace'].includes(v)) { if (v === 'unique') { i++; continue; } return; }
      if (v === 'materialized') materialized = true;
      i++;
    }
    if (!kind) return;
    while (isKw(toks[i], 'if') || isKw(toks[i], 'not') || isKw(toks[i], 'exists')) i++;
    const nm = readName(toks, i);
    if (!nm) { cx.warn('parse', `CREATE ${kind.toUpperCase()} without a name`, toks[i - 1]); return; }
    i = nm.next;
    const target = nm.parts.join('.');
    const loc = nm.tok;
    if (cx.registry.has(target) && cx.declaredHere?.has(target)) cx.warn('duplicate', `Duplicate dataset declaration ${target}`, loc);
    cx.declaredHere?.add(target);
    let declared = null, viewCols = null;
    if (isOp(toks[i], '(')) {
      const e = matchClose(toks, i);
      if (e < 0) { cx.warn('parse', `Unclosed DDL for ${target}`, loc); return; }
      const inner = toks.slice(i + 1, e);
      if (kind === 'table' && !(isKw(inner[0], 'select') || isKw(inner[0], 'with'))) declared = ddlColumns(inner, cx);
      else viewCols = splitTop(inner).map(x => x[0]?.v);
      i = e + 1;
    }
    while (i < toks.length && !isKw(toks[i], 'as')) {
      if (kind === 'table' && (isKw(toks[i], 'like') || isKw(toks[i], 'clone')) && readName(toks, i + 1)) {
        const o = readName(toks, i + 1); const reg = cx.registry.get(cx.resolveDataset(o.parts));
        if (reg) declared = {columns: [...reg.columns], types: {}, notNull: []};
        else cx.warn('column-unknown', `Cannot copy columns: ${o.parts.join('.')} not declared`, toks[i]);
        break;
      }
      i++;
    }
    if (isKw(toks[i], 'as')) {
      i++;
      const rel = parseQuery({t: toks.slice(i), i: 0}, env);
      let names = rel.cols.map(c => c.name);
      let mapping = null;
      if (declared) { mapping = declared.columns; if (declared.columns.length !== rel.cols.length) { cx.warn('column-unknown', `${target}: declared ${declared.columns.length} columns but SELECT yields ${rel.cols.length}`, loc); mapping = rel.cols.map(c => c.name); } names = declared.columns; }
      else if (viewCols) { mapping = rel.cols.map((c, k) => viewCols[k] || c.name); names = mapping; }
      const complete = rel.complete && !rel.cols.some(c => !c.name);
      emitLineage(cx, target, rel, loc, mapping);
      const colsOut = names.filter(Boolean);
      if (new Set(colsOut).size !== colsOut.length) cx.warn('duplicate-column', `${target}: duplicate output column names`, loc);
      const node = {id: target, kind: materialized ? 'materialized_view' : kind === 'view' ? 'view' : 'table', columns: colsOut, source: {file: cx.file, line: loc.line}, certainty: 'supported-subset'};
      if (declared) { node.columnTypes = declared.types; node.notNull = declared.notNull; }
      node.certainty = cx.warnings.length > before || !complete ? 'partial' : 'supported-subset';
      cx.nodes.push(node);
      cx.registry.set(target, {columns: colsOut, complete: complete && !(rel.cols.some(c => c.partial) && false)});
    } else if (declared) {
      cx.nodes.push({id: target, kind: 'table', columns: declared.columns, columnTypes: declared.types, notNull: declared.notNull, source: {file: cx.file, line: loc.line}, certainty: 'supported-subset'});
      cx.registry.set(target, {columns: declared.columns, complete: true});
    } else {
      cx.warn('unsupported', `Cannot analyze ${kind} ${target}: no column list or AS SELECT`, loc);
      cx.nodes.push({id: target, kind, columns: [], source: {file: cx.file, line: loc.line}, certainty: 'unknown'});
      cx.registry.set(target, {columns: [], complete: false});
    }
    return;
  }
  if (first.v === 'insert') {
    let i = 1;
    while (i < toks.length && !isKw(toks[i], 'into') && !isKw(toks[i], 'overwrite')) i++;
    i++;
    if (isKw(toks[i], 'table')) i++;
    const nm = readName(toks, i);
    if (!nm) { cx.warn('parse', 'INSERT without target', first); return; }
    i = nm.next;
    const target = cx.resolveDataset(nm.parts, nm.tok);
    let names = null;
    if (isOp(toks[i], '(') && !(isKw(toks[i + 1], 'select') || isKw(toks[i + 1], 'with'))) { const e = matchClose(toks, i); names = splitTop(toks.slice(i + 1, e < 0 ? toks.length : e)).map(x => x[0]?.v); i = e < 0 ? toks.length : e + 1; }
    if (!(isKw(toks[i], 'select') || isKw(toks[i], 'with') || isOp(toks[i], '('))) { return; } // VALUES / DEFAULT VALUES: no lineage
    const rel = parseQuery({t: toks.slice(i), i: 0}, env);
    const reg = cx.registry.get(target);
    const mapping = names || (reg?.complete ? reg.columns : null);
    if (!mapping) cx.warn('column-unknown', `INSERT into ${target} without a column list and without a declared schema: positional mapping unknown`, nm.tok);
    if (mapping && mapping.length !== rel.cols.length) cx.warn('column-unknown', `INSERT into ${target}: ${mapping.length} target columns vs ${rel.cols.length} selected`, nm.tok);
    emitLineage(cx, target, rel, nm.tok, mapping && mapping.length === rel.cols.length ? mapping : rel.cols.map(() => null));
    return;
  }
  if (first.v === 'select' || first.v === 'with' || isOp(first, '(')) { cx.warn('unsupported', 'Standalone SELECT has no target dataset; only CREATE TABLE/VIEW AS and INSERT ... SELECT are analyzed', first); return; }
  if (['merge', 'update', 'delete', 'call', 'exec', 'execute', 'declare', 'copy', 'load', 'unload'].includes(first.v)) { cx.warn('unsupported', `${first.v.toUpperCase()} statements are not analyzed`, first); return; }
  if (first.v === 'alter' && isKw(toks[1], 'table')) cx.warn('unsupported', 'ALTER TABLE is not applied to the schema model; declared columns may be stale', first);
}

const KNOWN_DIALECT_WORDS = [['qualify', 'snowflake/bigquery/duckdb/teradata'], ['ilike', 'postgres/snowflake/duckdb'], ['unnest', 'postgres/bigquery/presto'], ['lateral', 'postgres/snowflake'], ['cross apply', 'tsql'], ['nvl', 'oracle/snowflake'], ['sysdate', 'oracle']];

export function parseSQL(sql, file = 'input.sql', opts = {}) {
  if (typeof sql !== 'string' || Buffer.byteLength(sql) > 2_000_000) throw new Error('SQL file too large');
  const cx = new Ctx(file, new Map(opts.registry || []));
  cx.declaredHere = new Set();
  let tk;
  try { tk = tokenize(sql); } catch (e) { cx.warn('parse', e.message); return {nodes: [], edges: [], warnings: cx.warnings, dialectHints: [], registry: cx.registry}; }
  if (tk.flags.templated) cx.warn('unsupported', 'Templated/dynamic SQL cannot be fully resolved');
  if (/\bexecute\s+immediate\b|\bexec\s*\(/i.test(sql.replace(/'(?:[^']|'')*'/g, "''"))) cx.warn('unsupported', 'Dynamic SQL (EXECUTE IMMEDIATE / EXEC) cannot be analyzed');
  // statement split at depth-0 semicolons
  const stmts = [];
  let cur = [], depth = 0;
  for (const t of tk.tokens) {
    if (isOp(t, '(')) depth++;
    else if (isOp(t, ')')) depth = Math.max(0, depth - 1);
    if (isOp(t, ';') && depth === 0) { if (cur.length) stmts.push(cur); cur = []; depth = 0; } else cur.push(t);
  }
  if (cur.length) stmts.push(cur);
  for (const st of stmts) {
    try { parseStatement(st, cx); } catch (e) { cx.warn('parse', `Statement skipped: ${e.message}`, st[0]); }
  }
  if (!cx.nodes.length && !cx.warnings.some(w => w.kind === 'unsupported') && stmts.some(s => isKw(s[0], 'select'))) cx.warn('unsupported', 'Only CREATE TABLE/VIEW and INSERT ... SELECT are parsed');
  const hints = [];
  if (tk.flags.backtick) hints.push('backtick-quoting (bigquery/mysql/spark)');
  if (tk.flags.bracket) hints.push('bracket-quoting (tsql)');
  if (tk.flags.doubleColon) hints.push('::cast (postgres-family/snowflake/duckdb)');
  if (tk.flags.dollarQuoted) hints.push('dollar-quoting (postgres/snowflake)');
  if (tk.flags.templated) hints.push('jinja-template (dbt)');
  const bare = tk.tokens.filter(t => t.t === 'id').map(t => t.v);
  for (const [w, d] of KNOWN_DIALECT_WORDS) if (bare.includes(w.split(' ')[0])) hints.push(`${w.toUpperCase()} (${d})`);
  return {nodes: cx.nodes, edges: cx.edges, warnings: cx.warnings, dialectHints: hints, registry: cx.registry};
}

export {normalize};
