import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('extra-worms-001.js', 'utf8'), sandbox, { filename: 'extra-worms-001.js' });

const rows = sandbox.window.THOUGHT_WORMS || [];
const counts = rows.reduce((acc, row) => {
  acc[row.category] = (acc[row.category] || 0) + 1;
  return acc;
}, {});

const sourceRegistry = JSON.parse(fs.readFileSync('data/sources.json', 'utf8'));
const candidates = JSON.parse(fs.readFileSync('data/artifacts.candidates.json', 'utf8'));
const rejected = JSON.parse(fs.readFileSync('data/artifacts.rejected.json', 'utf8'));

const lines = [];
lines.push('# Thought Worms Corpus Report');
lines.push('');
lines.push(`Verified rows: ${rows.length}`);
lines.push(`Registered sources: ${sourceRegistry.length}`);
lines.push(`Candidate rows: ${candidates.length}`);
lines.push(`Rejected rows: ${rejected.length}`);
lines.push('');
lines.push('## Category counts');
lines.push('');
lines.push('| Category | Count |');
lines.push('|---|---:|');
for (const [category, count] of Object.entries(counts).sort()) {
  lines.push(`| ${category} | ${count} |`);
}
lines.push('');
lines.push('## Source registry');
lines.push('');
lines.push('| ID | Category | Priority | URL |');
lines.push('|---|---|---|---|');
for (const source of sourceRegistry) {
  lines.push(`| ${source.id} | ${source.category} | ${source.priority} | ${source.url} |`);
}

const output = lines.join('\n');
fs.writeFileSync('corpus-report.md', output + '\n');
console.log(output);
