import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Household, DayPlan, MealOutcome } from '../types';
import { loadHousehold, saveHousehold } from '../storage';
import {
  computeMealOverlap,
  computeOutcomeScore,
  learnCompatibilityPatterns,
  computePatternScore,
} from '../planner';
import MealCard from '../components/MealCard';
import { PageHeader, Card, Section, Button, Chip } from '../components/ui';
import GuidedTour from '../components/GuidedTour';
import AppModal from '../components/AppModal';
import { MealDetailContent } from './MealDetail';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const outcomeLabels: Record<string, string> = {
  success: 'Worked well',
  partial: 'Partly worked',
  failure: "Didn't work",
};
const outcomeChipVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  success: 'success',
  partial: 'warning',
  failure: 'danger',
};

export default function Home() {
  const { householdId } = useParams<{ householdId: string }>();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) setHousehold(h);
    setLoaded(true);
  }, [householdId]);

  const patterns = useMemo(() => {
    if (!household) return undefined;
    const outcomes = household.mealOutcomes ?? [];
    if (outcomes.length === 0) return undefined;
    return learnCompatibilityPatterns(
      outcomes,
      household.baseMeals,
      household.members,
      household.ingredients,
    );
  }, [household]);

  const topMeals = useMemo(() => {
    if (!household) return [];
    const outcomes = household.mealOutcomes ?? [];
    return [...household.baseMeals]
      .map((meal) => ({
        meal,
        overlap: computeMealOverlap(meal, household.members, household.ingredients),
        outcomeScore: computeOutcomeScore(meal.id, outcomes).score,
        patternScore: patterns
          ? computePatternScore(meal, patterns, household.members, household.ingredients)
          : 0,
      }))
      .sort(
        (a, b) =>
          b.overlap.score +
          b.outcomeScore +
          b.patternScore -
          (a.overlap.score + a.outcomeScore + a.patternScore),
      )
      .slice(0, 3);
  }, [household, patterns]);

  const pinnedMeals = useMemo(() => {
    if (!household) return [];
    const pinnedIds = household.pinnedMealIds ?? [];
    return household.baseMeals.filter((m) => pinnedIds.includes(m.id));
  }, [household]);

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
  if (!household) return <p>Household not found.</p>;

  const latestPlan =
    household.weeklyPlans.length > 0
      ? household.weeklyPlans[household.weeklyPlans.length - 1]!
      : null;

  const selectedMeal = selectedMealId
    ? household.baseMeals.find((meal) => meal.id === selectedMealId)
    : null;
  const selectedMealOverlap = selectedMeal
    ? computeMealOverlap(selectedMeal, household.members, household.ingredients)
    : null;

  const selectedDayName = selectedDayIndex !== null ? FULL_DAY_LABELS[selectedDayIndex] : null;
  const selectedDayPlan: DayPlan | null =
    selectedDayName && latestPlan
      ? (latestPlan.days.find((day) => day.day === selectedDayName) ?? null)
      : null;
  const selectedDayOutcome: MealOutcome | undefined =
    selectedDayName && selectedDayPlan
      ? (household.mealOutcomes ?? []).find(
          (outcome) =>
            outcome.day === selectedDayName && outcome.baseMealId === selectedDayPlan.baseMealId,
        )
      : undefined;

  function getMealName(mealId: string): string {
    return household?.baseMeals.find((m) => m.id === mealId)?.name ?? '';
  }

  function handleTogglePinFromModal() {
    if (!selectedMeal) return;
    handleTogglePin(selectedMeal.id);
  }

  return (
    <>
      <GuidedTour />
      <PageHeader title="What should we eat tonight?" />

      {household.members.length > 0 && (
        <Section>
          <h2 className="mb-2 text-lg font-semibold text-text-primary">Household members</h2>
          <div className="flex flex-wrap gap-2" data-testid="household-members">
            {household.members.map((m) => (
              <Link
                key={m.id}
                to={`/household/${householdId}/member/${m.id}`}
                className="rounded-full bg-surface border border-border-light px-3 py-1.5 text-sm text-text-primary hover:border-brand hover:bg-bg"
              >
                {m.name || 'Unnamed'} <span className="text-text-muted">({m.role})</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {latestPlan && (
        <Section>
          <div data-testid="weekly-strip">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">This week</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DAY_LABELS.map((label, i) => {
                const dayName = FULL_DAY_LABELS[i]!;
                const dayPlan = latestPlan.days.find((day) => day.day === dayName);
                return (
                  <button
                    type="button"
                    key={label}
                    data-testid={`strip-${label.toLowerCase()}`}
                    className="min-w-[80px] flex-shrink-0 rounded-md border border-border-light bg-surface px-2 py-3 text-center shadow-card cursor-pointer hover:border-brand"
                    onClick={() => setSelectedDayIndex(i)}
                  >
                    <strong className="text-sm font-semibold text-text-primary">{label}</strong>
                    <p className="mt-1 text-xs text-text-secondary">
                      {dayPlan ? getMealName(dayPlan.baseMealId) || 'Planned' : '\u2014'}
                    </p>
                  </button>
                );
              })}
            </div>
            <Link
              to={`/household/${householdId}/weekly`}
              className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
            >
              View full plan
            </Link>
          </div>
        </Section>
      )}

      {!latestPlan && household.baseMeals.length > 0 && (
        <Section>
          <div
            data-testid="no-plan-prompt"
            className="rounded-md border border-dashed border-border-default bg-bg p-6 text-center"
          >
            <p className="mb-2 text-text-muted">No plan for this week yet.</p>
            <Link
              to={`/household/${householdId}/weekly`}
              className="font-medium text-brand hover:underline"
            >
              Start planning
            </Link>
          </div>
        </Section>
      )}

      {household.baseMeals.length > 0 && (
        <Section>
          <Link to={`/household/${householdId}/rescue`} data-testid="rescue-mode-card">
            <Card className="cursor-pointer text-center hover:border-brand">
              <strong className="text-lg">Rescue mode</strong>
              <p className="mt-1 text-sm text-text-muted">
                Tough night? Get the fastest acceptable dinner.
              </p>
            </Card>
          </Link>
        </Section>
      )}

      {pinnedMeals.length > 0 && (
        <Section>
          <div data-testid="pinned-meals">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">Pinned rotation</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {pinnedMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  members={household.members}
                  ingredients={household.ingredients}
                  recipes={household.recipes ?? []}
                  outcomes={household.mealOutcomes ?? []}
                  pinned
                  onPin={() => handleTogglePin(meal.id)}
                  onDetailClick={() => setSelectedMealId(meal.id)}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      {topMeals.length > 0 && (
        <Section>
          <div data-testid="top-suggestions">
            <h2 className="mb-3 text-xl font-semibold text-text-primary">Top suggestions</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {topMeals.map(({ meal, overlap }) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  members={household.members}
                  ingredients={household.ingredients}
                  recipes={household.recipes ?? []}
                  overlap={overlap}
                  outcomes={household.mealOutcomes ?? []}
                  patterns={patterns}
                  pinned={(household.pinnedMealIds ?? []).includes(meal.id)}
                  onPin={() => handleTogglePin(meal.id)}
                  onDetailClick={() => setSelectedMealId(meal.id)}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      <AppModal
        open={selectedDayIndex !== null}
        onClose={() => setSelectedDayIndex(null)}
        ariaLabel="Day details"
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-6"
      >
        <div data-testid="day-details-modal">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">
              {selectedDayIndex !== null ? `${DAY_LABELS[selectedDayIndex]} plan` : 'Day plan'}
            </h2>
            <Button
              variant="ghost"
              onClick={() => setSelectedDayIndex(null)}
              aria-label="Close modal"
            >
              ✕
            </Button>
          </div>
          {!selectedDayPlan ? (
            <p className="text-sm text-text-muted">No meal is planned for this day.</p>
          ) : (
            <>
              <p className="text-base font-semibold text-text-primary">
                {getMealName(selectedDayPlan.baseMealId) || 'Planned meal'}
              </p>
              {selectedDayOutcome && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">Outcome:</span>
                  <Chip variant={outcomeChipVariant[selectedDayOutcome.outcome]}>
                    {outcomeLabels[selectedDayOutcome.outcome]}
                  </Chip>
                </div>
              )}
              <Section title="Per-member assembly" className="mt-4 mb-0">
                <div className="space-y-3" data-testid="day-modal-variants">
                  {selectedDayPlan.variants.map((variant) => {
                    const member = household.members.find((m) => m.id === variant.memberId);
                    if (!member) return null;
                    return (
                      <Card key={variant.id}>
                        <p className="text-sm font-semibold text-text-primary">
                          {member.name} ({member.role})
                          {variant.requiresExtraPrep && ' — extra prep'}
                        </p>
                        <ul className="mt-2 space-y-1 pl-5 text-sm text-text-secondary">
                          {variant.instructions.map((instruction, idx) => (
                            <li key={idx}>{instruction}</li>
                          ))}
                        </ul>
                      </Card>
                    );
                  })}
                </div>
              </Section>
              <Section title="Notes" className="mb-0">
                <p
                  className="text-sm text-text-secondary whitespace-pre-wrap"
                  data-testid="day-modal-notes"
                >
                  {selectedDayOutcome?.notes?.trim()
                    ? selectedDayOutcome.notes
                    : 'No notes recorded for this day yet.'}
                </p>
              </Section>
            </>
          )}
        </div>
      </AppModal>

      <AppModal
        open={Boolean(selectedMeal)}
        onClose={() => setSelectedMealId(null)}
        ariaLabel="Meal details"
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-6"
      >
        <div data-testid="meal-details-modal">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">
              {selectedMeal?.name ?? 'Meal details'}
            </h2>
            <Button
              variant="ghost"
              onClick={() => setSelectedMealId(null)}
              aria-label="Close modal"
            >
              ✕
            </Button>
          </div>
          {selectedMeal && (
            <MealDetailContent
              meal={selectedMeal}
              household={household}
              overlapLabel={`${selectedMealOverlap?.score ?? 0}/${selectedMealOverlap?.total ?? 0}`}
              isPinned={(household.pinnedMealIds ?? []).includes(selectedMeal.id)}
              onTogglePin={handleTogglePinFromModal}
            />
          )}
        </div>
      </AppModal>
    </>
  );
}
