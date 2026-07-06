const worms = Array.isArray(window.THOUGHT_WORMS) ? window.THOUGHT_WORMS : [];
const DB = 'thought-worms-db';
const STORE = 'reviews';
const DAY = 24 * 60 * 60 * 1000;
const MODE_KEY = 'thought-worms-mode';
const CATEGORY_KEY = 'thought-worms-deep-category';
const SESSION_LIMIT = 12;
const sessionHistory = [];

const FEED_MODES = {
  balanced: 'Balanced Daily Drift',
  review: 'Review',
  'long-tail': 'Long Tail',
  'deep-source': 'Deep Source',
  serendipity: 'Serendipity'
};

const THEME_RULES = [
  ['silence', ['silence', 'silent', 'callar', 'silencio', 'stillness', 'quiet', 'flee, be silent']],
  ['death', ['death', 'dead', 'mortality', 'dying', 'muerte', 'morir', 'epitaph', 'grave', 'tomb', 'jisei']],
  ['ordinary act', ['bowl', 'meal', 'rice', 'work', 'ordinary', 'daily', 'camino ordinario', 'acto ordinario']],
  ['water', ['water', 'river', 'sea', 'ocean', 'rain', 'waters', 'mar', 'agua', 'rivers', 'stream']],
  ['fire', ['fire', 'flame', 'burn', 'burns', 'fuego', 'llama', 'arder', 'arde']],
  ['returning', ['return', 'returning', 'retornar', 'vuelve', 'home', 'hogar', 'origin', 'mother']],
  ['non-action', ['non-action', 'non action', 'wu wei', '無為', 'no-acción', 'no accion']],
  ['prayer', ['prayer', 'pray', 'oración', 'orar', 'psalm', 'lord', 'god', 'dios']],
  ['body', ['body', 'breath', 'teeth', 'hand', 'finger', 'cuerpo', 'respiración', 'dedo', 'mano']],
  ['void', ['void', 'empty', 'emptiness', 'nothing', 'nameless', 'vacío', 'vacio', 'nada', 'sin nombre']],
  ['attention', ['attention', 'watch', 'mind', 'thought', 'awareness', 'atención', 'mente', 'pensamiento']],
  ['poverty', ['poor', 'poverty', 'destitute', 'alms', 'empty-handed', 'pobreza', 'pobre', 'limosna']],
  ['music', ['music', 'song', 'flute', 'reed', 'canto', 'música', 'musical']],
  ['geometry', ['circle', 'line', 'triangle', 'square', 'figure', 'geometric', 'geometría']],
  ['light', ['light', 'lamp', 'sun', 'moon', 'sky', 'heavens', 'luz', 'sol', 'luna', 'cielo']],
  ['tree', ['tree', 'root', 'leaf', 'flower', 'fruit', 'árbol', 'arbol', 'raíz', 'raiz', 'flor']],
  ['love', ['love', 'beloved', 'lover', 'amor', 'amado', 'amante']],
  ['wisdom', ['wisdom', 'teacher', 'teaching', 'learn', 'sabiduría', 'sabiduria', 'enseñanza']],
  ['time', ['time', 'days', 'season', 'winter', 'kalpas', 'tiempo', 'días', 'dias', 'estación']]
];

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

function getAllReviews(db) {
  return new Promise((resolve) => {
    const request = txStore(db, 'readonly').getAll();
    request.onsuccess = () => resolve(new Map((request.result || []).map((review) => [review.id, review])));
    request.onerror = () => resolve(new Map());
  });
}

