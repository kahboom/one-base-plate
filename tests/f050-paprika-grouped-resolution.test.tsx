import { describe, it, expect, beforeEach } from "vitest";
import {
  parsePaprikaRecipes,
  applyGroupResolution,
  buildDraftMeal,
  canFinalizePaprikaImport,
  migrateLegacyPaprikaRecipes,
  saveImportSession,
  loadImportSession,
  groupKeyForParsedName,
  refreshPaprikaSessionParsedLines,
  PAPRIKA_INGREDIENT_PARSER_VERSION,
} from "../src/paprika-parser";
import type { PaprikaRecipe } from "../src/paprika-parser";
import type { Household } from "../src/types";
import { normalizeIngredientName, toSentenceCase, normalizeIngredientGroupKey } from "../src/storage";

function makeHousehold(): Household {
  return {
    id: "h-f050",
    name: "F050",
    members: [],
    ingredients: [
      {
        id: "ing-onion",
        name: "onion",
        category: "veg",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        source: "manual",
      },
    ],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
  };
}

function makeRecipe(overrides: Partial<PaprikaRecipe> = {}): PaprikaRecipe {
  return {
    name: "R",
    ingredients: "1 yellow onion",
    directions: "",
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
    uid: "u1",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("F050 grouped Paprika resolution", () => {
  it("uses the same group key for hyphen vs space flour variants", () => {
    expect(normalizeIngredientGroupKey("All-purpose flour")).toBe(normalizeIngredientGroupKey("All purpose flour"));
    expect(groupKeyForParsedName("all-purpose flour")).toBe(groupKeyForParsedName("all purpose flour"));
  });

  it("groups parsed lines that differ only by hyphenation in the ingredient name", () => {
    const hh = makeHousehold();
    const r1 = makeRecipe({ name: "A", ingredients: "1 cup all-purpose flour" });
    const r2 = makeRecipe({ name: "B", ingredients: "2 tbsp all purpose flour" });
    const parsed = parsePaprikaRecipes([r1, r2], hh.ingredients, []);
    expect(parsed[0]!.parsedLines[0]!.groupKey).toBe(parsed[1]!.parsedLines[0]!.groupKey);
  });

  it("applies one group resolution to all occurrences with same normalized name", () => {
    const hh = makeHousehold();
    const r1 = makeRecipe({ name: "A", ingredients: "1 yellow onion" });
    const r2 = makeRecipe({ name: "B", ingredients: "1 yellow onion, diced" });
    let parsed = parsePaprikaRecipes([r1, r2], hh.ingredients, []);
    const key = parsed[0]!.parsedLines[0]!.groupKey!;
    const ing = hh.ingredients[0]!;
    parsed = applyGroupResolution(parsed, key, {
      kind: "use",
      ingredientId: ing.id,
      ingredient: ing,
    });
    expect(parsed[0]!.parsedLines[0]!.action).toBe("use");
    expect(parsed[1]!.parsedLines[0]!.action).toBe("use");
    expect(parsed[0]!.parsedLines[0]!.resolutionStatus).toBe("resolved");
    expect(parsed[1]!.parsedLines[0]!.resolutionStatus).toBe("resolved");
  });

  it("skips lines with perLineOverride when applying group resolution", () => {
    const hh = makeHousehold();
    const r1 = makeRecipe({ name: "A", ingredients: "1 yellow onion" });
    const r2 = makeRecipe({ name: "B", ingredients: "1 yellow onion" });
    let parsed = parsePaprikaRecipes([r1, r2], hh.ingredients, []);
    parsed[1]!.parsedLines[0] = { ...parsed[1]!.parsedLines[0]!, perLineOverride: true };
    const key = parsed[0]!.parsedLines[0]!.groupKey!;
    const ing = hh.ingredients[0]!;
    parsed = applyGroupResolution(parsed, key, {
      kind: "use",
      ingredientId: ing.id,
      ingredient: ing,
    });
    expect(parsed[0]!.parsedLines[0]!.manualIngredientId).toBe(ing.id);
    expect(parsed[1]!.parsedLines[0]!.manualIngredientId).toBeUndefined();
  });

  it("create-new uses edited canonical name in buildDraftMeal and ImportMapping", () => {
    const hh = makeHousehold();
    const recipe = makeRecipe({ ingredients: "2 chiles de arbol" });
    let parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const line = parsed[0]!.parsedLines[0]!;
    const key = line.groupKey!;
    parsed = applyGroupResolution(parsed, key, {
      kind: "create",
      draft: {
        canonicalName: "chile de arbol",
        category: "veg",
        tags: ["spicy"],
        retainImportAlias: true,
      },
    });
    const pl = parsed[0]!.parsedLines[0]!;
    const { meal, newIngredients } = buildDraftMeal(recipe, [pl], hh.ingredients);
    expect(newIngredients[0]!.name).toBe(normalizeIngredientName("chile de arbol"));
    expect(toSentenceCase(newIngredients[0]!.name)).toBe(toSentenceCase("chile de arbol"));
    expect(newIngredients[0]!.tags.some((t) => t.startsWith("import-alias:"))).toBe(true);
    const m = meal.importMappings!.find((x) => x.action === "create");
    expect(m?.finalCanonicalName).toBe(newIngredients[0]!.name);
  });

  it("blocks finalize while any line is pending", () => {
    const hh = makeHousehold();
    const recipe = makeRecipe({ ingredients: "1 mystery powder" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    expect(canFinalizePaprikaImport(parsed)).toBe(false);
  });

  it("session round-trip preserves grouped fields", () => {
    const hh = makeHousehold();
    const recipe = makeRecipe();
    let parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const ing = hh.ingredients[0]!;
    const key = parsed[0]!.parsedLines[0]!.groupKey!;
    parsed = applyGroupResolution(parsed, key, {
      kind: "use",
      ingredientId: ing.id,
      ingredient: ing,
    });
    saveImportSession({
      householdId: "h-f050",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });
    const loaded = loadImportSession("h-f050");
    expect(loaded?.parsedRecipes[0]?.parsedLines[0]?.manualIngredientId).toBe(ing.id);
  });

  it("refreshPaprikaSessionParsedLines re-parses names from raw (fixes stale session snapshots)", () => {
    const hh = makeHousehold();
    const recipe = makeRecipe({
      ingredients: "[0.23 kg] lb of ñame",
    });
    let parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const staleName = "[0.23 kg] lb of ñame";
    parsed[0]!.parsedLines[0] = {
      ...parsed[0]!.parsedLines[0]!,
      name: staleName,
      groupKey: groupKeyForParsedName(staleName),
    };
    parsed = refreshPaprikaSessionParsedLines(parsed, hh.ingredients);
    expect(parsed[0]!.parsedLines[0]!.name.toLowerCase()).toContain("ñame");
    expect(parsed[0]!.parsedLines[0]!.name).not.toContain("[0.23 kg]");
  });

  it("exposes a parser version for session refresh", () => {
    expect(PAPRIKA_INGREDIENT_PARSER_VERSION).toBeGreaterThanOrEqual(5);
  });

  it("migrateLegacy maps old unmatched+ignore to pending", () => {
    const parsed = parsePaprikaRecipes([makeRecipe({ ingredients: "2 zzzuniquemysteryxyz" })], [], []);
    const legacy = parsed.map((r) => ({
      ...r,
      parsedLines: r.parsedLines.map((l) => {
        const x = { ...l } as typeof l & { resolutionStatus?: string };
        delete (x as { resolutionStatus?: string }).resolutionStatus;
        if (l.status === "unmatched" && l.name) {
          return { ...x, action: "ignore" as const };
        }
        return x;
      }),
    }));
    const mig = migrateLegacyPaprikaRecipes(legacy);
    const line = mig[0]!.parsedLines[0]!;
    expect(line.action).toBe("pending");
    expect(line.resolutionStatus).toBe("pending");
  });
});
