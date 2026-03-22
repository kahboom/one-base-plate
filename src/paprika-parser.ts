import JSZip from "jszip";
import type {
  Ingredient,
  IngredientCategory,
  MealComponent,
  RecipeProvenance,
  ImportMapping,
  BaseMeal,
  RecipeLink,
  Recipe,
} from "./types";
import { promoteRecipeToBaseMeal } from "./lib/promoteRecipe";
import { matchIngredient, parseIngredientLine, guessComponentRole, isInstructionLine } from "./recipe-parser";
import type { ParsedIngredientLine } from "./recipe-parser";
import type { MatchConfidenceBand } from "./recipe-parser";
import { catalogIngredientToHousehold } from "./catalog";
import type { CatalogIngredient } from "./catalog";
import { normalizeIngredientName, normalizeIngredientGroupKey } from "./storage";

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
  existingRecipeId?: string;
  selected: boolean;
}

export interface PaprikaCreateDraft {
  canonicalName: string;
  category: IngredientCategory;
  tags: string[];
  retainImportAlias: boolean;
}

export interface PaprikaReviewLine extends ParsedIngredientLine {
  action: "use" | "create" | "ignore" | "pending";
  newCategory: IngredientCategory;
  recipeIndex: number;
  recipeName: string;
  matchScore?: number;
  confidenceBand?: MatchConfidenceBand;
  resolutionStatus: "pending" | "resolved";
  lowConfidenceAccepted?: boolean;
  /** User override when choosing a different household ingredient than the parser suggestion */
  manualIngredientId?: string;
  createDraft?: PaprikaCreateDraft;
  perLineOverride?: boolean;
  /** normalizeIngredientGroupKey(parsed name) for grouping */
  groupKey?: string;
  /** Group ignore action explicitly chosen */
  explicitIgnore?: boolean;
  parserSuggestedIngredientId?: string;
  parserSuggestedCatalogId?: string;
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
  /** Bump when ingredient line parsing changes; stale sessions re-parse from each line’s `raw`. */
  importParserVersion?: number;
}

const SESSION_KEY = "onebaseplate_paprika_session";

/** Increment when Paprika line parsing / matching rules change so saved sessions refresh from `raw`. */
export const PAPRIKA_INGREDIENT_PARSER_VERSION = 6;

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
      importParserVersion: PAPRIKA_INGREDIENT_PARSER_VERSION,
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
      if (line.resolutionStatus === "pending") {
        ambiguous.push(line);
      } else if (line.action === "ignore") {
        ignored.push(line);
      } else if (line.action === "create") {
        createNew.push(line);
      } else if (line.action === "use" && line.status === "matched") {
        matched.push(line);
      } else if (line.action === "pending") {
        ambiguous.push(line);
      } else {
        ignored.push(line);
      }
    }
  }

  return { matched, ambiguous, createNew, ignored };
}

export function countLowConfidencePending(recipes: ParsedPaprikaRecipe[]): number {
  let n = 0;
  for (const recipe of recipes) {
    if (!recipe.selected) continue;
    for (const line of recipe.parsedLines) {
      if (
        line.resolutionStatus === "pending" &&
        line.confidenceBand === "low" &&
        (line.status === "matched" || line.status === "catalog")
      ) {
        n += 1;
      }
    }
  }
  return n;
}

export function applyBulkAction(
  recipes: ParsedPaprikaRecipe[],
  action: "approve-matched" | "create-all-new" | "ignore-instructions",
): ParsedPaprikaRecipe[] {
  return recipes.map((recipe) => {
    if (!recipe.selected) return recipe;
    const updatedLines = recipe.parsedLines.map((line) => {
      if (action === "approve-matched" && line.status === "matched") {
        return {
          ...line,
          action: "use" as const,
          resolutionStatus: "resolved" as const,
          lowConfidenceAccepted: line.confidenceBand === "low" ? true : line.lowConfidenceAccepted,
        };
      }
      if (action === "approve-matched" && line.status === "catalog" && line.confidenceBand === "low") {
        return {
          ...line,
          resolutionStatus: "resolved" as const,
          lowConfidenceAccepted: true,
        };
      }
      if (action === "create-all-new" && line.status === "unmatched" && line.name) {
        return {
          ...line,
          action: "create" as const,
          resolutionStatus: "resolved" as const,
          matchedIngredient: null,
          matchedCatalog: null,
          status: "unmatched" as const,
        };
      }
      if (action === "ignore-instructions" && !line.name) {
        return { ...line, action: "ignore" as const, resolutionStatus: "resolved" as const };
      }
      return line;
    });
    return { ...recipe, parsedLines: updatedLines };
  });
}

