const worms = Array.isArray(window.THOUGHT_WORMS) ? window.THOUGHT_WORMS : [];
const PREFIX = 'thought-worms:';

function getState() {
  if (!window.name || !window.name.startsWith(PREFIX)) return { index: 0, order: [] };
  try { return JSON.parse(window.name.slice(PREFIX.length)); }
  catch { return { index: 0, order: [] }; }
}

function setState(state) {
  window.name = PREFIX + JSON.stringify(state);
}

function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeOrder() {
  const salt = String(Date.now()) + String(Math.random());
  return worms
    .map((worm, index) => ({ index, score: hash(`${salt}:${worm.category}:${worm.artifact}`) }))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.index);
}

function normalizeState(state) {
  const valid = Array.isArray(state.order) && state.order.length === worms.length;
  if (!valid || state.index >= state.order.length) return { index: 0, order: makeOrder() };
  return state;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || '';
}

function pick() {
  if (!worms.length) return;

  const state = normalizeState(getState());
  const worm = worms[state.order[state.index]];
  state.index += 1;
  setState(state);

  document.title = worm.category + ' — Thought Worms';
  setText('category', worm.category);
  setText('artifact', worm.artifact);
  setText('english', worm.english);
  setText('spanish', worm.spanish);

  const original = document.getElementById('original');
  const originalText = (worm.original || '').trim();
  const artifactText = (worm.artifact || '').trim();
  const hideOriginal = !originalText || originalText === artifactText || originalText.endsWith(': non-text artifact');
  original.hidden = hideOriginal;
  original.textContent = hideOriginal ? '' : originalText;

  const source = document.getElementById('source');
  source.href = worm.sourceUrl || '#';
  source.textContent = worm.recommendedEditionSource || 'Source';
}

document.getElementById('again').addEventListener('click', pick);
pick();
