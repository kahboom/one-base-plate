import { describe, it, expect } from "vitest";
import seedData from "../src/seed-data.json";
import type { Household } from "../src/types";
import {
  initStorage,
  loadHouseholds,
  resetAppStorageForTests,
  saveHousehold,
  STORAGE_KEY,
  importHouseholdsJSON,
  exportHouseholdsJSON,
  seedIfNeeded,
  SEEDED_KEY,
} from "../src/storage";
import {
  META_HOUSEHOLDS,
  META_PAPRIKA_SESSION,
  META_STORAGE_LAYER_MIGRATED_V3,
  PAPRIKA_SESSION_LS_KEY,
} from "../src/storage/constants";
import { getAppDb } from "../src/storage/dexie-db";
import {
  rememberAndQueuePaprikaImportSessionPersist,
  getPaprikaImportSessionMemory,
} from "../src/storage/paprika-session-store";

describe("F061: Dexie household persistence", () => {
  it("persists core household data and reloads after initStorage", async () => {
    const h: Household = {
      id: "h-x",
      name: "Test",
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(h);
    await resetAppStorageForTests();
    await initStorage();
    expect(loadHouseholds()).toHaveLength(0);
    saveHousehold(h);
    const row = await getAppDb().meta.get(META_HOUSEHOLDS);
    expect(Array.isArray(row?.value)).toBe(true);
    expect((row!.value as Household[])[0]!.id).toBe("h-x");
  });
});

describe("F061: Legacy localStorage migration (v3)", () => {
  it("migrates households from localStorage into Dexie once", async () => {
    const legacy: Household[] = [
      {
        id: "legacy-1",
        name: "Legacy",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    await initStorage();
    expect(loadHouseholds()).toEqual(legacy);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    const flag = await getAppDb().meta.get(META_STORAGE_LAYER_MIGRATED_V3);
    expect(flag?.value).toBe(true);
  });

  it("migration is idempotent and does not overwrite Dexie when households already exist", async () => {
    const first: Household[] = [
      {
        id: "a",
        name: "A",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(first));
    await initStorage();
    const second: Household[] = [
      {
        id: "b",
        name: "B",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(second));
    await resetAppStorageForTests();
    await getAppDb().meta.put({ key: META_HOUSEHOLDS, value: first });
    await getAppDb().meta.put({ key: META_STORAGE_LAYER_MIGRATED_V3, value: true });
    await initStorage();
    expect(loadHouseholds().map((h) => h.id)).toEqual(["a"]);
  });
});

describe("F061: Seed bootstrap", () => {
  it("init + seedIfNeeded loads bundled seed when empty", async () => {
    await initStorage();
    expect(loadHouseholds().length).toBe(0);
    localStorage.removeItem(SEEDED_KEY);
    await seedIfNeeded();
    const list = loadHouseholds();
    expect(list.length).toBeGreaterThan(0);
    const seed = seedData as unknown as Household[];
    expect(list.map((h) => h.id).sort()).toEqual(seed.map((h) => h.id).sort());
  });
});

describe("F061: Import/export after storage layer", () => {
  it("round-trips JSON through import/export", async () => {
    const h: Household = {
      id: "ie1",
      name: "IE",
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };
    await initStorage();
    saveHousehold(h);
    const json = exportHouseholdsJSON();
    await resetAppStorageForTests();
    await initStorage();
    importHouseholdsJSON(json, "replace");
    const restored = loadHouseholds()[0]!;
    expect(restored).toMatchObject({ id: "ie1", name: "IE" });
  });
});

describe("F061: Paprika session persistence", () => {
  it("stores draft in IndexedDB-backed layer (memory + Dexie)", async () => {
    rememberAndQueuePaprikaImportSessionPersist(
      '{"householdId":"h1","parsedRecipes":[],"step":"select","savedAt":"x"}',
    );
    expect(getPaprikaImportSessionMemory()).toContain("h1");
    const row = await getAppDb().meta.get(META_PAPRIKA_SESSION);
    expect(typeof row?.value).toBe("string");
  });

  it("migrates Paprika session from legacy localStorage key on initStorage", async () => {
    const raw = JSON.stringify({
      householdId: "h-m",
      parsedRecipes: [],
      step: "review",
      savedAt: "t",
    });
    localStorage.setItem(PAPRIKA_SESSION_LS_KEY, raw);
    await initStorage();
    expect(localStorage.getItem(PAPRIKA_SESSION_LS_KEY)).toBeNull();
    expect(getPaprikaImportSessionMemory()).toBe(raw);
  });
});
