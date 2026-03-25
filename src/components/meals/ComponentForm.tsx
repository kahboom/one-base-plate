import { useState } from "react";
import type {
  BaseMeal,
  MealComponent,
  Ingredient,
  IngredientCategory,
  ComponentRecipeRef,
  Recipe,
} from "../../types";
import { Button, Input, Select, FieldLabel, Chip } from "../ui";
import { normalizeIngredientName, toSentenceCase, ingredientMatchesQuery } from "../../storage";
import ComponentRecipePicker from "./ComponentRecipePicker";
import {
  getDefaultRecipeRef,
  summarizeRecipeRef,
  createComponentRecipeRef,
} from "../../lib/componentRecipes";

const CATEGORY_OPTIONS: IngredientCategory[] = [
  "protein",
  "carb",
  "veg",
  "fruit",
  "dairy",
  "snack",
  "freezer",
  "pantry",
];

type ComponentRole = MealComponent["role"];
const COMPONENT_ROLES: ComponentRole[] = [
  "protein",
  "carb",
  "veg",
  "sauce",
  "topping",
];

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
    <div
      data-testid="inline-ingredient-form"
      className="mt-2 rounded-sm border border-brand bg-bg p-3 space-y-3"
    >
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
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FieldLabel>
      <div className="flex gap-2">
        <Button
          small
          variant="primary"
          onClick={handleAdd}
          data-testid="inline-ingredient-save"
        >
          Add ingredient
        </Button>
        <Button small onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function ComponentForm({
  component,
  ingredients,
  index,
  defaultExpanded,
  onChange,
  onRemove,
  onAddIngredient,
  allMeals,
  recipes = [],
  excludeMealId,
}: {
  component: MealComponent;
  ingredients: Ingredient[];
  index: number;
  defaultExpanded?: boolean;
  onChange: (updated: MealComponent) => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
  allMeals: BaseMeal[];
  recipes?: Recipe[];
  /** Excluded when picking a linked base meal (use "" when editing a library recipe). */
  excludeMealId: string;
}) {
  const alternatives = component.alternativeIngredientIds ?? [];
  const usedIds = new Set([component.ingredientId, ...alternatives]);
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showAlternativePicker, setShowAlternativePicker] = useState(false);
  const [alternativeSearch, setAlternativeSearch] = useState("");
  const [selectedAlternativeId, setSelectedAlternativeId] = useState("");
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [altRecipePickerIngId, setAltRecipePickerIngId] = useState<string | null>(null);

  const primaryIngredient = ingredients.find((item) => item.id === component.ingredientId);
  const alternativeIngredients = alternatives
    .map((altId) => ingredients.find((item) => item.id === altId))
    .filter((item): item is Ingredient => !!item);

  function addAlternative(ingredientId: string) {
    if (!ingredientId || usedIds.has(ingredientId)) return;
    onChange({
      ...component,
      alternativeIngredientIds: [...alternatives, ingredientId],
    });
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
    return ingredientMatchesQuery(ing, alternativeSearch.trim());
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

  const defaultRef = getDefaultRecipeRef(component);
  const linkedName = defaultRef?.linkedBaseMealId
    ? allMeals.find((m) => m.id === defaultRef.linkedBaseMealId)?.name
    : undefined;

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
            {alternatives.length > 0
              ? `${alternatives.length} alternatives`
              : "No alternatives"}
            {defaultRef && (
              <span
                className="mt-0.5 block text-text-secondary"
                data-testid={`component-recipe-summary-${index}`}
              >
                Recipe: {summarizeRecipeRef(defaultRef, { linkedMealName: linkedName })}
              </span>
            )}
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
            <Button
              variant="ghost"
              small
              onClick={() => setShowInlineForm(true)}
              data-testid="add-ingredient-inline"
            >
              + Add new ingredient
            </Button>
          )}

          <div data-testid={`default-ingredient-${index}`}>
            <span className="mb-1 block text-xs font-medium text-text-secondary">
              Default ingredient
            </span>
            <Chip variant="success">
              {primaryIngredient
                ? toSentenceCase(primaryIngredient.name)
                : "No default ingredient selected"}
            </Chip>
          </div>

          <div data-testid={`alternatives-list-${index}`}>
            <span className="mb-1 block text-xs font-medium text-text-secondary">
              Alternatives
            </span>
            {alternativeIngredients.length > 0 ? (
              <div className="space-y-1.5">
                {alternativeIngredients.map((ing) => {
                  const altRef = (component.recipeRefs ?? []).find(
                    (r) => r.notes?.startsWith(`alt:${ing.id}`)
                  );
                  const altRefLabel = altRef
                    ? summarizeRecipeRef(altRef, {
                        linkedMealName: allMeals.find((m) => m.id === altRef.linkedBaseMealId)?.name,
                      })
                    : null;
                  return (
                    <div key={ing.id} className="flex flex-wrap items-center gap-1.5">
                      <Chip variant="info">{toSentenceCase(ing.name)}</Chip>
                      {altRefLabel && (
                        <Chip variant="neutral" className="text-[10px]" data-testid={`alt-recipe-chip-${ing.id}`}>
                          Recipe: {altRefLabel}
                        </Chip>
                      )}
                      <Button
                        variant="ghost"
                        small
                        className="text-text-muted text-[10px]"
                        onClick={() => setAltRecipePickerIngId(ing.id)}
                        data-testid={`attach-alt-recipe-${ing.id}`}
                      >
                        {altRef ? "Change recipe" : "Attach recipe"}
                      </Button>
                      <Button
                        variant="ghost"
                        small
                        className="text-text-muted hover:text-danger"
                        onClick={() => removeAlternative(ing.id)}
                        aria-label={`Remove alternative ${ing.name}`}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-text-muted">No alternatives added yet.</span>
            )}
          </div>

          {showAlternativePicker ? (
            <div
              className="rounded-sm border border-border-light bg-surface p-3 space-y-3"
              data-testid={`alternative-picker-${index}`}
            >
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
                <Button
                  small
                  onClick={handleAddSelectedAlternative}
                  disabled={!selectedAlternativeId}
                >
                  Add alternative
                </Button>
                <Button small onClick={() => setShowAlternativePicker(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <Button small onClick={() => setShowAlternativePicker(true)}>
              Add alternative
            </Button>
          )}

          <FieldLabel label="Role">
            <Select
              value={component.role}
              onChange={(e) =>
                onChange({
                  ...component,
                  role: e.target.value as ComponentRole,
                })
              }
            >
              {COMPONENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
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
              onChange={(e) =>
                onChange({
                  ...component,
                  prepNote: e.target.value || undefined,
                })
              }
              placeholder="e.g. keep separate, blend, roast longer"
            />
          </FieldLabel>

          <div
            className="rounded-sm border border-border-light bg-bg p-3 space-y-2"
            data-testid={`component-recipe-actions-${index}`}
          >
            <span className="text-xs font-semibold text-text-secondary">
              How to make this component
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                small
                onClick={() => setRecipePickerOpen(true)}
                data-testid={`attach-recipe-${index}`}
              >
                {defaultRef ? "Change recipe" : "Attach recipe"}
              </Button>
              {defaultRef && (
                <Button
                  type="button"
                  small
                  variant="ghost"
                  data-testid={`remove-recipe-${index}`}
                  onClick={() => onChange({ ...component, recipeRefs: [] })}
                >
                  Remove recipe
                </Button>
              )}
            </div>
          </div>

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

      {recipePickerOpen && component.id && (
        <ComponentRecipePicker
          open
          onClose={() => setRecipePickerOpen(false)}
          component={component}
          excludeMealId={excludeMealId}
          baseMeals={allMeals}
          recipes={recipes}
          onSave={(ref: ComponentRecipeRef) => {
            const withId = createComponentRecipeRef({
              ...ref,
              componentId: component.id!,
              isDefault: true,
            });
            const rest = (component.recipeRefs ?? [])
              .filter((r) => r.id !== withId.id)
              .map((r) => ({
                ...r,
                isDefault: false,
              }));
            onChange({
              ...component,
              recipeRefs: [withId, ...rest],
            });
            setRecipePickerOpen(false);
          }}
        />
      )}

      {altRecipePickerIngId && component.id && (
        <ComponentRecipePicker
          open
          onClose={() => setAltRecipePickerIngId(null)}
          component={component}
          excludeMealId={excludeMealId}
          baseMeals={allMeals}
          recipes={recipes}
          onSave={(ref: ComponentRecipeRef) => {
            const altIngId = altRecipePickerIngId;
            const withId = createComponentRecipeRef({
              ...ref,
              componentId: component.id!,
              notes: `alt:${altIngId}`,
              isDefault: false,
            });
            const rest = (component.recipeRefs ?? []).filter(
              (r) => !(r.notes?.startsWith(`alt:${altIngId}`)),
            );
            onChange({
              ...component,
              recipeRefs: [...rest, withId],
            });
            setAltRecipePickerIngId(null);
          }}
          onRemove={
            (component.recipeRefs ?? []).some((r) => r.notes?.startsWith(`alt:${altRecipePickerIngId}`))
              ? () => {
                  onChange({
                    ...component,
                    recipeRefs: (component.recipeRefs ?? []).filter(
                      (r) => !(r.notes?.startsWith(`alt:${altRecipePickerIngId}`)),
                    ),
                  });
                  setAltRecipePickerIngId(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
