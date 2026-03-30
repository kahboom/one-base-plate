import { describe, it, expect } from 'vitest';
import { matchIngredient, applyRegionalSynonyms } from '../src/recipe-parser';
import { searchCatalog, MASTER_CATALOG } from '../src/catalog';
import type { Ingredient } from '../src/types';

function ing(id: string, name: string, category: Ingredient['category'] = 'veg'): Ingredient {
  return {
    id,
    name,
    category,
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
  };
}

describe('F073 — Regional synonym matching', () => {
  describe('applyRegionalSynonyms', () => {
    it('normalizes tokens to canonical regional forms', () => {
      expect(applyRegionalSynonyms('eggplant')).toBe('aubergine');
      expect(applyRegionalSynonyms('aubergine')).toBe('aubergine');
      expect(applyRegionalSynonyms('cilantro')).toBe('coriander');
      expect(applyRegionalSynonyms('zucchini')).toBe('courgette');
      expect(applyRegionalSynonyms('arugula')).toBe('rocket');
      expect(applyRegionalSynonyms('shrimp')).toBe('prawns');
    });
  });

  describe('household matching (bidirectional)', () => {
    it('matches eggplant line to household aubergine', () => {
      const m = matchIngredient('eggplant', [ing('i1', 'aubergine')], []);
      expect(m.status).toBe('matched');
      expect(m.ingredient?.id).toBe('i1');
    });

    it('matches aubergine line to household eggplant', () => {
      const m = matchIngredient('aubergine', [ing('i1', 'eggplant')], []);
      expect(m.status).toBe('matched');
      expect(m.ingredient?.id).toBe('i1');
    });

    it('matches cilantro ↔ coriander', () => {
      const a = matchIngredient('cilantro', [ing('c', 'coriander')], []);
      expect(a.status).toBe('matched');
      expect(a.ingredient?.id).toBe('c');
      const b = matchIngredient('coriander', [ing('c2', 'cilantro')], []);
      expect(b.status).toBe('matched');
      expect(b.ingredient?.id).toBe('c2');
    });

    it('matches zucchini ↔ courgette', () => {
      const a = matchIngredient('zucchini', [ing('z', 'courgette')], []);
      expect(a.status).toBe('matched');
      const b = matchIngredient('courgette', [ing('z2', 'zucchini')], []);
      expect(b.status).toBe('matched');
    });

    it('matches arugula ↔ rocket', () => {
      const a = matchIngredient('arugula', [ing('r', 'rocket')], []);
      expect(a.status).toBe('matched');
      const b = matchIngredient('rocket', [ing('r2', 'arugula')], []);
      expect(b.status).toBe('matched');
    });

    it('matches shrimp ↔ prawns', () => {
      const a = matchIngredient('shrimp', [ing('p', 'prawns')], []);
      expect(a.status).toBe('matched');
      const b = matchIngredient('prawns', [ing('p2', 'shrimp')], []);
      expect(b.status).toBe('matched');
    });
  });

  describe('catalog matching', () => {
    it('matches eggplant to cat-aubergine when household is empty', () => {
      const m = matchIngredient('eggplant', [], MASTER_CATALOG);
      expect(m.status).toBe('catalog');
      expect(m.catalogItem?.id).toBe('cat-aubergine');
    });

    it('searchCatalog finds aubergine via eggplant alias', () => {
      const hits = searchCatalog('eggplant');
      expect(hits.some((h) => h.id === 'cat-aubergine')).toBe(true);
    });
  });

  describe('regression — compounds unchanged', () => {
    it('cream cheese still matches household cream cheese', () => {
      const m = matchIngredient('cream cheese', [ing('cc', 'cream cheese')], []);
      expect(m.status).toBe('matched');
      expect(m.ingredient?.id).toBe('cc');
    });

    it('olive oil still matches catalog olive oil', () => {
      const m = matchIngredient('olive oil', [], MASTER_CATALOG);
      expect(m.status).toBe('catalog');
      expect(m.catalogItem?.id).toBe('cat-olive-oil');
    });
  });
});
