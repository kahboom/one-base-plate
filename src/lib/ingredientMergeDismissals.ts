import type { Ingredient } from '../types';
import { normalizeIngredientName } from './ingredientNameNormalize';

const STORAGE_PREFIX = 'onebaseplate_merge_dismiss_v1:';

/** Stable id-only key for a pair (order-independent). */
export function mergePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}\x1f${idB}` : `${idB}\x1f${idA}`;
}

export function loadDismissedMergePairKeys(householdId: string): Set<string> {
  if (!householdId || typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + householdId);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function addDismissedMergePairKeys(householdId: string, keys: Iterable<string>): void {
  if (!householdId || typeof localStorage === 'undefined') return;
  const cur = loadDismissedMergePairKeys(householdId);
  for (const k of keys) {
    if (k) cur.add(k);
  }
  localStorage.setItem(STORAGE_PREFIX + householdId, JSON.stringify([...cur].sort()));
}

/**
 * Pick which row survives when auto-merging: catalog-backed beats manual, then more references,
 * then lexicographically earlier canonical name.
 */
export function pickMergeSurvivorHeuristic(
  a: Ingredient,
  b: Ingredient,
  refCountA: number,
  refCountB: number,
): { survivor: Ingredient; absorbed: Ingredient } {
  const aCat = !!a.catalogId;
  const bCat = !!b.catalogId;
  if (aCat !== bCat) {
    return aCat ? { survivor: a, absorbed: b } : { survivor: b, absorbed: a };
  }
  if (refCountA !== refCountB) {
    return refCountA > refCountB ? { survivor: a, absorbed: b } : { survivor: b, absorbed: a };
  }
  const na = normalizeIngredientName(a.name);
  const nb = normalizeIngredientName(b.name);
  return na <= nb ? { survivor: a, absorbed: b } : { survivor: b, absorbed: a };
}
