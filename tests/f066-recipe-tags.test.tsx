import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Household, Recipe } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import {
  CURATED_RECIPE_TAGS,
  compareRecipesForSuggestion,
  computeTagBoost,
  isCuratedTag,
  normalizeRecipeTagForCurated,
  recipeHasTag,
  recipeMatchesCuratedFilter,
  recipeTagLabel,
  tagContextScore,
} from "../src/lib/recipeTags";
import RecipeLibrary from "../src/pages/RecipeLibrary";

function makeRecipe(overrides: Partial<Recipe> & { id: string; name: string }): Recipe {
  return {
    components: [],
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h-f066",
    name: "F066 Test",
    members: [
      {
        id: "m1",
        name: "A",
        role: "adult",
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
    ],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("F066: curated tag model", () => {
  it("exposes the expected curated values", () => {
    const values = CURATED_RECIPE_TAGS.map((t) => t.value);
    expect(values).toEqual([
      "whole-meal",
      "quick",
      "batch-prep",
      "freezer-friendly",
      "rescue",
      "side",
      "salad",
      "snack",
      "bread",
      "seafood",
      "soup",
      "sauce",
      "kid-friendly",
      "prep-ahead",
    ]);
  });

  it("isCuratedTag and recipeTagLabel work for curated tags", () => {
    expect(isCuratedTag("quick")).toBe(true);
    expect(isCuratedTag("taco")).toBe(false);
    expect(recipeTagLabel("quick")).toBe("Quick");
    expect(recipeTagLabel("whole-meal")).toBe("Entree");
    expect(recipeTagLabel("unknown-custom")).toBe("unknown-custom");
  });

  it("maps legacy batch-friendly to batch-prep for normalization", () => {
    expect(normalizeRecipeTagForCurated("batch-friendly")).toBe("batch-prep");
    expect(normalizeRecipeTagForCurated("rescue-friendly")).toBe("rescue");
  });
});

describe("F066: recipeMatchesCuratedFilter and legacy tags", () => {
  it("matches batch-friendly when filtering for batch-prep", () => {
    const r = makeRecipe({
      id: "r1",
      name: "X",
      tags: ["batch-friendly", "taco"],
    });
    expect(recipeMatchesCuratedFilter(r, "batch-prep")).toBe(true);
    expect(recipeMatchesCuratedFilter(r, "quick")).toBe(false);
  });

  it("preserves unknown tags in data without breaking membership checks", () => {
    const r = makeRecipe({ id: "r1", name: "Y", tags: ["taco", "quick"] });
    expect(recipeHasTag(r, "quick")).toBe(true);
    expect(recipeMatchesCuratedFilter(r, "quick")).toBe(true);
  });
});

describe("F066: computeTagBoost (weak)", () => {
  it("returns a small boost for rescue + quick when rescueMode", () => {
    const r = makeRecipe({
      id: "r1",
      name: "A",
      tags: ["rescue", "quick"],
    });
    const b = computeTagBoost(r, { rescueMode: true });
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThanOrEqual(0.15);
  });

  it("boosts batch-prep / prep-ahead slightly", () => {
    const r = makeRecipe({
      id: "r1",
      name: "B",
      tags: ["batch-prep", "prep-ahead"],
    });
    expect(computeTagBoost(r, {})).toBeGreaterThan(0);
  });
});

describe("F066: tagContextScore and compareRecipesForSuggestion", () => {
  it("prefers recipe with sauce tag for sauce role when names match", () => {
    const withSauce = makeRecipe({
      id: "a",
      name: "Tomato dip",
      tags: ["sauce"],
    });
    const withoutSauce = makeRecipe({
      id: "b",
      name: "Tomato dip",
      tags: [],
    });
    const order = compareRecipesForSuggestion(
      withSauce,
      withoutSauce,
      "tomato",
      { componentRole: "sauce" },
    );
    /* sb - sa for second arg higher score: negative means first wins */
    expect(order).toBeLessThan(0);
  });

  it("uses tag boost as tie-breaker when structure is comparable", () => {
    const quick = makeRecipe({
      id: "a",
      name: "Same",
      tags: ["quick", "rescue"],
    });
    const plain = makeRecipe({
      id: "b",
      name: "Same",
      tags: [],
    });
    const order = compareRecipesForSuggestion(quick, plain, "", { rescueMode: true });
    expect(order).toBeLessThan(0);
  });
});

describe("F066: tagContextScore", () => {
  it("scores sauce tag for sauce role", () => {
    const r = makeRecipe({ id: "1", name: "S", tags: ["sauce"] });
    expect(tagContextScore(r, { componentRole: "sauce" })).toBe(28);
  });

  it("does not score recipe without sauce tag for sauce role", () => {
    const r = makeRecipe({ id: "1", name: "S", tags: ["quick"] });
    expect(tagContextScore(r, { componentRole: "sauce" })).toBe(0);
  });
});

describe("F066: Recipe library UI", () => {
  it("filters by tag and clears; search + tag combine", async () => {
    const user = userEvent.setup();
    const recipes = [
      makeRecipe({
        id: "r1",
        name: "Alpha chicken",
        tags: ["quick", "taco"],
        components: [],
      }),
      makeRecipe({
        id: "r2",
        name: "Beta soup",
        tags: ["batch-friendly"],
        components: [],
      }),
    ];
    saveHousehold(makeHousehold({ recipes }));

    render(
      <MemoryRouter initialEntries={["/household/h-f066/recipes"]}>
        <Routes>
          <Route path="/household/:householdId/recipes" element={<RecipeLibrary />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("recipe-tag-filter-quick"));
    expect(screen.getByTestId("recipe-row-r1")).toBeInTheDocument();
    expect(screen.queryByTestId("recipe-row-r2")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("recipe-tag-filter-clear"));
    expect(screen.getByTestId("recipe-row-r2")).toBeInTheDocument();

    await user.click(screen.getByTestId("recipe-tag-filter-batch-prep"));
    expect(screen.getByTestId("recipe-row-r2")).toBeInTheDocument();
    expect(screen.queryByTestId("recipe-row-r1")).not.toBeInTheDocument();

    const search = screen.getByTestId("recipe-search");
    await user.clear(search);
    await user.type(search, "Alpha");
    expect(screen.getByTestId("recipe-library-no-matches")).toBeInTheDocument();
  });

  it("shows tag chips on rows when tags exist and omits tag region when empty", () => {
    saveHousehold(
      makeHousehold({
        recipes: [
          makeRecipe({ id: "r-t", name: "Tagged", tags: ["quick"], components: [] }),
          makeRecipe({ id: "r-n", name: "Naked", components: [] }),
        ],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/household/h-f066/recipes"]}>
        <Routes>
          <Route path="/household/:householdId/recipes" element={<RecipeLibrary />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("recipe-row-tags")).toBeInTheDocument();
    const naked = screen.getByTestId("recipe-row-r-n");
    expect(within(naked).queryByTestId("recipe-row-tags")).not.toBeInTheDocument();
  });
});

describe("F066: recipe edit tags persistence", () => {
  it("round-trips curated tags on save/load", () => {
    const r = makeRecipe({
      id: "r1",
      name: "T",
      tags: ["quick", "prep-ahead"],
      components: [],
    });
    saveHousehold(makeHousehold({ recipes: [r] }));
    const loaded = loadHousehold("h-f066")!;
    expect(loaded.recipes![0]!.tags).toEqual(["quick", "prep-ahead"]);
  });

  it("adds a curated tag from the recipe modal chip picker", async () => {
    const user = userEvent.setup();
    saveHousehold(
      makeHousehold({
        recipes: [makeRecipe({ id: "r1", name: "Edit me", components: [] })],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/household/h-f066/recipes"]}>
        <Routes>
          <Route path="/household/:householdId/recipes" element={<RecipeLibrary />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("recipe-row-r1"));
    await user.click(screen.getByTestId("recipe-organization-section"));
    await user.click(screen.getByTestId("recipe-tag-chip-quick"));
    const loaded = loadHousehold("h-f066")!;
    expect(loaded.recipes![0]!.tags).toContain("quick");
  });
});

