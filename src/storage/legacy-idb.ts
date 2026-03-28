import { openDB } from 'idb';
import type { Household } from '../types';
import { LEGACY_IDB_NAME, LEGACY_IDB_STORE, STORAGE_KEY } from './constants';

/** Read households from pre-Dexie `idb` KV fallback (quota migration). */
export async function readLegacyKvHouseholds(): Promise<Household[] | undefined> {
  try {
    const db = await openDB(LEGACY_IDB_NAME, 1, {
      upgrade() {
        /* existing users only */
      },
    });
    if (!db.objectStoreNames.contains(LEGACY_IDB_STORE)) {
      db.close();
      return undefined;
    }
    const v = await db.get(LEGACY_IDB_STORE, STORAGE_KEY);
    db.close();
    if (Array.isArray(v)) return v as Household[];
  } catch {
    /* no legacy DB */
  }
  return undefined;
}
