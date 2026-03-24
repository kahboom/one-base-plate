import type { Household } from "../types";

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export type SyncErrorKind = "auth_expired" | "remote_unavailable" | "unknown";

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
  errorKind: SyncErrorKind | null;
  hasPendingChanges: boolean;
  online: boolean;
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

export interface HouseholdCompareResult {
  householdId: string;
  localNewer: boolean;
  remoteNewer: boolean;
  onlyLocal: boolean;
  onlyRemote: boolean;
}

export interface HouseholdMember {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "editor";
  joinedAt: string;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  code: string;
  createdBy: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  createdAt: string;
}
