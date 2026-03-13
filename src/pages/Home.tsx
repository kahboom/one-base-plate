import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { computeMealOverlap, computeOutcomeScore } from "../planner";
import MealCard from "../components/MealCard";
import { PageShell, PageHeader, Card, Section, NavBar } from "../components/ui";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Home() {
  const { householdId } = useParams<{ householdId: string }>();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) setHousehold(h);
    setLoaded(true);
  }, [householdId]);

  const topMeals = useMemo(() => {
    if (!household) return [];
    const outcomes = household.mealOutcomes ?? [];
    return [...household.baseMeals]
      .map((meal) => ({
        meal,
        overlap: computeMealOverlap(meal, household.members, household.ingredients),
        outcomeScore: computeOutcomeScore(meal.id, outcomes).score,
      }))
      .sort((a, b) => (b.overlap.score + b.outcomeScore) - (a.overlap.score + a.outcomeScore))
      .slice(0, 3);
  }, [household]);

  const pinnedMeals = useMemo(() => {
    if (!household) return [];
    const pinnedIds = household.pinnedMealIds ?? [];
    return household.baseMeals.filter((m) => pinnedIds.includes(m.id));
  }, [household]);

  function handleTogglePin(mealId: string) {
    if (!household) return;
    const current = household.pinnedMealIds ?? [];
    const updated = current.includes(mealId)
      ? current.filter((id) => id !== mealId)
      : [...current, mealId];
    const updatedHousehold = { ...household, pinnedMealIds: updated };
    saveHousehold(updatedHousehold);
    setHousehold(updatedHousehold);
  }

  if (!loaded) return null;
  if (!household) return <p>Household not found.</p>;

  const latestPlan =
    household.weeklyPlans.length > 0
      ? household.weeklyPlans[household.weeklyPlans.length - 1]!
      : null;

  function getMealName(mealId: string): string {
    return household?.baseMeals.find((m) => m.id === mealId)?.name ?? "";
  }

  return (
    <PageShell>
      <PageHeader title="What should we eat tonight?" subtitle={household.name} />

      {latestPlan && (
        <Section>
          <div data-testid="weekly-strip">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">This week</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DAY_LABELS.map((label, i) => {
                const dayPlan = latestPlan.days[i];
                return (
                  <div
                    key={label}
                    data-testid={`strip-${label.toLowerCase()}`}
                    className="min-w-[80px] flex-shrink-0 rounded-md border border-border-light bg-surface px-2 py-3 text-center shadow-card"
                  >
                    <strong className="text-sm font-semibold text-text-primary">{label}</strong>
                    <p className="mt-1 text-xs text-text-secondary">
                      {dayPlan ? getMealName(dayPlan.baseMealId) || "Planned" : "\u2014"}
                    </p>
                  </div>
                );
              })}
            </div>
            <Link to={`/household/${householdId}/weekly`} className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
              View full plan
            </Link>
          </div>
        </Section>
      )}

      {!latestPlan && household.baseMeals.length > 0 && (
        <Section>
          <div data-testid="no-plan-prompt" className="rounded-md border border-dashed border-border-default bg-bg p-6 text-center">
            <p className="mb-2 text-text-muted">No plan for this week yet.</p>
            <Link to={`/household/${householdId}/weekly`} className="font-medium text-brand hover:underline">
              Start planning
            </Link>
          </div>
        </Section>
      )}

      {household.baseMeals.length > 0 && (
        <Section>
          <Link to={`/household/${householdId}/rescue`} data-testid="rescue-mode-card">
            <Card className="cursor-pointer text-center hover:border-brand">
              <strong className="text-lg">Rescue mode</strong>
              <p className="mt-1 text-sm text-text-muted">Tough night? Get the fastest acceptable dinner.</p>
            </Card>
          </Link>
        </Section>
      )}

      {pinnedMeals.length > 0 && (
        <Section>
          <div data-testid="pinned-meals">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">Pinned rotation</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {pinnedMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  members={household.members}
                  ingredients={household.ingredients}
                  outcomes={household.mealOutcomes ?? []}
                  pinned
                  onPin={() => handleTogglePin(meal.id)}
                  detailUrl={`/household/${householdId}/meal/${meal.id}`}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      {topMeals.length > 0 && (
        <Section>
          <div data-testid="top-suggestions">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">Top suggestions</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {topMeals.map(({ meal, overlap }) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  members={household.members}
                  ingredients={household.ingredients}
                  overlap={overlap}
                  outcomes={household.mealOutcomes ?? []}
                  pinned={(household.pinnedMealIds ?? []).includes(meal.id)}
                  onPin={() => handleTogglePin(meal.id)}
                  detailUrl={`/household/${householdId}/meal/${meal.id}`}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      <NavBar>
        <Link to={`/household/${householdId}/weekly`} className="text-sm font-medium text-brand hover:underline">Weekly planner</Link>
        <Link to={`/household/${householdId}/grocery`} className="text-sm font-medium text-brand hover:underline">Grocery list</Link>
        <Link to={`/household/${householdId}/rescue`} className="text-sm font-medium text-brand hover:underline">Rescue mode</Link>
        <Link to={`/household/${householdId}/history`} className="text-sm font-medium text-brand hover:underline">Meal history</Link>
        <Link to={`/household/${householdId}/planner`} className="text-sm font-medium text-brand hover:underline">Meal planner</Link>
        <Link to={`/household/${householdId}`} className="text-sm font-medium text-brand hover:underline">Household setup</Link>
        <Link to="/" className="text-sm font-medium text-brand hover:underline">All households</Link>
      </NavBar>
    </PageShell>
  );
}
