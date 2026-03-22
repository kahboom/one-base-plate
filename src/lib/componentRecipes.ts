import type {
  BaseMeal,
  ComponentRecipeRef,
  DayPlan,
  Ingredient,
  MealComponent,
  Recipe,
} from "../types";

export function getDefaultRecipeRef(
  component: MealComponent,
): ComponentRecipeRef | undefined {
  const refs = component.recipeRefs;
  if (!refs?.length) return undefined;
  const def = refs.find((r) => r.isDefault);
  return def ?? refs[0];
}

export type RecipeResolutionSource = "session" | "plan" | "default" | "none";

export function resolveComponentEffectiveRef(
  component: MealComponent,
  options: {
    planOverrides?: ComponentRecipeRef[];
    sessionOverrides?: Map<string, ComponentRecipeRef>;
  },
): { effective: ComponentRecipeRef | undefined; source: RecipeResolutionSource } {
  const cid = component.id;
  if (cid && options.sessionOverrides?.has(cid)) {
    return {
      effective: options.sessionOverrides.get(cid),
      source: "session",
    };
  }
  const plan = options.planOverrides?.find((r) => r.componentId === cid);
  if (plan) return { effective: plan, source: "plan" };
  const def = getDefaultRecipeRef(component);
  if (def) return { effective: def, source: "default" };
  return { effective: undefined, source: "none" };
}

export type FullResolutionSource =
  | "session"
  | "plan"
  | "component"
  | "meal"
  | "ingredient"
  | "prepNote"
  | "none";

export interface FullCookingResolution {
  effective: ComponentRecipeRef | undefined;
  source: FullResolutionSource;
  sourceLabel: string;
}

/**
 * Full-priority cooking guidance resolution for the planner "How to make tonight" section.
 *
 * Priority:
 * 1. Session override (tonight)
 * 2. DayPlan componentRecipeOverrides
 * 3. MealComponent.recipeRefs (component default)
 * 4. BaseMeal.recipeRefs (whole-meal recipe, synthesized as fallback)
 * 5. Ingredient.defaultRecipeRefs
 * 6. component.prepNote / meal.recipeLinks fallback
 */
export function resolveFullCookingRef(
  component: MealComponent,
  meal: BaseMeal,
  ingredients: Ingredient[],
  options: {
    planOverrides?: ComponentRecipeRef[];
    sessionOverrides?: Map<string, ComponentRecipeRef>;
  },
): FullCookingResolution {
  const cid = component.id;

  if (cid && options.sessionOverrides?.has(cid)) {
    return {
      effective: options.sessionOverrides.get(cid),
      source: "session",
      sourceLabel: "Tonight override",
    };
  }

  const plan = options.planOverrides?.find((r) => r.componentId === cid);
  if (plan) {
    return { effective: plan, source: "plan", sourceLabel: "Day plan override" };
  }

  const compDefault = getDefaultRecipeRef(component);
  if (compDefault) {
    return {
      effective: compDefault,
      source: "component",
      sourceLabel: "Component default",
    };
  }

  const mealRefs = meal.recipeRefs ?? [];
  if (mealRefs.length > 0) {
    const primary = mealRefs.find((r) => r.role === "primary") ?? mealRefs[0]!;
    const synth: ComponentRecipeRef = {
      id: `meal-ref-${primary.recipeId}`,
      componentId: cid ?? "",
      sourceType: "internal-meal",
      recipeId: primary.recipeId || undefined,
      label: primary.label ?? "Whole-meal recipe",
      notes: primary.notes,
    };
    return { effective: synth, source: "meal", sourceLabel: "Whole-meal recipe" };
  }

  const ingredient = ingredients.find((i) => i.id === component.ingredientId);
  const ingredientRefs = ingredient?.defaultRecipeRefs;
  if (ingredientRefs && ingredientRefs.length > 0) {
    const first = ingredientRefs[0]!;
    const synth: ComponentRecipeRef = {
      id: `ing-ref-${first.recipeId}`,
      componentId: cid ?? "",
      sourceType: "internal-meal",
      recipeId: first.recipeId || undefined,
      label: first.label ?? ingredient!.name,
      notes: first.notes,
    };
    return {
      effective: synth,
      source: "ingredient",
      sourceLabel: "Ingredient default",
    };
  }

  if (component.prepNote) {
    const synth: ComponentRecipeRef = {
      id: `prep-note-${cid}`,
      componentId: cid ?? "",
      sourceType: "note",
      label: "Prep note",
      notes: component.prepNote,
    };
    return { effective: synth, source: "prepNote", sourceLabel: "Prep note" };
  }

  if (meal.recipeLinks && meal.recipeLinks.length > 0) {
    const link = meal.recipeLinks[0]!;
    const synth: ComponentRecipeRef = {
      id: `recipe-link-${cid}`,
      componentId: cid ?? "",
      sourceType: "external-url",
      label: link.label,
      url: link.url,
    };
    return {
      effective: synth,
      source: "prepNote",
      sourceLabel: "Recipe link",
    };
  }

  return { effective: undefined, source: "none", sourceLabel: "" };
}

