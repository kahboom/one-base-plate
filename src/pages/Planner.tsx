import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { BaseMeal, AssemblyVariant, Household } from "../types";
import { loadHousehold } from "../storage";
import {
  generateAssemblyVariants,
  computeMealOverlap,
  generateMealExplanation,
} from "../planner";
import type { OverlapResult, MealExplanation } from "../planner";
import MealCard from "../components/MealCard";

const chipStyle = (bg: string, color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "0.15rem 0.5rem",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 500,
  background: bg,
  color,
  marginRight: "0.25rem",
  marginBottom: "0.25rem",
});

export default function Planner() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [household, setHousehold] = useState<Household | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string>("");
  const [variants, setVariants] = useState<AssemblyVariant[]>([]);
  const [loaded, setLoaded] = useState(false);

  const regenerateVariants = useCallback(
    (h: Household, mealId: string) => {
      if (!mealId) {
        setVariants([]);
        return;
      }
      const meal = h.baseMeals.find((m) => m.id === mealId);
      if (!meal) {
        setVariants([]);
        return;
      }
      setVariants(generateAssemblyVariants(meal, h.members, h.ingredients));
    },
    [],
  );

  useEffect(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) {
      setHousehold(h);
      regenerateVariants(h, selectedMealId);
    }
    setLoaded(true);
  }, [householdId, regenerateVariants, selectedMealId]);

  function handleSelectMeal(mealId: string) {
    setSelectedMealId(mealId);
    if (!household) return;
    regenerateVariants(household, mealId);
  }

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

  const selectedMeal: BaseMeal | undefined = household.baseMeals.find(
    (m) => m.id === selectedMealId,
  );

  const mealOverlaps: Map<string, OverlapResult> = new Map();
  for (const meal of household.baseMeals) {
    mealOverlaps.set(
      meal.id,
      computeMealOverlap(meal, household.members, household.ingredients),
    );
  }

  const rankedMeals = [...household.baseMeals].sort((a, b) => {
    const overlapA = mealOverlaps.get(a.id);
    const overlapB = mealOverlaps.get(b.id);
    return (overlapB?.score ?? 0) - (overlapA?.score ?? 0);
  });

  const selectedOverlap = selectedMealId
    ? mealOverlaps.get(selectedMealId)
    : undefined;

  const selectedExplanation: MealExplanation | undefined =
    selectedMeal && household
      ? generateMealExplanation(
          selectedMeal,
          household.members,
          household.ingredients,
        )
      : undefined;

  return (
    <div>
      <h1>Meal Planner</h1>
      <p>Household: {household.name}</p>

      {household.baseMeals.length === 0 ? (
        <p>No base meals available. Add meals first.</p>
      ) : (
        <>
          <h2>Choose a meal</h2>
          <div data-testid="meal-card-grid" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            {rankedMeals.map((meal) => {
              const overlap = mealOverlaps.get(meal.id);
              const isSelected = meal.id === selectedMealId;
              return (
                <div
                  key={meal.id}
                  style={{
                    outline: isSelected ? "2px solid #0d6efd" : "none",
                    borderRadius: "14px",
                    cursor: "pointer",
                  }}
                  onClick={() => handleSelectMeal(meal.id)}
                  data-testid={`selectable-${meal.id}`}
                >
                  <MealCard
                    meal={meal}
                    members={household.members}
                    ingredients={household.ingredients}
                    overlap={overlap}
                    onOpen={() => handleSelectMeal(meal.id)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedMeal && (
        <div data-testid="meal-plan">
          <h2>{selectedMeal.name}</h2>
          <p>
            Prep: {selectedMeal.defaultPrep} | Time:{" "}
            {selectedMeal.estimatedTimeMinutes} min | Difficulty:{" "}
            {selectedMeal.difficulty}
          </p>

          {selectedOverlap && (
            <div data-testid="overlap-summary">
              <p>
                Overlap: {selectedOverlap.score}/{selectedOverlap.total} members
                compatible
              </p>
              <div data-testid="overlap-indicators">
                {selectedOverlap.memberDetails.map((d) => {
                  const colors =
                    d.compatibility === "direct"
                      ? { bg: "#d4edda", color: "#155724" }
                      : d.compatibility === "with-adaptation"
                        ? { bg: "#fff3cd", color: "#856404" }
                        : { bg: "#f8d7da", color: "#721c24" };
                  return (
                    <span
                      key={d.memberId}
                      data-testid={`overlap-${d.memberId}`}
                      style={chipStyle(colors.bg, colors.color)}
                      title={
                        d.compatibility === "conflict"
                          ? d.conflicts.join(", ")
                          : d.compatibility === "with-adaptation"
                            ? "Needs adaptation"
                            : "Compatible"
                      }
                    >
                      {d.memberName}: {d.compatibility === "direct"
                        ? "compatible"
                        : d.compatibility === "with-adaptation"
                          ? "needs adaptation"
                          : "conflict"}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {selectedExplanation && (
            <div data-testid="meal-explanation">
              <h3>Why this meal?</h3>
              <p>{selectedExplanation.summary}</p>
              {selectedExplanation.tradeOffs.length > 0 && (
                <div data-testid="trade-offs">
                  <h4>Trade-offs</h4>
                  {selectedExplanation.tradeOffs.map((t, i) => {
                    const isConflict = t.includes("conflict") || t.includes("(hard-no") || t.includes("(not baby");
                    const isExtraPrep = t.includes("Extra prep");
                    const isSafeFood = t.includes("no safe food");
                    let bg = "#e2e3e5";
                    let color = "#383d41";
                    if (isConflict) { bg = "#f8d7da"; color = "#721c24"; }
                    else if (isSafeFood) { bg = "#fff3cd"; color = "#856404"; }
                    else if (isExtraPrep) { bg = "#fff3cd"; color = "#856404"; }
                    return (
                      <span
                        key={i}
                        data-testid={`trade-off-${i}`}
                        style={{
                          ...chipStyle(bg, color),
                          display: "inline-block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <h3>Shared base</h3>
          <ul>
            {selectedMeal.components.map((c, i) => {
              const ing = household.ingredients.find(
                (ing) => ing.id === c.ingredientId,
              );
              return (
                <li key={i}>
                  {ing ? ing.name : c.ingredientId} ({c.role}
                  {c.quantity ? `, ${c.quantity}` : ""})
                </li>
              );
            })}
          </ul>

          <h3>Per-person assembly</h3>
          {variants.map((variant) => {
            const member = household.members.find(
              (m) => m.id === variant.memberId,
            );
            if (!member) return null;
            return (
              <div
                key={variant.id}
                data-testid={`variant-${member.id}`}
              >
                <h4>
                  {member.name} ({member.role})
                  {variant.requiresExtraPrep && " — extra prep needed"}
                </h4>
                {variant.safeFoodIncluded && (
                  <p>Safe food included</p>
                )}
                <ul>
                  {variant.instructions.map((instr, i) => (
                    <li key={i}>{instr}</li>
                  ))}
                </ul>
                <Link
                  to={`/household/${householdId}/member/${member.id}?returnTo=/household/${householdId}/planner`}
                >
                  Quick edit {member.name}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => navigate(`/household/${householdId}`)}
        >
          Back to household
        </button>
      </div>
    </div>
  );
}
