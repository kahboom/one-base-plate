import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import IngredientManager from "../src/pages/IngredientManager";
import BaseMealManager from "../src/pages/BaseMealManager";
import MealDetail from "../src/pages/MealDetail";
import MealCard from "../src/components/MealCard";
import { loadAllIngredientListRows } from "./incremental-load-helpers";

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h1",
    name: "Test Family",
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
    ingredients: [
      {
        id: "i1",
        name: "Chicken",
        category: "protein",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: false,
      },
      {
        id: "i2",
        name: "Rice",
        category: "carb",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: false,
        imageUrl: "https://example.com/rice.jpg",
      },
    ],
    baseMeals: [
      {
        id: "meal1",
        name: "Chicken Rice",
        components: [
          { ingredientId: "i1", role: "protein", quantity: "200g" },
          { ingredientId: "i2", role: "carb", quantity: "150g" },
        ],
        defaultPrep: "stir-fry",
        estimatedTimeMinutes: 20,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
      },
      {
        id: "meal2",
        name: "Chicken Bowl",
        components: [
          { ingredientId: "i1", role: "protein", quantity: "200g" },
        ],
        defaultPrep: "grill",
        estimatedTimeMinutes: 15,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
        imageUrl: "https://example.com/bowl.jpg",
      },
    ],
    weeklyPlans: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("F037 — Image URL field on data model", () => {
  it("Ingredient type accepts optional imageUrl", () => {
    const h = makeHousehold();
    expect(h.ingredients[1]!.imageUrl).toBe("https://example.com/rice.jpg");
    expect(h.ingredients[0]!.imageUrl).toBeUndefined();
  });

  it("BaseMeal type accepts optional imageUrl", () => {
    const h = makeHousehold();
    expect(h.baseMeals[1]!.imageUrl).toBe("https://example.com/bowl.jpg");
    expect(h.baseMeals[0]!.imageUrl).toBeUndefined();
  });
});

describe("F037 — Ingredient Manager image input", () => {
  it("shows image URL input field in ingredient form", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    loadAllIngredientListRows();
    await user.click(screen.getByTestId("ingredient-row-i1"));
    const modal = screen.getByTestId("ingredient-modal");
    expect(within(modal).getByTestId("ingredient-image-url")).toBeInTheDocument();
  });

  it("shows image preview when imageUrl is set", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByTestId("ingredient-search"), "Rice");
    await user.click(screen.getByTestId("ingredient-row-i2"));
    const modal = screen.getByTestId("ingredient-modal");
    const preview = within(modal).getByTestId("ingredient-image-preview");
    expect(preview).toHaveAttribute("src", "https://example.com/rice.jpg");
  });

  it("updates imageUrl when user types a URL", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
          <Route path="/household/:householdId/home" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    loadAllIngredientListRows();
    await user.click(screen.getByTestId("ingredient-row-i1"));
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("ingredient-image-url"), "https://example.com/chicken.jpg");

    const saved = loadHousehold("h1");
    expect(saved!.ingredients[0]!.imageUrl).toBe("https://example.com/chicken.jpg");
  });

  it("shows file upload button in ingredient form", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    loadAllIngredientListRows();
    await user.click(screen.getByTestId("ingredient-row-i1"));
    const modal = screen.getByTestId("ingredient-modal");
    expect(within(modal).getByTestId("ingredient-image-upload")).toBeInTheDocument();
  });

  it("image preview has rounded corners and proper aspect ratio", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByTestId("ingredient-search"), "Rice");
    await user.click(screen.getByTestId("ingredient-row-i2"));
    const modal = screen.getByTestId("ingredient-modal");
    const preview = within(modal).getByTestId("ingredient-image-preview");
    expect(preview.className).toContain("rounded-md");
    expect(preview.className).toContain("object-cover");
  });
});

describe("F037 — Base Meal Manager image input", () => {
  it("shows image URL input field in meal modal", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal1"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByTestId("image-section").querySelector("summary")!);
    expect(within(modal).getByTestId("meal-image-url")).toBeInTheDocument();
  });

  it("shows image preview when meal has imageUrl", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal2"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByTestId("image-section").querySelector("summary")!);
    const preview = within(modal).getByTestId("meal-image-preview");
    expect(preview).toHaveAttribute("src", "https://example.com/bowl.jpg");
  });

  it("shows header thumbnail next to summary when meal has imageUrl", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal2"));
    const modal = screen.getByTestId("meal-modal");
    const headerImg = within(modal).getByTestId("meal-modal-header-image");
    expect(headerImg).toHaveAttribute("src", "https://example.com/bowl.jpg");
  });

  it("shows header placeholder when meal has no imageUrl", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal1"));
    const modal = screen.getByTestId("meal-modal");
    expect(within(modal).getByTestId("meal-modal-header-image-placeholder")).toBeInTheDocument();
    expect(within(modal).queryByTestId("meal-modal-header-image")).not.toBeInTheDocument();
  });

  it("shows header placeholder when image fails to load", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal2"));
    const modal = screen.getByTestId("meal-modal");
    const headerImg = within(modal).getByTestId("meal-modal-header-image");
    fireEvent.error(headerImg);
    expect(within(modal).getByTestId("meal-modal-header-image-placeholder")).toBeInTheDocument();
    expect(within(modal).queryByTestId("meal-modal-header-image")).not.toBeInTheDocument();
  });

  it("persists meal imageUrl on save", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
          <Route path="/household/:householdId/home" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal1"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByTestId("image-section").querySelector("summary")!);
    await user.type(within(modal).getByTestId("meal-image-url"), "https://example.com/stir-fry.jpg");
    // Auto-save persists
    const saved = loadHousehold("h1");
    expect(saved!.baseMeals[0]!.imageUrl).toBe("https://example.com/stir-fry.jpg");
  });

  it("shows file upload button for meals", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal1"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByTestId("image-section").querySelector("summary")!);
    expect(within(modal).getByTestId("meal-image-upload")).toBeInTheDocument();
  });
});

