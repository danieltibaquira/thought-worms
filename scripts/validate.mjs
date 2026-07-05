import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const categories = [
  'Haiku', 'Koan', 'Philosophical Fragment', 'Geometric Figure',
  'Musical Gesture', 'Scientific Diagram', 'Mathematical Object',
  'Voces', 'Cantos', 'Hymns', 'Mahāvākyas', 'Daoist Chapters',
  'Sufi Poetry', 'Psalms', 'Desert Sayings', 'Zen Death Poems (Jisei)',
  'Epitaphs', 'Prayers', 'Natural Observations'
];

const nonText = new Set([
  'Geometric Figure', 'Musical Gesture', 'Scientific Diagram', 'Mathematical Object'
]);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('thought-worms.js', 'utf8'), sandbox, { filename: 'thought-worms.js' });
vm.runInContext(fs.readFileSync('extra-worms-001.js', 'utf8'), sandbox, { filename: 'extra-worms-001.js' });

const rows = sandbox.window.THOUGHT_WORMS;
assert(Array.isArray(rows), 'window.THOUGHT_WORMS must be an array');
assert(rows.length >= 300, `expected at least 300 rows, found ${rows.length}`);

const allowed = new Set(categories);
const required = ['category', 'artifact', 'original', 'english', 'spanish', 'recommendedEditionSource', 'sourceUrl', 'notes'];
const seen = new Set();
const counts = Object.fromEntries(categories.map((category) => [category, 0]));

for (const [index, row] of rows.entries()) {
  for (const key of required) {
    assert.equal(typeof row[key], 'string', `row ${index} missing string ${key}`);
    assert(row[key].trim().length > 0, `row ${index} empty ${key}`);
  }
  assert(allowed.has(row.category), `row ${index} invalid category: ${row.category}`);
  assert(/^https:\/\//.test(row.sourceUrl), `row ${index} sourceUrl must be https`);
  if (nonText.has(row.category)) assert(row.sourceUrl.startsWith('https://'), `row ${index} non-text source must link`);
  const id = `${row.category}::${row.artifact}`.toLowerCase();
  assert(!seen.has(id), `duplicate row ${id}`);
  seen.add(id);
  counts[row.category] += 1;
}

for (const category of categories) assert(counts[category] > 0, `missing category ${category}`);

const html = fs.readFileSync('index.html', 'utf8');
for (const id of ['category', 'artifact', 'original', 'english', 'spanish', 'source', 'again']) {
  assert(html.includes(`id="${id}"`), `index missing #${id}`);
}
assert(html.includes('thought-worms.js'), 'index must load thought-worms.js');
assert(html.includes('extra-worms-001.js'), 'index must load additive corpus');
assert(html.includes('app.js'), 'index must load picker app');

const app = fs.readFileSync('app.js', 'utf8');
assert(app.includes('chooseWorm'), 'app must include scheduler');
assert(app.includes('cursor'), 'app must advance through a cycle');

console.log(`validated ${rows.length} rows across ${categories.length} categories`);
console.table(counts);
