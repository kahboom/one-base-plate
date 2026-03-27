import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Household } from "../src/types";
import {
  initStorage,
  loadHouseholds,
  saveHousehold,
  deleteHousehold,
  importHouseholdsJSON,
  hydrateFromRemote,
  runMigrationIfNeeded,
  MIGRATION_KEY,
} from "../src/storage";
import {
  setCurrentUserId,
  getSyncState,
  flushQueuedSync,
  manualSync,
  resolveFirstLogin,
  detectFirstLoginContext,
  initOnlineListeners,
  __testOnly_resetSyncEngine,
  __testOnly_setRemoteRepo,
  type RemoteRepoAdapter,
} from "../src/sync/sync-engine";
import type { RemoteHousehold } from "../src/sync/types";

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Test Household",
    members: [],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    ...overrides,
  };
}

function makeRemoteHousehold(h: Household, ownerId = "user-1"): RemoteHousehold {
  return {
    id: h.id,
    data: h,
    owner_id: ownerId,
    updated_at: new Date().toISOString(),
    version: 1,
  };
}

function createMockRepo(): RemoteRepoAdapter & {
  fetchRemoteHouseholds: ReturnType<typeof vi.fn>;
  upsertRemoteHousehold: ReturnType<typeof vi.fn>;
  deleteRemoteHousehold: ReturnType<typeof vi.fn>;
} {
  return {
    fetchRemoteHouseholds: vi.fn().mockResolvedValue([]),
    upsertRemoteHousehold: vi.fn().mockImplementation(async (h: Household) => ({
      remote: makeRemoteHousehold(h),
    })),
    deleteRemoteHousehold: vi.fn().mockResolvedValue(undefined),
  };
}

let mockRepo: ReturnType<typeof createMockRepo>;

beforeEach(async () => {
  __testOnly_resetSyncEngine();
  mockRepo = createMockRepo();
  __testOnly_setRemoteRepo(mockRepo);
});

