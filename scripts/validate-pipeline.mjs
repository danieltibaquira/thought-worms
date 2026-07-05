import {
  readJson,
  loadLiveRows,
  assertValidArtifact,
  validateNoDuplicateContent,
  categories,
  nonTextCategories
} from './pipeline-lib.mjs';

const sources = readJson('data/sources.json', []);
const verified = readJson('data/artifacts.verified.json', []);
const candidates = readJson('data/artifacts.candidates.json', []);
const rejected = readJson('data/artifacts.rejected.json', []);
const liveRows = loadLiveRows();

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

const sourcesById = new Map(sources.map((source) => [source.id, source]));

for (const [name, rows, requireVerified] of [
  ['verified', verified, true],
  ['candidates', candidates, false],
  ['rejected', rejected, false]
]) {
  check(() => {
    if (!Array.isArray(rows)) throw new Error(`${name} artifact store must be an array`);
    for (const [index, row] of rows.entries()) assertValidArtifact(row, index, sourcesById, { requireVerified });
    validateNoDuplicateContent(rows, name);
  });
}

check(() => validateNoDuplicateContent([...verified, ...candidates], 'verified+candidates'));

check(() => {
  const liveIds = new Set(liveRows.map((row) => `${row.category}::${row.artifact}`));
  for (const row of verified) {
    const liveId = `${row.category}::${row.artifact}`;
    if (!liveIds.has(liveId)) throw new Error(`verified row missing from live build: ${row.id}`);
  }
});

check(() => {
  for (const row of verified) {
    if (nonTextCategories.has(row.category) && !row.sourceUrl.startsWith('https://')) {
      throw new Error(`non-text verified row ${row.id} missing link`);
    }
  }
});

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`pipeline validation passed: ${verified.length} verified, ${candidates.length} candidates, ${rejected.length} rejected, ${sources.length} sources`);
