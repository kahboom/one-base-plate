import type { ComponentRecipeRef, Household, WeeklyAnchor, WeeklyPlan } from "../types";
import { generateAssemblyVariants } from "../planner";

export function getWeeklyAnchorForWeekday(
  household: Household,
  weekday: string,
): WeeklyAnchor | undefined {
  return (household.weeklyAnchors ?? []).find(
    (a) => a.enabled !== false && a.weekday === weekday,
  );
}

/** Matches WeeklyPlanner day labels (Monday-first). */
export const WEEKDAY_LABELS_MONDAY_FIRST = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function getTodayWeekdayLabel(): string {
  const d = new Date().getDay();
  const idx = d === 0 ? 6 : d - 1;
  return WEEKDAY_LABELS_MONDAY_FIRST[idx]!;
}

/**
 * Assign a base meal to a day on the latest weekly plan (creates a plan if none).
 * Returns updated household with weeklyPlans mutated in the immutable sense.
 */
export function assignMealToLatestWeekPlan(
  household: Household,
  mealId: string,
  dayLabel: string,
  componentRecipeOverrides?: ComponentRecipeRef[],
): Household {
  const meal = household.baseMeals.find((m) => m.id === mealId);
  if (!meal) return household;

  const variants = generateAssemblyVariants(
    meal,
    household.members,
    household.ingredients,
  );

  const newDayPlan = {
    day: dayLabel,
    baseMealId: mealId,
    variants,
    ...(componentRecipeOverrides?.length
      ? { componentRecipeOverrides }
      : {}),
  };

  const plans = [...household.weeklyPlans];
  if (plans.length === 0) {
    const plan: WeeklyPlan = {
      id: crypto.randomUUID(),
      days: [newDayPlan],
      selectedBaseMeals: [mealId],
      generatedGroceryList: [],
      notes: "",
    };
    plans.push(plan);
    return { ...household, weeklyPlans: plans };
  }

  const lastIdx = plans.length - 1;
  const prev = plans[lastIdx]!;
  const filtered = prev.days.filter((d) => d.day !== dayLabel);
  const nextDays = [...filtered, newDayPlan];
  const updated: WeeklyPlan = {
    ...prev,
    days: nextDays,
    selectedBaseMeals: [...new Set(nextDays.map((d) => d.baseMealId))],
  };
  plans[lastIdx] = updated;
  return { ...household, weeklyPlans: plans };
}
