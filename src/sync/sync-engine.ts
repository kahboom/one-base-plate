/**
 * Sync engine: coordinates local-first Dexie storage with remote Supabase persistence.
 *
 * Conflict strategy (v1): household-level last-write-wins using `updatedAt`.
 * The local Dexie store is always written first; remote sync is best-effort async.
 */

import type { Household } from "../types";
import type { SyncState, RemoteHousehold, ConflictChoice, FirstLoginContext } from "./types";
import * as defaultRemoteRepo from "./remote-repository";

export interface RemoteRepoAdapter {
  fetchRemoteHouseholds: typeof defaultRemoteRepo.fetchRemoteHouseholds;
  upsertRemoteHousehold: typeof defaultRemoteRepo.upsertRemoteHousehold;
  deleteRemoteHousehold: typeof defaultRemoteRepo.deleteRemoteHousehold;
}

let repo: RemoteRepoAdapter = defaultRemoteRepo;
let currentUserId: string | null = null;
let syncState: SyncState = { status: "idle", lastSyncedAt: null, error: null };
let listeners: Array<(state: SyncState) => void> = [];

function notify() {
  for (const fn of listeners) fn(syncState);
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
 * Called after every local save. Upserts each changed household to remote.
 * Errors are caught and surfaced via syncState, never thrown to the caller.
 */
export async function syncAfterSave(households: Household[]): Promise<void> {
  if (!currentUserId) return;

  syncState = { ...syncState, status: "syncing", error: null };
  notify();

  try {
    for (const h of households) {
      await repo.upsertRemoteHousehold(h, currentUserId);
    }
    syncState = { status: "idle", lastSyncedAt: new Date().toISOString(), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    syncState = { ...syncState, status: "error", error: msg };
    console.error("[sync-engine] syncAfterSave failed:", msg);
  }

  notify();
}

/**
 * Pull all households the user has access to from Supabase.
 */
export async function pullRemoteHouseholds(): Promise<RemoteHousehold[]> {
  if (!currentUserId) return [];

  syncState = { ...syncState, status: "syncing", error: null };
  notify();

  try {
    const remote = await repo.fetchRemoteHouseholds(currentUserId);
    syncState = { status: "idle", lastSyncedAt: new Date().toISOString(), error: null };
    notify();
    return remote;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pull failed";
    syncState = { ...syncState, status: "error", error: msg };
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

  syncState = { ...syncState, status: "syncing", error: null };
  notify();

  try {
    for (const h of households) {
      await repo.upsertRemoteHousehold(h, currentUserId);
    }
    syncState = { status: "idle", lastSyncedAt: new Date().toISOString(), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Push failed";
    syncState = { ...syncState, status: "error", error: msg };
    console.error("[sync-engine] pushLocalHouseholds failed:", msg);
  }

  notify();
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
    return remoteHouseholds.map((r) => r.data);
  }

  // Both sides have data — resolve by choice
  const effectiveChoice = choice ?? "keep-local";

  if (effectiveChoice === "keep-local") {
    await pushLocalHouseholds(localHouseholds);
    return localHouseholds;
  }

  if (effectiveChoice === "keep-remote") {
    return remoteHouseholds.map((r) => r.data);
  }

  // merge: combine by household id; local wins on conflict
  const merged = [...localHouseholds];
  for (const remote of remoteHouseholds) {
    const localMatch = merged.find((l) => l.id === remote.data.id);
    if (!localMatch) {
      merged.push(remote.data);
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
  syncState = { status: "idle", lastSyncedAt: null, error: null };
  listeners = [];
  repo = defaultRemoteRepo;
}
