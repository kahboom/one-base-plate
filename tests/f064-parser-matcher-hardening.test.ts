import { describe, it, expect } from "vitest";
import {
  parseIngredientLine,
  matchIngredient,
  matchScore,
  singularize,
  normalizeForMatching,
} from "../src/recipe-parser";
import { normalizeIngredientGroupKey } from "../src/storage";
import { MASTER_CATALOG } from "../src/catalog";
import type { Ingredient } from "../src/types";

function ing(id: string, name: string, category: Ingredient["category"] = "veg"): Ingredient {
  return {
    id, name, category, tags: [], shelfLifeHint: "",
    freezerFriendly: false, babySafeWithAdaptation: false, source: "manual",
  };
}

describe("F064 — Packaging word stripping", () => {
  it("400g can chopped tomatoes → tomatoes", () => {
    const r = parseIngredientLine("400g can chopped tomatoes");
    expect(r.name.toLowerCase()).toBe("tomatoes");
  });

  it("400g can chopped tomato → tomato", () => {
    const r = parseIngredientLine("400g can chopped tomato");
    expect(r.name.toLowerCase()).toBe("tomato");
  });

  it("400g can coconut milk → coconut milk", () => {
    const r = parseIngredientLine("400g can coconut milk");
    expect(r.name.toLowerCase()).toBe("coconut milk");
  });

  it("400g can chickpeas in water, drained but liquid reserved → chickpeas", () => {
    const r = parseIngredientLine("400g can chickpeas in water, drained but liquid reserved");
    expect(r.name.toLowerCase()).toBe("chickpeas");
  });

  it("500g pack gnocchi → gnocchi", () => {
    const r = parseIngredientLine("500g pack gnocchi");
    expect(r.name.toLowerCase()).toBe("gnocchi");
  });

  it("200g bag baby spinach → spinach (or baby spinach)", () => {
    const r = parseIngredientLine("200g bag baby spinach");
    expect(r.name.toLowerCase()).toMatch(/spinach/);
  });

  it("1 (14.5 ounce) can Italian-style stewed tomatoes → matches tomatoes", () => {
    const r = parseIngredientLine("1 (14.5 ounce) can Italian-style stewed tomatoes");
    expect(r.name.toLowerCase()).toMatch(/tomatoes/);
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
  });
});

describe("F064 — Trailing quantity parsing", () => {
  it("chicken stock 200ml → name=chicken stock, qty=200, unit=ml", () => {
    const r = parseIngredientLine("chicken stock 200ml");
    expect(r.name.toLowerCase()).toBe("chicken stock");
    expect(r.quantity).toBe("200");
    expect(r.unit.toLowerCase()).toBe("ml");
  });

  it("chicken stock 1.2 litres → name=chicken stock", () => {
    const r = parseIngredientLine("chicken stock 1.2 litres");
    expect(r.name.toLowerCase()).toBe("chicken stock");
  });

  it("olive oil 100ml → name=olive oil", () => {
    const r = parseIngredientLine("olive oil 100ml");
    expect(r.name.toLowerCase()).toBe("olive oil");
  });

  it("baby plum tomatoes 300g, halved → name matches tomatoes", () => {
    const r = parseIngredientLine("baby plum tomatoes 300g, halved");
    expect(r.name.toLowerCase()).toMatch(/tomatoes/);
  });

  it("baby leeks 6 → name matches leeks", () => {
    const r = parseIngredientLine("baby leeks 6");
    expect(r.name.toLowerCase()).toMatch(/leek/);
  });

  it("spinach and ricotta tortellini 1 pack → name contains tortellini, NOT spinach alone", () => {
    const r = parseIngredientLine("spinach and ricotta tortellini 1 pack");
    expect(r.name.toLowerCase()).toContain("tortellini");
  });
});

