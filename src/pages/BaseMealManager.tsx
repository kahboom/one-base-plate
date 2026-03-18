import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { BaseMeal, MealComponent, Ingredient, RecipeLink, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold, toSentenceCase, normalizeIngredientName } from "../storage";
import { PageShell, PageHeader, Card, Button, Input, Select, FieldLabel, EmptyState, Chip, ConfirmDialog, useConfirm, HouseholdNav, SectionNav } from "../components/ui";

type ComponentRole = MealComponent["role"];
const COMPONENT_ROLES: ComponentRole[] = ["protein", "carb", "veg", "sauce", "topping"];
const DIFFICULTY_OPTIONS: BaseMeal["difficulty"][] = ["easy", "medium", "hard"];
const DIFFICULTY_CHIP_VARIANT: Record<BaseMeal["difficulty"], "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};
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
      name: normalizeIngredientName(trimmed),
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
  index,
  defaultExpanded,
  onChange,
  onRemove,
  onAddIngredient,
}: {
  component: MealComponent;
  ingredients: Ingredient[];
  index: number;
  defaultExpanded?: boolean;
  onChange: (updated: MealComponent) => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
}) {
  const alternatives = component.alternativeIngredientIds ?? [];
  const usedIds = new Set([component.ingredientId, ...alternatives]);
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showAlternativePicker, setShowAlternativePicker] = useState(false);
  const [alternativeSearch, setAlternativeSearch] = useState("");
  const [selectedAlternativeId, setSelectedAlternativeId] = useState("");

  const primaryIngredient = ingredients.find((item) => item.id === component.ingredientId);
  const alternativeIngredients = alternatives
    .map((altId) => ingredients.find((item) => item.id === altId))
    .filter((item): item is Ingredient => !!item);

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

  const filteredAlternativeOptions = ingredients.filter((ing) => {
    if (usedIds.has(ing.id)) return false;
    if (!alternativeSearch.trim()) return true;
    return ing.name.toLowerCase().includes(alternativeSearch.trim().toLowerCase());
  });

  function handleAddSelectedAlternative() {
    if (!selectedAlternativeId) return;
    addAlternative(selectedAlternativeId);
    setSelectedAlternativeId("");
    setAlternativeSearch("");
  }

  const summaryParts = [
    primaryIngredient ? toSentenceCase(primaryIngredient.name) : "Choose ingredient",
    component.role,
    component.quantity?.trim() ? component.quantity : "No quantity",
  ];

  return (
    <div
      data-testid={`component-card-${index}`}
      className="rounded-md border border-border-light bg-surface-card p-3"
    >
      <button
        type="button"
        data-testid={`component-toggle-${index}`}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-text-primary">
            {summaryParts.join(" · ")}
          </span>
          <span className="mt-1 block text-xs text-text-muted">
            {alternatives.length > 0 ? `${alternatives.length} alternatives` : "No alternatives"}
          </span>
        </span>
        <Chip variant="neutral">{expanded ? "Collapse" : "Edit"}</Chip>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border-light pt-4">
          <FieldLabel label="Default ingredient">
            <Select
              value={component.ingredientId}
              onChange={(e) => onChange({ ...component, ingredientId: e.target.value })}
            >
              <option value="">Select ingredient</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {toSentenceCase(ing.name)} ({ing.category})
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

          <div data-testid={`default-ingredient-${index}`}>
            <span className="mb-1 block text-xs font-medium text-text-secondary">Default ingredient</span>
            <Chip variant="success">
              {primaryIngredient ? toSentenceCase(primaryIngredient.name) : "No default ingredient selected"}
            </Chip>
          </div>

          <div data-testid={`alternatives-list-${index}`}>
            <span className="mb-1 block text-xs font-medium text-text-secondary">Alternatives</span>
            {alternativeIngredients.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {alternativeIngredients.map((ing) => (
                  <span key={ing.id} className="inline-flex items-center gap-1">
                    <Chip variant="info">{toSentenceCase(ing.name)}</Chip>
                    <Button
                      variant="ghost"
                      small
                      className="text-text-muted hover:text-danger"
                      onClick={() => removeAlternative(ing.id)}
                      aria-label={`Remove alternative ${ing.name}`}
                    >
                      Remove
                    </Button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-text-muted">No alternatives added yet.</span>
            )}
          </div>

          {showAlternativePicker ? (
            <div className="rounded-sm border border-border-light bg-surface p-3 space-y-3" data-testid={`alternative-picker-${index}`}>
              <Input
                type="search"
                value={alternativeSearch}
                onChange={(e) => setAlternativeSearch(e.target.value)}
                placeholder="Search ingredients..."
                data-testid={`alternative-search-${index}`}
              />
              <Select
                value={selectedAlternativeId}
                onChange={(e) => setSelectedAlternativeId(e.target.value)}
                data-testid={`add-alternative-${index}`}
              >
                <option value="">Select alternative ingredient</option>
                {filteredAlternativeOptions.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {toSentenceCase(ing.name)} ({ing.category})
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-2">
                <Button small onClick={handleAddSelectedAlternative} disabled={!selectedAlternativeId}>
                  Add alternative
                </Button>
                <Button small onClick={() => setShowAlternativePicker(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <Button small onClick={() => setShowAlternativePicker(true)}>Add alternative</Button>
          )}

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
              className="max-w-[220px]"
            />
          </FieldLabel>

          <FieldLabel label="Prep note (optional)">
            <Input
              type="text"
              value={component.prepNote ?? ""}
              onChange={(e) => onChange({ ...component, prepNote: e.target.value || undefined })}
              placeholder="e.g. keep separate, blend, roast longer"
            />
          </FieldLabel>

          <Button
            variant="ghost"
            small
            className="text-danger hover:text-danger"
            onClick={onRemove}
          >
            Remove component
          </Button>
        </div>
      )}
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
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1"
                data-testid={`recipe-link-anchor-${i}`}
              >
                <span className="flex min-w-0 items-center gap-2 rounded-sm border border-border-light bg-bg px-2 py-1.5 transition-colors hover:bg-surface-card">
                  <Chip variant="info">{link.label}</Chip>
                  <span className="truncate text-xs text-text-muted">{link.url}</span>
                </span>
              </a>
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

function MealModal({
  meal,
  ingredients,
  onChange,
  onClose,
  onRemove,
  onAddIngredient,
}: {
  meal: BaseMeal;
  ingredients: Ingredient[];
  onChange: (updated: BaseMeal) => void;
  onClose: () => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
}) {
  const [openComponentIndexes, setOpenComponentIndexes] = useState<number[]>([]);

  function addComponent() {
    const newComponent: MealComponent = {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Edit meal">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-md border border-border-light bg-surface shadow-card-hover" data-testid="meal-modal">
        <div className="sticky top-0 z-10 border-b border-border-light bg-surface px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-text-primary">
                {toSentenceCase(meal.name) || "New meal"}
              </h2>
              <span className="text-xs text-text-muted">
                Build one shared meal structure with clear component choices
              </span>
            </div>
            <Button variant="ghost" onClick={onClose} aria-label="Close modal">Close</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="meal-summary-chips">
            <Chip variant="info">{meal.estimatedTimeMinutes} min</Chip>
            <Chip variant={DIFFICULTY_CHIP_VARIANT[meal.difficulty]}>{meal.difficulty}</Chip>
            <Chip variant={meal.rescueEligible ? "success" : "neutral"}>
              {meal.rescueEligible ? "Rescue eligible" : "Not rescue"}
            </Chip>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          <section data-testid="meal-identity-section" className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">1. Meal identity</h3>
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
              <Button small onClick={addComponent}>Add component</Button>
            </div>
            {meal.components.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border-default bg-bg p-3 text-sm text-text-muted">
                No components yet. Add protein, carb, veg, sauce, or topping components to define this meal.
              </div>
            ) : (
              <div className="space-y-2">
                {meal.components.map((comp, i) => (
                  <ComponentForm
                    key={i}
                    index={i}
                    defaultExpanded={openComponentIndexes.includes(i)}
                    component={comp}
                    ingredients={ingredients}
                    onChange={(updated) => updateComponent(i, updated)}
                    onRemove={() => removeComponent(i)}
                    onAddIngredient={onAddIngredient}
                  />
                ))}
              </div>
            )}
          </section>

          <section data-testid="meal-planning-section" className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">3. Planning metadata</h3>
            <div className="grid gap-3 sm:grid-cols-2">
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
                  className="max-w-[180px]"
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
          </section>

          <section data-testid="meal-secondary-section" className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">4. References and notes</h3>

            <details data-testid="recipe-links-section" className="rounded-sm border border-border-light bg-surface-card p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-primary">Recipe links</summary>
              <RecipeLinksEditor
                links={meal.recipeLinks ?? []}
                onChange={(recipeLinks) => onChange({ ...meal, recipeLinks })}
              />
            </details>

            <details data-testid="notes-section" className="rounded-sm border border-border-light bg-surface-card p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-primary">Notes</summary>
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

            <details data-testid="image-section" className="rounded-sm border border-border-light bg-surface-card p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-primary">Image</summary>
              <FieldLabel label="Image" className="mt-3">
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
            </details>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border-light bg-surface px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            small
            className="text-danger hover:text-danger"
            onClick={onRemove}
          >
            Remove meal
          </Button>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-text-muted sm:block">Changes auto-save as you edit</span>
            <Button variant="primary" onClick={onClose}>Save meal</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MealRow({
  meal,
  onClick,
}: {
  meal: BaseMeal;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-border-light bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card cursor-pointer min-h-[48px]"
      onClick={onClick}
      data-testid={`meal-row-${meal.id}`}
      aria-label={`Edit ${meal.name || "unnamed meal"}`}
    >
      {meal.imageUrl && (
        <img
          src={meal.imageUrl}
          alt=""
          className="h-8 w-8 flex-shrink-0 rounded object-cover border border-border-light"
        />
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text-primary truncate">
          {meal.name ? toSentenceCase(meal.name) : <span className="italic text-text-muted">Unnamed</span>}
        </span>
        <span className="block text-xs text-text-muted truncate">
          {meal.defaultPrep ? toSentenceCase(meal.defaultPrep) : "No prep set"} · {meal.estimatedTimeMinutes} min · {meal.components.length} components
        </span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-1.5">
        <Chip variant={DIFFICULTY_CHIP_VARIANT[meal.difficulty]} className="text-[10px]">
          {meal.difficulty}
        </Chip>
        {meal.rescueEligible && (
          <Chip variant="info" className="text-[10px]">rescue</Chip>
        )}
      </span>
    </button>
  );
}

export default function BaseMealManager() {
  const { householdId } = useParams<{ householdId: string }>();

  const [meals, setMeals] = useState<BaseMeal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  const editingMeal = editingId
    ? meals.find((meal) => meal.id === editingId) ?? null
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
    <PageShell>
      <HouseholdNav householdId={householdId ?? ""} />
      <PageHeader
        title="Base Meals"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/households?edit=${householdId}`}
      />
      <SectionNav householdId={householdId ?? ""} />

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
          <Button onClick={addMeal}>Add meal</Button>
          <Link to={`/household/${householdId}/import-recipe`}>
            <Button data-testid="import-recipe-btn">Import recipe</Button>
          </Link>
          <Link to={`/household/${householdId}/import-paprika`}>
            <Button data-testid="import-paprika-btn">Import Paprika</Button>
          </Link>
        </div>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-text-secondary">
        Meals ({meals.length}){filteredMeals.length !== meals.length && ` · showing ${filteredMeals.length}`}
      </h2>

      {meals.length === 0 ? (
        <EmptyState>No meals yet. Add one to get started.</EmptyState>
      ) : filteredMeals.length === 0 ? (
        <EmptyState>No meals match your search.</EmptyState>
      ) : (
        <div className="space-y-1.5" data-testid="meal-list">
          {filteredMeals.map((meal) => (
            <MealRow
              key={meal.id}
              meal={meal}
              onClick={() => setEditingId(meal.id)}
            />
          ))}
        </div>
      )}

      {editingMeal && (
        <MealModal
          meal={editingMeal}
          ingredients={ingredients}
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
    </PageShell>
  );
}
