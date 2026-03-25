import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Ingredient } from "../types";
import { normalizeIngredientName, toSentenceCase, ingredientMatchesQuery } from "../storage";
import { buildManualIngredient } from "../lib/manualIngredient";

const inputClassName =
  "w-full rounded-sm border border-border-default bg-surface px-4 py-2 text-base text-text-primary min-h-[44px] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light";

const MAX_SUGGESTIONS = 50;

export interface IngredientComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ingredients: Ingredient[];
  /** When true, skip showing an ingredient in suggestions (e.g. already on safe/hard-no list). */
  isBlocked: (normalizedName: string) => boolean;
  onCommitPlain: (trimmed: string) => void;
  onCommitFromIngredient: (ingredient: Ingredient) => void;
  /** Appends to household ingredients and runs the same commit semantics as picking from the list. */
  onCreateIngredientAndCommit: (ingredient: Ingredient) => void;
  inputTestId?: string;
}

export type IngredientComboboxHandle = {
  /** Same as the adjacent &ldquo;Add&rdquo; button: commit plain text only. */
  submitPlain: () => void;
};

function norm(s: string): string {
  return normalizeIngredientName(s);
}

const IngredientCombobox = forwardRef<IngredientComboboxHandle, IngredientComboboxProps>(function IngredientCombobox(
  {
    value,
    onChange,
    placeholder,
    ingredients,
    isBlocked,
    onCommitPlain,
    onCommitFromIngredient,
    onCreateIngredientAndCommit,
    inputTestId,
  },
  ref,
) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = value.trim();
  const nTrimmed = trimmed ? norm(trimmed) : "";

  const filtered = useMemo(() => {
    const list = ingredients
      .filter((ing) => !isBlocked(norm(ing.name)))
      .filter((ing) => !trimmed || ingredientMatchesQuery(ing, trimmed))
      .sort((a, b) => a.name.localeCompare(b.name));
    return list.slice(0, MAX_SUGGESTIONS);
  }, [ingredients, trimmed, isBlocked]);

  const householdHasExact = useMemo(() => {
    if (!nTrimmed) return true;
    return ingredients.some((ing) => norm(ing.name) === nTrimmed);
  }, [ingredients, nTrimmed]);

  const showPlain = Boolean(trimmed && !isBlocked(nTrimmed));
  const showCreate = Boolean(trimmed && nTrimmed && !householdHasExact);

  const ingredientCount = filtered.length;
  const plainIndex = showPlain ? ingredientCount : -1;
  const createIndex = showCreate ? ingredientCount + (showPlain ? 1 : 0) : -1;

  const totalRows = ingredientCount + (showPlain ? 1 : 0) + (showCreate ? 1 : 0);

  const resetActive = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    resetActive();
  }, [resetActive]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const el = wrapperRef.current;
      if (!el || !open) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        close();
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [open, close]);

  function commitIngredient(ing: Ingredient) {
    onCommitFromIngredient(ing);
    close();
  }

  const commitPlain = useCallback(() => {
    if (!trimmed) return;
    if (isBlocked(nTrimmed)) return;
    onCommitPlain(trimmed);
    close();
  }, [trimmed, nTrimmed, isBlocked, onCommitPlain, close]);

  function commitCreate() {
    if (!trimmed) return;
    const ing = buildManualIngredient(trimmed);
    onCreateIngredientAndCommit(ing);
    close();
  }

  function dispatchActive(i: number) {
    if (i < 0 || i >= totalRows) return;
    if (i < ingredientCount) {
      commitIngredient(filtered[i]!);
      return;
    }
    if (showPlain && i === plainIndex) {
      commitPlain();
      return;
    }
    if (showCreate && i === createIndex) {
      commitCreate();
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      submitPlain: () => {
        commitPlain();
      },
    }),
    [commitPlain],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((prev) => (totalRows === 0 ? -1 : prev < totalRows - 1 ? prev + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((prev) => (totalRows === 0 ? -1 : prev <= 0 ? totalRows - 1 : prev - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0) {
        dispatchActive(activeIndex);
        return;
      }
      commitPlain();
    }
  }

  const activeDescendant =
    activeIndex >= 0 && activeIndex < ingredientCount
      ? `${id}-opt-${activeIndex}`
      : activeIndex === plainIndex
        ? `${id}-plain`
        : activeIndex === createIndex
          ? `${id}-create`
          : undefined;

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open ? activeDescendant : undefined}
        data-testid={inputTestId}
        className={inputClassName}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          resetActive();
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && (filtered.length > 0 || showPlain || showCreate) && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-sm border border-border-light bg-surface py-1 shadow-card"
        >
          {filtered.map((ing, i) => {
            const active = activeIndex === i;
            return (
              <button
                key={ing.id}
                id={`${id}-opt-${i}`}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full px-3 py-2 text-left text-sm ${
                  active ? "bg-bg text-text-primary" : "text-text-primary hover:bg-bg"
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commitIngredient(ing)}
              >
                {toSentenceCase(ing.name)}
              </button>
            );
          })}
          {showPlain && (
            <button
              id={`${id}-plain`}
              type="button"
              role="option"
              className={`w-full px-3 py-2 text-left text-sm ${
                activeIndex === plainIndex ? "bg-bg" : ""
              } text-text-secondary hover:bg-bg`}
              onMouseEnter={() => setActiveIndex(plainIndex)}
              onClick={commitPlain}
            >
              Add &ldquo;{trimmed}&rdquo; only (no catalog entry)
            </button>
          )}
          {showCreate && (
            <button
              id={`${id}-create`}
              type="button"
              role="option"
              className={`w-full px-3 py-2 text-left text-sm font-medium ${
                activeIndex === createIndex ? "bg-bg" : ""
              } text-brand hover:bg-bg`}
              onMouseEnter={() => setActiveIndex(createIndex)}
              onClick={commitCreate}
            >
              Create &ldquo;{toSentenceCase(trimmed)}&rdquo; in ingredient list and use
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default IngredientCombobox;
