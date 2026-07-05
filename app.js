const worms = Array.isArray(window.THOUGHT_WORMS) ? window.THOUGHT_WORMS : [];
let cursor = 0;

function seed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function score(index) {
  const x = Math.sin((index + 1) * 99991 + seed()) * 10000;
  return x - Math.floor(x);
}

const order = worms.map((_, index) => index).sort((a, b) => score(a) - score(b));

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || '';
}

function pick() {
  if (!worms.length) return;
  const worm = worms[order[cursor % order.length]];
  cursor += 1;

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
