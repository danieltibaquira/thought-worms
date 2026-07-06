import { readJson, writeJson } from './pipeline-lib.mjs';

const targetsPath = process.argv[2] || 'data/source-crawl-targets.json';
const reportPath = process.argv[3] || 'data/source-crawl-report.json';
const targets = readJson(targetsPath, []);
const now = new Date().toISOString();

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromHtml(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 180) : '';
}

function termHits(text, terms = []) {
  const haystack = text.toLowerCase();
  return terms
    .map((term) => String(term || '').toLowerCase())
    .filter((term) => term && haystack.includes(term));
}

function sampleWindows(text, terms = [], limit = 8) {
  const haystack = text.toLowerCase();
  const windows = [];
  for (const term of terms) {
    const needle = String(term || '').toLowerCase();
    if (!needle) continue;
    const index = haystack.indexOf(needle);
    if (index === -1) continue;
    const start = Math.max(0, index - 90);
    const end = Math.min(text.length, index + needle.length + 90);
    windows.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
    if (windows.length >= limit) break;
  }
  return windows;
}

async function crawlTarget(target) {
  if (!target.url || target.mode === 'source-discovery-only') {
    return {
      sourceId: target.sourceId,
      title: target.title,
      category: target.category,
      url: target.url,
      mode: target.mode,
      status: 'not-fetched-discovery-only',
      fetchedAt: now,
      candidateLimit: target.extract?.candidateLimit || 0,
      safety: target.safety || {}
    };
  }

  try {
    const response = await fetch(target.url, {
      headers: {
        'user-agent': 'thought-worms-source-crawler/1.0 (+https://github.com/danieltibaquira/thought-worms)'
      }
    });
    const html = await response.text();
    const text = stripHtml(html);
    const preferredThemes = target.extract?.preferredThemes || [];
    const hits = termHits(text, preferredThemes);
    return {
      sourceId: target.sourceId,
      title: target.title,
      pageTitle: titleFromHtml(html),
      category: target.category,
      url: target.url,
      mode: target.mode,
      status: response.ok ? 'available' : `http-${response.status}`,
      httpStatus: response.status,
      fetchedAt: now,
      charCount: text.length,
      preferredThemeHits: hits,
      sampleWindows: sampleWindows(text, preferredThemes),
      candidateLimit: target.extract?.candidateLimit || 0,
      safety: target.safety || {}
    };
  } catch (error) {
    return {
      sourceId: target.sourceId,
      title: target.title,
      category: target.category,
      url: target.url,
      mode: target.mode,
      status: 'fetch-error',
      fetchedAt: now,
      error: error.message,
      candidateLimit: target.extract?.candidateLimit || 0,
      safety: target.safety || {}
    };
  }
}

const results = [];
for (const target of targets) {
  results.push(await crawlTarget(target));
}

const report = {
  generatedAt: now,
  targetCount: targets.length,
  availableCount: results.filter((result) => result.status === 'available').length,
  discoveryOnlyCount: results.filter((result) => result.status === 'not-fetched-discovery-only').length,
  results
};

writeJson(reportPath, report);
console.log(`wrote ${reportPath}`);
console.table(results.map((result) => ({
  sourceId: result.sourceId,
  status: result.status,
  chars: result.charCount || 0,
  hits: (result.preferredThemeHits || []).join(', ')
})));