function putReview(db, review) {
  return new Promise((resolve) => {
    const request = txStore(db, 'readwrite').put(review);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

function nextInterval(seen) {
  if (seen <= 0) return DAY;
  if (seen === 1) return 3 * DAY;
  if (seen === 2) return 7 * DAY;
  if (seen === 3) return 21 * DAY;
  return Math.min(180 * DAY, Math.round(21 * DAY * Math.pow(1.9, seen - 3)));
}

function groupedByCategory() {
  return worms.reduce((groups, worm) => {
    const category = worm.category || 'Uncategorized';
    groups[category] ||= [];
    groups[category].push(worm);
    return groups;
  }, {});
}

const categoryGroups = groupedByCategory();
const categories = Object.keys(categoryGroups).sort((a, b) => a.localeCompare(b));

function safeMode(value) {
  return Object.prototype.hasOwnProperty.call(FEED_MODES, value) ? value : 'balanced';
}

function currentMode() {
  const select = document.getElementById('mode');
  return safeMode(select?.value || localStorage.getItem(MODE_KEY) || 'balanced');
}

function currentDeepCategory() {
  const select = document.getElementById('deepCategory');
  const value = select?.value || localStorage.getItem(CATEGORY_KEY) || categories[0];
  return categories.includes(value) ? value : categories[0];
}

function weightedSample(entries) {
  const valid = entries.filter((entry) => entry.weight > 0 && Number.isFinite(entry.weight));
  if (!valid.length) return entries[0]?.value || null;
  const total = valid.reduce((sum, entry) => sum + entry.weight, 0);
  let needle = Math.random() * total;
  for (const entry of valid) {
    needle -= entry.weight;
    if (needle <= 0) return entry.value;
  }
  return valid[valid.length - 1].value;
}

function buildItems(reviews, now) {
  return worms.map((worm) => {
    const id = idFor(worm);
    const review = reviews.get(id) || { id, seen: 0, firstSeen: null, lastSeen: 0, dueAt: 0 };
    const seen = review.seen || 0;
    const dueAt = review.dueAt || 0;
    return {
      worm,
      id,
      seen,
      firstSeen: review.firstSeen || null,
      lastSeen: review.lastSeen || 0,
      dueAt,
      isNew: seen === 0,
      isDue: seen > 0 && dueAt <= now
    };
  });
}

function buildCategoryStats(items) {
  const stats = {};
  for (const category of categories) {
    stats[category] = {
      category,
      count: categoryGroups[category].length,
      seenTotal: 0,
      seenItems: 0,
      dueCount: 0,
      newCount: 0,
      lastSeen: 0
    };
  }
  for (const item of items) {
    const stat = stats[item.worm.category];
    stat.seenTotal += item.seen;
    if (item.seen > 0) stat.seenItems += 1;
    if (item.isDue) stat.dueCount += 1;
    if (item.isNew) stat.newCount += 1;
    stat.lastSeen = Math.max(stat.lastSeen, item.lastSeen || 0);
  }
  return stats;
}

function categoryCooldown(category, mode) {
  if (mode === 'deep-source') return 1;
  const recent = sessionHistory.slice(-6).map((entry) => entry.category);
  const lastIndex = [...recent].reverse().indexOf(category);
  let penalty = 1;
  if (lastIndex === 0) penalty = 0.08;
  else if (lastIndex === 1) penalty = 0.28;
  else if (lastIndex === 2) penalty = 0.55;
  else if (lastIndex >= 3) penalty = 0.82;
  const sameInRecent = recent.filter((value) => value === category).length;
  if (sameInRecent >= 3) penalty *= 0.15;
  return penalty;
}

function chooseCategory(items, stats, mode, now) {
  if (mode === 'deep-source') return currentDeepCategory();

  const globalSeenAvg = items.reduce((sum, item) => sum + item.seen, 0) / Math.max(1, items.length);
  const entries = categories.map((category) => {
    const stat = stats[category];
    const catAvg = stat.seenTotal / Math.max(1, stat.count);
    const dueRatio = stat.dueCount / Math.max(1, stat.count);
    const newRatio = stat.newCount / Math.max(1, stat.count);
    const underSeenBoost = Math.max(0.7, Math.min(2.4, (globalSeenAvg + 0.35) / (catAvg + 0.35)));
    const dueReviewBoost = 1 + Math.min(1.8, dueRatio * 5);
    const newItemBoost = 1 + Math.min(0.9, newRatio * 1.4);
    const cooldown = categoryCooldown(category, mode);
    let weight;

    if (mode === 'review') {
      weight = stat.dueCount > 0 ? stat.dueCount * dueReviewBoost * cooldown : 0;
    } else if (mode === 'long-tail') {
      weight = Math.pow(stat.count, -0.38) * underSeenBoost * newItemBoost * cooldown;
      if (stat.count <= 5) weight *= 1.35;
      if (stat.dueCount > 0) weight *= 1.15;
    } else if (mode === 'serendipity') {
      weight = Math.pow(stat.count, 0.25) * underSeenBoost * cooldown * (0.5 + Math.random() * 1.7);
      if (stat.dueCount > 0) weight *= 1.25;
    } else {
      weight = Math.pow(stat.count, 0.45) * underSeenBoost * dueReviewBoost * newItemBoost * cooldown;
    }

    return { value: category, weight };
  });

  if (mode === 'review' && entries.every((entry) => entry.weight === 0)) {
    return chooseCategory(items, stats, 'balanced', now);
  }

  return weightedSample(entries) || categories[0];
}

function itemAgeScore(item, now) {
  if (!item.lastSeen) return 2.8;
  const days = (now - item.lastSeen) / DAY;
  return Math.min(3, days / 14);
}

function chooseItem(items, category, mode, now) {
  const categoryItems = items.filter((item) => item.worm.category === category);
  const usable = mode === 'review'
    ? categoryItems.filter((item) => item.isDue)
    : categoryItems;
  const pool = usable.length ? usable : categoryItems;

  const entries = pool.map((item) => {
    let weight = 1;
    if (item.isDue) weight += mode === 'review' ? 9 : 5;
    if (item.isNew && mode !== 'review') weight += mode === 'long-tail' ? 5 : 3.5;
    weight += 2.4 / (item.seen + 1);
    weight += itemAgeScore(item, now);

    if (mode === 'serendipity') weight *= 0.65 + Math.random() * 1.8;
    if (mode === 'deep-source') weight *= item.isNew ? 1.6 : 1;

    const repeatedRecently = sessionHistory.slice(-SESSION_LIMIT).some((entry) => entry.id === item.id);
    if (repeatedRecently) weight *= 0.03;

    return { value: item, weight };
  });

  return weightedSample(entries) || pool[0] || items[0];
}

function chooseWorm(items, mode, now) {
  const stats = buildCategoryStats(items);
  const category = chooseCategory(items, stats, mode, now);
  const item = chooseItem(items, category, mode, now);
  return { item, stats };
}

function inferThemes(worm) {
  const text = [worm.category, worm.artifact, worm.original, worm.english, worm.spanish, worm.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const matches = [];
  for (const [theme, needles] of THEME_RULES) {
    if (needles.some((needle) => text.includes(needle))) matches.push(theme);
    if (matches.length >= 4) break;
  }
  return matches;
}

function reasonFor(item, stats, mode) {
  const stat = stats[item.worm.category];
  const totalSeen = Object.values(stats).reduce((sum, value) => sum + value.seenTotal, 0);
  const totalCount = Object.values(stats).reduce((sum, value) => sum + value.count, 0);
  const globalAvg = totalSeen / Math.max(1, totalCount);
  const catAvg = stat.seenTotal / Math.max(1, stat.count);
  const state = item.isNew ? 'new' : item.isDue ? 'due review' : `${item.seen} previous ${item.seen === 1 ? 'view' : 'views'}`;

  let reason = 'soft category balance';
  if (mode === 'review') reason = item.isDue ? 'scheduled review' : 'no due cards; balanced fallback';
  else if (mode === 'long-tail') reason = 'long-tail category exposure';
  else if (mode === 'deep-source') reason = 'deep source/category mode';
  else if (mode === 'serendipity') reason = 'bounded randomness with cooldowns';
  else if (item.isDue) reason = 'due item inside balanced drift';
  else if (catAvg < globalAvg) reason = 'under-shown category';
  else if (stat.newCount > 0) reason = 'new material available';

  return `${item.worm.category} · ${state} · ${reason}`;
}

function categorySummary(stats) {
  const seenItems = Object.values(stats).reduce((sum, stat) => sum + stat.seenItems, 0);
  const dueItems = Object.values(stats).reduce((sum, stat) => sum + stat.dueCount, 0);
  const newItems = worms.length - seenItems;
  return `Seen ${seenItems}/${worms.length} · ${dueItems} due · ${newItems} new · ${categories.length} categories`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || '';
}

function show(item, stats, mode) {
  const worm = item.worm;
  document.title = worm.category + ' — Thought Worms';
  setText('category', worm.category);
  setText('artifact', worm.artifact);
  setText('english', worm.english);
  setText('spanish', worm.spanish);
  setText('why', reasonFor(item, stats, mode));
  setText('progress', `${FEED_MODES[mode]} · ${categorySummary(stats)}`);

  const themes = inferThemes(worm);
  setText('themes', themes.length ? `themes: ${themes.join(' · ')}` : 'themes: untagged');

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
  const mode = currentMode();
  const db = await openDb();
  const now = Date.now();
  const reviews = await getAllReviews(db);
  const items = buildItems(reviews, now);
  const { item, stats } = chooseWorm(items, mode, now);
  const seen = item.seen + 1;

  await putReview(db, {
    id: item.id,
    seen,
    firstSeen: item.firstSeen || now,
    lastSeen: now,
    dueAt: now + nextInterval(seen)
  });

  sessionHistory.push({ id: item.id, category: item.worm.category, at: now });
  while (sessionHistory.length > SESSION_LIMIT) sessionHistory.shift();
  show(item, stats, mode);
}

function setupControls() {
  const mode = document.getElementById('mode');
  const deepCategory = document.getElementById('deepCategory');

  if (mode) {
    mode.value = safeMode(localStorage.getItem(MODE_KEY) || 'balanced');
    mode.addEventListener('change', () => {
      localStorage.setItem(MODE_KEY, safeMode(mode.value));
      pick();
    });
  }

  if (deepCategory) {
    deepCategory.innerHTML = categories
      .map((category) => `<option value="${category.replaceAll('"', '&quot;')}">${category} (${categoryGroups[category].length})</option>`)
      .join('');
    deepCategory.value = currentDeepCategory();
    deepCategory.addEventListener('change', () => {
      localStorage.setItem(CATEGORY_KEY, deepCategory.value);
      if (currentMode() === 'deep-source') pick();
    });
  }
}

setupControls();
document.getElementById('again').addEventListener('click', pick);
pick();
