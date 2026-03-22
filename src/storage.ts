import { openDB } from "idb";
import type { ComponentRecipeRef, Household, Ingredient, MealComponent, Recipe, RecipeRef } from "./types";

/** Assign stable ids to meal components when missing; idempotent. */
export function ensureHouseholdComponentIds(household: Household): Household {
  let changed = false;
  const baseMeals = household.baseMeals.map((meal) => {
    let mealChanged = false;
    const components = meal.components.map((c) => {
      if (c.id) return c;
      mealChanged = true;
      return { ...c, id: crypto.randomUUID() };
    });
    if (!mealChanged) return meal;
    changed = true;
    return { ...meal, components };
  });
  if (!changed) return household;
  return { ...household, baseMeals };
}

function ensureRecipeComponentIds(household: Household): Household {
  let changed = false;
  const recipeList = household.recipes ?? [];
  const recipes = recipeList.map((recipe) => {
    let recipeChanged = false;
    const components = recipe.components.map((c) => {
      if (c.id) return c;
      recipeChanged = true;
      return { ...c, id: crypto.randomUUID() };
    });
    if (!recipeChanged) return recipe;
    changed = true;
    return { ...recipe, components };
  });
  if (!changed && recipeList === household.recipes) return household;
  return { ...household, recipes };
}

export type NormalizedHousehold = Household & { recipes: Recipe[] };

/** Default `recipes`, assign component ids; idempotent. */
export function normalizeHousehold(household: Household): NormalizedHousehold {
  const base: Household =
    household.recipes === undefined ? { ...household, recipes: [] } : household;
  return ensureRecipeComponentIds(ensureHouseholdComponentIds(base)) as NormalizedHousehold;
}
import seedData from "./seed-data.json";

export const STORAGE_KEY = "onebaseplate_households";
const SEEDED_KEY = "onebaseplate_seeded";
const MIGRATION_KEY = "onebaseplate_migrated_v1";
const DEFAULT_HOUSEHOLD_KEY = "onebaseplate_default_household_id";
/** When set, household JSON lives in IndexedDB (localStorage quota exceeded). */
const HOUSEHOLDS_IDB_META = "onebaseplate_households_in_idb";

const IDB_NAME = "onebaseplate";
const IDB_VERSION = 1;
const IDB_STORE = "kv";

let idbPromise: ReturnType<typeof openDb> | null = null;
/** In-IDB mode only: hydrated household list (localStorage mode reads from localStorage each time). */
let householdsCache: Household[] | null = null;

function openDb() {
  return openDB(IDB_NAME, IDB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    },
  });
}

function getIdb() {
  return (idbPromise ??= openDb());
}

async function idbGetHouseholds(): Promise<Household[] | undefined> {
  const db = await getIdb();
  return db.get(IDB_STORE, STORAGE_KEY);
}

async function idbPutHouseholds(households: Household[]): Promise<void> {
  const db = await getIdb();
  await db.put(IDB_STORE, households, STORAGE_KEY);
}

export function isHouseholdsInIndexedDB(): boolean {
  return localStorage.getItem(HOUSEHOLDS_IDB_META) === "1";
}

/** Call once at app startup before reading households (loads IDB when migrated). */
export async function initStorage(): Promise<void> {
  if (!isHouseholdsInIndexedDB()) return;
  householdsCache = (await idbGetHouseholds()) ?? [];
}

export function seedIfNeeded(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (loadHouseholds().length > 0) return;
  if (isHouseholdsInIndexedDB()) {
    householdsCache = seedData as unknown as Household[];
    void idbPutHouseholds(householdsCache);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
  }
  localStorage.setItem(SEEDED_KEY, "1");
}

export function loadHouseholds(): Household[] {
  if (isHouseholdsInIndexedDB()) {
    return householdsCache ?? [];
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Household[];
}

/** Persists the full household list; awaits IndexedDB when that backend is active or after quota migration. */
export async function persistHouseholdsNow(households: Household[]): Promise<void> {
  if (isHouseholdsInIndexedDB()) {
    householdsCache = households;
    await idbPutHouseholds(households);
    return;
  }
  const json = JSON.stringify(households);
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(HOUSEHOLDS_IDB_META, "1");
      householdsCache = households;
      await idbPutHouseholds(households);
      return;
    }
    throw e;
  }
}

