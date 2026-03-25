import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Household } from "../src/types";
import {
  initStorage,
  loadHouseholds,
  saveHousehold,
  deleteHousehold,
  exportHouseholdsJSON,
  importHouseholdsJSON,
  resetAppStorageForTests,
  seedIfNeeded,
  hydrateFromRemote,
  SEEDED_KEY,
} from "../src/storage";
import {
  setCurrentUserId,
  getSyncState,
  resolveFirstLogin,
  detectFirstLoginContext,
  syncAfterSave,
  syncDeleteHousehold,
  __testOnly_resetSyncEngine,
  __testOnly_setRemoteRepo,
  type RemoteRepoAdapter,
} from "../src/sync/sync-engine";
import type { RemoteHousehold, FirstLoginContext } from "../src/sync/types";

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

describe("F062: Signed-out local-only behavior (no regressions)", () => {
  it("saveHousehold works without auth — no remote calls", async () => {
    await initStorage();
    const h = makeHousehold({ id: "local-1", name: "Local Only" });
    saveHousehold(h);

    expect(loadHouseholds()).toHaveLength(1);
    expect(loadHouseholds()[0]!.name).toBe("Local Only");
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("deleteHousehold works without auth — no remote calls", async () => {
    await initStorage();
    const h = makeHousehold({ id: "del-1" });
    saveHousehold(h);
    deleteHousehold("del-1");

    expect(loadHouseholds()).toHaveLength(0);
    expect(mockRepo.deleteRemoteHousehold).not.toHaveBeenCalled();
  });

  it("seed behavior still works in signed-out mode", async () => {
    await initStorage();
    localStorage.removeItem(SEEDED_KEY);
    await seedIfNeeded();
    expect(loadHouseholds().length).toBeGreaterThan(0);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("JSON import/export round-trips without auth", async () => {
    await initStorage();
    const h = makeHousehold({ id: "ie-1", name: "IE Test" });
    saveHousehold(h);
    const json = exportHouseholdsJSON();

    await resetAppStorageForTests();
    __testOnly_resetSyncEngine();
    mockRepo = createMockRepo();
    __testOnly_setRemoteRepo(mockRepo);
    await initStorage();

    importHouseholdsJSON(json, "replace");
    expect(loadHouseholds()[0]!).toMatchObject({ id: "ie-1", name: "IE Test" });
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });
});

describe("F062: Authenticated save triggers remote sync", () => {
  it("saveHousehold calls upsertRemoteHousehold when signed in", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const h = makeHousehold({ id: "sync-1", name: "Synced" });
    saveHousehold(h);

    await vi.waitFor(() => {
      expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
    });
  });

  it("deleteHousehold calls remote delete when signed in", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    const delId = crypto.randomUUID();
    saveHousehold(makeHousehold({ id: delId }));
    deleteHousehold(delId);

    await vi.waitFor(() => {
      expect(mockRepo.deleteRemoteHousehold).toHaveBeenCalledWith(delId);
    });
  });

  it("failed sync logs error but does not break local save", async () => {
    await initStorage();
    setCurrentUserId("user-1");

    mockRepo.upsertRemoteHousehold.mockRejectedValue(new Error("Network down"));

    const h = makeHousehold({ id: "fail-sync", name: "Survives" });
    saveHousehold(h);

    await vi.waitFor(() => {
      expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
    });

    expect(loadHouseholds()[0]!.name).toBe("Survives");
    expect(getSyncState().status).toBe("error");
    expect(getSyncState().error).toContain("Network down");
  });
});

describe("F062: syncAfterSave and syncDeleteHousehold", () => {
  it("syncAfterSave upserts all households and updates sync state", async () => {
    setCurrentUserId("user-1");
    const h1 = makeHousehold({ id: "s1" });
    const h2 = makeHousehold({ id: "s2" });

    await syncAfterSave([h1, h2]);

    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalledTimes(2);
    expect(getSyncState().status).toBe("idle");
    expect(getSyncState().lastSyncedAt).not.toBeNull();
  });

  it("syncDeleteHousehold calls remote delete", async () => {
    setCurrentUserId("user-1");

    await syncDeleteHousehold("hh-del");

    expect(mockRepo.deleteRemoteHousehold).toHaveBeenCalledWith("hh-del");
  });

  it("syncAfterSave does nothing when not authenticated", async () => {
    setCurrentUserId(null);
    await syncAfterSave([makeHousehold()]);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });
});

describe("F062: First-login migration — local only → remote empty", () => {
  it("uploads local households to remote when remote is empty", async () => {
    setCurrentUserId("user-1");
    const h = makeHousehold({ id: "first-1", name: "First" });

    mockRepo.fetchRemoteHouseholds.mockResolvedValue([]);

    const ctx = await detectFirstLoginContext([h]);
    expect(ctx.needsResolution).toBe(false);

    const result = await resolveFirstLogin(ctx);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("first-1");
    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
  });
});

describe("F062: First-login migration — local empty → remote has data", () => {
  it("returns remote households for local hydration", async () => {
    setCurrentUserId("user-1");
    const remoteH = makeHousehold({ id: "remote-1", name: "From Cloud" });

    mockRepo.fetchRemoteHouseholds.mockResolvedValue([makeRemoteHousehold(remoteH)]);

    const ctx = await detectFirstLoginContext([]);
    expect(ctx.needsResolution).toBe(false);

    const result = await resolveFirstLogin(ctx);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("From Cloud");
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });
});

describe("F062: First-login migration — both sides have data (conflict)", () => {
  let ctx: FirstLoginContext;
  const localH = makeHousehold({ id: "both-local", name: "Local Data" });
  const remoteH = makeHousehold({ id: "both-remote", name: "Remote Data" });

  beforeEach(async () => {
    setCurrentUserId("user-1");
    mockRepo.fetchRemoteHouseholds.mockResolvedValue([makeRemoteHousehold(remoteH)]);

    ctx = await detectFirstLoginContext([localH]);
  });

  it("detects conflict when both local and remote have data", () => {
    expect(ctx.needsResolution).toBe(true);
    expect(ctx.localHouseholds).toHaveLength(1);
    expect(ctx.remoteHouseholds).toHaveLength(1);
  });

  it("keep-local: uploads local and returns local", async () => {
    const result = await resolveFirstLogin(ctx, "keep-local");
    expect(result.map((h) => h.id)).toEqual(["both-local"]);
    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
  });

  it("keep-remote: returns remote data without uploading", async () => {
    mockRepo.upsertRemoteHousehold.mockClear();
    const result = await resolveFirstLogin(ctx, "keep-remote");
    expect(result.map((h) => h.id)).toEqual(["both-remote"]);
    expect(mockRepo.upsertRemoteHousehold).not.toHaveBeenCalled();
  });

  it("merge: combines both and uploads merged set", async () => {
    const result = await resolveFirstLogin(ctx, "merge");
    const ids = result.map((h) => h.id).sort();
    expect(ids).toEqual(["both-local", "both-remote"]);
    expect(mockRepo.upsertRemoteHousehold).toHaveBeenCalled();
  });

  it("merge with overlapping IDs: local wins", async () => {
    const shared = makeHousehold({ id: "shared-id", name: "Local Version" });
    const remoteShared = makeHousehold({ id: "shared-id", name: "Remote Version" });

    mockRepo.fetchRemoteHouseholds.mockResolvedValue([
      makeRemoteHousehold(remoteShared),
    ]);

    const overlapCtx = await detectFirstLoginContext([shared]);
    const result = await resolveFirstLogin(overlapCtx, "merge");

    const match = result.find((h) => h.id === "shared-id");
    expect(match!.name).toBe("Local Version");
  });
});

describe("F062: hydrateFromRemote", () => {
  it("replaces local Dexie data with remote households", async () => {
    await initStorage();
    saveHousehold(makeHousehold({ id: "old-local", name: "Old" }));
    expect(loadHouseholds()).toHaveLength(1);

    const remote = [makeHousehold({ id: "from-remote", name: "New Cloud" })];
    await hydrateFromRemote(remote);

    expect(loadHouseholds()).toHaveLength(1);
    expect(loadHouseholds()[0]!.id).toBe("from-remote");
    expect(loadHouseholds()[0]!.name).toBe("New Cloud");
  });
});

describe("F062: Sync state tracking", () => {
  it("getSyncState starts idle", () => {
    const state = getSyncState();
    expect(state.status).toBe("idle");
    expect(state.lastSyncedAt).toBeNull();
    expect(state.error).toBeNull();
  });

  it("successful sync sets lastSyncedAt", async () => {
    setCurrentUserId("user-1");

    await syncAfterSave([makeHousehold()]);

    expect(getSyncState().status).toBe("idle");
    expect(getSyncState().lastSyncedAt).not.toBeNull();
  });

  it("failed sync sets error status", async () => {
    setCurrentUserId("user-1");
    mockRepo.upsertRemoteHousehold.mockRejectedValue(new Error("Timeout"));

    await syncAfterSave([makeHousehold()]);

    expect(getSyncState().status).toBe("error");
    expect(getSyncState().error).toContain("Timeout");
  });
});

describe("F062: Household access filtering via membership", () => {
  it("fetchRemoteHouseholds filters by user membership", async () => {
    setCurrentUserId("user-1");

    const h1 = makeHousehold({ id: "m-1", name: "Mine" });
    const h2 = makeHousehold({ id: "m-2", name: "Also Mine" });

    mockRepo.fetchRemoteHouseholds.mockResolvedValue([
      makeRemoteHousehold(h1, "user-1"),
      makeRemoteHousehold(h2, "user-1"),
    ]);

    const ctx = await detectFirstLoginContext([]);
    expect(ctx.remoteHouseholds).toHaveLength(2);
    expect(mockRepo.fetchRemoteHouseholds).toHaveBeenCalledWith("user-1");
  });
});
