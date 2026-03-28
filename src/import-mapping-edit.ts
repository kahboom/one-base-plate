import type {
  BaseMeal,
  ImportMapping,
  Ingredient,
  IngredientCategory,
  MealComponent,
} from './types';
import { guessComponentRole } from './recipe-parser';
import { normalizeIngredientName } from './storage';

export type ImportMappingEditPayload =
  | { kind: 'ignore' }
  | { kind: 'use'; ingredientId: string }
  | { kind: 'create'; category: IngredientCategory; name?: string };

export function componentIndexForMapping(
  mappingIndex: number,
  mappings: ImportMapping[],
): number | null {
  const m = mappings[mappingIndex];
  if (!m || m.action === 'ignore') return null;
  let count = 0;
  for (let i = 0; i < mappingIndex; i++) {
    if (mappings[i]!.action !== 'ignore') count++;
  }
  return count;
}

function countNonIgnoreBefore(mappingIndex: number, mappings: ImportMapping[]): number {
  let c = 0;
  for (let i = 0; i < mappingIndex; i++) {
    if (mappings[i]!.action !== 'ignore') c++;
  }
  return c;
}

function mealComponentFromMapping(
  mapping: ImportMapping,
  ingredient: Ingredient,
  previous: MealComponent | undefined,
): MealComponent {
  const qty =
    previous?.quantity ??
    (mapping.parsedQuantityValue != null
      ? `${mapping.parsedQuantityValue}${
          mapping.parsedQuantityUnit ? ` ${mapping.parsedQuantityUnit}` : ''
        }`
      : '');
  return {
    ingredientId: ingredient.id,
    role: guessComponentRole(ingredient.category),
    quantity: qty,
    unit: mapping.parsedQuantityUnit || previous?.unit,
    prepNote: mapping.prepNotes?.join(', ') || previous?.prepNote,
    originalSourceLine: mapping.originalLine,
    matchType: mapping.action === 'use' ? 'existing' : 'new',
  };
}

function mappingUse(ingredientId: string, base: ImportMapping): ImportMapping {
  return {
    ...base,
    action: 'use',
    chosenAction: 'use',
    ingredientId,
    finalMatchedIngredientId: ingredientId,
    matchType: 'existing',
  };
}

function mappingCreate(ingredientId: string, base: ImportMapping): ImportMapping {
  return {
    ...base,
    action: 'create',
    chosenAction: 'create',
    ingredientId,
    finalMatchedIngredientId: ingredientId,
    matchType: 'new',
  };
}

function mappingIgnore(base: ImportMapping): ImportMapping {
  return {
    ...base,
    action: 'ignore',
    chosenAction: 'ignore',
    ingredientId: undefined,
    finalMatchedIngredientId: undefined,
    matchType: 'ignored',
  };
}

function makeNewIngredient(category: IngredientCategory, name: string): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: normalizeIngredientName(name),
    category,
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
  };
}

export function applyImportMappingEdit(
  meal: BaseMeal,
  mappingIndex: number,
  edit: ImportMappingEditPayload,
  householdIngredients: Ingredient[],
): { meal: BaseMeal; newIngredients: Ingredient[] } {
  const mappings = [...(meal.importMappings ?? [])];
  if (mappingIndex < 0 || mappingIndex >= mappings.length) {
    throw new Error('Invalid mapping index');
  }

  const oldBase = mappings[mappingIndex]!;
  const oldMappings = meal.importMappings!;
  const oldComps = [...meal.components];
  const newIngredients: Ingredient[] = [];

  const byId = new Map(householdIngredients.map((i) => [i.id, i]));

  const prevCompIdx = componentIndexForMapping(mappingIndex, oldMappings);
  const prevComp = prevCompIdx !== null ? oldComps[prevCompIdx] : undefined;

  if (edit.kind === 'ignore') {
    mappings[mappingIndex] = mappingIgnore(oldBase);
    if (prevCompIdx === null) {
      return {
        meal: { ...meal, importMappings: mappings, components: oldComps },
        newIngredients: [],
      };
    }
    const newComps = oldComps.filter((_, i) => i !== prevCompIdx);
    return {
      meal: { ...meal, importMappings: mappings, components: newComps },
      newIngredients: [],
    };
  }

  if (edit.kind === 'use') {
    const ing = byId.get(edit.ingredientId);
    if (!ing) throw new Error('Ingredient not found');
    const m = mappingUse(edit.ingredientId, oldBase);
    mappings[mappingIndex] = m;
    const comp = mealComponentFromMapping(m, ing, prevComp);

    if (prevCompIdx === null) {
      const insertAt = countNonIgnoreBefore(mappingIndex, oldMappings);
      const newComps = [...oldComps.slice(0, insertAt), comp, ...oldComps.slice(insertAt)];
      return {
        meal: { ...meal, importMappings: mappings, components: newComps },
        newIngredients: [],
      };
    }
    const newComps = [...oldComps];
    newComps[prevCompIdx] = comp;
    return {
      meal: { ...meal, importMappings: mappings, components: newComps },
      newIngredients: [],
    };
  }

  const name =
    edit.name?.trim() || oldBase.cleanedIngredientName || oldBase.parsedName || 'Ingredient';
  const ing = makeNewIngredient(edit.category, name);
  newIngredients.push(ing);
  const m = mappingCreate(ing.id, oldBase);
  mappings[mappingIndex] = m;
  const comp = mealComponentFromMapping(m, ing, prevComp);

  if (prevCompIdx === null) {
    const insertAt = countNonIgnoreBefore(mappingIndex, oldMappings);
    const newComps = [...oldComps.slice(0, insertAt), comp, ...oldComps.slice(insertAt)];
    return {
      meal: { ...meal, importMappings: mappings, components: newComps },
      newIngredients,
    };
  }

  const newComps = [...oldComps];
  newComps[prevCompIdx] = comp;
  return {
    meal: { ...meal, importMappings: mappings, components: newComps },
    newIngredients,
  };
}
