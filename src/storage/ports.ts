import type { Household } from "../types";

/**
 * Stable seam for persisted household aggregates. A future Expo / SQLite adapter
 * should implement this interface; planner and UI stay storage-agnostic.
 */
export interface HouseholdRepository {
  getAll(): Promise<Household[]>;
  setAll(households: Household[]): Promise<void>;
}

/**
 * Small string-keyed meta for app flags and large JSON blobs (e.g. import drafts).
 * Web: Dexie `meta` table. Native: SQLite key-value or settings table.
 */
export interface AppMetaStore {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}
