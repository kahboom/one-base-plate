import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember, DayPlan, WeeklyPlan, AssemblyVariant } from "../src/types";
import { saveHousehold } from "../src/storage";
import { generateAssemblyVariants } from "../src/planner";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";

const ingredients: Ingredient[] = [
  { id: "ing-pasta", name: "pasta", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-chicken", name: "chicken", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
];

const members: HouseholdMember[] = [
  { id: "m-a", name: "Alex", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" },
];

const meal: BaseMeal = {
  id: "meal-pasta",
  name: "Pasta with chicken",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
  ],
  defaultPrep: "Cook pasta and chicken",
  estimatedTimeMinutes: 25,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

function makeVariants(m: BaseMeal): AssemblyVariant[] {
  return generateAssemblyVariants(m, members, ingredients);
}

const dayPlans: DayPlan[] = [
  { day: "Monday", baseMealId: "meal-pasta", variants: makeVariants(meal) },
  { day: "Tuesday", baseMealId: "meal-pasta", variants: makeVariants(meal) },
];

function makePlan(days: DayPlan[]): WeeklyPlan {
  return {
    id: "plan-1",
    days,
    selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
    generatedGroceryList: [],
    notes: "",
  };
}

function seedHousehold(plan?: WeeklyPlan): Household {
  const household: Household = {
    id: "h-share",
    name: "Share Test Family",
    members,
    ingredients,
    baseMeals: [meal],
    weeklyPlans: plan ? [plan] : [],
  };
  saveHousehold(household);
  return household;
}

function renderWeeklyPlanner() {
  return render(
    <MemoryRouter initialEntries={["/household/h-share/weekly"]}>
      <Routes>
        <Route path="/household/:householdId/weekly" element={<WeeklyPlanner />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Mock html2canvas
const mockToBlob = vi.fn();
const mockCanvas = { toBlob: mockToBlob };
vi.mock("html2canvas", () => ({
  default: vi.fn(() => Promise.resolve(mockCanvas)),
}));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
    cb(new Blob(["fake-image"], { type: "image/png" }));
  });
});

describe("F042 - Share weekly plan as image", () => {
  describe("Share button display", () => {
    it("shows Share button when plan has days", () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();
      expect(screen.getByTestId("share-btn")).toBeInTheDocument();
    });

    it("hides Share button when no plan exists", () => {
      seedHousehold();
      renderWeeklyPlanner();
      expect(screen.queryByTestId("share-btn")).not.toBeInTheDocument();
    });

    it("Share button appears alongside Export and Print", () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();
      expect(screen.getByTestId("export-btn")).toBeInTheDocument();
      expect(screen.getByTestId("print-btn")).toBeInTheDocument();
      expect(screen.getByTestId("share-btn")).toBeInTheDocument();
    });
  });

  describe("Share via download fallback", () => {
    it("triggers image download when navigator.share is not available", async () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();

      const originalShare = navigator.share;
      Object.defineProperty(navigator, "share", { value: undefined, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: undefined, writable: true, configurable: true });

      const createObjectURL = vi.fn(() => "blob:test-url");
      const revokeObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      const clickSpy = vi.fn();
      const createElementOriginal = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = createElementOriginal(tag);
        if (tag === "a") {
          vi.spyOn(el, "click").mockImplementation(clickSpy);
        }
        return el;
      });

      await userEvent.click(screen.getByTestId("share-btn"));

      await waitFor(() => {
        expect(createObjectURL).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revokeObjectURL).toHaveBeenCalled();
      });

      Object.defineProperty(navigator, "share", { value: originalShare, writable: true, configurable: true });
    });

    it("download filename includes household name", async () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();

      Object.defineProperty(navigator, "share", { value: undefined, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: undefined, writable: true, configurable: true });

      global.URL.createObjectURL = vi.fn(() => "blob:test-url");
      global.URL.revokeObjectURL = vi.fn();

      let downloadName = "";
      const createElementOriginal = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = createElementOriginal(tag);
        if (tag === "a") {
          vi.spyOn(el, "click").mockImplementation(() => {
            downloadName = (el as HTMLAnchorElement).download;
          });
        }
        return el;
      });

      await userEvent.click(screen.getByTestId("share-btn"));

      await waitFor(() => {
        expect(downloadName).toBe("meal-plan-share-test-family.png");
      });
    });
  });

  describe("Share via navigator.share", () => {
    it("calls navigator.share with a PNG file when available", async () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();

      const shareMock = vi.fn(() => Promise.resolve());
      const canShareMock = vi.fn(() => true);
      Object.defineProperty(navigator, "share", { value: shareMock, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: canShareMock, writable: true, configurable: true });

      await userEvent.click(screen.getByTestId("share-btn"));

      await waitFor(() => {
        expect(shareMock).toHaveBeenCalledTimes(1);
        const call = shareMock.mock.calls[0]![0] as { files: File[]; title: string };
        expect(call.title).toBe("Weekly Meal Plan");
        expect(call.files).toHaveLength(1);
        expect(call.files[0]!.type).toBe("image/png");
        expect(call.files[0]!.name).toContain("meal-plan-");
      });

      Object.defineProperty(navigator, "share", { value: undefined, writable: true, configurable: true });
    });
  });

  describe("Shareable content area", () => {
    it("day cards are within the share capture area", () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();
      const dayCards = screen.getByTestId("day-cards");
      expect(dayCards.closest("[data-share-capture]") ?? dayCards.parentElement).toBeInTheDocument();
    });

    it("effort balance is within the share capture area", () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();
      const effortBalance = screen.getByTestId("effort-balance");
      const dayCards = screen.getByTestId("day-cards");
      expect(effortBalance.parentElement).toBe(dayCards.parentElement);
    });
  });

  describe("Share button state", () => {
    it("button text shows Share normally", () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();
      expect(screen.getByTestId("share-btn").textContent).toBe("Share");
    });

    it("generates a plan then shows Share button", async () => {
      seedHousehold();
      renderWeeklyPlanner();
      expect(screen.queryByTestId("share-btn")).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId("generate-btn"));

      expect(screen.getByTestId("share-btn")).toBeInTheDocument();
    });
  });

  describe("html2canvas integration", () => {
    it("calls html2canvas with scale 2 for retina quality", async () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();

      Object.defineProperty(navigator, "share", { value: undefined, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: undefined, writable: true, configurable: true });

      global.URL.createObjectURL = vi.fn(() => "blob:url");
      global.URL.revokeObjectURL = vi.fn();
      const createElementOriginal = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = createElementOriginal(tag);
        if (tag === "a") vi.spyOn(el, "click").mockImplementation(() => {});
        return el;
      });

      const html2canvas = (await import("html2canvas")).default as unknown as Mock;

      await userEvent.click(screen.getByTestId("share-btn"));

      await waitFor(() => {
        expect(html2canvas).toHaveBeenCalled();
        const opts = html2canvas.mock.calls[0]![1] as { scale: number; backgroundColor: string };
        expect(opts.scale).toBe(2);
        expect(opts.backgroundColor).toBe("#ffffff");
      });
    });
  });

  describe("Mobile and desktop compatibility", () => {
    it("Share button uses shared Button component with proper sizing", () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();
      const btn = screen.getByTestId("share-btn");
      expect(btn.tagName).toBe("BUTTON");
    });

    it("falls back to download when canShare returns false", async () => {
      seedHousehold(makePlan(dayPlans));
      renderWeeklyPlanner();

      const shareMock = vi.fn();
      const canShareMock = vi.fn(() => false);
      Object.defineProperty(navigator, "share", { value: shareMock, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: canShareMock, writable: true, configurable: true });

      const createObjectURL = vi.fn(() => "blob:url");
      const revokeObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      const createElementOriginal = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = createElementOriginal(tag);
        if (tag === "a") vi.spyOn(el, "click").mockImplementation(() => {});
        return el;
      });

      await userEvent.click(screen.getByTestId("share-btn"));

      await waitFor(() => {
        expect(shareMock).not.toHaveBeenCalled();
        expect(createObjectURL).toHaveBeenCalled();
      });

      Object.defineProperty(navigator, "share", { value: undefined, writable: true, configurable: true });
    });
  });
});
