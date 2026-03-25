import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Household } from "../src/types";
import {
  loadHouseholds,
  resetAppStorageForTests,
  saveHousehold,
  saveHouseholds,
  exportHouseholdsJSON,
  importHouseholdsJSON,
} from "../src/storage";
import HouseholdList from "../src/pages/HouseholdList";

beforeEach(() => {
  localStorage.clear();
});

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h1",
    name: "Test Family",
    members: [],
    ingredients: [],
    recipes: [],
    baseMeals: [],
    weeklyPlans: [],
    ...overrides,
  };
}

describe("F039: Export/import storage functions", () => {
  it("exports all households as formatted JSON", () => {
    const h1 = makeHousehold({ id: "h1", name: "Family A" });
    const h2 = makeHousehold({ id: "h2", name: "Family B" });
    saveHouseholds([h1, h2]);

    const json = exportHouseholdsJSON();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("Family A");
    expect(parsed[1].name).toBe("Family B");
  });

  it("exports selected households by ID", () => {
    saveHouseholds([
      makeHousehold({ id: "h1", name: "Family A" }),
      makeHousehold({ id: "h2", name: "Family B" }),
      makeHousehold({ id: "h3", name: "Family C" }),
    ]);

    const json = exportHouseholdsJSON(["h1", "h3"]);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((h: Household) => h.name)).toEqual(["Family A", "Family C"]);
  });

  it("imports JSON in replace mode (clears existing)", () => {
    saveHousehold(makeHousehold({ id: "existing", name: "Old" }));
    const newData = [makeHousehold({ id: "new1", name: "New" })];
    const result = importHouseholdsJSON(JSON.stringify(newData), "replace");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("New");
    expect(loadHouseholds()).toHaveLength(1);
  });

  it("imports JSON in merge mode (keeps existing, adds new)", () => {
    saveHousehold(makeHousehold({ id: "h1", name: "Existing" }));
    const newData = [makeHousehold({ id: "h2", name: "New" })];
    const result = importHouseholdsJSON(JSON.stringify(newData), "merge");

    expect(result).toHaveLength(2);
    expect(loadHouseholds()).toHaveLength(2);
  });

  it("merge mode updates existing households with same ID", () => {
    saveHousehold(makeHousehold({ id: "h1", name: "Old Name" }));
    const updated = [makeHousehold({ id: "h1", name: "Updated Name" })];
    importHouseholdsJSON(JSON.stringify(updated), "merge");

    const loaded = loadHouseholds();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe("Updated Name");
  });

  it("throws on invalid JSON input", () => {
    expect(() => importHouseholdsJSON("not json")).toThrow();
  });

  it("throws on non-array JSON input", () => {
    expect(() => importHouseholdsJSON('{"id":"h1"}')).toThrow("expected array");
  });

  it("round-trips: exported JSON can be re-imported to restore data", async () => {
    const h = makeHousehold({
      id: "rt1",
      name: "Round Trip",
      members: [
        {
          id: "m1",
          name: "Alice",
          role: "adult",
          safeFoods: ["pasta"],
          hardNoFoods: ["mushrooms"],
          preparationRules: [{ ingredient: "tomato", rule: "diced" }],
          textureLevel: "regular",
          allergens: [],
          notes: "",
        },
      ],
      ingredients: [
        {
          id: "i1",
          name: "pasta",
          category: "carb",
          tags: ["staple"],
          shelfLifeHint: "",
          freezerFriendly: false,
          babySafeWithAdaptation: true,
        },
      ],
    });
    saveHousehold(h);

    const exported = exportHouseholdsJSON();
    await resetAppStorageForTests();
    expect(loadHouseholds()).toHaveLength(0);

    importHouseholdsJSON(exported, "replace");
    const restored = loadHouseholds();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toEqual(h);
  });
});

describe("F039: HouseholdList export/import UI", () => {
  it("shows Export data and Import data buttons", () => {
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    expect(screen.getByText("Export data")).toBeInTheDocument();
    expect(screen.getByText("Import data")).toBeInTheDocument();
  });

  it("export button triggers download", () => {
    saveHousehold(makeHousehold());
    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const a = origCreateElement("a");
        a.click = clickSpy;
        return a;
      }
      return origCreateElement(tag);
    });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
    globalThis.URL.revokeObjectURL = vi.fn();

    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    screen.getByText("Export data").click();
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("import button opens file picker", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    const fileInput = screen.getByTestId("import-file-input");
    expect(fileInput).toHaveClass("hidden");
    const clickSpy = vi.spyOn(fileInput, "click");
    await user.click(screen.getByText("Import data"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("importing a valid JSON file updates the household list", async () => {
    saveHousehold(makeHousehold({ id: "existing", name: "Existing" }));
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );

    const importData = [makeHousehold({ id: "imported", name: "Imported Family" })];
    const file = new File([JSON.stringify(importData)], "test.json", {
      type: "application/json",
    });
    const fileInput = screen.getByTestId("import-file-input");
    await userEvent.upload(fileInput, file);

    expect(await screen.findByText("Imported Family")).toBeInTheDocument();
    expect(screen.getByText("Existing")).toBeInTheDocument();
  });

  it("exported JSON file has the correct filename", () => {
    saveHousehold(makeHousehold());
    let downloadName = "";
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const a = origCreateElement("a");
        a.click = vi.fn();
        const origSet = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "download")?.set;
        Object.defineProperty(a, "download", {
          set(v: string) { downloadName = v; origSet?.call(a, v); },
          get() { return downloadName; },
        });
        return a;
      }
      return origCreateElement(tag);
    });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
    globalThis.URL.revokeObjectURL = vi.fn();

    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    screen.getByText("Export data").click();
    expect(downloadName).toBe("onebaseplate-export.json");
    vi.restoreAllMocks();
  });
});

describe("F039: Seed script compatibility", () => {
  it("fixture JSON files match the Household structure used by storage", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const fixturesDir = join(process.cwd(), "fixtures", "households");
    const files = readdirSync(fixturesDir).filter((f: string) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const data = JSON.parse(readFileSync(join(fixturesDir, file), "utf-8"));
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("ingredients");
      expect(data).toHaveProperty("baseMeals");
      expect(Array.isArray(data.members)).toBe(true);
    }
  });

  it("fixture JSON can be imported via importHouseholdsJSON", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const fixturesDir = join(process.cwd(), "fixtures", "households");
    const files = readdirSync(fixturesDir).filter((f: string) => f.endsWith(".json"));
    const households = files.map((f: string) =>
      JSON.parse(readFileSync(join(fixturesDir, f), "utf-8")),
    );
    const result = importHouseholdsJSON(JSON.stringify(households), "replace");
    expect(result.length).toBe(files.length);
    expect(loadHouseholds().length).toBe(files.length);
  });
});
