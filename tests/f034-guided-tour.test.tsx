import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Household } from "../src/types";
import * as storage from "../src/storage";
import Home from "../src/pages/Home";
import GuidedTour, {
  isTourCompleted,
  markTourCompleted,
  resetTour,
} from "../src/components/GuidedTour";

vi.mock("../src/storage", () => ({
  loadHousehold: vi.fn(),
  loadHouseholds: vi.fn(() => []),
  saveHousehold: vi.fn(),
  saveHouseholds: vi.fn(),
  deleteHousehold: vi.fn(),
}));

const household: Household = {
  id: "h1",
  name: "Tour Family",
  members: [
    {
      id: "m1",
      name: "Pat",
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

function renderHome() {
  vi.mocked(storage.loadHousehold).mockReturnValue(household);
  return render(
    <MemoryRouter initialEntries={["/household/h1/home"]}>
      <Routes>
        <Route path="/household/:householdId/home" element={<Home />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderTour() {
  return render(<GuidedTour />);
}

beforeEach(() => {
  localStorage.clear();
});

describe("F034 — Guided Tour", () => {
  describe("First-run display", () => {
    it("shows the tour on first visit when localStorage has no completion state", () => {
      renderHome();
      expect(screen.getByTestId("guided-tour")).toBeInTheDocument();
    });

    it("does not show the tour when already completed", () => {
      markTourCompleted();
      renderHome();
      expect(screen.queryByTestId("guided-tour")).not.toBeInTheDocument();
    });

    it("persists completion state to localStorage", () => {
      expect(isTourCompleted()).toBe(false);
      markTourCompleted();
      expect(isTourCompleted()).toBe(true);
      expect(localStorage.getItem("onebase-tour-completed")).toBe("true");
    });

    it("resetTour clears completion state", () => {
      markTourCompleted();
      expect(isTourCompleted()).toBe(true);
      resetTour();
      expect(isTourCompleted()).toBe(false);
    });
  });

  describe("Step navigation", () => {
    it("starts at step 1 of 5", () => {
      renderTour();
      expect(screen.getByTestId("tour-step-indicator")).toHaveTextContent("Step 1 of 5");
    });

    it("shows the Home step first with scannable description", () => {
      renderTour();
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText(/household hub/i)).toBeInTheDocument();
    });

    it("advances through all 5 steps with Next button", async () => {
      const user = userEvent.setup();
      renderTour();

      const expectedTitles = [
        "Home",
        "Household Setup",
        "Weekly Planner",
        "Meal Cards",
        "Grocery List",
      ];

      for (let i = 0; i < expectedTitles.length; i++) {
        expect(screen.getByText(expectedTitles[i]!)).toBeInTheDocument();
        expect(screen.getByTestId("tour-step-indicator")).toHaveTextContent(
          `Step ${i + 1} of 5`
        );

        if (i < expectedTitles.length - 1) {
          await user.click(screen.getByTestId("tour-next"));
        }
      }
    });

    it("shows 'Get started' on the last step instead of 'Next'", async () => {
      const user = userEvent.setup();
      renderTour();

      for (let i = 0; i < 4; i++) {
        expect(screen.getByTestId("tour-next")).toHaveTextContent("Next");
        await user.click(screen.getByTestId("tour-next"));
      }

      expect(screen.getByTestId("tour-next")).toHaveTextContent("Get started");
    });

    it("completing the last step closes the tour and persists completion", async () => {
      const user = userEvent.setup();
      renderTour();

      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByTestId("tour-next"));
      }
      await user.click(screen.getByTestId("tour-next"));

      expect(screen.queryByTestId("guided-tour")).not.toBeInTheDocument();
      expect(isTourCompleted()).toBe(true);
    });
  });

  describe("Skip / dismiss", () => {
    it("has a skip button on every step", () => {
      renderTour();
      expect(screen.getByTestId("tour-skip")).toBeInTheDocument();
      expect(screen.getByTestId("tour-skip")).toHaveTextContent(/skip/i);
    });

    it("skipping closes the tour and persists completion", async () => {
      const user = userEvent.setup();
      renderTour();

      await user.click(screen.getByTestId("tour-skip"));

      expect(screen.queryByTestId("guided-tour")).not.toBeInTheDocument();
      expect(isTourCompleted()).toBe(true);
    });

    it("skipping from a middle step closes the tour without errors", async () => {
      const user = userEvent.setup();
      renderTour();

      await user.click(screen.getByTestId("tour-next"));
      await user.click(screen.getByTestId("tour-next"));
      expect(screen.getByTestId("tour-step-indicator")).toHaveTextContent("Step 3 of 5");

      await user.click(screen.getByTestId("tour-skip"));
      expect(screen.queryByTestId("guided-tour")).not.toBeInTheDocument();
      expect(isTourCompleted()).toBe(true);
    });
  });

  describe("Does not reappear", () => {
    it("tour does not appear on subsequent visits after completion", () => {
      markTourCompleted();
      renderHome();
      expect(screen.queryByTestId("guided-tour")).not.toBeInTheDocument();
    });

    it("tour does not appear after skip on re-render", async () => {
      const user = userEvent.setup();
      const { unmount } = renderTour();
      await user.click(screen.getByTestId("tour-skip"));
      unmount();

      renderTour();
      expect(screen.queryByTestId("guided-tour")).not.toBeInTheDocument();
    });
  });

  describe("Styling and accessibility", () => {
    it("renders as a dialog with accessible role", () => {
      renderTour();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has progress dots matching the number of steps", () => {
      renderTour();
      const tourEl = screen.getByTestId("guided-tour");
      const dots = tourEl.querySelectorAll("span.rounded-pill");
      expect(dots.length).toBe(5);
    });

    it("current step dot uses brand color", () => {
      renderTour();
      const tourEl = screen.getByTestId("guided-tour");
      const dots = tourEl.querySelectorAll("span.rounded-pill");
      expect(dots[0]?.className).toContain("bg-brand");
      expect(dots[1]?.className).toContain("bg-border-default");
    });

    it("each step has short, scannable description text", () => {
      renderTour();
      const description = screen.getByText(/household hub/i);
      expect(description.textContent!.length).toBeLessThan(200);
    });

    it("tour overlay uses mobile-friendly max-width", () => {
      renderTour();
      const dialog = screen.getByRole("dialog");
      const card = dialog.querySelector(".max-w-md");
      expect(card).toBeInTheDocument();
    });
  });
});
