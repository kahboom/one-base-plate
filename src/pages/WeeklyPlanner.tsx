import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import type {
  Household,
  WeeklyPlan,
  DayPlan,
  BaseMeal,
  MealOutcome,
  MealOutcomeResult,
  ComponentRecipeRef,
  WeeklyAnchor,
} from '../types';
import { loadHousehold, saveHousehold } from '../storage';
import {
  generateWeeklyPlan,
  computeMealOverlap,
  generateAssemblyVariants,
  computeWeekEffortBalance,
  computeGroceryPreview,
  formatPlanForExport,
  rankWeeklySuggestedMeals,
  learnCompatibilityPatterns,
} from '../planner';
import type { LearnedPatterns } from '../planner';
import MealCard from '../components/MealCard';
import BrowseMealsModal from '../components/planner/BrowseMealsModal';
import { useSuggestedTrayCap } from '../hooks/useSuggestedTrayCap';
import { PageHeader, Button, Select, Section, EmptyState, Chip, Input } from '../components/ui';
import { getWeeklyAnchorForWeekday } from '../lib/weeklyPlanOps';
import {
  countMealRecipes,
  hasBatchPrepRecipe,
  hasPrepAheadRecipe,
  findPrepAheadOpportunities,
} from '../lib/componentRecipes';
import WeeklyThemeNightsCollapsible from '../components/WeeklyThemeNightsCollapsible';
import AppModal from '../components/AppModal';
import { MealDetailContent } from './MealDetail';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeeklyPlanner() {
  const { householdId } = useParams<{ householdId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [household, setHousehold] = useState<Household | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [numDays, setNumDays] = useState(7);
  const [loaded, setLoaded] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [browseMealsOpen, setBrowseMealsOpen] = useState(false);
  const [mealDetailModalId, setMealDetailModalId] = useState<string | null>(null);
  const processedNavState = useRef(false);
  const trayCap = useSuggestedTrayCap();

  async function handleShare() {
    if (!shareRef.current || !plan || plan.days.length === 0) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const file = new File(
        [blob],
        `meal-plan-${household?.name.toLowerCase().replace(/\s+/g, '-') ?? 'plan'}.png`,
        {
          type: 'image/png',
        },
      );

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Weekly Meal Plan' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // user cancelled share or html2canvas failed
    } finally {
      setSharing(false);
    }
  }

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

  const assignMealToDay = useCallback(
    (mealId: string, dayLabel: string, componentRecipeOverrides?: ComponentRecipeRef[]) => {
      if (!household) return;
      const meal = household.baseMeals.find((m) => m.id === mealId);
      if (!meal) return;

      const variants = generateAssemblyVariants(meal, household.members, household.ingredients);
      const newDayPlan: DayPlan = {
        day: dayLabel,
        baseMealId: mealId,
        variants,
        ...(componentRecipeOverrides?.length ? { componentRecipeOverrides } : {}),
      };

      setPlan((prev) => {
        const existingDays = prev?.days ?? [];
        const filtered = existingDays.filter((d) => d.day !== dayLabel);
        const updatedDays = [...filtered, newDayPlan];
        return {
          id: prev?.id ?? crypto.randomUUID(),
          days: updatedDays,
          selectedBaseMeals: [...new Set(updatedDays.map((d) => d.baseMealId))],
          generatedGroceryList: prev?.generatedGroceryList ?? [],
          notes: prev?.notes ?? '',
        };
      });

      setSelectedMealId(null);
    },
    [household],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    processedNavState.current = false;
  }, [householdId]);

  useEffect(() => {
    if (!household || processedNavState.current) return;
    const st = location.state as {
      preselectAssignMealId?: string;
      assignComponentOverrides?: ComponentRecipeRef[];
      assignTargetDay?: string;
    } | null;
    if (!st?.preselectAssignMealId || !st.assignTargetDay) return;
    processedNavState.current = true;
    assignMealToDay(st.preselectAssignMealId, st.assignTargetDay, st.assignComponentOverrides);
    navigate(location.pathname, { replace: true, state: {} });
  }, [household, location.state, location.pathname, navigate, assignMealToDay]);

  function handleGenerate() {
    if (!household) return;

    const days = generateWeeklyPlan(
      household.baseMeals,
      household.members,
      household.ingredients,
      numDays,
      household.pinnedMealIds ?? [],
      household.mealOutcomes ?? [],
    );

    const newPlan: WeeklyPlan = {
      id: crypto.randomUUID(),
      days,
      selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
      generatedGroceryList: [],
      notes: '',
    };

    setPlan(newPlan);
  }

  function handleClearDay(dayIndex: number) {
    if (!plan) return;
    const updatedDays = plan.days.filter((_, i) => i !== dayIndex);
    setPlan({ ...plan, days: updatedDays });
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

  function persistWeeklyAnchors(anchors: WeeklyAnchor[]) {
    if (!household) return;
    const updatedHousehold = { ...household, weeklyAnchors: anchors };
    saveHousehold(updatedHousehold);
    setHousehold(updatedHousehold);
  }

  function handleSave() {
    if (!household || !plan) return;

    const existingIndex = household.weeklyPlans.findIndex((p) => p.id === plan.id);
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

  function recordOutcome(
    baseMealId: string,
    day: string,
    outcome: MealOutcomeResult,
    notes: string,
  ) {
    if (!household) return;
    const newOutcome: MealOutcome = {
      id: crypto.randomUUID(),
      baseMealId,
      day,
      outcome,
      notes,
      date: new Date().toISOString().slice(0, 10),
    };
    const existing = household.mealOutcomes ?? [];
    const updatedHousehold = { ...household, mealOutcomes: [...existing, newOutcome] };
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
    if (!household) return '';
    const meal = household.baseMeals.find((m) => m.id === mealId);
    if (!meal) return '';
    const overlap = computeMealOverlap(meal, household.members, household.ingredients);
    return `${overlap.score}/${overlap.total}`;
  }

  const themeAnchor = useMemo(() => {
    if (!household) return null;
    return getWeeklyAnchorForWeekday(household, DAY_LABELS[0]!) ?? null;
  }, [household]);

  const suggestionRows = useMemo(() => {
    if (!household || household.baseMeals.length === 0) return [];
    return rankWeeklySuggestedMeals(
      household.baseMeals,
      household.members,
      household.ingredients,
      household.mealOutcomes ?? [],
      household.pinnedMealIds ?? [],
      plan?.days ?? [],
      themeAnchor,
    );
  }, [household, plan?.days, themeAnchor]);

  const learnedPatterns: LearnedPatterns | undefined = useMemo(() => {
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

  const trayRows = useMemo(() => suggestionRows.slice(0, trayCap), [suggestionRows, trayCap]);

  const mealDetailModalMeal = useMemo(() => {
    if (!household || !mealDetailModalId) return null;
    return household.baseMeals.find((m) => m.id === mealDetailModalId) ?? null;
  }, [household, mealDetailModalId]);

  const mealDetailModalOverlap = useMemo(() => {
    if (!household || !mealDetailModalMeal) return null;
    return computeMealOverlap(mealDetailModalMeal, household.members, household.ingredients);
  }, [household, mealDetailModalMeal]);

  function handleTogglePinFromDetailModal() {
    if (!mealDetailModalMeal) return;
    handleTogglePin(mealDetailModalMeal.id);
  }

  function getSuggestedMeal(dayLabel: string): BaseMeal | null {
    if (suggestionRows.length === 0) return null;
    const index = DAY_LABELS.indexOf(dayLabel) % suggestionRows.length;
    return suggestionRows[index]?.meal ?? null;
  }

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

  const daySlots = DAY_LABELS.slice(0, numDays);

  return (
    <>
      <PageHeader
        title="Weekly Planner"
        subtitle={`Household: ${household.name}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      {household.baseMeals.length === 0 ? (
        <EmptyState>
          No base meals available.{' '}
          <Link
            to={`/household/${householdId}/ingredients`}
            className="font-medium text-brand hover:underline"
          >
            Add ingredients
          </Link>{' '}
          and{' '}
          <Link
            to={`/household/${householdId}/meals`}
            className="font-medium text-brand hover:underline"
          >
            add base meals
          </Link>{' '}
          before generating a plan.
        </EmptyState>
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

      <div ref={shareRef}>
        {plan &&
          plan.days.length > 0 &&
          household &&
          (() => {
            const balance = computeWeekEffortBalance(plan.days, household.baseMeals);
            const groceryPreview = computeGroceryPreview(
              plan.days,
              household.baseMeals,
              household.ingredients,
            );
            return (
              <div
                data-testid="effort-balance"
                className="mt-4 mb-4 rounded-md border border-border-light bg-surface p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-semibold text-text-primary">Week effort</span>
                  <span className="text-sm text-text-secondary" data-testid="total-prep-time">
                    {balance.totalPrepMinutes} min total
                  </span>
                  <div className="flex gap-2">
                    {balance.effortCounts.easy > 0 && (
                      <Chip variant="success" data-testid="effort-easy">
                        {balance.effortCounts.easy} easy
                      </Chip>
                    )}
                    {balance.effortCounts.medium > 0 && (
                      <Chip variant="warning" data-testid="effort-medium">
                        {balance.effortCounts.medium} medium
                      </Chip>
                    )}
                    {balance.effortCounts.hard > 0 && (
                      <Chip variant="danger" data-testid="effort-hard">
                        {balance.effortCounts.hard} hard
                      </Chip>
                    )}
                  </div>
                  {balance.highEffortDays.length > 0 && (
                    <span className="text-xs text-text-muted" data-testid="high-effort-warning">
                      Higher effort: {balance.highEffortDays.join(', ')}
                    </span>
                  )}
                </div>
                {groceryPreview.uniqueIngredientCount > 0 && (
                  <div
                    className="mt-3 flex flex-wrap items-center gap-3 border-t border-border-light pt-3"
                    data-testid="grocery-preview"
                  >
                    <span className="text-sm font-semibold text-text-primary">Grocery preview</span>
                    <span className="text-sm text-text-secondary" data-testid="grocery-count">
                      {groceryPreview.uniqueIngredientCount} ingredient
                      {groceryPreview.uniqueIngredientCount !== 1 ? 's' : ''}
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
                {(() => {
                  const prepOps = findPrepAheadOpportunities(
                    plan.days,
                    household.baseMeals,
                    household.recipes ?? [],
                    household.ingredients,
                  );
                  if (prepOps.length === 0) return null;
                  return (
                    <div
                      className="mt-3 border-t border-border-light pt-3"
                      data-testid="prep-ahead-opportunities"
                    >
                      <span className="text-sm font-semibold text-text-primary">
                        Prep-ahead opportunities
                      </span>
                      <div className="mt-1 space-y-1">
                        {prepOps.map((op) => (
                          <p
                            key={op.ingredientId}
                            className="text-xs text-text-secondary"
                            data-testid={`prep-ahead-${op.ingredientId}`}
                          >
                            <span className="font-medium">{op.ingredientName}</span> appears on{' '}
                            {op.dayLabels.join(', ')}
                            {op.recipeName && (
                              <>
                                {' '}
                                &mdash; batch-prep recipe:{' '}
                                <span className="text-brand">{op.recipeName}</span>
                              </>
                            )}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

        <div
          data-testid="day-cards"
          className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {daySlots.map((dayLabel) => {
            const dayIndex = plan?.days.findIndex((d) => d.day === dayLabel) ?? -1;
            const dayPlan = dayIndex >= 0 ? plan!.days[dayIndex]! : null;
            const suggested = !dayPlan ? getSuggestedMeal(dayLabel) : null;
            const dayTheme = getWeeklyAnchorForWeekday(household, dayLabel);

            return (
              <DayCard
                key={dayLabel}
                dayLabel={dayLabel}
                dayTheme={dayTheme}
                dayPlan={dayPlan}
                dayIndex={dayIndex}
                suggestedMeal={suggested}
                mealName={dayPlan ? getMealName(dayPlan.baseMealId) : null}
                overlapLabel={dayPlan ? getMealOverlapLabel(dayPlan.baseMealId) : null}
                meal={dayPlan ? getMeal(dayPlan.baseMealId) : undefined}
                household={household}
                existingOutcome={(household.mealOutcomes ?? []).find(
                  (o) => o.baseMealId === dayPlan?.baseMealId && o.day === dayLabel,
                )}
                onRecordOutcome={(outcome, notes) => {
                  if (dayPlan) recordOutcome(dayPlan.baseMealId, dayLabel, outcome, notes);
                }}
                onClear={dayIndex >= 0 ? () => handleClearDay(dayIndex) : undefined}
                onDrop={(mealId) => assignMealToDay(mealId, dayLabel)}
                isAssignTarget={selectedMealId !== null}
                onTapAssign={() => {
                  if (selectedMealId) assignMealToDay(selectedMealId, dayLabel);
                }}
                onOpenSuggestedMealDetails={(mealId) => setMealDetailModalId(mealId)}
                onAddSuggestedMeal={(mealId) => assignMealToDay(mealId, dayLabel)}
              />
            );
          })}
        </div>
      </div>

      {plan && (
        <div data-testid="weekly-plan" className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={handleSave} data-testid="save-plan-btn">
            Save plan
          </Button>
          {plan.days.length > 0 && (
            <>
              <Button
                onClick={() => {
                  const text = formatPlanForExport(
                    plan.days,
                    household.baseMeals,
                    household.members,
                    household.ingredients,
                    household.name,
                  );
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `meal-plan-${household.name.toLowerCase().replace(/\s+/g, '-')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                data-testid="export-btn"
              >
                Export
              </Button>
              <Button onClick={() => window.print()} data-testid="print-btn">
                Print
              </Button>
              <Button onClick={handleShare} disabled={sharing} data-testid="share-btn">
                {sharing ? 'Sharing\u2026' : 'Share'}
              </Button>
            </>
          )}
        </div>
      )}

      {household.baseMeals.length > 0 && (
        <Section>
          <div data-testid="suggested-tray" className="mt-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Suggested meals</h2>
                <p
                  className="mt-1 text-sm text-text-secondary"
                  data-testid="suggested-tray-summary"
                  aria-live="polite"
                >
                  Top {trayRows.length} of {household.baseMeals.length} meal
                  {household.baseMeals.length !== 1 ? 's' : ''} for this week
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  data-testid="browse-all-meals-btn"
                  onClick={() => setBrowseMealsOpen(true)}
                >
                  Browse all meals
                </Button>
              </div>
            </div>
            {selectedMealId && (
              <p className="mb-3 text-sm text-brand font-medium" data-testid="assign-prompt">
                Tap a day to assign{' '}
                {household.baseMeals.find((m) => m.id === selectedMealId)?.name ?? 'meal'}.{' '}
                <button
                  type="button"
                  className="underline cursor-pointer"
                  onClick={() => setSelectedMealId(null)}
                >
                  Cancel
                </button>
              </p>
            )}
            <div
              data-testid="suggested-tray-default"
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] sm:grid sm:snap-none sm:overflow-visible sm:pb-0 sm:grid-cols-3 lg:grid-cols-4"
            >
              {trayRows.map(({ meal, overlap, themeMatch }) => (
                <div
                  key={meal.id}
                  className="flex h-full min-h-0 min-w-[min(260px,85vw)] max-w-[min(260px,85vw)] shrink-0 snap-start flex-col sm:min-w-0 sm:max-w-none"
                >
                  <MealCard
                    meal={meal}
                    members={household.members}
                    ingredients={household.ingredients}
                    recipes={household.recipes ?? []}
                    overlap={overlap}
                    outcomes={household.mealOutcomes ?? []}
                    patterns={learnedPatterns}
                    onDetailClick={() => setMealDetailModalId(meal.id)}
                    compact
                    showActionsWhenCompact
                    draggable
                    selected={selectedMealId === meal.id}
                    pinned={(household.pinnedMealIds ?? []).includes(meal.id)}
                    onAssign={() => setSelectedMealId(selectedMealId === meal.id ? null : meal.id)}
                    onPin={() => handleTogglePin(meal.id)}
                    themeMatch={themeMatch}
                  />
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {household && (
        <BrowseMealsModal
          open={browseMealsOpen}
          onClose={() => setBrowseMealsOpen(false)}
          rows={suggestionRows}
          renderMealCard={({ meal, overlap, themeMatch }) => (
            <MealCard
              meal={meal}
              members={household.members}
              ingredients={household.ingredients}
              recipes={household.recipes ?? []}
              overlap={overlap}
              outcomes={household.mealOutcomes ?? []}
              patterns={learnedPatterns}
              onDetailClick={() => {
                setMealDetailModalId(meal.id);
                setBrowseMealsOpen(false);
              }}
              compact
              showActionsWhenCompact
              draggable
              selected={selectedMealId === meal.id}
              pinned={(household.pinnedMealIds ?? []).includes(meal.id)}
              onAssign={() => setSelectedMealId(selectedMealId === meal.id ? null : meal.id)}
              onPin={() => handleTogglePin(meal.id)}
              themeMatch={themeMatch}
            />
          )}
        />
      )}

      <AppModal
        open={Boolean(mealDetailModalMeal)}
        onClose={() => setMealDetailModalId(null)}
        ariaLabel="Meal details"
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-6"
      >
        <div data-testid="meal-details-modal">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">
              {mealDetailModalMeal?.name ?? 'Meal details'}
            </h2>
            <Button
              variant="ghost"
              onClick={() => setMealDetailModalId(null)}
              aria-label="Close modal"
            >
              ✕
            </Button>
          </div>
          {mealDetailModalMeal && (
            <MealDetailContent
              meal={mealDetailModalMeal}
              household={household}
              overlapLabel={`${mealDetailModalOverlap?.score ?? 0}/${mealDetailModalOverlap?.total ?? 0}`}
              isPinned={(household.pinnedMealIds ?? []).includes(mealDetailModalMeal.id)}
              onTogglePin={handleTogglePinFromDetailModal}
            />
          )}
        </div>
      </AppModal>

      <div className="mt-6">
        <WeeklyThemeNightsCollapsible
          weeklyAnchors={household.weeklyAnchors ?? []}
          onPersist={persistWeeklyAnchors}
        />
      </div>
    </>
  );
}

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

const effortLabel: Record<string, string> = {
  easy: 'Low effort',
  medium: 'Medium effort',
  hard: 'Higher effort',
};

const effortChipVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'danger',
};

function DayCard({
  dayLabel,
  dayTheme,
  dayPlan,
  suggestedMeal,
  mealName,
  overlapLabel,
  meal,
  household,
  existingOutcome,
  onRecordOutcome,
  onClear,
  onDrop,
  isAssignTarget,
  onTapAssign,
  onOpenSuggestedMealDetails,
  onAddSuggestedMeal,
}: {
  dayLabel: string;
  dayTheme?: WeeklyAnchor;
  dayPlan: DayPlan | null;
  dayIndex: number;
  suggestedMeal: BaseMeal | null;
  mealName: string | null;
  overlapLabel: string | null;
  meal?: BaseMeal;
  household: Household;
  existingOutcome?: MealOutcome;
  onRecordOutcome?: (outcome: MealOutcomeResult, notes: string) => void;
  onClear?: () => void;
  onDrop?: (mealId: string) => void;
  isAssignTarget?: boolean;
  onTapAssign?: () => void;
  onOpenSuggestedMealDetails?: (mealId: string) => void;
  onAddSuggestedMeal?: (mealId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [justAssigned, setJustAssigned] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeSelection, setOutcomeSelection] = useState<MealOutcomeResult | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const justAssignedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showConfirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEmpty = !dayPlan;
  const isHighEffort = meal?.difficulty === 'hard';

  useEffect(() => {
    return () => {
      if (justAssignedTimeoutRef.current) clearTimeout(justAssignedTimeoutRef.current);
      if (showConfirmationTimeoutRef.current) clearTimeout(showConfirmationTimeoutRef.current);
    };
  }, []);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function triggerAssignFeedback() {
    if (justAssignedTimeoutRef.current) clearTimeout(justAssignedTimeoutRef.current);
    if (showConfirmationTimeoutRef.current) clearTimeout(showConfirmationTimeoutRef.current);
    setJustAssigned(true);
    setShowConfirmation(true);
    justAssignedTimeoutRef.current = setTimeout(() => {
      justAssignedTimeoutRef.current = null;
      setJustAssigned(false);
    }, 600);
    showConfirmationTimeoutRef.current = setTimeout(() => {
      showConfirmationTimeoutRef.current = null;
      setShowConfirmation(false);
    }, 800);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const mealId = e.dataTransfer.getData('application/meal-id');
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
      role={isAssignTarget ? 'button' : undefined}
      className={`relative rounded-md p-4 shadow-card transition-all duration-200 ${
        justAssigned
          ? 'border-2 border-brand bg-brand/5 scale-[1.02]'
          : dragOver
            ? 'border-2 border-brand border-dashed bg-brand/5'
            : isEmpty
              ? `border border-dashed bg-bg ${isAssignTarget ? 'border-brand cursor-pointer hover:bg-brand/5' : 'border-border-default'}`
              : `border bg-surface ${isAssignTarget ? 'border-brand cursor-pointer hover:bg-brand/5' : isHighEffort ? 'border-danger' : 'border-border-light'}`
      }`}
    >
      <strong className="text-base font-semibold text-text-primary">{dayLabel}</strong>
      {dayTheme && dayTheme.enabled !== false && (
        <p className="mt-1 text-xs text-text-muted" data-testid={`day-theme-line-${dayLabel}`}>
          {dayLabel} theme: {dayTheme.icon ? `${dayTheme.icon} ` : ''}
          {dayTheme.label}
        </p>
      )}

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
                <small
                  className="text-xs text-text-muted"
                  data-testid={`prep-time-${dayLabel.toLowerCase()}`}
                >
                  {meal.estimatedTimeMinutes} min
                </small>
                <Chip
                  variant={effortChipVariant[meal.difficulty] ?? 'neutral'}
                  data-testid={`effort-${dayLabel.toLowerCase()}`}
                >
                  {effortLabel[meal.difficulty] ?? meal.difficulty}
                </Chip>
              </>
            )}
            {meal &&
              (() => {
                const recipeCount = countMealRecipes(meal);
                const batchPrep = hasBatchPrepRecipe(meal, household.recipes ?? []);
                const prepAhead = hasPrepAheadRecipe(meal, household.recipes ?? []);
                if (recipeCount === 0 && !batchPrep && !prepAhead) return null;
                return (
                  <>
                    {recipeCount > 0 && (
                      <Chip
                        variant="neutral"
                        className="text-[10px]"
                        data-testid={`recipe-count-${dayLabel.toLowerCase()}`}
                      >
                        {recipeCount} recipe{recipeCount !== 1 ? 's' : ''}
                      </Chip>
                    )}
                    {prepAhead && (
                      <Chip
                        variant="info"
                        className="text-[10px]"
                        data-testid={`prep-ahead-chip-${dayLabel.toLowerCase()}`}
                      >
                        prep-ahead
                      </Chip>
                    )}
                    {batchPrep && (
                      <Chip
                        variant="info"
                        className="text-[10px]"
                        data-testid={`batch-prep-chip-${dayLabel.toLowerCase()}`}
                      >
                        batch-friendly
                      </Chip>
                    )}
                  </>
                );
              })()}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              small
              onClick={() => setExpanded(!expanded)}
              data-testid={`toggle-${dayLabel.toLowerCase()}`}
            >
              {expanded ? 'Hide details' : 'Show details'}
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
                const member = household.members.find((m) => m.id === variant.memberId);
                if (!member) return null;
                return (
                  <div key={variant.id} className="mt-2">
                    <em className="text-sm text-text-secondary">
                      {member.name} ({member.role})
                      {variant.requiresExtraPrep && ' \u2014 extra prep'}
                    </em>
                    <ul className="mt-1 space-y-0.5 pl-5">
                      {variant.instructions.map((instr, i) => (
                        <li key={i} className="text-xs">
                          {instr}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {existingOutcome ? (
                <div
                  className="mt-3 rounded-md border border-border-light bg-bg p-2"
                  data-testid={`outcome-${dayLabel.toLowerCase()}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-secondary">Outcome:</span>
                    <Chip variant={outcomeChipVariant[existingOutcome.outcome]}>
                      {outcomeLabels[existingOutcome.outcome]}
                    </Chip>
                  </div>
                  {existingOutcome.notes && (
                    <p className="mt-1 text-xs text-text-muted">{existingOutcome.notes}</p>
                  )}
                </div>
              ) : onRecordOutcome && !showOutcomeForm ? (
                <Button
                  small
                  className="mt-3"
                  onClick={() => setShowOutcomeForm(true)}
                  data-testid={`record-outcome-${dayLabel.toLowerCase()}`}
                >
                  Record outcome
                </Button>
              ) : null}

              {showOutcomeForm && !existingOutcome && onRecordOutcome && (
                <div
                  className="mt-3 rounded-md border border-border-light bg-bg p-3"
                  data-testid={`outcome-form-${dayLabel.toLowerCase()}`}
                >
                  <p className="mb-2 text-xs font-medium text-text-secondary">
                    How did this meal go?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['success', 'partial', 'failure'] as MealOutcomeResult[]).map((o) => (
                      <Button
                        key={o}
                        small
                        variant={outcomeSelection === o ? 'primary' : 'default'}
                        onClick={() => setOutcomeSelection(o)}
                        data-testid={`outcome-btn-${o}`}
                      >
                        {outcomeLabels[o]}
                      </Button>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Quick notes (optional)"
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    data-testid={`outcome-notes-${dayLabel.toLowerCase()}`}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      small
                      variant="primary"
                      disabled={!outcomeSelection}
                      onClick={() => {
                        if (outcomeSelection) {
                          onRecordOutcome(outcomeSelection, outcomeNotes);
                          setShowOutcomeForm(false);
                        }
                      }}
                      data-testid={`save-outcome-${dayLabel.toLowerCase()}`}
                    >
                      Save
                    </Button>
                    <Button
                      small
                      onClick={() => {
                        setShowOutcomeForm(false);
                        setOutcomeSelection(null);
                        setOutcomeNotes('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div data-testid={`empty-${dayLabel.toLowerCase()}`}>
          {suggestedMeal ? (
            <>
              <p className="mt-1 flex w-full min-w-0 items-center gap-x-1.5 text-sm italic text-text-muted">
                <span className="shrink-0">Suggested:</span>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium text-brand not-italic underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm"
                  data-testid={`suggested-meal-details-${dayLabel.toLowerCase()}`}
                  aria-label={`View recipe details: ${suggestedMeal.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSuggestedMealDetails?.(suggestedMeal.id);
                  }}
                >
                  {suggestedMeal.name}
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-brand text-xs font-semibold leading-none text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  data-testid={`suggested-meal-add-${dayLabel.toLowerCase()}`}
                  aria-label={`Add ${suggestedMeal.name} to ${dayLabel}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSuggestedMeal?.(suggestedMeal.id);
                    triggerAssignFeedback();
                  }}
                >
                  +
                </button>
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
