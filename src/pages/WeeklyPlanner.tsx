import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Household, WeeklyPlan, DayPlan, BaseMeal } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { generateWeeklyPlan, computeMealOverlap } from "../planner";
import MealCard from "../components/MealCard";
import { PageShell, Button, Select, Section, NavBar } from "../components/ui";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeeklyPlanner() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [household, setHousehold] = useState<Household | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [numDays, setNumDays] = useState(7);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) {
      setHousehold(h);
      if (h.weeklyPlans.length > 0) {
        setPlan(h.weeklyPlans[h.weeklyPlans.length - 1]!);
      }
    }
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleGenerate() {
    if (!household) return;

    const days = generateWeeklyPlan(
      household.baseMeals,
      household.members,
      household.ingredients,
      numDays,
    );

    const newPlan: WeeklyPlan = {
      id: crypto.randomUUID(),
      days,
      selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
      generatedGroceryList: [],
      notes: "",
    };

    setPlan(newPlan);
  }

  function handleClearDay(dayIndex: number) {
    if (!plan) return;
    const updatedDays = plan.days.filter((_, i) => i !== dayIndex);
    setPlan({ ...plan, days: updatedDays });
  }

  function handleSave() {
    if (!household || !plan) return;

    const existingIndex = household.weeklyPlans.findIndex(
      (p) => p.id === plan.id,
    );
    const updatedPlans = [...household.weeklyPlans];
    if (existingIndex >= 0) {
      updatedPlans[existingIndex] = plan;
    } else {
      updatedPlans.push(plan);
    }

    const updatedHousehold = { ...household, weeklyPlans: updatedPlans };
    saveHousehold(updatedHousehold);
    setHousehold(updatedHousehold);
  }

  function getMealName(mealId: string): string {
    return household?.baseMeals.find((m) => m.id === mealId)?.name ?? mealId;
  }

  function getMealOverlapLabel(mealId: string): string {
    if (!household) return "";
    const meal = household.baseMeals.find((m) => m.id === mealId);
    if (!meal) return "";
    const overlap = computeMealOverlap(
      meal,
      household.members,
      household.ingredients,
    );
    return `${overlap.score}/${overlap.total}`;
  }

  function getSuggestedMeal(dayLabel: string): BaseMeal | null {
    if (!household || household.baseMeals.length === 0) return null;
    const ranked = [...household.baseMeals]
      .map((meal) => ({
        meal,
        overlap: computeMealOverlap(meal, household.members, household.ingredients),
      }))
      .sort((a, b) => b.overlap.score - a.overlap.score);
    const index = DAY_LABELS.indexOf(dayLabel) % ranked.length;
    return ranked[index]?.meal ?? null;
  }

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

  const daySlots = DAY_LABELS.slice(0, numDays);

  return (
    <PageShell>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-text-primary">Weekly Planner</h1>
      <p className="mb-6 text-sm text-text-muted">Household: {household.name}</p>

      {household.baseMeals.length === 0 ? (
        <p className="text-text-muted">No base meals available. Add meals before generating a plan.</p>
      ) : (
        <div className="mb-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            Days to plan:
            <Select
              value={numDays}
              onChange={(e) => setNumDays(Number(e.target.value))}
              data-testid="days-select"
              className="w-auto"
            >
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </Select>
          </label>
          <Button variant="primary" onClick={handleGenerate} data-testid="generate-btn">
            Generate plan
          </Button>
        </div>
      )}

      <div data-testid="day-cards" className="mt-4 flex flex-wrap gap-4">
        {daySlots.map((dayLabel) => {
          const dayIndex = plan?.days.findIndex((d) => d.day === dayLabel) ?? -1;
          const dayPlan = dayIndex >= 0 ? plan!.days[dayIndex]! : null;
          const suggested = !dayPlan ? getSuggestedMeal(dayLabel) : null;

          return (
            <DayCard
              key={dayLabel}
              dayLabel={dayLabel}
              dayPlan={dayPlan}
              dayIndex={dayIndex}
              suggestedMeal={suggested}
              mealName={dayPlan ? getMealName(dayPlan.baseMealId) : null}
              overlapLabel={dayPlan ? getMealOverlapLabel(dayPlan.baseMealId) : null}
              household={household}
              onClear={dayIndex >= 0 ? () => handleClearDay(dayIndex) : undefined}
            />
          );
        })}
      </div>

      {plan && (
        <div data-testid="weekly-plan" className="mt-4">
          <Button variant="primary" onClick={handleSave} data-testid="save-plan-btn">
            Save plan
          </Button>
        </div>
      )}

      {household.baseMeals.length > 0 && (
        <Section>
          <div data-testid="suggested-tray" className="mt-6">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">Suggested meals</h2>
            <div className="flex flex-wrap gap-3">
              {[...household.baseMeals]
                .map((meal) => ({
                  meal,
                  overlap: computeMealOverlap(meal, household.members, household.ingredients),
                }))
                .sort((a, b) => b.overlap.score - a.overlap.score)
                .map(({ meal, overlap }) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    members={household.members}
                    ingredients={household.ingredients}
                    overlap={overlap}
                    compact
                  />
                ))}
            </div>
          </div>
        </Section>
      )}

      <NavBar>
        <Button onClick={() => navigate(`/household/${householdId}`)}>Back to household</Button>
        <Link to={`/household/${householdId}/planner`} className="text-sm font-medium text-brand hover:underline">Single meal planner</Link>
        <Link to={`/household/${householdId}/home`} className="text-sm font-medium text-brand hover:underline">Home</Link>
      </NavBar>
    </PageShell>
  );
}

