import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Ingredient, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { PageShell, PageHeader, Card, Button, Input, Select, ActionGroup, Chip, FieldLabel, EmptyState, ConfirmDialog, useConfirm } from "../components/ui";

const CATEGORY_OPTIONS: IngredientCategory[] = [
  "protein", "carb", "veg", "fruit", "dairy", "snack", "freezer", "pantry",
];

const COMMON_TAGS = ["quick", "mashable", "rescue", "staple", "batch-friendly"];

function createEmptyIngredient(): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
  };
}

function IngredientForm({
  ingredient,
  onChange,
  onRemove,
}: {
  ingredient: Ingredient;
  onChange: (updated: Ingredient) => void;
  onRemove: () => void;
}) {
  const [tagInput, setTagInput] = useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || ingredient.tags.includes(trimmed)) return;
    onChange({ ...ingredient, tags: [...ingredient.tags, trimmed] });
    setTagInput("");
  }

  function removeTag(tag: string) {
    onChange({
      ...ingredient,
      tags: ingredient.tags.filter((t) => t !== tag),
    });
  }

  return (
    <Card data-testid={`ingredient-${ingredient.id}`} className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-secondary">Ingredient</span>
        <Button variant="danger" small onClick={onRemove}>Remove ingredient</Button>
      </div>

      <div className="space-y-4">
        <FieldLabel label="Name">
          <Input
            type="text"
            value={ingredient.name}
            onChange={(e) => onChange({ ...ingredient, name: e.target.value })}
            placeholder="Ingredient name"
            required
          />
        </FieldLabel>

        <FieldLabel label="Category">
          <Select
            value={ingredient.category}
            onChange={(e) =>
              onChange({ ...ingredient, category: e.target.value as IngredientCategory })
            }
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </FieldLabel>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand"
            checked={ingredient.freezerFriendly}
            onChange={(e) =>
              onChange({ ...ingredient, freezerFriendly: e.target.checked })
            }
          />
          Freezer friendly
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand"
            checked={ingredient.babySafeWithAdaptation}
            onChange={(e) =>
              onChange({ ...ingredient, babySafeWithAdaptation: e.target.checked })
            }
          />
          Baby safe with adaptation
        </label>
      </div>

      <div className="mt-3">
        <strong className="text-sm">Tags: </strong>
        <span className="flex flex-wrap gap-1 mt-1">
          {ingredient.tags.map((tag) => (
            <span key={tag} data-testid={`tag-${tag}`} className="inline-flex items-center gap-1">
              <Chip variant="info">{tag}</Chip>
              <Button variant="ghost" small onClick={() => removeTag(tag)}>x</Button>
            </span>
          ))}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {COMMON_TAGS.filter((t) => !ingredient.tags.includes(t)).map((tag) => (
          <Button key={tag} small onClick={() => addTag(tag)}>+{tag}</Button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Custom tag"
          className="max-w-[200px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
        />
        <Button small onClick={() => addTag(tagInput)}>Add tag</Button>
      </div>
    </Card>
  );
}

export default function IngredientManager() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients(household.ingredients);
      setHouseholdName(household.name);
    }
    setLoaded(true);
  }, [householdId]);

  function addIngredient() {
    setIngredients((prev) => [...prev, createEmptyIngredient()]);
  }

  function updateIngredient(index: number, updated: Ingredient) {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }

  function removeIngredient(index: number) {
    const ingredientName = ingredients[index]?.name || "Unnamed ingredient";
    requestConfirm(ingredientName, () => {
      setIngredients((prev) => prev.filter((_, i) => i !== index));
    });
  }

  function handleSave() {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.ingredients = ingredients;
    saveHousehold(household);
    navigate(`/household/${householdId}`);
  }

  if (!loaded) return null;

  return (
    <PageShell>
      <PageHeader title="Ingredients" subtitle={`Household: ${householdName}`} />

      <h2 className="mb-4 text-xl font-semibold text-text-primary">Items ({ingredients.length})</h2>

      {ingredients.length === 0 && (
        <EmptyState>No ingredients yet. Add one to get started.</EmptyState>
      )}

      {ingredients.map((ingredient, i) => (
        <IngredientForm
          key={ingredient.id}
          ingredient={ingredient}
          onChange={(updated) => updateIngredient(i, updated)}
          onRemove={() => removeIngredient(i)}
        />
      ))}

      <Button onClick={addIngredient} className="mb-4">Add ingredient</Button>

      <ActionGroup>
        <Button variant="primary" onClick={handleSave}>Save ingredients</Button>
        <Button onClick={() => navigate(`/household/${householdId}`)}>Cancel</Button>
      </ActionGroup>

      <ConfirmDialog
        open={!!pending}
        title="Remove ingredient"
        message={`Are you sure you want to remove "${pending?.entityName}"? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </PageShell>
  );
}
