import type { Ingredient } from '../types';
import { normalizeIngredientName, normalizeIngredientGroupKey } from './ingredientNameNormalize';

export type IngredientMergePairSuggestion = {
  ingredientA: Ingredient;
  ingredientB: Ingredient;
  score: number;
  reasons: string[];
};

/** Low-information words removed from group-key tokens before comparing. */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'and',
  'or',
  'with',
  'for',
  'to',
  'optional',
  'about',
  'approx',
  'approximately',
  'handful',
  'pinch',
  'dash',
  'cup',
  'cups',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'oz',
  'lb',
  'g',
  'kg',
  'ml',
  'l',
  'whole',
  'fresh',
  'dried',
  'frozen',
  'chopped',
  'sliced',
  'diced',
  'minced',
  'grated',
  'shredded',
  'ground',
  'large',
  'small',
  'medium',
  'bunch',
  'sprig',
  'sprigs',
  'stalk',
  'stalks',
  'piece',
  'pieces',
  'packet',
  'pack',
  'can',
  'tin',
  'leaves',
  'leaf',
]);

const UNICODE_FRACTION_CHARS = /^[¼½¾⅓⅔⅛⅜⅝⅞]+$/;

function isNumericLikeToken(t: string): boolean {
  if (/^\d+(\.\d+)?$/.test(t)) return true;
  if (/^\d+\/\d+$/.test(t)) return true;
  return UNICODE_FRACTION_CHARS.test(t);
}

function coreTokens(name: string): string[] {
  const key = normalizeIngredientGroupKey(name);
  return key
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOPWORDS.has(t) && !isNumericLikeToken(t));
}

function aliasNormSet(ing: Ingredient): Set<string> {
  const s = new Set<string>();
  for (const a of ing.aliases ?? []) {
    const n = normalizeIngredientName(a);
    if (n) s.add(n);
  }
  return s;
}

/** True when names differ but one canonical name is already stored as the other's alias. */
export function ingredientsAlreadyLinkedAsNameAlias(a: Ingredient, b: Ingredient): boolean {
  const na = normalizeIngredientName(a.name);
  const nb = normalizeIngredientName(b.name);
  if (!na || !nb) return false;
  return aliasNormSet(a).has(nb) || aliasNormSet(b).has(na);
}

function scorePair(a: Ingredient, b: Ingredient): { score: number; reasons: string[] } | null {
  if (a.id === b.id) return null;
  if (ingredientsAlreadyLinkedAsNameAlias(a, b)) return null;

  const na = normalizeIngredientName(a.name);
  const nb = normalizeIngredientName(b.name);
  if (!na || !nb) return null;

  if (na === nb) {
    return { score: 1, reasons: ['Same normalized name (likely duplicate rows)'] };
  }

  const Ta = new Set(coreTokens(a.name));
  const Tb = new Set(coreTokens(b.name));

  let score = 0;
  const reasons: string[] = [];

  if (Ta.size > 0 && Tb.size > 0) {
    const intersection = new Set([...Ta].filter((t) => Tb.has(t)));
    const union = new Set<string>([...Ta, ...Tb]);
    const jaccard = union.size === 0 ? 0 : intersection.size / union.size;

    const smaller = Ta.size <= Tb.size ? Ta : Tb;
    const larger = Ta.size <= Tb.size ? Tb : Ta;
    const strictSubset =
      smaller.size >= 1 &&
      smaller.size < larger.size &&
      [...smaller].every((t) => larger.has(t));

    score = jaccard;
    if (jaccard >= 0.45) {
      reasons.push(`Shared words (Jaccard ${jaccard.toFixed(2)})`);
    }

    if (strictSubset) {
      const single = smaller.size === 1 ? [...smaller][0]! : '';
      const allowSingleTokenBoost =
        smaller.size > 1 || single.length >= 4 || larger.size <= 2;
      if (allowSingleTokenBoost) {
        const subsetScore = 0.75 + 0.2 * (intersection.size / larger.size);
        if (subsetScore > score) {
          score = subsetScore;
          reasons.push('One name is the other plus extra descriptors');
        }
      }
    }

    if (Ta.size === Tb.size && jaccard === 1) {
      score = Math.max(score, 0.93);
      if (!reasons.some((r) => r.includes('Jaccard'))) {
        reasons.push('Same core words after normalization');
      }
    }
  }

  if (score < 0.5 && (na.includes(nb) || nb.includes(na))) {
    const longer = na.length >= nb.length ? na : nb;
    const shorter = na.length >= nb.length ? nb : na;
    if (shorter.length >= 3) {
      const boundary =
        longer === shorter ||
        longer.startsWith(`${shorter} `) ||
        longer.endsWith(` ${shorter}`) ||
        longer.includes(` ${shorter} `);
      if (boundary) {
        score = Math.max(score, 0.62);
        reasons.push('One full name appears inside the other');
      }
    }
  }

  return { score, reasons: [...new Set(reasons)] };
}

function orderPair(a: Ingredient, b: Ingredient): [Ingredient, Ingredient] {
  const cmp = normalizeIngredientName(a.name).localeCompare(normalizeIngredientName(b.name));
  if (cmp <= 0) return [a, b];
  return [b, a];
}

/**
 * Heuristic duplicate candidates for merging household ingredients (e.g. “mint” vs “handful of mint leaves”).
 * Always review before merging — scores are fuzzy.
 */
export function suggestIngredientMergePairs(
  ingredients: Ingredient[],
  opts?: { minScore?: number; limit?: number },
): IngredientMergePairSuggestion[] {
  const minScore = opts?.minScore ?? 0.55;
  const limit = opts?.limit ?? 200;

  const out: IngredientMergePairSuggestion[] = [];
  const list = ingredients.filter((i) => normalizeIngredientName(i.name));

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const raw = scorePair(list[i]!, list[j]!);
      if (!raw || raw.score < minScore) continue;
      const [ingredientA, ingredientB] = orderPair(list[i]!, list[j]!);
      out.push({
        ingredientA,
        ingredientB,
        score: raw.score,
        reasons: raw.reasons.length > 0 ? raw.reasons : ['Heuristic similarity'],
      });
    }
  }

  out.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    const ax = normalizeIngredientName(x.ingredientA.name);
    const bx = normalizeIngredientName(y.ingredientA.name);
    return ax.localeCompare(bx);
  });

  return out.slice(0, limit);
}
