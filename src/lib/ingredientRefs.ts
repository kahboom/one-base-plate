import type { Household } from '../types';

export interface IngredientReference {
  type: 'baseMeal' | 'recipe' | 'weeklyPlan' | 'importMapping';
  entityName: string;
}

/**
 * Scan all household data structures for references to the given ingredient IDs.
 * Returns a map from ingredient ID -> list of references found.
 * Only IDs that have at least one reference appear in the returned map.
 */
export function findIngredientReferences(
  ingredientIds: Set<string>,
  household: Household,
): Map<string, IngredientReference[]> {
  const refs = new Map<string, IngredientReference[]>();

  function addRef(id: string, ref: IngredientReference) {
    if (!ingredientIds.has(id)) return;
    const list = refs.get(id);
    if (list) {
      list.push(ref);
    } else {
      refs.set(id, [ref]);
    }
  }

  for (const meal of household.baseMeals) {
    for (const comp of meal.components) {
      addRef(comp.ingredientId, { type: 'baseMeal', entityName: meal.name });
      if (comp.alternativeIngredientIds) {
        for (const altId of comp.alternativeIngredientIds) {
          addRef(altId, { type: 'baseMeal', entityName: meal.name });
        }
      }
    }
    if (meal.importMappings) {
      for (const m of meal.importMappings) {
        if (m.ingredientId)
          addRef(m.ingredientId, { type: 'importMapping', entityName: meal.name });
        if (m.finalMatchedIngredientId)
          addRef(m.finalMatchedIngredientId, { type: 'importMapping', entityName: meal.name });
      }
    }
  }

  for (const recipe of household.recipes ?? []) {
    for (const comp of recipe.components) {
      addRef(comp.ingredientId, { type: 'recipe', entityName: recipe.name });
      if (comp.alternativeIngredientIds) {
        for (const altId of comp.alternativeIngredientIds) {
          addRef(altId, { type: 'recipe', entityName: recipe.name });
        }
      }
    }
    if (recipe.importMappings) {
      for (const m of recipe.importMappings) {
        if (m.ingredientId)
          addRef(m.ingredientId, { type: 'importMapping', entityName: recipe.name });
        if (m.finalMatchedIngredientId)
          addRef(m.finalMatchedIngredientId, { type: 'importMapping', entityName: recipe.name });
      }
    }
  }

  for (const plan of household.weeklyPlans) {
    for (const item of plan.generatedGroceryList) {
      addRef(item.ingredientId, { type: 'weeklyPlan', entityName: `Weekly plan` });
    }
  }

  return refs;
}
