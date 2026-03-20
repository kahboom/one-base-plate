import JSZip from "jszip";
import type { Ingredient, IngredientCategory, MealComponent, RecipeProvenance, ImportMapping, BaseMeal, RecipeLink } from "./types";
import { matchIngredient, parseIngredientLine, guessComponentRole, isInstructionLine } from "./recipe-parser";
import type { ParsedIngredientLine } from "./recipe-parser";
import { catalogIngredientToHousehold } from "./catalog";
import { normalizeIngredientName } from "./storage";

export interface PaprikaRecipe {
  name: string;
  ingredients: string;
  directions: string;
  notes: string;
  source: string;
  source_url: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  difficulty: string;
  servings: string;
  categories: string[];
  image_url: string;
  photo_data: string | null;
  uid: string;
}

export interface ParsedPaprikaRecipe {
  raw: PaprikaRecipe;
  parsedLines: PaprikaReviewLine[];
  isDuplicate: boolean;
  existingMealId?: string;
  selected: boolean;
}

export interface PaprikaReviewLine extends ParsedIngredientLine {
  action: "use" | "create" | "ignore";
  newCategory: IngredientCategory;
  recipeIndex: number;
  recipeName: string;
}

export interface BulkReviewSummary {
  matched: PaprikaReviewLine[];
  ambiguous: PaprikaReviewLine[];
  createNew: PaprikaReviewLine[];
  ignored: PaprikaReviewLine[];
}

export interface PaprikaImportSession {
  householdId: string;
  parsedRecipes: ParsedPaprikaRecipe[];
  step: "upload" | "select" | "review" | "done";
  savedAt: string;
}

const SESSION_KEY = "onebaseplate_paprika_session";

const MAX_PREP_CHARS = 120_000;
const MAX_NOTES_CHARS = 32_000;
const MAX_IMPORT_MAPPING_LINE_CHARS = 4_000;

/** Paprika often stores HTML; strip tags to shrink persisted JSON and avoid duplicate giant blobs. */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function compactMappingsForStorage(mappings: ImportMapping[]): ImportMapping[] {
  return mappings.map((m) => ({
    ...m,
    originalLine:
      m.originalLine.length > MAX_IMPORT_MAPPING_LINE_CHARS
        ? truncate(m.originalLine, MAX_IMPORT_MAPPING_LINE_CHARS)
        : m.originalLine,
  }));
}

function toSessionRecipeSnapshot(recipe: ParsedPaprikaRecipe): ParsedPaprikaRecipe {
  // Keep only fields needed to resume select/review/import flows.
  const raw: PaprikaRecipe = {
    name: recipe.raw.name ?? "",
    ingredients: "",
    directions: "",
    notes: recipe.raw.notes ?? "",
    source: recipe.raw.source ?? "",
    source_url: recipe.raw.source_url ?? "",
    prep_time: recipe.raw.prep_time ?? "",
    cook_time: recipe.raw.cook_time ?? "",
    total_time: recipe.raw.total_time ?? "",
    difficulty: recipe.raw.difficulty ?? "",
    servings: recipe.raw.servings ?? "",
    categories: Array.isArray(recipe.raw.categories) ? recipe.raw.categories : [],
    image_url: recipe.raw.image_url ?? "",
    photo_data: null,
    uid: recipe.raw.uid ?? "",
  };

  return {
    ...recipe,
    raw,
  };
}

export function saveImportSession(session: PaprikaImportSession): void {
  try {
    const compactSession: PaprikaImportSession = {
      ...session,
      parsedRecipes: session.parsedRecipes.map(toSessionRecipeSnapshot),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(compactSession));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      // Don't crash the import flow when browser storage is full.
      return;
    }
    throw error;
  }
}

export function loadImportSession(householdId: string): PaprikaImportSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as PaprikaImportSession;
    if (session.householdId === householdId) return session;
  } catch {
    // ignore corrupt session
  }
  return null;
}

export function clearImportSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function computeBulkSummary(recipes: ParsedPaprikaRecipe[]): BulkReviewSummary {
  const matched: PaprikaReviewLine[] = [];
  const ambiguous: PaprikaReviewLine[] = [];
  const createNew: PaprikaReviewLine[] = [];
  const ignored: PaprikaReviewLine[] = [];

  for (const recipe of recipes) {
    if (!recipe.selected) continue;
    for (const line of recipe.parsedLines) {
      if (line.status === "unmatched" && line.name && line.action !== "create") {
        ambiguous.push(line);
      } else if (line.action === "ignore") {
        ignored.push(line);
      } else if (line.action === "create") {
        createNew.push(line);
      } else if (line.action === "use" && line.status === "matched") {
        matched.push(line);
      } else {
        ignored.push(line);
      }
    }
  }

  return { matched, ambiguous, createNew, ignored };
}

