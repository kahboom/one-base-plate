import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Ingredient, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { MASTER_CATALOG, catalogIngredientToHousehold } from "../catalog";
import { PageShell, PageHeader, Card, Button, Input, Select, ActionGroup, Chip, FieldLabel, EmptyState, ConfirmDialog, useConfirm, HouseholdNav } from "../components/ui";

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

const CATEGORY_CHIP_VARIANT: Record<IngredientCategory, "success" | "warning" | "danger" | "info" | "neutral"> = {
  protein: "danger",
  carb: "warning",
  veg: "success",
  fruit: "success",
  dairy: "info",
  snack: "neutral",
  freezer: "info",
  pantry: "neutral",
};

function populateFromCatalog(existing: Ingredient[]): Ingredient[] {
  const existingNames = new Set(existing.map((i) => i.name.toLowerCase()));
  const newFromCatalog = MASTER_CATALOG
    .filter((ci) => !existingNames.has(ci.name.toLowerCase()))
    .map((ci) => catalogIngredientToHousehold(ci));
  return [...existing, ...newFromCatalog];
}

/* ---------- Ingredient edit modal ---------- */
function IngredientModal({
  ingredient,
  onChange,
  onClose,
  onDelete,
}: {
  ingredient: Ingredient;
  onChange: (updated: Ingredient) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [tagInput, setTagInput] = useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || ingredient.tags.includes(trimmed)) return;
    onChange({ ...ingredient, tags: [...ingredient.tags, trimmed] });
    setTagInput("");
  }

  function removeTag(tag: string) {
    onChange({ ...ingredient, tags: ingredient.tags.filter((t) => t !== tag) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Edit ingredient">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-md border border-border-light bg-surface p-6 shadow-card-hover" data-testid="ingredient-modal">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">
            {ingredient.name || "New ingredient"}
          </h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close modal">✕</Button>
        </div>

        <div className="space-y-4">
          <FieldLabel label="Name">
            <Input
              type="text"
              value={ingredient.name}
              onChange={(e) => onChange({ ...ingredient, name: e.target.value })}
              placeholder="Ingredient name"
              required
              data-testid="modal-ingredient-name"
            />
          </FieldLabel>

          <FieldLabel label="Category">
            <Select
              value={ingredient.category}
              onChange={(e) =>
                onChange({ ...ingredient, category: e.target.value as IngredientCategory })
              }
              data-testid="modal-ingredient-category"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </FieldLabel>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
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

          <FieldLabel label="Image">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="url"
                value={ingredient.imageUrl ?? ""}
                onChange={(e) => onChange({ ...ingredient, imageUrl: e.target.value || undefined })}
                placeholder="Image URL"
                data-testid="ingredient-image-url"
              />
              <label className="inline-flex cursor-pointer items-center">
                <span className="inline-flex items-center justify-center rounded-sm border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg hover:shadow-card min-h-[36px]">
                  Upload
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="ingredient-image-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      onChange({ ...ingredient, imageUrl: reader.result as string });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
            {ingredient.imageUrl && (
              <div className="mt-2">
                <img
                  src={ingredient.imageUrl}
                  alt={ingredient.name || "Ingredient"}
                  className="h-20 w-20 rounded-md border border-border-light object-cover"
                  data-testid="ingredient-image-preview"
                />
              </div>
            )}
          </FieldLabel>

          <div>
            <span className="mb-1 block text-sm font-medium text-text-secondary">Tags</span>
            <div className="flex flex-wrap gap-1">
              {ingredient.tags.map((tag) => (
                <span key={tag} data-testid={`tag-${tag}`} className="inline-flex items-center gap-1">
                  <Chip variant="info">{tag}</Chip>
                  <Button variant="ghost" small onClick={() => removeTag(tag)}>x</Button>
                </span>
              ))}
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
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border-light pt-4">
          <Button variant="danger" small onClick={onDelete}>Remove ingredient</Button>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Compact ingredient row ---------- */
function IngredientRow({
  ingredient,
  onClick,
}: {
  ingredient: Ingredient;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-border-light bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card cursor-pointer min-h-[48px]"
      onClick={onClick}
      data-testid={`ingredient-row-${ingredient.id}`}
      aria-label={`Edit ${ingredient.name || "unnamed ingredient"}`}
    >
      {ingredient.imageUrl && (
        <img
          src={ingredient.imageUrl}
          alt=""
          className="h-8 w-8 flex-shrink-0 rounded object-cover border border-border-light"
        />
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text-primary truncate">
          {ingredient.name || <span className="italic text-text-muted">Unnamed</span>}
        </span>
        <span className="flex flex-wrap items-center gap-1 mt-0.5">
          <Chip variant={CATEGORY_CHIP_VARIANT[ingredient.category]} className="text-[10px]">
            {ingredient.category}
          </Chip>
          {ingredient.tags.map((tag) => (
            <Chip key={tag} variant="info" className="text-[10px]">{tag}</Chip>
          ))}
        </span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-1.5">
        {ingredient.freezerFriendly && (
          <Chip variant="info" className="text-[10px]" title="Freezer friendly">❄️</Chip>
        )}
        {ingredient.babySafeWithAdaptation && (
          <Chip variant="success" className="text-[10px]" title="Baby safe">🍼</Chip>
        )}
      </span>
    </button>
  );
}

/* ---------- Main component ---------- */
export default function IngredientManager() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IngredientCategory | "">("");
  const [tagFilter, setTagFilter] = useState("");
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients(populateFromCatalog(household.ingredients));
      setHouseholdName(household.name);
    }
    setLoaded(true);
  }, [householdId]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    ingredients.forEach((ing) => ing.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!ing.name.toLowerCase().includes(q)) return false;
      }
      if (categoryFilter && ing.category !== categoryFilter) return false;
      if (tagFilter && !ing.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [ingredients, searchQuery, categoryFilter, tagFilter]);

  const editingIngredient = editingId
    ? ingredients.find((ing) => ing.id === editingId) ?? null
    : null;

  function addIngredient() {
    const newIng = createEmptyIngredient();
    setIngredients((prev) => [...prev, newIng]);
    setEditingId(newIng.id);
  }

  function updateIngredient(updated: Ingredient) {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === updated.id ? updated : ing)),
    );
  }

  function removeIngredient(id: string) {
    const ing = ingredients.find((i) => i.id === id);
    const ingredientName = ing?.name || "Unnamed ingredient";
    requestConfirm(ingredientName, () => {
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      setEditingId(null);
    });
  }

  function handleSave() {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.ingredients = ingredients;
    saveHousehold(household);
    navigate(`/household/${householdId}/ingredients`);
  }

  if (!loaded) return null;

  return (
    <PageShell>
      <HouseholdNav householdId={householdId ?? ""} />
      <PageHeader title="Ingredients" subtitle={`Household: ${householdName}`} />

      <ActionGroup placement="top">
        <Button variant="primary" onClick={handleSave}>Save ingredients</Button>
        <Button onClick={() => navigate(`/household/${householdId}/home`)}>Cancel</Button>
      </ActionGroup>

      {/* Control bar */}
      <Card className="mb-4" data-testid="ingredient-control-bar">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ingredients..."
              data-testid="ingredient-search"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as IngredientCategory | "")}
            className="sm:w-36"
            data-testid="ingredient-category-filter"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          {allTags.length > 0 && (
            <Select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="sm:w-36"
              data-testid="ingredient-tag-filter"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          )}
          <Button onClick={addIngredient}>Add ingredient</Button>
        </div>
      </Card>

      {/* Items count */}
      <h2 className="mb-3 text-sm font-medium text-text-secondary">
        Items ({ingredients.length}){filteredIngredients.length !== ingredients.length && ` · showing ${filteredIngredients.length}`}
      </h2>

      {/* Browse list */}
      {ingredients.length === 0 ? (
        <EmptyState>No ingredients yet. Add one to get started.</EmptyState>
      ) : filteredIngredients.length === 0 ? (
        <EmptyState>No ingredients match your filters.</EmptyState>
      ) : (
        <div className="space-y-1.5" data-testid="ingredient-list">
          {filteredIngredients.map((ingredient) => (
            <IngredientRow
              key={ingredient.id}
              ingredient={ingredient}
              onClick={() => setEditingId(ingredient.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4">
        <Button onClick={addIngredient}>Add ingredient</Button>
      </div>

      <ActionGroup>
        <Button variant="primary" onClick={handleSave}>Save ingredients</Button>
        <Button onClick={() => navigate(`/household/${householdId}/home`)}>Cancel</Button>
      </ActionGroup>

      {/* Edit modal */}
      {editingIngredient && (
        <IngredientModal
          ingredient={editingIngredient}
          onChange={updateIngredient}
          onClose={() => setEditingId(null)}
          onDelete={() => removeIngredient(editingIngredient.id)}
        />
      )}

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
