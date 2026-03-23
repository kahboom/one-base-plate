import type { Household } from "../types";
import {
  HOUSEHOLDS_IDB_META,
  META_HOUSEHOLDS,
  META_STORAGE_LAYER_MIGRATED_V3,
  STORAGE_KEY,
} from "./constants";
import { getAppDb } from "./dexie-db";
import { readLegacyKvHouseholds } from "./legacy-idb";
import { migratePaprikaSessionFromLocalStorage } from "./paprika-session-store";

function parseHouseholdsJson(raw: string): Household[] | undefined {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as Household[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Idempotent: pulls legacy localStorage + legacy idb KV into Dexie once.
 * Does not overwrite non-empty household data already in Dexie.
 */
export async function migrateLegacyIntoDexieIfNeeded(): Promise<void> {
  const db = getAppDb();
  const migrated = await db.meta.get(META_STORAGE_LAYER_MIGRATED_V3);
  if (migrated?.value === true) {
    await migratePaprikaSessionFromLocalStorage();
    return;
  }

  const existingRow = await db.meta.get(META_HOUSEHOLDS);
  const existing = existingRow?.value;
  if (Array.isArray(existing) && existing.length > 0) {
    await db.meta.put({ key: META_STORAGE_LAYER_MIGRATED_V3, value: true });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HOUSEHOLDS_IDB_META);
    await migratePaprikaSessionFromLocalStorage();
    return;
  }

  const inLegacyIdb = localStorage.getItem(HOUSEHOLDS_IDB_META) === "1";
  const fromKv = await readLegacyKvHouseholds();
  const rawLs = localStorage.getItem(STORAGE_KEY);
  const fromLs = rawLs !== null ? parseHouseholdsJson(rawLs) : undefined;

  let households: Household[] | undefined;

  if (inLegacyIdb) {
    if (fromKv && fromKv.length > 0) households = fromKv;
    else if (fromLs !== undefined) households = fromLs;
    else if (Array.isArray(fromKv)) households = fromKv;
  } else if (fromLs !== undefined) {
    households = fromLs;
  } else if (fromKv && fromKv.length > 0) {
    households = fromKv;
  }

  if (households !== undefined) {
    await db.meta.put({ key: META_HOUSEHOLDS, value: households });
  }

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HOUSEHOLDS_IDB_META);

  await db.meta.put({ key: META_STORAGE_LAYER_MIGRATED_V3, value: true });
  await migratePaprikaSessionFromLocalStorage();
}
