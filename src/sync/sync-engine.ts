/**
 * Sync engine: coordinates local-first Dexie storage with remote Supabase persistence.
 *
 * Conflict strategy (v1): household-level last-write-wins using `updatedAt`.
 * The local Dexie store is always written first; remote sync is best-effort async.
 *
 * Normal edits use a debounced per-household queue (`queueHouseholdSync`) so we do not
 * upsert the entire household list on every save. Full-array sync remains for explicit
 * flows: first-login push, manual sync, and legacy `syncAfterSave` (tests / rare use).
 */

import type { Household } from '../types';
import type {
  SyncState,
  SyncErrorKind,
  RemoteHousehold,
  ConflictChoice,
  FirstLoginContext,
  HouseholdCompareResult,
} from './types';
import * as defaultRemoteRepo from './remote-repository';

export interface RemoteRepoAdapter {
  fetchRemoteHouseholds: typeof defaultRemoteRepo.fetchRemoteHouseholds;
  upsertRemoteHousehold: typeof defaultRemoteRepo.upsertRemoteHousehold;
  deleteRemoteHousehold: typeof defaultRemoteRepo.deleteRemoteHousehold;
}

const SYNC_QUEUE_LOG_PREFIX = '[sync-queue]';

/** Coalesce rapid edits before flushing to Supabase (ms). */
const QUEUE_DEBOUNCE_MS = 1000;

/** Initial backoff after transient remote failure (ms); doubles each failure, capped. */
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 60_000;

/** Log `console.warn` when a single household JSON snapshot exceeds this size (bytes). */
const PAYLOAD_WARN_BYTES = 256 * 1024;

/** Log `console.debug` per-household payload size only at or above this threshold (reduces noise). */
const PAYLOAD_DEBUG_LOG_BYTES = 64 * 1024;

/** Persist `cloudHouseholdId` after first Supabase row is created for seed-style local ids (avoid sync↔storage import cycle). */
async function persistNewCloudHouseholdIds(
  updates: Array<{ localId: string; cloudHouseholdId: string }>,
): Promise<void> {
  if (updates.length === 0) return;
  const { loadHouseholds, saveHouseholdsLocalOnly } = await import('../storage');
  const list = loadHouseholds();
  let changed = false;
  for (const { localId, cloudHouseholdId } of updates) {
    const idx = list.findIndex((h) => h.id === localId);
    if (idx >= 0) {
      list[idx] = { ...list[idx]!, cloudHouseholdId };
      changed = true;
    }
  }
  if (changed) saveHouseholdsLocalOnly(list);
}

function approxHouseholdPayloadBytes(h: Household): number {
  try {
    return JSON.stringify(h).length;
  } catch {
    return 0;
  }
}

// --- Queue state (incremental sync) ---

let pendingUpserts = new Map<string, Household>();
let pendingDeletes = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInProgress = false;
let flushAgainAfterCurrent = false;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let consecutiveTransientFailures = 0;

let repo: RemoteRepoAdapter = defaultRemoteRepo;
let currentUserId: string | null = null;
const DEFAULT_SYNC_STATE: SyncState = {
  status: 'idle',
  lastSyncedAt: null,
  error: null,
  errorKind: null,
  hasPendingChanges: false,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
};
let syncState: SyncState = { ...DEFAULT_SYNC_STATE };
let listeners: Array<(state: SyncState) => void> = [];
let onlineListenersBound = false;

function notify() {
  for (const fn of listeners) fn(syncState);
}

