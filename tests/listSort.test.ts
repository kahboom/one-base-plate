import { describe, it, expect } from "vitest";
import { sortBaseMeals, sortIngredients } from "../src/lib/listSort";
import type { BaseMeal, Ingredient } from "../src/types";

function meal(overrides: Partial<BaseMeal> & { id: string; name: string }): BaseMeal {
  const { id, name, ...rest } = overrides;
  return {
    id,
    name,
    components: [],
    defaultPrep: "",
    estimatedTimeMinutes: 30,
    difficulty: "easy",
    rescueEligible: false,
    wasteReuseHints: [],
    ...rest,
  };
}

describe("sortBaseMeals", () => {
  it("sorts by name ascending", () => {
    const a = meal({ id: "1", name: "Zebra" });
    const b = meal({ id: "2", name: "Apple" });
    const out = sortBaseMeals([a, b], "name", "asc");
    expect(out.map((m) => m.name)).toEqual(["Apple", "Zebra"]);
  });

  it("sorts by difficulty easy to hard when asc", () => {
    const h = meal({ id: "1", name: "h", difficulty: "hard" });
    const e = meal({ id: "2", name: "e", difficulty: "easy" });
    const m = meal({ id: "3", name: "m", difficulty: "medium" });
    const out = sortBaseMeals([h, e, m], "difficulty", "asc");
    expect(out.map((x) => x.difficulty)).toEqual(["easy", "medium", "hard"]);
  });

  it("sorts by estimated time", () => {
    const long = meal({ id: "1", name: "a", estimatedTimeMinutes: 60 });
    const short = meal({ id: "2", name: "b", estimatedTimeMinutes: 15 });
    const out = sortBaseMeals([long, short], "estimatedTimeMinutes", "asc");
    expect(out.map((x) => x.estimatedTimeMinutes)).toEqual([15, 60]);
  });

  it("sorts by component count", () => {
    const one = meal({ id: "1", name: "a", components: [{ ingredientId: "i", role: "protein", quantity: "1" }] });
    const none = meal({ id: "2", name: "b", components: [] });
    const out = sortBaseMeals([one, none], "componentCount", "asc");
    expect(out.map((x) => x.components.length)).toEqual([0, 1]);
  });
});

describe("sortIngredients", () => {
  it("sorts by category then name within stable sort", () => {
    const i1: Ingredient = {
      id: "1",
      name: "Z",
      category: "veg",
      tags: [],
      shelfLifeHint: "",
      freezerFriendly: false,
      babySafeWithAdaptation: false,
    };
    const i2: Ingredient = {
      id: "2",
      name: "A",
      category: "protein",
      tags: [],
      shelfLifeHint: "",
      freezerFriendly: false,
      babySafeWithAdaptation: false,
    };
    const out = sortIngredients([i1, i2], "category", "asc");
    expect(out.map((x) => x.category)).toEqual(["protein", "veg"]);
  });
});
