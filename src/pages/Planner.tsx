import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import type {
  BaseMeal,
  AssemblyVariant,
  Household,
  MealComponent,
  ComponentRecipeRef,
} from "../types";
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
import MealImageSlot from "../components/MealImageSlot";
import AppModal from "../components/AppModal";
import ComponentRecipePicker from "../components/meals/ComponentRecipePicker";
import {
  resolveFullCookingRef,
  summarizeRecipeRef,
  applySessionOverridesToMeal,
  getDefaultRecipeRef,
} from "../lib/componentRecipes";
import {
  assignMealToLatestWeekPlan,
  getWeeklyAnchorForWeekday,
  getTodayWeekdayLabel,
  WEEKDAY_LABELS_MONDAY_FIRST,
} from "../lib/weeklyPlanOps";

const VALID_WEEKDAYS = new Set<string>(WEEKDAY_LABELS_MONDAY_FIRST);

function normalizeWeekdayParam(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return VALID_WEEKDAYS.has(cap) ? cap : null;
}

const ROLE_ORDER = ["protein", "carb", "veg", "sauce", "topping"] as const;

export default function Planner() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [household, setHousehold] = useState<Household | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string>("");
  const [variants, setVariants] = useState<AssemblyVariant[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [browseMealsOpen, setBrowseMealsOpen] = useState(false);
  const [addWeekOpen, setAddWeekOpen] = useState(false);
  const [addWeekDay, setAddWeekDay] = useState<string>(WEEKDAY_LABELS_MONDAY_FIRST[0]!);
  const [sessionOverrides, setSessionOverrides] = useState<
    Map<string, ComponentRecipeRef>
  >(new Map());
  const [pickerComponent, setPickerComponent] = useState<MealComponent | null>(
    null,
  );
  const mealPlanRef = useRef<HTMLDivElement>(null);
  const trayCap = useSuggestedTrayCap();

  const dayParam = normalizeWeekdayParam(searchParams.get("day"));

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

  useEffect(() => {
    if (!selectedMealId || !mealPlanRef.current) return;
    const el = mealPlanRef.current;
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedMealId]);

  function handleSelectMeal(mealId: string) {
    setSelectedMealId(mealId);
    setSessionOverrides(new Map());
    if (!household) return;
    regenerateVariants(household, mealId);
  }

  const selectedMeal: BaseMeal | undefined = household?.baseMeals.find(
    (m) => m.id === selectedMealId,
  );

  const latestPlanDays = useMemo(
    () =>
      household?.weeklyPlans[household.weeklyPlans.length - 1]?.days ?? [],
    [household?.weeklyPlans],
  );

  const themeAnchor = useMemo(() => {
    if (!household || !dayParam) return null;
    return getWeeklyAnchorForWeekday(household, dayParam) ?? null;
  }, [household, dayParam]);

  const suggestionRows = useMemo(() => {
    if (!household || household.baseMeals.length === 0) return [];
    return rankWeeklySuggestedMeals(
      household.baseMeals,
      household.members,
      household.ingredients,
      household.mealOutcomes ?? [],
      household.pinnedMealIds ?? [],
      latestPlanDays,
      themeAnchor,
    );
  }, [household, latestPlanDays, themeAnchor]);

  const trayRows = useMemo(
    () => suggestionRows.slice(0, trayCap),
    [suggestionRows, trayCap],
  );

  const patterns = useMemo<LearnedPatterns | undefined>(() => {
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
    [selectedMeal, household, patterns],
  );

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

  function handleUseTonight() {
    if (!household || !selectedMealId) return;
    const list = [...sessionOverrides.values()];
    const next = assignMealToLatestWeekPlan(
      household,
      selectedMealId,
      getTodayWeekdayLabel(),
      list.length ? list : undefined,
    );
    saveHousehold(next);
    setHousehold(loadHousehold(household.id)!);
  }

  function handleSaveDefaultsFromSession() {
    if (!household || !selectedMeal) return;
    if (sessionOverrides.size === 0) return;
    const updatedMeal = applySessionOverridesToMeal(selectedMeal, sessionOverrides);
    const nextHousehold: Household = {
      ...household,
      baseMeals: household.baseMeals.map((m) =>
        m.id === updatedMeal.id ? updatedMeal : m,
      ),
    };
    saveHousehold(nextHousehold);
    setHousehold(loadHousehold(household.id)!);
    setSessionOverrides(new Map());
  }

  function handleAddToWeekConfirm() {
    if (!householdId || !selectedMealId) return;
    const overrides = [...sessionOverrides.values()];
    navigate(`/household/${householdId}/weekly`, {
      state: {
        preselectAssignMealId: selectedMealId,
        assignComponentOverrides:
          overrides.length > 0 ? overrides : undefined,
        assignTargetDay: addWeekDay,
      },
    });
    setAddWeekOpen(false);
  }

  function linkedMealName(mealId: string | undefined): string | undefined {
    if (!mealId || !household) return undefined;
    return household.baseMeals.find((m) => m.id === mealId)?.name;
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

      {dayParam && themeAnchor && (
        <p
          className="mb-3 text-sm text-text-secondary"
          data-testid="planner-theme-context"
        >
          Planning for {dayParam}: {themeAnchor.icon ? `${themeAnchor.icon} ` : ""}
          {themeAnchor.label}
        </p>
      )}

      {totalMeals === 0 ? (
        <EmptyState>
          No base meals available.{" "}
          <Link
            to={`/household/${householdId}/ingredients`}
            className="font-medium text-brand hover:underline"
          >
            Add ingredients
          </Link>{" "}
          and{" "}
          <Link
            to={`/household/${householdId}/meals`}
            className="font-medium text-brand hover:underline"
          >
            add base meals
          </Link>{" "}
          to get started.
        </EmptyState>
      ) : (
        <Section>
          <div data-testid="meal-planner-suggested" className="mt-2">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  Suggested meals
                </h2>
                <p
                  className="mt-1 text-sm text-text-secondary"
                  data-testid="meal-planner-tray-summary"
                  aria-live="polite"
                >
                  Top {trayRows.length} of {totalMeals} meal
                  {totalMeals !== 1 ? "s" : ""}
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
              {trayRows.map(({ meal, overlap, themeMatch }) => {
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
                      themeMatch={themeMatch}
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
          renderMealCard={({ meal, overlap, themeMatch }) => {
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
                  themeMatch={themeMatch}
                />
              </div>
            );
          }}
        />
      )}

      {selectedMeal && (
        <div ref={mealPlanRef} data-testid="meal-plan" className="mb-6 scroll-mt-4">
        <Card className="mb-0">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="w-full shrink-0 sm:w-40">
              <MealImageSlot
                variant="card"
                imageUrl={selectedMeal.imageUrl}
                alt=""
                imageTestId="selected-meal-hero-image"
                placeholderTestId="selected-meal-hero-placeholder"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="mb-2 text-xl font-semibold text-text-primary">
                {selectedMeal.name}
              </h2>
              <p className="mb-3 text-sm text-text-secondary">
                Prep: {selectedMeal.defaultPrep} | Time:{" "}
                {selectedMeal.estimatedTimeMinutes} min | Difficulty:{" "}
                {selectedMeal.difficulty}
              </p>
              <div
                className="flex flex-wrap gap-2"
                data-testid="planner-primary-actions"
              >
                <Button
                  type="button"
                  variant="primary"
                  data-testid="use-tonight-btn"
                  onClick={handleUseTonight}
                >
                  Use tonight
                </Button>
                <Button
                  type="button"
                  data-testid="add-to-week-btn"
                  onClick={() => setAddWeekOpen(true)}
                >
                  Add to week
                </Button>
                <Link to={`/household/${householdId}/meals?edit=${selectedMeal.id}`}>
                  <Button type="button" variant="ghost" data-testid="edit-meal-btn">
                    Edit meal
                  </Button>
                </Link>
                {sessionOverrides.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    small
                    data-testid="save-defaults-btn"
                    onClick={handleSaveDefaultsFromSession}
                  >
                    Save overrides as defaults
                  </Button>
                )}
              </div>
            </div>
          </div>

          {selectedOverlap && (
            <div data-testid="overlap-summary" className="mb-4">
              <p className="mb-2 text-sm font-medium text-text-primary">
                Overlap: {selectedOverlap.score}/{selectedOverlap.total} members
                compatible
              </p>
              <div data-testid="overlap-indicators" className="flex flex-wrap gap-1">
                {selectedOverlap.memberDetails.map((d) => {
                  const variant =
                    d.compatibility === "direct"
                      ? "success"
                      : d.compatibility === "with-adaptation"
                        ? "warning"
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
                      {d.memberName}:{" "}
                      {d.compatibility === "direct"
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
              <h3 className="mb-1 text-base font-semibold text-text-primary">
                Why this meal?
              </h3>
              <p className="mb-2 text-sm text-text-secondary">
                {selectedExplanation.summary}
              </p>
              {selectedExplanation.tradeOffs.length > 0 && (
                <div data-testid="trade-offs">
                  <h4 className="mb-1 text-sm font-semibold text-text-primary">
                    Trade-offs
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedExplanation.tradeOffs.map((t, i) => {
                      const isConflict =
                        t.includes("conflict") ||
                        t.includes("(hard-no") ||
                        t.includes("(not baby");
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
                  <li key={c.id ?? i}>
                    {ing ? toSentenceCase(ing.name) : c.ingredientId} ({c.role}
                    {c.quantity ? `, ${c.quantity}` : ""})
                  </li>
                );
              })}
            </ul>
          </Section>

          <section
            className="mb-6"
            data-testid="how-to-make-tonight"
            aria-label="How to make tonight"
          >
            <h3 className="mb-2 text-base font-semibold text-text-primary">
              How to make tonight
            </h3>
            <p className="mb-3 text-xs text-text-muted">
              Defaults come from your base meal. “Tonight” overrides are only for this
              session until you add the meal to the week or save as defaults.
            </p>

            {(selectedMeal.recipeRefs ?? []).length > 0 && (
              <div className="mb-4 rounded-md border border-border-light bg-surface-card p-3" data-testid="whole-meal-recipe-refs">
                <span className="text-sm font-medium text-text-primary">Whole meal</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(selectedMeal.recipeRefs ?? []).map((ref, i) => (
                    <Chip key={ref.recipeId || i} variant="info" data-testid={`whole-meal-planner-ref-${i}`}>
                      {ref.label ?? ref.recipeId}
                      {ref.role && ref.role !== "primary" ? ` (${ref.role})` : ""}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {ROLE_ORDER.map((role) => {
              const roleComponents = selectedMeal.components.filter((c) => c.role === role);
              if (roleComponents.length === 0) return null;
              const roleLabel: Record<string, string> = {
                protein: "Protein",
                carb: "Carb",
                sauce: "Sauce",
                veg: "Veg / toppings",
                topping: "Toppings",
              };
              return (
                <div key={role} className="mb-3" data-testid={`how-to-group-${role}`}>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {roleLabel[role] ?? role}
                  </h4>
                  <ul className="space-y-2">
                    {roleComponents.map((c, idx) => {
                  const ing = household.ingredients.find(
                    (x) => x.id === c.ingredientId,
                  );
                  const ingName = ing
                    ? toSentenceCase(ing.name)
                    : c.ingredientId;
                  const resolution = resolveFullCookingRef(
                    c, selectedMeal, household.ingredients, { sessionOverrides },
                  );
                  const defaultRef = getDefaultRecipeRef(c);
                  const defaultLine = defaultRef
                    ? summarizeRecipeRef(defaultRef, {
                        linkedMealName: linkedMealName(defaultRef.linkedBaseMealId),
                      })
                    : c.prepNote || "\u2014";
                  const tonightLine = resolution.effective
                    ? summarizeRecipeRef(resolution.effective, {
                        linkedMealName: linkedMealName(resolution.effective.linkedBaseMealId),
                      })
                    : "\u2014";
                  const showTonight = resolution.source === "session";
                  return (
                    <li
                      key={c.id ?? idx}
                      className="rounded-md border border-border-light bg-surface-card p-3 text-sm"
                      data-testid={`how-to-row-${c.role}-${idx}`}
                    >
                      <div className="font-medium text-text-primary capitalize">
                        {ingName}
                      </div>
                      <div className="mt-1 text-text-secondary">
                        <span className="text-text-muted">Default: </span>
                        {defaultLine}
                      </div>
                      <div className="mt-1 text-text-secondary">
                        <span className="text-text-muted">Tonight: </span>
                        {showTonight ? tonightLine : (resolution.effective ? tonightLine : defaultLine)}
                        {showTonight && (
                          <Chip variant="info" className="ml-2">
                            override
                          </Chip>
                        )}
                        {!showTonight && resolution.source !== "none" && resolution.source !== "component" && (
                          <span className="ml-2 text-[10px] text-text-muted">
                            ({resolution.sourceLabel})
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          small
                          data-testid={`tonight-override-${c.id ?? idx}`}
                          onClick={() => setPickerComponent(c)}
                        >
                          {showTonight ? "Change tonight" : "Set tonight"}
                        </Button>
                        {showTonight && c.id && (
                          <Button
                            type="button"
                            small
                            variant="ghost"
                            onClick={() => {
                              setSessionOverrides((prev) => {
                                const next = new Map(prev);
                                next.delete(c.id!);
                                return next;
                              });
                            }}
                          >
                            Clear tonight
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                    })}
                  </ul>
                </div>
              );
            })}

            {selectedMeal.recipeLinks && selectedMeal.recipeLinks.length > 0 && (
              <div className="mt-2 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">Recipe links: </span>
                {selectedMeal.recipeLinks.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mr-2 text-brand underline"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </section>

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
                      <Chip variant="warning" className="ml-2">
                        extra prep needed
                      </Chip>
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
        </div>
      )}

      {pickerComponent && selectedMeal && householdId && (
        <ComponentRecipePicker
          open
          onClose={() => setPickerComponent(null)}
          component={pickerComponent}
          excludeMealId={selectedMeal.id}
          baseMeals={household.baseMeals}
          recipes={household.recipes ?? []}
          mode="tonight"
          onSave={(ref) => {
            if (!pickerComponent.id) return;
            setSessionOverrides((prev) => {
              const next = new Map(prev);
              next.set(pickerComponent.id!, {
                ...ref,
                componentId: pickerComponent.id!,
              });
              return next;
            });
            setPickerComponent(null);
          }}
        />
      )}

      <AppModal
        open={addWeekOpen}
        onClose={() => setAddWeekOpen(false)}
        ariaLabel="Choose day"
        className="flex max-w-md flex-col gap-4 p-6"
        panelTestId="add-to-week-modal"
      >
        <h3 className="text-lg font-semibold text-text-primary">Add to week</h3>
        <p className="text-sm text-text-secondary">
          Pick a day. You can assign the meal by tapping the day card after you land on
          Weekly Planner.
        </p>
        <label className="text-sm font-medium text-text-primary">
          Day
          <select
            className="mt-1 block w-full rounded-md border border-border-light bg-bg px-3 py-2"
            value={addWeekDay}
            onChange={(e) => setAddWeekDay(e.target.value)}
            data-testid="add-to-week-day-select"
          >
            {WEEKDAY_LABELS_MONDAY_FIRST.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleAddToWeekConfirm} data-testid="add-to-week-confirm">
            Go to Weekly Planner
          </Button>
          <Button variant="ghost" onClick={() => setAddWeekOpen(false)}>
            Cancel
          </Button>
        </div>
      </AppModal>
    </>
  );
}