export function saveHouseholds(households: Household[]): void {
  void persistHouseholdsNow(households).catch((err) => {
    console.error("Failed to persist households:", err);
  });
}

export async function saveHouseholdAsync(household: Household): Promise<void> {
  const normalized = normalizeHousehold(household);
  const households = loadHouseholds();
  const index = households.findIndex((h) => h.id === normalized.id);
  if (index >= 0) {
    households[index] = normalized;
  } else {
    households.push(normalized);
  }
  await persistHouseholdsNow(households);
}

export function loadHousehold(id: string): Household | undefined {
  const households = loadHouseholds();
  const index = households.findIndex((h) => h.id === id);
  if (index < 0) return undefined;
  const raw = households[index]!;
  const normalized = normalizeHousehold(raw);
  if (normalized !== raw) {
    households[index] = normalized;
    saveHouseholds(households);
  }
  return normalized;
}

export function saveHousehold(household: Household): void {
  const normalized = normalizeHousehold(household);
  const households = loadHouseholds();
  const index = households.findIndex((h) => h.id === normalized.id);
  if (index >= 0) {
    households[index] = normalized;
  } else {
    households.push(normalized);
  }
  saveHouseholds(households);
}

export function deleteHousehold(id: string): void {
  saveHouseholds(loadHouseholds().filter((h) => h.id !== id));
}

export function loadDefaultHouseholdId(): string | null {
  return localStorage.getItem(DEFAULT_HOUSEHOLD_KEY);
}

export function saveDefaultHouseholdId(id: string): void {
  localStorage.setItem(DEFAULT_HOUSEHOLD_KEY, id);
}

export function clearDefaultHouseholdId(): void {
  localStorage.removeItem(DEFAULT_HOUSEHOLD_KEY);
}

/** Removes all households and clears the stored default household id. */
export function clearAllHouseholdsAndDefault(): void {
  saveHouseholds([]);
  clearDefaultHouseholdId();
}

/** Clears base meals, weekly plans, pinned meals, and meal outcomes for one household. Ingredients and members are unchanged. */
export function clearHouseholdMealsAndPlans(householdId: string): void {
  const households = loadHouseholds();
  const idx = households.findIndex((h) => h.id === householdId);
  if (idx < 0) return;
  const h = households[idx]!;
  households[idx] = {
    ...h,
    recipes: [],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
  };
  saveHouseholds(households);
}

export function exportHouseholdsJSON(householdIds?: string[]): string {
  const all = loadHouseholds();
  const data = householdIds
    ? all.filter((h) => householdIds.includes(h.id))
    : all;
  return JSON.stringify(data, null, 2);
}

export function importHouseholdsJSON(
  json: string,
  mode: "replace" | "merge" = "replace",
): Household[] {
  const imported = JSON.parse(json) as Household[];
  if (!Array.isArray(imported)) throw new Error("Invalid data: expected array");
  if (mode === "replace") {
    saveHouseholds(imported);
    return imported;
  }
  const existing = loadHouseholds();
  const merged = [...existing];
  for (const h of imported) {
    const idx = merged.findIndex((e) => e.id === h.id);
    if (idx >= 0) {
      merged[idx] = h;
    } else {
      merged.push(h);
    }
  }
  saveHouseholds(merged);
  return merged;
}

/** Sentence-case display: capitalize first letter, rest as-is */
export function toSentenceCase(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Canonical normalization: lowercase, trim, collapse internal spaces, strip trailing punctuation */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/, "");
}

/** For import grouping: same as normalizeIngredientName, then hyphens become spaces (all-purpose ≈ all purpose). */
export function normalizeIngredientGroupKey(name: string): string {
  return normalizeIngredientName(name).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

/** Pick the most complete ingredient record as the survivor */
function pickSurvivor(duplicates: Ingredient[]): Ingredient {
  let best = duplicates[0]!;
  let bestScore = 0;
  for (const ing of duplicates) {
    let score = 0;
    if (ing.tags.length > 0) score += ing.tags.length;
    if (ing.imageUrl) score += 2;
    if (ing.catalogId) score += 2;
    if (ing.source === "catalog") score += 1;
    if (ing.shelfLifeHint) score += 1;
    if (ing.freezerFriendly) score += 1;
    if (ing.babySafeWithAdaptation) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = ing;
    }
  }
  return best;
}

