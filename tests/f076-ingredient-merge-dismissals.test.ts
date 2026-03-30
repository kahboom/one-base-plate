import { describe, it, expect, beforeEach } from 'vitest';
import type { Ingredient } from '../src/types';
import {
  mergePairKey,
  loadDismissedMergePairKeys,
  addDismissedMergePairKeys,
  pickMergeSurvivorHeuristic,
} from '../src/lib/ingredientMergeDismissals';

const H = 'test-household-dismiss';

function ing(p: Partial<Ingredient> & { id: string; name: string }): Ingredient {
  return {
    category: 'pantry',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
    ...p,
  };
}

describe('ingredientMergeDismissals', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mergePairKey is stable regardless of argument order', () => {
    expect(mergePairKey('b', 'a')).toBe(mergePairKey('a', 'b'));
  });

  it('persists dismissed keys per household', () => {
    expect(loadDismissedMergePairKeys(H).size).toBe(0);
    const k = mergePairKey('i1', 'i2');
    addDismissedMergePairKeys(H, [k]);
    expect(loadDismissedMergePairKeys(H).has(k)).toBe(true);
  });

  it('pickMergeSurvivorHeuristic prefers catalog-backed ingredient', () => {
    const manual = ing({ id: 'm', name: 'garlic' });
    const cat = ing({ id: 'c', name: 'garlic', catalogId: 'cat-x', source: 'catalog' });
    const r = pickMergeSurvivorHeuristic(manual, cat, 5, 0);
    expect(r.survivor.id).toBe('c');
    expect(r.absorbed.id).toBe('m');
  });

  it('pickMergeSurvivorHeuristic uses reference counts when both manual', () => {
    const a = ing({ id: 'a', name: 'mint' });
    const b = ing({ id: 'b', name: 'mint leaves' });
    const r = pickMergeSurvivorHeuristic(a, b, 3, 10);
    expect(r.survivor.id).toBe('b');
  });
});
