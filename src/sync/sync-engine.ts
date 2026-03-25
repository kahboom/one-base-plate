/**
 * Sync engine: coordinates local-first Dexie storage with remote Supabase persistence.
 *
 * Conflict strategy (v1): household-level last-write-wins using `updatedAt`.
 * The local Dexie store is always written first; remote sync is best-effort async.
 */

import type { Household } from "../types";
import type {
  SyncState,
  SyncErrorKind,
  RemoteHousehold,
  ConflictChoice,
  FirstLoginContext,
  HouseholdCompareResult,
} from "./types";
import * as defaultRemoteRepo from "./remote-repository";

export interface RemoteRepoAdapter {
  fetchRemoteHouseholds: typeof defaultRemoteRepo.fetchRemoteHouseholds;
  upsertRemoteHousehold: typeof defaultRemoteRepo.upsertRemoteHousehold;
  deleteRemoteHousehold: typeof defaultRemoteRepo.deleteRemoteHousehold;
}

/** Persist `cloudHouseholdId` after first Supabase row is created for seed-style local ids (avoid sync↔storage import cycle). */
async function persistNewCloudHouseholdIds(
  updates: Array<{ localId: string; cloudHouseholdId: string }>,
): Promise<void> {
  if (updates.length === 0) return;
  const { loadHouseholds, saveHouseholds } = await import("../storage");
  const list = loadHouseholds();
  let changed = false;
  for (const { localId, cloudHouseholdId } of updates) {
    const idx = list.findIndex((h) => h.id === localId);
    if (idx >= 0) {
      list[idx] = { ...list[idx]!, cloudHouseholdId };
      changed = true;
    }
  }
  if (changed) saveHouseholds(list);
}

let repo: RemoteRepoAdapter = defaultRemoteRepo;
let currentUserId: string | null = null;
const DEFAULT_SYNC_STATE: SyncState = {
  status: "idle",
  lastSyncedAt: null,
  error: null,
  errorKind: null,
  hasPendingChanges: false,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
};
let syncState: SyncState = { ...DEFAULT_SYNC_STATE };
let listeners: Array<(state: SyncState) => void> = [];
let onlineListenersBound = false;
let loadHouseholdsRef: (() => Household[]) | null = null;

function notify() {
  for (const fn of listeners) fn(syncState);
}

function classifyError(err: unknown): SyncErrorKind {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes("jwt") || msg.includes("token") || msg.includes("expired") || msg.includes("refresh_token") || msg.includes("not authenticated")) {
    return "auth_expired";
  }
  // PostgREST: missing table / stale schema cache (run repo SQL migrations on Supabase).
  if (
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("pgrst205") ||
    (msg.includes("does not exist") && (msg.includes("relation") || msg.includes("table")))
  ) {
    return "schema_missing";
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch") || msg.includes("econnrefused") || msg.includes("timeout") || msg.includes("502") || msg.includes("503")) {
    return "remote_unavailable";
  }
  return "unknown";
}

export function getSyncState(): SyncState {
  return syncState;
}

