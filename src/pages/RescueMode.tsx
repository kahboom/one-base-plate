import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Household, DayPlan } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import {
  generateRescueMeals,
  generateAssemblyVariants,
  type RescueScenario,
  type RescueMeal,
} from "../planner";
import { PageShell, PageHeader, Card, Button, Chip, Section, HouseholdNav, EmptyState } from "../components/ui";

const SCENARIOS: { id: RescueScenario; label: string; description: string }[] = [
  { id: "low-energy", label: "Low energy", description: "Keep it simple tonight" },
  { id: "low-time", label: "Low time", description: "Fastest acceptable dinner" },
  { id: "everyone-melting-down", label: "Everyone melting down", description: "Safe foods first, minimum fuss" },
];

export default function RescueMode() {
  const { householdId } = useParams<{ householdId: string }>();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scenario, setScenario] = useState<RescueScenario | null>(null);
  const [results, setResults] = useState<RescueMeal[]>([]);
  const [addedTonight, setAddedTonight] = useState<string | null>(null);
  const [addedToWeek, setAddedToWeek] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) setHousehold(h);
    setLoaded(true);
  }, [householdId]);

  function handleScenario(s: RescueScenario) {
    if (!household) return;
    setScenario(s);
    const rescueMeals = generateRescueMeals(
      household.baseMeals,
      household.members,
      household.ingredients,
      s,
    );
    setResults(rescueMeals);
    setAddedTonight(null);
    setAddedToWeek(null);
  }

  function addToTonight(mealId: string) {
    if (!household) return;
    const meal = household.baseMeals.find((m) => m.id === mealId);
    if (!meal) return;

    const variants = generateAssemblyVariants(meal, household.members, household.ingredients);
    const todayPlan: DayPlan = { day: "Tonight", baseMealId: mealId, variants };

    const updated = { ...household };
    if (updated.weeklyPlans.length === 0) {
      updated.weeklyPlans = [{
        id: `plan-rescue-${Date.now()}`,
        days: [todayPlan],
        selectedBaseMeals: [mealId],
        generatedGroceryList: [],
        notes: "Rescue meal",
      }];
    } else {
      const plan = { ...updated.weeklyPlans[updated.weeklyPlans.length - 1]! };
      const existingTonightIdx = plan.days.findIndex((d) => d.day === "Tonight");
      if (existingTonightIdx >= 0) {
        plan.days = [...plan.days];
        plan.days[existingTonightIdx] = todayPlan;
      } else {
        plan.days = [...plan.days, todayPlan];
      }
      updated.weeklyPlans = [...updated.weeklyPlans.slice(0, -1), plan];
    }

    saveHousehold(updated);
    setHousehold(updated);
    setAddedTonight(mealId);
  }

  function addToWeek(mealId: string) {
    if (!household) return;
    const meal = household.baseMeals.find((m) => m.id === mealId);
    if (!meal) return;

    const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const variants = generateAssemblyVariants(meal, household.members, household.ingredients);

    const updated = { ...household };
    if (updated.weeklyPlans.length === 0) {
      const dayPlan: DayPlan = { day: DAY_LABELS[0]!, baseMealId: mealId, variants };
      updated.weeklyPlans = [{
        id: `plan-rescue-${Date.now()}`,
        days: [dayPlan],
        selectedBaseMeals: [mealId],
        generatedGroceryList: [],
        notes: "",
      }];
    } else {
      const plan = { ...updated.weeklyPlans[updated.weeklyPlans.length - 1]! };
      const usedDays = new Set(plan.days.map((d) => d.day));
      const emptyDay = DAY_LABELS.find((d) => !usedDays.has(d)) ?? DAY_LABELS[0]!;
      plan.days = [...plan.days, { day: emptyDay, baseMealId: mealId, variants }];
      updated.weeklyPlans = [...updated.weeklyPlans.slice(0, -1), plan];
    }

    saveHousehold(updated);
    setHousehold(updated);
    setAddedToWeek(mealId);
  }

  if (!loaded) return null;
  if (!household) return <p>Household not found.</p>;

  const hasMeals = household.baseMeals.length > 0;

  return (
    <PageShell>
      <PageHeader title="Rescue mode" subtitle="Fastest acceptable dinner — no guilt, just food" />

      {!hasMeals && (
        <EmptyState>
          No meals available yet. <Link to={`/household/${householdId}/meals`} className="font-medium text-brand hover:underline">Add some base meals</Link> first.
        </EmptyState>
      )}

      {hasMeals && !scenario && (
        <Section title="What's tonight like?">
          <div data-testid="scenario-picker" className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {SCENARIOS.map((s) => (
              <Card
                key={s.id}
                data-testid={`scenario-${s.id}`}
                className="cursor-pointer text-center hover:border-brand"
                onClick={() => handleScenario(s.id)}
              >
                <strong className="text-lg">{s.label}</strong>
                <p className="mt-1 text-sm text-text-muted">{s.description}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {scenario && results.length > 0 && (
        <Section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-muted" data-testid="scenario-label">
              Showing rescue meals for: <strong>{SCENARIOS.find((s) => s.id === scenario)?.label}</strong>
            </p>
            <Button
              small
              onClick={() => { setScenario(null); setResults([]); }}
              data-testid="change-scenario"
            >
              Change scenario
            </Button>
          </div>

          <div data-testid="rescue-results" className="space-y-4">
            {results.map((r) => (
              <Card key={r.meal.id} data-testid={`rescue-meal-${r.meal.id}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <strong className="text-lg">{r.meal.name}</strong>
                    <p className="mt-1 text-sm text-text-secondary" data-testid={`prep-summary-${r.meal.id}`}>
                      {r.prepSummary}
                    </p>
                    <Chip variant="info" className="mt-1" data-testid={`confidence-${r.meal.id}`}>
                      {r.confidence}
                    </Chip>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      small
                      variant="primary"
                      onClick={() => addToTonight(r.meal.id)}
                      data-testid={`add-tonight-${r.meal.id}`}
                      disabled={addedTonight === r.meal.id}
                    >
                      {addedTonight === r.meal.id ? "Added!" : "Add to tonight"}
                    </Button>
                    <Button
                      small
                      onClick={() => addToWeek(r.meal.id)}
                      data-testid={`add-to-week-${r.meal.id}`}
                      disabled={addedToWeek === r.meal.id}
                    >
                      {addedToWeek === r.meal.id ? "Added!" : "Add to week"}
                    </Button>
                  </div>
                </div>

                <div className="mt-3" data-testid={`rescue-assemblies-${r.meal.id}`}>
                  <p className="mb-2 text-sm font-medium text-text-secondary">Per-person assembly</p>
                  <div className="space-y-2">
                    {r.variants.map((v) => {
                      const member = household.members.find((m) => m.id === v.memberId);
                      return (
                        <div key={v.id} className="rounded border border-border-light bg-bg p-2 text-sm" data-testid={`rescue-variant-${v.memberId}`}>
                          <strong>{member?.name ?? v.memberId}</strong>
                          <ul className="mt-1 list-disc pl-5 text-text-secondary">
                            {v.instructions.map((inst, i) => (
                              <li key={i}>{inst}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {scenario && results.length === 0 && (
        <EmptyState>
          No rescue-eligible meals found. Try adding meals with rescue eligibility enabled.
        </EmptyState>
      )}

      <HouseholdNav householdId={householdId ?? ""} />
    </PageShell>
  );
}
