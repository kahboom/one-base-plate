import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHousehold } from "../storage";
import { PageShell, PageHeader, Card, Chip, NavBar, EmptyState, Section } from "../components/ui";

const outcomeLabels: Record<string, string> = {
  success: "Worked well",
  partial: "Partly worked",
  failure: "Didn't work",
};

const outcomeChipVariant: Record<string, "success" | "warning" | "danger"> = {
  success: "success",
  partial: "warning",
  failure: "danger",
};

export default function MealHistory() {
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

  const outcomes = [...(household.mealOutcomes ?? [])].reverse();

  function getMealName(mealId: string): string {
    return household?.baseMeals.find((m) => m.id === mealId)?.name ?? mealId;
  }

  return (
    <PageShell>
      <PageHeader title="Meal History" subtitle={`Household: ${household.name}`} />

      {outcomes.length === 0 ? (
        <EmptyState>No meal outcomes recorded yet. Record how meals went from the weekly planner.</EmptyState>
      ) : (
        <Section>
          <div className="space-y-3" data-testid="outcome-list">
            {outcomes.map((outcome) => (
              <Card key={outcome.id} data-testid={`outcome-${outcome.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-text-primary">
                    {getMealName(outcome.baseMealId)}
                  </span>
                  <Chip variant={outcomeChipVariant[outcome.outcome]}>
                    {outcomeLabels[outcome.outcome]}
                  </Chip>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-muted">
                  <span>{outcome.day}</span>
                  <span>{outcome.date}</span>
                </div>
                {outcome.notes && (
                  <p className="mt-2 text-sm text-text-secondary">{outcome.notes}</p>
                )}
              </Card>
            ))}
          </div>
        </Section>
      )}

      <NavBar>
        <Link to={`/household/${householdId}/weekly`} className="text-sm font-medium text-brand hover:underline">Weekly planner</Link>
        <Link to={`/household/${householdId}/home`} className="text-sm font-medium text-brand hover:underline">Home</Link>
      </NavBar>
    </PageShell>
  );
}
