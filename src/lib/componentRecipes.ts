import type {
  BaseMeal,
  ComponentRecipeRef,
  MealComponent,
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

/** Merge session overrides into base meal for “save as defaults” (explicit user action). */
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
