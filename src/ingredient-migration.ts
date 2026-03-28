import type {
  BaseMeal,
  GroceryItem,
  Household,
  Ingredient,
  MealComponent,
  Recipe,
  WeeklyPlan,
} from './types';

const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;

export interface HouseholdMigrationReport {
  householdId: string;
  ingredientsBefore: number;
  ingredientsAfter: number;
  normalizedNameChanges: number;
  duplicatesMerged: number;
  remappedReferences: number;
}

export interface IngredientMigrationReport {
  householdsProcessed: number;
  ingredientsBefore: number;
  ingredientsAfter: number;
  normalizedNameChanges: number;
  duplicatesMerged: number;
  remappedReferences: number;
  households: HouseholdMigrationReport[];
}

export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(TRAILING_PUNCTUATION_RE, '').trim();
}

function ingredientCompletenessScore(ingredient: Ingredient): number {
  let score = 0;
  if (ingredient.tags.length > 0) score += 1;
  if (ingredient.shelfLifeHint.trim()) score += 1;
  if (ingredient.freezerFriendly) score += 1;
  if (ingredient.babySafeWithAdaptation) score += 1;
  if (ingredient.imageUrl?.trim()) score += 1;
  if (ingredient.catalogId?.trim()) score += 1;
  if (ingredient.source === 'catalog') score += 1;
  return score;
}

function preferMoreComplete(a: Ingredient, b: Ingredient): Ingredient {
  const aScore = ingredientCompletenessScore(a);
  const bScore = ingredientCompletenessScore(b);
  if (aScore === bScore) {
    return a.id < b.id ? a : b;
  }
  return aScore > bScore ? a : b;
}

function preferLongerText(current: string, candidate: string): string {
  const currentTrimmed = current.trim();
  const candidateTrimmed = candidate.trim();
  if (!currentTrimmed) return candidateTrimmed;
  if (!candidateTrimmed) return currentTrimmed;
  return candidateTrimmed.length > currentTrimmed.length ? candidateTrimmed : currentTrimmed;
}

function mergeIngredientMetadata(
  survivor: Ingredient,
  duplicate: Ingredient,
  normalizedName: string,
): Ingredient {
  const tags = new Set<string>([...survivor.tags, ...duplicate.tags]);
  return {
    ...survivor,
    name: normalizedName,
    tags: Array.from(tags),
    shelfLifeHint: preferLongerText(survivor.shelfLifeHint, duplicate.shelfLifeHint),
    freezerFriendly: survivor.freezerFriendly || duplicate.freezerFriendly,
    babySafeWithAdaptation: survivor.babySafeWithAdaptation || duplicate.babySafeWithAdaptation,
    imageUrl:
      survivor.imageUrl?.trim() || duplicate.imageUrl?.trim()
        ? survivor.imageUrl?.trim() || duplicate.imageUrl?.trim()
        : undefined,
    catalogId: survivor.catalogId?.trim() || duplicate.catalogId?.trim() || undefined,
    source:
      survivor.source === 'catalog' || duplicate.source === 'catalog'
        ? 'catalog'
        : (survivor.source ?? duplicate.source),
  };
}

function remapMealComponents(
  components: MealComponent[],
  idRemap: Map<string, string>,
): { components: MealComponent[]; updates: number } {
  let updates = 0;

  const nextComponents = components.map((component) => {
    const nextPrimary = idRemap.get(component.ingredientId) ?? component.ingredientId;
    if (nextPrimary !== component.ingredientId) updates += 1;

    let nextAlternatives = component.alternativeIngredientIds;
    if (nextAlternatives) {
      const remapped = nextAlternatives.map((id) => idRemap.get(id) ?? id);
      const deduped = Array.from(new Set(remapped)).filter((id) => id !== nextPrimary);
      if (deduped.length !== nextAlternatives.length) updates += 1;
      nextAlternatives = deduped.length > 0 ? deduped : undefined;
    }

    return {
      ...component,
      ingredientId: nextPrimary,
      alternativeIngredientIds: nextAlternatives,
    };
  });

  return { components: nextComponents, updates };
}

function remapBaseMeals(
  meals: BaseMeal[],
  idRemap: Map<string, string>,
): { meals: BaseMeal[]; updates: number } {
  let updates = 0;

  const nextMeals = meals.map((meal) => {
    const { components, updates: componentUpdates } = remapMealComponents(meal.components, idRemap);
    updates += componentUpdates;
    return { ...meal, components };
  });

  return { meals: nextMeals, updates };
}

function remapRecipes(
  recipes: Recipe[] | undefined,
  idRemap: Map<string, string>,
): { recipes: Recipe[]; updates: number } {
  const list = recipes ?? [];
  let updates = 0;
  const nextRecipes = list.map((recipe) => {
    const { components, updates: componentUpdates } = remapMealComponents(
      recipe.components,
      idRemap,
    );
    updates += componentUpdates;
    return { ...recipe, components };
  });
  return { recipes: nextRecipes, updates };
}