function clearFlushTimer(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function clearBackoffTimer(): void {
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
}

function queueHasWork(): boolean {
  return pendingUpserts.size > 0 || pendingDeletes.size > 0;
}

function updatePendingFlagFromQueue(): void {
  const pending = queueHasWork();
  if (syncState.hasPendingChanges !== pending) {
    syncState = { ...syncState, hasPendingChanges: pending };
    notify();
  }
}

/** Remove any pending upsert that targets the same remote row as this delete. */
function cancelPendingUpsertsForRemotePk(remotePk: string): void {
  for (const [id, h] of pendingUpserts) {
    const rowId = defaultRemoteRepo.remoteRowIdForHousehold(h);
    if (rowId === remotePk || h.id === remotePk) {
      pendingUpserts.delete(id);
      console.debug(`${SYNC_QUEUE_LOG_PREFIX} cancelled pending upsert (delete wins): ${id}`);
    }
  }
}

function scheduleDebouncedFlush(): void {
  clearFlushTimer();
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueuedSync();
  }, QUEUE_DEBOUNCE_MS);
}

/**
 * Queue a single household for cloud upsert after debounce. Latest version per id wins.
 */
export function queueHouseholdSync(household: Household): void {
  if (!currentUserId) return;

  pendingUpserts.set(household.id, household);
  console.debug(`${SYNC_QUEUE_LOG_PREFIX} queued upsert: ${household.id}`);
  syncState = { ...syncState, hasPendingChanges: true };
  notify();

  const online = checkOnline();
  if (!online) {
    syncState = { ...syncState, status: 'offline', online: false, hasPendingChanges: true };
    notify();
    return;
  }

  scheduleDebouncedFlush();
}

/**
 * Queue a remote household row delete (Supabase `households.id` UUID).
 */
export function queueHouseholdDeleteSync(remotePk: string): void {
  if (!currentUserId) return;

  cancelPendingUpsertsForRemotePk(remotePk);
  pendingDeletes.add(remotePk);
  console.debug(`${SYNC_QUEUE_LOG_PREFIX} queued delete: ${remotePk}`);
  syncState = { ...syncState, hasPendingChanges: true };
  notify();

  const online = checkOnline();
  if (!online) {
    syncState = { ...syncState, status: 'offline', online: false, hasPendingChanges: true };
    notify();
    return;
  }

  scheduleDebouncedFlush();
}

function scheduleBackoffRetry(): void {
  clearBackoffTimer();
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** consecutiveTransientFailures);
  console.debug(
    `${SYNC_QUEUE_LOG_PREFIX} scheduling backoff retry in ${exp}ms (failures=${consecutiveTransientFailures})`,
  );
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void flushQueuedSync();
  }, exp);
}

/**
 * Flush queued upserts and deletes immediately. Serialized: concurrent calls coalesce into one follow-up flush.
 */