export interface PaprikaLineRef {
  line: PaprikaReviewLine;
  globalRecipeIdx: number;
  lineIdx: number;
}

export interface PaprikaIngredientGroup {
  groupKey: string;
  parsedName: string;
  lines: PaprikaLineRef[];
}

export function groupKeyForParsedName(name: string): string | undefined {
  if (!name.trim()) return undefined;
  return normalizeIngredientGroupKey(name);
}

export function groupReviewLinesByNormalizedName(
  recipes: ParsedPaprikaRecipe[],
): PaprikaIngredientGroup[] {
  const map = new Map<string, PaprikaLineRef[]>();
  for (let ri = 0; ri < recipes.length; ri++) {
    const recipe = recipes[ri]!;
    if (!recipe.selected) continue;
    recipe.parsedLines.forEach((line, lineIdx) => {
      const key = line.groupKey ?? groupKeyForParsedName(line.name);
      if (!key) return;
      const arr = map.get(key) ?? [];
      arr.push({ line, globalRecipeIdx: ri, lineIdx });
      map.set(key, arr);
    });
  }
  const out: PaprikaIngredientGroup[] = [];
  for (const [groupKey, lines] of map) {
    const first = lines[0]!.line;
    out.push({
      groupKey,
      parsedName: first.name,
      lines,
    });
  }
  out.sort((a, b) => a.parsedName.localeCompare(b.parsedName, undefined, { sensitivity: "base" }));
  return out;
}

export type PaprikaGroupResolution =
  | { kind: "use"; ingredientId: string; ingredient: Ingredient }
  | { kind: "catalog"; catalogItem: CatalogIngredient }
  | { kind: "create"; draft: PaprikaCreateDraft }
  | { kind: "ignore" };

export function applyGroupResolution(
  recipes: ParsedPaprikaRecipe[],
  groupKey: string,
  resolution: PaprikaGroupResolution,
): ParsedPaprikaRecipe[] {
  return recipes.map((recipe) => {
    if (!recipe.selected) return recipe;
    const updatedLines = recipe.parsedLines.map((line) => {
      const key = line.groupKey ?? groupKeyForParsedName(line.name);
      if (key !== groupKey || line.perLineOverride) return line;

      if (resolution.kind === "ignore") {
        return {
          ...line,
          action: "ignore" as const,
          resolutionStatus: "resolved" as const,
          explicitIgnore: true,
        };
      }
      if (resolution.kind === "use") {
        return {
          ...line,
          action: "use" as const,
          status: "matched" as const,
          matchedIngredient: resolution.ingredient,
          matchedCatalog: null,
          manualIngredientId: resolution.ingredientId,
          resolutionStatus: "resolved" as const,
          lowConfidenceAccepted: true,
        };
      }
      if (resolution.kind === "catalog") {
        return {
          ...line,
          action: "create" as const,
          status: "catalog" as const,
          matchedCatalog: resolution.catalogItem,
          matchedIngredient: null,
          manualIngredientId: undefined,
          newCategory: resolution.catalogItem.category,
          resolutionStatus: "resolved" as const,
          lowConfidenceAccepted: true,
        };
      }
      const draft = resolution.draft;
      return {
        ...line,
        action: "create" as const,
        status: "unmatched" as const,
        matchedIngredient: null,
        matchedCatalog: null,
        manualIngredientId: undefined,
        newCategory: draft.category,
        createDraft: draft,
        resolutionStatus: "resolved" as const,
      };
    });
    return { ...recipe, parsedLines: updatedLines };
  });
}

export function canFinalizePaprikaImport(recipes: ParsedPaprikaRecipe[]): boolean {
  for (const recipe of recipes) {
    if (!recipe.selected) continue;
    for (const line of recipe.parsedLines) {
      if (line.resolutionStatus === "pending") return false;
    }
  }
  return true;
}

/** Migrate sessions saved before F050 resolution fields; maps legacy `existingMealId` to `existingRecipeId`. */
export function migrateLegacyPaprikaRecipes(recipes: ParsedPaprikaRecipe[]): ParsedPaprikaRecipe[] {
  return recipes.map((recipe) => {
    const legacy = recipe as ParsedPaprikaRecipe & { existingMealId?: string };
    const { existingMealId, ...rest } = legacy;
    return {
      ...rest,
      existingRecipeId: recipe.existingRecipeId ?? existingMealId,
      parsedLines: recipe.parsedLines.map(migrateLegacyPaprikaLine),
    };
  });
}

