import type { Household } from '../types';
import type { RemoteHousehold } from '../sync/types';

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

/**
 * Remote persistence for authenticated cross-browser sync.
 * Implemented by Supabase-backed remote-repository; consumed only by the sync engine.
 */
export interface RemoteHouseholdRepository {
  fetchByUser(userId: string): Promise<RemoteHousehold[]>;
  upsert(household: Household, userId: string): Promise<RemoteHousehold>;
  delete(householdId: string): Promise<void>;
}