describe("F064 — Embedded size/dimension stripping", () => {
  it("2 6-inch persian cucumbers → name ~ cucumbers", () => {
    const r = parseIngredientLine("2 6-inch persian cucumbers");
    expect(r.name.toLowerCase()).toMatch(/cucumbers?/);
    expect(r.name.toLowerCase()).not.toContain("6-inch");
    expect(r.name.toLowerCase()).not.toContain("6 inch");
  });

  it("1 3-inch piece parmesan cheese rind → parmesan", () => {
    const r = parseIngredientLine("1 3-inch piece parmesan cheese rind");
    expect(r.name.toLowerCase()).toMatch(/parmesan/);
  });

  it("1 10-ounce package frozen peas → peas", () => {
    const r = parseIngredientLine("1 10-ounce package frozen peas");
    expect(r.name.toLowerCase()).toMatch(/peas/);
  });

  it("1 2-pound savoy cabbage → savoy cabbage or cabbage", () => {
    const r = parseIngredientLine("1 2-pound savoy cabbage");
    expect(r.name.toLowerCase()).toMatch(/cabbage/);
  });

  it("3/4 pound 1/2-inch-thick boneless sirloin steak → sirloin steak or steak", () => {
    const r = parseIngredientLine("3/4 pound 1/2-inch-thick boneless sirloin steak");
    expect(r.name.toLowerCase()).toMatch(/steak/);
    expect(r.name.toLowerCase()).not.toContain("1/2-inch");
  });
});

describe("F064 — Size/descriptor stripping", () => {
  it("1 large onion thinly sliced → name=onion, prepNotes contains sliced", () => {
    const r = parseIngredientLine("1 large onion thinly sliced");
    expect(r.name.toLowerCase()).toBe("onion");
    expect(r.prepNotes?.some((n) => n.includes("sliced"))).toBe(true);
  });

  it("Large potatoes → potatoes", () => {
    const r = parseIngredientLine("Large potatoes");
    expect(r.name.toLowerCase()).toBe("potatoes");
  });

  it("1 large quantity mashed potatoes → mashed potatoes or potatoes", () => {
    const r = parseIngredientLine("1 large quantity mashed potatoes");
    expect(r.name.toLowerCase()).toMatch(/potatoes/);
  });

  it("1-2 large pieces of kale → kale", () => {
    const r = parseIngredientLine("1-2 large pieces of kale");
    expect(r.name.toLowerCase()).toBe("kale");
  });

  it("3 bell peppers thinly sliced → bell peppers", () => {
    const r = parseIngredientLine("3 bell peppers thinly sliced");
    expect(r.name.toLowerCase()).toMatch(/bell pepper/);
  });

  it("1 lime cut into wedges → lime with prep note", () => {
    const r = parseIngredientLine("1 lime cut into wedges");
    expect(r.name.toLowerCase()).toBe("lime");
    expect(r.prepNotes?.some((n) => n.includes("wedges"))).toBe(true);
  });

  it("2 cups lightly packed baby spinach leaves → spinach", () => {
    const r = parseIngredientLine("2 cups lightly packed baby spinach leaves");
    expect(r.name.toLowerCase()).toMatch(/spinach/);
  });

  it("Hot cooked rice, for serving → name contains rice and matches Rice in catalog", () => {
    const r = parseIngredientLine("Hot cooked rice, for serving");
    expect(r.name.toLowerCase()).toMatch(/rice/);
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toBe("rice");
  });
});

