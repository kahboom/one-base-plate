import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  BaseMeal,
  ComponentRecipeRef,
  Ingredient,
  MealComponent,
  Recipe,
  RecipeRef,
} from "../types";
import { loadHousehold, saveHousehold, normalizeHousehold } from "../storage";
import { promoteRecipeToBaseMeal } from "../lib/promoteRecipe";
import { Card, Button, Input, FieldLabel, Chip, ActionGroup, EmptyState } from "./ui";

type Destination =
  | "choose"
  | "promote"
  | "attach-meal"
  | "attach-component";

interface PostImportDestinationProps {
  householdId: string;
  recipes: Recipe[];
  baseMeals: BaseMeal[];
  allRecipes: Recipe[];
  ingredients: Ingredient[];
  onComplete: () => void;
}

export default function PostImportDestination({
  householdId,
  recipes,
  baseMeals,
  allRecipes,
  ingredients,
  onComplete,
}: PostImportDestinationProps) {
  const navigate = useNavigate();
  const isBatch = recipes.length > 1;
  const [activeRecipeIndex, setActiveRecipeIndex] = useState(0);
  const activeRecipe = recipes[activeRecipeIndex];

  const [destination, setDestination] = useState<Destination>("choose");

  const [difficulty, setDifficulty] = useState<BaseMeal["difficulty"]>("medium");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [rescueEligible, setRescueEligible] = useState(false);

  const [mealSearch, setMealSearch] = useState("");
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  const filteredMeals = useMemo(() => {
    const q = mealSearch.trim().toLowerCase();
    const list = baseMeals.filter(
      (m) => !q || m.name.toLowerCase().includes(q),
    );
    return list.slice(0, 20);
  }, [baseMeals, mealSearch]);

  const selectedMeal = baseMeals.find((m) => m.id === selectedMealId);

  function resetDestinationState() {
    setDestination("choose");
    setDifficulty("medium");
    setEstimatedMinutes(30);
    setRescueEligible(false);
    setMealSearch("");
    setSelectedMealId(null);
    setSelectedComponentId(null);
  }

  function handleDone() {
    navigate(`/household/${householdId}/recipes`);
  }

  function handlePromote() {
    if (!activeRecipe) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    const norm = normalizeHousehold(household);

    const recipe = norm.recipes.find((r) => r.id === activeRecipe.id);
    if (!recipe) return;

    const meal = promoteRecipeToBaseMeal(recipe, {
      difficulty,
      rescueEligible,
      estimatedTimeMinutes: estimatedMinutes > 0 ? estimatedMinutes : 30,
    });
    saveHousehold(
      normalizeHousehold({ ...norm, baseMeals: [...norm.baseMeals, meal] }),
    );

    if (isBatch && activeRecipeIndex < recipes.length - 1) {
      advanceToNext();
    } else {
      navigate(`/household/${householdId}/meal/${meal.id}`);
    }
  }

  function handleAttachToMeal() {
    if (!activeRecipe || !selectedMealId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    const norm = normalizeHousehold(household);

    const mealIdx = norm.baseMeals.findIndex((m) => m.id === selectedMealId);
    if (mealIdx < 0) return;

    const meal = norm.baseMeals[mealIdx]!;
    const existingRefs = meal.recipeRefs ?? [];
    if (existingRefs.some((r) => r.recipeId === activeRecipe.id)) {
      if (isBatch && activeRecipeIndex < recipes.length - 1) {
        advanceToNext();
      } else {
        navigate(`/household/${householdId}/meal/${selectedMealId}`);
      }
      return;
    }

    const ref: RecipeRef = {
      recipeId: activeRecipe.id,
      label: activeRecipe.name,
      role: "primary",
    };
    const updated: BaseMeal = {
      ...meal,
      recipeRefs: [...existingRefs, ref],
    };
    const newMeals = [...norm.baseMeals];
    newMeals[mealIdx] = updated;
    saveHousehold(normalizeHousehold({ ...norm, baseMeals: newMeals }));

    if (isBatch && activeRecipeIndex < recipes.length - 1) {
      advanceToNext();
    } else {
      navigate(`/household/${householdId}/meal/${selectedMealId}`);
    }
  }

  function handleAttachToComponent() {
    if (!activeRecipe || !selectedMealId || !selectedComponentId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    const norm = normalizeHousehold(household);

    const mealIdx = norm.baseMeals.findIndex((m) => m.id === selectedMealId);
    if (mealIdx < 0) return;

    const meal = norm.baseMeals[mealIdx]!;
    const compIdx = meal.components.findIndex((c) => c.id === selectedComponentId);
    if (compIdx < 0) return;

    const comp = meal.components[compIdx]!;
    const newRef: ComponentRecipeRef = {
      id: crypto.randomUUID(),
      componentId: selectedComponentId,
      sourceType: "imported-recipe",
      recipeId: activeRecipe.id,
      label: activeRecipe.name,
      isDefault: true,
    };

    const updatedComp: MealComponent = {
      ...comp,
      recipeRefs: [...(comp.recipeRefs ?? []), newRef],
    };
    const newComponents = [...meal.components];
    newComponents[compIdx] = updatedComp;
    const updated: BaseMeal = { ...meal, components: newComponents };
    const newMeals = [...norm.baseMeals];
    newMeals[mealIdx] = updated;
    saveHousehold(normalizeHousehold({ ...norm, baseMeals: newMeals }));

    if (isBatch && activeRecipeIndex < recipes.length - 1) {
      advanceToNext();
    } else {
      navigate(`/household/${householdId}/meal/${selectedMealId}`);
    }
  }

  function advanceToNext() {
    setActiveRecipeIndex((prev) => prev + 1);
    resetDestinationState();
  }

  function ingredientName(id: string) {
    return ingredients.find((i) => i.id === id)?.name ?? id;
  }

  if (!activeRecipe) {
    return (
      <div data-testid="post-import-destination">
        <Card className="mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Import complete
          </h3>
          <p className="text-sm text-text-secondary">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""} saved to your library.
          </p>
        </Card>
        <ActionGroup>
          <Button variant="primary" onClick={handleDone} data-testid="go-to-recipes-btn">
            View recipe library
          </Button>
          <Button onClick={onComplete}>Home</Button>
        </ActionGroup>
      </div>
    );
  }

  return (
    <div data-testid="post-import-destination">
      {isBatch && (
        <div className="mb-3 flex items-center gap-2">
          <Chip variant="neutral">
            Recipe {activeRecipeIndex + 1} of {recipes.length}
          </Chip>
          <span className="text-sm font-medium text-text-primary truncate">
            {activeRecipe.name}
          </span>
        </div>
      )}

      {destination === "choose" && (
        <div data-testid="destination-choose">
          <Card className="mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {isBatch ? `What would you like to do with "${activeRecipe.name}"?` : "Recipe saved — what next?"}
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Your recipe has been saved to the library. You can also use it for meal planning right away.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg border border-border-light p-3 text-left hover:bg-bg transition-colors"
                onClick={handleDone}
                data-testid="dest-recipe-only"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">Keep as recipe only</p>
                  <p className="text-xs text-text-muted">Browse it later in your recipe library</p>
                </div>
              </button>

              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg border border-border-light p-3 text-left hover:bg-bg transition-colors"
                onClick={() => {
                  const fromTimes =
                    (activeRecipe.prepTimeMinutes ?? 0) + (activeRecipe.cookTimeMinutes ?? 0) || 0;
                  if (fromTimes > 0) setEstimatedMinutes(fromTimes);
                  setDestination("promote");
                }}
                data-testid="dest-new-base-meal"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">Create a new base meal</p>
                  <p className="text-xs text-text-muted">Make it available for weekly planning and grocery lists</p>
                </div>
              </button>

              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg border border-border-light p-3 text-left hover:bg-bg transition-colors"
                onClick={() => setDestination("attach-meal")}
                data-testid="dest-attach-meal"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">Attach to an existing base meal</p>
                  <p className="text-xs text-text-muted">Link this recipe as a reference on a meal you already have</p>
                </div>
              </button>

              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg border border-border-light p-3 text-left hover:bg-bg transition-colors"
                onClick={() => setDestination("attach-component")}
                data-testid="dest-component-recipe"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">Use as a component recipe</p>
                  <p className="text-xs text-text-muted">Assign as the recipe for a specific protein, sauce, or side on a meal</p>
                </div>
              </button>
            </div>
          </Card>

          {isBatch && (
            <ActionGroup>
              <Button
                onClick={() => {
                  if (activeRecipeIndex < recipes.length - 1) {
                    advanceToNext();
                  } else {
                    handleDone();
                  }
                }}
                data-testid="dest-skip"
              >
                {activeRecipeIndex < recipes.length - 1 ? "Skip this recipe" : "Done"}
              </Button>
              <Button onClick={handleDone} data-testid="dest-finish-all">
                Finish — go to library
              </Button>
            </ActionGroup>
          )}
        </div>
      )}

      {destination === "promote" && (
        <div data-testid="destination-promote">
          <Card className="mb-4">
            <h3 className="mb-2 text-lg font-semibold text-text-primary">
              Create base meal from "{activeRecipe.name}"
            </h3>
            <p className="mb-4 text-sm text-text-secondary">
              This creates a plan-able base meal linked to your library recipe.
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
          </Card>

          <ActionGroup>
            <Button variant="primary" onClick={handlePromote} data-testid="promote-confirm-btn">
              Create base meal
            </Button>
            <Button onClick={() => setDestination("choose")}>Back</Button>
          </ActionGroup>
        </div>
      )}

      {destination === "attach-meal" && (
        <div data-testid="destination-attach-meal">
          <Card className="mb-4">
            <h3 className="mb-2 text-lg font-semibold text-text-primary">
              Attach "{activeRecipe.name}" to a base meal
            </h3>

            <FieldLabel label="Search meals">
              <Input
                type="search"
                value={mealSearch}
                onChange={(e) => setMealSearch(e.target.value)}
                placeholder="Search your base meals…"
                data-testid="attach-meal-search"
              />
            </FieldLabel>

            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto" data-testid="attach-meal-list">
              {filteredMeals.length === 0 && (
                <EmptyState>No meals found.</EmptyState>
              )}
              {filteredMeals.map((meal) => (
                <button
                  key={meal.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
                    selectedMealId === meal.id
                      ? "border-brand bg-brand/5 font-medium"
                      : "border-border-light hover:bg-bg"
                  }`}
                  onClick={() => setSelectedMealId(meal.id)}
                  data-testid={`attach-meal-option-${meal.id}`}
                >
                  <span className="truncate text-text-primary">{meal.name}</span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {meal.components.length} component{meal.components.length !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleAttachToMeal}
              disabled={!selectedMealId}
              data-testid="attach-meal-confirm"
            >
              Attach recipe
            </Button>
            <Button onClick={() => { setSelectedMealId(null); setDestination("choose"); }}>Back</Button>
          </ActionGroup>
        </div>
      )}

      {destination === "attach-component" && !selectedMealId && (
        <div data-testid="destination-component-meal-pick">
          <Card className="mb-4">
            <h3 className="mb-2 text-lg font-semibold text-text-primary">
              Choose a meal for "{activeRecipe.name}"
            </h3>
            <p className="mb-3 text-sm text-text-secondary">
              First pick the base meal, then choose which component slot this recipe belongs to.
            </p>

            <FieldLabel label="Search meals">
              <Input
                type="search"
                value={mealSearch}
                onChange={(e) => setMealSearch(e.target.value)}
                placeholder="Search your base meals…"
                data-testid="component-meal-search"
              />
            </FieldLabel>

            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto" data-testid="component-meal-list">
              {filteredMeals.length === 0 && (
                <EmptyState>No meals found.</EmptyState>
              )}
              {filteredMeals.map((meal) => (
                <button
                  key={meal.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-sm border border-border-light px-3 py-2 text-left text-sm hover:bg-bg transition-colors"
                  onClick={() => setSelectedMealId(meal.id)}
                  data-testid={`component-meal-option-${meal.id}`}
                >
                  <span className="truncate text-text-primary">{meal.name}</span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {meal.components.length} component{meal.components.length !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <ActionGroup>
            <Button onClick={() => setDestination("choose")}>Back</Button>
          </ActionGroup>
        </div>
      )}

      {destination === "attach-component" && selectedMeal && (
        <div data-testid="destination-component-slot-pick">
          <Card className="mb-4">
            <h3 className="mb-2 text-lg font-semibold text-text-primary">
              Pick a component on "{selectedMeal.name}"
            </h3>
            <p className="mb-3 text-sm text-text-secondary">
              Assign "{activeRecipe.name}" as the recipe for one of these component slots.
            </p>

            {selectedMeal.components.length === 0 ? (
              <EmptyState>This meal has no components.</EmptyState>
            ) : (
              <div className="space-y-1" data-testid="component-slot-list">
                {selectedMeal.components.map((comp) => (
                  <button
                    key={comp.id ?? comp.ingredientId}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
                      selectedComponentId === comp.id
                        ? "border-brand bg-brand/5 font-medium"
                        : "border-border-light hover:bg-bg"
                    }`}
                    onClick={() => setSelectedComponentId(comp.id ?? null)}
                    data-testid={`component-slot-${comp.id}`}
                  >
                    <Chip variant="info" className="shrink-0 text-[10px]">{comp.role}</Chip>
                    <span className="truncate text-text-primary">
                      {ingredientName(comp.ingredientId)}
                    </span>
                    {comp.quantity && (
                      <span className="shrink-0 text-xs text-text-muted">{comp.quantity}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleAttachToComponent}
              disabled={!selectedComponentId}
              data-testid="component-attach-confirm"
            >
              Assign recipe to component
            </Button>
            <Button onClick={() => { setSelectedMealId(null); setSelectedComponentId(null); }}>
              Back to meal list
            </Button>
          </ActionGroup>
        </div>
      )}
    </div>
  );
}
