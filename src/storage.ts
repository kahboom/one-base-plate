import type { Household, Ingredient } from "./types";
import seedData from "./seed-data.json";

const STORAGE_KEY = "onebaseplate_households";
const SEEDED_KEY = "onebaseplate_seeded";
const MIGRATION_KEY = "onebaseplate_migrated_v1";
const DEFAULT_HOUSEHOLD_KEY = "onebaseplate_default_household_id";

export function seedIfNeeded(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (localStorage.getItem(STORAGE_KEY)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
  localStorage.setItem(SEEDED_KEY, "1");
}

export function loadHouseholds(): Household[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Household[];
}

export function saveHouseholds(households: Household[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(households));
}

export function loadHousehold(id: string): Household | undefined {
  return loadHouseholds().find((h) => h.id === id);
}

export function saveHousehold(household: Household): void {
  const households = loadHouseholds();
  const index = households.findIndex((h) => h.id === household.id);
  if (index >= 0) {
    households[index] = household;
  } else {
    households.push(household);
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
  if (idRemap.size > 0) {
    for (const meal of household.baseMeals) {
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
          // Deduplicate alternatives after remapping
          comp.alternativeIngredientIds = [...new Set(comp.alternativeIngredientIds)];
          // Remove alternative if it matches primary
          comp.alternativeIngredientIds = comp.alternativeIngredientIds.filter(
            (altId) => altId !== comp.ingredientId,
          );
        }
      }
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
