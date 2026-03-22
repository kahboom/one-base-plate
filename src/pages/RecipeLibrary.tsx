import { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import type { BaseMeal, Ingredient, MealComponent, Recipe } from "../types";
import {
  loadHousehold,
  saveHousehold,
  toSentenceCase,
  normalizeHousehold,
} from "../storage";
import { promoteRecipeToBaseMeal } from "../lib/promoteRecipe";
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
import ComponentForm from "../components/meals/ComponentForm";
import RecipeLinksEditor from "../components/meals/RecipeLinksEditor";
import { useIncrementalList } from "../hooks/useIncrementalList";
import {
  sortRecipes,
  type RecipeSortKey,
  type SortDir,
} from "../lib/listSort";

const RECIPE_SORT_OPTIONS: {
  value: string;
  label: string;
  key: RecipeSortKey;
  dir: SortDir;
}[] = [
  { value: "name-asc", label: "Name (A–Z)", key: "name", dir: "asc" },
  { value: "name-desc", label: "Name (Z–A)", key: "name", dir: "desc" },
  {
    value: "components-asc",
    label: "Ingredients (few → many)",
    key: "componentCount",
    dir: "asc",
  },
  {
    value: "components-desc",
    label: "Ingredients (many → few)",
    key: "componentCount",
    dir: "desc",
  },
  {
    value: "time-asc",
    label: "Prep time (short → long)",
    key: "totalPrepMinutes",
    dir: "asc",
  },
  {
    value: "time-desc",
    label: "Prep time (long → short)",
    key: "totalPrepMinutes",
    dir: "desc",
  },
];

function createEmptyRecipe(): Recipe {
  return {
    id: crypto.randomUUID(),
    name: "",
    components: [],
    defaultPrep: "",
    recipeLinks: [],
    notes: "",
  };
}

function recipePrepSummary(r: Recipe): string {
  const p = r.prepTimeMinutes ?? 0;
  const c = r.cookTimeMinutes ?? 0;
  if (p && c) return `${p} prep + ${c} cook min`;
  if (p) return `${p} min prep`;
  if (c) return `${c} min cook`;
  return "No prep time set";
}

function RecipeRow({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-border-light bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card cursor-pointer min-h-[48px]"
      onClick={onClick}
      data-testid={`recipe-row-${recipe.id}`}
      aria-label={`Edit ${recipe.name || "unnamed recipe"}`}
    >
      <MealImageSlot
        variant="row"
        imageUrl={recipe.imageUrl}
        alt=""
        imageTestId="recipe-row-image"
        placeholderTestId="recipe-row-image-placeholder"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text-primary truncate">
          {recipe.name ? (
            toSentenceCase(recipe.name)
          ) : (
            <span className="italic text-text-muted">Unnamed</span>
          )}
        </span>
        <span className="block text-xs text-text-muted truncate">
          {recipePrepSummary(recipe)} · {recipe.components.length} ingredient
          {recipe.components.length !== 1 ? "s" : ""}
        </span>
      </span>
      <Chip variant="neutral" className="text-[10px] shrink-0">
        Library
      </Chip>
    </button>
  );
}

function RecipeModal({
  recipe,
  ingredients,
  baseMeals,
  onChange,
  onClose,
  onRemove,
  onAddIngredient,
  householdId,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  baseMeals: BaseMeal[];
  onChange: (updated: Recipe) => void;
  onClose: () => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
  householdId: string;
}) {
  const navigate = useNavigate();
  const [openComponentIndexes, setOpenComponentIndexes] = useState<number[]>([]);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<BaseMeal["difficulty"]>("medium");
  const [rescueEligible, setRescueEligible] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);

  const totalPrep = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  useEffect(() => {
    setEstimatedMinutes(totalPrep > 0 ? totalPrep : 30);
  }, [recipe.id, totalPrep]);

  function addComponent() {
    const newComponent: MealComponent = {
      id: crypto.randomUUID(),
      ingredientId: "",
      role: "protein",
      quantity: "",
    };
    onChange({ ...recipe, components: [...recipe.components, newComponent] });
    setOpenComponentIndexes((prev) => [...prev, recipe.components.length]);
  }

  function updateComponent(index: number, updated: MealComponent) {
    const components = [...recipe.components];
    components[index] = updated;
    onChange({ ...recipe, components });
  }

  function removeComponent(index: number) {
    onChange({
      ...recipe,
      components: recipe.components.filter((_, i) => i !== index),
    });
    setOpenComponentIndexes((prev) =>
      prev
        .filter((item) => item !== index)
        .map((item) => (item > index ? item - 1 : item)),
    );
  }

  function handlePromoteConfirm() {
    const h = loadHousehold(householdId);
    if (!h) return;
    const norm = normalizeHousehold(h);
    const r = norm.recipes.find((x) => x.id === recipe.id);
    if (!r) return;
    const meal = promoteRecipeToBaseMeal(r, {
      difficulty,
      rescueEligible,
      estimatedTimeMinutes: estimatedMinutes > 0 ? estimatedMinutes : 30,
    });
    saveHousehold(
      normalizeHousehold({
        ...norm,
        baseMeals: [...norm.baseMeals, meal],
      }),
    );
    setPromoteOpen(false);
    onClose();
    navigate(`/household/${householdId}/meal/${meal.id}`);
  }

  return (
    <>
      <AppModal
        open
        onClose={onClose}
        ariaLabel="Edit recipe"
        className="flex max-h-[92vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden p-0"
        panelTestId="recipe-modal"
      >
        <div className="shrink-0 border-b border-border-light bg-surface px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <MealImageSlot
                variant="modalHeader"
                imageUrl={recipe.imageUrl}
                alt=""
                imageTestId="recipe-modal-header-image"
                placeholderTestId="recipe-modal-header-image-placeholder"
              />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-text-primary">
                  {toSentenceCase(recipe.name) || "New recipe"}
                </h2>
                <span className="text-xs text-text-muted">
                  Recipe library — promote to a base meal when you want to plan it
                </span>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose} aria-label="Close modal">
              Close
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="recipe-summary-chips">
            <Chip variant="info">{recipe.components.length} ingredients</Chip>
            {(recipe.prepTimeMinutes ?? 0) > 0 && (
              <Chip variant="neutral">{recipe.prepTimeMinutes} min prep</Chip>
            )}
            {(recipe.cookTimeMinutes ?? 0) > 0 && (
              <Chip variant="neutral">{recipe.cookTimeMinutes} min cook</Chip>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              1. Recipe identity
            </h3>
            <FieldLabel label="Recipe name">
              <Input
                type="text"
                value={recipe.name}
                onChange={(e) => onChange({ ...recipe, name: e.target.value })}
                placeholder="Recipe name"
                required
                data-testid="modal-recipe-name"
              />
            </FieldLabel>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              2. Prep and timing
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Default prep (short note)">
                <Input
                  type="text"
                  value={recipe.defaultPrep ?? ""}
                  onChange={(e) =>
                    onChange({ ...recipe, defaultPrep: e.target.value || undefined })
                  }
                  placeholder="e.g. stir-fry, one-pot"
                />
              </FieldLabel>
              <FieldLabel label="Prep time (minutes)">
                <Input
                  type="number"
                  value={recipe.prepTimeMinutes ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...recipe,
                      prepTimeMinutes: parseInt(e.target.value, 10) || undefined,
                    })
                  }
                  min={0}
                  className="max-w-[180px]"
                />
              </FieldLabel>
              <FieldLabel label="Cook time (minutes)">
                <Input
                  type="number"
                  value={recipe.cookTimeMinutes ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...recipe,
                      cookTimeMinutes: parseInt(e.target.value, 10) || undefined,
                    })
                  }
                  min={0}
                  className="max-w-[180px]"
                />
              </FieldLabel>
            </div>
          </section>

          <section data-testid="recipe-structure-section" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                3. Mapped ingredients
              </h3>
              <Button small onClick={addComponent}>
                Add component
              </Button>
            </div>
            {recipe.components.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border-default bg-bg p-3 text-sm text-text-muted">
                No components yet. Add ingredients the same way as base meals.
              </div>
            ) : (
              <div className="space-y-2">
                {recipe.components.map((comp, i) => (
                  <ComponentForm
                    key={comp.id ?? i}
                    index={i}
                    defaultExpanded={openComponentIndexes.includes(i)}
                    component={comp}
                    ingredients={ingredients}
                    onChange={(updated) => updateComponent(i, updated)}
                    onRemove={() => removeComponent(i)}
                    onAddIngredient={onAddIngredient}
                    allMeals={baseMeals}
                    excludeMealId=""
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              4. References, notes, and image
            </h3>

            <details className="rounded-sm border border-border-light bg-surface-card p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-primary">
                Original ingredient text
              </summary>
              <FieldLabel label="Pasted or imported ingredients" className="mt-3">
                <textarea
                  className="w-full rounded-lg border border-border-light bg-surface p-3 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                  rows={4}
                  value={recipe.ingredientsText ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...recipe,
                      ingredientsText: e.target.value || undefined,
                    })
                  }
                  placeholder="Optional: keep the raw ingredient list for reference"
                />
              </FieldLabel>
            </details>

            <details
              data-testid="recipe-links-section"
              className="rounded-sm border border-border-light bg-surface-card p-3"
            >
              <summary className="cursor-pointer text-sm font-medium text-text-primary">
                Recipe links
              </summary>
              <RecipeLinksEditor
                links={recipe.recipeLinks ?? []}
                onChange={(recipeLinks) => onChange({ ...recipe, recipeLinks })}
              />
            </details>

            <details className="rounded-sm border border-border-light bg-surface-card p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-primary">
                Notes
              </summary>
              <FieldLabel label="Notes" className="mt-3">
                <textarea
                  className="w-full rounded-lg border border-border-light bg-surface p-3 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                  rows={3}
                  value={recipe.notes ?? ""}
                  onChange={(e) => onChange({ ...recipe, notes: e.target.value || undefined })}
                  placeholder="Tips, source notes…"
                  data-testid="recipe-notes"
                />
              </FieldLabel>
            </details>

            <details
              data-testid="recipe-image-section"
              className="rounded-sm border border-border-light bg-surface-card p-3"
            >
              <summary className="cursor-pointer text-sm font-medium text-text-primary">
                Image
              </summary>
              <FieldLabel label="Image" className="mt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="url"
                    value={recipe.imageUrl ?? ""}
                    onChange={(e) =>
                      onChange({ ...recipe, imageUrl: e.target.value || undefined })
                    }
                    placeholder="Image URL"
                    data-testid="recipe-image-url"
                  />
                  <label className="inline-flex cursor-pointer items-center">
                    <span className="inline-flex items-center justify-center rounded-sm border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg hover:shadow-card min-h-[36px]">
                      Upload
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      data-testid="recipe-image-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          onChange({
                            ...recipe,
                            imageUrl: reader.result as string,
                          });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
                {recipe.imageUrl && (
                  <MealImageSlot
                    variant="editorPreview"
                    imageUrl={recipe.imageUrl}
                    alt={recipe.name || "Recipe"}
                    imageTestId="recipe-image-preview"
                    placeholderTestId="recipe-image-preview-placeholder"
                  />
                )}
              </FieldLabel>
            </details>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border-light bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button
            variant="ghost"
            small
            className="text-danger hover:text-danger"
            onClick={onRemove}
            data-testid="recipe-remove-btn"
          >
            Remove recipe
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default" onClick={() => setPromoteOpen(true)} data-testid="recipe-promote-btn">
              Add to base meals
            </Button>
            <span className="hidden text-xs text-text-muted sm:block">
              Changes auto-save as you edit
            </span>
            <Button variant="primary" onClick={onClose} data-testid="recipe-save-close-btn">
              Save recipe
            </Button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        ariaLabel="Add to base meals"
        className="max-w-md p-6"
      >
        <h2 className="mb-2 text-lg font-bold text-text-primary">Add to base meals</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Creates a plan-able base meal from this recipe (image and links carry over).
        </p>
        <FieldLabel label="Difficulty">
          <select
            className="w-full rounded-sm border border-border-default bg-surface px-4 py-2 text-base min-h-[44px]"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as BaseMeal["difficulty"])}
            data-testid="promote-difficulty"
          >
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </FieldLabel>
        <FieldLabel label="Estimated time (minutes)" className="mt-4">
          <Input
            type="number"
            min={1}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(parseInt(e.target.value, 10) || 0)}
            data-testid="promote-time"
          />
        </FieldLabel>
        <label className="mt-4 flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={rescueEligible}
            onChange={(e) => setRescueEligible(e.target.checked)}
            data-testid="promote-rescue"
          />
          Rescue eligible
        </label>
        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={handlePromoteConfirm} data-testid="promote-confirm-btn">
            Create base meal
          </Button>
          <Button onClick={() => setPromoteOpen(false)}>Cancel</Button>
        </div>
      </AppModal>
    </>
  );
}