/** Human-readable line for cooking UI (not full recipe). */
export function summarizeRecipeRef(
  ref: ComponentRecipeRef | undefined,
  opts: { linkedMealName?: string } = {},
): string {
  if (!ref) return "";
  if (ref.sourceType === "note") {
    return ref.notes?.trim() || ref.label || "Prep note";
  }
  if (ref.sourceType === "external-url") {
    return ref.label || ref.url || "Link";
  }
  if (ref.linkedBaseMealId && opts.linkedMealName) {
    return ref.label || opts.linkedMealName;
  }
  return ref.label || "Recipe";
}

export function createComponentRecipeRef(
  partial: Omit<ComponentRecipeRef, "id"> & { id?: string },
): ComponentRecipeRef {
  return {
    ...partial,
    id: partial.id ?? crypto.randomUUID(),
  };
}

/** Merge session overrides into base meal for "save as defaults" (explicit user action). */
export function applySessionOverridesToMeal(
  meal: BaseMeal,
  sessionOverrides: Map<string, ComponentRecipeRef>,
): BaseMeal {
  const components = meal.components.map((c) => {
    if (!c.id || !sessionOverrides.has(c.id)) return c;
    const override = sessionOverrides.get(c.id)!;
    const merged: ComponentRecipeRef = {
      ...override,
      componentId: c.id,
      isDefault: true,
    };
    const rest = (c.recipeRefs ?? [])
      .filter((r) => r.id !== merged.id)
      .map((r) => ({ ...r, isDefault: false }));
    return {
      ...c,
      recipeRefs: [merged, ...rest],
    };
  });
  return { ...meal, components };
}

/** Count total attached recipes (meal-level + component-level, excluding alt-protein markers). */
export function countMealRecipes(meal: BaseMeal): number {
  const mealLevel = (meal.recipeRefs ?? []).length;
  let componentLevel = 0;
  for (const c of meal.components) {
    componentLevel += (c.recipeRefs ?? []).filter(
      (r) => !r.notes?.startsWith("alt:"),
    ).length;
  }
  return mealLevel + componentLevel;
}

/** Check whether any recipe ref on a meal has batch-prep characteristics. */
export function hasBatchPrepRecipe(
  meal: BaseMeal,
  recipes: Recipe[],
): boolean {
  for (const ref of meal.recipeRefs ?? []) {
    if (ref.role === "batch-prep") return true;
    const r = recipes.find((x) => x.id === ref.recipeId);
    if (r?.recipeType === "batch-prep") return true;
  }
  for (const c of meal.components) {
    for (const cr of c.recipeRefs ?? []) {
      if (cr.recipeId) {
        const r = recipes.find((x) => x.id === cr.recipeId);
        if (r?.recipeType === "batch-prep") return true;
      }
    }
  }
  return false;
}

/** Check if any component has a prep-ahead recipe. */
export function hasPrepAheadRecipe(
  meal: BaseMeal,
  recipes: Recipe[],
): boolean {
  for (const c of meal.components) {
    for (const cr of c.recipeRefs ?? []) {
      if (cr.recipeId) {
        const r = recipes.find((x) => x.id === cr.recipeId);
        if (r?.recipeType === "batch-prep") return true;
      }
    }
  }
  return false;
}

export interface PrepAheadOpportunity {
  ingredientId: string;
  ingredientName: string;
  dayLabels: string[];
  recipeId?: string;
  recipeName?: string;
}

/**
 * Scan assigned meals across a week plan and find ingredients that appear on 2+
 * days where a batch-prep recipe exists for that ingredient.
 */
export function findPrepAheadOpportunities(
  days: DayPlan[],
  baseMeals: BaseMeal[],
  recipes: Recipe[],
  ingredients: Ingredient[],
): PrepAheadOpportunity[] {
  const ingredientDays = new Map<string, string[]>();

  for (const day of days) {
    const meal = baseMeals.find((m) => m.id === day.baseMealId);
    if (!meal) continue;
    for (const c of meal.components) {
      const ids = [c.ingredientId, ...(c.alternativeIngredientIds ?? [])];
      for (const ingId of ids) {
        const list = ingredientDays.get(ingId) ?? [];
        if (!list.includes(day.day)) list.push(day.day);
        ingredientDays.set(ingId, list);
      }
    }
  }

  const opportunities: PrepAheadOpportunity[] = [];

  for (const [ingId, dayLabels] of ingredientDays) {
    if (dayLabels.length < 2) continue;
    const ing = ingredients.find((i) => i.id === ingId);
    const batchRecipe = recipes.find(
      (r) =>
        r.recipeType === "batch-prep" &&
        r.components.some((c) => c.ingredientId === ingId),
    );
    const ingDefault = ing?.defaultRecipeRefs?.find((r) => r.role === "batch-prep");

    if (batchRecipe || ingDefault) {
      opportunities.push({
        ingredientId: ingId,
        ingredientName: ing?.name ?? ingId,
        dayLabels,
        recipeId: batchRecipe?.id ?? ingDefault?.recipeId,
        recipeName: batchRecipe?.name ?? ingDefault?.label,
      });
    }
  }

  return opportunities;
}