export async function flushQueuedSync(): Promise<void> {
  if (!currentUserId) return;

  clearFlushTimer();

  if (flushInProgress) {
    flushAgainAfterCurrent = true;
    console.debug(`${SYNC_QUEUE_LOG_PREFIX} flush skipped (in progress, will run follow-up after)`);
    return;
  }

  if (!queueHasWork()) {
    updatePendingFlagFromQueue();
    return;
  }

  const online = checkOnline();
  if (!online) {
    syncState = { ...syncState, status: 'offline', online: false, hasPendingChanges: true };
    notify();
    return;
  }

  flushInProgress = true;
  flushAgainAfterCurrent = false;

  const flushUserId = currentUserId;
  if (!flushUserId) {
    flushInProgress = false;
    return;
  }

  const upsertBatch = new Map(pendingUpserts);
  const deleteBatch = new Set(pendingDeletes);
  pendingUpserts = new Map();
  pendingDeletes = new Set();
  updatePendingFlagFromQueue();

  const deleteIds = [...deleteBatch];

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  console.debug(
    `${SYNC_QUEUE_LOG_PREFIX} flush start: ${upsertBatch.size} upserts, ${deleteBatch.size} deletes`,
  );
  for (const h of upsertBatch.values()) {
    const bytes = approxHouseholdPayloadBytes(h);
    if (bytes >= PAYLOAD_WARN_BYTES) {
      console.warn(
        `${SYNC_QUEUE_LOG_PREFIX} large household snapshot ~${bytes} bytes (${h.id}); consider trimming recipes/ingredients or future granular sync`,
      );
    } else if (bytes >= PAYLOAD_DEBUG_LOG_BYTES) {
      console.debug(
        `${SYNC_QUEUE_LOG_PREFIX} flush payload ~${bytes} bytes for household ${h.id}`,
      );
    }
  }

  syncState = {
    ...syncState,
    status: 'syncing',
    error: null,
    errorKind: null,
    hasPendingChanges: queueHasWork() || upsertBatch.size > 0 || deleteBatch.size > 0,
    online: true,
  };
  notify();

  try {
    for (let di = 0; di < deleteIds.length; di++) {
      if (currentUserId !== flushUserId) {
        console.debug(
          `${SYNC_QUEUE_LOG_PREFIX} flush aborted mid-delete (auth/session changed); discarding remaining remote ops for this batch`,
        );
        syncState = {
          ...syncState,
          status: 'idle',
          error: null,
          errorKind: null,
          hasPendingChanges: queueHasWork(),
          online: checkOnline(),
        };
        notify();
        return;
      }
      await repo.deleteRemoteHousehold(deleteIds[di]!);
    }

    const cloudPatches: Array<{ localId: string; cloudHouseholdId: string }> = [];
    const upsertEntries = [...upsertBatch.entries()];
    for (let ui = 0; ui < upsertEntries.length; ui++) {
      if (currentUserId !== flushUserId) {
        console.debug(
          `${SYNC_QUEUE_LOG_PREFIX} flush aborted mid-upsert (auth/session changed); discarding remaining remote ops for this batch`,
        );
        await persistNewCloudHouseholdIds(cloudPatches);
        syncState = {
          ...syncState,
          status: 'idle',
          error: null,
          errorKind: null,
          hasPendingChanges: queueHasWork(),
          online: checkOnline(),
        };
        notify();
        return;
      }
      const [, h] = upsertEntries[ui]!;
      const { newCloudHouseholdId } = await repo.upsertRemoteHousehold(h, flushUserId);
      if (newCloudHouseholdId)
        cloudPatches.push({ localId: h.id, cloudHouseholdId: newCloudHouseholdId });
    }
    await persistNewCloudHouseholdIds(cloudPatches);

    consecutiveTransientFailures = 0;
    clearBackoffTimer();

    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    console.debug(`${SYNC_QUEUE_LOG_PREFIX} flush complete in ${Math.round(t1 - t0)}ms`);

    syncState = {
      ...syncState,
      status: 'idle',
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      hasPendingChanges: queueHasWork(),
    };
    notify();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    const kind = classifyError(err);
    console.error(`${SYNC_QUEUE_LOG_PREFIX} flush failed: ${kind} - ${msg}`);

    for (const [id, h] of upsertBatch) {
      const existing = pendingUpserts.get(id);
      pendingUpserts.set(id, existing ? existing : h);
    }
    for (const pk of deleteIds) {
      pendingDeletes.add(pk);
    }

    syncState = {
      ...syncState,
      status: 'error',
      error: msg,
      errorKind: kind,
      hasPendingChanges: true,
      online: checkOnline(),
    };
    notify();

    if (kind === 'remote_unavailable') {
      consecutiveTransientFailures += 1;
      scheduleBackoffRetry();
    } else {
      consecutiveTransientFailures = 0;
      clearBackoffTimer();
    }
  } finally {
    flushInProgress = false;
    const needImmediateFollowUp = flushAgainAfterCurrent;
    flushAgainAfterCurrent = false;
    // Run follow-up on a microtask when another flush was requested while this one held the mutex,
    // so `finally` finishes (and clears `flushInProgress`) before re-entry — avoids synchronous re-entry races.
    if (needImmediateFollowUp && queueHasWork() && checkOnline() && currentUserId) {
      queueMicrotask(() => {
        void flushQueuedSync();
      });
    } else if (queueHasWork() && checkOnline() && currentUserId) {
      scheduleDebouncedFlush();
    }
  }
}

