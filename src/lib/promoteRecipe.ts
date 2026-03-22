import type { BaseMeal, Recipe } from "../types";

export type PromoteRecipeOptions = {
  difficulty?: BaseMeal["difficulty"];
  rescueEligible?: boolean;
  estimatedTimeMinutes?: number;
};

/**
 * Create a plan-able base meal from a library recipe (new id; links via `sourceRecipeId`).
 */
export function promoteRecipeToBaseMeal(
  recipe: Recipe,
  opts: PromoteRecipeOptions = {},
): BaseMeal {
  const fromTimes =
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0) || undefined;
  const estimated =
    opts.estimatedTimeMinutes ?? (fromTimes && fromTimes > 0 ? fromTimes : 30);

  return {
    id: crypto.randomUUID(),
    sourceRecipeId: recipe.id,
    name: recipe.name,
    components: recipe.components.map((c) => ({
      ...c,
      id: c.id ?? crypto.randomUUID(),
    })),
    defaultPrep: recipe.defaultPrep ?? "",
    estimatedTimeMinutes: estimated,
    difficulty: opts.difficulty ?? "medium",
    rescueEligible: opts.rescueEligible ?? false,
    wasteReuseHints: [],
    recipeLinks: recipe.recipeLinks,
    recipeRefs: [{ recipeId: recipe.id, role: "primary" as const }],
    notes: recipe.notes,
    imageUrl: recipe.imageUrl,
    provenance: recipe.provenance,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    servings: recipe.servings,
    importMappings: recipe.importMappings,
  };
}
