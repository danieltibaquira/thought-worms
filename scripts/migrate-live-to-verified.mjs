import { loadLiveRows, writeJson } from './pipeline-lib.mjs';

function slug(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const rows = loadLiveRows().map((row) => ({
  id: row.id || `${slug(row.category)}-${slug(row.artifact)}`,
  sourceId: row.sourceId || 'legacy-curated',
  status: row.status || 'verified',
  ...row
}));

writeJson('data/artifacts.verified.json', rows);
console.log(`Migrated ${rows.length} live artifacts into data/artifacts.verified.json`);