/** Clear incremental queue and timers (after full push paths that synced everything). */
function clearIncrementalQueue(): void {
  clearFlushTimer();
  clearBackoffTimer();
  pendingUpserts = new Map();
  pendingDeletes = new Set();
  consecutiveTransientFailures = 0;
  flushAgainAfterCurrent = false;
}

function classifyError(err: unknown): SyncErrorKind {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('expired') ||
    msg.includes('refresh_token') ||
    msg.includes('not authenticated')
  ) {
    return 'auth_expired';
  }
  // PostgREST: missing table / stale schema cache (run repo SQL migrations on Supabase).
  if (
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('pgrst205') ||
    (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('table')))
  ) {
    return 'schema_missing';
  }
  if (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout') ||
    msg.includes('502') ||
    msg.includes('503')
  ) {
    return 'remote_unavailable';
  }
  return 'unknown';
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
  const prev = currentUserId;
  if (prev !== null && prev !== userId) {
    clearIncrementalQueue();
  }
  currentUserId = userId;
  updatePendingFlagFromQueue();
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function isAuthenticated(): boolean {
  return currentUserId !== null;
}

/**
 * @deprecated No-op. Incremental sync uses an in-memory queue; reconnect flushes via `flushQueuedSync`.
 * Kept for backward compatibility with older tests or forks.
 */
export function setLoadHouseholdsRef(_fn: () => Household[]): void {
  void _fn;
}

/**
 * Bind browser online/offline event listeners. Call once at app init.
 * Automatically retries sync when coming back online with pending changes.
 */
export function initOnlineListeners(): void {
  if (typeof window === 'undefined' || onlineListenersBound) return;
  onlineListenersBound = true;

  window.addEventListener('online', () => {
    syncState = { ...syncState, online: true };
    if (syncState.status === 'offline') {
      syncState = { ...syncState, status: 'idle' };
    }
    notify();
    if (currentUserId && queueHasWork()) {
      void flushQueuedSync();
    }
  });

  window.addEventListener('offline', () => {
    syncState = { ...syncState, online: false, status: 'offline' };
    notify();
  });
}

function checkOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * **Test / legacy only** — full-array upsert of every household. Production saves must use
 * `queueHouseholdSync` + debounced `flushQueuedSync` (see F068). Do not call from app UI or storage.
 * Still used by tests and intentional bulk scenarios (e.g. offline queue seed + reconnect tests).
 */
