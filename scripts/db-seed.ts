import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures', 'households');
const outputPath = join(import.meta.dirname, '..', 'src', 'seed-data.json');

const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
const households = files.map((f) => JSON.parse(readFileSync(join(fixturesDir, f), 'utf-8')));

writeFileSync(outputPath, JSON.stringify(households, null, 2));
console.log(`Wrote ${households.length} household(s) to ${outputPath}`);
