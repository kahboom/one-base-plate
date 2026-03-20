import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import type { BaseMeal, AssemblyVariant, Household } from "../types";
import { loadHousehold, saveHousehold, toSentenceCase } from "../storage";
import {
  generateAssemblyVariants,
  computeMealOverlap,
  generateMealExplanation,
  rankWeeklySuggestedMeals,
  learnCompatibilityPatterns,
} from "../planner";
import type { MealExplanation, LearnedPatterns } from "../planner";
import MealCard from "../components/MealCard";
import BrowseMealsModal from "../components/planner/BrowseMealsModal";
import { useSuggestedTrayCap } from "../hooks/useSuggestedTrayCap";
import { PageHeader, Card, Chip, Section, EmptyState, Button } from "../components/ui";

export default function Planner() {
  const { householdId } = useParams<{ householdId: string }>();
  const [household, setHousehold] = useState<Household | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string>("");
  const [variants, setVariants] = useState<AssemblyVariant[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [browseMealsOpen, setBrowseMealsOpen] = useState(false);
  const trayCap = useSuggestedTrayCap();

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

  const suggestionRows = useMemo(() => {
    if (!household || household.baseMeals.length === 0) return [];
    return rankWeeklySuggestedMeals(
      household.baseMeals,
      household.members,
      household.ingredients,
      household.mealOutcomes ?? [],
      household.pinnedMealIds ?? [],
      [],
    );
  }, [household]);

  const trayRows = useMemo(
    () => suggestionRows.slice(0, trayCap),
    [suggestionRows, trayCap],
  );

  const patterns = useMemo<LearnedPatterns | undefined>(() => {
    if (!household) return undefined;
    const outcomes = household.mealOutcomes ?? [];
    if (outcomes.length === 0) return undefined;
    return learnCompatibilityPatterns(outcomes, household.baseMeals, household.members, household.ingredients);
  }, [household]);

  const selectedOverlap = useMemo(() => {
    if (!selectedMealId || !household) return undefined;
    const row = suggestionRows.find((r) => r.meal.id === selectedMealId);
    if (row) return row.overlap;
    const meal = household.baseMeals.find((m) => m.id === selectedMealId);
    if (!meal) return undefined;
    return computeMealOverlap(meal, household.members, household.ingredients);
  }, [selectedMealId, household, suggestionRows]);

  const selectedExplanation = useMemo<MealExplanation | undefined>(() =>
    selectedMeal && household
      ? generateMealExplanation(
          selectedMeal,
          household.members,
          household.ingredients,
          household.mealOutcomes ?? [],
          patterns,
        )
      : undefined,
  [selectedMeal, household, patterns]);

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

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

  const totalMeals = household.baseMeals.length;

  return (
    <>
      <PageHeader
        title="Meal Planner"
        subtitle={`Household: ${household.name}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      {totalMeals === 0 ? (
        <EmptyState>
          No base meals available.{" "}
          <Link to={`/household/${householdId}/ingredients`} className="font-medium text-brand hover:underline">Add ingredients</Link>{" "}
          and{" "}
          <Link to={`/household/${householdId}/meals`} className="font-medium text-brand hover:underline">add base meals</Link>{" "}
          to get started.
        </EmptyState>
      ) : (
        <Section>
          <div data-testid="meal-planner-suggested" className="mt-2">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Suggested meals</h2>
                <p className="mt-1 text-sm text-text-secondary" data-testid="meal-planner-tray-summary" aria-live="polite">
                  Top {trayRows.length} of {totalMeals} meal{totalMeals !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                type="button"
                data-testid="meal-planner-browse-all-btn"
                onClick={() => setBrowseMealsOpen(true)}
              >
                Browse all meals
              </Button>
            </div>
            <div
              data-testid="meal-card-grid"
              className="mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] sm:grid sm:snap-none sm:overflow-visible sm:pb-0 sm:grid-cols-3 lg:grid-cols-4"
            >
              {trayRows.map(({ meal, overlap }) => {
                const isSelected = meal.id === selectedMealId;
                return (
                  <div
                    key={meal.id}
                    className={`flex h-full min-h-0 min-w-[min(260px,85vw)] max-w-[min(260px,85vw)] shrink-0 snap-start flex-col sm:min-w-0 sm:max-w-none cursor-pointer rounded-lg transition-all ${
                      isSelected ? "outline-2 outline-brand outline-offset-2" : ""
                    }`}
                    onClick={() => handleSelectMeal(meal.id)}
                    data-testid={`selectable-${meal.id}`}
                  >
                    <MealCard
                      meal={meal}
                      members={household.members}
                      ingredients={household.ingredients}
                      overlap={overlap}
                      outcomes={household.mealOutcomes ?? []}
                      patterns={patterns}
                      pinned={(household.pinnedMealIds ?? []).includes(meal.id)}
                      onPin={() => handleTogglePin(meal.id)}
                      onOpen={() => handleSelectMeal(meal.id)}
                      detailUrl={`/household/${householdId}/meal/${meal.id}`}
                      compact
                      showActionsWhenCompact
                      selected={isSelected}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {household && totalMeals > 0 && (
        <BrowseMealsModal
          open={browseMealsOpen}
          onClose={() => setBrowseMealsOpen(false)}
          rows={suggestionRows}
          renderMealCard={({ meal, overlap }) => {
            const isSelected = meal.id === selectedMealId;
            return (
              <div
                className={`cursor-pointer rounded-lg transition-all ${
                  isSelected ? "outline-2 outline-brand outline-offset-2" : ""
                }`}
                onClick={() => handleSelectMeal(meal.id)}
                data-testid={`browse-selectable-${meal.id}`}
              >
                <MealCard
                  meal={meal}
                  members={household.members}
                  ingredients={household.ingredients}
                  overlap={overlap}
                  outcomes={household.mealOutcomes ?? []}
                  patterns={patterns}
                  pinned={(household.pinnedMealIds ?? []).includes(meal.id)}
                  onPin={() => handleTogglePin(meal.id)}
                  onOpen={() => handleSelectMeal(meal.id)}
                  detailUrl={`/household/${householdId}/meal/${meal.id}`}
                  compact
                  showActionsWhenCompact
                  selected={isSelected}
                />
              </div>
            );
          }}
        />
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
                    {ing ? toSentenceCase(ing.name) : c.ingredientId} ({c.role}
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
                    to={`/household/${householdId}/member/${member.id}`}
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
    </>
  );
}
