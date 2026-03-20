import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import {
  loadHouseholds,
  saveHousehold,
  loadDefaultHouseholdId,
  saveDefaultHouseholdId,
} from "../src/storage";
import { saveImportSession, loadImportSession } from "../src/paprika-parser";
import { householdLayoutRouteBranch } from "./householdLayoutRoutes";

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h-settings",
    name: "Settings Test",
    members: [],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={["/household/h-settings/settings"]}>
      <Routes>
        {householdLayoutRouteBranch}
        <Route path="/households" element={<div data-testid="households-page">Households</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("F050 — Settings page", () => {
  it("shows data actions and Paprika import", () => {
    saveHousehold(makeHousehold());
    renderSettings();

    expect(screen.getByTestId("settings-export-btn")).toBeInTheDocument();
    expect(screen.getByTestId("settings-import-btn")).toBeInTheDocument();
    expect(screen.getByTestId("settings-clear-all-btn")).toBeInTheDocument();
    expect(screen.getByTestId("import-paprika-btn")).toBeInTheDocument();
  });

  it("clears households, default household id, and Paprika session after confirm", async () => {
    saveHousehold(makeHousehold());
    saveDefaultHouseholdId("h-settings");
    saveImportSession({
      householdId: "h-settings",
      parsedRecipes: [],
      step: "upload",
      savedAt: new Date().toISOString(),
    });

    renderSettings();

    await userEvent.click(screen.getByTestId("settings-clear-all-btn"));
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(loadHouseholds()).toEqual([]);
    expect(loadDefaultHouseholdId()).toBeNull();
    expect(loadImportSession("h-settings")).toBeNull();
    expect(screen.getByTestId("households-page")).toBeInTheDocument();
  });
});