function migrateLegacyPaprikaLine(line: PaprikaReviewLine): PaprikaReviewLine {
  if (line.resolutionStatus) {
    return {
      ...line,
      groupKey: line.groupKey ?? (line.name ? groupKeyForParsedName(line.name) : undefined),
    };
  }
  const gk = line.name ? groupKeyForParsedName(line.name) : undefined;
  if (!line.name) {
    return { ...line, resolutionStatus: "resolved", groupKey: gk };
  }
  if (line.status === "unmatched" && line.action === "ignore") {
    return {
      ...line,
      action: "pending",
      resolutionStatus: "pending",
      groupKey: gk,
    };
  }
  if (line.action === "use" && line.status === "matched") {
    return { ...line, resolutionStatus: "resolved", groupKey: gk };
  }
  if (line.action === "create") {
    return { ...line, resolutionStatus: "resolved", groupKey: gk };
  }
  return { ...line, resolutionStatus: "resolved", groupKey: gk };
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

/** Parse a single ingredient line (same rules as a full Paprika recipe import). */
export function parsePaprikaLineFromRaw(
  raw: string,
  recipeName: string,
  recipeIndex: number,
  householdIngredients: Ingredient[],
): PaprikaReviewLine {
  if (isInstructionLine(raw)) {
    return {
      raw,
      quantity: "",
      unit: "",
      name: "",
      prepNotes: [],
      matchedIngredient: null,
      matchedCatalog: null,
      status: "unmatched" as const,
      action: "ignore" as const,
      newCategory: "pantry" as IngredientCategory,
      recipeIndex,
      recipeName,
      resolutionStatus: "resolved" as const,
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
      recipeName,
      resolutionStatus: "resolved" as const,
    };
  }
  const { ingredient, catalogItem, status, matchScore, confidenceBand } = matchIngredient(
    name,
    householdIngredients,
  );
  const gk = groupKeyForParsedName(name);
  let action: PaprikaReviewLine["action"];
  let resolutionStatus: "pending" | "resolved";
  if (status === "matched") {
    action = "use";
    resolutionStatus = confidenceBand === "low" ? "pending" : "resolved";
  } else if (status === "catalog") {
    action = "create";
    resolutionStatus = confidenceBand === "low" ? "pending" : "resolved";
  } else {
    action = "pending";
    resolutionStatus = "pending";
  }
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
    matchScore,
    confidenceBand,
    action,
    newCategory: (catalogItem?.category ?? "pantry") as IngredientCategory,
    recipeIndex,
    recipeName,
    resolutionStatus,
    groupKey: gk,
    parserSuggestedIngredientId: ingredient?.id,
    parserSuggestedCatalogId: catalogItem?.id,
  };
}

function mergePaprikaLinePreserveResolution(
  previous: PaprikaReviewLine,
  fresh: PaprikaReviewLine,
): PaprikaReviewLine {
  if (previous.resolutionStatus !== "resolved") {
    return fresh;
  }
  if (previous.action === "ignore") {
    return {
      ...fresh,
      resolutionStatus: "resolved",
      action: "ignore",
      explicitIgnore: previous.explicitIgnore,
      matchedIngredient: null,
      matchedCatalog: null,
      status: "unmatched",
      matchScore: previous.matchScore,
      confidenceBand: previous.confidenceBand,
    };
  }
  if (previous.action === "use") {
    return {
      ...fresh,
      resolutionStatus: "resolved",
      action: "use",
      manualIngredientId: previous.manualIngredientId,
      matchedIngredient: previous.matchedIngredient ?? fresh.matchedIngredient,
      matchedCatalog: null,
      status: "matched",
      matchScore: previous.matchScore ?? fresh.matchScore,
      confidenceBand: previous.confidenceBand ?? fresh.confidenceBand,
      lowConfidenceAccepted: previous.lowConfidenceAccepted,
      perLineOverride: previous.perLineOverride,
      parserSuggestedIngredientId: previous.parserSuggestedIngredientId ?? fresh.parserSuggestedIngredientId,
      parserSuggestedCatalogId: previous.parserSuggestedCatalogId ?? fresh.parserSuggestedCatalogId,
    };
  }
  if (previous.action === "create") {
    return {
      ...fresh,
      resolutionStatus: "resolved",
      action: "create",
      createDraft: previous.createDraft,
      matchedCatalog: previous.matchedCatalog ?? fresh.matchedCatalog,
      matchedIngredient: previous.matchedIngredient ?? null,
      status: previous.matchedCatalog ? "catalog" : fresh.status,
      matchScore: previous.matchScore ?? fresh.matchScore,
      confidenceBand: previous.confidenceBand ?? fresh.confidenceBand,
      lowConfidenceAccepted: previous.lowConfidenceAccepted,
      perLineOverride: previous.perLineOverride,
      newCategory: previous.createDraft?.category ?? fresh.newCategory,
      parserSuggestedIngredientId: previous.parserSuggestedIngredientId ?? fresh.parserSuggestedIngredientId,
      parserSuggestedCatalogId: previous.parserSuggestedCatalogId ?? fresh.parserSuggestedCatalogId,
    };
  }
  return fresh;
}

