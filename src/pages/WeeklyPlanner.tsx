import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Household, WeeklyPlan, DayPlan, BaseMeal } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { generateWeeklyPlan, computeMealOverlap } from "../planner";
import MealCard from "../components/MealCard";

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
    <div>
      <h1>Weekly Planner</h1>
      <p>Household: {household.name}</p>

      {household.baseMeals.length === 0 ? (
        <p>No base meals available. Add meals before generating a plan.</p>
      ) : (
        <div>
          <label>
            Days to plan:{" "}
            <select
              value={numDays}
              onChange={(e) => setNumDays(Number(e.target.value))}
              data-testid="days-select"
            >
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </select>
          </label>{" "}
          <button type="button" onClick={handleGenerate} data-testid="generate-btn">
            Generate plan
          </button>
        </div>
      )}

      <div data-testid="day-cards" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
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
        <div data-testid="weekly-plan" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={handleSave} data-testid="save-plan-btn">
            Save plan
          </button>
        </div>
      )}

      {household.baseMeals.length > 0 && (
        <div data-testid="suggested-tray" style={{ marginTop: "1.5rem" }}>
          <h2>Suggested meals</h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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
      )}

      <div style={{ marginTop: "1rem" }}>
        <button
          type="button"
          onClick={() => navigate(`/household/${householdId}`)}
        >
          Back to household
        </button>
        {" | "}
        <Link to={`/household/${householdId}/planner`}>Single meal planner</Link>
        {" | "}
        <Link to={`/household/${householdId}/home`}>Home</Link>
      </div>
    </div>
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
      style={{
        border: isEmpty ? "1px dashed #ccc" : "1px solid #ccc",
        borderRadius: "8px",
        padding: "0.75rem",
        minWidth: "140px",
        flex: "1 1 140px",
        background: isEmpty ? "#fafafa" : "#fff",
      }}
    >
      <strong>{dayLabel}</strong>

      {dayPlan && mealName ? (
        <>
          <p>{mealName}</p>
          <small>Overlap: {overlapLabel}</small>
          <div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              data-testid={`toggle-${dayLabel.toLowerCase()}`}
              style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                data-testid={`clear-${dayLabel.toLowerCase()}`}
                style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}
              >
                Clear
              </button>
            )}
          </div>
          {expanded && (
            <div data-testid={`details-${dayLabel.toLowerCase()}`}>
              {dayPlan.variants.map((variant) => {
                const member = household.members.find(
                  (m) => m.id === variant.memberId,
                );
                if (!member) return null;
                return (
                  <div key={variant.id} style={{ marginTop: "0.5rem" }}>
                    <em>
                      {member.name} ({member.role})
                      {variant.requiresExtraPrep && " — extra prep"}
                    </em>
                    <ul style={{ margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
                      {variant.instructions.map((instr, i) => (
                        <li key={i} style={{ fontSize: "0.85rem" }}>{instr}</li>
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
              <p style={{ color: "#888", fontStyle: "italic" }}>
                Suggested: {suggestedMeal.name}
              </p>
              <small style={{ color: "#999" }}>
                {suggestedMeal.estimatedTimeMinutes} min | {suggestedMeal.difficulty}
              </small>
            </>
          ) : (
            <p style={{ color: "#888" }}>No meal planned</p>
          )}
        </div>
      )}
    </div>
  );
}
