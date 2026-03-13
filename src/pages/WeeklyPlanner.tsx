import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Household, WeeklyPlan, DayPlan, BaseMeal } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { generateWeeklyPlan, computeMealOverlap, generateAssemblyVariants, computeWeekEffortBalance, computeGroceryPreview } from "../planner";
import MealCard from "../components/MealCard";
import { PageShell, PageHeader, Button, Select, Section, NavBar, EmptyState, Chip } from "../components/ui";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeeklyPlanner() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [household, setHousehold] = useState<Household | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [numDays, setNumDays] = useState(7);
  const [loaded, setLoaded] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);

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
      household.pinnedMealIds ?? [],
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

  function assignMealToDay(mealId: string, dayLabel: string) {
    if (!household) return;
    const meal = household.baseMeals.find((m) => m.id === mealId);
    if (!meal) return;

    const variants = generateAssemblyVariants(meal, household.members, household.ingredients);
    const newDayPlan: DayPlan = { day: dayLabel, baseMealId: mealId, variants };

    setPlan((prev) => {
      const existingDays = prev?.days ?? [];
      const filtered = existingDays.filter((d) => d.day !== dayLabel);
      const updatedDays = [...filtered, newDayPlan];
      return {
        id: prev?.id ?? crypto.randomUUID(),
        days: updatedDays,
        selectedBaseMeals: [...new Set(updatedDays.map((d) => d.baseMealId))],
        generatedGroceryList: prev?.generatedGroceryList ?? [],
        notes: prev?.notes ?? "",
      };
    });

    setSelectedMealId(null);
  }

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

  function getMeal(mealId: string): BaseMeal | undefined {
    return household?.baseMeals.find((m) => m.id === mealId);
  }

  function getMealName(mealId: string): string {
    return getMeal(mealId)?.name ?? mealId;
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

  const rankedMealsForSuggestion = useMemo(() => {
    if (!household || household.baseMeals.length === 0) return [];
    return [...household.baseMeals]
      .map((meal) => ({
        meal,
        overlap: computeMealOverlap(meal, household.members, household.ingredients),
      }))
      .sort((a, b) => b.overlap.score - a.overlap.score);
  }, [household]);

  function getSuggestedMeal(dayLabel: string): BaseMeal | null {
    if (rankedMealsForSuggestion.length === 0) return null;
    const index = DAY_LABELS.indexOf(dayLabel) % rankedMealsForSuggestion.length;
    return rankedMealsForSuggestion[index]?.meal ?? null;
  }

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

  const daySlots = DAY_LABELS.slice(0, numDays);

  return (
    <PageShell>
      <PageHeader title="Weekly Planner" subtitle={`Household: ${household.name}`} />

      {household.baseMeals.length === 0 ? (
        <EmptyState>No base meals available. Add meals before generating a plan.</EmptyState>
      ) : (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
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

      {plan && plan.days.length > 0 && household && (() => {
        const balance = computeWeekEffortBalance(plan.days, household.baseMeals);
        const groceryPreview = computeGroceryPreview(plan.days, household.baseMeals, household.ingredients);
        return (
          <div data-testid="effort-balance" className="mt-4 mb-4 rounded-md border border-border-light bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-semibold text-text-primary">Week effort</span>
              <span className="text-sm text-text-secondary" data-testid="total-prep-time">
                {balance.totalPrepMinutes} min total
              </span>
              <div className="flex gap-2">
                {balance.effortCounts.easy > 0 && (
                  <Chip variant="success" data-testid="effort-easy">{balance.effortCounts.easy} easy</Chip>
                )}
                {balance.effortCounts.medium > 0 && (
                  <Chip variant="warning" data-testid="effort-medium">{balance.effortCounts.medium} medium</Chip>
                )}
                {balance.effortCounts.hard > 0 && (
                  <Chip variant="danger" data-testid="effort-hard">{balance.effortCounts.hard} hard</Chip>
                )}
              </div>
              {balance.highEffortDays.length > 0 && (
                <span className="text-xs text-text-muted" data-testid="high-effort-warning">
                  Higher effort: {balance.highEffortDays.join(", ")}
                </span>
              )}
            </div>
            {groceryPreview.uniqueIngredientCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border-light pt-3" data-testid="grocery-preview">
                <span className="text-sm font-semibold text-text-primary">Grocery preview</span>
                <span className="text-sm text-text-secondary" data-testid="grocery-count">
                  {groceryPreview.uniqueIngredientCount} ingredient{groceryPreview.uniqueIngredientCount !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  {Object.entries(groceryPreview.categoryBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, count]) => (
                      <Chip key={cat} variant="neutral" data-testid={`grocery-cat-${cat}`}>
                        {count} {cat}
                      </Chip>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div data-testid="day-cards" className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
              meal={dayPlan ? getMeal(dayPlan.baseMealId) : undefined}
              household={household}
              onClear={dayIndex >= 0 ? () => handleClearDay(dayIndex) : undefined}
              onDrop={(mealId) => assignMealToDay(mealId, dayLabel)}
              isAssignTarget={selectedMealId !== null}
              onTapAssign={() => {
                if (selectedMealId) assignMealToDay(selectedMealId, dayLabel);
              }}
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
            {selectedMealId && (
              <p className="mb-3 text-sm text-brand font-medium" data-testid="assign-prompt">
                Tap a day to assign {household.baseMeals.find((m) => m.id === selectedMealId)?.name ?? "meal"}.{" "}
                <button className="underline cursor-pointer" onClick={() => setSelectedMealId(null)}>Cancel</button>
              </p>
            )}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                    draggable
                    selected={selectedMealId === meal.id}
                    pinned={(household.pinnedMealIds ?? []).includes(meal.id)}
                    onAssign={() => setSelectedMealId(selectedMealId === meal.id ? null : meal.id)}
                    onPin={() => handleTogglePin(meal.id)}
                  />
                ))}
            </div>
          </div>
        </Section>
      )}

      <NavBar>
        <Button onClick={() => navigate(`/household/${householdId}`)}>Back to household</Button>
        <Link to={`/household/${householdId}/planner`} className="text-sm font-medium text-brand hover:underline">Single meal planner</Link>
        <Link to={`/household/${householdId}/grocery`} className="text-sm font-medium text-brand hover:underline">Grocery list</Link>
        <Link to={`/household/${householdId}/home`} className="text-sm font-medium text-brand hover:underline">Home</Link>
      </NavBar>
    </PageShell>
  );
}

const effortLabel: Record<string, string> = {
  easy: "Low effort",
  medium: "Medium effort",
  hard: "Higher effort",
};

const effortChipVariant: Record<string, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

function DayCard({
  dayLabel,
  dayPlan,
  dayIndex: _dayIndex,
  suggestedMeal,
  mealName,
  overlapLabel,
  meal,
  household,
  onClear,
  onDrop,
  isAssignTarget,
  onTapAssign,
}: {
  dayLabel: string;
  dayPlan: DayPlan | null;
  dayIndex: number;
  suggestedMeal: BaseMeal | null;
  mealName: string | null;
  overlapLabel: string | null;
  meal?: BaseMeal;
  household: Household;
  onClear?: () => void;
  onDrop?: (mealId: string) => void;
  isAssignTarget?: boolean;
  onTapAssign?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [justAssigned, setJustAssigned] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isEmpty = !dayPlan;
  const isHighEffort = meal?.difficulty === "hard";

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function triggerAssignFeedback() {
    setJustAssigned(true);
    setShowConfirmation(true);
    setTimeout(() => setJustAssigned(false), 600);
    setTimeout(() => setShowConfirmation(false), 800);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const mealId = e.dataTransfer.getData("application/meal-id");
    if (mealId && onDrop) {
      onDrop(mealId);
      triggerAssignFeedback();
    }
  }

  function handleTapAssign() {
    if (isAssignTarget && onTapAssign) {
      onTapAssign();
      triggerAssignFeedback();
    }
  }

  return (
    <div
      data-testid={`day-${dayLabel.toLowerCase()}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleTapAssign}
      role={isAssignTarget ? "button" : undefined}
      className={`relative rounded-md p-4 shadow-card transition-all duration-200 ${
        justAssigned
          ? "border-2 border-brand bg-brand/5 scale-[1.02]"
          : dragOver
            ? "border-2 border-brand border-dashed bg-brand/5"
            : isEmpty
              ? `border border-dashed bg-bg ${isAssignTarget ? "border-brand cursor-pointer hover:bg-brand/5" : "border-border-default"}`
              : `border bg-surface ${isAssignTarget ? "border-brand cursor-pointer hover:bg-brand/5" : isHighEffort ? "border-danger" : "border-border-light"}`
      }`}
    >
      <strong className="text-base font-semibold text-text-primary">{dayLabel}</strong>

      {showConfirmation && (
        <div
          data-testid={`confirm-${dayLabel.toLowerCase()}`}
          className="animate-meal-assigned absolute inset-0 z-10 flex items-center justify-center rounded-md bg-brand/10"
        >
          <span className="rounded-pill bg-brand px-3 py-1 text-sm font-medium text-white shadow-card">
            Meal added
          </span>
        </div>
      )}

      {dayPlan && mealName ? (
        <>
          <p className="mt-1 text-sm text-text-primary">{mealName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <small className="text-xs text-text-muted">Overlap: {overlapLabel}</small>
            {meal && (
              <>
                <small className="text-xs text-text-muted" data-testid={`prep-time-${dayLabel.toLowerCase()}`}>
                  {meal.estimatedTimeMinutes} min
                </small>
                <Chip
                  variant={effortChipVariant[meal.difficulty] ?? "neutral"}
                  data-testid={`effort-${dayLabel.toLowerCase()}`}
                >
                  {effortLabel[meal.difficulty] ?? meal.difficulty}
                </Chip>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
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
