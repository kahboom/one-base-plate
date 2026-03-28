import type { BaseMeal, Ingredient, Recipe } from '../types';

export type SortDir = 'asc' | 'desc';

export type BaseMealSortKey = 'name' | 'estimatedTimeMinutes' | 'difficulty' | 'componentCount';

export type IngredientSortKey = 'name' | 'category';

const DIFFICULTY_RANK: Record<BaseMeal['difficulty'], number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

function compareStrings(a: string, b: string, dir: SortDir): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return dir === 'asc' ? cmp : -cmp;
}

function compareNumbers(a: number, b: number, dir: SortDir): number {
  const cmp = a - b;
  return dir === 'asc' ? cmp : -cmp;
}

/** Returns a new sorted array (immutable). */
export function sortBaseMeals(meals: BaseMeal[], key: BaseMealSortKey, dir: SortDir): BaseMeal[] {
  const copy = [...meals];
  copy.sort((a, b) => {
    switch (key) {
      case 'name':
        return compareStrings(a.name, b.name, dir);
      case 'estimatedTimeMinutes':
        return compareNumbers(a.estimatedTimeMinutes, b.estimatedTimeMinutes, dir);
      case 'difficulty': {
        const ra = DIFFICULTY_RANK[a.difficulty];
        const rb = DIFFICULTY_RANK[b.difficulty];
        return compareNumbers(ra, rb, dir);
      }
      case 'componentCount':
        return compareNumbers(a.components.length, b.components.length, dir);
      default:
        return 0;
    }
  });
  return copy;
}

export type RecipeSortKey = 'name' | 'componentCount' | 'totalPrepMinutes';

function recipeTotalPrepMinutes(r: Recipe): number {
  return (r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0);
}

/** Returns a new sorted array (immutable). */
export function sortRecipes(recipes: Recipe[], key: RecipeSortKey, dir: SortDir): Recipe[] {
  const copy = [...recipes];
  copy.sort((a, b) => {
    switch (key) {
      case 'name':
        return compareStrings(a.name, b.name, dir);
      case 'componentCount':
        return compareNumbers(a.components.length, b.components.length, dir);
      case 'totalPrepMinutes':
        return compareNumbers(recipeTotalPrepMinutes(a), recipeTotalPrepMinutes(b), dir);
      default:
        return 0;
    }
  });
  return copy;
}

/** Returns a new sorted array (immutable). */
export function sortIngredients(
  ingredients: Ingredient[],
  key: IngredientSortKey,
  dir: SortDir,
): Ingredient[] {
  const copy = [...ingredients];
  copy.sort((a, b) => {
    switch (key) {
      case 'name':
        return compareStrings(a.name, b.name, dir);
      case 'category':
        return compareStrings(a.category, b.category, dir);
      default:
        return 0;
    }
  });
  return copy;
}
