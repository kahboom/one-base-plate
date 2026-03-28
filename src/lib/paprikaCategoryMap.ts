import { isCuratedTag } from './recipeTags';

/**
 * Normalize a Paprika category string for lookup: lowercase, trim, collapse whitespace,
 * strip trivial edge punctuation, then conservative English singular forms.
 */
export function normalizePaprikaCategory(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/^[,.;:\s]+|[,.;:\s]+$/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return singularizeCategoryKey(s);
}

/** Keys are normalized category strings; values are curated recipe tag values. */
export const PAPRIKA_CATEGORY_TAG_MAP: Readonly<Record<string, string>> = {
  soup: 'soup',
  soups: 'soup',
  salad: 'salad',
  salads: 'salad',
  snack: 'snack',
  snacks: 'snack',
  bread: 'bread',
  breads: 'bread',
  seafood: 'seafood',
  sauce: 'sauce',
  sauces: 'sauce',
  quick: 'quick',
  'quick dinner': 'quick',
  'quick dinners': 'quick',
  freezer: 'freezer-friendly',
  'freezer meal': 'freezer-friendly',
  'freezer meals': 'freezer-friendly',
  rescue: 'rescue',
  emergency: 'rescue',
  fallback: 'rescue',
  'kid friendly': 'kid-friendly',
  'kid-friendly': 'kid-friendly',
  kids: 'kid-friendly',
  'prep ahead': 'prep-ahead',
  'make ahead': 'prep-ahead',
  'batch cooking': 'batch-prep',
  'batch prep': 'batch-prep',
  'batch-prep': 'batch-prep',
  side: 'side',
  'side dish': 'side',
  'side dishes': 'side',
} as const;

function singularizeCategoryKey(s: string): string {
  if (!s) return s;
  /** No blanket -ies→y (would corrupt e.g. "cookies"); explicit map entries cover common plurals. */
  if (s.length >= 5 && s.endsWith('es')) {
    if (/(ches|shes|xes|zes|sses)$/.test(s)) {
      return s.slice(0, -2);
    }
  }
  if (
    s.length > 3 &&
    s.endsWith('s') &&
    !s.endsWith('ss') &&
    !s.endsWith('us') &&
    !s.endsWith('is')
  ) {
    return s.slice(0, -1);
  }
  return s;
}

/** Try map lookup on the string and on a few singular/plural variants (idempotent). */
function lookupCategoryToTag(normalized: string): string | undefined {
  const direct = PAPRIKA_CATEGORY_TAG_MAP[normalized];
  if (direct !== undefined) return direct;

  const singular = singularizeCategoryKey(normalized);
  if (singular !== normalized) {
    const fromSingular = PAPRIKA_CATEGORY_TAG_MAP[singular];
    if (fromSingular !== undefined) return fromSingular;
  }

  const plural = normalized + 's';
  const fromPlural = PAPRIKA_CATEGORY_TAG_MAP[plural];
  if (fromPlural !== undefined) return fromPlural;

  return undefined;
}

export interface PaprikaCategoryMapResult {
  /** Curated recipe tags, deduped, stable order (first occurrence wins). */
  tags: string[];
  /** Original non-empty category strings from the export, in order (provenance). */
  rawCategories: string[];
  /** Non-empty categories that did not map to a curated tag. */
  unmappedCount: number;
}

/**
 * Map Paprika `categories` to curated `Recipe.tags` where aliases match.
 * Unmapped strings are not discarded; they appear only in `rawCategories`.
 */
export function mapPaprikaCategories(categories: string[]): PaprikaCategoryMapResult {
  const rawCategories: string[] = [];
  for (const c of categories) {
    const t = c.trim();
    if (t.length > 0) rawCategories.push(c);
  }

  const tagOrder: string[] = [];
  const seen = new Set<string>();
  let unmappedCount = 0;

  for (const original of rawCategories) {
    const normalized = normalizePaprikaCategory(original);
    const tag = normalized ? lookupCategoryToTag(normalized) : undefined;
    if (tag && isCuratedTag(tag)) {
      if (!seen.has(tag)) {
        seen.add(tag);
        tagOrder.push(tag);
      }
    } else {
      unmappedCount += 1;
    }
  }

  return { tags: tagOrder, rawCategories, unmappedCount };
}