describe("F037 — MealDetail hero image", () => {
  it("shows hero image when meal has imageUrl", () => {
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meal/meal2"]}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    const heroImage = screen.getByTestId("meal-hero-image");
    expect(heroImage).toHaveAttribute("src", "https://example.com/bowl.jpg");
    expect(heroImage.parentElement?.className).toContain("rounded-md");
    expect(heroImage.className).toContain("object-cover");
  });

  it("shows hero placeholder when meal has no imageUrl", () => {
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meal/meal1"]}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("meal-hero-image-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("meal-hero-image")).toBeNull();
  });

  it("hero image is full-width with max height", () => {
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meal/meal2"]}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    const heroImage = screen.getByTestId("meal-hero-image");
    expect(heroImage.className).toContain("w-full");
    expect(heroImage.className).toContain("max-h-64");
    expect(heroImage.parentElement?.className).toContain("w-full");
  });
});

describe("F037 — MealCard thumbnail", () => {
  it("shows thumbnail when meal has imageUrl", () => {
    const h = makeHousehold();
    render(
      <MemoryRouter>
        <MealCard
          meal={h.baseMeals[1]!}
          members={h.members}
          ingredients={h.ingredients}
        />
      </MemoryRouter>,
    );
    const thumb = screen.getByTestId("meal-card-image");
    expect(thumb).toHaveAttribute("src", "https://example.com/bowl.jpg");
  });

  it("shows thumbnail placeholder when meal has no imageUrl", () => {
    const h = makeHousehold();
    render(
      <MemoryRouter>
        <MealCard
          meal={h.baseMeals[0]!}
          members={h.members}
          ingredients={h.ingredients}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("meal-thumb-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("meal-card-image")).toBeNull();
  });

  it("thumbnail uses compact height in compact mode", () => {
    const h = makeHousehold();
    render(
      <MemoryRouter>
        <MealCard
          meal={h.baseMeals[1]!}
          members={h.members}
          ingredients={h.ingredients}
          compact
        />
      </MemoryRouter>,
    );
    const thumb = screen.getByTestId("meal-card-image");
    expect(thumb.className).toContain("max-h-24");
  });

  it("thumbnail uses full height in normal mode", () => {
    const h = makeHousehold();
    render(
      <MemoryRouter>
        <MealCard
          meal={h.baseMeals[1]!}
          members={h.members}
          ingredients={h.ingredients}
        />
      </MemoryRouter>,
    );
    const thumb = screen.getByTestId("meal-card-image");
    expect(thumb.className).toContain("max-h-36");
  });

  it("thumbnail fits shared styling (rounded, border, object-cover)", () => {
    const h = makeHousehold();
    render(
      <MemoryRouter>
        <MealCard
          meal={h.baseMeals[1]!}
          members={h.members}
          ingredients={h.ingredients}
        />
      </MemoryRouter>,
    );
    const thumb = screen.getByTestId("meal-card-image");
    expect(thumb.parentElement?.className).toContain("rounded-md");
    expect(thumb.parentElement?.className).toContain("border");
    expect(thumb.className).toContain("object-cover");
  });
});

describe("F037 — Mobile readability", () => {
  it("ingredient image preview is appropriately sized", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByTestId("ingredient-search"), "Rice");
    await user.click(screen.getByTestId("ingredient-row-i2"));
    const modal = screen.getByTestId("ingredient-modal");
    const preview = within(modal).getByTestId("ingredient-image-preview");
    expect(preview.className).toContain("h-20");
    expect(preview.className).toContain("w-20");
  });

  it("meal image preview is appropriately sized", async () => {
    const user = userEvent.setup();
    const h = makeHousehold();
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal2"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByTestId("image-section").querySelector("summary")!);
    const preview = within(modal).getByTestId("meal-image-preview");
    expect(preview.parentElement?.className).toContain("h-24");
    expect(preview.parentElement?.className).toContain("w-36");
  });
});
