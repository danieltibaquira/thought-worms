import { readJson, writeJson, validateNoDuplicateContent } from './pipeline-lib.mjs';

const idsArg = process.argv[2];
if (!idsArg) {
  console.error('Usage: node scripts/promote-candidates.mjs <id,id,...|all-verified>');
  process.exit(1);
}

const candidates = readJson('data/artifacts.candidates.json', []);
const rejected = readJson('data/artifacts.rejected.json', []);
const selected = idsArg === 'all-verified'
  ? candidates.filter((row) => row.status === 'verified')
  : candidates.filter((row) => idsArg.split(',').map((id) => id.trim()).includes(row.id));

if (!selected.length) {
  console.error('No candidates selected for promotion.');
  process.exit(1);
}

for (const row of selected) {
  if (row.status !== 'verified') {
    console.error(`Candidate ${row.id} is not verified.`);
    process.exit(1);
  }
}

validateNoDuplicateContent(selected, 'selected candidates');

const remaining = candidates.filter((row) => !selected.some((selectedRow) => selectedRow.id === row.id));
const archived = rejected.concat(remaining.filter((row) => row.status === 'rejected'));
const nextCandidates = remaining.filter((row) => row.status !== 'rejected');

writeJson('data/artifacts.promoted.json', selected);
writeJson('data/artifacts.candidates.json', nextCandidates);
writeJson('data/artifacts.rejected.json', archived);

console.log(`Promoted ${selected.length} candidates into data/artifacts.promoted.json.`);
console.log('Review promoted artifacts, merge into live corpus, then clear promoted file.');
