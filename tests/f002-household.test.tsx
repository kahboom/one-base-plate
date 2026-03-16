import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, MemberRole } from "../src/types";
import { loadHouseholds, saveHousehold, loadHousehold, saveHouseholds } from "../src/storage";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import App from "../src/App";

beforeEach(() => {
  localStorage.clear();
});

describe("F002: Storage layer", () => {
  it("saves and loads a household", () => {
    const household: Household = {
      id: "test-1",
      name: "Test Household",
      members: [
        {
          id: "m1",
          name: "Alice",
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
    };

    saveHousehold(household);
    const loaded = loadHousehold("test-1");
    expect(loaded).toEqual(household);
  });

  it("updates an existing household", () => {
    const household: Household = {
      id: "test-1",
      name: "Original",
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };

    saveHousehold(household);
    saveHousehold({ ...household, name: "Updated" });

    const all = loadHouseholds();
    expect(all).toHaveLength(1);
    expect(all[0]!.name).toBe("Updated");
  });

  it("returns empty array when no households exist", () => {
    expect(loadHouseholds()).toEqual([]);
  });

  it("returns undefined for non-existent household", () => {
    expect(loadHousehold("nonexistent")).toBeUndefined();
  });
});

describe("F002: Household setup UI", () => {
  it("can create a household with four members of different roles", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );

    // Set household name
    const nameInput = screen.getByPlaceholderText("Household name");
    await user.type(nameInput, "Mixed Family");

    // Add 4 members
    const addButton = screen.getByText("Add member");
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    // Get all member cards by test ID prefix
    const memberCards = screen.getAllByText("Member").map((el) => el.closest("[data-testid^='member-']") as HTMLElement);
    expect(memberCards).toHaveLength(4);

    // Fill in member details with different roles
    const memberConfigs: { name: string; role: MemberRole }[] = [
      { name: "Alex", role: "adult" },
      { name: "Jordan", role: "adult" },
      { name: "Riley", role: "toddler" },
      { name: "Sam", role: "baby" },
    ];

    for (let i = 0; i < memberConfigs.length; i++) {
      const card = memberCards[i]!;
      const config = memberConfigs[i]!;
      const nameField = within(card).getByPlaceholderText("Member name");
      await user.type(nameField, config.name);

      if (config.role !== "adult") {
        const roleSelect = within(card).getByDisplayValue("adult");
        await user.selectOptions(roleSelect, config.role);
      }
    }

    // Auto-save persists on change; verify persistence
    const households = loadHouseholds();
    expect(households).toHaveLength(1);

    const saved = households[0]!;
    expect(saved.name).toBe("Mixed Family");
    expect(saved.members).toHaveLength(4);

    const roles = saved.members.map((m) => m.role);
    expect(roles.filter((r) => r === "adult")).toHaveLength(2);
    expect(roles).toContain("toddler");
    expect(roles).toContain("baby");

    expect(saved.members.map((m) => m.name)).toEqual([
      "Alex",
      "Jordan",
      "Riley",
      "Sam",
    ]);
  });

  it("can re-open a saved household and see all members", async () => {
    // Pre-save a household
    const household: Household = {
      id: "h-reopen",
      name: "Persisted Family",
      members: [
        {
          id: "m1",
          name: "Parent",
          role: "adult",
          safeFoods: ["rice"],
          hardNoFoods: [],
          preparationRules: [],
          textureLevel: "regular",
          allergens: [],
          notes: "",
        },
        {
          id: "m2",
          name: "Child",
          role: "toddler",
          safeFoods: ["pasta"],
          hardNoFoods: [],
          preparationRules: [],
          textureLevel: "soft",
          allergens: [],
          notes: "",
        },
        {
          id: "m3",
          name: "Baby",
          role: "baby",
          safeFoods: ["banana"],
          hardNoFoods: [],
          preparationRules: [],
          textureLevel: "mashable",
          allergens: [],
          notes: "",
        },
        {
          id: "m4",
          name: "Other Parent",
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
    };
    saveHousehold(household);

    render(
      <MemoryRouter initialEntries={["/household/h-reopen"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );

    // Verify household name is displayed
    expect(screen.getByDisplayValue("Persisted Family")).toBeInTheDocument();

    // Verify all 4 members are shown
    expect(screen.getByDisplayValue("Parent")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Child")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Baby")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Other Parent")).toBeInTheDocument();

    // Verify member count
    expect(screen.getByText("Members (4)")).toBeInTheDocument();
  });

  it("can remove a member", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText("Add member"));
    await user.click(screen.getByText("Add member"));

    expect(screen.getByText("Members (2)")).toBeInTheDocument();

    const removeButtons = screen.getAllByText("Remove member");
    await user.click(removeButtons[0]!);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.getByText("Members (1)")).toBeInTheDocument();
  });
});

describe("F002: Household list", () => {
  it("redirects / to first household Home when households exist", () => {
    saveHouseholds([
      {
        id: "h1",
        name: "Family A",
        members: [
          {
            id: "m1",
            name: "A",
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
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    expect(screen.getByText("Family A")).toBeInTheDocument();
    expect(screen.getByTestId("app-nav")).toBeInTheDocument();
  });

  it("shows browse-first controls for household list", () => {
    saveHouseholds([]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("household-control-bar")).toBeInTheDocument();
    expect(screen.getByTestId("household-search")).toBeInTheDocument();
  });

  it("shows filter empty state when search has no matches", async () => {
    const user = userEvent.setup();
    localStorage.setItem("onebase-tour-completed", "true");
    saveHouseholds([
      {
        id: "h1",
        name: "Family A",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByText("Households"));
    await user.type(screen.getByTestId("household-search"), "zzzz");
    expect(screen.getByText("No households match your search.")).toBeInTheDocument();
  });

  it("shows per-member profile links inside household modal", async () => {
    const user = userEvent.setup();
    localStorage.setItem("onebase-tour-completed", "true");
    saveHouseholds([
      {
        id: "h1",
        name: "Family A",
        members: [
          {
            id: "m1",
            name: "A",
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
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByText("Households"));
    await user.click(screen.getByTestId("household-row-h1"));
    const link = screen.getByTestId("modal-member-profile-m1");
    expect(link).toHaveAttribute("href", "/household/h1/member/m1");
  });
});
