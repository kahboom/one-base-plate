import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Household, WeeklyPlan, DayPlan } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { generateWeeklyPlan, computeMealOverlap } from "../planner";

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

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

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

      {plan && (
        <div data-testid="weekly-plan">
          <div data-testid="day-cards" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {plan.days.map((dayPlan: DayPlan, index: number) => (
              <DayCard
                key={index}
                dayPlan={dayPlan}
                mealName={getMealName(dayPlan.baseMealId)}
                overlapLabel={getMealOverlapLabel(dayPlan.baseMealId)}
                household={household}
              />
            ))}
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button type="button" onClick={handleSave} data-testid="save-plan-btn">
              Save plan
            </button>
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
      </div>
    </div>
  );
}

function DayCard({
  dayPlan,
  mealName,
  overlapLabel,
  household,
}: {
  dayPlan: DayPlan;
  mealName: string;
  overlapLabel: string;
  household: Household;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid={`day-${dayPlan.day.toLowerCase()}`}
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "0.75rem",
        minWidth: "140px",
        flex: "1 1 140px",
      }}
    >
      <strong>{dayPlan.day}</strong>
      <p>{mealName}</p>
      <small>Overlap: {overlapLabel}</small>

      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          data-testid={`toggle-${dayPlan.day.toLowerCase()}`}
          style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {expanded && (
        <div data-testid={`details-${dayPlan.day.toLowerCase()}`}>
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
    </div>
  );
}
