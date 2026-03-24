import type { ComponentRecipeRef, Household, Ingredient, MealComponent, Recipe, RecipeRef } from "./types";
import seedData from "./seed-data.json";
import {
  DEFAULT_HOUSEHOLD_KEY,
  META_HOUSEHOLDS,
  META_PAPRIKA_SESSION,
  MIGRATION_KEY,
  RECIPE_REF_MIGRATION_KEY,
  SEEDED_KEY,
  STORAGE_KEY,
} from "./storage/constants";
import { getAppDb, recreateAppDb } from "./storage/dexie-db";
import { migrateLegacyIntoDexieIfNeeded } from "./storage/migrate-v3";
import { setPaprikaImportSessionMemory } from "./storage/paprika-session-store";
import { syncAfterSave, syncDeleteHousehold, isAuthenticated } from "./sync/sync-engine";

export {
  STORAGE_KEY,
  SEEDED_KEY,
  MIGRATION_KEY,
  RECIPE_REF_MIGRATION_KEY,
  DEFAULT_HOUSEHOLD_KEY,
} from "./storage/constants";

export type { HouseholdRepository, AppMetaStore } from "./storage/ports";

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

/** After initStorage(), holds Dexie-backed household list; null before first init or after test reset. */
let householdsCache: Household[] | null = null;

async function dexieGetHouseholds(): Promise<Household[] | undefined> {
  const row = await getAppDb().meta.get(META_HOUSEHOLDS);
  const v = row?.value;
  return Array.isArray(v) ? (v as Household[]) : undefined;
}

async function dexieSetHouseholds(households: Household[]): Promise<void> {
  await getAppDb().meta.put({ key: META_HOUSEHOLDS, value: households });
}

/**
 * Call once at app startup before reading households.
 * Migrates legacy localStorage + legacy idb KV into Dexie, then hydrates memory caches.
 */
export async function initStorage(): Promise<void> {
  await migrateLegacyIntoDexieIfNeeded();
  const fromDexie = await dexieGetHouseholds();
  householdsCache = fromDexie ?? [];
  const paprikaRow = await getAppDb().meta.get(META_PAPRIKA_SESSION);
  const raw = typeof paprikaRow?.value === "string" ? paprikaRow.value : null;
  setPaprikaImportSessionMemory(raw);
}

/** Async: seeds from `seed-data.json` when storage is empty and seeded flag unset. */
export async function seedIfNeeded(): Promise<void> {
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (loadHouseholds().length > 0) return;
  const seeded = seedData as unknown as Household[];
  householdsCache = seeded;
  await dexieSetHouseholds(seeded);
  localStorage.setItem(SEEDED_KEY, "1");
}

/**
 * Sync read for UI. Uses memory after initStorage(); before init, falls back to localStorage
 * (tests that seed LS without calling initStorage).
 */
export function loadHouseholds(): Household[] {
  if (householdsCache !== null) return householdsCache;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Household[];
  } catch {
    return [];
  }
}

export async function persistHouseholdsNow(households: Household[]): Promise<void> {
  householdsCache = households;
  localStorage.removeItem(STORAGE_KEY);
  await dexieSetHouseholds(households);
  if (isAuthenticated()) void syncAfterSave(households);
}

export function saveHouseholds(households: Household[]): void {
  householdsCache = households;
  localStorage.removeItem(STORAGE_KEY);
  void dexieSetHouseholds(households).catch((err) => {
    console.error("Failed to persist households:", err);
  });
  if (isAuthenticated()) void syncAfterSave(households);
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
  if (isAuthenticated()) void syncDeleteHousehold(id);
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

export function clearAllHouseholdsAndDefault(): void {
  saveHouseholds([]);
  clearDefaultHouseholdId();
}

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
  const data = householdIds ? all.filter((h) => householdIds.includes(h.id)) : all;
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

/** Clears Dexie app DB and memory caches. Use in tests after localStorage.clear(). */
export async function resetAppStorageForTests(): Promise<void> {
  householdsCache = null;
  setPaprikaImportSessionMemory(null);
  await recreateAppDb();
}

export function toSentenceCase(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/, "");
}

