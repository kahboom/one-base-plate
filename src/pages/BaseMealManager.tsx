import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { BaseMeal, MealComponent, Ingredient, RecipeLink, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { PageShell, PageHeader, Card, Button, Input, Select, ActionGroup, FieldLabel, EmptyState, Chip, ConfirmDialog, useConfirm, HouseholdNav } from "../components/ui";

type ComponentRole = MealComponent["role"];
const COMPONENT_ROLES: ComponentRole[] = ["protein", "carb", "veg", "sauce", "topping"];
const DIFFICULTY_OPTIONS: BaseMeal["difficulty"][] = ["easy", "medium", "hard"];
const CATEGORY_OPTIONS: IngredientCategory[] = [
  "protein", "carb", "veg", "fruit", "dairy", "snack", "freezer", "pantry",
];

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

function InlineIngredientForm({
  onAdd,
  onCancel,
}: {
  onAdd: (ingredient: Ingredient) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<IngredientCategory>("pantry");

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ingredient: Ingredient = {
      id: crypto.randomUUID(),
      name: trimmed,
      category,
      tags: [],
      shelfLifeHint: "",
      freezerFriendly: false,
      babySafeWithAdaptation: false,
    };
    onAdd(ingredient);
  }

  return (
    <div data-testid="inline-ingredient-form" className="mt-2 rounded-sm border border-brand bg-bg p-3 space-y-3">
      <span className="block text-xs font-semibold text-brand">New ingredient</span>
      <FieldLabel label="Name">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ingredient name"
          data-testid="inline-ingredient-name"
        />
      </FieldLabel>
      <FieldLabel label="Category">
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as IngredientCategory)}
          data-testid="inline-ingredient-category"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </FieldLabel>
      <div className="flex gap-2">
        <Button small variant="primary" onClick={handleAdd} data-testid="inline-ingredient-save">Add ingredient</Button>
        <Button small onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function ComponentForm({
  component,
  ingredients,
  onChange,
  onRemove,
  onAddIngredient,
}: {
  component: MealComponent;
  ingredients: Ingredient[];
  onChange: (updated: MealComponent) => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
}) {
  const alternatives = component.alternativeIngredientIds ?? [];
  const usedIds = new Set([component.ingredientId, ...alternatives]);

  function addAlternative(ingredientId: string) {
    if (!ingredientId || usedIds.has(ingredientId)) return;
    onChange({ ...component, alternativeIngredientIds: [...alternatives, ingredientId] });
  }

  function removeAlternative(ingredientId: string) {
    onChange({
      ...component,
      alternativeIngredientIds: alternatives.filter((id) => id !== ingredientId),
    });
  }

  const [showInlineForm, setShowInlineForm] = useState(false);

  return (
    <div data-testid={`component-${component.ingredientId || "empty"}`} className="mb-3 rounded-sm border border-border-light p-3">
      <div className="space-y-3">
        <FieldLabel label="Ingredient">
          <Select
            value={component.ingredientId}
            onChange={(e) => onChange({ ...component, ingredientId: e.target.value })}
          >
            <option value="">Select ingredient</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name} ({ing.category})
              </option>
            ))}
          </Select>
        </FieldLabel>

        {showInlineForm ? (
          <InlineIngredientForm
            onAdd={(ing) => {
              onAddIngredient(ing);
              onChange({ ...component, ingredientId: ing.id });
              setShowInlineForm(false);
            }}
            onCancel={() => setShowInlineForm(false)}
          />
        ) : (
          <Button variant="ghost" small onClick={() => setShowInlineForm(true)} data-testid="add-ingredient-inline">
            + Add new ingredient
          </Button>
        )}

        {alternatives.length > 0 && (
          <div data-testid="alternatives-list">
            <span className="mb-1 block text-xs font-medium text-text-secondary">Alternative options:</span>
            <div className="flex flex-wrap gap-1">
              {alternatives.map((altId) => {
                const ing = ingredients.find((i) => i.id === altId);
                return (
                  <span key={altId} className="inline-flex items-center gap-1">
                    <Chip variant="info">{ing?.name ?? altId}</Chip>
                    <Button variant="ghost" small onClick={() => removeAlternative(altId)}>x</Button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <FieldLabel label="Add alternative">
          <Select
            value=""
            onChange={(e) => addAlternative(e.target.value)}
            data-testid="add-alternative"
          >
            <option value="">Add alternative ingredient...</option>
            {ingredients
              .filter((ing) => !usedIds.has(ing.id))
              .map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.category})
                </option>
              ))}
          </Select>
        </FieldLabel>

        <FieldLabel label="Role">
          <Select
            value={component.role}
            onChange={(e) => onChange({ ...component, role: e.target.value as ComponentRole })}
          >
            {COMPONENT_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel label="Quantity">
          <Input
            type="text"
            value={component.quantity}
            onChange={(e) => onChange({ ...component, quantity: e.target.value })}
            placeholder="e.g. 200g"
            className="max-w-[200px]"
          />
        </FieldLabel>
      </div>
      <Button variant="danger" small onClick={onRemove} className="mt-2">Remove component</Button>
    </div>
  );
}

function RecipeLinksEditor({
  links,
  onChange,
}: {
  links: RecipeLink[];
  onChange: (links: RecipeLink[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  function addLink() {
    const trimmedUrl = newUrl.trim();
    const trimmedLabel = newLabel.trim() || trimmedUrl;
    if (!trimmedUrl) return;
    onChange([...links, { label: trimmedLabel, url: trimmedUrl }]);
    setNewLabel("");
    setNewUrl("");
  }

  function removeLink(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-4" data-testid="recipe-links-editor">
      <h3 className="mb-2 text-base font-semibold text-text-primary">
        Recipe links ({links.length})
      </h3>
      {links.length > 0 && (
        <div className="mb-3 space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`recipe-link-${i}`}>
              <Chip variant="info">{link.label}</Chip>
              <span className="truncate text-xs text-text-muted">{link.url}</span>
              <Button variant="ghost" small onClick={() => removeLink(i)}>x</Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (e.g. Gousto)"
          className="sm:max-w-[180px]"
          data-testid="recipe-link-label"
        />
        <Input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL"
          data-testid="recipe-link-url"
        />
        <Button small onClick={addLink}>Add link</Button>
      </div>
    </div>
  );
}

function MealForm({
  meal,
  ingredients,
  onChange,
  onRemove,
  onAddIngredient,
}: {
  meal: BaseMeal;
  ingredients: Ingredient[];
  onChange: (updated: BaseMeal) => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
}) {
  function addComponent() {
    const newComponent: MealComponent = {
      ingredientId: "",
      role: "protein",
      quantity: "",
    };
    onChange({ ...meal, components: [...meal.components, newComponent] });
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
  }

  return (
    <Card data-testid={`meal-${meal.id}`} className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-secondary">Base Meal</span>
        <Button variant="danger" small onClick={onRemove}>Remove meal</Button>
      </div>

      <div className="space-y-4">
        <FieldLabel label="Name">
          <Input
            type="text"
            value={meal.name}
            onChange={(e) => onChange({ ...meal, name: e.target.value })}
            placeholder="Meal name"
            required
          />
        </FieldLabel>

        <FieldLabel label="Default prep">
          <Input
            type="text"
            value={meal.defaultPrep}
            onChange={(e) => onChange({ ...meal, defaultPrep: e.target.value })}
            placeholder="e.g. stir-fry, roast"
          />
        </FieldLabel>

        <FieldLabel label="Time (minutes)">
          <Input
            type="number"
            value={meal.estimatedTimeMinutes}
            onChange={(e) =>
              onChange({ ...meal, estimatedTimeMinutes: parseInt(e.target.value, 10) || 0 })
            }
            min={0}
            className="max-w-[120px]"
          />
        </FieldLabel>

        <FieldLabel label="Difficulty">
          <Select
            value={meal.difficulty}
            onChange={(e) =>
              onChange({ ...meal, difficulty: e.target.value as BaseMeal["difficulty"] })
            }
          >
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </FieldLabel>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand"
            checked={meal.rescueEligible}
            onChange={(e) => onChange({ ...meal, rescueEligible: e.target.checked })}
          />
          Rescue eligible
        </label>
      </div>

      <FieldLabel label="Image" className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="url"
            value={meal.imageUrl ?? ""}
            onChange={(e) => onChange({ ...meal, imageUrl: e.target.value || undefined })}
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
                  onChange({ ...meal, imageUrl: reader.result as string });
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
        {meal.imageUrl && (
          <div className="mt-2">
            <img
              src={meal.imageUrl}
              alt={meal.name || "Meal"}
              className="h-24 w-36 rounded-md border border-border-light object-cover"
              data-testid="meal-image-preview"
            />
          </div>
        )}
      </FieldLabel>

      <RecipeLinksEditor
        links={meal.recipeLinks ?? []}
        onChange={(recipeLinks) => onChange({ ...meal, recipeLinks })}
      />

      <FieldLabel label="Notes" className="mt-4">
        <textarea
          className="w-full rounded-lg border border-border-light bg-surface-card p-3 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
          rows={3}
          value={meal.notes ?? ""}
          onChange={(e) => onChange({ ...meal, notes: e.target.value })}
          placeholder="e.g. Gousto version works well, blend toddler sauce"
          data-testid="meal-notes"
        />
      </FieldLabel>

      <h3 className="mt-4 mb-2 text-base font-semibold text-text-primary">
        Components ({meal.components.length})
      </h3>
      {meal.components.map((comp, i) => (
        <ComponentForm
          key={i}
          component={comp}
          ingredients={ingredients}
          onChange={(updated) => updateComponent(i, updated)}
          onRemove={() => removeComponent(i)}
          onAddIngredient={onAddIngredient}
        />
      ))}

      <Button small onClick={addComponent}>Add component</Button>
    </Card>
  );
}

export default function BaseMealManager() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [meals, setMeals] = useState<BaseMeal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setMeals(household.baseMeals);
      setIngredients(household.ingredients);
      setHouseholdName(household.name);
    }
    setLoaded(true);
  }, [householdId]);

  function addMeal() {
    setMeals((prev) => [...prev, createEmptyMeal()]);
  }

  function updateMeal(index: number, updated: BaseMeal) {
    setMeals((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }

  function removeMeal(index: number) {
    const mealName = meals[index]?.name || "Unnamed meal";
    requestConfirm(mealName, () => {
      setMeals((prev) => prev.filter((_, i) => i !== index));
    });
  }

  function addIngredient(ingredient: Ingredient) {
    setIngredients((prev) => [...prev, ingredient]);
  }

  function handleSave() {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.baseMeals = meals;
    household.ingredients = ingredients;
    saveHousehold(household);
    navigate(`/household/${householdId}/home`);
  }

  if (!loaded) return null;

  return (
    <PageShell>
      <HouseholdNav householdId={householdId ?? ""} />
      <PageHeader title="Base Meals" subtitle={`Household: ${householdName}`} />

      <h2 className="mb-4 text-xl font-semibold text-text-primary">Meals ({meals.length})</h2>

      {meals.length === 0 && (
        <EmptyState>No meals yet. Add one to get started.</EmptyState>
      )}

      {meals.map((meal, i) => (
        <MealForm
          key={meal.id}
          meal={meal}
          ingredients={ingredients}
          onChange={(updated) => updateMeal(i, updated)}
          onRemove={() => removeMeal(i)}
          onAddIngredient={addIngredient}
        />
      ))}

      <Button onClick={addMeal} className="mb-4">Add meal</Button>

      <ActionGroup>
        <Button variant="primary" onClick={handleSave}>Save meals</Button>
        <Button onClick={() => navigate(`/household/${householdId}/home`)}>Cancel</Button>
      </ActionGroup>

      <ConfirmDialog
        open={!!pending}
        title="Remove meal"
        message={`Are you sure you want to remove "${pending?.entityName}"? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </PageShell>
  );
}
