const worms = Array.isArray(window.THOUGHT_WORMS) ? window.THOUGHT_WORMS : [];
const DB = 'thought-worms-db';
const STORE = 'reviews';
const DAY = 24 * 60 * 60 * 1000;
const MODE_KEY = 'thought-worms-mode';
const CATEGORY_KEY = 'thought-worms-deep-category';
const THEME_KEY = 'thought-worms-theme';
const SESSION_LIMIT = 12;
const CHAIN_LENGTH = 7;
const sessionHistory = [];
let activeChain = null;

const FEED_MODES = {
  balanced: 'Balanced Daily Drift',
  constellation: 'Constellation',
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

function wormText(worm) {
  return [worm.category, worm.artifact, worm.original, worm.english, worm.spanish, worm.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function themesFor(worm) {
  if (Array.isArray(worm.themes) && worm.themes.length) return worm.themes;
  const text = wormText(worm);
  const matches = [];
  for (const [theme, needles] of THEME_RULES) {
    if (needles.some((needle) => text.includes(needle))) matches.push(theme);
    if (matches.length >= 4) break;
  }
  return matches;
}

const categoryGroups = worms.reduce((groups, worm) => {
  groups[worm.category] ||= [];
  groups[worm.category].push(worm);
  return groups;
}, {});
const categories = Object.keys(categoryGroups).sort((a, b) => a.localeCompare(b));

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

function safeMode(value) {
  return Object.hasOwn(FEED_MODES, value) ? value : 'balanced';
}

function currentMode() {
  const mode = document.getElementById('mode');
  return safeMode(mode?.value || localStorage.getItem(MODE_KEY) || 'balanced');
}

function currentDeepCategory() {
  return localStorage.getItem(CATEGORY_KEY) || categories[0] || '';
}

function weightedSample(entries) {
  const valid = entries.filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0);
  const total = valid.reduce((sum, entry) => sum + entry.weight, 0);
  if (!valid.length || total <= 0) return null;
  let cursor = Math.random() * total;
  for (const entry of valid) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.value;
  }
  return valid.at(-1).value;
}

function buildItems(reviews, now) {
  return worms.map((worm) => {
    const id = idFor(worm);
    const review = reviews.get(id) || {};
    const seen = review.seen || 0;
    const dueAt = review.dueAt || 0;
    return {
      worm,
      id,
      themes: themesFor(worm),
      seen,
      dueAt,
      firstSeen: review.firstSeen || 0,
      lastSeen: review.lastSeen || 0,
      isNew: seen === 0,
      isDue: dueAt <= now
    };
  });
}

function buildThemeIndex(items) {
  const index = new Map();
  for (const item of items) {
    for (const theme of item.themes) {
      if (!index.has(theme)) index.set(theme, []);
      index.get(theme).push(item);
    }
  }
  return [...index.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function currentTheme(items = []) {
  const themeSelect = document.getElementById('theme');
  const available = new Set(buildThemeIndex(items).map(([theme]) => theme));
  const stored = localStorage.getItem(THEME_KEY);
  const selected = themeSelect?.value;
  if (selected && available.has(selected)) return selected;
  if (stored && available.has(stored)) return stored;
  return buildThemeIndex(items)[0]?.[0] || 'silence';
}

function buildCategoryStats(items) {
  const stats = Object.fromEntries(categories.map((category) => [category, {
    count: 0,
    seenTotal: 0,
    seenItems: 0,
    dueCount: 0,
    newCount: 0
  }]));

  for (const item of items) {
    const stat = stats[item.worm.category];
    stat.count += 1;
    stat.seenTotal += item.seen;
    if (item.seen > 0) stat.seenItems += 1;
    if (item.isDue) stat.dueCount += 1;
    if (item.isNew) stat.newCount += 1;
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

function chooseCategory(items, stats, mode) {
  if (mode === 'deep-source') return currentDeepCategory();
  if (mode === 'constellation') return null;

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
    return chooseCategory(items, stats, 'balanced');
  }

  return weightedSample(entries) || categories[0];
}

function itemAgeScore(item, now) {
  if (!item.lastSeen) return 2.8;
  const days = (now - item.lastSeen) / DAY;
  return Math.min(3, days / 14);
}

function itemWeight(item, mode, now) {
  let weight = 1;
  if (item.isDue) weight += mode === 'review' ? 9 : 5;
  if (item.isNew && mode !== 'review') weight += mode === 'long-tail' ? 5 : 3.5;
  weight += 2.4 / (item.seen + 1);
  weight += itemAgeScore(item, now);
  if (mode === 'serendipity') weight *= 0.65 + Math.random() * 1.8;
  if (mode === 'deep-source') weight *= item.isNew ? 1.6 : 1;
  const repeatedRecently = sessionHistory.slice(-SESSION_LIMIT).some((entry) => entry.id === item.id);
  if (repeatedRecently) weight *= 0.03;
  return weight;
}

function chooseItem(items, category, mode, now) {
  const categoryItems = items.filter((item) => item.worm.category === category);
  const usable = mode === 'review'
    ? categoryItems.filter((item) => item.isDue)
    : categoryItems;
  const pool = usable.length ? usable : categoryItems;
  const entries = pool.map((item) => ({ value: item, weight: itemWeight(item, mode, now) }));
  return weightedSample(entries) || pool[0] || items[0];
}

function chooseWorm(items, mode, now) {
  const stats = buildCategoryStats(items);
  const category = chooseCategory(items, stats, mode);
  const item = chooseItem(items, category, mode, now);
  return { item, stats, chainMeta: null };
}

function buildThemeChain(items, theme, now) {
  const matching = items.filter((item) => item.themes.includes(theme));
  const selected = [];
  const usedIds = new Set();
  const usedCategories = new Set();
  const target = Math.min(CHAIN_LENGTH, matching.length);

  while (selected.length < target) {
    let pool = matching.filter((item) => !usedIds.has(item.id) && !usedCategories.has(item.worm.category));
    if (!pool.length) pool = matching.filter((item) => !usedIds.has(item.id));
    if (!pool.length) break;

    const pick = weightedSample(pool.map((item) => ({
      value: item,
      weight: itemWeight(item, 'constellation', now) * (usedCategories.has(item.worm.category) ? 0.35 : 1.4)
    }))) || pool[0];

    selected.push(pick);
    usedIds.add(pick.id);
    usedCategories.add(pick.worm.category);
  }

  return {
    theme,
    items: selected.length ? selected : items.slice(0, 1),
    index: 0,
    createdAt: now
  };
}

function nextChainItem(items, theme, now, forceNew = false) {
  const mismatch = !activeChain || activeChain.theme !== theme;
  const exhausted = activeChain && activeChain.index >= activeChain.items.length;
  if (forceNew || mismatch || exhausted) activeChain = buildThemeChain(items, theme, now);

  const index = activeChain.index;
  const item = activeChain.items[index] || activeChain.items[0] || items[0];
  activeChain.index += 1;
  return {
    item,
    chainMeta: {
      theme: activeChain.theme,
      position: index + 1,
      total: activeChain.items.length,
      categories: activeChain.items.map((entry) => entry.worm.category)
    }
  };
}

function reasonFor(item, stats, mode, chainMeta) {
  if (mode === 'constellation' && chainMeta) {
    return `${item.worm.category} · theme chain ${chainMeta.position}/${chainMeta.total} · cross-category constellation`;
  }

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

function show(item, stats, mode, chainMeta = null) {
  const worm = item.worm;
  document.title = worm.category + ' — Thought Worms';
  setText('category', worm.category);
  setText('artifact', worm.artifact);
  setText('english', worm.english);
  setText('spanish', worm.spanish);
  setText('why', reasonFor(item, stats, mode, chainMeta));
  setText('progress', `${FEED_MODES[mode]} · ${categorySummary(stats)}`);

  const themes = item.themes.length ? item.themes : themesFor(worm);
  setText('themes', themes.length ? `themes: ${themes.join(' · ')}` : 'themes: untagged');

  if (mode === 'constellation' && chainMeta) {
    const cats = [...new Set(chainMeta.categories)].join(' → ');
    setText('chain', `chain: ${chainMeta.theme} · ${chainMeta.position}/${chainMeta.total} · ${cats}`);
  } else {
    setText('chain', '');
  }

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

async function pick(options = {}) {
  if (!worms.length) return;
  const mode = currentMode();
  const db = await openDb();
  const now = Date.now();
  const reviews = await getAllReviews(db);
  const items = buildItems(reviews, now);
  const stats = buildCategoryStats(items);
  let item;
  let chainMeta = null;

  if (mode === 'constellation') {
    const theme = currentTheme(items);
    const result = nextChainItem(items, theme, now, options.newChain);
    item = result.item;
    chainMeta = result.chainMeta;
  } else {
    const result = chooseWorm(items, mode, now);
    item = result.item;
  }

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
  show(item, stats, mode, chainMeta);
}

function ensureDynamicControls() {
  const mode = document.getElementById('mode');
  if (mode && !mode.querySelector('option[value="constellation"]')) {
    const option = document.createElement('option');
    option.value = 'constellation';
    option.textContent = 'Constellation';
    mode.insertBefore(option, mode.querySelector('option[value="review"]'));
  }

  const controls = document.querySelector('.controls');
  if (controls && !document.getElementById('theme')) {
    const label = document.createElement('label');
    label.className = 'control';
    label.append('Theme');
    const select = document.createElement('select');
    select.id = 'theme';
    label.append(select);
    const categoryControl = document.getElementById('deepCategory')?.closest('.control');
    controls.insertBefore(label, categoryControl || null);
  }

  const footer = document.querySelector('footer');
  const again = document.getElementById('again');
  if (footer && again && !document.getElementById('newChain')) {
    const button = document.createElement('button');
    button.id = 'newChain';
    button.type = 'button';
    button.textContent = 'New chain';
    button.hidden = true;
    again.before(button);
  }

  const meta = document.querySelector('.meta');
  if (meta && !document.getElementById('chain')) {
    const chain = document.createElement('p');
    chain.id = 'chain';
    chain.className = 'chain themes';
    meta.append(chain);
  }
}

function populateThemeSelect(items) {
  const theme = document.getElementById('theme');
  if (!theme) return;
  const entries = buildThemeIndex(items);
  theme.innerHTML = entries
    .map(([name, themedItems]) => `<option value="${name.replaceAll('"', '&quot;')}">${name} (${themedItems.length})</option>`)
    .join('');
  const stored = localStorage.getItem(THEME_KEY);
  theme.value = stored && entries.some(([name]) => name === stored) ? stored : entries[0]?.[0] || '';
}

function updateModeUi() {
  const mode = currentMode();
  const newChain = document.getElementById('newChain');
  if (newChain) newChain.hidden = mode !== 'constellation';
}

async function setupControls() {
  ensureDynamicControls();
  const db = await openDb();
  const reviews = await getAllReviews(db);
  const items = buildItems(reviews, Date.now());

  const mode = document.getElementById('mode');
  const deepCategory = document.getElementById('deepCategory');
  const theme = document.getElementById('theme');

  populateThemeSelect(items);

  if (mode) {
    mode.value = safeMode(localStorage.getItem(MODE_KEY) || 'balanced');
    mode.addEventListener('change', () => {
      localStorage.setItem(MODE_KEY, safeMode(mode.value));
      activeChain = null;
      updateModeUi();
      pick();
    });
  }

  if (theme) {
    theme.addEventListener('change', () => {
      localStorage.setItem(THEME_KEY, theme.value);
      activeChain = null;
      if (currentMode() === 'constellation') pick({ newChain: true });
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

  const newChain = document.getElementById('newChain');
  if (newChain) newChain.addEventListener('click', () => pick({ newChain: true }));

  updateModeUi();
}

setupControls().then(() => pick());
document.getElementById('again').addEventListener('click', () => pick());
