/**
 * Print heuristic duplicate-ingredient pairs from a household JSON fixture/export.
 *
 * Usage:
 *   npx tsx scripts/suggest-ingredient-merge-pairs.ts fixtures/households/H001-mcg.json
 *   npx tsx scripts/suggest-ingredient-merge-pairs.ts path/to/household.json --min-score 0.6
 */
import { readFileSync } from 'fs';
import type { Ingredient } from '../src/types';
import { suggestIngredientMergePairs } from '../src/lib/suggestIngredientMergePairs';

function toSentenceCase(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseArgs(argv: string[]) {
  const paths: string[] = [];
  let minScore = 0.55;
  let limit = 200;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--min-score' && argv[i + 1]) {
      minScore = Number(argv[++i]);
    } else if (a === '--limit' && argv[i + 1]) {
      limit = Number(argv[++i]);
    } else if (!a.startsWith('-')) {
      paths.push(a);
    }
  }
  return { path: paths[0], minScore, limit };
}

const { path, minScore, limit } = parseArgs(process.argv);

if (!path) {
  console.error(
    'Usage: npx tsx scripts/suggest-ingredient-merge-pairs.ts <household.json> [--min-score 0.55] [--limit 200]',
  );
  process.exit(1);
}

if (Number.isNaN(minScore) || Number.isNaN(limit)) {
  console.error('Invalid --min-score or --limit');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, 'utf-8')) as { ingredients?: Ingredient[] };
const ingredients = raw.ingredients;
if (!Array.isArray(ingredients)) {
  console.error('Expected JSON object with an "ingredients" array.');
  process.exit(1);
}

const pairs = suggestIngredientMergePairs(ingredients, { minScore, limit });

console.log(`# Suggested merge pairs (${pairs.length}) — minScore=${minScore}, file=${path}\n`);
console.log('| Score | A | B | Reasons |');
console.log('| ---: | --- | --- | --- |');

for (const p of pairs) {
  const ra = toSentenceCase(p.ingredientA.name);
  const rb = toSentenceCase(p.ingredientB.name);
  const reasons = p.reasons.join('; ').replace(/\|/g, '\\|');
  console.log(`| ${p.score.toFixed(2)} | ${ra} | ${rb} | ${reasons} |`);
}

if (pairs.length === 0) {
  console.log('\n_No pairs met the threshold._');
}