describe("F064 — Singular/plural normalization", () => {
  it("singularize basic plurals", () => {
    expect(singularize("tomatoes")).toBe("tomato");
    expect(singularize("potatoes")).toBe("potato");
    expect(singularize("leeks")).toBe("leek");
    expect(singularize("cucumbers")).toBe("cucumber");
    expect(singularize("buns")).toBe("bun");
    expect(singularize("eggs")).toBe("egg");
    expect(singularize("peppers")).toBe("pepper");
  });

  it("preserves exception words", () => {
    expect(singularize("hummus")).toBe("hummus");
    expect(singularize("couscous")).toBe("couscous");
    expect(singularize("gnocchi")).toBe("gnocchi");
    expect(singularize("tortellini")).toBe("tortellini");
    expect(singularize("peas")).toBe("peas");
    expect(singularize("chickpeas")).toBe("chickpeas");
  });

  it("chopped tomato and chopped tomatoes produce same group key", () => {
    const r1 = parseIngredientLine("400g can chopped tomato");
    const r2 = parseIngredientLine("400g can chopped tomatoes");
    const k1 = normalizeIngredientGroupKey(r1.name);
    const k2 = normalizeIngredientGroupKey(r2.name);
    expect(k1).toBe(k2);
  });

  it("Large potatoes matches catalog Potatoes", () => {
    const r = parseIngredientLine("Large potatoes");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/potato/);
  });

  it("normalizeForMatching handles singular/plural", () => {
    const a = normalizeForMatching("tomatoes");
    const b = normalizeForMatching("tomato");
    expect(a).toBe(b);
  });
});

