import { readJson, writeJson, validateNoDuplicateContent } from './pipeline-lib.mjs';
import { execFileSync } from 'node:child_process';

const idsArg = process.argv[2];
if (!idsArg) {
  console.error('Usage: node scripts/promote-candidates.mjs <id,id,...|all-verified>');
  process.exit(1);
}

const verified = readJson('data/artifacts.verified.json', []);
const candidates = readJson('data/artifacts.candidates.json', []);
const rejected = readJson('data/artifacts.rejected.json', []);
const requestedIds = idsArg.split(',').map((id) => id.trim()).filter(Boolean);
const selected = idsArg === 'all-verified'
  ? candidates.filter((row) => row.status === 'verified')
  : candidates.filter((row) => requestedIds.includes(row.id));

if (!selected.length) {
  writeJson('data/artifacts.promoted.json', []);
  execFileSync('node', ['scripts/build-live-corpus.mjs'], { stdio: 'inherit' });
  console.log('No verified candidates to promote. Live corpus rebuilt from verified artifacts.');
  process.exit(0);
}

for (const row of selected) {
  if (row.status !== 'verified') {
    console.error(`Candidate ${row.id} is not verified.`);
    process.exit(1);
  }
}

const nextVerified = verified.concat(selected);
validateNoDuplicateContent(nextVerified, 'verified+candidates');

const selectedIds = new Set(selected.map((row) => row.id));
const remaining = candidates.filter((row) => !selectedIds.has(row.id));
const archived = rejected.concat(remaining.filter((row) => row.status === 'rejected'));
const nextCandidates = remaining.filter((row) => row.status !== 'rejected');

writeJson('data/artifacts.verified.json', nextVerified);
writeJson('data/artifacts.promoted.json', selected);
writeJson('data/artifacts.candidates.json', nextCandidates);
writeJson('data/artifacts.rejected.json', archived);

execFileSync('node', ['scripts/build-live-corpus.mjs'], { stdio: 'inherit' });
console.log(`Promoted ${selected.length} candidates into verified corpus.`);