/** Re-run parsing from each line’s `raw` (session snapshots drop full `recipe.ingredients`). Preserves resolved choices. */
export function refreshPaprikaSessionParsedLines(
  recipes: ParsedPaprikaRecipe[],
  householdIngredients: Ingredient[],
): ParsedPaprikaRecipe[] {
  return recipes.map((recipe) => ({
    ...recipe,
    parsedLines: recipe.parsedLines.map((line) => {
      const fresh = parsePaprikaLineFromRaw(
        line.raw,
        line.recipeName,
        line.recipeIndex,
        householdIngredients,
      );
      return mergePaprikaLinePreserveResolution(line, fresh);
    }),
  }));
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

  return lines.map((raw) =>
    parsePaprikaLineFromRaw(raw, recipe.name, recipeIndex, householdIngredients),
  );
}

export function detectDuplicateRecipe(
  recipeName: string,
  existingRecipes: Recipe[],
): { isDuplicate: boolean; existingRecipeId?: string } {
  const normalized = recipeName.toLowerCase().trim();
  for (const r of existingRecipes) {
    if (r.name.toLowerCase().trim() === normalized) {
      return { isDuplicate: true, existingRecipeId: r.id };
    }
  }
  return { isDuplicate: false };
}

/** @deprecated Use detectDuplicateRecipe against the recipe library. */
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
  existingRecipes: Recipe[],
): ParsedPaprikaRecipe[] {
  return recipes.map((raw, i) => {
    const parsedLines = parseRecipeIngredients(raw, householdIngredients, i);
    const { isDuplicate, existingRecipeId } = detectDuplicateRecipe(raw.name, existingRecipes);
    return {
      raw,
      parsedLines,
      isDuplicate,
      existingRecipeId,
      selected: !isDuplicate,
    };
  });
}

