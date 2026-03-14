import type { Ingredient, IngredientCategory, MealComponent } from "./types";
import type { CatalogIngredient } from "./catalog";
import { MASTER_CATALOG } from "./catalog";

export interface ParsedIngredientLine {
  raw: string;
  quantity: string;
  name: string;
  matchedIngredient: Ingredient | null;
  matchedCatalog: CatalogIngredient | null;
  status: "matched" | "catalog" | "unmatched";
}

export interface RecipeImportResult {
  lines: ParsedIngredientLine[];
  sourceUrl: string;
  sourceText: string;
}

const QUANTITY_PATTERN = /^([\d¼½¾⅓⅔⅛⅜⅝⅞.,/\s-]+)\s*(g|kg|ml|l|oz|lb|lbs|cups?|tbsp|tsp|tablespoons?|teaspoons?|pinch(?:es)?|bunch(?:es)?|cloves?|pieces?|slices?|cans?|tins?|packets?|packs?|handfuls?|large|medium|small|x)?\s*/i;

export function parseIngredientLine(line: string): { quantity: string; name: string } {
  const trimmed = line.trim();
  if (!trimmed) return { quantity: "", name: "" };

  // Remove leading bullet points, dashes, asterisks, numbers with dots/parens
  const cleaned = trimmed
    .replace(/^[-•*–—]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();

  const match = cleaned.match(QUANTITY_PATTERN);
  if (match && match[0].length > 0) {
    const quantityPart = match[0].trim();
    const namePart = cleaned.slice(match[0].length).trim();
    if (namePart) {
      return { quantity: quantityPart, name: namePart };
    }
  }

  return { quantity: "", name: cleaned };
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function matchScore(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.7;
  // Check individual words
  const wordsA = na.split(/\s+/);
  const wordsB = nb.split(/\s+/);
  const sharedWords = wordsA.filter((w) => wordsB.some((wb) => wb.includes(w) || w.includes(wb)));
  if (sharedWords.length > 0) {
    return 0.3 + (sharedWords.length / Math.max(wordsA.length, wordsB.length)) * 0.3;
  }
  return 0;
}

export function matchIngredient(
  name: string,
  householdIngredients: Ingredient[],
  catalog: CatalogIngredient[] = MASTER_CATALOG,
): { ingredient: Ingredient | null; catalogItem: CatalogIngredient | null; status: ParsedIngredientLine["status"] } {
  if (!name.trim()) return { ingredient: null, catalogItem: null, status: "unmatched" };

  // Try household ingredients first
  let bestHousehold: Ingredient | null = null;
  let bestHouseholdScore = 0;
  for (const ing of householdIngredients) {
    const score = matchScore(name, ing.name);
    if (score > bestHouseholdScore && score >= 0.5) {
      bestHouseholdScore = score;
      bestHousehold = ing;
    }
  }
  if (bestHousehold) {
    return { ingredient: bestHousehold, catalogItem: null, status: "matched" };
  }

  // Try catalog
  let bestCatalog: CatalogIngredient | null = null;
  let bestCatalogScore = 0;
  for (const ci of catalog) {
    const score = matchScore(name, ci.name);
    if (score > bestCatalogScore && score >= 0.5) {
      bestCatalogScore = score;
      bestCatalog = ci;
    }
  }
  if (bestCatalog) {
    return { ingredient: null, catalogItem: bestCatalog, status: "catalog" };
  }

  return { ingredient: null, catalogItem: null, status: "unmatched" };
}

export function parseRecipeText(
  text: string,
  householdIngredients: Ingredient[],
): RecipeImportResult {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: ParsedIngredientLine[] = lines.map((raw) => {
    const { quantity, name } = parseIngredientLine(raw);
    if (!name) {
      return { raw, quantity: "", name: "", matchedIngredient: null, matchedCatalog: null, status: "unmatched" as const };
    }
    const { ingredient, catalogItem, status } = matchIngredient(name, householdIngredients);
    return {
      raw,
      quantity,
      name,
      matchedIngredient: ingredient,
      matchedCatalog: catalogItem,
      status,
    };
  });

  return { lines: parsed, sourceUrl: "", sourceText: text };
}

export function guessComponentRole(
  category: IngredientCategory,
): MealComponent["role"] {
  switch (category) {
    case "protein": return "protein";
    case "carb": return "carb";
    case "veg":
    case "fruit": return "veg";
    default: return "topping";
  }
}
