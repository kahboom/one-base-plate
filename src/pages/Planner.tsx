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
        <div>
          <label>
            Select a base meal:{" "}
            <select
              value={selectedMealId}
              onChange={(e) => handleSelectMeal(e.target.value)}
            >
              <option value="">Choose a meal</option>
              {rankedMeals.map((meal) => {
                const overlap = mealOverlaps.get(meal.id);
                return (
                  <option key={meal.id} value={meal.id}>
                    {meal.name} ({overlap?.score ?? 0}/{overlap?.total ?? 0} overlap)
                  </option>
                );
              })}
            </select>
          </label>
        </div>
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
              <ul>
                {selectedOverlap.memberDetails.map((d) => (
                  <li key={d.memberId} data-testid={`overlap-${d.memberId}`}>
                    {d.memberName}: {d.compatibility === "direct"
                      ? "compatible"
                      : d.compatibility === "with-adaptation"
                        ? "compatible with adaptation"
                        : `conflict — ${d.conflicts.join(", ")}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedExplanation && (
            <div data-testid="meal-explanation">
              <h3>Why this meal?</h3>
              <p>{selectedExplanation.summary}</p>
              {selectedExplanation.tradeOffs.length > 0 && (
                <>
                  <h4>Trade-offs</h4>
                  <ul>
                    {selectedExplanation.tradeOffs.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </>
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
