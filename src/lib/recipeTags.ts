import type { Recipe, RecipeType } from "../types";

/** Curated recipe tags for quick-pick UI; unknown tags in stored data are preserved but not listed here. */
export const CURATED_RECIPE_TAGS: readonly { value: string; label: string }[] = [
  { value: "quick", label: "Quick" },
  { value: "batch-prep", label: "Batch prep" },
  { value: "freezer-friendly", label: "Freezer friendly" },
  { value: "rescue", label: "Rescue" },
  { value: "side", label: "Side" },
  { value: "sauce", label: "Sauce" },
  { value: "kid-friendly", label: "Kid friendly" },
  { value: "prep-ahead", label: "Prep ahead" },
] as const;

const CURATED_SET = new Set(CURATED_RECIPE_TAGS.map((t) => t.value));

const LABEL_BY_VALUE = new Map(
  CURATED_RECIPE_TAGS.map((t) => [t.value, t.label] as const),
);

/** Legacy / seed aliases that should behave like curated tags for filtering and display. */
const LEGACY_TAG_ALIASES: Record<string, string> = {
  "batch-friendly": "batch-prep",
  "rescue-friendly": "rescue",
};

export function normalizeRecipeTagForCurated(tag: string): string {
  return LEGACY_TAG_ALIASES[tag] ?? tag;
}

export function isCuratedTag(tag: string): boolean {
  return CURATED_SET.has(tag);
}

/** Display label for a tag; curated tags get friendly labels, others pass through. */
export function recipeTagLabel(tag: string): string {
  const normalized = normalizeRecipeTagForCurated(tag);
  return LABEL_BY_VALUE.get(normalized) ?? LABEL_BY_VALUE.get(tag) ?? tag;
}

/**
 * Weak tie-breaker boost for recipe suggestion ordering (0–0.15).
 * Stronger signals (name match, recipeType) should be applied separately with larger weights.
 */
const MAX_BOOST = 0.15;
const PER_MATCH = 0.04;

export function recipeHasTag(recipe: Recipe, tag: string): boolean {
  const n = normalizeRecipeTagForCurated(tag);
  return (recipe.tags ?? []).some((t) => normalizeRecipeTagForCurated(t) === n);
}

/** True if recipe carries a tag matching the curated filter value (including legacy aliases). */
export function recipeMatchesCuratedFilter(recipe: Recipe, curatedFilterValue: string): boolean {
  return recipeHasTag(recipe, curatedFilterValue);
}

function recipeTypeMatchesRole(
  recipeType: RecipeType | undefined,
  role: string | undefined,
): boolean {
  if (!recipeType || !role) return false;
  const r = role.toLowerCase();
  if (recipeType === "sauce" && (r === "sauce" || r === "condiment")) return true;
  if (recipeType === "batch-prep" && (r === "carb" || r === "protein" || r === "starch"))
    return true;
  return false;
}

export interface TagBoostContext {
  /** Meal component role (e.g. protein, sauce) for soft alignment. */
  componentRole?: string;
  /** When true, rescue/quick tags get a small extra nudge. */
  rescueMode?: boolean;
}

/**
 * Returns a small non-negative boost for ordering. Intended as tie-breaker only.
 * recipeType alignment should use separate, larger scores in callers.
 */
export function computeTagBoost(recipe: Recipe, context: TagBoostContext = {}): number {
  let boost = 0;
  const role = context.componentRole?.toLowerCase();

  if (context.rescueMode) {
    if (recipeHasTag(recipe, "rescue")) boost += PER_MATCH;
    if (recipeHasTag(recipe, "quick")) boost += PER_MATCH * 0.75;
  }

  if (role === "sauce" || role === "condiment") {
    if (recipeHasTag(recipe, "sauce")) boost += PER_MATCH;
    if (recipe.recipeType === "sauce") {
      /* recipeType dominates; tags add little on top */
      boost += PER_MATCH * 0.25;
    }
  }

  if (role === "side" || role === "veg") {
    if (recipeHasTag(recipe, "side")) boost += PER_MATCH;
  }

  if (recipeHasTag(recipe, "batch-prep") || recipeHasTag(recipe, "prep-ahead")) {
    boost += PER_MATCH * 0.5;
  }

  if (recipeHasTag(recipe, "kid-friendly")) {
    boost += PER_MATCH * 0.25;
  }

  if (recipeHasTag(recipe, "freezer-friendly")) {
    boost += PER_MATCH * 0.25;
  }

  /* Weak alignment when recipeType already matches role — tags should not override */
  if (recipeTypeMatchesRole(recipe.recipeType, role)) {
    boost += PER_MATCH * 0.2;
  }

  return Math.min(boost, MAX_BOOST);
}

/**
 * Stronger than tag boost: aligns library recipeType with the component role (e.g. sauce row).
 */
export function recipeTypeContextScore(recipe: Recipe, context: TagBoostContext): number {
  const role = context.componentRole?.toLowerCase();
  const rt = recipe.recipeType;
  if (!role || !rt) return 0;
  if ((role === "sauce" || role === "condiment") && rt === "sauce") return 28;
  if (
    (role === "carb" || role === "starch" || role === "protein") &&
    rt === "batch-prep"
  )
    return 12;
  return 0;
}

/**
 * Compare two recipes for suggestion ordering within a group:
 * higher score wins. Name match and recipeType context dominate tag boosts.
 */
export function compareRecipesForSuggestion(
  a: Recipe,
  b: Recipe,
  query: string,
  context: TagBoostContext,
): number {
  const q = query.trim().toLowerCase();
  const nameScore = (r: Recipe) => {
    const n = r.name.toLowerCase();
    if (!q) return 0;
    if (n === q) return 100;
    if (n.startsWith(q)) return 80;
    if (n.includes(q)) return 60;
    return 0;
  };
  const typeScore = (r: Recipe) => {
    const t = r.recipeType ?? "";
    if (!q) return 0;
    return t.toLowerCase().includes(q) ? 5 : 0;
  };
  const score = (r: Recipe) =>
    nameScore(r) +
    typeScore(r) +
    recipeTypeContextScore(r, context) +
    computeTagBoost(r, context) * 100;
  const sa = score(a);
  const sb = score(b);
  if (sa !== sb) return sb - sa;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