describe("F064 — Tomato family matching", () => {
  it("Italian stewed tomatoes → matches Tomatoes in catalog", () => {
    const r = parseIngredientLine("Italian stewed tomatoes");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
  });

  it("Italian-style plum tomatoes → matches Tomatoes in catalog", () => {
    const r = parseIngredientLine("Italian-style plum tomatoes");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
  });

  it("Italian-style stewed tomatoes → matches Tomatoes in catalog", () => {
    const r = parseIngredientLine("Italian-style stewed tomatoes");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
  });

  it("chopped tomatoes match via catalog alias", () => {
    const m = matchIngredient("chopped tomatoes", [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
  });

  it("dashes vs spaces: Italian style vs Italian-style both work", () => {
    const r1 = parseIngredientLine("Italian-style stewed tomatoes");
    const r2 = parseIngredientLine("Italian style stewed tomatoes");
    const m1 = matchIngredient(r1.name, [], MASTER_CATALOG);
    const m2 = matchIngredient(r2.name, [], MASTER_CATALOG);
    expect(m1.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
    expect(m2.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
  });
});

describe("F064 — Unicode/accent preservation", () => {
  it("ñame parses cleanly with accent preserved", () => {
    const r = parseIngredientLine("1 lb ñame");
    expect(r.name).toContain("ñame");
  });

  it("yautía parses cleanly with accent preserved", () => {
    const r = parseIngredientLine("2 yautía");
    expect(r.name).toContain("yautía");
  });

  it("normalizeForMatching preserves accented characters", () => {
    const result = normalizeForMatching("ñame");
    expect(result).toContain("ñame");
  });
});

describe("F064 — Compound name protection", () => {
  it("coconut milk does NOT match plain milk", () => {
    const household = [ing("milk-id", "milk", "dairy")];
    const m = matchIngredient("coconut milk", household);
    if (m.status === "matched") {
      expect(m.ingredient?.name.toLowerCase()).not.toBe("milk");
    }
  });

  it("spinach and ricotta tortellini does NOT match spinach", () => {
    const household = [ing("spinach-id", "spinach", "veg")];
    const m = matchIngredient("spinach and ricotta tortellini", household);
    if (m.status === "matched") {
      expect(m.ingredient?.name.toLowerCase()).not.toBe("spinach");
    }
  });

  it("chicken stock does NOT match stock cubes", () => {
    const m = matchIngredient("chicken stock", [], MASTER_CATALOG);
    if (m.catalogItem) {
      expect(m.catalogItem.name.toLowerCase()).not.toBe("stock cubes");
    }
  });

  it("olive oil 100ml matches olive oil (household)", () => {
    const household = [ing("oil-id", "olive oil", "pantry")];
    const r = parseIngredientLine("olive oil 100ml");
    const m = matchIngredient(r.name, household);
    expect(m.status).toBe("matched");
    expect(m.ingredient?.name.toLowerCase()).toBe("olive oil");
  });

  it("chicken stock 200ml matches chicken stock (household)", () => {
    const household = [ing("stock-id", "chicken stock", "pantry")];
    const r = parseIngredientLine("chicken stock 200ml");
    const m = matchIngredient(r.name, household);
    expect(m.status).toBe("matched");
    expect(m.ingredient?.name.toLowerCase()).toBe("chicken stock");
  });

  it("taco seasoning stays intact and matches", () => {
    const m = matchIngredient("taco seasoning", [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toBe("taco seasoning");
  });
});

describe("F064 — No regressions on existing parsing", () => {
  it("200g chicken breast still matches", () => {
    const household = [ing("chicken-id", "chicken breast", "protein")];
    const r = parseIngredientLine("200g chicken breast");
    expect(r.name.toLowerCase()).toBe("chicken breast");
    const m = matchIngredient(r.name, household);
    expect(m.status).toBe("matched");
  });

  it("1 cup rice still matches", () => {
    const household = [ing("rice-id", "rice", "carb")];
    const r = parseIngredientLine("1 cup rice");
    expect(r.name.toLowerCase()).toBe("rice");
    const m = matchIngredient(r.name, household);
    expect(m.status).toBe("matched");
  });

  it("1 pinch of salt still parses correctly", () => {
    const r = parseIngredientLine("1 pinch of salt");
    expect(r.name.toLowerCase()).toBe("salt");
  });

  it("1 cup quinoa (any color), rinsed well still works", () => {
    const r = parseIngredientLine("1 cup quinoa (any color), rinsed well");
    expect(r.name.toLowerCase()).toBe("quinoa");
    expect(r.prepNotes).toContain("any color");
  });

  it("3 tbsp olive oil still matches", () => {
    const r = parseIngredientLine("3 tbsp olive oil");
    expect(r.name.toLowerCase()).toBe("olive oil");
  });

  it("4 cups low-sodium beef broth → beef broth", () => {
    const r = parseIngredientLine("4 cups low-sodium beef broth");
    expect(r.name.toLowerCase()).toBe("beef broth");
  });

  it("1 can cannellini beans → cannellini beans", () => {
    const r = parseIngredientLine("1 can cannellini beans");
    expect(r.name.toLowerCase()).toBe("cannellini beans");
  });

  it("2 cups diced tomatoes → tomatoes", () => {
    const r = parseIngredientLine("2 cups diced tomatoes");
    expect(r.name.toLowerCase()).toBe("tomatoes");
  });

  it("1/2 cup grated Parmesan → Parmesan", () => {
    const r = parseIngredientLine("1/2 cup grated Parmesan");
    expect(r.name.toLowerCase()).toMatch(/parmesan/);
  });

  it("1 lime, zested and squeezed → lime", () => {
    const r = parseIngredientLine("1 lime, zested and squeezed");
    expect(r.name.toLowerCase()).toBe("lime");
  });

  it("3 skinless, boneless chicken breasts → chicken breast", () => {
    const r = parseIngredientLine("3 skinless, boneless chicken breasts");
    expect(r.name.toLowerCase()).toBe("chicken breast");
  });

  it("matchScore gives 1 for identical strings", () => {
    expect(matchScore("tomatoes", "tomatoes")).toBe(1);
    expect(matchScore("olive oil", "olive oil")).toBe(1);
  });

  it("matchScore handles singular/plural via singularization", () => {
    expect(matchScore("tomato", "tomatoes")).toBe(1);
    expect(matchScore("potato", "potatoes")).toBe(1);
    expect(matchScore("leek", "leeks")).toBe(1);
  });
});

describe("F064 — Catalog matching for new entries", () => {
  it("chicken stock matches cat-chicken-stock", () => {
    const m = matchIngredient("chicken stock", [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.id).toBe("cat-chicken-stock");
  });

  it("leeks matches cat-leek", () => {
    const m = matchIngredient("leeks", [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/leek/);
  });

  it("gnocchi matches cat-gnocchi", () => {
    const m = matchIngredient("gnocchi", [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name.toLowerCase()).toBe("gnocchi");
  });

  it("kale matches cat-kale", () => {
    const m = matchIngredient("kale", [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name.toLowerCase()).toBe("kale");
  });

  it("cabbage matches cat-cabbage", () => {
    const m = matchIngredient("cabbage", [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name.toLowerCase()).toBe("cabbage");
  });

  it("hamburger buns matches cat-hamburger-buns", () => {
    const m = matchIngredient("hamburger buns", [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/hamburger bun/);
  });
});

describe("F064 — End-to-end parsing + matching", () => {
  it("400g can chopped tomatoes → catalog match to tomatoes", () => {
    const r = parseIngredientLine("400g can chopped tomatoes");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/tomato/);
  });

  it("400g can coconut milk → catalog match to coconut milk", () => {
    const r = parseIngredientLine("400g can coconut milk");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toBe("coconut milk");
  });

  it("baby leeks 6 → catalog match to leek", () => {
    const r = parseIngredientLine("baby leeks 6");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/leek/);
  });

  it("olive oil 100ml → catalog match to olive oil", () => {
    const r = parseIngredientLine("olive oil 100ml");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toBe("olive oil");
  });

  it("chicken stock 200ml → catalog match to chicken stock", () => {
    const r = parseIngredientLine("chicken stock 200ml");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.catalogItem?.name.toLowerCase()).toMatch(/chicken stock/);
  });

  it("400g can chopped tomato and 400g can chopped tomatoes resolve consistently", () => {
    const r1 = parseIngredientLine("400g can chopped tomato");
    const r2 = parseIngredientLine("400g can chopped tomatoes");
    const m1 = matchIngredient(r1.name, [], MASTER_CATALOG);
    const m2 = matchIngredient(r2.name, [], MASTER_CATALOG);
    expect(m1.catalogItem?.id).toBeTruthy();
    expect(m1.catalogItem?.id).toBe(m2.catalogItem?.id);
  });

  it("spinach and ricotta tortellini 1 pack → does NOT match spinach in household", () => {
    const household = [ing("spinach-id", "spinach", "veg")];
    const r = parseIngredientLine("spinach and ricotta tortellini 1 pack");
    const m = matchIngredient(r.name, household);
    if (m.status === "matched") {
      expect(m.ingredient?.name.toLowerCase()).not.toBe("spinach");
    }
  });
});

describe("F064 — Passata / compound catalog matching", () => {
  it("-700g jar tomato passata → name = 'tomato passata', matches Passata not Tomatoes", () => {
    const r = parseIngredientLine("-700g jar tomato passata");
    expect(r.name.toLowerCase()).toBe("tomato passata");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name).toBe("Passata");
  });

  it("700g jar passata → matches Passata", () => {
    const r = parseIngredientLine("700g jar passata");
    expect(r.name.toLowerCase()).toBe("passata");
    const m = matchIngredient(r.name, [], MASTER_CATALOG);
    expect(m.status).toBe("catalog");
    expect(m.catalogItem?.name).toBe("Passata");
  });
});

describe("F064 — Group key normalization", () => {
  it("tomato and tomatoes produce same group key", () => {
    expect(normalizeIngredientGroupKey("tomato")).toBe(normalizeIngredientGroupKey("tomatoes"));
  });

  it("potato and potatoes produce same group key", () => {
    expect(normalizeIngredientGroupKey("potato")).toBe(normalizeIngredientGroupKey("potatoes"));
  });

  it("leek and leeks produce same group key", () => {
    expect(normalizeIngredientGroupKey("leek")).toBe(normalizeIngredientGroupKey("leeks"));
  });

  it("all-purpose flour and all purpose flour produce same group key", () => {
    expect(normalizeIngredientGroupKey("all-purpose flour")).toBe(normalizeIngredientGroupKey("all purpose flour"));
  });
});
