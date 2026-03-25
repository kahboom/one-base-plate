import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Household } from "../src/types";
import {
  initStorage,
  loadHouseholds,
  saveHousehold,
  saveHouseholdsLocalOnly,
  exportHouseholdsJSON,
  importHouseholdsJSON,
  resetAppStorageForTests,
  hydrateFromRemote,
  seedIfNeeded,
  SEEDED_KEY,
} from "../src/storage";
import {
  setCurrentUserId,
  getSyncState,
  syncAfterSave,
  manualSync,
  compareWithRemote,
  pullRemoteHouseholds,
  initOnlineListeners,
  setLoadHouseholdsRef,
  __testOnly_resetSyncEngine,
  __testOnly_setRemoteRepo,
  type RemoteRepoAdapter,
} from "../src/sync/sync-engine";
import type { RemoteHousehold, SyncState } from "../src/sync/types";

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

// --- Sync state enhancements ---

describe("F063: Enhanced sync state — default values", () => {
  it("getSyncState includes hasPendingChanges and online fields", () => {
    const state = getSyncState();
    expect(state.status).toBe("idle");
    expect(state.hasPendingChanges).toBe(false);
    expect(state.online).toBe(true);
    expect(state.error).toBeNull();
    expect(state.errorKind).toBeNull();
    expect(state.lastSyncedAt).toBeNull();
  });
});

describe("F063: Dirty tracking — hasPendingChanges", () => {
  it("sets hasPendingChanges=true during sync, clears on success", async () => {
    setCurrentUserId("user-1");

    const states: SyncState[] = [];
    const { onSyncStateChange } = await import("../src/sync/sync-engine");
    const unsub = onSyncStateChange((s) => states.push({ ...s }));

    await syncAfterSave([makeHousehold()]);

    unsub();

    const syncing = states.find((s) => s.status === "syncing");
    expect(syncing?.hasPendingChanges).toBe(true);

    const final = states[states.length - 1]!;
    expect(final.status).toBe("idle");
    expect(final.hasPendingChanges).toBe(false);
  });

  it("hasPendingChanges stays true on sync error", async () => {
    setCurrentUserId("user-1");
    mockRepo.upsertRemoteHousehold.mockRejectedValue(new Error("Network down"));

    await syncAfterSave([makeHousehold()]);

    const state = getSyncState();
    expect(state.status).toBe("error");
    expect(state.hasPendingChanges).toBe(true);
    expect(state.errorKind).toBe("remote_unavailable");
  });
});

describe("F063: Error classification", () => {
  it("classifies JWT errors as auth_expired", async () => {
    setCurrentUserId("user-1");
    mockRepo.upsertRemoteHousehold.mockRejectedValue(new Error("JWT expired"));

    await syncAfterSave([makeHousehold()]);

    expect(getSyncState().errorKind).toBe("auth_expired");
  });

  it("classifies network errors as remote_unavailable", async () => {
    setCurrentUserId("user-1");
    mockRepo.upsertRemoteHousehold.mockRejectedValue(new Error("Failed to fetch"));

    await syncAfterSave([makeHousehold()]);

    expect(getSyncState().errorKind).toBe("remote_unavailable");
  });

  it("classifies missing Supabase tables as schema_missing (not remote_unavailable)", async () => {
    setCurrentUserId("user-1");
    mockRepo.upsertRemoteHousehold.mockRejectedValue(
      new Error(
        "Failed to insert household: Could not find the table 'public.households' in the schema cache",
      ),
    );

    await syncAfterSave([makeHousehold()]);

    expect(getSyncState().errorKind).toBe("schema_missing");
  });

  it("classifies unknown errors as unknown", async () => {
    setCurrentUserId("user-1");
    mockRepo.upsertRemoteHousehold.mockRejectedValue(new Error("Something unexpected"));

    await syncAfterSave([makeHousehold()]);

    expect(getSyncState().errorKind).toBe("unknown");
  });
});

describe("F063: Offline dirty-state behavior", () => {
  it("skips network call and sets offline + hasPendingChanges when offline", async () => {
    setCurrentUserId("user-1");

    // Simulate offline
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    __testOnly_resetSyncEngine();
    mockRepo = createMockRepo();
    __testOnly_setRemoteRepo(mockRepo);
    setCurrentUserId("user-1");

    await syncAfterSave([makeHousehold()]);

    const state = getSyncState();
    expect(state.status).toBe("offline");
    expect(state.hasPendingChanges).toBe(true);
    expect(state.online).toBe(false);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();

    // Restore online
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
  });
});

