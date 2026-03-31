import { normalizePaprikaCategory } from './paprikaCategoryMap';
import { CURATED_RECIPE_TAGS, normalizeRecipeTagForCurated, recipeTagLabel } from './recipeTags';
import type { Household } from '../types';

export interface TagCandidate {
  value: string;
  label: string;
}

function normWords(s: string): string {
  return s.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normWords(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev + cost, row[j]! + 1, row[j - 1]! + 1);
      prev = cur;
    }
  }
  return row[n]!;
}

/**
 * Fuzzy similarity in [0, 1] between a Paprika category label and a tag (value and/or display label).
 */
export function scorePaprikaCategoryToTag(
  paprikaCategory: string,
  candidate: TagCandidate,
): number {
  const q = normWords(paprikaCategory);
  if (!q) return 0;

  const valueNorm = normWords(candidate.value);
  const labelNorm = normWords(candidate.label);

  const against = [valueNorm, labelNorm, normWords(candidate.value.replace(/-/g, ' '))];
  let best = 0;

  for (const candStr of against) {
    if (!candStr) continue;
    if (q === candStr) {
      best = 1;
      break;
    }
    if (q.includes(candStr) || candStr.includes(q)) {
      const shorter = Math.min(q.length, candStr.length);
      const longer = Math.max(q.length, candStr.length);
      const containment = shorter / Math.max(longer, 1);
      best = Math.max(best, 0.72 + 0.2 * containment);
    }

    const maxLen = Math.max(q.length, candStr.length);
    if (maxLen > 0) {
      const dist = levenshtein(q, candStr);
      best = Math.max(best, 1 - dist / maxLen);
    }

    const tq = new Set(tokenize(paprikaCategory));
    const tc = new Set(tokenize(candidate.value).concat(tokenize(candidate.label)));
    let inter = 0;
    for (const t of tq) {
      if (tc.has(t)) inter += 1;
    }
    const union = tq.size + tc.size - inter;
    if (union > 0) {
      best = Math.max(best, (inter / union) * 0.98);
    }
  }

  // Single-edit matches on 4+ character tokens (e.g. "quik" ↔ "quick")
  const qt = tokenize(paprikaCategory);
  const vt = new Set([...tokenize(candidate.value), ...tokenize(candidate.label)]);
  for (const a of qt) {
    if (a.length < 4) continue;
    for (const b of vt) {
      if (b.length < 4) continue;
      const maxL = Math.max(a.length, b.length);
      if (levenshtein(a, b) === 1) {
        best = Math.max(best, 0.42 + 0.12 * (Math.min(a.length, b.length) / maxL));
      }
    }
  }

  return Math.min(1, best);
}

export function householdRecipeTagCandidates(
  household: Pick<Household, 'recipes' | 'baseMeals'>,
): TagCandidate[] {
  const byValue = new Map<string, TagCandidate>();
  for (const t of CURATED_RECIPE_TAGS) {
    byValue.set(t.value, { value: t.value, label: t.label });
  }
  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const v = normalizeRecipeTagForCurated(trimmed.toLowerCase());
    if (!v) return;
    if (!byValue.has(v)) {
      byValue.set(v, { value: v, label: recipeTagLabel(v) });
    }
  };
  for (const r of household.recipes ?? []) {
    for (const t of r.tags ?? []) add(t);
  }
  for (const m of household.baseMeals ?? []) {
    for (const t of m.tags ?? []) add(t);
  }
  return [...byValue.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}

export interface RankedTagMatch {
  candidate: TagCandidate;
  score: number;
}

export function rankPaprikaCategoryTagMatches(
  paprikaCategory: string,
  candidates: readonly TagCandidate[],
  limit = 8,
): RankedTagMatch[] {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scorePaprikaCategoryToTag(paprikaCategory, candidate),
    }))
    .filter((x) => x.score >= 0.32)
    .sort((a, b) => b.score - a.score || a.candidate.label.localeCompare(b.candidate.label));
  return ranked.slice(0, limit);
}

export interface PaprikaCategoryRow {
  /** Stable key for lookups (same as {@link normalizePaprikaCategory} on a representative raw string). */
  normalizeKey: string;
  /** First non-empty raw string seen for this key (display only). */
  displayLabel: string;
  /** Number of imported recipes that include this category (at least once). */
  recipeCount: number;
}

/**
 * Unique Paprika `rawCategories` entries across imported recipes, deduped by normalized key.
 */
export function collectPaprikaCategoryRows(
  importedRecipes: readonly { id: string; provenance?: { rawCategories?: string[] } }[],
): PaprikaCategoryRow[] {
  const recipeCountByKey = new Map<string, Set<string>>();
  const displayByKey = new Map<string, string>();

  for (const r of importedRecipes) {
    const raw = r.provenance?.rawCategories;
    if (!raw?.length) continue;
    const seenInRecipe = new Set<string>();
    for (const c of raw) {
      const t = c.trim();
      if (!t) continue;
      const key = normalizePaprikaCategory(c);
      if (!key) continue;
      if (seenInRecipe.has(key)) continue;
      seenInRecipe.add(key);
      if (!displayByKey.has(key)) displayByKey.set(key, t);
      let set = recipeCountByKey.get(key);
      if (!set) {
        set = new Set();
        recipeCountByKey.set(key, set);
      }
      set.add(r.id);
    }
  }

  return [...recipeCountByKey.entries()]
    .map(([normalizeKey, idSet]) => ({
      normalizeKey,
      displayLabel: displayByKey.get(normalizeKey) ?? normalizeKey,
      recipeCount: idSet.size,
    }))
    .sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: 'base' }),
    );
}

/** Normalize user-typed tag text to a stored recipe tag slug. */
export function normalizeNewRecipeTagFromUser(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[''`]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
