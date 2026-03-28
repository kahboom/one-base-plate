import { META_PAPRIKA_SESSION, PAPRIKA_SESSION_LS_KEY } from './constants';
import { getAppDb } from './dexie-db';

/** Memory copy; hydrated in initStorage() from Dexie. Paprika UI reads synchronously. */
let paprikaImportSessionJson: string | null = null;

export function setPaprikaImportSessionMemory(json: string | null): void {
  paprikaImportSessionJson = json;
}

export function getPaprikaImportSessionMemory(): string | null {
  return paprikaImportSessionJson;
}

/** Update memory immediately; persist to IndexedDB asynchronously. */
export function rememberAndQueuePaprikaImportSessionPersist(json: string): void {
  paprikaImportSessionJson = json;
  void getAppDb()
    .meta.put({ key: META_PAPRIKA_SESSION, value: json })
    .catch((err) => console.error('Failed to persist Paprika session:', err));
}

export function clearPaprikaImportSessionSync(): void {
  paprikaImportSessionJson = null;
  void getAppDb()
    .meta.delete(META_PAPRIKA_SESSION)
    .catch((err) => console.error('Failed to clear Paprika session:', err));
}

export async function clearPaprikaImportSessionPersisted(): Promise<void> {
  paprikaImportSessionJson = null;
  await getAppDb().meta.delete(META_PAPRIKA_SESSION);
}

/** One-time: move Paprika draft from localStorage into Dexie. */
export async function migratePaprikaSessionFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(PAPRIKA_SESSION_LS_KEY);
  if (!raw) return;
  const existing = await getAppDb().meta.get(META_PAPRIKA_SESSION);
  if (existing?.value != null) {
    localStorage.removeItem(PAPRIKA_SESSION_LS_KEY);
    return;
  }
  await getAppDb().meta.put({ key: META_PAPRIKA_SESSION, value: raw });
  paprikaImportSessionJson = raw;
  localStorage.removeItem(PAPRIKA_SESSION_LS_KEY);
}