describe("F063: Sync retry after reconnect", () => {
  it("triggers syncAfterSave when online event fires with pending changes", async () => {
    await initStorage();

    const h = makeHousehold({ id: "retry-1", name: "Retry" });
    saveHousehold(h);
    expect(loadHouseholds()).toHaveLength(1);

    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    __testOnly_resetSyncEngine();
    mockRepo = createMockRepo();
    __testOnly_setRemoteRepo(mockRepo);
    setCurrentUserId("user-1");
    setLoadHouseholdsRef(loadHouseholds);

    await syncAfterSave(loadHouseholds());
    expect(getSyncState().hasPendingChanges).toBe(true);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();

    // Go back online
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });

    initOnlineListeners();
    window.dispatchEvent(new Event("online"));

    await vi.waitFor(() => {
      expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
    });
  });
});

describe("F063: Manual sync", () => {
  it("pushes local households to remote", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const h = makeHousehold({ id: "manual-1", name: "Manual" });
    saveHousehold(h);

    const result = await manualSync(loadHouseholds());

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
    expect(result.comparisons).toBeDefined();
  });

  it("detects remote-newer conflict", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const h = makeHousehold({ id: "conflict-1", name: "Local" });
    // Avoid saveHousehold (would enqueue a successful sync and race this scenario).
    saveHouseholdsLocalOnly([h]);

    // Make remote newer
    const remoteH = makeHousehold({ id: "conflict-1", name: "Remote" });
    const remoteRow = makeRemoteHousehold(remoteH);
    remoteRow.updated_at = new Date(Date.now() + 60000).toISOString();
    mockRepo.fetchRemoteHouseholds.mockResolvedValue([remoteRow]);

    // Force pending
    mockRepo.upsertRemoteHousehold.mockRejectedValueOnce(new Error("fail"));
    await syncAfterSave(loadHouseholds());
    expect(getSyncState().hasPendingChanges).toBe(true);

    // Reset mock to succeed for manualSync
    mockRepo.upsertRemoteHousehold.mockImplementation(async (hh: Household) => ({
      remote: makeRemoteHousehold(hh),
    }));

    const result = await manualSync(loadHouseholds());

    const conflict = result.comparisons.find((c) => c.householdId === "conflict-1");
    expect(conflict?.remoteNewer).toBe(true);
  });
});

describe("F063: compareWithRemote", () => {
  it("identifies local-only, remote-only, and matching households", async () => {
    setCurrentUserId("user-1");

    const local1 = makeHousehold({ id: "local-only" });
    const shared = makeHousehold({ id: "shared" });
    const remote = makeRemoteHousehold(makeHousehold({ id: "remote-only" }));
    const sharedRemote = makeRemoteHousehold(shared);

    mockRepo.fetchRemoteHouseholds.mockResolvedValue([remote, sharedRemote]);

    const result = await compareWithRemote([local1, shared]);

    const localOnly = result.comparisons.find((c) => c.householdId === "local-only");
    expect(localOnly?.onlyLocal).toBe(true);

    const remoteOnly = result.comparisons.find((c) => c.householdId === "remote-only");
    expect(remoteOnly?.onlyRemote).toBe(true);

    const sharedComp = result.comparisons.find((c) => c.householdId === "shared");
    expect(sharedComp?.onlyLocal).toBe(false);
    expect(sharedComp?.onlyRemote).toBe(false);
  });
});

describe("F063: Shared household via membership (mock adapter)", () => {
  it("second user sees household in fetchRemoteHouseholds", async () => {
    const h = makeHousehold({ id: "shared-h", name: "Family Meals" });

    // User 2 fetches and finds the shared household
    setCurrentUserId("user-2");
    mockRepo.fetchRemoteHouseholds.mockResolvedValue([
      makeRemoteHousehold(h, "user-1"),
    ]);

    const remotes = await pullRemoteHouseholds();

    expect(remotes).toHaveLength(1);
    expect(remotes[0]!.data.name).toBe("Family Meals");
    expect(remotes[0]!.owner_id).toBe("user-1");
    expect(mockRepo.fetchRemoteHouseholds).toHaveBeenCalledWith("user-2");
  });

  it("second user can hydrate shared household locally", async () => {
    await initStorage();
    setCurrentUserId("user-2");

    const sharedH = makeHousehold({
      id: "shared-hydrate",
      name: "Shared Kitchen",
      ingredients: [
        {
          id: "i1",
          name: "salt",
          category: "pantry",
          tags: [],
          shelfLifeHint: "",
          freezerFriendly: false,
          babySafeWithAdaptation: false,
        },
      ],
    });

    await hydrateFromRemote([sharedH]);

    const local = loadHouseholds();
    expect(local).toHaveLength(1);
    expect(local[0]!.name).toBe("Shared Kitchen");
    expect(local[0]!.ingredients).toHaveLength(1);
  });
});

