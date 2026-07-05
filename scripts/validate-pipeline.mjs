import {
  readJson,
  loadLiveRows,
  assertValidArtifact,
  validateNoDuplicateContent,
  categories,
  nonTextCategories
} from './pipeline-lib.mjs';

const sources = readJson('data/sources.json', []);
const candidates = readJson('data/artifacts.candidates.json', []);
const rejected = readJson('data/artifacts.rejected.json', []);
const liveRows = loadLiveRows().map((row, index) => ({
  id: row.id || `${row.category}::${row.artifact}`,
  sourceId: row.sourceId || 'legacy-curated',
  status: row.status || 'verified',
  ...row
}));

const errors = [];
function check(fn) {
  try { fn(); } catch (error) { errors.push(error.message); }
}

check(() => {
  if (!Array.isArray(sources)) throw new Error('data/sources.json must be an array');
  const ids = new Set();
  for (const [index, source] of sources.entries()) {
    for (const key of ['id', 'category', 'title', 'language', 'url', 'license', 'priority', 'harvester']) {
      if (typeof source[key] !== 'string' || !source[key].trim()) throw new Error(`source ${index} missing ${key}`);
    }
    if (ids.has(source.id)) throw new Error(`duplicate source id ${source.id}`);
    ids.add(source.id);
    if (!categories.includes(source.category)) throw new Error(`source ${source.id} invalid category ${source.category}`);
    if (!/^https:\/\//.test(source.url)) throw new Error(`source ${source.id} url must be https`);
  }
});

const sourcesWithLegacy = new Map(sources.map((source) => [source.id, source]));
sourcesWithLegacy.set('legacy-curated', { id: 'legacy-curated' });

for (const [name, rows, requireVerified] of [
  ['live', liveRows, true],
  ['candidates', candidates, false],
  ['rejected', rejected, false]
]) {
  check(() => {
    if (!Array.isArray(rows)) throw new Error(`${name} artifact store must be an array`);
    for (const [index, row] of rows.entries()) assertValidArtifact(row, index, sourcesWithLegacy, { requireVerified });
    validateNoDuplicateContent(rows, name);
  });
}

check(() => validateNoDuplicateContent([...liveRows, ...candidates], 'live+candidates'));

check(() => {
  for (const row of liveRows) {
    if (nonTextCategories.has(row.category) && !row.sourceUrl.startsWith('https://')) {
      throw new Error(`non-text live row ${row.id} missing link`);
    }
  }
});

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`pipeline validation passed: ${liveRows.length} live, ${candidates.length} candidates, ${rejected.length} rejected, ${sources.length} sources`);
