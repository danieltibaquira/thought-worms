import fs from 'node:fs';
import path from 'node:path';
import {
  readJson,
  writeJson,
  normalizeText,
  assertValidArtifact
} from './pipeline-lib.mjs';

const batchDir = 'data/candidate-batches';
const sources = readJson('data/sources.json', []);
const verified = readJson('data/artifacts.verified.json', []);
const candidates = readJson('data/artifacts.candidates.json', []);
const rejected = readJson('data/artifacts.rejected.json', []);
const sourcesById = new Map(sources.map((source) => [source.id, source]));

function batchFiles() {
  if (!fs.existsSync(batchDir)) return [];
  return fs.readdirSync(batchDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(batchDir, name));
}

function sameRow(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function withRejectReason(row, reason) {
  return {
    ...row,
    status: 'rejected',
    notes: `${row.notes || ''} Auto-rejected during batch consolidation: ${reason}.`.trim()
  };
}

const loadedBatchRows = [];
for (const file of batchFiles()) {
  const rows = readJson(file, []);
  if (!Array.isArray(rows)) throw new Error(`${file} must contain an array`);
  for (const [index, row] of rows.entries()) {
    assertValidArtifact(row, index, sourcesById, { requireVerified: false });
    loadedBatchRows.push(row);
  }
}

for (const [index, row] of candidates.entries()) {
  assertValidArtifact(row, index, sourcesById, { requireVerified: false });
}
for (const [index, row] of verified.entries()) {
  assertValidArtifact(row, index, sourcesById, { requireVerified: true });
}

const accepted = [];
const nextRejected = [...rejected];
const seenIds = new Map();
const contentMaps = {
  artifact: new Map(),
  original: new Map(),
  english: new Map(),
  spanish: new Map()
};

function seedExistingVerified() {
  for (const row of verified) {
    seenIds.set(row.id, row);
    for (const key of Object.keys(contentMaps)) {
      const normalized = normalizeText(row[key]);
      if (normalized) contentMaps[key].set(normalized, row);
    }
  }
}

function consider(row) {
  const seenById = seenIds.get(row.id);
  if (seenById) {
    if (sameRow(seenById, row)) return;
    nextRejected.push(withRejectReason(row, `duplicate id with ${seenById.artifact}`));
    return;
  }

  for (const key of Object.keys(contentMaps)) {
    const normalized = normalizeText(row[key]);
    if (!normalized) continue;
    const duplicate = contentMaps[key].get(normalized);
    if (duplicate) {
      nextRejected.push(withRejectReason(row, `duplicate ${key} with ${duplicate.artifact}`));
      return;
    }
  }

  accepted.push(row);
  seenIds.set(row.id, row);
  for (const key of Object.keys(contentMaps)) {
    const normalized = normalizeText(row[key]);
    if (normalized) contentMaps[key].set(normalized, row);
  }
}

seedExistingVerified();
for (const row of candidates) consider(row);
for (const row of loadedBatchRows) consider(row);

writeJson('data/artifacts.candidates.json', accepted);
writeJson('data/artifacts.rejected.json', nextRejected);

console.log(`Consolidated ${loadedBatchRows.length} batch rows plus ${candidates.length} existing candidates.`);
console.log(`Accepted candidates: ${accepted.length}`);
console.log(`Rejected rows total: ${nextRejected.length}`);
