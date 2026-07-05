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

const nonText = new Set(['Geometric Figure', 'Musical Gesture', 'Scientific Diagram', 'Mathematical Object']);
const generic = new Set([
  'A small seasonal perception held without explanation.',
  'A question that refuses the machinery of ordinary answers.',
  'A compressed proposition for turning perception against itself.',
  'A visible form where structure becomes contemplation.',
  'A sonic cell that changes the felt shape of time.',
  'A pattern of relation made visible.',
  'A formal object where necessity becomes image.',
  'A voice reduced until only the wound of thought remains.',
  'Song as memory, earth, impermanence and address.',
  'Praise turning into metaphysical inquiry.',
  'Identity stated as a seed, not an argument.',
  'The way named only to loosen the grip of naming.',
  'Longing used as an instrument of knowledge.',
  'A human cry shaped into liturgical memory.',
  'A severe sentence for reducing the self to practice.',
  'The last breath arranged as a small clear form.',
  'A life compressed into address, stone and disappearance.',
  'Speech turned toward what exceeds speech.',
  'Attention to nature becoming a method of thought.'
]);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('extra-worms-001.js', 'utf8'), sandbox, { filename: 'extra-worms-001.js' });

const rows = sandbox.window.THOUGHT_WORMS;
assert(Array.isArray(rows), 'window.THOUGHT_WORMS must be an array');
assert(rows.length >= 50, `expected at least 50 curated rows, found ${rows.length}`);

const allowed = new Set(categories);
const required = ['category', 'artifact', 'original', 'english', 'spanish', 'recommendedEditionSource', 'sourceUrl', 'notes'];
const ids = new Set();
const englishTexts = new Map();
const spanishTexts = new Map();
const originalTexts = new Map();
const counts = Object.fromEntries(categories.map((category) => [category, 0]));

function normalized(value) {
  return value.toLowerCase().replace(/[\s.,;:!?¿¡—–-]+/g, ' ').trim();
}

for (const [index, row] of rows.entries()) {
  for (const key of required) {
    assert.equal(typeof row[key], 'string', `row ${index} missing string ${key}`);
    assert(row[key].trim().length > 0, `row ${index} empty ${key}`);
  }

  assert(allowed.has(row.category), `row ${index} invalid category: ${row.category}`);
  assert(/^https:\/\//.test(row.sourceUrl), `row ${index} sourceUrl must be https`);
  if (nonText.has(row.category)) assert(row.sourceUrl.startsWith('https://'), `row ${index} non-text source must link`);

  assert(!generic.has(row.english), `row ${index} uses scaffold English instead of actual content`);
  assert(!row.notes.includes('Sourced corpus row'), `row ${index} is scaffold metadata`);

  const id = normalized(`${row.category}::${row.artifact}`);
  assert(!ids.has(id), `duplicate artifact id: ${row.category}::${row.artifact}`);
  ids.add(id);

  for (const [label, map, value] of [
    ['english', englishTexts, row.english],
    ['spanish', spanishTexts, row.spanish],
    ['original', originalTexts, row.original]
  ]) {
    const key = normalized(value);
    assert(!map.has(key), `duplicate ${label} content: ${row.artifact} duplicates ${map.get(key)}`);
    map.set(key, row.artifact);
  }

  counts[row.category] += 1;
}

const html = fs.readFileSync('index.html', 'utf8');
assert(!html.includes('thought-worms.js'), 'index must not load scaffold corpus');
assert(html.includes('extra-worms-001.js'), 'index must load curated corpus');
assert(html.includes('app.js'), 'index must load scheduler app');

const app = fs.readFileSync('app.js', 'utf8');
assert(app.includes('indexedDB'), 'app must use durable scheduling');
assert(app.includes('dueAt'), 'app must schedule resurfacing');

console.log(`validated ${rows.length} unique-content rows across ${categories.length} categories`);
console.table(counts);