export function applyBulkAction(
  recipes: ParsedPaprikaRecipe[],
  action: "approve-matched" | "create-all-new" | "ignore-instructions",
): ParsedPaprikaRecipe[] {
  return recipes.map((recipe) => {
    if (!recipe.selected) return recipe;
    const updatedLines = recipe.parsedLines.map((line) => {
      if (action === "approve-matched" && line.status === "matched") {
        return { ...line, action: "use" as const };
      }
      if (action === "create-all-new" && line.status === "unmatched" && line.name) {
        return { ...line, action: "create" as const };
      }
      if (action === "ignore-instructions" && !line.name) {
        return { ...line, action: "ignore" as const };
      }
      return line;
    });
    return { ...recipe, parsedLines: updatedLines };
  });
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const hourMatch = timeStr.match(/(\d+)\s*h/i);
  const minMatch = timeStr.match(/(\d+)\s*m/i);
  let total = 0;
  if (hourMatch) total += parseInt(hourMatch[1]!, 10) * 60;
  if (minMatch) total += parseInt(minMatch[1]!, 10);
  if (total === 0) {
    const numOnly = parseInt(timeStr, 10);
    if (!isNaN(numOnly) && numOnly > 0) total = numOnly;
  }
  return total;
}

function mapDifficulty(diff: string): BaseMeal["difficulty"] {
  const d = (diff ?? "").toLowerCase();
  if (d.includes("easy") || d.includes("simple")) return "easy";
  if (d.includes("hard") || d.includes("difficult") || d.includes("advanced")) return "hard";
  return "medium";
}

export async function parsePaprikaFile(file: File): Promise<PaprikaRecipe[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const recipes: PaprikaRecipe[] = [];

  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir || !filename.endsWith(".paprikarecipe")) continue;
    const compressedData = await entry.async("uint8array");

    let jsonStr: string;
    try {
      // Each .paprikarecipe file is gzip-compressed JSON
      const ds = new DecompressionStream("gzip");
      const writer = ds.writable.getWriter();
      writer.write(compressedData);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      jsonStr = new TextDecoder().decode(merged);
    } catch {
      // If gzip decompression fails, try reading as plain text
      jsonStr = await entry.async("text");
    }

    try {
      const recipe = JSON.parse(jsonStr) as PaprikaRecipe;
      if (recipe.name) {
        recipes.push({
          name: recipe.name ?? "",
          ingredients: recipe.ingredients ?? "",
          directions: recipe.directions ?? "",
          notes: recipe.notes ?? "",
          source: recipe.source ?? "",
          source_url: recipe.source_url ?? "",
          prep_time: recipe.prep_time ?? "",
          cook_time: recipe.cook_time ?? "",
          total_time: recipe.total_time ?? "",
          difficulty: recipe.difficulty ?? "",
          servings: recipe.servings ?? "",
          categories: Array.isArray(recipe.categories) ? recipe.categories : [],
          image_url: recipe.image_url ?? "",
          photo_data: recipe.photo_data ?? null,
          uid: recipe.uid ?? "",
        });
      }
    } catch {
      // Skip unparseable recipe files
    }
  }

  return recipes;
}

export function parseRecipeIngredients(
  recipe: PaprikaRecipe,
  householdIngredients: Ingredient[],
  recipeIndex: number = 0,
): PaprikaReviewLine[] {
  if (!recipe.ingredients) return [];
  const lines = recipe.ingredients
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((raw) => {
    // Check if line is an instruction before parsing
    if (isInstructionLine(raw)) {
      return {
        raw,
        quantity: "",
        unit: "",
        name: "",
        matchedIngredient: null,
        matchedCatalog: null,
        status: "unmatched" as const,
        action: "ignore" as const,
        newCategory: "pantry" as IngredientCategory,
        recipeIndex,
        recipeName: recipe.name,
      };
    }

    const { quantity, unit, quantityValue, name, prepNotes } = parseIngredientLine(raw);
    if (!name) {
      return {
        raw,
        quantity: "",
        unit: "",
        quantityValue: undefined,
        name: "",
        prepNotes: [],
        matchedIngredient: null,
        matchedCatalog: null,
        status: "unmatched" as const,
        action: "ignore" as const,
        newCategory: "pantry" as IngredientCategory,
        recipeIndex,
        recipeName: recipe.name,
      };
    }
    const { ingredient, catalogItem, status } = matchIngredient(name, householdIngredients);
    return {
      raw,
      quantity,
      unit,
      quantityValue,
      name,
      prepNotes,
      matchedIngredient: ingredient,
      matchedCatalog: catalogItem,
      status,
      action: status === "unmatched" ? ("ignore" as const) : status === "catalog" ? ("create" as const) : ("use" as const),
      newCategory: (catalogItem?.category ?? "pantry") as IngredientCategory,
      recipeIndex,
      recipeName: recipe.name,
    };
  });
}

export function detectDuplicateMeal(
  recipeName: string,
  existingMeals: BaseMeal[],
): { isDuplicate: boolean; existingMealId?: string } {
  const normalized = recipeName.toLowerCase().trim();
  for (const meal of existingMeals) {
    if (meal.name.toLowerCase().trim() === normalized) {
      return { isDuplicate: true, existingMealId: meal.id };
    }
  }
  return { isDuplicate: false };
}