export function onSyncStateChange(fn: (state: SyncState) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function isAuthenticated(): boolean {
  return currentUserId !== null;
}

/**
 * Provide a reference to loadHouseholds so the engine can read local state
 * for manualSync / reconnect without a circular import.
 */
export function setLoadHouseholdsRef(fn: () => Household[]): void {
  loadHouseholdsRef = fn;
}

/**
 * Bind browser online/offline event listeners. Call once at app init.
 * Automatically retries sync when coming back online with pending changes.
 */
export function initOnlineListeners(): void {
  if (typeof window === "undefined" || onlineListenersBound) return;
  onlineListenersBound = true;

  window.addEventListener("online", () => {
    syncState = { ...syncState, online: true };
    if (syncState.status === "offline") {
      syncState = { ...syncState, status: "idle" };
    }
    notify();
    if (syncState.hasPendingChanges && currentUserId && loadHouseholdsRef) {
      void syncAfterSave(loadHouseholdsRef());
    }
  });

  window.addEventListener("offline", () => {
    syncState = { ...syncState, online: false, status: "offline" };
    notify();
  });
}

function checkOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Called after every local save. Upserts each changed household to remote.
 * Errors are caught and surfaced via syncState, never thrown to the caller.
 */
export async function syncAfterSave(households: Household[]): Promise<void> {
  if (!currentUserId) return;

  const online = checkOnline();
  if (!online) {
    syncState = { ...syncState, status: "offline", online: false, hasPendingChanges: true };
    notify();
    return;
  }

  syncState = { ...syncState, status: "syncing", error: null, errorKind: null, hasPendingChanges: true };
  notify();

  try {
    const cloudPatches: Array<{ localId: string; cloudHouseholdId: string }> = [];
    for (const h of households) {
      const { newCloudHouseholdId } = await repo.upsertRemoteHousehold(h, currentUserId);
      if (newCloudHouseholdId) cloudPatches.push({ localId: h.id, cloudHouseholdId: newCloudHouseholdId });
    }
    await persistNewCloudHouseholdIds(cloudPatches);
    syncState = {
      ...syncState,
      status: "idle",
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      hasPendingChanges: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    const kind = classifyError(err);
    syncState = { ...syncState, status: "error", error: msg, errorKind: kind, hasPendingChanges: true };
    console.error("[sync-engine] syncAfterSave failed:", msg);
  }

  notify();
}

/**
 * Pull all households the user has access to from Supabase.
 */
export async function pullRemoteHouseholds(): Promise<RemoteHousehold[]> {
  if (!currentUserId) return [];

  syncState = { ...syncState, status: "syncing", error: null, errorKind: null };
  notify();

  try {
    const remote = await repo.fetchRemoteHouseholds(currentUserId);
    syncState = {
      ...syncState,
      status: "idle",
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
    };
    notify();
    return remote;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pull failed";
    const kind = classifyError(err);
    syncState = { ...syncState, status: "error", error: msg, errorKind: kind };
    notify();
    console.error("[sync-engine] pullRemoteHouseholds failed:", msg);
    return [];
  }
}

/**
 * Push local households to remote (used during first-login migration).
 */
export async function pushLocalHouseholds(households: Household[]): Promise<void> {
  if (!currentUserId) return;

  syncState = { ...syncState, status: "syncing", error: null, errorKind: null };
  notify();

  try {
    const cloudPatches: Array<{ localId: string; cloudHouseholdId: string }> = [];
    for (const h of households) {
      const { newCloudHouseholdId } = await repo.upsertRemoteHousehold(h, currentUserId);
      if (newCloudHouseholdId) cloudPatches.push({ localId: h.id, cloudHouseholdId: newCloudHouseholdId });
    }
    await persistNewCloudHouseholdIds(cloudPatches);
    syncState = {
      ...syncState,
      status: "idle",
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      hasPendingChanges: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Push failed";
    const kind = classifyError(err);
    syncState = { ...syncState, status: "error", error: msg, errorKind: kind };
    console.error("[sync-engine] pushLocalHouseholds failed:", msg);
  }

  notify();
}

/**
 * Compare local households with remote to detect conflicts.
 * Returns per-household comparison results.
 */
export async function compareWithRemote(
  localHouseholds: Household[],
): Promise<{ remotes: RemoteHousehold[]; comparisons: HouseholdCompareResult[] }> {
  const remotes = await pullRemoteHouseholds();

  const fromLocal: HouseholdCompareResult[] = localHouseholds.map((local) => {
    const remote = defaultRemoteRepo.findRemoteForLocal(local, remotes);
    if (!remote) {
      return { householdId: local.id, localNewer: true, remoteNewer: false, onlyLocal: true, onlyRemote: false };
    }
    const localTime = (local as Household & { updatedAt?: string }).updatedAt;
    const remoteTime = remote.updated_at;
    const localMs = localTime ? new Date(localTime).getTime() : 0;
    const remoteMs = remoteTime ? new Date(remoteTime).getTime() : 0;
    return {
      householdId: local.id,
      localNewer: localMs > remoteMs,
      remoteNewer: remoteMs > localMs,
      onlyLocal: false,
      onlyRemote: false,
    };
  });

  const remoteOnly: HouseholdCompareResult[] = remotes
    .filter((r) => !localHouseholds.some((l) => defaultRemoteRepo.localHouseholdMatchesRemote(l, r)))
    .map((r) => ({
      householdId: r.id,
      localNewer: false,
      remoteNewer: true,
      onlyLocal: false,
      onlyRemote: true,
    }));

  return { remotes, comparisons: [...fromLocal, ...remoteOnly] };
}

/**
 * Manual sync trigger. Pushes local pending changes to remote.
 * Returns comparison results so the UI can present conflict choices if needed.
 */
export async function manualSync(
  localHouseholds: Household[],
): Promise<{ comparisons: HouseholdCompareResult[]; remotes: RemoteHousehold[] }> {
  if (!currentUserId) return { comparisons: [], remotes: [] };

  const { remotes, comparisons } = await compareWithRemote(localHouseholds);

  const hasRemoteNewer = comparisons.some((c) => c.remoteNewer && !c.onlyRemote);
  if (hasRemoteNewer && syncState.hasPendingChanges) {
    return { comparisons, remotes };
  }

  syncState = { ...syncState, status: "syncing", error: null, errorKind: null };
  notify();

  try {
    const cloudPatches: Array<{ localId: string; cloudHouseholdId: string }> = [];
    for (const h of localHouseholds) {
      const { newCloudHouseholdId } = await repo.upsertRemoteHousehold(h, currentUserId);
      if (newCloudHouseholdId) cloudPatches.push({ localId: h.id, cloudHouseholdId: newCloudHouseholdId });
    }
    await persistNewCloudHouseholdIds(cloudPatches);
    syncState = {
      ...syncState,
      status: "idle",
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      hasPendingChanges: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Manual sync failed";
    const kind = classifyError(err);
    syncState = { ...syncState, status: "error", error: msg, errorKind: kind };
    console.error("[sync-engine] manualSync failed:", msg);
  }

  notify();
  return { comparisons, remotes };
}

/**
 * Detect what the first-login scenario looks like and return context
 * for the migration dialog.
 */
export async function detectFirstLoginContext(
  localHouseholds: Household[],
): Promise<FirstLoginContext> {
  const remoteHouseholds = await pullRemoteHouseholds();
  const hasLocal = localHouseholds.length > 0;
  const hasRemote = remoteHouseholds.length > 0;

  return {
    localHouseholds,
    remoteHouseholds,
    needsResolution: hasLocal && hasRemote,
  };
}

/**
 * Resolve the first-login scenario based on user choice or automatic detection.
 * Returns the household list that should become the canonical local + remote state.
 */
export async function resolveFirstLogin(
  context: FirstLoginContext,
  choice?: ConflictChoice,
): Promise<Household[]> {
  const { localHouseholds, remoteHouseholds } = context;
  const hasLocal = localHouseholds.length > 0;
  const hasRemote = remoteHouseholds.length > 0;

  if (!hasLocal && !hasRemote) return [];

  if (hasLocal && !hasRemote) {
    await pushLocalHouseholds(localHouseholds);
    return localHouseholds;
  }

  if (!hasLocal && hasRemote) {
    return remoteHouseholds.map((r) => defaultRemoteRepo.mergeCloudHouseholdIdFromRemote(r));
  }

  // Both sides have data — resolve by choice
  const effectiveChoice = choice ?? "keep-local";

  if (effectiveChoice === "keep-local") {
    await pushLocalHouseholds(localHouseholds);
    return localHouseholds;
  }

  if (effectiveChoice === "keep-remote") {
    return remoteHouseholds.map((r) => defaultRemoteRepo.mergeCloudHouseholdIdFromRemote(r));
  }

  // merge: combine by household id; local wins on conflict
  const merged = [...localHouseholds];
  for (const remote of remoteHouseholds) {
    const localMatch = merged.find((l) => defaultRemoteRepo.localHouseholdMatchesRemote(l, remote));
    if (!localMatch) {
      merged.push(defaultRemoteRepo.mergeCloudHouseholdIdFromRemote(remote));
    }
  }
  await pushLocalHouseholds(merged);
  return merged;
}

/** Delete a remote household (called when local delete happens while signed in). */
export async function syncDeleteHousehold(householdId: string): Promise<void> {
  if (!currentUserId) return;
  try {
    await repo.deleteRemoteHousehold(householdId);
  } catch (err) {
    console.error("[sync-engine] syncDeleteHousehold failed:", err);
  }
}

/** Replace the remote repository adapter (for tests). */
export function __testOnly_setRemoteRepo(mock: RemoteRepoAdapter): void {
  repo = mock;
}

/** Reset for tests. */
export function __testOnly_resetSyncEngine(): void {
  currentUserId = null;
  syncState = { ...DEFAULT_SYNC_STATE, online: checkOnline() };
  listeners = [];
  repo = defaultRemoteRepo;
  loadHouseholdsRef = null;
  onlineListenersBound = false;
}
