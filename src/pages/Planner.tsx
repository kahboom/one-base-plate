import { useEffect, useState, useCallback, useMemo } from "react";
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
import { PageShell, PageHeader, Card, Button, Chip, Section, EmptyState } from "../components/ui";

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

  const selectedMeal: BaseMeal | undefined = household?.baseMeals.find(
    (m) => m.id === selectedMealId,
  );

  const mealOverlaps = useMemo(() => {
    if (!household) return new Map<string, OverlapResult>();
    const map = new Map<string, OverlapResult>();
    for (const meal of household.baseMeals) {
      map.set(
        meal.id,
        computeMealOverlap(meal, household.members, household.ingredients),
      );
    }
    return map;
  }, [household]);

  const rankedMeals = useMemo(() => {
    if (!household) return [];
    return [...household.baseMeals].sort((a, b) => {
      const overlapA = mealOverlaps.get(a.id);
      const overlapB = mealOverlaps.get(b.id);
      return (overlapB?.score ?? 0) - (overlapA?.score ?? 0);
    });
  }, [household, mealOverlaps]);

  const selectedOverlap = selectedMealId
    ? mealOverlaps.get(selectedMealId)
    : undefined;

  const selectedExplanation = useMemo<MealExplanation | undefined>(() =>
    selectedMeal && household
      ? generateMealExplanation(
          selectedMeal,
          household.members,
          household.ingredients,
        )
      : undefined,
  [selectedMeal, household]);

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

  return (
    <PageShell>
      <PageHeader title="Meal Planner" subtitle={`Household: ${household.name}`} />

      {household.baseMeals.length === 0 ? (
        <EmptyState>No base meals available. Add meals first.</EmptyState>
      ) : (
        <Section title="Choose a meal">
          <div data-testid="meal-card-grid" className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {rankedMeals.map((meal) => {
              const overlap = mealOverlaps.get(meal.id);
              const isSelected = meal.id === selectedMealId;
              return (
                <div
                  key={meal.id}
                  className={`cursor-pointer rounded-lg transition-all ${isSelected ? "outline-2 outline-brand" : ""}`}
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
        </Section>
      )}

      {selectedMeal && (
        <Card data-testid="meal-plan" className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-text-primary">{selectedMeal.name}</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Prep: {selectedMeal.defaultPrep} | Time: {selectedMeal.estimatedTimeMinutes} min | Difficulty: {selectedMeal.difficulty}
          </p>

          {selectedOverlap && (
            <div data-testid="overlap-summary" className="mb-4">
              <p className="mb-2 text-sm font-medium text-text-primary">
                Overlap: {selectedOverlap.score}/{selectedOverlap.total} members compatible
              </p>
              <div data-testid="overlap-indicators" className="flex flex-wrap gap-1">
                {selectedOverlap.memberDetails.map((d) => {
                  const variant =
                    d.compatibility === "direct" ? "success"
                    : d.compatibility === "with-adaptation" ? "warning"
                    : "danger";
                  return (
                    <Chip
                      key={d.memberId}
                      data-testid={`overlap-${d.memberId}`}
                      variant={variant as "success" | "warning" | "danger"}
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
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}

          {selectedExplanation && (
            <div data-testid="meal-explanation" className="mb-4">
              <h3 className="mb-1 text-base font-semibold text-text-primary">Why this meal?</h3>
              <p className="mb-2 text-sm text-text-secondary">{selectedExplanation.summary}</p>
              {selectedExplanation.tradeOffs.length > 0 && (
                <div data-testid="trade-offs">
                  <h4 className="mb-1 text-sm font-semibold text-text-primary">Trade-offs</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedExplanation.tradeOffs.map((t, i) => {
                      const isConflict = t.includes("conflict") || t.includes("(hard-no") || t.includes("(not baby");
                      const isExtraPrep = t.includes("Extra prep");
                      const isSafeFood = t.includes("no safe food");
                      let variant: "danger" | "warning" | "neutral" = "neutral";
                      if (isConflict) variant = "danger";
                      else if (isSafeFood || isExtraPrep) variant = "warning";
                      return (
                        <Chip key={i} data-testid={`trade-off-${i}`} variant={variant}>
                          {t}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <Section title="Shared base">
            <ul className="mb-4 space-y-1 pl-5 text-sm">
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
          </Section>

          <Section title="Per-person assembly">
            {variants.map((variant) => {
              const member = household.members.find(
                (m) => m.id === variant.memberId,
              );
              if (!member) return null;
              return (
                <div
                  key={variant.id}
                  data-testid={`variant-${member.id}`}
                  className="mb-4 rounded-sm border border-border-light p-3"
                >
                  <h4 className="mb-1 text-sm font-semibold text-text-primary">
                    {member.name} ({member.role})
                    {variant.requiresExtraPrep && (
                      <Chip variant="warning" className="ml-2">extra prep needed</Chip>
                    )}
                  </h4>
                  {variant.safeFoodIncluded && (
                    <p className="mb-1 text-xs text-success">Safe food included</p>
                  )}
                  <ul className="mb-2 space-y-0.5 pl-5 text-sm">
                    {variant.instructions.map((instr, i) => (
                      <li key={i}>{instr}</li>
                    ))}
                  </ul>
                  <Link
                    to={`/household/${householdId}/member/${member.id}?returnTo=/household/${householdId}/planner`}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Quick edit {member.name}
                  </Link>
                </div>
              );
            })}
          </Section>
        </Card>
      )}

      <Button onClick={() => navigate(`/household/${householdId}`)}>
        Back to household
      </Button>
    </PageShell>
  );
}
