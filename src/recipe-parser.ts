import type { Ingredient, IngredientCategory, MealComponent } from "./types";
import type { CatalogIngredient } from "./catalog";
import { MASTER_CATALOG } from "./catalog";

export interface ParsedIngredientLine {
  raw: string;
  quantity: string;
  unit: string;
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

// Matches leading quantities: integers, decimals (1.5), fractions (1/2), unicode fractions, ranges (1-2)
const QUANTITY_PATTERN = /^([\d¼½¾⅓⅔⅛⅜⅝⅞.,/\s-]+)\s*(g\b|kg\b|ml\b|oz\b|lb\b|lbs\b|cups?\b|tbsp\b|tsp\b|tablespoons?\b|teaspoons?\b|pinch(?:es)?\b|bunch(?:es)?\b|cloves?\b|pieces?\b|slices?\b|cans?\b|tins?\b|packets?\b|packs?\b|handfuls?\b|large\b|medium\b|small\b|x\b|liters?\b|litres?\b|quarts?\b|pints?\b|sticks?\b|heads?\b|stalks?\b|sprigs?\b|dashes?\b|drops?\b)?\s*/i;

// Imperative verbs that suggest an instruction line, not an ingredient
const IMPERATIVE_VERBS = /^(preheat|heat|cook|bake|roast|saut[eé]|boil|simmer|blend|mix|stir|whisk|fold|drain|rinse|combine|serve|garnish|let|place|remove|set|pour|add|season|toss|arrange|slice|dice|chop|mince|grill|fry|broil|marinate|reduce|reserve|note|optional|tip|see)\b/i;

export function isInstructionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Lines starting with * or ** that look like notes/instructions
  if (/^\*{1,2}\s/.test(trimmed)) return true;

  // Unusually long lines are likely instructions or notes (> 80 chars)
  if (trimmed.length > 80) return true;

  // Remove bullet/number prefix for verb check
  const cleaned = trimmed
    .replace(/^[-•*–—]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();

  // Starts with an imperative verb
  if (IMPERATIVE_VERBS.test(cleaned)) return true;

  // Lines that are full sentences ending with periods (and no quantity)
  if (cleaned.endsWith(".") && !QUANTITY_PATTERN.test(cleaned) && cleaned.split(/\s+/).length > 5) return true;

  return false;
}

export function parseIngredientLine(line: string): { quantity: string; unit: string; name: string } {
  const trimmed = line.trim();
  if (!trimmed) return { quantity: "", unit: "", name: "" };

  // Detect instruction lines
  if (isInstructionLine(trimmed)) return { quantity: "", unit: "", name: "" };

  // Remove leading bullet points, dashes, asterisks, numbers with dots/parens (but not decimals like 1.5)
  let cleaned = trimmed
    .replace(/^[-•*–—]\s*/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();

  const match = cleaned.match(QUANTITY_PATTERN);
  if (match && match[0].length > 0) {
    const quantityPart = match[0].trim();
    const rawUnit = (match[2] ?? "").trim();
    let namePart = cleaned.slice(match[0].length).trim();

    if (namePart) {
      // Handle "of" phrasing: "1 cup of flour" → name is "flour"
      namePart = namePart.replace(/^of\s+/i, "");

      // Strip parenthetical notes: "quinoa (any color)" → "quinoa"
      namePart = namePart.replace(/\s*\([^)]*\)\s*/g, " ").trim();

      // Strip preparation suffixes after comma: "lime, zested and squeezed" → "lime"
      namePart = namePart.replace(/,\s*((?:finely|roughly|freshly|thinly|thickly)?\s*(?:diced|chopped|minced|sliced|grated|shredded|julienned|crushed|peeled|cored|seeded|deveined|zested|squeezed|rinsed|drained|trimmed|cubed|halved|quartered|torn|melted|softened|frozen|thawed|toasted|divided|packed|sifted|optional|to taste|for serving|for garnish).*)/i, "").trim();

      // Also strip trailing "rinsed well", "well rinsed" etc. without comma
      namePart = namePart.replace(/\s+(?:rinsed\s+well|well\s+rinsed)$/i, "").trim();

      return { quantity: quantityPart, unit: rawUnit, name: namePart };
    }
  }

  // No quantity found - still strip parenthetical and prep suffixes from name
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  cleaned = cleaned.replace(/,\s*((?:finely|roughly|freshly|thinly|thickly)?\s*(?:diced|chopped|minced|sliced|grated|shredded|julienned|crushed|peeled|cored|seeded|deveined|zested|squeezed|rinsed|drained|trimmed|cubed|halved|quartered|torn|melted|softened|frozen|thawed|toasted|divided|packed|sifted|optional|to taste|for serving|for garnish).*)/i, "").trim();

  return { quantity: "", unit: "", name: cleaned };
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
    const { quantity, unit, name } = parseIngredientLine(raw);
    if (!name) {
      return { raw, quantity: "", unit: "", name: "", matchedIngredient: null, matchedCatalog: null, status: "unmatched" as const };
    }
    const { ingredient, catalogItem, status } = matchIngredient(name, householdIngredients);
    return {
      raw,
      quantity,
      unit,
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
