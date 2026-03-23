import type { Household } from "../types";

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface RemoteHousehold {
  id: string;
  data: Household;
  owner_id: string;
  updated_at: string;
  version: number;
}

export type ConflictChoice = "keep-local" | "keep-remote" | "merge";

export interface FirstLoginContext {
  localHouseholds: Household[];
  remoteHouseholds: RemoteHousehold[];
  needsResolution: boolean;
}
