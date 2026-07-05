const worms = Array.isArray(window.THOUGHT_WORMS) ? window.THOUGHT_WORMS : [];
const DB = 'thought-worms-db';
const STORE = 'reviews';
const DAY = 24 * 60 * 60 * 1000;

function idFor(worm) {
  return `${worm.category}::${worm.artifact}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function getReview(db, id) {
  return new Promise((resolve) => {
    const request = txStore(db, 'readonly').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

function putReview(db, review) {
  return new Promise((resolve) => {
    const request = txStore(db, 'readwrite').put(review);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

async function chooseWorm(db) {
  const now = Date.now();
  const candidates = [];

  for (const worm of worms) {
    const id = idFor(worm);
    const review = await getReview(db, id);
    const seen = review?.seen || 0;
    const dueAt = review?.dueAt || 0;
    const lastSeen = review?.lastSeen || 0;
    candidates.push({ worm, id, seen, dueAt, lastSeen });
  }

  candidates.sort((a, b) => {
    const aDue = a.dueAt <= now ? 0 : 1;
    const bDue = b.dueAt <= now ? 0 : 1;
    return aDue - bDue || a.seen - b.seen || a.dueAt - b.dueAt || a.lastSeen - b.lastSeen;
  });

  return candidates[0];
}

function nextInterval(seen) {
  if (seen <= 0) return DAY;
  if (seen === 1) return 3 * DAY;
  if (seen === 2) return 7 * DAY;
  if (seen === 3) return 21 * DAY;
  return Math.min(180 * DAY, Math.round(21 * DAY * Math.pow(1.9, seen - 3)));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || '';
}

function show(worm) {
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

async function pick() {
  if (!worms.length) return;
  const db = await openDb();
  const item = await chooseWorm(db);
  const now = Date.now();
  const seen = item.seen + 1;
  await putReview(db, {
    id: item.id,
    seen,
    firstSeen: item.lastSeen ? undefined : now,
    lastSeen: now,
    dueAt: now + nextInterval(seen)
  });
  show(item.worm);
}

document.getElementById('again').addEventListener('click', pick);
pick();
