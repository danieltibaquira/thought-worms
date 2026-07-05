import { readJson } from './pipeline-lib.mjs';
import fs from 'node:fs';

const rows = readJson('data/artifacts.verified.json', []);
if (!Array.isArray(rows) || rows.length === 0) {
  console.error('No verified artifacts found in data/artifacts.verified.json');
  process.exit(1);
}

const publicRows = rows.map(({ id, sourceId, status, ...row }) => row);
const content = `window.THOUGHT_WORMS = ${JSON.stringify(publicRows, null, 2)};\n`;
fs.writeFileSync('extra-worms-001.js', content);
console.log(`Built extra-worms-001.js from ${rows.length} verified artifacts.`);
