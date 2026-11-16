import {FORMAT_VERSION, PARSER_VERSION, VERSION} from './version.mjs';
import {sha256, seal, normalize} from './util.mjs';

// Metadata-only dbt manifest import: nodes, sources, exposures and depends_on. Never runs dbt or SQL.
export function importDbtManifest(input, {maxBytes = 8_000_000} = {}) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > maxBytes) throw new Error('dbt manifest exceeds configured size');
  let doc;
  try { doc = JSON.parse(input); } catch { throw new Error('Invalid dbt manifest JSON'); }
  if (!doc || typeof doc !== 'object' || !doc.nodes || typeof doc.nodes !== 'object' || Array.isArray(doc.nodes)) throw new Error('Expected dbt manifest nodes object');
  const asObj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const declared = {...asObj(doc.sources), ...asObj(doc.exposures), ...doc.nodes};
  const keys = Object.keys(declared).sort();
  if (keys.length > 3000) throw new Error('dbt node count exceeds safety limit');
  const nodes = [], edges = [], warnings = [];
  const schemaUrl = String(doc.metadata?.dbt_schema_version || '');
  const ver = Number((schemaUrl.match(/manifest\/v(\d+)/) || [])[1]);
  if (!ver) warnings.push({file: 'manifest.json', kind: 'schema-version', detail: 'dbt_schema_version missing or unrecognized; structure was not validated against a manifest schema'});
  else if (ver < 7 || ver > 12) warnings.push({file: 'manifest.json', kind: 'schema-version', detail: `manifest v${ver} is outside the versions exercised by this tool's fixtures (v7-v12); fields may be missing`});
  for (const key of keys) {
    const src = declared[key];
    if (!src || typeof src !== 'object') continue;
    const cols = src.columns && typeof src.columns === 'object' ? Object.keys(src.columns).map(normalize).sort() : [];
    nodes.push({id: normalize(key), kind: src.resource_type || 'dbt-dataset', columns: cols, source: {file: 'manifest.json', line: null}, certainty: 'dbt-declared-metadata', ...(src.owner?.name || src.config?.meta?.owner ? {owner: String(src.owner?.name || src.config.meta.owner)} : {})});
    const uses = src.depends_on?.nodes || [];
    if (!Array.isArray(uses)) { warnings.push({file: 'manifest.json', kind: 'invalid', detail: `${key}: depends_on.nodes not an array`}); continue; }
    for (const upstream of uses) {
      if (typeof upstream !== 'string') continue;
      if (!Object.hasOwn(declared, upstream)) warnings.push({file: 'manifest.json', kind: 'missing-reference', detail: `${key} references ${upstream} not supplied in manifest`});
      edges.push({from: normalize(upstream), to: normalize(key), type: 'table', certainty: 'dbt-declared-metadata', source: {file: 'manifest.json', line: null}});
    }
  }
  edges.sort((a, b) => ((a.from + a.to) < (b.from + b.to) ? -1 : 1));
  return seal({
    format: FORMAT_VERSION,
    tool: {name: 'lineagesutra-ai', version: VERSION, parser: PARSER_VERSION},
    mode: 'offline-dbt-metadata',
    rootLabel: 'dbt-manifest',
    summary: {sqlFiles: 0, datasets: nodes.length, dependencies: edges.length, warnings: warnings.length, dbtSchemaVersion: ver || null},
    sources: [{path: 'manifest.json', sha256: sha256(input), bytes: Buffer.byteLength(input)}],
    nodes, edges, warnings,
    limits: [
      'dbt manifest importer reads declared node/schema metadata and depends_on graph only; never runs dbt or SQL',
      'Column presence in dbt manifest is not proven column flow; runtime freshness, actual data tests and execution are not verified',
      'Manifest-version-specific validation is partial; compiled SQL is not parsed by this importer'
    ]
  });
}