describe("F068: Incremental sync queue", () => {
  it("saving one household upserts only that household when two exist locally", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const h1 = makeHousehold({ id: "q-a", name: "A" });
    const h2 = makeHousehold({ id: "q-b", name: "B" });
    saveHousehold(h1);
    saveHousehold(h2);
    await flushQueuedSync();
    mockRepo.upsertRemoteHousehold.mockClear();

    saveHousehold({ ...h1, name: "A-edited" });
    await flushQueuedSync();

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(1);
    expect((mockRepo.upsertRemoteHousehold.mock.calls[0]![0] as Household).id).toBe("q-a");
    expect((mockRepo.upsertRemoteHousehold.mock.calls[0]![0] as Household).name).toBe("A-edited");
  });

  it("rapid repeated edits to one household collapse to one remote upsert", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    saveHousehold(makeHousehold({ id: "rapid-1", name: "v1" }));
    saveHousehold(makeHousehold({ id: "rapid-1", name: "v2" }));
    saveHousehold(makeHousehold({ id: "rapid-1", name: "v3" }));
    await flushQueuedSync();

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(1);
    expect((mockRepo.upsertRemoteHousehold.mock.calls[0]![0] as Household).name).toBe("v3");
  });

  it("rapid edits to multiple households produce one upsert each", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    saveHousehold(makeHousehold({ id: "m1", name: "a" }));
    saveHousehold(makeHousehold({ id: "m2", name: "b" }));
    saveHousehold(makeHousehold({ id: "m1", name: "a2" }));
    await flushQueuedSync();

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(2);
    const ids = mockRepo.upsertRemoteHousehold.mock.calls.map((c) => (c[0] as Household).id).sort();
    expect(ids).toEqual(["m1", "m2"]);
  });

  it("concurrent flushQueuedSync calls do not overlap upsert loops", async () => {
    setCurrentUserId("user-1");

    mockRepo.upsertRemoteHousehold.mockImplementation(
      async (h: Household) =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ remote: makeRemoteHousehold(h) }), 25);
        }),
    );

    const { queueHouseholdSync } = await import("../src/sync/sync-engine");
    queueHouseholdSync(makeHousehold({ id: "conc-1" }));

    const p1 = flushQueuedSync();
    await Promise.resolve();
    queueHouseholdSync(makeHousehold({ id: "conc-2" }));
    void flushQueuedSync();
    await p1;
    await vi.waitFor(
      () => {
        expect(mockRepo.upsertRemoteHousehold.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 3000 },
    );

    const ids = mockRepo.upsertRemoteHousehold.mock.calls.map((c) => (c[0] as Household).id).sort();
    expect(ids).toEqual(["conc-1", "conc-2"]);
  });

  it("offline save sets pending without remote upsert", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    __testOnly_resetSyncEngine();
    mockRepo = createMockRepo();
    __testOnly_setRemoteRepo(mockRepo);
    setCurrentUserId("user-1");

    saveHousehold(makeHousehold({ id: "off-1" }));

    expect(getSyncState().status).toBe("offline");
    expect(getSyncState().hasPendingChanges).toBe(true);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
  });

  it("reconnect flushes only queued households, not entire local array", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    saveHousehold(makeHousehold({ id: "extra-1", name: "Extra" }));
    await flushQueuedSync();
    mockRepo.upsertRemoteHousehold.mockClear();

    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    __testOnly_resetSyncEngine();
    mockRepo = createMockRepo();
    __testOnly_setRemoteRepo(mockRepo);
    setCurrentUserId("user-1");

    const { syncAfterSave } = await import("../src/sync/sync-engine");
    await syncAfterSave([makeHousehold({ id: "recon-1", name: "QueuedOnly" })]);

    expect(getSyncState().hasPendingChanges).toBe(true);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });

    initOnlineListeners();
    window.dispatchEvent(new Event("online"));

    await vi.waitFor(
      () => {
        expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(1);
    expect((mockRepo.upsertRemoteHousehold.mock.calls[0]![0] as Household).id).toBe("recon-1");
  });

  it("delete sync targets only the remote PK", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const delId = crypto.randomUUID();
    saveHousehold(makeHousehold({ id: delId }));
    await flushQueuedSync();
    mockRepo.deleteRemoteHousehold.mockClear();
    mockRepo.upsertRemoteHousehold.mockClear();

    saveHousehold(makeHousehold({ id: "keep-me" }));
    deleteHousehold(delId);
    await flushQueuedSync();

    expect(mockRepo.deleteRemoteHousehold).toHaveBeenCalledTimes(1);
    expect(mockRepo.deleteRemoteHousehold).toHaveBeenCalledWith(delId);
  });

  it("first cloud upsert persists cloudHouseholdId via local-only save (no extra upsert storm)", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const cloudRow = crypto.randomUUID();
    mockRepo.upsertRemoteHousehold.mockImplementation(async (h: Household) => ({
      remote: makeRemoteHousehold({ ...h, cloudHouseholdId: cloudRow }),
      newCloudHouseholdId: cloudRow,
    }));

    saveHousehold(makeHousehold({ id: "local-seed", name: "Seed" }));
    await flushQueuedSync();

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(1);
    const stored = loadHouseholds().find((x) => x.id === "local-seed");
    expect(stored?.cloudHouseholdId).toBe(cloudRow);
    mockRepo.upsertRemoteHousehold.mockClear();

    await flushQueuedSync();
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("import, hydrate, and migration do not trigger remote upsert", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const h = makeHousehold({ id: "imp-1" });
    importHouseholdsJSON(JSON.stringify([h]), "replace");
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();

    await hydrateFromRemote([makeHousehold({ id: "hyd-1" })]);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();

    localStorage.removeItem(MIGRATION_KEY);
    const withDupes = loadHouseholds();
    if (withDupes.length > 0) {
      withDupes[0]!.ingredients.push({
        id: "d1",
        name: "salt",
        category: "pantry",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: false,
      });
      withDupes[0]!.ingredients.push({
        id: "d2",
        name: "salt",
        category: "pantry",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: false,
      });
      importHouseholdsJSON(JSON.stringify(withDupes), "replace");
    }
    runMigrationIfNeeded();
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("manual sync and first-login push still upsert all intended households", async () => {
    setCurrentUserId("user-1");
    mockRepo.fetchRemoteHouseholds.mockResolvedValue([]);

    const h1 = makeHousehold({ id: "fl-1", name: "One" });
    const h2 = makeHousehold({ id: "fl-2", name: "Two" });
    const ctx = await detectFirstLoginContext([h1, h2]);
    await resolveFirstLogin(ctx);

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(2);

    mockRepo.upsertRemoteHousehold.mockClear();
    await initStorage();
    saveHousehold(h1);
    saveHousehold(h2);
    await manualSync(loadHouseholds());

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(2);
  });

  it("sign-out clears pending queue and flush is a no-op", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    saveHousehold(makeHousehold({ id: "signout-1" }));
    expect(getSyncState().hasPendingChanges).toBe(true);

    setCurrentUserId(null);
    expect(getSyncState().hasPendingChanges).toBe(false);

    await flushQueuedSync();
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("abort flush when session ends mid-batch (no second upsert)", async () => {
    setCurrentUserId("user-1");
    const h1 = makeHousehold({ id: "auth-a", name: "A" });
    const h2 = makeHousehold({ id: "auth-b", name: "B" });
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    mockRepo.upsertRemoteHousehold.mockImplementation(async (h: Household) => {
      if (h.id === "auth-a") {
        await gate;
      }
      return { remote: makeRemoteHousehold(h) };
    });

    const { queueHouseholdSync } = await import("../src/sync/sync-engine");
    queueHouseholdSync(h1);
    queueHouseholdSync(h2);
    const flushP = flushQueuedSync();
    await vi.waitFor(() => expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(1));
    setCurrentUserId(null);
    release();
    await flushP;
    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(1);
  });

  it("backoff retry after remote_unavailable on queued flush", async () => {
    vi.useFakeTimers();
    try {
      setCurrentUserId("user-1");
      let n = 0;
      mockRepo.upsertRemoteHousehold.mockImplementation(async (h: Household) => {
        n += 1;
        if (n === 1) throw new Error("failed to fetch");
        return { remote: makeRemoteHousehold(h) };
      });
      const { queueHouseholdSync } = await import("../src/sync/sync-engine");
      queueHouseholdSync(makeHousehold({ id: "backoff-h1" }));
      await flushQueuedSync();
      expect(n).toBe(1);
      expect(getSyncState().errorKind).toBe("remote_unavailable");
      await vi.advanceTimersByTimeAsync(4000);
      await vi.waitFor(() => expect(n).toBe(2), { timeout: 5000 });
      expect(getSyncState().status).toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("duplicate online events coalesce without duplicate upserts", async () => {
    await initStorage();

    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    __testOnly_resetSyncEngine();
    mockRepo = createMockRepo();
    __testOnly_setRemoteRepo(mockRepo);
    setCurrentUserId("user-1");

    const { syncAfterSave } = await import("../src/sync/sync-engine");
    await syncAfterSave([makeHousehold({ id: "dup-on-1", name: "Queued" })]);

    expect(getSyncState().hasPendingChanges).toBe(true);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    initOnlineListeners();
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));

    await vi.waitFor(
      () => {
        expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 },
    );
  });
});
