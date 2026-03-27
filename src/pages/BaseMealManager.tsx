import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import type { BaseMeal, MealComponent, Ingredient, Recipe, RecipeRef } from "../types";
import { loadHousehold, saveHousehold, toSentenceCase } from "../storage";
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  FieldLabel,
  EmptyState,
  Chip,
  ConfirmDialog,
  useConfirm,
} from "../components/ui";
import AppModal from "../components/AppModal";
import MealImageSlot from "../components/MealImageSlot";
import { useIncrementalList } from "../hooks/useIncrementalList";
import {
  sortBaseMeals,
  type BaseMealSortKey,
  type SortDir,
} from "../lib/listSort";
import ComponentForm from "../components/meals/ComponentForm";
import RecipeLinksEditor from "../components/meals/RecipeLinksEditor";
import ComponentRecipePicker from "../components/meals/ComponentRecipePicker";
import { resolveMealImageUrl } from "../lib/mealImage";

const MEAL_SORT_OPTIONS: {
  value: string;
  label: string;
  key: BaseMealSortKey;
  dir: SortDir;
}[] = [
  { value: "name-asc", label: "Name (A–Z)", key: "name", dir: "asc" },
  { value: "name-desc", label: "Name (Z–A)", key: "name", dir: "desc" },
  {
    value: "time-asc",
    label: "Time (short → long)",
    key: "estimatedTimeMinutes",
    dir: "asc",
  },
  {
    value: "time-desc",
    label: "Time (long → short)",
    key: "estimatedTimeMinutes",
    dir: "desc",
  },
  {
    value: "difficulty-asc",
    label: "Difficulty (easy → hard)",
    key: "difficulty",
    dir: "asc",
  },
  {
    value: "difficulty-desc",
    label: "Difficulty (hard → easy)",
    key: "difficulty",
    dir: "desc",
  },
  {
    value: "components-asc",
    label: "Components (few → many)",
    key: "componentCount",
    dir: "asc",
  },
  {
    value: "components-desc",
    label: "Components (many → few)",
    key: "componentCount",
    dir: "desc",
  },
];

const DIFFICULTY_OPTIONS: BaseMeal["difficulty"][] = ["easy", "medium", "hard"];
const DIFFICULTY_CHIP_VARIANT: Record<
  BaseMeal["difficulty"],
  "success" | "warning" | "danger"
> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

function createEmptyMeal(): BaseMeal {
  return {
    id: crypto.randomUUID(),
    name: "",
    components: [],
    defaultPrep: "",
    estimatedTimeMinutes: 30,
    difficulty: "easy",
    rescueEligible: false,
    wasteReuseHints: [],
    recipeLinks: [],
    notes: "",
  };
}

