import { describe, it, expect } from 'vitest';
import type { Ingredient } from '../src/types';
import {
  suggestIngredientMergePairs,
  ingredientsAlreadyLinkedAsNameAlias,
} from '../src/lib/suggestIngredientMergePairs';

function ing(partial: Partial<Ingredient> & { name: string }): Ingredient {
  return {
    id: partial.id ?? `id-${partial.name}`,
    category: partial.category ?? 'pantry',
    tags: partial.tags ?? [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
    ...partial,
  };
}

describe('suggestIngredientMergePairs', () => {
  it('suggests mint vs verbose mint phrase', () => {
    const list = [ing({ id: '1', name: 'mint' }), ing({ id: '2', name: 'handful of mint leaves' })];
    const pairs = suggestIngredientMergePairs(list);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    const p = pairs[0]!;
    expect([p.ingredientA.id, p.ingredientB.id].sort()).toEqual(['1', '2']);
    expect(p.score).toBeGreaterThanOrEqual(0.55);
  });

  it('does not suggest when one name is already the other alias', () => {
    const list = [
      ing({ id: '1', name: 'mint', aliases: ['fresh mint leaves'] }),
      ing({ id: '2', name: 'fresh mint leaves' }),
    ];
    expect(ingredientsAlreadyLinkedAsNameAlias(list[0]!, list[1]!)).toBe(true);
    expect(suggestIngredientMergePairs(list)).toHaveLength(0);
  });

  it('flags identical normalized names at high score', () => {
    const list = [ing({ id: 'a', name: 'Soy Sauce' }), ing({ id: 'b', name: 'soy sauce' })];
    const pairs = suggestIngredientMergePairs(list);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.score).toBe(1);
    expect(pairs[0]!.reasons.some((r) => r.includes('normalized'))).toBe(true);
  });

  it('returns empty for unrelated ingredients', () => {
    const list = [ing({ name: 'salmon' }), ing({ name: 'chocolate' })];
    expect(suggestIngredientMergePairs(list)).toHaveLength(0);
  });

  it('respects limit', () => {
    const list = [
      ing({ id: '1', name: 'basil' }),
      ing({ id: '2', name: 'fresh basil leaves' }),
      ing({ id: '3', name: 'parsley' }),
      ing({ id: '4', name: 'flat leaf parsley' }),
    ];
    const pairs = suggestIngredientMergePairs(list, { limit: 1 });
    expect(pairs.length).toBe(1);
  });

  it('matches rosemary lines that only differ by stray numeric tokens', () => {
    const list = [
      ing({ id: '1', name: 'Or 3 sprigs fresh rosemary' }),
      ing({ id: '2', name: 'Rosemary 3 sprigs' }),
    ];
    const pairs = suggestIngredientMergePairs(list);
    expect(pairs.length).toBe(1);
    expect(pairs[0]!.score).toBeGreaterThanOrEqual(0.55);
  });
});
