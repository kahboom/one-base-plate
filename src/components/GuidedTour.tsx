import { useState, useEffect } from "react";
import { Button } from "./ui";

const TOUR_STORAGE_KEY = "onebase-tour-completed";

export interface TourStep {
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Home",
    description:
      "Your household hub. See tonight's top meal suggestions, your weekly plan at a glance, and jump into rescue mode when things get hectic.",
  },
  {
    title: "Household Setup",
    description:
      "Add your family members, set their roles (adult, toddler, baby), and define food preferences, safe foods, and hard-no foods.",
  },
  {
    title: "Weekly Planner",
    description:
      "Plan your week by assigning meals to days. Drag or tap to assign, and see effort balance and grocery previews update in real time.",
  },
  {
    title: "Meal Cards",
    description:
      "Each meal shows overlap scores, per-member compatibility chips, and prep estimates so you can pick the best fit at a glance.",
  },
  {
    title: "Grocery List",
    description:
      "One merged shopping list from your weekly plan, grouped by category. Mark items you already have and export or print when ready.",
  },
];

export function isTourCompleted(): boolean {
  return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
}

export function markTourCompleted(): void {
  localStorage.setItem(TOUR_STORAGE_KEY, "true");
}

export function resetTour(): void {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}

export default function GuidedTour() {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!isTourCompleted()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const step = TOUR_STEPS[stepIndex]!;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      handleFinish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function handleSkip() {
    markTourCompleted();
    setVisible(false);
  }

  function handleFinish() {
    markTourCompleted();
    setVisible(false);
  }

  return (
    <div
      data-testid="guided-tour"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-label="Guided tour"
    >
      <div className="w-full max-w-md rounded-md border border-border-light bg-surface p-6 shadow-card-hover">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted" data-testid="tour-step-indicator">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-text-muted hover:text-text-primary"
            data-testid="tour-skip"
          >
            Skip tour
          </button>
        </div>
        <h2 className="mb-2 text-lg font-bold text-text-primary">{step.title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">{step.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`block h-1.5 w-6 rounded-pill ${i === stepIndex ? "bg-brand" : "bg-border-default"}`}
              />
            ))}
          </div>
          <Button variant="primary" onClick={handleNext} data-testid="tour-next">
            {isLast ? "Get started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
