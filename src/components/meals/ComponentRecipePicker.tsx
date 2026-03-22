import { useMemo, useState } from "react";
import type { BaseMeal, ComponentRecipeRef, MealComponent, Recipe, RecipeRef } from "../../types";
import AppModal from "../AppModal";
import { Button, FieldLabel, Input, Chip } from "../ui";

export type ComponentRecipePickerMode = "default" | "tonight" | "meal";

interface ComponentRecipePickerProps {
  open: boolean;
  onClose: () => void;
  component?: MealComponent;
  /** Current base meal being edited (excluded from link targets). */
  excludeMealId: string;
  baseMeals: BaseMeal[];
  /** Household recipe library entries (searched before base meals). */
  recipes?: Recipe[];
  mode?: ComponentRecipePickerMode;
  onSave: (ref: ComponentRecipeRef) => void;
  /** Callback for meal-level RecipeRef (used when mode="meal"). */
  onSaveMealRef?: (ref: RecipeRef) => void;
  onRemove?: () => void;
}

type CandidateRow = {
  id: string;
  name: string;
  group: "recipe" | "imported" | "meal";
  recipe?: Recipe;
  baseMeal?: BaseMeal;
};

export default function ComponentRecipePicker({
  open,
  onClose,
  component,
  excludeMealId,
  baseMeals,
  recipes = [],
  mode = "default",
  onSave,
  onSaveMealRef,
  onRemove,
}: ComponentRecipePickerProps) {
  const [search, setSearch] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const isMealMode = mode === "meal";

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows: CandidateRow[] = [];
    const seen = new Set<string>();

    for (const r of recipes) {
      if (!q || r.name.toLowerCase().includes(q)) {
        const isImported = !!r.provenance?.sourceSystem;
        rows.push({
          id: r.id,
          name: r.name,
          group: isImported ? "imported" : "recipe",
          recipe: r,
        });
        seen.add(r.id);
      }
    }

    for (const m of baseMeals) {
      if (m.id === excludeMealId) continue;
      if (seen.has(m.id)) continue;
      if (seen.has(m.sourceRecipeId ?? "")) continue;
      if (!q || m.name.toLowerCase().includes(q)) {
        const isImported = !!m.provenance?.sourceSystem;
        rows.push({
          id: m.id,
          name: m.name,
          group: isImported ? "imported" : "meal",
          baseMeal: m,
        });
      }
    }

    rows.sort((a, b) => {
      const order = { recipe: 0, imported: 1, meal: 2 };
      return order[a.group] - order[b.group];
    });

    return rows.slice(0, 16);
  }, [baseMeals, recipes, excludeMealId, search]);

  const recipeRows = candidates.filter((c) => c.group === "recipe");
  const importedRows = candidates.filter((c) => c.group === "imported");
  const mealRows = candidates.filter((c) => c.group === "meal");

  function pickRow(row: CandidateRow) {
    if (isMealMode && onSaveMealRef) {
      const ref: RecipeRef = {
        recipeId: row.recipe?.id ?? row.id,
        label: row.name,
        role: "primary",
      };
      onSaveMealRef(ref);
      onClose();
      return;
    }

    if (row.recipe) {
      const ref: ComponentRecipeRef = {
        id: crypto.randomUUID(),
        componentId: component?.id ?? "",
        sourceType: row.group === "imported" ? "imported-recipe" : "internal-meal",
        recipeId: row.recipe.id,
        label: row.name,
      };
      onSave(ref);
    } else if (row.baseMeal) {
      const isImported = !!row.baseMeal.provenance?.sourceSystem;
      const ref: ComponentRecipeRef = {
        id: crypto.randomUUID(),
        componentId: component?.id ?? "",
        sourceType: isImported ? "imported-recipe" : "internal-meal",
        linkedBaseMealId: row.baseMeal.id,
        importedRecipeSourceId: isImported ? row.baseMeal.id : undefined,
        label: row.name,
      };
      onSave(ref);
    }
    onClose();
  }

  function saveUrl() {
    const u = url.trim();
    if (!u) return;
    if (isMealMode && onSaveMealRef) {
      onSaveMealRef({ recipeId: "", label: u, notes: u, role: "primary" });
      onClose();
      return;
    }
    const ref: ComponentRecipeRef = {
      id: crypto.randomUUID(),
      componentId: component?.id ?? "",
      sourceType: "external-url",
      label: u,
      url: u,
    };
    onSave(ref);
    onClose();
  }

  function saveNote() {
    const n = note.trim();
    if (!n) return;
    if (isMealMode && onSaveMealRef) {
      onSaveMealRef({ recipeId: "", label: "Note", notes: n, role: "primary" });
      onClose();
      return;
    }
    const ref: ComponentRecipeRef = {
      id: crypto.randomUUID(),
      componentId: component?.id ?? "",
      sourceType: "note",
      label: "Prep note",
      notes: n,
    };
    onSave(ref);
    onClose();
  }

  const groupLabel: Record<CandidateRow["group"], string> = {
    recipe: "Household recipes",
    imported: "Imported recipes",
    meal: "Base meals",
  };

  function renderGroup(rows: CandidateRow[], group: CandidateRow["group"]) {
    if (rows.length === 0) return null;
    return (
      <>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {groupLabel[group]}
        </p>
        {rows.map((row) => (
          <button
            key={`${group}-${row.id}`}
            type="button"
            className="flex w-full items-center justify-between rounded-sm border border-border-light px-2 py-2 text-left text-sm hover:bg-bg"
            onClick={() => pickRow(row)}
            data-testid={`pick-recipe-${group}-${row.id}`}
          >
            <span className="truncate font-medium text-text-primary">{row.name}</span>
            {row.recipe?.recipeType && (
              <Chip variant="neutral" className="shrink-0 text-[10px] ml-1">
                {row.recipe.recipeType}
              </Chip>
            )}
            {row.group === "imported" && (
              <Chip variant="info" className="shrink-0 text-[10px] ml-1">
                Imported
              </Chip>
            )}
          </button>
        ))}
      </>
    );
  }

  const title = isMealMode
    ? "Attach whole-meal recipe"
    : mode === "tonight"
      ? "Tonight override"
      : "Attach recipe";

  return (
    <AppModal
      open={open}
      onClose={onClose}
      ariaLabel={title}
      className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden p-0"
      backdropClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      panelTestId="component-recipe-picker"
    >
      <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-t-lg border border-border-light bg-surface-card p-4 sm:rounded-lg">
        <h3 className="mb-3 text-base font-semibold text-text-primary">
          {title}
        </h3>
        <p className="mb-3 text-xs text-text-secondary">
          Search your household recipes first, or add a link or quick prep note.
        </p>

        <FieldLabel label="Search recipes & meals">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            data-testid="component-recipe-search"
          />
        </FieldLabel>

        <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto" data-testid="recipe-picker-results">
          {renderGroup(recipeRows, "recipe")}
          {renderGroup(importedRows, "imported")}
          {renderGroup(mealRows, "meal")}
          {candidates.length === 0 && (
            <p className="text-xs text-text-muted">No matches.</p>
          )}
        </div>

        <div className="mt-4 border-t border-border-light pt-3">
          <FieldLabel label="External URL">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              data-testid="component-recipe-url"
            />
          </FieldLabel>
          <Button small className="mt-2" onClick={saveUrl} disabled={!url.trim()}>
            Use URL
          </Button>
        </div>

        <div className="mt-4 border-t border-border-light pt-3">
          <FieldLabel label="Prep note (no formal recipe)">
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 200°C 25 min"
              data-testid="component-recipe-note"
            />
          </FieldLabel>
          <Button small className="mt-2" onClick={saveNote} disabled={!note.trim()}>
            Use note
          </Button>
        </div>

        {onRemove && (
          <div className="mt-4 border-t border-border-light pt-3">
            <Button variant="danger" small onClick={() => { onRemove(); onClose(); }} data-testid="component-recipe-remove">
              Remove attached recipe
            </Button>
          </div>
        )}

        <Button variant="ghost" className="mt-4" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </AppModal>
  );
}
