import Dexie, { type Table } from "dexie";
import { DEXIE_DB_NAME } from "./constants";

export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Web local-first persistence. Domain code should depend on ports + storage.ts helpers,
 * not on this class directly (except bootstrap / tests).
 */
export class OneBasePlateDexie extends Dexie {
  meta!: Table<MetaRow, string>;

  constructor() {
    super(DEXIE_DB_NAME);
    this.version(1).stores({
      meta: "key",
    });
  }
}

let dbInstance: OneBasePlateDexie | null = null;

export function getAppDb(): OneBasePlateDexie {
  if (!dbInstance) dbInstance = new OneBasePlateDexie();
  return dbInstance;
}

/** Test helper: delete DB and return a fresh Dexie instance. */
export async function recreateAppDb(): Promise<OneBasePlateDexie> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  await Dexie.delete(DEXIE_DB_NAME);
  dbInstance = new OneBasePlateDexie();
  await dbInstance.open();
  return dbInstance;
}