export async function syncAfterSave(households: Household[]): Promise<void> {
  if (!currentUserId) return;

  const online = checkOnline();
  if (!online) {
    for (const h of households) {
      pendingUpserts.set(h.id, h);
    }
    syncState = { ...syncState, status: 'offline', online: false, hasPendingChanges: true };
    notify();
    return;
  }

  syncState = {
    ...syncState,
    status: 'syncing',
    error: null,
    errorKind: null,
    hasPendingChanges: true,
  };
  notify();

  try {
    const cloudPatches: Array<{ localId: string; cloudHouseholdId: string }> = [];
    for (const h of households) {
      const { newCloudHouseholdId } = await repo.upsertRemoteHousehold(h, currentUserId);
      if (newCloudHouseholdId)
        cloudPatches.push({ localId: h.id, cloudHouseholdId: newCloudHouseholdId });
    }
    await persistNewCloudHouseholdIds(cloudPatches);
    clearIncrementalQueue();
    syncState = {
      ...syncState,
      status: 'idle',
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      hasPendingChanges: queueHasWork(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    const kind = classifyError(err);
    syncState = {
      ...syncState,
      status: 'error',
      error: msg,
      errorKind: kind,
      hasPendingChanges: true,
    };
    console.error('[sync-engine] syncAfterSave failed:', msg);
  }

  notify();
}

/**
 * Pull all households the user has access to from Supabase.
 */
export async function pullRemoteHouseholds(): Promise<RemoteHousehold[]> {
  if (!currentUserId) return [];

  syncState = { ...syncState, status: 'syncing', error: null, errorKind: null };
  notify();

  try {
    const remote = await repo.fetchRemoteHouseholds(currentUserId);
    syncState = {
      ...syncState,
      status: 'idle',
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
    };
    notify();
    return remote;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Pull failed';
    const kind = classifyError(err);
    syncState = { ...syncState, status: 'error', error: msg, errorKind: kind };
    notify();
    console.error('[sync-engine] pullRemoteHouseholds failed:', msg);
    return [];
  }
}

/**
 * Push local households to remote (used during first-login migration).
 */
export async function pushLocalHouseholds(households: Household[]): Promise<void> {
  if (!currentUserId) return;

  syncState = { ...syncState, status: 'syncing', error: null, errorKind: null };
  notify();

  try {
    const cloudPatches: Array<{ localId: string; cloudHouseholdId: string }> = [];
    for (const h of households) {
      const { newCloudHouseholdId } = await repo.upsertRemoteHousehold(h, currentUserId);
      if (newCloudHouseholdId)
        cloudPatches.push({ localId: h.id, cloudHouseholdId: newCloudHouseholdId });
    }
    await persistNewCloudHouseholdIds(cloudPatches);
    clearIncrementalQueue();
    syncState = {
      ...syncState,
      status: 'idle',
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      hasPendingChanges: queueHasWork(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Push failed';
    const kind = classifyError(err);
    syncState = { ...syncState, status: 'error', error: msg, errorKind: kind };
    console.error('[sync-engine] pushLocalHouseholds failed:', msg);
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
      return {
        householdId: local.id,
        localNewer: true,
        remoteNewer: false,
        onlyLocal: true,
        onlyRemote: false,
      };
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
    .filter(
      (r) => !localHouseholds.some((l) => defaultRemoteRepo.localHouseholdMatchesRemote(l, r)),
    )
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

  syncState = { ...syncState, status: 'syncing', error: null, errorKind: null };
  notify();

  try {
    const cloudPatches: Array<{ localId: string; cloudHouseholdId: string }> = [];
    for (const h of localHouseholds) {
      const { newCloudHouseholdId } = await repo.upsertRemoteHousehold(h, currentUserId);
      if (newCloudHouseholdId)
        cloudPatches.push({ localId: h.id, cloudHouseholdId: newCloudHouseholdId });
    }
    await persistNewCloudHouseholdIds(cloudPatches);
    clearIncrementalQueue();
    syncState = {
      ...syncState,
      status: 'idle',
      lastSyncedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      hasPendingChanges: queueHasWork(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Manual sync failed';
    const kind = classifyError(err);
    syncState = { ...syncState, status: 'error', error: msg, errorKind: kind };
    console.error('[sync-engine] manualSync failed:', msg);
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
  const effectiveChoice = choice ?? 'keep-local';

  if (effectiveChoice === 'keep-local') {
    await pushLocalHouseholds(localHouseholds);
    return localHouseholds;
  }

  if (effectiveChoice === 'keep-remote') {
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

/** Delete a remote household immediately (bypass queue). Prefer `queueHouseholdDeleteSync` from storage. */
export async function syncDeleteHousehold(householdId: string): Promise<void> {
  if (!currentUserId) return;
  try {
    await repo.deleteRemoteHousehold(householdId);
  } catch (err) {
    console.error('[sync-engine] syncDeleteHousehold failed:', err);
  }
}

/** Replace the remote repository adapter (for tests). */
export function __testOnly_setRemoteRepo(mock: RemoteRepoAdapter): void {
  repo = mock;
}

/** Reset for tests. */
export function __testOnly_resetSyncEngine(): void {
  currentUserId = null;
  clearFlushTimer();
  clearBackoffTimer();
  pendingUpserts = new Map();
  pendingDeletes = new Set();
  flushInProgress = false;
  flushAgainAfterCurrent = false;
  consecutiveTransientFailures = 0;
  syncState = { ...DEFAULT_SYNC_STATE, online: checkOnline() };
  listeners = [];
  repo = defaultRemoteRepo;
  onlineListenersBound = false;
}
