import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { Ingredient, IngredientCategory, Household } from "../types";
import { loadHousehold, saveHousehold, toSentenceCase, normalizeIngredientName, mergeDuplicateMetadata, remapIngredientReferences } from "../storage";
import { MASTER_CATALOG, catalogIngredientToHousehold, findNearDuplicates } from "../catalog";
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Chip,
  FieldLabel,
  EmptyState,
  ConfirmDialog,
  useConfirm,
} from "../components/ui";
import AppModal from "../components/AppModal";
import TagSuggestInput from "../components/TagSuggestInput";
import { sortIngredients, type IngredientSortKey, type SortDir } from "../lib/listSort";
import { usePaginatedList, PAGE_SIZE_OPTIONS, type PageSize } from "../hooks/usePaginatedList";
import { findIngredientReferences, type IngredientReference } from "../lib/ingredientRefs";
import { useListKeyNav } from "../hooks/useListKeyNav";

const INGREDIENT_SORT_OPTIONS: { value: string; label: string; key: IngredientSortKey; dir: SortDir }[] = [
  { value: "name-asc", label: "Name (A–Z)", key: "name", dir: "asc" },
  { value: "name-desc", label: "Name (Z–A)", key: "name", dir: "desc" },
  { value: "category-asc", label: "Category (A–Z)", key: "category", dir: "asc" },
  { value: "category-desc", label: "Category (Z–A)", key: "category", dir: "desc" },
];

const CATEGORY_OPTIONS: IngredientCategory[] = [
  "protein", "carb", "veg", "fruit", "dairy", "snack", "freezer", "pantry",
];

const COMMON_TAGS = ["quick", "mashable", "rescue", "staple", "batch-friendly"];

type SourceFilter = "" | "manual" | "catalog" | "pending-import";

function createEmptyIngredient(): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: "manual",
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

function populateFromCatalog(
  existing: Ingredient[],
  suppressedCatalogIds: string[] = [],
): Ingredient[] {
  const existingNames = new Set(existing.map((i) => i.name.toLowerCase()));
  const existingCatalogIds = new Set(
    existing.map((i) => i.catalogId).filter((id): id is string => !!id),
  );
  const suppressed = new Set(suppressedCatalogIds);
  const newFromCatalog = MASTER_CATALOG
    .filter(
      (ci) =>
        !existingNames.has(ci.name.toLowerCase()) &&
        !existingCatalogIds.has(ci.id) &&
        !suppressed.has(ci.id),
    )
    .map((ci) => catalogIngredientToHousehold(ci));
  return [...existing, ...newFromCatalog];
}

/* ---------- Duplicate warning dialog ---------- */
function DuplicateWarningDialog({
  open,
  duplicateName,
  existingIngredient,
  onMerge,
  onCancel,
}: {
  open: boolean;
  duplicateName: string;
  existingIngredient: Ingredient | null;
  onMerge: () => void;
  onCancel: () => void;
}) {
  if (!open || !existingIngredient) return null;
  return (
    <AppModal
      open
      onClose={onCancel}
      ariaLabel="Duplicate ingredient warning"
      backdropClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      className="max-w-sm p-6"
      panelTestId="duplicate-warning-dialog"
    >
      <h2 className="mb-2 text-lg font-bold text-text-primary">Duplicate ingredient</h2>
      <p className="mb-4 text-sm text-text-secondary">
        An ingredient named &ldquo;{duplicateName}&rdquo; already exists in your list. Would you like to keep the existing one or add a duplicate?
      </p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={onMerge} data-testid="duplicate-merge-btn">Keep existing</Button>
        <Button onClick={onCancel} data-testid="duplicate-cancel-btn">Cancel</Button>
      </div>
    </AppModal>
  );
}

