import fs from 'node:fs';
import vm from 'node:vm';

export const categories = [
  'Haiku', 'Koan', 'Philosophical Fragment', 'Geometric Figure',
  'Musical Gesture', 'Scientific Diagram', 'Mathematical Object',
  'Voces', 'Cantos', 'Hymns', 'Mahāvākyas', 'Daoist Chapters',
  'Sufi Poetry', 'Psalms', 'Desert Sayings', 'Zen Death Poems (Jisei)',
  'Epitaphs', 'Prayers', 'Natural Observations', 'Esoteric Formula',
  'Occult Diagram', 'Ritual Fragment'
];

export const nonTextCategories = new Set([
  'Geometric Figure', 'Musical Gesture', 'Scientific Diagram', 'Mathematical Object',
  'Occult Diagram'
]);

export const requiredArtifactFields = [
  'id', 'category', 'artifact', 'original', 'english', 'spanish',
  'recommendedEditionSource', 'sourceUrl', 'sourceId', 'status', 'notes'
];

export function readJson(path, fallback = null) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.,;:!?¿¡—–\-"'“”‘’()[\]{}]+/g, ' ')
    .trim();
}

export function loadLiveRows() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('extra-worms-001.js', 'utf8'), sandbox, { filename: 'extra-worms-001.js' });
  return sandbox.window.THOUGHT_WORMS || [];
}

export function assertValidArtifact(row, index, sourcesById, { requireVerified = false } = {}) {
  for (const key of requiredArtifactFields) {
    if (typeof row[key] !== 'string' || !row[key].trim()) {
      throw new Error(`row ${index} missing non-empty ${key}`);
    }
  }
  if (!categories.includes(row.category)) throw new Error(`row ${index} invalid category ${row.category}`);
  if (!/^https:\/\//.test(row.sourceUrl)) throw new Error(`row ${index} sourceUrl must be https`);
  if (!sourcesById.has(row.sourceId)) throw new Error(`row ${index} sourceId not registered: ${row.sourceId}`);
  if (nonTextCategories.has(row.category) && !/^https:\/\//.test(row.sourceUrl)) {
    throw new Error(`row ${index} non-text artifact missing authoritative link`);
  }
  if (requireVerified && row.status !== 'verified') throw new Error(`row ${index} must be verified`);
  if (normalizeText(row.english) === normalizeText(row.spanish)) throw new Error(`row ${index} English and Spanish are identical`);
}

export function validateNoDuplicateContent(rows, label = 'rows') {
  const maps = {
    id: new Map(),
    artifact: new Map(),
    original: new Map(),
    english: new Map(),
    spanish: new Map()
  };
  for (const row of rows) {
    for (const key of Object.keys(maps)) {
      const normalized = normalizeText(row[key]);
      if (!normalized) continue;
      if (maps[key].has(normalized)) {
        throw new Error(`${label}: duplicate ${key} content: ${row.artifact} duplicates ${maps[key].get(normalized)}`);
      }
      maps[key].set(normalized, row.artifact);
    }
  }
}