export function parsePaprikaRecipes(
  recipes: PaprikaRecipe[],
  householdIngredients: Ingredient[],
  existingMeals: BaseMeal[],
): ParsedPaprikaRecipe[] {
  return recipes.map((raw, i) => {
    const parsedLines = parseRecipeIngredients(raw, householdIngredients, i);
    const { isDuplicate, existingMealId } = detectDuplicateMeal(raw.name, existingMeals);
    return {
      raw,
      parsedLines,
      isDuplicate,
      existingMealId,
      selected: !isDuplicate,
    };
  });
}

export function buildDraftMeal(
  recipe: PaprikaRecipe,
  reviewLines: PaprikaReviewLine[],
): { meal: BaseMeal; newIngredients: Ingredient[] } {
  const newIngredients: Ingredient[] = [];
  const components: MealComponent[] = [];
  const mappings: ImportMapping[] = [];

  for (const line of reviewLines) {
    if (line.action === "ignore") {
      mappings.push({
        originalLine: line.raw,
        parsedName: line.name,
        cleanedIngredientName: line.name,
        parsedQuantityValue: line.quantityValue,
        parsedQuantityUnit: line.unit || undefined,
        prepNotes: line.prepNotes,
        action: "ignore",
        chosenAction: "ignore",
        matchType: "ignored",
      });
      continue;
    }

    if (line.action === "use" && line.matchedIngredient) {
      components.push({
        ingredientId: line.matchedIngredient.id,
        role: guessComponentRole(line.matchedIngredient.category),
        quantity: line.quantity,
        unit: line.unit || undefined,
        prepNote: line.prepNotes?.join(", ") || undefined,
        originalSourceLine: line.raw,
        matchType: "existing",
      });
      mappings.push({
        originalLine: line.raw,
        parsedName: line.name,
        cleanedIngredientName: line.name,
        parsedQuantityValue: line.quantityValue,
        parsedQuantityUnit: line.unit || undefined,
        prepNotes: line.prepNotes,
        action: "use",
        chosenAction: "use",
        ingredientId: line.matchedIngredient.id,
        finalMatchedIngredientId: line.matchedIngredient.id,
        matchType: "existing",
      });
    } else if (line.action === "create") {
      let ing: Ingredient;
      if (line.matchedCatalog) {
        ing = catalogIngredientToHousehold(line.matchedCatalog);
      } else {
        ing = {
          id: crypto.randomUUID(),
          name: normalizeIngredientName(line.name),
          category: line.newCategory,
          tags: [],
          shelfLifeHint: "",
          freezerFriendly: false,
          babySafeWithAdaptation: false,
          source: "manual",
        };
      }
      newIngredients.push(ing);
      components.push({
        ingredientId: ing.id,
        role: guessComponentRole(ing.category),
        quantity: line.quantity,
        unit: line.unit || undefined,
        prepNote: line.prepNotes?.join(", ") || undefined,
        originalSourceLine: line.raw,
        matchType: "new",
      });
      mappings.push({
        originalLine: line.raw,
        parsedName: line.name,
        cleanedIngredientName: line.name,
        parsedQuantityValue: line.quantityValue,
        parsedQuantityUnit: line.unit || undefined,
        prepNotes: line.prepNotes,
        action: "create",
        chosenAction: "create",
        ingredientId: ing.id,
        finalMatchedIngredientId: ing.id,
        matchType: "new",
      });
    }
  }

  const totalTime = parseTimeToMinutes(recipe.total_time);
  const prepTime = parseTimeToMinutes(recipe.prep_time);
  const cookTime = parseTimeToMinutes(recipe.cook_time);

  const provenance: RecipeProvenance = {
    sourceSystem: "paprika",
    externalId: recipe.uid || undefined,
    sourceUrl: recipe.source_url || undefined,
    importTimestamp: new Date().toISOString(),
  };

  const recipeLinks: RecipeLink[] = [];
  if (recipe.source_url) {
    recipeLinks.push({ label: recipe.source || recipe.source_url, url: recipe.source_url });
  }

  const prepText = truncate(stripHtmlToPlainText(recipe.directions), MAX_PREP_CHARS);
  const notesPlain = stripHtmlToPlainText(recipe.notes);
  const notesOut =
    notesPlain && notesPlain !== prepText
      ? truncate(notesPlain, MAX_NOTES_CHARS)
      : undefined;

  const meal: BaseMeal = {
    id: crypto.randomUUID(),
    name: recipe.name,
    components,
    defaultPrep: prepText,
    estimatedTimeMinutes: totalTime || (prepTime + cookTime) || 30,
    difficulty: mapDifficulty(recipe.difficulty),
    rescueEligible: false,
    wasteReuseHints: [],
    recipeLinks: recipeLinks.length > 0 ? recipeLinks : undefined,
    notes: notesOut,
    imageUrl: recipe.image_url || undefined,
    provenance,
    prepTimeMinutes: prepTime || undefined,
    cookTimeMinutes: cookTime || undefined,
    servings: recipe.servings || undefined,
    importMappings: compactMappingsForStorage(mappings),
  };

  return { meal, newIngredients };
}