export default function RecipeLibrary() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [baseMeals, setBaseMeals] = useState<BaseMeal[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [recipeSort, setRecipeSort] = useState(RECIPE_SORT_OPTIONS[0]!.value);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  useEffect(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) {
      const n = normalizeHousehold(h);
      setRecipes(n.recipes);
      setIngredients(n.ingredients);
      setBaseMeals(n.baseMeals);
      setHouseholdName(n.name);
    }
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    const rid = searchParams.get("recipe");
    if (!rid || recipes.length === 0) return;
    if (!recipes.some((r) => r.id === rid)) return;
    setEditingId(rid);
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete("recipe");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, recipes, setSearchParams]);

  useEffect(() => {
    if (!loaded || !householdId) return;
    const h = loadHousehold(householdId);
    if (!h) return;
    saveHousehold(
      normalizeHousehold({
        ...h,
        recipes,
        ingredients,
      }),
    );
  }, [householdId, loaded, recipes, ingredients]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    const q = searchQuery.toLowerCase();
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, searchQuery]);

  const sortedRecipes = useMemo(() => {
    const opt =
      RECIPE_SORT_OPTIONS.find((o) => o.value === recipeSort) ??
      RECIPE_SORT_OPTIONS[0]!;
    return sortRecipes(filteredRecipes, opt.key, opt.dir);
  }, [filteredRecipes, recipeSort]);

  const resetDeps = useMemo(
    () => [searchQuery, recipeSort] as const,
    [searchQuery, recipeSort],
  );
  const {
    visibleItems: visibleRecipes,
    hasMore: recipeListHasMore,
    loadMore: loadMoreRecipes,
    sentinelRef: recipeListSentinelRef,
  } = useIncrementalList(sortedRecipes, { resetDeps: [...resetDeps] });

  const editingRecipe = editingId
    ? (recipes.find((r) => r.id === editingId) ?? null)
    : null;

  function addRecipe() {
    const r = createEmptyRecipe();
    setRecipes((prev) => [...prev, r]);
    setEditingId(r.id);
  }

  function updateRecipe(updated: Recipe) {
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function removeRecipe(recipeId: string) {
    const r = recipes.find((x) => x.id === recipeId);
    const label = r?.name || "Unnamed recipe";
    requestConfirm(label, () => {
      setRecipes((prev) => prev.filter((x) => x.id !== recipeId));
      setEditingId((prev) => (prev === recipeId ? null : prev));
    });
  }

  function addIngredient(ingredient: Ingredient) {
    setIngredients((prev) => [...prev, ingredient]);
  }

  if (!loaded) return null;

  return (
    <>
      <PageHeader
        title="Recipe library"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      <Card className="mb-4" data-testid="recipe-control-bar">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes..."
              data-testid="recipe-search"
            />
          </div>
          <div className="sm:w-56 shrink-0">
            <Select
              value={recipeSort}
              onChange={(e) => setRecipeSort(e.target.value)}
              data-testid="recipe-sort"
            >
              {RECIPE_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={addRecipe}>Add recipe</Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/household/${householdId}/import-recipe`)}
            data-testid="recipe-library-import-link"
          >
            Import recipe
          </Button>
          <Button onClick={() => navigate(`/household/${householdId}/import-paprika`)}>
            Import from Paprika
          </Button>
        </div>
      </Card>

      <h2
        className="mb-3 text-sm font-medium text-text-secondary"
        data-testid="recipe-list-summary"
      >
        <span>Recipes ({recipes.length})</span>
        {filteredRecipes.length !== recipes.length && (
          <span>{` · ${filteredRecipes.length} match${filteredRecipes.length !== 1 ? "es" : ""}`}</span>
        )}
        {sortedRecipes.length > 0 && visibleRecipes.length < sortedRecipes.length && (
          <span>{` · showing ${visibleRecipes.length} of ${sortedRecipes.length}`}</span>
        )}
      </h2>

      {recipes.length === 0 ? (
        <div data-testid="recipe-library-empty">
          <EmptyState>
            No recipes yet. Import from Paprika or paste an ingredient list. When you are ready to plan a night, promote a recipe to a{" "}
            <button
              type="button"
              className="font-medium text-brand hover:underline"
              onClick={() => navigate(`/household/${householdId}/meals`)}
            >
              base meal
            </button>
            .
          </EmptyState>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <EmptyState>No recipes match your search.</EmptyState>
      ) : (
        <div className="space-y-1.5" data-testid="recipe-list">
          {visibleRecipes.map((r) => (
            <RecipeRow key={r.id} recipe={r} onClick={() => setEditingId(r.id)} />
          ))}
          <div ref={recipeListSentinelRef} className="h-px w-full" aria-hidden />
          {recipeListHasMore && (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="default" onClick={loadMoreRecipes} data-testid="recipe-list-load-more">
                Load more recipes
              </Button>
            </div>
          )}
        </div>
      )}

      {editingRecipe && householdId && (
        <RecipeModal
          recipe={editingRecipe}
          ingredients={ingredients}
          baseMeals={baseMeals}
          onChange={updateRecipe}
          onClose={() => setEditingId(null)}
          onRemove={() => removeRecipe(editingRecipe.id)}
          onAddIngredient={addIngredient}
          householdId={householdId}
        />
      )}

      <ConfirmDialog
        open={!!pending}
        title="Remove recipe"
        message={`Are you sure you want to remove "${pending?.entityName}"? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </>
  );
}