describe("F063: JSON export still works as a backup path", () => {
  it("exportHouseholdsJSON produces valid JSON matching current household shape", async () => {
    await initStorage();
    const h = makeHousehold({ id: "export-1", name: "Backup Test" });
    saveHousehold(h);

    const json = exportHouseholdsJSON();
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("export-1");
    expect(parsed[0].name).toBe("Backup Test");
    expect(parsed[0].members).toBeDefined();
    expect(parsed[0].ingredients).toBeDefined();
    expect(parsed[0].baseMeals).toBeDefined();
    expect(parsed[0].weeklyPlans).toBeDefined();
  });

  it("import/export round-trip preserves data", async () => {
    await initStorage();
    const h = makeHousehold({ id: "rt-1", name: "Round Trip" });
    saveHousehold(h);
    const json = exportHouseholdsJSON();

    await resetAppStorageForTests();
    __testOnly_resetSyncEngine();
    mockRepo = createMockRepo();
    __testOnly_setRemoteRepo(mockRepo);
    await initStorage();

    importHouseholdsJSON(json, "replace");
    expect(loadHouseholds()[0]!).toMatchObject({ id: "rt-1", name: "Round Trip" });
  });
});

describe("F063: Signed-out local mode — no regressions", () => {
  it("save works without auth", async () => {
    await initStorage();
    const h = makeHousehold({ id: "noauth-1", name: "Local Only" });
    saveHousehold(h);

    expect(loadHouseholds()).toHaveLength(1);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("seed behavior works in signed-out mode", async () => {
    await initStorage();
    localStorage.removeItem(SEEDED_KEY);
    await seedIfNeeded();
    expect(loadHouseholds().length).toBeGreaterThan(0);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("getSyncState shows idle with no pending changes when signed out", () => {
    const state = getSyncState();
    expect(state.status).toBe("idle");
    expect(state.hasPendingChanges).toBe(false);
  });
});

describe("F063: Household data integrity through sync", () => {
  it("all aggregate fields survive round-trip through remote", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const h = makeHousehold({
      id: "integrity-1",
      name: "Full Household",
      members: [
        {
          id: "m1",
          name: "Alex",
          role: "adult",
          safeFoods: [],
          hardNoFoods: [],
          preparationRules: [],
          textureLevel: "regular",
          allergens: [],
          notes: "",
        },
      ],
      ingredients: [
        {
          id: "i1",
          name: "garlic",
          category: "veg",
          tags: ["staple"],
          shelfLifeHint: "",
          freezerFriendly: false,
          babySafeWithAdaptation: false,
        },
      ],
      baseMeals: [
        {
          id: "bm1",
          name: "Pasta Night",
          difficulty: "medium",
          components: [],
          tags: [],
          defaultPrep: "cook",
          estimatedTimeMinutes: 30,
          rescueEligible: false,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [],
      pinnedMealIds: ["bm1"],
      mealOutcomes: [],
      weeklyAnchors: [],
      recipes: [],
    });

    saveHousehold(h);

    await vi.waitFor(() => {
      expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
    });

    const upsertedData = mockRepo.upsertRemoteHousehold.mock.calls[0]![0] as Household;
    expect(upsertedData.members).toHaveLength(1);
    expect(upsertedData.ingredients).toHaveLength(1);
    expect(upsertedData.baseMeals).toHaveLength(1);
    expect(upsertedData.pinnedMealIds).toEqual(["bm1"]);
  });
});

describe("F063: pullRemoteHouseholds with enhanced state", () => {
  it("sets lastSyncedAt on successful pull", async () => {
    setCurrentUserId("user-1");
    const h = makeHousehold({ id: "pull-1" });
    mockRepo.fetchRemoteHouseholds.mockResolvedValue([makeRemoteHousehold(h)]);

    const result = await pullRemoteHouseholds();

    expect(result).toHaveLength(1);
    expect(getSyncState().lastSyncedAt).not.toBeNull();
  });

  it("sets error state on failed pull", async () => {
    setCurrentUserId("user-1");
    mockRepo.fetchRemoteHouseholds.mockRejectedValue(new Error("Timeout"));

    const result = await pullRemoteHouseholds();

    expect(result).toHaveLength(0);
    expect(getSyncState().status).toBe("error");
    expect(getSyncState().errorKind).toBe("remote_unavailable");
  });
});
