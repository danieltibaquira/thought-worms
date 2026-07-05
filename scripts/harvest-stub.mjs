import fs from 'node:fs';

const sourceId = process.argv[2];
const limit = Number(process.argv[3] || 25);
const sources = JSON.parse(fs.readFileSync('data/sources.json', 'utf8'));
const source = sources.find((item) => item.id === sourceId);

if (!source) {
  console.error(`Unknown source id: ${sourceId || '(missing)'}`);
  console.error('Available source ids:');
  for (const item of sources) console.error(`- ${item.id}`);
  process.exit(1);
}

const candidates = JSON.parse(fs.readFileSync('data/artifacts.candidates.json', 'utf8'));
const batch = {
  sourceId: source.id,
  category: source.category,
  url: source.url,
  limit,
  createdAt: new Date().toISOString(),
  status: 'needs-agent-review',
  instruction: 'Use the Codex curation role to harvest short, source-grounded contemplative artifacts from this registered source. Do not publish rows directly; add candidates only.'
};

candidates.push(batch);
fs.writeFileSync('data/artifacts.candidates.json', JSON.stringify(candidates, null, 2) + '\n');
console.log(`Queued candidate harvest batch for ${source.id}`);