/* ---------- Merge confirmation sub-view ---------- */
function MergeConfirmView({
  ingredientA,
  ingredientB,
  refCountA,
  refCountB,
  onConfirm,
  onCancel,
}: {
  ingredientA: Ingredient;
  ingredientB: Ingredient;
  refCountA: number;
  refCountB: number;
  onConfirm: (survivorId: string, absorbedId: string) => void;
  onCancel: () => void;
}) {
  const [survivorId, setSurvivorId] = useState(ingredientA.id);
  const survivor = survivorId === ingredientA.id ? ingredientA : ingredientB;
  const absorbed = survivorId === ingredientA.id ? ingredientB : ingredientA;
  const absorbedRefCount = survivorId === ingredientA.id ? refCountB : refCountA;

  const preview = mergeDuplicateMetadata(survivor, [absorbed]);
  const newTags = preview.tags.filter((t) => !survivor.tags.includes(t));

  return (
    <div data-testid="merge-confirm-view">
      <h3 className="mb-3 text-sm font-bold text-text-primary">Confirm merge</h3>

      <fieldset className="mb-3" data-testid="merge-survivor-picker">
        <legend className="mb-1.5 text-xs font-medium text-text-secondary">Keep (survivor):</legend>
        <div className="flex flex-col gap-1.5">
          {[ingredientA, ingredientB].map((ing) => (
            <label
              key={ing.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                survivorId === ing.id
                  ? "border-brand bg-brand/5 font-medium text-text-primary"
                  : "border-border-light text-text-secondary hover:bg-bg"
              }`}
            >
              <input
                type="radio"
                name="merge-survivor"
                className="accent-brand"
                checked={survivorId === ing.id}
                onChange={() => setSurvivorId(ing.id)}
                data-testid={`merge-survivor-radio-${ing.id}`}
              />
              {toSentenceCase(ing.name)}
              <Chip variant={CATEGORY_CHIP_VARIANT[ing.category]} className="ml-auto text-[10px]">{ing.category}</Chip>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-3 rounded-md border border-border-light bg-bg px-3 py-2 text-sm">
        <p className="font-medium text-text-primary">
          Merge &ldquo;{toSentenceCase(absorbed.name)}&rdquo; into &ldquo;{toSentenceCase(survivor.name)}&rdquo;
        </p>
        <ul className="mt-2 list-disc pl-4 text-text-secondary">
          {newTags.length > 0 && (
            <li>Tags added: {newTags.join(", ")}</li>
          )}
          {!survivor.imageUrl && absorbed.imageUrl && (
            <li>Image inherited from &ldquo;{toSentenceCase(absorbed.name)}&rdquo;</li>
          )}
          {absorbed.freezerFriendly && !survivor.freezerFriendly && (
            <li>Freezer friendly flag applied</li>
          )}
          {absorbed.babySafeWithAdaptation && !survivor.babySafeWithAdaptation && (
            <li>Baby safe flag applied</li>
          )}
          {absorbedRefCount > 0 && (
            <li>{absorbedRefCount} reference{absorbedRefCount !== 1 ? "s" : ""} will be remapped</li>
          )}
          {newTags.length === 0 && (survivor.imageUrl || !absorbed.imageUrl) &&
            !(absorbed.freezerFriendly && !survivor.freezerFriendly) &&
            !(absorbed.babySafeWithAdaptation && !survivor.babySafeWithAdaptation) &&
            absorbedRefCount === 0 && (
            <li>No additional metadata to merge</li>
          )}
        </ul>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        &ldquo;{toSentenceCase(absorbed.name)}&rdquo; will be removed after merging. This cannot be undone.
      </p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => onConfirm(survivor.id, absorbed.id)} data-testid="merge-confirm-btn">Confirm merge</Button>
        <Button onClick={onCancel} data-testid="merge-cancel-btn">Cancel</Button>
      </div>
    </div>
  );
}

/* ---------- Ingredient edit modal ---------- */
function IngredientModal({
  ingredient,
  isNewIngredient,
  allIngredients,
  householdRef,
  onChange,
  onDelete,
  onDismiss,
  onDone,
  onDuplicateFound,
  onMerge,
}: {
  ingredient: Ingredient;
  isNewIngredient: boolean;
  allIngredients: Ingredient[];
  householdRef: Household | null;
  onChange: (updated: Ingredient) => void;
  onDelete: () => void;
  /** Backdrop, Escape, or close (✕) — discard new drafts; for edits, same as saving name normalization */
  onDismiss: () => void;
  /** Primary Done — commit new ingredient or close after edit (no duplicate warning) */
  onDone: () => void;
  onDuplicateFound: (newIng: Ingredient, existing: Ingredient) => void;
  onMerge: (survivorId: string, absorbedId: string) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeTarget, setMergeTarget] = useState<Ingredient | null>(null);

  const tagSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const ing of allIngredients) {
      for (const t of ing.tags) {
        set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allIngredients]);
  const duplicates = useMemo(
    () => findNearDuplicates(ingredient.name, allIngredients, ingredient.id),
    [ingredient.name, allIngredients, ingredient.id],
  );

  const mergeResults = useMemo(() => {
    if (!mergeMode || !mergeSearch.trim()) return [];
    const q = mergeSearch.toLowerCase();
    return allIngredients
      .filter((i) => i.id !== ingredient.id && i.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mergeMode, mergeSearch, allIngredients, ingredient.id]);

  const handleMergeResultSelect = useCallback(
    (index: number) => { setMergeTarget(mergeResults[index]!); },
    [mergeResults],
  );
  const handleMergeSearchCancel = useCallback(() => {
    setMergeMode(false);
    setMergeSearch("");
  }, []);
  const mergeKeyNav = useListKeyNav(
    mergeResults.length,
    handleMergeResultSelect,
    { onEscape: handleMergeSearchCancel },
  );

  const mergeRefCounts = useMemo(() => {
    if (!mergeTarget || !householdRef) return { current: 0, target: 0 };
    const refs = findIngredientReferences(new Set([ingredient.id, mergeTarget.id]), householdRef);
    return {
      current: refs.get(ingredient.id)?.length ?? 0,
      target: refs.get(mergeTarget.id)?.length ?? 0,
    };
  }, [mergeTarget, householdRef, ingredient.id]);

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
    <AppModal
      open
      onClose={onDismiss}
      ariaLabel="Edit ingredient"
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
      panelTestId="ingredient-modal"
    >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {toSentenceCase(ingredient.name) || "New ingredient"}
            </h2>
            <span className="text-xs text-text-muted" data-testid="ingredient-source-label">
              {ingredient.source === "catalog" ? "From catalog" : "Manual"}
            </span>
          </div>
          <Button variant="ghost" onClick={onDismiss} aria-label="Close modal">✕</Button>
        </div>

        {duplicates.length > 0 && (
          <div className="mb-4 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-text-primary" data-testid="duplicate-inline-warning">
            A similar ingredient &ldquo;{duplicates[0]!.name}&rdquo; already exists in your list.
          </div>
        )}

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
              <TagSuggestInput
                mode="single"
                value={tagInput}
                onChange={setTagInput}
                suggestions={tagSuggestions}
                exclude={new Set(ingredient.tags)}
                placeholder="Custom tag"
                className="max-w-[200px]"
                onPick={(tag) => addTag(tag)}
                onSubmitPlain={() => addTag(tagInput)}
              />
              <Button small onClick={() => addTag(tagInput)}>Add tag</Button>
            </div>
          </div>
        </div>

        {/* Merge section */}
        {!isNewIngredient && (
          <div className="mt-4 border-t border-border-light pt-4" data-testid="merge-section">
            {mergeTarget ? (
              <MergeConfirmView
                ingredientA={ingredient}
                ingredientB={mergeTarget}
                refCountA={mergeRefCounts.current}
                refCountB={mergeRefCounts.target}
                onConfirm={(survivorId, absorbedId) => {
                  onMerge(survivorId, absorbedId);
                  setMergeTarget(null);
                  setMergeMode(false);
                  setMergeSearch("");
                }}
                onCancel={() => setMergeTarget(null)}
              />
            ) : mergeMode ? (
              <div data-testid="merge-search-panel">
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    type="search"
                    value={mergeSearch}
                    onChange={(e) => { setMergeSearch(e.target.value); mergeKeyNav.setActiveIndex(-1); }}
                    onKeyDown={mergeKeyNav.onKeyDown}
                    placeholder="Search ingredient to merge in..."
                    data-testid="merge-search-input"
                    autoFocus
                  />
                  <Button small onClick={handleMergeSearchCancel} data-testid="merge-search-cancel">
                    Cancel
                  </Button>
                </div>
                {mergeSearch.trim() && mergeResults.length === 0 && (
                  <p className="text-sm text-text-muted">No matching ingredients found.</p>
                )}
                {mergeResults.length > 0 && (
                  <ul
                    ref={mergeKeyNav.listRef as React.RefObject<HTMLUListElement>}
                    className="max-h-48 overflow-y-auto rounded-md border border-border-light"
                    data-testid="merge-search-results"
                  >
                    {mergeResults.map((r, i) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            mergeKeyNav.activeIndex === i ? "bg-bg ring-1 ring-brand" : "hover:bg-bg"
                          }`}
                          onClick={() => setMergeTarget(r)}
                          onMouseEnter={() => mergeKeyNav.setActiveIndex(i)}
                          data-testid={`merge-result-${r.id}`}
                        >
                          <span className="flex-1 truncate text-text-primary">{toSentenceCase(r.name)}</span>
                          <Chip variant={CATEGORY_CHIP_VARIANT[r.category]} className="text-[10px]">{r.category}</Chip>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Button small onClick={() => setMergeMode(true)} data-testid="merge-open-btn">
                Merge with another ingredient
              </Button>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-border-light pt-4">
          {isNewIngredient ? <span /> : <Button variant="danger" onClick={onDelete} data-testid="delete-ingredient-btn">Delete</Button>}
          <Button variant="primary" onClick={() => {
            if (duplicates.length > 0) {
              onDuplicateFound(ingredient, duplicates[0]!);
            } else {
              onDone();
            }
          }}>Done</Button>
        </div>
    </AppModal>
  );
}

/* ---------- Bulk delete confirmation dialog ---------- */
function BulkDeleteConfirmDialog({
  open,
  selectedIngredients,
  referencedMap,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  selectedIngredients: Ingredient[];
  referencedMap: Map<string, IngredientReference[]>;
  onConfirm: (idsToDelete: string[]) => void;
  onCancel: () => void;
}) {
  if (!open || selectedIngredients.length === 0) return null;

  const unreferenced = selectedIngredients.filter((i) => !referencedMap.has(i.id));
  const referenced = selectedIngredients.filter((i) => referencedMap.has(i.id));
  const allReferenced = unreferenced.length === 0;
  const someReferenced = referenced.length > 0 && unreferenced.length > 0;
  const noneReferenced = referenced.length === 0;

  const sampleNames = selectedIngredients
    .slice(0, 5)
    .map((i) => toSentenceCase(i.name) || "Unnamed");
  const remaining = selectedIngredients.length - sampleNames.length;

  return (
    <AppModal
      open
      onClose={onCancel}
      ariaLabel="Bulk delete confirmation"
      className="max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
      panelTestId="bulk-delete-dialog"
    >
      <h2 className="mb-2 text-lg font-bold text-text-primary">Delete ingredients</h2>

      <p className="mb-3 text-sm text-text-secondary">
        {noneReferenced
          ? `Delete ${selectedIngredients.length} selected ingredient${selectedIngredients.length !== 1 ? "s" : ""}? This cannot be undone.`
          : someReferenced
            ? `${referenced.length} of ${selectedIngredients.length} selected ingredient${selectedIngredients.length !== 1 ? "s" : ""} ${referenced.length !== 1 ? "are" : "is"} used by meals, recipes, or plans and cannot be deleted.`
            : `All ${selectedIngredients.length} selected ingredient${selectedIngredients.length !== 1 ? "s" : ""} ${selectedIngredients.length !== 1 ? "are" : "is"} used by meals, recipes, or plans and cannot be deleted.`}
      </p>

      <div className="mb-4 rounded-md border border-border-light bg-bg px-3 py-2" data-testid="bulk-delete-sample-names">
        <ul className="list-disc pl-4 text-sm text-text-primary">
          {sampleNames.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
        {remaining > 0 && (
          <p className="mt-1 text-xs text-text-muted">and {remaining} more...</p>
        )}
      </div>

      {referenced.length > 0 && (
        <div className="mb-4 rounded-md border border-warning bg-warning/10 px-3 py-2" data-testid="bulk-delete-protected-warning">
          <p className="mb-1 text-sm font-medium text-text-primary">
            Protected ingredients ({referenced.length}):
          </p>
          <ul className="list-disc pl-4 text-sm text-text-secondary">
            {referenced.slice(0, 5).map((ing) => {
              const refs = referencedMap.get(ing.id) ?? [];
              const refSummary = [...new Set(refs.map((r) => r.entityName))].slice(0, 2).join(", ");
              return (
                <li key={ing.id}>
                  {toSentenceCase(ing.name)} &mdash; used in {refSummary}
                  {refs.length > 2 ? ` and ${refs.length - 2} more` : ""}
                </li>
              );
            })}
          </ul>
          {referenced.length > 5 && (
            <p className="mt-1 text-xs text-text-muted">and {referenced.length - 5} more protected...</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {allReferenced ? (
          <Button onClick={onCancel}>Close</Button>
        ) : (
          <>
            <Button
              variant="danger"
              onClick={() => onConfirm(unreferenced.map((i) => i.id))}
              data-testid="bulk-delete-confirm-btn"
            >
              {someReferenced
                ? `Delete ${unreferenced.length} unreferenced`
                : `Delete ${selectedIngredients.length}`}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </>
        )}
      </div>
    </AppModal>
  );
}

/* ---------- Ingredient row (desktop table / mobile card) ---------- */
function IngredientTableRow({
  ingredient,
  selected,
  onToggleSelect,
  onClick,
}: {
  ingredient: Ingredient;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-md border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card min-h-[48px] cursor-pointer ${
        selected ? "border-brand bg-brand/5" : "border-border-light"
      }`}
      data-testid={`ingredient-row-${ingredient.id}`}
      aria-label={`Edit ${
        ingredient.name.trim() ? toSentenceCase(ingredient.name) : "unnamed ingredient"
      }`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <label
        className="flex flex-shrink-0 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand cursor-pointer"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
          aria-label={`Select ${
            ingredient.name.trim() ? toSentenceCase(ingredient.name) : "unnamed ingredient"
          }`}
          data-testid={`ingredient-select-${ingredient.id}`}
        />
      </label>

      {/* Content area */}
      <span className="flex flex-1 items-center gap-3 min-w-0 text-left">
        {/* Thumbnail */}
        {ingredient.imageUrl && (
          <img
            src={ingredient.imageUrl}
            alt=""
            className="h-8 w-8 flex-shrink-0 rounded object-cover border border-border-light hidden sm:block"
          />
        )}

        {/* Name */}
        <span className="flex flex-1 min-w-0 items-center sm:flex-[2] self-center">
          <span className="block text-sm font-medium leading-tight text-text-primary truncate">
            {ingredient.name ? toSentenceCase(ingredient.name) : <span className="italic text-text-muted">Unnamed</span>}
          </span>
          {/* Mobile: category + tags inline below name */}
          <span className="flex flex-wrap items-center gap-1 mt-0.5 sm:hidden">
            <Chip variant={CATEGORY_CHIP_VARIANT[ingredient.category]} className="text-[10px] leading-none">
              {ingredient.category}
            </Chip>
            {ingredient.tags.slice(0, 2).map((tag) => (
              <Chip key={tag} variant="info" className="text-[10px] leading-none">{tag}</Chip>
            ))}
            {ingredient.tags.length > 2 && (
              <span className="text-[10px] text-text-muted">+{ingredient.tags.length - 2}</span>
            )}
          </span>
        </span>

        {/* Desktop columns */}
        <span className="hidden sm:flex sm:flex-1 sm:items-center sm:gap-1 sm:self-center">
          <Chip variant={CATEGORY_CHIP_VARIANT[ingredient.category]} className="text-[10px] leading-none">
            {ingredient.category}
          </Chip>
        </span>

        <span className="hidden sm:flex sm:flex-1 sm:flex-wrap sm:items-center sm:gap-1 sm:min-w-0 sm:self-center">
          {ingredient.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} variant="info" className="text-[10px] leading-none">{tag}</Chip>
          ))}
          {ingredient.tags.length > 3 && (
            <span className="text-[10px] leading-none text-text-muted">+{ingredient.tags.length - 3}</span>
          )}
        </span>

        {/* Flags */}
        <span className="flex w-16 flex-shrink-0 items-center justify-center gap-1.5 self-center">
          {ingredient.freezerFriendly && (
            <Chip variant="info" className="text-[10px] leading-none" title="Freezer friendly">❄️</Chip>
          )}
          {ingredient.babySafeWithAdaptation && (
            <Chip variant="success" className="text-[10px] leading-none" title="Baby safe">🍼</Chip>
          )}
        </span>
      </span>
    </button>
  );
}

/* ---------- Pagination controls ---------- */
function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const pages = useMemo(() => {
    const result: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);
      if (page > 3) result.push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) result.push(i);
      if (page < totalPages - 2) result.push("ellipsis");
      result.push(totalPages);
    }
    return result;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1 pt-4" aria-label="Pagination" data-testid="pagination-controls">
      <Button
        small
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        aria-label="First page"
        data-testid="pagination-first"
      >
        ««
      </Button>
      <Button
        small
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        data-testid="pagination-prev"
      >
        «
      </Button>

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e${i}`} className="px-1 text-sm text-text-muted">…</span>
        ) : (
          <Button
            key={p}
            small
            variant={p === page ? "primary" : "default"}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            data-testid={`pagination-page-${p}`}
          >
            {p}
          </Button>
        ),
      )}

      <Button
        small
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        data-testid="pagination-next"
      >
        »
      </Button>
      <Button
        small
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        aria-label="Last page"
        data-testid="pagination-last"
      >
        »»
      </Button>
    </nav>
  );
}

/* ---------- Main component ---------- */
export default function IngredientManager() {
  const { householdId } = useParams<{ householdId: string }>();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IngredientCategory | "">("");
  const [tagFilter, setTagFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("");
  const [ingredientSort, setIngredientSort] = useState(INGREDIENT_SORT_OPTIONS[0]!.value);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    newIngredient: Ingredient;
    existingIngredient: Ingredient;
  } | null>(null);
  /** In-memory draft for Add ingredient — not persisted until Done */
  const [draftNewIngredient, setDraftNewIngredient] = useState<Ingredient | null>(null);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Household ref for reference checking
  const [householdRef, setHouseholdRef] = useState<Household | null>(null);

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients(populateFromCatalog(household.ingredients, household.suppressedCatalogIds));
      setHouseholdName(household.name);
      setHouseholdRef(household);
    }
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    if (!loaded || !householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.ingredients = ingredients;
    saveHousehold(household);
    setHouseholdRef(household);
  }, [loaded, householdId, ingredients]);

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
      if (sourceFilter) {
        const s = ing.source ?? "manual";
        if (s !== sourceFilter) return false;
      }
      return true;
    });
  }, [ingredients, searchQuery, categoryFilter, tagFilter, sourceFilter]);

  const sortedIngredients = useMemo(() => {
    const opt =
      INGREDIENT_SORT_OPTIONS.find((o) => o.value === ingredientSort) ?? INGREDIENT_SORT_OPTIONS[0]!;
    return sortIngredients(filteredIngredients, opt.key, opt.dir);
  }, [filteredIngredients, ingredientSort]);

  const paginationResetDeps = useMemo(
    () => [searchQuery, categoryFilter, tagFilter, sourceFilter, ingredientSort] as const,
    [searchQuery, categoryFilter, tagFilter, sourceFilter, ingredientSort],
  );

  const {
    pageItems,
    page,
    totalPages,
    pageSize,
    setPage,
    setPageSize,
  } = usePaginatedList(sortedIngredients, { resetDeps: [...paginationResetDeps] });

  const editingIngredient =
    draftNewIngredient ?? (editingId ? ingredients.find((ing) => ing.id === editingId) ?? null : null);

  function addIngredient() {
    setEditingId(null);
    setDraftNewIngredient(createEmptyIngredient());
  }

  function updateIngredient(updated: Ingredient) {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === updated.id ? updated : ing)),
    );
  }

  function handleModalChange(updated: Ingredient) {
    if (draftNewIngredient && updated.id === draftNewIngredient.id) {
      setDraftNewIngredient(updated);
    } else {
      updateIngredient(updated);
    }
  }

  function dismissIngredientModal() {
    if (draftNewIngredient) {
      setDraftNewIngredient(null);
      return;
    }
    if (editingIngredient?.name) {
      updateIngredient({ ...editingIngredient, name: normalizeIngredientName(editingIngredient.name) });
    }
    setEditingId(null);
  }

  function doneIngredientModal() {
    if (draftNewIngredient) {
      const ing = draftNewIngredient;
      const normalized = { ...ing, name: normalizeIngredientName(ing.name) };
      if (!normalized.name.trim()) {
        setDraftNewIngredient(null);
        return;
      }
      setIngredients((prev) => [...prev, normalized]);
      setDraftNewIngredient(null);
      return;
    }
    if (editingIngredient) {
      if (editingIngredient.name) {
        updateIngredient({ ...editingIngredient, name: normalizeIngredientName(editingIngredient.name) });
      }
      setEditingId(null);
    }
  }

  function removeIngredient(ingredientId: string) {
    const ing = ingredients.find((i) => i.id === ingredientId);
    const displayName = ing?.name.trim() ? toSentenceCase(ing.name) : "this ingredient";
    requestConfirm(displayName, () => {
      if (householdId && ing?.catalogId) {
        const household = loadHousehold(householdId);
        if (household) {
          household.suppressedCatalogIds = [
            ...new Set([...(household.suppressedCatalogIds ?? []), ing.catalogId]),
          ];
          saveHousehold(household);
          setHouseholdRef(household);
        }
      }
      setIngredients((prev) => prev.filter((item) => item.id !== ingredientId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(ingredientId);
        return next;
      });
      setEditingId(null);
    });
  }

  const handleMerge = useCallback(
    (survivorId: string, absorbedId: string) => {
      if (!householdId) return;
      const survivor = ingredients.find((i) => i.id === survivorId);
      const absorbed = ingredients.find((i) => i.id === absorbedId);
      if (!survivor || !absorbed) return;

      const merged = mergeDuplicateMetadata(survivor, [absorbed]);
      const household = loadHousehold(householdId);
      if (!household) return;

      const idRemap = new Map([[absorbed.id, survivor.id]]);
      remapIngredientReferences(household, idRemap);

      household.ingredients = household.ingredients
        .map((i) => (i.id === survivor.id ? merged : i))
        .filter((i) => i.id !== absorbed.id);
      if (absorbed.catalogId) {
        household.suppressedCatalogIds = [
          ...new Set([...(household.suppressedCatalogIds ?? []), absorbed.catalogId]),
        ];
      }
      saveHousehold(household);

      setIngredients(household.ingredients);
      setHouseholdRef(household);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(absorbed.id);
        return next;
      });
      setEditingId(merged.id);
    },
    [householdId, ingredients],
  );

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pageItemIds = useMemo(() => new Set(pageItems.map((i) => i.id)), [pageItems]);
  const allPageSelected = pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
  const somePageSelected = pageItems.some((i) => selectedIds.has(i.id));

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageItemIds) next.delete(id);
      } else {
        for (const id of pageItemIds) next.add(id);
      }
      return next;
    });
  }, [allPageSelected, pageItemIds]);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(sortedIngredients.map((i) => i.id)));
  }, [sortedIngredients]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;

  // Bulk delete
  const selectedIngredients = useMemo(
    () => ingredients.filter((i) => selectedIds.has(i.id)),
    [ingredients, selectedIds],
  );

  const referencedMap = useMemo(() => {
    if (!bulkDeleteOpen || !householdRef) return new Map<string, IngredientReference[]>();
    return findIngredientReferences(selectedIds, householdRef);
  }, [bulkDeleteOpen, selectedIds, householdRef]);

  const handleBulkDeleteConfirm = useCallback(
    (idsToDelete: string[]) => {
      const deleteSet = new Set(idsToDelete);
      if (householdId) {
        const household = loadHousehold(householdId);
        if (household) {
          const absorbedCatalogIds = ingredients
            .filter((i) => deleteSet.has(i.id))
            .map((i) => i.catalogId)
            .filter((id): id is string => !!id);
          if (absorbedCatalogIds.length > 0) {
            household.suppressedCatalogIds = [
              ...new Set([...(household.suppressedCatalogIds ?? []), ...absorbedCatalogIds]),
            ];
            saveHousehold(household);
            setHouseholdRef(household);
          }
        }
      }
      setIngredients((prev) => prev.filter((i) => !deleteSet.has(i.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of idsToDelete) next.delete(id);
        return next;
      });
      setBulkDeleteOpen(false);
    },
    [householdId, ingredients],
  );

  if (!loaded) return null;

  return (
    <>
      <PageHeader
        title="Ingredients"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      {/* Sticky control bar */}
      <Card className="mb-4 sticky top-0 z-10" data-testid="ingredient-control-bar">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
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
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="sm:w-32"
            data-testid="ingredient-source-filter"
          >
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="catalog">Catalog</option>
            <option value="pending-import">Imported</option>
          </Select>
          <Select
            value={ingredientSort}
            onChange={(e) => setIngredientSort(e.target.value)}
            className="sm:w-44"
            data-testid="ingredient-sort"
          >
            {INGREDIENT_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
            className="sm:w-24"
            data-testid="ingredient-page-size"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </Select>
          <Button onClick={addIngredient}>Add ingredient</Button>
        </div>
      </Card>

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-brand bg-brand/5 px-4 py-2.5"
          data-testid="bulk-actions-bar"
        >
          <span className="text-sm font-medium text-text-primary" data-testid="bulk-selected-count">
            {selectedCount} selected
          </span>
          <Button small onClick={selectAllFiltered} data-testid="bulk-select-all-filtered">
            Select all {sortedIngredients.length} filtered
          </Button>
          <Button small onClick={clearSelection} data-testid="bulk-clear-selection">
            Clear selection
          </Button>
          <Button small variant="danger" onClick={() => setBulkDeleteOpen(true)} data-testid="bulk-delete-btn">
            Delete selected
          </Button>
        </div>
      )}

      {/* Result summary */}
      <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium text-text-secondary" data-testid="ingredient-list-summary">
        <span>Items ({ingredients.length})</span>
        {filteredIngredients.length !== ingredients.length && (
          <span>{` · ${filteredIngredients.length} match${filteredIngredients.length !== 1 ? "es" : ""}`}</span>
        )}
        {selectedCount > 0 && (
          <span>{` · ${selectedCount} selected`}</span>
        )}
        {totalPages > 1 && (
          <span>{` · page ${page} of ${totalPages}`}</span>
        )}
      </h2>

      {/* Table header (desktop) */}
      {sortedIngredients.length > 0 && (
        <div className="hidden sm:flex items-center gap-3 rounded-t-md border border-border-light bg-bg px-3 py-2 text-xs font-medium text-text-muted" role="row" data-testid="ingredient-table-header">
          <label className="flex flex-shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand cursor-pointer"
              checked={allPageSelected}
              ref={(el) => {
                if (el) el.indeterminate = somePageSelected && !allPageSelected;
              }}
              onChange={toggleSelectAllOnPage}
              aria-label="Select all on page"
              data-testid="select-all-page-checkbox"
            />
          </label>
          <span className="flex-1 sm:flex-[2] min-w-0">Name</span>
          <span className="flex-1">Category</span>
          <span className="flex-1">Tags</span>
          <span className="w-16 flex-shrink-0 text-center">Flags</span>
        </div>
      )}

      {/* Browse list */}
      {ingredients.length === 0 ? (
        <EmptyState>No ingredients yet. Add one to get started.</EmptyState>
      ) : filteredIngredients.length === 0 ? (
        <EmptyState>No ingredients match your filters.</EmptyState>
      ) : (
        <div className="space-y-1.5 sm:space-y-0 sm:[&>div+div]:border-t-0" data-testid="ingredient-list">
          {pageItems.map((ingredient) => (
            <IngredientTableRow
              key={ingredient.id}
              ingredient={ingredient}
              selected={selectedIds.has(ingredient.id)}
              onToggleSelect={() => toggleSelect(ingredient.id)}
              onClick={() => {
                setDraftNewIngredient(null);
                setEditingId(ingredient.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />

      <div className="mt-4">
        <Button onClick={addIngredient}>Add ingredient</Button>
      </div>

      {/* Edit modal */}
      {editingIngredient && (
        <IngredientModal
          key={editingIngredient.id}
          ingredient={editingIngredient}
          isNewIngredient={draftNewIngredient !== null}
          allIngredients={ingredients}
          householdRef={householdRef}
          onChange={handleModalChange}
          onDelete={() => removeIngredient(editingIngredient.id)}
          onMerge={handleMerge}
          onDismiss={dismissIngredientModal}
          onDone={doneIngredientModal}
          onDuplicateFound={(newIng, existing) => {
            setDuplicateWarning({ newIngredient: newIng, existingIngredient: existing });
          }}
        />
      )}

      <DuplicateWarningDialog
        open={!!duplicateWarning}
        duplicateName={duplicateWarning?.newIngredient.name ?? ""}
        existingIngredient={duplicateWarning?.existingIngredient ?? null}
        onMerge={() => {
          if (duplicateWarning) {
            setIngredients((prev) =>
              prev.filter((i) => i.id !== duplicateWarning.newIngredient.id),
            );
            setDraftNewIngredient(null);
            setEditingId(null);
          }
          setDuplicateWarning(null);
        }}
        onCancel={() => {
          setDuplicateWarning(null);
        }}
      />

      <ConfirmDialog
        open={!!pending}
        title="Delete ingredient"
        message={`Are you sure you want to delete "${pending?.entityName}"? This cannot be undone. Meals that use this ingredient may be affected.`}
        confirmLabel="Delete"
        onConfirm={confirm}
        onCancel={cancel}
      />

      <BulkDeleteConfirmDialog
        open={bulkDeleteOpen}
        selectedIngredients={selectedIngredients}
        referencedMap={referencedMap}
        onConfirm={handleBulkDeleteConfirm}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </>
  );
}