/** Merge metadata from duplicates into the survivor */
function mergeDuplicateMetadata(survivor: Ingredient, duplicates: Ingredient[]): Ingredient {
  const merged = { ...survivor };
  const allTags = new Set(merged.tags);
  for (const dup of duplicates) {
    if (dup.id === merged.id) continue;
    for (const tag of dup.tags) allTags.add(tag);
    if (!merged.imageUrl && dup.imageUrl) merged.imageUrl = dup.imageUrl;
    if (!merged.catalogId && dup.catalogId) {
      merged.catalogId = dup.catalogId;
      merged.source = "catalog";
    }
    if (!merged.shelfLifeHint && dup.shelfLifeHint) merged.shelfLifeHint = dup.shelfLifeHint;
    if (dup.freezerFriendly) merged.freezerFriendly = true;
    if (dup.babySafeWithAdaptation) merged.babySafeWithAdaptation = true;
  }
  merged.tags = [...allTags];
  return merged;
}

export interface MigrationResult {
  normalized: number;
  duplicatesMerged: number;
  referencesUpdated: number;
}

/** Migrate a single household's ingredients: normalize names, merge duplicates, reassign references */
export function migrateHouseholdIngredients(household: Household): MigrationResult {
  const result: MigrationResult = { normalized: 0, duplicatesMerged: 0, referencesUpdated: 0 };

  // Step 1: Normalize all ingredient names
  for (const ing of household.ingredients) {
    const normalized = normalizeIngredientName(ing.name);
    if (normalized !== ing.name) {
      ing.name = normalized;
      result.normalized++;
    }
  }

  // Step 2: Group by normalized name to find duplicates
  const groups = new Map<string, Ingredient[]>();
  for (const ing of household.ingredients) {
    const key = ing.name;
    const group = groups.get(key) ?? [];
    group.push(ing);
    groups.set(key, group);
  }

  // Step 3: For each duplicate group, pick survivor, build ID remap
  const idRemap = new Map<string, string>();
  const survivorIds = new Set<string>();

  for (const [, group] of groups) {
    if (group.length <= 1) {
      survivorIds.add(group[0]!.id);
      continue;
    }
    const survivor = pickSurvivor(group);
    const merged = mergeDuplicateMetadata(survivor, group);
    // Update the survivor in-place
    Object.assign(survivor, merged);
    survivorIds.add(survivor.id);
    for (const dup of group) {
      if (dup.id !== survivor.id) {
        idRemap.set(dup.id, survivor.id);
        result.duplicatesMerged++;
      }
    }
  }

  // Step 4: Remove duplicate ingredients (keep only survivors)
  household.ingredients = household.ingredients.filter((ing) => survivorIds.has(ing.id));

  // Step 5: Reassign references in meal components
  function remapMealComponents(meal: { components: MealComponent[] }) {
    for (const comp of meal.components) {
      const newId = idRemap.get(comp.ingredientId);
      if (newId) {
        comp.ingredientId = newId;
        result.referencesUpdated++;
      }
      if (comp.alternativeIngredientIds) {
        comp.alternativeIngredientIds = comp.alternativeIngredientIds.map((altId) => {
          const mapped = idRemap.get(altId);
          if (mapped) {
            result.referencesUpdated++;
            return mapped;
          }
          return altId;
        });
        comp.alternativeIngredientIds = [...new Set(comp.alternativeIngredientIds)];
        comp.alternativeIngredientIds = comp.alternativeIngredientIds.filter(
          (altId) => altId !== comp.ingredientId,
        );
      }
    }
  }

  if (idRemap.size > 0) {
    for (const meal of household.baseMeals) {
      remapMealComponents(meal);
    }
    for (const recipe of household.recipes ?? []) {
      remapMealComponents(recipe);
    }

    // Reassign grocery list references in weekly plans
    for (const plan of household.weeklyPlans) {
      for (const item of plan.generatedGroceryList) {
        const newId = idRemap.get(item.ingredientId);
        if (newId) {
          item.ingredientId = newId;
          result.referencesUpdated++;
        }
      }
    }
  }

  return result;
}

const RECIPE_REF_MIGRATION_KEY = "onebaseplate_migrated_v2";

export interface RecipeRefMigrationResult {
  recipeRefsBackfilled: number;
  componentRecipeIdsSet: number;
  recipeTypesInferred: number;
}

