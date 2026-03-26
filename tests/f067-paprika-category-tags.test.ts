import { describe, it, expect } from "vitest";
import {
  normalizePaprikaCategory,
  mapPaprikaCategories,
  PAPRIKA_CATEGORY_TAG_MAP,
} from "../src/lib/paprikaCategoryMap";
import {
  recipeMatchesCuratedFilter,
  recipeHasTag,
  computeTagBoost,
  isCuratedTag,
} from "../src/lib/recipeTags";
import { buildDraftRecipe, parseRecipeIngredients } from "../src/paprika-parser";
import type { PaprikaRecipe, PaprikaReviewLine } from "../src/paprika-parser";
import type { Ingredient } from "../src/types";

const chickenIngredient: Ingredient = {
  id: "ing-chicken",
  name: "chicken breast",
  category: "protein",
  tags: [],
  shelfLifeHint: "",
  freezerFriendly: false,
  babySafeWithAdaptation: true,
  source: "manual",
};

function makePaprikaRecipe(overrides: Partial<PaprikaRecipe> = {}): PaprikaRecipe {
  return {
    name: "Test Recipe",
    ingredients: "200g chicken breast",
    directions: "Cook.",
    notes: "",
    source: "",
    source_url: "",
    prep_time: "",
    cook_time: "",
    total_time: "",
    difficulty: "",
    servings: "",
    categories: [],
    image_url: "",
    photo_data: null,
    uid: "paprika-uid-f067",
    ...overrides,
  };
}

describe("F067: Paprika category → recipe tag mapping", () => {
  it("maps every table value to a curated tag", () => {
    for (const tag of Object.values(PAPRIKA_CATEGORY_TAG_MAP)) {
      expect(isCuratedTag(tag), `non-curated map target: ${tag}`).toBe(true);
    }
  });

  it("exact category mapping (case and spacing)", () => {
    expect(mapPaprikaCategories(["Soup"]).tags).toEqual(["soup"]);
    expect(mapPaprikaCategories(["  SOUP  "]).tags).toEqual(["soup"]);
  });

  it("alias mapping", () => {
    expect(mapPaprikaCategories(["Quick Dinner"]).tags).toEqual(["quick"]);
    expect(mapPaprikaCategories(["Freezer meal"]).tags).toEqual(["freezer-friendly"]);
    expect(mapPaprikaCategories(["Kid friendly"]).tags).toEqual(["kid-friendly"]);
    expect(mapPaprikaCategories(["Make ahead"]).tags).toEqual(["prep-ahead"]);
    expect(mapPaprikaCategories(["Batch cooking"]).tags).toEqual(["batch-prep"]);
    expect(mapPaprikaCategories(["Side dish"]).tags).toEqual(["side"]);
  });

  it("plural / singular normalization via trailing -s", () => {
    expect(mapPaprikaCategories(["Salads"]).tags).toEqual(["salad"]);
    expect(normalizePaprikaCategory("Salads")).toBe("salad");
  });

  it("dedupes duplicate categories that map to the same tag", () => {
    const r = mapPaprikaCategories(["Soup", "soup", "SOUP"]);
    expect(r.tags).toEqual(["soup"]);
    expect(r.rawCategories).toEqual(["Soup", "soup", "SOUP"]);
    expect(r.unmappedCount).toBe(0);
  });

  it("mixed mapped + unmapped: tags vs raw provenance", () => {
    const r = mapPaprikaCategories(["Soup", "Italian", "Quick"]);
    expect(r.tags).toEqual(["soup", "quick"]);
    expect(r.rawCategories).toEqual(["Soup", "Italian", "Quick"]);
    expect(r.unmappedCount).toBe(1);
  });

  it("preserves unmapped categories in raw list without adding tags", () => {
    const r = mapPaprikaCategories(["Italian", "Taco Night"]);
    expect(r.tags).toEqual([]);
    expect(r.rawCategories).toEqual(["Italian", "Taco Night"]);
    expect(r.unmappedCount).toBe(2);
  });

  it("does not map removed / theme strings into tags", () => {
    const r = mapPaprikaCategories([
      "whole-meal",
      "taco",
      "pizza",
      "pasta",
      "Taco Night",
    ]);
    expect(r.tags).toEqual([]);
    expect(r.unmappedCount).toBe(5);
  });

  it("handles empty input deterministically", () => {
    expect(mapPaprikaCategories([])).toEqual({
      tags: [],
      rawCategories: [],
      unmappedCount: 0,
    });
    expect(mapPaprikaCategories(["  ", ""])).toEqual({
      tags: [],
      rawCategories: [],
      unmappedCount: 0,
    });
  });

  it("strips trivial edge punctuation", () => {
    expect(mapPaprikaCategories(["  Soup,  "]).tags).toEqual(["soup"]);
    expect(normalizePaprikaCategory("  Soup,  ")).toBe("soup");
  });

  it("buildDraftRecipe applies tags and provenance.rawCategories", () => {
    const recipe = makePaprikaRecipe({
      categories: ["Soup", "Italian", "Quick Dinners"],
    });
    const lines = parseRecipeIngredients(recipe, [chickenIngredient]) as PaprikaReviewLine[];
    const { recipe: lib } = buildDraftRecipe(recipe, lines, [chickenIngredient]);
    expect(lib.tags).toEqual(["soup", "quick"]);
    expect(lib.provenance?.rawCategories).toEqual(["Soup", "Italian", "Quick Dinners"]);
    expect(lib.provenance?.sourceSystem).toBe("paprika");
  });

  it("imported recipe tags work with library filter helpers", () => {
    const recipe = makePaprikaRecipe({ categories: ["Rescue", "Snack"] });
    const lines = parseRecipeIngredients(recipe, [chickenIngredient]) as PaprikaReviewLine[];
    const { recipe: lib } = buildDraftRecipe(recipe, lines, [chickenIngredient]);
    expect(recipeHasTag(lib, "rescue")).toBe(true);
    expect(recipeMatchesCuratedFilter(lib, "snack")).toBe(true);
    expect(computeTagBoost(lib, { rescueMode: true })).toBeGreaterThan(0);
  });

  it("is idempotent for the same category list", () => {
    const cats = ["Soup", "Italian", "Quick"];
    const a = mapPaprikaCategories(cats);
    const b = mapPaprikaCategories([...cats]);
    expect(a).toEqual(b);
  });
});
