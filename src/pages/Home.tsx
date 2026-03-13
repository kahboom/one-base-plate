import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHousehold } from "../storage";
import { computeMealOverlap } from "../planner";
import MealCard from "../components/MealCard";

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
    <div>
      <h1>What should we eat tonight?</h1>
      <p>{household.name}</p>

      {latestPlan && (
        <div data-testid="weekly-strip">
          <h2>This week</h2>
          <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto" }}>
            {DAY_LABELS.map((label, i) => {
              const dayPlan = latestPlan.days[i];
              return (
                <div
                  key={label}
                  data-testid={`strip-${label.toLowerCase()}`}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    padding: "0.5rem",
                    minWidth: "80px",
                    textAlign: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <strong style={{ fontSize: "0.8rem" }}>{label}</strong>
                  <p style={{ fontSize: "0.75rem", margin: "0.25rem 0 0" }}>
                    {dayPlan ? getMealName(dayPlan.baseMealId) || "Planned" : "—"}
                  </p>
                </div>
              );
            })}
          </div>
          <Link to={`/household/${householdId}/weekly`}>View full plan</Link>
        </div>
      )}

      {!latestPlan && household.baseMeals.length > 0 && (
        <div data-testid="no-plan-prompt">
          <p>No plan for this week yet.</p>
          <Link to={`/household/${householdId}/weekly`}>Start planning</Link>
        </div>
      )}

      {topMeals.length > 0 && (
        <div data-testid="top-suggestions">
          <h2>Top suggestions</h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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
      )}

      <div style={{ marginTop: "1rem" }}>
        <Link to={`/household/${householdId}/weekly`}>Weekly planner</Link>
        {" | "}
        <Link to={`/household/${householdId}/planner`}>Meal planner</Link>
        {" | "}
        <Link to={`/household/${householdId}`}>Household setup</Link>
        {" | "}
        <Link to="/">All households</Link>
      </div>
    </div>
  );
}
