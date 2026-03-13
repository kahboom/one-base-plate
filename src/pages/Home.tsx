import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHousehold } from "../storage";
import { computeMealOverlap } from "../planner";
import MealCard from "../components/MealCard";
import { PageShell, Section, NavBar } from "../components/ui";

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

  if (!loaded) return null;
  if (!household) return <p>Household not found.</p>;

  const latestPlan =
    household.weeklyPlans.length > 0
      ? household.weeklyPlans[household.weeklyPlans.length - 1]!
      : null;

  const topMeals = [...household.baseMeals]
    .map((meal) => ({
      meal,
      overlap: computeMealOverlap(meal, household.members, household.ingredients),
    }))
    .sort((a, b) => b.overlap.score - a.overlap.score)
    .slice(0, 3);

  function getMealName(mealId: string): string {
    return household?.baseMeals.find((m) => m.id === mealId)?.name ?? "";
  }

  return (
    <PageShell>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-text-primary">
        What should we eat tonight?
      </h1>
      <p className="mb-6 text-sm text-text-muted">{household.name}</p>

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
                    className="min-w-[90px] flex-shrink-0 rounded-sm border border-border-light bg-surface p-2 text-center shadow-card"
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

      {topMeals.length > 0 && (
        <Section>
          <div data-testid="top-suggestions">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">Top suggestions</h2>
            <div className="flex flex-wrap gap-3">
              {topMeals.map(({ meal, overlap }) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  members={household.members}
                  ingredients={household.ingredients}
                  overlap={overlap}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      <NavBar>
        <Link to={`/household/${householdId}/weekly`} className="text-sm font-medium text-brand hover:underline">Weekly planner</Link>
        <span className="text-text-muted">|</span>
        <Link to={`/household/${householdId}/planner`} className="text-sm font-medium text-brand hover:underline">Meal planner</Link>
        <span className="text-text-muted">|</span>
        <Link to={`/household/${householdId}`} className="text-sm font-medium text-brand hover:underline">Household setup</Link>
        <span className="text-text-muted">|</span>
        <Link to="/" className="text-sm font-medium text-brand hover:underline">All households</Link>
      </NavBar>
    </PageShell>
  );
}