function DayCard({
  dayLabel,
  dayPlan,
  dayIndex: _dayIndex,
  suggestedMeal,
  mealName,
  overlapLabel,
  household,
  onClear,
}: {
  dayLabel: string;
  dayPlan: DayPlan | null;
  dayIndex: number;
  suggestedMeal: BaseMeal | null;
  mealName: string | null;
  overlapLabel: string | null;
  household: Household;
  onClear?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEmpty = !dayPlan;

  return (
    <div
      data-testid={`day-${dayLabel.toLowerCase()}`}
      className={`min-w-[140px] flex-1 rounded-md p-3 shadow-card ${
        isEmpty
          ? "border border-dashed border-border-default bg-bg"
          : "border border-border-light bg-surface"
      }`}
    >
      <strong className="text-base font-semibold text-text-primary">{dayLabel}</strong>

      {dayPlan && mealName ? (
        <>
          <p className="mt-1 text-sm text-text-primary">{mealName}</p>
          <small className="text-xs text-text-muted">Overlap: {overlapLabel}</small>
          <div className="mt-1 flex gap-2">
            <Button
              small
              onClick={() => setExpanded(!expanded)}
              data-testid={`toggle-${dayLabel.toLowerCase()}`}
            >
              {expanded ? "Hide details" : "Show details"}
            </Button>
            {onClear && (
              <Button
                variant="danger"
                small
                onClick={onClear}
                data-testid={`clear-${dayLabel.toLowerCase()}`}
              >
                Clear
              </Button>
            )}
          </div>
          {expanded && (
            <div data-testid={`details-${dayLabel.toLowerCase()}`} className="mt-2">
              {dayPlan.variants.map((variant) => {
                const member = household.members.find(
                  (m) => m.id === variant.memberId,
                );
                if (!member) return null;
                return (
                  <div key={variant.id} className="mt-2">
                    <em className="text-sm text-text-secondary">
                      {member.name} ({member.role})
                      {variant.requiresExtraPrep && " \u2014 extra prep"}
                    </em>
                    <ul className="mt-1 space-y-0.5 pl-5">
                      {variant.instructions.map((instr, i) => (
                        <li key={i} className="text-xs">{instr}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div data-testid={`empty-${dayLabel.toLowerCase()}`}>
          {suggestedMeal ? (
            <>
              <p className="mt-1 text-sm italic text-text-muted">
                Suggested: {suggestedMeal.name}
              </p>
              <small className="text-xs text-text-muted">
                {suggestedMeal.estimatedTimeMinutes} min | {suggestedMeal.difficulty}
              </small>
            </>
          ) : (
            <p className="mt-1 text-sm text-text-muted">No meal planned</p>
          )}
        </div>
      )}
    </div>
  );
}