/**
 * Migrate a single household: backfill RecipeRef on BaseMeals from sourceRecipeId,
 * copy importedRecipeSourceId to recipeId on ComponentRecipeRefs, infer recipeType.
 */
export function migrateHouseholdRecipeRefs(household: Household): RecipeRefMigrationResult {
  const result: RecipeRefMigrationResult = {
    recipeRefsBackfilled: 0,
    componentRecipeIdsSet: 0,
    recipeTypesInferred: 0,
  };

  const recipeIds = new Set((household.recipes ?? []).map((r) => r.id));

  for (const meal of household.baseMeals) {
    if (meal.sourceRecipeId && recipeIds.has(meal.sourceRecipeId)) {
      const existing = meal.recipeRefs ?? [];
      const alreadyLinked = existing.some((r) => r.recipeId === meal.sourceRecipeId);
      if (!alreadyLinked) {
        const ref: RecipeRef = { recipeId: meal.sourceRecipeId, role: "primary" };
        meal.recipeRefs = [...existing, ref];
        result.recipeRefsBackfilled++;
      }
    }

    for (const comp of meal.components) {
      if (!comp.recipeRefs) continue;
      for (const cRef of comp.recipeRefs) {
        if (!cRef.recipeId && cRef.importedRecipeSourceId) {
          (cRef as ComponentRecipeRef).recipeId = cRef.importedRecipeSourceId;
          result.componentRecipeIdsSet++;
        }
      }
    }
  }

  for (const recipe of household.recipes ?? []) {
    if (!recipe.recipeType) {
      if (recipe.provenance) {
        recipe.recipeType = "whole-meal";
        result.recipeTypesInferred++;
      }
    }

    for (const comp of recipe.components) {
      if (!comp.recipeRefs) continue;
      for (const cRef of comp.recipeRefs) {
        if (!cRef.recipeId && cRef.importedRecipeSourceId) {
          (cRef as ComponentRecipeRef).recipeId = cRef.importedRecipeSourceId;
          result.componentRecipeIdsSet++;
        }
      }
    }
  }

  return result;
}

/** Run recipe-ref migration on all households if not already done */
export function runRecipeRefMigrationIfNeeded(): RecipeRefMigrationResult {
  if (localStorage.getItem(RECIPE_REF_MIGRATION_KEY)) {
    return { recipeRefsBackfilled: 0, componentRecipeIdsSet: 0, recipeTypesInferred: 0 };
  }
  const households = loadHouseholds();
  if (households.length === 0) {
    localStorage.setItem(RECIPE_REF_MIGRATION_KEY, "1");
    return { recipeRefsBackfilled: 0, componentRecipeIdsSet: 0, recipeTypesInferred: 0 };
  }

  const totals: RecipeRefMigrationResult = {
    recipeRefsBackfilled: 0,
    componentRecipeIdsSet: 0,
    recipeTypesInferred: 0,
  };
  for (const household of households) {
    const r = migrateHouseholdRecipeRefs(household);
    totals.recipeRefsBackfilled += r.recipeRefsBackfilled;
    totals.componentRecipeIdsSet += r.componentRecipeIdsSet;
    totals.recipeTypesInferred += r.recipeTypesInferred;
  }

  saveHouseholds(households);
  localStorage.setItem(RECIPE_REF_MIGRATION_KEY, "1");
  return totals;
}

/** Run migration on all households if not already done */
export function runMigrationIfNeeded(): MigrationResult {
  if (localStorage.getItem(MIGRATION_KEY)) {
    return { normalized: 0, duplicatesMerged: 0, referencesUpdated: 0 };
  }
  const households = loadHouseholds();
  if (households.length === 0) {
    localStorage.setItem(MIGRATION_KEY, "1");
    return { normalized: 0, duplicatesMerged: 0, referencesUpdated: 0 };
  }

  const totals: MigrationResult = { normalized: 0, duplicatesMerged: 0, referencesUpdated: 0 };
  for (const household of households) {
    const r = migrateHouseholdIngredients(household);
    totals.normalized += r.normalized;
    totals.duplicatesMerged += r.duplicatesMerged;
    totals.referencesUpdated += r.referencesUpdated;
  }

  saveHouseholds(households);
  localStorage.setItem(MIGRATION_KEY, "1");
  return totals;
}
