import type { Household } from "./types";

const STORAGE_KEY = "onebaseplate_households";

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