function MealModal({
  meal,
  ingredients,
  allMeals,
  recipes,
  onChange,
  onClose,
  onRemove,
  onAddIngredient,
}: {
  meal: BaseMeal;
  ingredients: Ingredient[];
  allMeals: BaseMeal[];
  recipes: Recipe[];
  onChange: (updated: BaseMeal) => void;
  onClose: () => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
}) {
  const [openComponentIndexes, setOpenComponentIndexes] = useState<number[]>(
    [],
  );
  const [mealRecipePickerOpen, setMealRecipePickerOpen] = useState(false);

  function addComponent() {
    const newComponent: MealComponent = {
      id: crypto.randomUUID(),
      ingredientId: "",
      role: "protein",
      quantity: "",
    };
    onChange({ ...meal, components: [...meal.components, newComponent] });
    setOpenComponentIndexes((prev) => [...prev, meal.components.length]);
  }

  function updateComponent(index: number, updated: MealComponent) {
    const components = [...meal.components];
    components[index] = updated;
    onChange({ ...meal, components });
  }

  function removeComponent(index: number) {
    onChange({
      ...meal,
      components: meal.components.filter((_, i) => i !== index),
    });
    setOpenComponentIndexes((prev) =>
      prev
        .filter((item) => item !== index)
        .map((item) => (item > index ? item - 1 : item)),
    );
  }

  return (
    <AppModal
      open
      onClose={onClose}
      ariaLabel="Edit meal"
      className="flex max-h-[92vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden p-0"
      panelTestId="meal-modal"
    >
      <div className="shrink-0 border-b border-border-light bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <MealImageSlot
              variant="modalHeader"
              imageUrl={resolveMealImageUrl(meal, recipes)}
              alt=""
              imageTestId="meal-modal-header-image"
              placeholderTestId="meal-modal-header-image-placeholder"
            />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-text-primary">
                {toSentenceCase(meal.name) || "New meal"}
              </h2>
              <span className="text-xs text-text-muted">
                Build one shared meal structure with clear component choices
              </span>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close modal">
            Close
          </Button>
        </div>
        <div
          className="mt-3 flex flex-wrap gap-2"
          data-testid="meal-summary-chips"
        >
          <Chip variant="info">{meal.estimatedTimeMinutes} min</Chip>
          <Chip variant={DIFFICULTY_CHIP_VARIANT[meal.difficulty]}>
            {meal.difficulty}
          </Chip>
          <Chip variant={meal.rescueEligible ? "success" : "neutral"}>
            {meal.rescueEligible ? "Rescue eligible" : "Not rescue"}
          </Chip>
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
        <section data-testid="meal-identity-section" className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            1. Meal identity
          </h3>
          <FieldLabel label="Meal name">
            <Input
              type="text"
              value={meal.name}
              onChange={(e) => onChange({ ...meal, name: e.target.value })}
              placeholder="Meal name"
              required
              data-testid="modal-meal-name"
            />
          </FieldLabel>
        </section>

        <section data-testid="meal-structure-section" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              2. Structure and components
            </h3>
            <Button small onClick={addComponent}>
              Add component
            </Button>
          </div>
          {meal.components.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border-default bg-bg p-3 text-sm text-text-muted">
              No components yet. Add protein, carb, veg, sauce, or topping
              components to define this meal.
            </div>
          ) : (
            <div className="space-y-2">
              {meal.components.map((comp, i) => (
                <ComponentForm
                  key={comp.id ?? i}
                  index={i}
                  defaultExpanded={openComponentIndexes.includes(i)}
                  component={comp}
                  ingredients={ingredients}
                  onChange={(updated) => updateComponent(i, updated)}
                  onRemove={() => removeComponent(i)}
                  onAddIngredient={onAddIngredient}
                  allMeals={allMeals}
                  recipes={recipes}
                  excludeMealId={meal.id}
                />
              ))}
            </div>
          )}
        </section>

        <section data-testid="meal-planning-section" className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            3. Planning metadata
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldLabel label="Default prep">
              <Input
                type="text"
                value={meal.defaultPrep}
                onChange={(e) =>
                  onChange({ ...meal, defaultPrep: e.target.value })
                }
                placeholder="e.g. stir-fry, roast"
              />
            </FieldLabel>
            <FieldLabel label="Time (minutes)">
              <Input
                type="number"
                value={meal.estimatedTimeMinutes}
                onChange={(e) =>
                  onChange({
                    ...meal,
                    estimatedTimeMinutes: parseInt(e.target.value, 10) || 0,
                  })
                }
                min={0}
                className="max-w-[180px]"
              />
            </FieldLabel>
            <FieldLabel label="Difficulty">
              <Select
                value={meal.difficulty}
                onChange={(e) =>
                  onChange({
                    ...meal,
                    difficulty: e.target.value as BaseMeal["difficulty"],
                  })
                }
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand"
                checked={meal.rescueEligible}
                onChange={(e) =>
                  onChange({ ...meal, rescueEligible: e.target.checked })
                }
              />
              Rescue eligible
            </label>
          </div>
        </section>

        <section data-testid="meal-secondary-section" className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            4. References and notes
          </h3>

          <details
            data-testid="recipe-links-section"
            className="rounded-sm border border-border-light bg-surface-card p-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-text-primary">
              Recipe links
            </summary>
            <RecipeLinksEditor
              links={meal.recipeLinks ?? []}
              onChange={(recipeLinks) => onChange({ ...meal, recipeLinks })}
            />
          </details>

          <details
            data-testid="whole-meal-recipes-section"
            className="rounded-sm border border-border-light bg-surface-card p-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-text-primary">
              Library recipes ({(meal.recipeRefs ?? []).length})
            </summary>
            <div className="mt-3 space-y-2">
              {(meal.recipeRefs ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(meal.recipeRefs ?? []).map((ref, i) => {
                    const recipeName =
                      ref.label ??
                      recipes.find((r) => r.id === ref.recipeId)?.name ??
                      ref.recipeId;
                    return (
                      <span
                        key={ref.recipeId || i}
                        className="inline-flex items-center gap-1"
                        data-testid={`whole-meal-ref-${i}`}
                      >
                        <Chip variant="info">{recipeName}</Chip>
                        {ref.role && (
                          <Chip variant="neutral" className="text-[10px]">
                            {ref.role}
                          </Chip>
                        )}
                        <Button
                          variant="ghost"
                          small
                          className="text-text-muted hover:text-danger"
                          onClick={() => {
                            const next = (meal.recipeRefs ?? []).filter(
                              (_, idx) => idx !== i,
                            );
                            onChange({ ...meal, recipeRefs: next });
                          }}
                          data-testid={`remove-whole-meal-ref-${i}`}
                        >
                          Remove
                        </Button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  No library recipes attached yet.
                </p>
              )}
              <Button
                small
                onClick={() => setMealRecipePickerOpen(true)}
                data-testid="attach-whole-meal-recipe"
              >
                Attach recipe
              </Button>
            </div>
          </details>

          {mealRecipePickerOpen && (
            <ComponentRecipePicker
              open
              onClose={() => setMealRecipePickerOpen(false)}
              excludeMealId={meal.id}
              baseMeals={allMeals}
              recipes={recipes}
              mode="meal"
              onSave={() => {}}
              onSaveMealRef={(ref: RecipeRef) => {
                const existing = meal.recipeRefs ?? [];
                const alreadyLinked = ref.recipeId && existing.some(
                  (r) => r.recipeId === ref.recipeId,
                );
                if (!alreadyLinked) {
                  onChange({ ...meal, recipeRefs: [...existing, ref] });
                }
                setMealRecipePickerOpen(false);
              }}
            />
          )}

          <details
            data-testid="notes-section"
            className="rounded-sm border border-border-light bg-surface-card p-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-text-primary">
              Notes
            </summary>
            <FieldLabel label="Notes" className="mt-3">
              <textarea
                className="w-full rounded-lg border border-border-light bg-surface p-3 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                rows={3}
                value={meal.notes ?? ""}
                onChange={(e) => onChange({ ...meal, notes: e.target.value })}
                placeholder="e.g. Gousto version works well, blend toddler sauce"
                data-testid="meal-notes"
              />
            </FieldLabel>
          </details>

          <details
            data-testid="image-section"
            className="rounded-sm border border-border-light bg-surface-card p-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-text-primary">
              Image
            </summary>
            <FieldLabel label="Image" className="mt-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="url"
                  value={meal.imageUrl ?? ""}
                  onChange={(e) =>
                    onChange({ ...meal, imageUrl: e.target.value || undefined })
                  }
                  placeholder="Image URL"
                  data-testid="meal-image-url"
                />
                <label className="inline-flex cursor-pointer items-center">
                  <span className="inline-flex items-center justify-center rounded-sm border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg hover:shadow-card min-h-[36px]">
                    Upload
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    data-testid="meal-image-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        onChange({
                          ...meal,
                          imageUrl: reader.result as string,
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
              {meal.imageUrl && (
                <MealImageSlot
                  variant="editorPreview"
                  imageUrl={meal.imageUrl}
                  alt={meal.name || "Meal"}
                  imageTestId="meal-image-preview"
                  placeholderTestId="meal-image-preview-placeholder"
                />
              )}
            </FieldLabel>
          </details>
        </section>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border-light bg-surface px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          small
          className="text-danger hover:text-danger"
          onClick={onRemove}
        >
          Remove meal
        </Button>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-text-muted sm:block">
            Changes auto-save as you edit
          </span>
          <Button variant="primary" onClick={onClose}>
            Save meal
          </Button>
        </div>
      </div>
    </AppModal>
  );
}

function MealRow({ meal, recipes, onClick }: { meal: BaseMeal; recipes: Recipe[]; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-border-light bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card cursor-pointer min-h-[48px]"
      onClick={onClick}
      data-testid={`meal-row-${meal.id}`}
      aria-label={`Edit ${meal.name || "unnamed meal"}`}
    >
      <MealImageSlot
        variant="row"
        imageUrl={resolveMealImageUrl(meal, recipes)}
        alt=""
        imageTestId="meal-row-image"
        placeholderTestId="meal-row-image-placeholder"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text-primary truncate">
          {meal.name ? (
            toSentenceCase(meal.name)
          ) : (
            <span className="italic text-text-muted">Unnamed</span>
          )}
        </span>
        <span className="block text-xs text-text-muted truncate">
          {meal.defaultPrep ? toSentenceCase(meal.defaultPrep) : "No prep set"}{" "}
          · {meal.estimatedTimeMinutes} min · {meal.components.length}{" "}
          components
        </span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-1.5">
        <Chip
          variant={DIFFICULTY_CHIP_VARIANT[meal.difficulty]}
          className="text-[10px]"
        >
          {meal.difficulty}
        </Chip>
        {meal.rescueEligible && (
          <Chip variant="info" className="text-[10px]">
            rescue
          </Chip>
        )}
      </span>
    </button>
  );
}

export default function BaseMealManager() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [meals, setMeals] = useState<BaseMeal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mealSort, setMealSort] = useState(MEAL_SORT_OPTIONS[0]!.value);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setMeals(household.baseMeals);
      setIngredients(household.ingredients);
      setRecipes(household.recipes ?? []);
      setHouseholdName(household.name);
    }
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    const edit = searchParams.get("edit") || searchParams.get("meal");
    if (!edit || meals.length === 0) return;
    if (!meals.some((m) => m.id === edit)) return;
    setEditingId(edit);
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete("edit");
        next.delete("meal");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, meals, setSearchParams]);

  useEffect(() => {
    if (!loaded || !householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.baseMeals = meals;
    household.ingredients = ingredients;
    saveHousehold(household);
  }, [householdId, loaded, meals, ingredients]);

  const filteredMeals = useMemo(() => {
    if (!searchQuery.trim()) return meals;
    const q = searchQuery.toLowerCase();
    return meals.filter((meal) => meal.name.toLowerCase().includes(q));
  }, [meals, searchQuery]);

  const sortedMeals = useMemo(() => {
    const opt =
      MEAL_SORT_OPTIONS.find((o) => o.value === mealSort) ??
      MEAL_SORT_OPTIONS[0]!;
    return sortBaseMeals(filteredMeals, opt.key, opt.dir);
  }, [filteredMeals, mealSort]);

  const resetDeps = useMemo(
    () => [searchQuery, mealSort] as const,
    [searchQuery, mealSort],
  );
  const {
    visibleItems: visibleMeals,
    hasMore: mealListHasMore,
    loadMore: loadMoreMeals,
    sentinelRef: mealListSentinelRef,
  } = useIncrementalList(sortedMeals, { resetDeps: [...resetDeps] });

  const editingMeal = editingId
    ? (meals.find((meal) => meal.id === editingId) ?? null)
    : null;

  function addMeal() {
    const newMeal = createEmptyMeal();
    setMeals((prev) => [...prev, newMeal]);
    setEditingId(newMeal.id);
  }

  function updateMeal(updated: BaseMeal) {
    setMeals((prev) => {
      return prev.map((meal) => (meal.id === updated.id ? updated : meal));
    });
  }

  function removeMeal(mealId: string) {
    const meal = meals.find((item) => item.id === mealId);
    const mealName = meal?.name || "Unnamed meal";
    requestConfirm(mealName, () => {
      setMeals((prev) => prev.filter((item) => item.id !== mealId));
      setEditingId((prev) => (prev === mealId ? null : prev));
    });
  }

  function addIngredient(ingredient: Ingredient) {
    setIngredients((prev) => [...prev, ingredient]);
  }

  if (!loaded) return null;

  return (
    <>
      <PageHeader
        title="Base Meals"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      <Card className="mb-4" data-testid="meal-control-bar">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meals..."
              data-testid="meal-search"
            />
          </div>
          <div className="sm:w-56 shrink-0">
            <Select
              value={mealSort}
              onChange={(e) => setMealSort(e.target.value)}
              data-testid="meal-sort"
            >
              {MEAL_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={addMeal}>Add meal</Button>
          <Button
            type="button"
            data-testid="import-recipe-btn"
            onClick={() =>
              householdId && navigate(`/household/${householdId}/import-recipe`)
            }
          >
            Import recipe
          </Button>
        </div>
      </Card>

      <h2
        className="mb-3 text-sm font-medium text-text-secondary"
        data-testid="meal-list-summary"
      >
        <span>Meals ({meals.length})</span>
        {filteredMeals.length !== meals.length && (
          <span>{` · ${filteredMeals.length} match${filteredMeals.length !== 1 ? "es" : ""}`}</span>
        )}
        {sortedMeals.length > 0 && visibleMeals.length < sortedMeals.length && (
          <span>{` · showing ${visibleMeals.length} of ${sortedMeals.length}`}</span>
        )}
      </h2>

      {meals.length === 0 ? (
        <EmptyState>No meals yet. Add one to get started.</EmptyState>
      ) : filteredMeals.length === 0 ? (
        <EmptyState>No meals match your search.</EmptyState>
      ) : (
        <div className="space-y-1.5" data-testid="meal-list">
          {visibleMeals.map((meal) => (
            <MealRow
              key={meal.id}
              meal={meal}
              recipes={recipes}
              onClick={() => setEditingId(meal.id)}
            />
          ))}
          <div ref={mealListSentinelRef} className="h-px w-full" aria-hidden />
          {mealListHasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="default"
                onClick={loadMoreMeals}
                data-testid="meal-list-load-more"
              >
                Load more meals
              </Button>
            </div>
          )}
        </div>
      )}

      {editingMeal && (
        <MealModal
          meal={editingMeal}
          ingredients={ingredients}
          allMeals={meals}
          recipes={recipes}
          onChange={updateMeal}
          onClose={() => setEditingId(null)}
          onRemove={() => removeMeal(editingMeal.id)}
          onAddIngredient={addIngredient}
        />
      )}

      <ConfirmDialog
        open={!!pending}
        title="Remove meal"
        message={`Are you sure you want to remove "${pending?.entityName}"? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </>
  );
}
