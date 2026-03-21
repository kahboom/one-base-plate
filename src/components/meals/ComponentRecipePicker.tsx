import { useMemo, useState } from "react";
import type { BaseMeal, ComponentRecipeRef, MealComponent } from "../../types";
import AppModal from "../AppModal";
import { Button, FieldLabel, Input, Chip } from "../ui";

export type ComponentRecipePickerMode = "default" | "tonight";

interface ComponentRecipePickerProps {
  open: boolean;
  onClose: () => void;
  component: MealComponent;
  /** Current base meal being edited (excluded from link targets). */
  excludeMealId: string;
  baseMeals: BaseMeal[];
  mode?: ComponentRecipePickerMode;
  onSave: (ref: ComponentRecipeRef) => void;
  onRemove?: () => void;
}

export default function ComponentRecipePicker({
  open,
  onClose,
  component,
  excludeMealId,
  baseMeals,
  mode = "default",
  onSave,
  onRemove,
}: ComponentRecipePickerProps) {
  const [search, setSearch] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseMeals
      .filter((m) => m.id !== excludeMealId)
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [baseMeals, excludeMealId, search]);

  function pickMeal(meal: BaseMeal) {
    const isImported = !!meal.provenance?.sourceSystem;
    const ref: ComponentRecipeRef = {
      id: crypto.randomUUID(),
      componentId: component.id ?? "",
      sourceType: isImported ? "imported-recipe" : "internal-meal",
      linkedBaseMealId: meal.id,
      importedRecipeSourceId: isImported ? meal.id : undefined,
      label: meal.name,
    };
    onSave(ref);
    onClose();
  }

  function saveUrl() {
    const u = url.trim();
    if (!u) return;
    const ref: ComponentRecipeRef = {
      id: crypto.randomUUID(),
      componentId: component.id ?? "",
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
    const ref: ComponentRecipeRef = {
      id: crypto.randomUUID(),
      componentId: component.id ?? "",
      sourceType: "note",
      label: "Prep note",
      notes: n,
    };
    onSave(ref);
    onClose();
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      ariaLabel="Attach recipe"
      className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden p-0"
      backdropClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      panelTestId="component-recipe-picker"
    >
      <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-t-lg border border-border-light bg-surface-card p-4 sm:rounded-lg">
        <h3 className="mb-3 text-base font-semibold text-text-primary">
          {mode === "tonight" ? "Tonight override" : "Attach recipe"}
        </h3>
        <p className="mb-3 text-xs text-text-secondary">
          Search your base meals and recipes first, or add a link or quick prep note.
        </p>

        <FieldLabel label="Search meals & recipes">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            data-testid="component-recipe-search"
          />
        </FieldLabel>

        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {candidates.map((m) => (
            <button
              key={m.id}
              type="button"
              className="flex w-full items-center justify-between rounded-sm border border-border-light px-2 py-2 text-left text-sm hover:bg-bg"
              onClick={() => pickMeal(m)}
              data-testid={`pick-recipe-meal-${m.id}`}
            >
              <span className="truncate font-medium text-text-primary">{m.name}</span>
              {m.provenance?.sourceSystem ? (
                <Chip variant="info" className="shrink-0 text-xs">
                  Imported
                </Chip>
              ) : null}
            </button>
          ))}
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
