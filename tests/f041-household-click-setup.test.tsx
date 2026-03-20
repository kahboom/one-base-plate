import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import HouseholdList from "../src/pages/HouseholdList";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import Home from "../src/pages/Home";
import HouseholdLayout from "../src/layouts/HouseholdLayout";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-041",
    name: "Click Test Family",
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
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
  };
  saveHousehold(household);
  return household;
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HouseholdList />} />
        <Route path="/household/new" element={<HouseholdSetup />} />
        <Route path="/household/:householdId" element={<HouseholdLayout />}>
          <Route index element={<HouseholdSetup />} />
          <Route path="home" element={<Home />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F041: Clicking a household navigates to Edit setup; remove Household setup from nav", () => {
  describe("HouseholdList click behavior", () => {
    it("shows app nav on household list page", () => {
      seedHousehold();
      renderApp("/");
      expect(screen.getByTestId("global-nav")).toBeInTheDocument();
    });

    it("clicking household row opens household modal", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/");
      const row = screen.getByTestId("household-row-h-041");
      await user.click(within(row).getByRole("button", { name: /edit click test family/i }));
      expect(screen.getByTestId("household-modal")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Click Test Family")).toBeInTheDocument();
      expect(within(screen.getByTestId("household-modal")).queryByTestId("global-nav")).not.toBeInTheDocument();
    });

    it("clicking outside household modal closes it", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/");
      const row = screen.getByTestId("household-row-h-041");
      await user.click(within(row).getByRole("button", { name: /edit click test family/i }));
      const dialog = screen.getByRole("dialog", { name: "Edit household" });
      await user.click(dialog);
      expect(screen.queryByTestId("household-modal")).not.toBeInTheDocument();
    });

    it("modal includes member profile link to /household/:id/member/:memberId", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/");
      const row = screen.getByTestId("household-row-h-041");
      await user.click(within(row).getByRole("button", { name: /edit click test family/i }));
      const profileLink = screen.getByTestId("modal-member-profile-m1");
      const href = profileLink.getAttribute("href");
      expect(href).toBe("/household/h-041/member/m1");
      expect(href).not.toContain("/home");
    });

    it("no redundant Setup button in household list rows", () => {
      seedHousehold();
      renderApp("/");
      expect(screen.queryByRole("button", { name: /setup/i })).not.toBeInTheDocument();
    });

    it("Delete household action is available in modal", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/");
      const row = screen.getByTestId("household-row-h-041");
      await user.click(within(row).getByRole("button", { name: /edit click test family/i }));
      expect(within(screen.getByTestId("household-modal")).getByText("Delete household")).toBeInTheDocument();
    });

    it("does not auto-save modal edits without clicking Save", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/");
      const row = screen.getByTestId("household-row-h-041");
      await user.click(within(row).getByRole("button", { name: /edit click test family/i }));
      const modal = screen.getByTestId("household-modal");
      const nameInput = within(modal).getByTestId("modal-household-name");
      await user.clear(nameInput);
      await user.type(nameInput, "Unsaved Name");
      await user.click(within(modal).getByText("Cancel"));

      const persisted = loadHousehold("h-041");
      expect(persisted?.name).toBe("Click Test Family");
    });

    it("persists modal edits only after clicking Save", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/");
      const row = screen.getByTestId("household-row-h-041");
      await user.click(within(row).getByRole("button", { name: /edit click test family/i }));
      const modal = screen.getByTestId("household-modal");
      const nameInput = within(modal).getByTestId("modal-household-name");
      await user.clear(nameInput);
      await user.type(nameInput, "Saved Name");
      await user.click(within(modal).getByText("Save"));

      const persisted = loadHousehold("h-041");
      expect(persisted?.name).toBe("Saved Name");
    });
  });

  describe("Household setup removed from HouseholdNav", () => {
    it("nav does not contain Household setup link", () => {
      seedHousehold();
      renderApp("/household/h-041");
      const nav = screen.getByRole("navigation", { name: "Global navigation" });
      expect(within(nav).queryByText("Household setup")).not.toBeInTheDocument();
    });

    it("Home link is still present in nav", () => {
      seedHousehold();
      renderApp("/household/h-041");
      const nav = screen.getByRole("navigation", { name: "Global navigation" });
      expect(within(nav).getByText("Home")).toBeInTheDocument();
    });

    it("All households link is present in secondary nav", () => {
      seedHousehold();
      renderApp("/household/h-041");
      const sectionNav = screen.getByTestId("section-nav");
      expect(within(sectionNav).getByText("All households")).toBeInTheDocument();
    });
  });

  describe("Users can reach Home from within a household", () => {
    it("clicking Home in nav from HouseholdSetup navigates to Home page", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/household/h-041");
      const nav = screen.getByRole("navigation", { name: "Global navigation" });
      await user.click(within(nav).getByText("Home"));
      expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    });
  });
});