export function buildDraftRecipe(
  paprikaRecipe: PaprikaRecipe,
  reviewLines: PaprikaReviewLine[],
  householdIngredients: Ingredient[],
): { recipe: Recipe; newIngredients: Ingredient[] } {
  const newIngredients: Ingredient[] = [];
  const components: MealComponent[] = [];
  const mappings: ImportMapping[] = [];

  for (const line of reviewLines) {
    if (line.action === "pending") {
      throw new Error("Cannot build draft meal: unresolved Paprika ingredient lines remain.");
    }
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
        explicitIgnore: line.explicitIgnore,
        matchScore: line.matchScore,
        confidenceBand: line.confidenceBand,
        parserSuggestedIngredientId: line.parserSuggestedIngredientId,
        parserSuggestedCatalogId: line.parserSuggestedCatalogId,
      });
      continue;
    }

    if (line.action === "use") {
      const useId = line.manualIngredientId ?? line.matchedIngredient?.id;
      const resolvedIng = householdIngredients.find((i) => i.id === useId);
      if (!resolvedIng) {
        throw new Error(`Missing household ingredient ${useId} for imported line.`);
      }
      components.push({
        ingredientId: resolvedIng.id,
        role: guessComponentRole(resolvedIng.category),
        quantity: line.quantity,
        unit: line.unit || undefined,
        prepNote: line.prepNotes?.join(", ") || undefined,
        originalSourceLine: line.raw,
        matchType: "existing",
        confidence: line.matchScore,
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
        ingredientId: resolvedIng.id,
        finalMatchedIngredientId: resolvedIng.id,
        matchType: "existing",
        matchScore: line.matchScore,
        confidenceBand: line.confidenceBand,
        parserSuggestedIngredientId: line.parserSuggestedIngredientId,
        parserSuggestedCatalogId: line.parserSuggestedCatalogId,
      });
    } else if (line.action === "create") {
      let ing: Ingredient;
      if (line.matchedCatalog) {
        const draft = line.createDraft;
        const nameFromDraft = draft?.canonicalName
          ? normalizeIngredientName(draft.canonicalName)
          : normalizeIngredientName(line.matchedCatalog.name);
        const tagSet = new Set<string>([
          ...line.matchedCatalog.tags,
          ...(draft?.tags ?? []),
        ]);
        if (draft?.retainImportAlias) {
          tagSet.add(`import-alias:${normalizeIngredientName(line.raw)}`);
        }
        ing = catalogIngredientToHousehold(line.matchedCatalog, {
          name: nameFromDraft,
          tags: [...tagSet],
        });
      } else {
        const draft = line.createDraft;
        const tags = [...(draft?.tags ?? [])];
        if (draft?.retainImportAlias) {
          tags.push(`import-alias:${normalizeIngredientName(line.raw)}`);
        }
        ing = {
          id: crypto.randomUUID(),
          name: normalizeIngredientName(draft?.canonicalName ?? line.name),
          category: draft?.category ?? line.newCategory,
          tags,
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
        confidence: line.matchScore,
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
        finalCanonicalName: ing.name,
        importAliasRetained: line.createDraft?.retainImportAlias,
        matchScore: line.matchScore,
        confidenceBand: line.confidenceBand,
        parserSuggestedIngredientId: line.parserSuggestedIngredientId,
        parserSuggestedCatalogId: line.parserSuggestedCatalogId,
      });
    }
  }

  const prepTime = parseTimeToMinutes(paprikaRecipe.prep_time);
  const cookTime = parseTimeToMinutes(paprikaRecipe.cook_time);

  const provenance: RecipeProvenance = {
    sourceSystem: "paprika",
    externalId: paprikaRecipe.uid || undefined,
    sourceUrl: paprikaRecipe.source_url || undefined,
    importTimestamp: new Date().toISOString(),
  };

  const recipeLinks: RecipeLink[] = [];
  if (paprikaRecipe.source_url) {
    recipeLinks.push({
      label: paprikaRecipe.source || paprikaRecipe.source_url,
      url: paprikaRecipe.source_url,
    });
  }

  const prepText = truncate(stripHtmlToPlainText(paprikaRecipe.directions), MAX_PREP_CHARS);
  const notesPlain = stripHtmlToPlainText(paprikaRecipe.notes);
  const notesOut =
    notesPlain && notesPlain !== prepText
      ? truncate(notesPlain, MAX_NOTES_CHARS)
      : undefined;

  const ingredientsPlain = stripHtmlToPlainText(paprikaRecipe.ingredients);

  const directionsPlain = stripHtmlToPlainText(paprikaRecipe.directions);

  const libraryRecipe: Recipe = {
    id: crypto.randomUUID(),
    name: paprikaRecipe.name,
    recipeType: "whole-meal",
    components,
    ingredientsText: ingredientsPlain || paprikaRecipe.ingredients || undefined,
    directions: directionsPlain || undefined,
    defaultPrep: prepText,
    recipeLinks: recipeLinks.length > 0 ? recipeLinks : undefined,
    notes: notesOut,
    imageUrl: paprikaRecipe.image_url || undefined,
    provenance,
    prepTimeMinutes: prepTime || undefined,
    cookTimeMinutes: cookTime || undefined,
    servings: paprikaRecipe.servings || undefined,
    importMappings: compactMappingsForStorage(mappings),
  };

  return { recipe: libraryRecipe, newIngredients };
}

export function buildDraftMeal(
  paprikaRecipe: PaprikaRecipe,
  reviewLines: PaprikaReviewLine[],
  householdIngredients: Ingredient[],
): { meal: BaseMeal; newIngredients: Ingredient[] } {
  const { recipe: libraryRecipe, newIngredients } = buildDraftRecipe(
    paprikaRecipe,
    reviewLines,
    householdIngredients,
  );
  const totalTime = parseTimeToMinutes(paprikaRecipe.total_time);
  const prepTime = parseTimeToMinutes(paprikaRecipe.prep_time);
  const cookTime = parseTimeToMinutes(paprikaRecipe.cook_time);
  const meal = promoteRecipeToBaseMeal(libraryRecipe, {
    difficulty: mapDifficulty(paprikaRecipe.difficulty),
    estimatedTimeMinutes: totalTime || (prepTime + cookTime) || 30,
    rescueEligible: false,
  });
  return { meal, newIngredients };
}
