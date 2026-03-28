import type {
  BaseMeal,
  ComponentRecipeRef,
  DayPlan,
  Household,
  Ingredient,
  MealComponent,
  Recipe,
  RecipeRef,
} from "./types";
import { normalizeRecipeTagForCurated } from "./lib/recipeTags";
import seedData from "./seed-data.json";
import {
  DEFAULT_HOUSEHOLD_KEY,
  META_HOUSEHOLDS,
  META_PAPRIKA_SESSION,
  MIGRATION_KEY,
  RECIPE_REF_MIGRATION_KEY,
  SEEDED_KEY,
  STORAGE_KEY,
  STRIP_WHOLE_MEAL_TAGS_KEY,
  STRIP_THEME_RECIPE_TAGS_KEY,
} from "./storage/constants";
import { getAppDb, recreateAppDb } from "./storage/dexie-db";
import { migrateLegacyIntoDexieIfNeeded } from "./storage/migrate-v3";
import { setPaprikaImportSessionMemory } from "./storage/paprika-session-store";
import { queueHouseholdSync, queueHouseholdDeleteSync, isAuthenticated } from "./sync/sync-engine";
import { isRemoteHouseholdRowId, remoteRowIdForHousehold } from "./sync/remote-repository";

export {
  STORAGE_KEY,
  SEEDED_KEY,
  MIGRATION_KEY,
  RECIPE_REF_MIGRATION_KEY,
  STRIP_WHOLE_MEAL_TAGS_KEY,
  STRIP_THEME_RECIPE_TAGS_KEY,
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

/** Strip removed Recipe fields from persisted JSON and map legacy `recipeType` into tags. */
export function sanitizeRecipe(recipe: Recipe): Recipe {
  const r = recipe as Recipe & { recipeType?: string; parentRecipeId?: string };
  const { recipeType, parentRecipeId, ...rest } = r;
  void parentRecipeId;
  const tags = [...(rest.tags ?? [])];
  const typeToTag: Record<string, string> = {
    "whole-meal": "whole-meal",
    sauce: "sauce",
    "batch-prep": "batch-prep",
  };
  if (recipeType && typeToTag[recipeType]) {
    const t = typeToTag[recipeType];
    if (!tags.some((x) => normalizeRecipeTagForCurated(x) === t)) tags.push(t);
  }
  return { ...rest, tags: tags.length > 0 ? tags : undefined };
}

function hadLegacyRecipeFields(recipe: Recipe): boolean {
  const o = recipe as unknown as Record<string, unknown>;
  return "recipeType" in o || "parentRecipeId" in o;
}

function ensureRecipeComponentIds(household: Household): Household {
  let changed = false;
  const recipeList = household.recipes ?? [];
  const recipes = recipeList.map((recipe) => {
    const needsSanitize = hadLegacyRecipeFields(recipe);
    const working = needsSanitize ? sanitizeRecipe(recipe) : recipe;
    const components = working.components.map((c) => {
      if (c.id) return c;
      return { ...c, id: crypto.randomUUID() };
    });
    const compsChanged = components.some((c, i) => c !== working.components[i]);
    if (!needsSanitize && !compsChanged) return recipe;
    changed = true;
    return { ...working, components };
  });
  if (!changed && recipeList === household.recipes) return household;
  return { ...household, recipes };
}

export type NormalizedHousehold = Household & { recipes: Recipe[]; suppressedCatalogIds: string[] };

/** Default `recipes`, assign component ids; idempotent. */
export function normalizeHousehold(household: Household): NormalizedHousehold {
  const base: Household =
    household.recipes === undefined || household.suppressedCatalogIds === undefined
      ? {
        ...household,
        recipes: household.recipes ?? [],
        suppressedCatalogIds: household.suppressedCatalogIds ?? [],
      }
      : household;
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
}

export function saveHouseholds(households: Household[]): void {
  householdsCache = households;
  localStorage.removeItem(STORAGE_KEY);
  void dexieSetHouseholds(households).catch((err) => {
    console.error("Failed to persist households:", err);
  });
}

/**
 * Persist households without enqueueing cloud sync (used when sync assigns `cloudHouseholdId`
 * so we do not re-enter the incremental queue).
 */
export function saveHouseholdsLocalOnly(households: Household[]): void {
  householdsCache = households;
  localStorage.removeItem(STORAGE_KEY);
  void dexieSetHouseholds(households).catch((err) => {
    console.error("Failed to persist households:", err);
  });
}

export async function saveHouseholdAsync(household: Household): Promise<void> {
  const struct = normalizeHousehold(household);
  const toStore = normalizeHouseholdIngredientNames(struct);
  const households = loadHouseholds();
  const index = households.findIndex((h) => h.id === toStore.id);
  if (index >= 0) {
    households[index] = toStore;
  } else {
    households.push(toStore);
  }
  await persistHouseholdsNow(households);
  if (isAuthenticated()) queueHouseholdSync(toStore);
}

export function loadHousehold(id: string): Household | undefined {
  const households = loadHouseholds();
  const index = households.findIndex((h) => h.id === id);
  if (index < 0) return undefined;
  const raw = households[index]!;
  const struct = normalizeHousehold(raw);
  const toStore = normalizeHouseholdIngredientNames(struct);
  if (raw !== struct || struct !== toStore) {
    households[index] = toStore;
    saveHouseholds(households);
  }
  return toStore;
}

export function saveHousehold(household: Household): void {
  const struct = normalizeHousehold(household);
  const toStore = normalizeHouseholdIngredientNames(struct);
  const households = loadHouseholds();
  const index = households.findIndex((h) => h.id === toStore.id);
  if (index >= 0) {
    households[index] = toStore;
  } else {
    households.push(toStore);
  }
  saveHouseholds(households);
  if (isAuthenticated()) queueHouseholdSync(toStore);
}

export function deleteHousehold(id: string): void {
  const households = loadHouseholds();
  const target = households.find((h) => h.id === id);
  const remotePk = target ? remoteRowIdForHousehold(target) : isRemoteHouseholdRowId(id) ? id : null;
  saveHouseholds(households.filter((h) => h.id !== id));
  if (isAuthenticated() && remotePk) queueHouseholdDeleteSync(remotePk);
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

/** Component refs that resolve against the household {@link Household.recipes} library. */
function componentRecipeRefTiesToRecipeLibrary(ref: ComponentRecipeRef): boolean {
  if (ref.recipeId) return true;
  if (ref.sourceType === "imported-recipe") return true;
  if (ref.importedRecipeSourceId) return true;
  return false;
}

function stripLibraryRecipeRefsFromComponent(component: MealComponent): MealComponent {
  const raw = component.recipeRefs;
  if (!raw?.length) return component;
  const next = raw.filter((r) => !componentRecipeRefTiesToRecipeLibrary(r));
  if (next.length === raw.length) return component;
  return { ...component, recipeRefs: next.length ? next : undefined };
}

function stripLibraryRecipeDataFromBaseMeal(meal: BaseMeal): BaseMeal {
  const next: BaseMeal = {
    ...meal,
    components: meal.components.map(stripLibraryRecipeRefsFromComponent),
  };
  delete next.sourceRecipeId;
  delete next.recipeRefs;
  return next;
}

function stripIngredientLibraryRecipeRefs(ingredient: Ingredient): Ingredient {
  if (!ingredient.defaultRecipeRefs?.length) return ingredient;
  return { ...ingredient, defaultRecipeRefs: undefined };
}

function stripPlanDayLibraryRecipeRefs(day: DayPlan): DayPlan {
  const raw = day.componentRecipeOverrides;
  if (!raw?.length) return day;
  const next = raw.filter((r) => !componentRecipeRefTiesToRecipeLibrary(r));
  if (next.length === raw.length) return day;
  return { ...day, componentRecipeOverrides: next.length ? next : undefined };
}

/** Removes base meals, weekly plans, pins, and meal history; keeps the recipe library, members, and ingredients. */
export function clearHouseholdBaseMealsAndPlanning(householdId: string): void {
  const households = loadHouseholds();
  const idx = households.findIndex((h) => h.id === householdId);
  if (idx < 0) return;
  const h = households[idx]!;
  households[idx] = {
    ...h,
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
  };
  saveHouseholds(households);
  if (isAuthenticated()) queueHouseholdSync(households[idx]!);
}

/** Clears the recipe library and strips library-linked recipe refs from meals, ingredients, and plan overrides. */
export function clearHouseholdRecipes(householdId: string): void {
  const households = loadHouseholds();
  const idx = households.findIndex((h) => h.id === householdId);
  if (idx < 0) return;
  const h = households[idx]!;
  households[idx] = {
    ...h,
    recipes: [],
    baseMeals: (h.baseMeals ?? []).map(stripLibraryRecipeDataFromBaseMeal),
    ingredients: (h.ingredients ?? []).map(stripIngredientLibraryRecipeRefs),
    weeklyPlans: (h.weeklyPlans ?? []).map((wp) => ({
      ...wp,
      days: wp.days.map(stripPlanDayLibraryRecipeRefs),
    })),
  };
  saveHouseholds(households);
  if (isAuthenticated()) queueHouseholdSync(households[idx]!);
}

/** How many ingredient rows ship in bundled seed data for this household id (0 if none). */
export function countSeedIngredientsForHousehold(householdId: string): number {
  const seedHouseholds = seedData as unknown as Household[];
  const seedH = seedHouseholds.find((h) => h.id === householdId);
  return seedH?.ingredients?.length ?? 0;
}

/**
 * Replaces the household ingredient catalog with a deep copy of bundled seed data for this id.
 * Returns false if the household is missing, the id is absent from seed data, or seed ingredients are empty.
 */
export function resetHouseholdIngredientsToSeed(householdId: string): boolean {
  const seedHouseholds = seedData as unknown as Household[];
  const seedH = seedHouseholds.find((h) => h.id === householdId);
  const seedIngredients = seedH?.ingredients;
  if (!seedIngredients?.length) return false;

  const h = loadHousehold(householdId);
  if (!h) return false;

  saveHousehold({ ...h, ingredients: structuredClone(seedIngredients) });
  return true;
}

/** How many recipe rows ship in bundled seed data for this household id (0 if none). */
export function countSeedRecipesForHousehold(householdId: string): number {
  const seedHouseholds = seedData as unknown as Household[];
  const seedH = seedHouseholds.find((h) => h.id === householdId);
  return seedH?.recipes?.length ?? 0;
}

/**
 * Merges bundled seed recipes for this household id into the live library.
 * Rows with the same id as seed are replaced with the seed copy; seed-only ids are appended; other recipes are kept.
 */
export function mergeSeedRecipesForHousehold(householdId: string): boolean {
  const seedHouseholds = seedData as unknown as Household[];
  const seedH = seedHouseholds.find((h) => h.id === householdId);
  const seedRecipes = seedH?.recipes;
  if (!seedRecipes?.length) return false;

  const households = loadHouseholds();
  const idx = households.findIndex((h) => h.id === householdId);
  if (idx < 0) return false;

  const h = households[idx]!;
  const seedMap = new Map(seedRecipes.map((r) => [r.id, r]));
  const existing = h.recipes ?? [];
  const existingIds = new Set(existing.map((r) => r.id));

  const merged: Recipe[] = [];
  for (const r of existing) {
    merged.push(seedMap.get(r.id) ?? r);
  }
  for (const sr of seedRecipes) {
    if (!existingIds.has(sr.id)) merged.push(sr);
  }

  households[idx] = { ...h, recipes: merged };
  saveHouseholds(households);
  if (isAuthenticated()) queueHouseholdSync(households[idx]!);
  return true;
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

/**
 * Normalize alias strings for persistence: same rules as names, deduped, no blanks,
 * none equal to canonical name. Returns undefined when there is nothing to store.
 */
export function normalizeIngredientAliasList(
  canonicalName: string,
  aliases: string[] | undefined,
): string[] | undefined {
  const canon = normalizeIngredientName(canonicalName);
  if (!aliases?.length) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of aliases) {
    const a = normalizeIngredientName(raw);
    if (!a || a === canon) continue;
    if (seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out.length > 0 ? out : undefined;
}

/** Apply `normalizeIngredientName` and `normalizeIngredientAliasList` for persistence. */
export function normalizeIngredientForStorage(ing: Ingredient): Ingredient {
  const n = normalizeIngredientName(ing.name);
  const aliases = normalizeIngredientAliasList(n, ing.aliases);
  const out: Ingredient = { ...ing, name: n };
  if (aliases) out.aliases = aliases;
  else delete out.aliases;
  return out;
}

/** True if trimmed query (lowercase) matches canonical name or any stored alias. */
export function ingredientMatchesQuery(ing: Ingredient, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (ing.name.toLowerCase().includes(q)) return true;
  for (const a of ing.aliases ?? []) {
    if (a.includes(q)) return true;
  }
  return false;
}

export type IngredientAliasValidation = {
  blockingReason?: string;
  warnings: string[];
};

/**
 * Blocking: a normalized alias equals another ingredient's canonical name.
 * Warnings: same normalized alias appears on another ingredient's alias list.
 */
/** Strip aliases that match another ingredient's canonical name (safe persist / import hygiene). */
export function sanitizeIngredientAliasesAgainstHousehold(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.map((ing) => {
    const canon = normalizeIngredientName(ing.name);
    const aliases = normalizeIngredientAliasList(canon, ing.aliases);
    if (!aliases) {
      return ing.aliases ? { ...ing, aliases: undefined } : ing;
    }
    const kept = aliases.filter(
      (a) =>
        !ingredients.some(
          (other) => other.id !== ing.id && normalizeIngredientName(other.name) === a,
        ),
    );
    const next = normalizeIngredientAliasList(canon, kept);
    if (next) return { ...ing, aliases: next };
    return { ...ing, aliases: undefined };
  });
}

export function validateIngredientAliases(
  ingredient: Ingredient,
  allIngredients: Ingredient[],
): IngredientAliasValidation {
  const canon = normalizeIngredientName(ingredient.name);
  const normalized = normalizeIngredientAliasList(canon, ingredient.aliases) ?? [];
  const warnings: string[] = [];

  for (const alias of normalized) {
    const otherCanon = allIngredients.find(
      (i) => i.id !== ingredient.id && normalizeIngredientName(i.name) === alias,
    );
    if (otherCanon) {
      return {
        blockingReason: `“${alias}” is already the primary name of “${toSentenceCase(otherCanon.name)}”. Remove it here or merge ingredients.`,
        warnings: [],
      };
    }
  }

  for (const alias of normalized) {
    const other = allIngredients.find(
      (i) =>
        i.id !== ingredient.id &&
        (i.aliases ?? []).some((x) => normalizeIngredientName(x) === alias),
    );
    if (other) {
      warnings.push(
        `“${alias}” is also listed under “${toSentenceCase(other.name)}” — imports may pick the stronger match.`,
      );
    }
  }

  return { warnings };
}

/** Canonical ingredient names and aliases in storage; same ref if nothing changed. */
function normalizeHouseholdIngredientNames(household: Household): Household {
  let changed = false;
  const ingredients = household.ingredients.map((ing) => {
    const n = normalizeIngredientName(ing.name);
    const aliasesNorm = normalizeIngredientAliasList(n, ing.aliases);
    const prevAliases = ing.aliases;
    const aliasesEqual =
      (aliasesNorm === undefined && (prevAliases === undefined || prevAliases.length === 0)) ||
      (aliasesNorm !== undefined &&
        prevAliases !== undefined &&
        prevAliases.length === aliasesNorm.length &&
        prevAliases.every((x, i) => normalizeIngredientName(x) === aliasesNorm[i]));
    if (n === ing.name && aliasesEqual) return ing;
    changed = true;
    const next: Ingredient = { ...ing, name: n };
    if (aliasesNorm) next.aliases = aliasesNorm;
    else delete next.aliases;
    return next;
  });
  if (!changed) return household;
  return { ...household, ingredients };
}

const SINGULAR_EXCEPTIONS_GK = new Set([
  "hummus", "couscous", "lentils", "chickpeas", "oats", "peas", "noodles",
  "greens", "grits", "grains", "sprouts", "capers", "molasses", "quinoa",
  "edamame", "gnocchi", "tortellini", "rigatoni", "penne", "fusilli",
]);

function singularizeForGroupKey(word: string): string {
  const w = word.toLowerCase();
  if (w.length < 3) return w;
  if (SINGULAR_EXCEPTIONS_GK.has(w)) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ves")) return w.slice(0, -3) + "f";
  if (w.endsWith("oes") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("ses") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("ches") || w.endsWith("shes") || w.endsWith("xes") || w.endsWith("zes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

export function normalizeIngredientGroupKey(name: string): string {
  return normalizeIngredientName(name)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .map(singularizeForGroupKey)
    .join(" ");
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
  const aliasAccum: string[] = [...(merged.aliases ?? [])];
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
    for (const a of dup.aliases ?? []) aliasAccum.push(a);
  }
  merged.tags = [...allTags];
  const mergedAliases = normalizeIngredientAliasList(merged.name, aliasAccum);
  if (mergedAliases) merged.aliases = mergedAliases;
  else delete merged.aliases;
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
  wholeMealTagsAdded: number;
}

export function migrateHouseholdRecipeRefs(household: Household): RecipeRefMigrationResult {
  const result: RecipeRefMigrationResult = {
    recipeRefsBackfilled: 0,
    componentRecipeIdsSet: 0,
    wholeMealTagsAdded: 0,
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

  household.recipes = (household.recipes ?? []).map((recipe) => {
    const r = sanitizeRecipe(recipe);

    for (const comp of r.components) {
      if (!comp.recipeRefs) continue;
      for (const cRef of comp.recipeRefs) {
        if (!cRef.recipeId && cRef.importedRecipeSourceId) {
          (cRef as ComponentRecipeRef).recipeId = cRef.importedRecipeSourceId;
          result.componentRecipeIdsSet++;
        }
      }
    }
    return r;
  });

  return result;
}

export function runRecipeRefMigrationIfNeeded(): RecipeRefMigrationResult {
  if (localStorage.getItem(RECIPE_REF_MIGRATION_KEY)) {
    return { recipeRefsBackfilled: 0, componentRecipeIdsSet: 0, wholeMealTagsAdded: 0 };
  }
  const households = loadHouseholds();
  if (households.length === 0) {
    localStorage.setItem(RECIPE_REF_MIGRATION_KEY, "1");
    return { recipeRefsBackfilled: 0, componentRecipeIdsSet: 0, wholeMealTagsAdded: 0 };
  }

  const totals: RecipeRefMigrationResult = {
    recipeRefsBackfilled: 0,
    componentRecipeIdsSet: 0,
    wholeMealTagsAdded: 0,
  };
  for (const household of households) {
    const r = migrateHouseholdRecipeRefs(household);
    totals.recipeRefsBackfilled += r.recipeRefsBackfilled;
    totals.componentRecipeIdsSet += r.componentRecipeIdsSet;
    totals.wholeMealTagsAdded += r.wholeMealTagsAdded;
  }

  saveHouseholds(households);
  localStorage.setItem(RECIPE_REF_MIGRATION_KEY, "1");
  return totals;
}

/**
 * One-time: removes stored `whole-meal` tags from every recipe. Older builds inferred this tag on
 * import/migration; changing the code does not rewrite already-saved households. Users can add
 * tags again under Recipe Library → Organization when it applies.
 */
export function runStripWholeMealTagsIfNeeded(): number {
  if (localStorage.getItem(STRIP_WHOLE_MEAL_TAGS_KEY)) return 0;
  const households = loadHouseholds();
  if (households.length === 0) {
    localStorage.setItem(STRIP_WHOLE_MEAL_TAGS_KEY, "1");
    return 0;
  }
  let recipesUpdated = 0;
  for (const h of households) {
    const list = h.recipes ?? [];
    if (list.length === 0) continue;
    h.recipes = list.map((recipe) => {
      const tags = recipe.tags;
      if (!tags?.length) return recipe;
      const next = tags.filter((t) => normalizeRecipeTagForCurated(t) !== "whole-meal");
      if (next.length === tags.length) return recipe;
      recipesUpdated++;
      return { ...recipe, tags: next.length > 0 ? next : undefined };
    });
  }
  saveHouseholds(households);
  localStorage.setItem(STRIP_WHOLE_MEAL_TAGS_KEY, "1");
  return recipesUpdated;
}

const THEME_TAGS_REMOVED = new Set(["taco", "pizza", "pasta"]);

function stripThemeTagsFromStringList(tags: string[] | undefined): string[] | undefined {
  if (!tags?.length) return tags;
  const next = tags.filter((t) => !THEME_TAGS_REMOVED.has(t));
  if (next.length === tags.length) return tags;
  return next.length > 0 ? next : undefined;
}

/**
 * One-time: removes theme-style tags (taco, pizza, pasta) from recipes and base meals. Seed data no
 * longer uses these; existing saved households are updated on first load after upgrade.
 */
export function runStripThemeRecipeTagsIfNeeded(): {
  recipesUpdated: number;
  baseMealsUpdated: number;
} {
  if (localStorage.getItem(STRIP_THEME_RECIPE_TAGS_KEY)) {
    return { recipesUpdated: 0, baseMealsUpdated: 0 };
  }
  const households = loadHouseholds();
  if (households.length === 0) {
    localStorage.setItem(STRIP_THEME_RECIPE_TAGS_KEY, "1");
    return { recipesUpdated: 0, baseMealsUpdated: 0 };
  }
  let recipesUpdated = 0;
  let baseMealsUpdated = 0;
  for (const h of households) {
    const list = h.recipes ?? [];
    if (list.length > 0) {
      h.recipes = list.map((recipe) => {
        const next = stripThemeTagsFromStringList(recipe.tags);
        if (next === recipe.tags) return recipe;
        recipesUpdated++;
        return { ...recipe, tags: next };
      });
    }
    for (const meal of h.baseMeals) {
      const next = stripThemeTagsFromStringList(meal.tags);
      if (next === meal.tags) continue;
      meal.tags = next;
      baseMealsUpdated++;
    }
  }
  saveHouseholds(households);
  localStorage.setItem(STRIP_THEME_RECIPE_TAGS_KEY, "1");
  return { recipesUpdated, baseMealsUpdated };
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
