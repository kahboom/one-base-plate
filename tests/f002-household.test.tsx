import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, MemberRole } from "../src/types";
import {
  loadHouseholds,
  saveHousehold,
  loadHousehold,
  saveHouseholds,
  loadDefaultHouseholdId,
  saveDefaultHouseholdId,
} from "../src/storage";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import HouseholdList from "../src/pages/HouseholdList";
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
          <Route path="/household/:householdId/home" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Set household name
    const nameInput = screen.getByPlaceholderText("Household name");
    await user.type(nameInput, "Mixed Family");

    // Add 4 members
    const membersSection = screen.getByTestId("members-section");
    const addButton = within(membersSection).getByRole("button", { name: "Add member" });
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    // Get all member cards by test ID prefix
    const memberCards = screen.getAllByTestId(/^member-/);
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
      const editButton = within(card).queryByRole("button", { name: "Edit" });
      if (editButton) {
        await user.click(editButton);
      }
      const nameField = within(card).getByPlaceholderText("Member name");
      await user.type(nameField, config.name);

      if (config.role !== "adult") {
        const roleSelect = within(card).getByRole("combobox", { name: "Role" });
        await user.selectOptions(roleSelect, config.role);
      }

      const doneButton = within(card).queryByRole("button", { name: "Done" });
      if (doneButton) {
        await user.click(doneButton);
      }
    }

    await user.click(screen.getByText("Create household"));

    // Explicit save persists household; verify persistence
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

    // Verify all 4 members are shown in compact rows
    expect(screen.getByText("Parent")).toBeInTheDocument();
    expect(screen.getByText("Child")).toBeInTheDocument();
    expect(screen.getByText("Baby")).toBeInTheDocument();
    expect(screen.getByText("Other Parent")).toBeInTheDocument();

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

    const membersSection = screen.getByTestId("members-section");
    const addButton = within(membersSection).getByRole("button", { name: "Add member" });
    await user.click(addButton);
    await user.click(addButton);

    expect(screen.getByText("Members (2)")).toBeInTheDocument();

    const firstCard = screen.getAllByTestId(/^member-/)[0]!;
    await user.click(within(firstCard).getByRole("button", { name: "Remove" }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.getByText("Members (1)")).toBeInTheDocument();
  });

  it("shows a lightweight empty state with a first-member CTA", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("No members yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add your first member" }));
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
    expect(screen.getByTestId("global-nav")).toBeInTheDocument();
  });

  it("redirects / to stored default household when valid", () => {
    saveHouseholds([
      {
        id: "h1",
        name: "Family A",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
      {
        id: "h2",
        name: "Family B",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ]);
    saveDefaultHouseholdId("h2");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("global-nav")).toBeInTheDocument();
    expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/household/h2/home");
  });

  it("falls back to first household when stored default is invalid", () => {
    saveHouseholds([
      {
        id: "h1",
        name: "Family A",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
      {
        id: "h2",
        name: "Family B",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ]);
    saveDefaultHouseholdId("missing-id");

    render(
      <MemoryRouter initialEntries={["/households"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("global-nav")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/household/h1/home");
  });

  it("shows browse-first controls for household list", () => {
    saveHouseholds([]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("household-control-bar")).toBeInTheDocument();
    expect(screen.getByText("Create Household")).toBeInTheDocument();
  });

  it("does not show a household search input", async () => {
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

    expect(screen.queryByPlaceholderText("Search households...")).not.toBeInTheDocument();
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
      <MemoryRouter initialEntries={["/households"]}>
        <App />
      </MemoryRouter>,
    );

    const row = screen.getByTestId("household-row-h1");
    await user.click(within(row).getByRole("button", { name: /Edit Family A/i }));
    const link = screen.getByTestId("modal-member-profile-m1");
    expect(link).toHaveAttribute("href", "/household/h1/member/m1");
  });

  it("sets a household as current from the Households page", async () => {
    const user = userEvent.setup();
    saveHouseholds([
      {
        id: "h1",
        name: "Family A",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
      {
        id: "h2",
        name: "Family B",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ]);
    saveDefaultHouseholdId("h1");

    render(
      <MemoryRouter initialEntries={["/households"]}>
        <HouseholdList />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("set-current-household-h2"));

    expect(loadDefaultHouseholdId()).toBe("h2");
    expect(screen.getByTestId("household-current-h2")).toBeInTheDocument();
  });

  it("reassigns current household when deleting the current one", async () => {
    const user = userEvent.setup();
    saveHouseholds([
      {
        id: "h1",
        name: "Family A",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
      {
        id: "h2",
        name: "Family B",
        members: [],
        ingredients: [],
        baseMeals: [],
        weeklyPlans: [],
      },
    ]);
    saveDefaultHouseholdId("h2");

    render(
      <MemoryRouter initialEntries={["/households"]}>
        <HouseholdList />
      </MemoryRouter>,
    );

    const row = screen.getByTestId("household-row-h2");
    await user.click(within(row).getByRole("button", { name: /Edit Family B/i }));
    await user.click(screen.getByRole("button", { name: "Delete household" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(loadDefaultHouseholdId()).toBe("h1");
    expect(screen.getByTestId("household-current-h1")).toBeInTheDocument();
  });
});