function remapGroceryItems(
  items: GroceryItem[],
  idRemap: Map<string, string>,
  ingredientNameById: Map<string, string>,
): { items: GroceryItem[]; updates: number } {
  let updates = 0;

  const nextItems = items.map((item) => {
    const nextId = idRemap.get(item.ingredientId) ?? item.ingredientId;
    const mappedName = ingredientNameById.get(nextId);
    const nextName = mappedName ?? item.name;
    if (nextId !== item.ingredientId || nextName !== item.name) updates += 1;

    return {
      ...item,
      ingredientId: nextId,
      name: nextName,
    };
  });

  return { items: nextItems, updates };
}

function remapWeeklyPlans(
  plans: WeeklyPlan[],
  idRemap: Map<string, string>,
  ingredientNameById: Map<string, string>,
): { plans: WeeklyPlan[]; updates: number } {
  let updates = 0;

  const nextPlans = plans.map((plan) => {
    const { items, updates: groceryUpdates } = remapGroceryItems(
      plan.generatedGroceryList,
      idRemap,
      ingredientNameById,
    );
    updates += groceryUpdates;
    return {
      ...plan,
      generatedGroceryList: items,
    };
  });

  return { plans: nextPlans, updates };
}

export function migrateHouseholdIngredients(household: Household): {
  household: Household;
  report: HouseholdMigrationReport;
} {
  const normalizedById = new Map<string, string>();
  const groupedByNormalized = new Map<string, Ingredient[]>();

  for (const ingredient of household.ingredients) {
    const normalizedName = normalizeIngredientName(ingredient.name);
    normalizedById.set(ingredient.id, normalizedName);
    const groupingKey = normalizedName || `__empty__${ingredient.id}`;
    const list = groupedByNormalized.get(groupingKey) ?? [];
    list.push({ ...ingredient, name: normalizedName });
    groupedByNormalized.set(groupingKey, list);
  }

  const idRemap = new Map<string, string>();
  const mergedIngredients: Ingredient[] = [];
  let duplicatesMerged = 0;

  for (const [groupKey, groupIngredients] of groupedByNormalized.entries()) {
    if (groupIngredients.length === 0) continue;

    if (groupKey.startsWith('__empty__')) {
      const ingredient = groupIngredients[0]!;
      idRemap.set(ingredient.id, ingredient.id);
      mergedIngredients.push(ingredient);
      continue;
    }

    let survivor = groupIngredients[0]!;
    for (const ingredient of groupIngredients.slice(1)) {
      survivor = preferMoreComplete(survivor, ingredient);
    }

    let merged = survivor;
    for (const ingredient of groupIngredients) {
      merged = mergeIngredientMetadata(merged, ingredient, groupKey);
      idRemap.set(ingredient.id, survivor.id);
    }

    duplicatesMerged += Math.max(0, groupIngredients.length - 1);
    mergedIngredients.push(merged);
  }

  const normalizedNameChanges = household.ingredients.reduce((count, ingredient) => {
    return (
      count + (ingredient.name !== (normalizedById.get(ingredient.id) ?? ingredient.name) ? 1 : 0)
    );
  }, 0);

  const ingredientNameById = new Map(mergedIngredients.map((ing) => [ing.id, ing.name]));
  const { meals: remappedMeals, updates: mealUpdates } = remapBaseMeals(
    household.baseMeals,
    idRemap,
  );
  const { recipes: remappedRecipes, updates: recipeUpdates } = remapRecipes(
    household.recipes,
    idRemap,
  );
  const { plans: remappedPlans, updates: groceryUpdates } = remapWeeklyPlans(
    household.weeklyPlans,
    idRemap,
    ingredientNameById,
  );

  const migratedHousehold: Household = {
    ...household,
    ingredients: mergedIngredients,
    baseMeals: remappedMeals,
    weeklyPlans: remappedPlans,
    recipes: remappedRecipes,
  };

  return {
    household: migratedHousehold,
    report: {
      householdId: household.id,
      ingredientsBefore: household.ingredients.length,
      ingredientsAfter: mergedIngredients.length,
      normalizedNameChanges,
      duplicatesMerged,
      remappedReferences: mealUpdates + groceryUpdates + recipeUpdates,
    },
  };
}

export function migrateHouseholdsIngredients(households: Household[]): {
  households: Household[];
  report: IngredientMigrationReport;
} {
  const reports: HouseholdMigrationReport[] = [];
  const migratedHouseholds = households.map((household) => {
    const { household: migratedHousehold, report } = migrateHouseholdIngredients(household);
    reports.push(report);
    return migratedHousehold;
  });

  const totals = reports.reduce(
    (acc, report) => {
      acc.ingredientsBefore += report.ingredientsBefore;
      acc.ingredientsAfter += report.ingredientsAfter;
      acc.normalizedNameChanges += report.normalizedNameChanges;
      acc.duplicatesMerged += report.duplicatesMerged;
      acc.remappedReferences += report.remappedReferences;
      return acc;
    },
    {
      ingredientsBefore: 0,
      ingredientsAfter: 0,
      normalizedNameChanges: 0,
      duplicatesMerged: 0,
      remappedReferences: 0,
    },
  );

  return {
    households: migratedHouseholds,
    report: {
      householdsProcessed: migratedHouseholds.length,
      ingredientsBefore: totals.ingredientsBefore,
      ingredientsAfter: totals.ingredientsAfter,
      normalizedNameChanges: totals.normalizedNameChanges,
      duplicatesMerged: totals.duplicatesMerged,
      remappedReferences: totals.remappedReferences,
      households: reports,
    },
  };
}
