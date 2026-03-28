import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const STORAGE_KEY = 'onebaseplate_households';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures', 'households');
const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
const households = files.map((f) => JSON.parse(readFileSync(join(fixturesDir, f), 'utf-8')));

const output = JSON.stringify(households);
console.log(`Seed data for key "${STORAGE_KEY}" (logical households payload):`);
console.log(output);
console.log(`\nLoaded ${households.length} household(s) from fixtures.`);
console.log('This JSON is bundled as src/seed-data.json for first-run bootstrap.');
console.log(
  'To refresh seed-data.json, run: npm run seed > tmp.json && mv tmp.json src/seed-data.json (or merge manually).',
);
console.log('\nTo load fixtures into a running dev app without rebuilding:');
console.log('Use Settings → Import JSON, or paste the JSON array into the import flow.');
console.log(
  "(Households are stored in IndexedDB Dexie DB 'onebaseplate_app', meta key 'households' — not localStorage.)",
);