export function normalizeIngredientGroupKey(name: string): string {
  return normalizeIngredientName(name).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

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

export function mergeDuplicateMetadata(survivor: Ingredient, duplicates: Ingredient[]): Ingredient {
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

export function remapIngredientReferences(household: Household, idRemap: Map<string, string>): number {
  if (idRemap.size === 0) return 0;
  let updated = 0;

  function remapMealComponents(meal: { components: MealComponent[] }) {
    for (const comp of meal.components) {
      const newId = idRemap.get(comp.ingredientId);
      if (newId) {
        comp.ingredientId = newId;
        updated++;
      }
      if (comp.alternativeIngredientIds) {
        comp.alternativeIngredientIds = comp.alternativeIngredientIds.map((altId) => {
          const mapped = idRemap.get(altId);
          if (mapped) {
            updated++;
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

  for (const meal of household.baseMeals) {
    remapMealComponents(meal);
  }
  for (const recipe of household.recipes ?? []) {
    remapMealComponents(recipe);
  }
  for (const plan of household.weeklyPlans) {
    for (const item of plan.generatedGroceryList) {
      const newId = idRemap.get(item.ingredientId);
      if (newId) {
        item.ingredientId = newId;
        updated++;
      }
    }
  }

  return updated;
}

export interface MigrationResult {
  normalized: number;
  duplicatesMerged: number;
  referencesUpdated: number;
}

export function migrateHouseholdIngredients(household: Household): MigrationResult {
  const result: MigrationResult = { normalized: 0, duplicatesMerged: 0, referencesUpdated: 0 };

  for (const ing of household.ingredients) {
    const normalized = normalizeIngredientName(ing.name);
    if (normalized !== ing.name) {
      ing.name = normalized;
      result.normalized++;
    }
  }

  const groups = new Map<string, Ingredient[]>();
  for (const ing of household.ingredients) {
    const key = ing.name;
    const group = groups.get(key) ?? [];
    group.push(ing);
    groups.set(key, group);
  }

  const idRemap = new Map<string, string>();
  const survivorIds = new Set<string>();

  for (const [, group] of groups) {
    if (group.length <= 1) {
      survivorIds.add(group[0]!.id);
      continue;
    }
    const survivor = pickSurvivor(group);
    const merged = mergeDuplicateMetadata(survivor, group);
    Object.assign(survivor, merged);
    survivorIds.add(survivor.id);
    for (const dup of group) {
      if (dup.id !== survivor.id) {
        idRemap.set(dup.id, survivor.id);
        result.duplicatesMerged++;
      }
    }
  }

  household.ingredients = household.ingredients.filter((ing) => survivorIds.has(ing.id));
  result.referencesUpdated = remapIngredientReferences(household, idRemap);

  return result;
}

export interface RecipeRefMigrationResult {
  recipeRefsBackfilled: number;
  componentRecipeIdsSet: number;
  recipeTypesInferred: number;
}

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

/**
 * Replace the local Dexie store with remote household data (used during first-login hydration
 * and explicit cloud-recovery flows).
 */
export async function hydrateFromRemote(households: Household[]): Promise<void> {
  householdsCache = households;
  localStorage.removeItem(STORAGE_KEY);
  await dexieSetHouseholds(households);
}

/** Alias for hydrateFromRemote with a clearer intent name for the recovery UI. */
export async function replaceLocalWithRemote(households: Household[]): Promise<void> {
  return hydrateFromRemote(households);
}

/** Trigger a JSON download of current household data as a backup. */
export function downloadHouseholdsBackup(householdIds?: string[]): void {
  const json = exportHouseholdsJSON(householdIds);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `onebaseplate-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** @internal Tests that manipulate Dexie directly after init. */
export function __testOnly_setHouseholdsCache(list: Household[] | null): void {
  householdsCache = list;
}
