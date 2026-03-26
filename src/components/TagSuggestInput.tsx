import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

const inputClassName =
  "w-full rounded-sm border border-border-default bg-surface px-4 py-2 text-base text-text-primary min-h-[44px] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light";

const MAX_SUGGESTIONS = 50;

export type TagSuggestMode = "comma" | "single";

function parseCommaField(value: string): { committed: string[]; token: string } {
  const lastComma = value.lastIndexOf(",");
  if (lastComma === -1) {
    return { committed: [], token: value };
  }
  const before = value.slice(0, lastComma);
  const committed = before.split(",").map((s) => s.trim()).filter(Boolean);
  const token = value.slice(lastComma + 1);
  return { committed, token };
}

function applyCommaSuggestion(full: string, tag: string): string {
  const lastComma = full.lastIndexOf(",");
  if (lastComma === -1) return tag;
  return `${full.slice(0, lastComma + 1)} ${tag}`;
}

export interface TagSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Unique tags from household ingredients (sorted). */
  suggestions: string[];
  /** Extra tags to hide (e.g. already on ingredient in single mode). */
  exclude?: Set<string>;
  placeholder?: string;
  className?: string;
  inputTestId?: string;
  mode: TagSuggestMode;
  /** Single mode: called when user picks a suggestion (parent typically clears input). */
  onPick?: (tag: string) => void;
  /**
   * Enter when no dropdown option is keyboard-highlighted: e.g. single mode adds the typed tag;
   * comma mode can submit a parent form.
   */
  onSubmitPlain?: () => void;
}

export default function TagSuggestInput({
  value,
  onChange,
  suggestions,
  exclude = new Set(),
  placeholder,
  className = "",
  inputTestId,
  mode,
  onPick,
  onSubmitPlain,
}: TagSuggestInputProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    if (mode === "single") {
      const token = value.trim();
      return suggestions
        .filter((t) => !exclude.has(t) && (!token || t.toLowerCase().includes(token.toLowerCase())))
        .slice(0, MAX_SUGGESTIONS);
    }
    const { committed, token } = parseCommaField(value);
    const hide = new Set([...committed, ...exclude]);
    const q = token.trim();
    return suggestions
      .filter((t) => !hide.has(t) && (!q || t.toLowerCase().includes(q.toLowerCase())))
      .slice(0, MAX_SUGGESTIONS);
  }, [mode, value, suggestions, exclude]);

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

  const applySuggestion = useCallback(
    (tag: string) => {
      if (mode === "comma") {
        onChange(applyCommaSuggestion(value, tag));
      } else {
        onPick?.(tag);
      }
      close();
    },
    [mode, value, onChange, onPick, close],
  );

  const showList = open && filtered.length > 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (filtered.length === 0) return;
      setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (filtered.length === 0) return;
      setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
      return;
    }

    if (e.key === "Enter") {
      if (showList && activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        applySuggestion(filtered[activeIndex]!);
        return;
      }
      if (onSubmitPlain) {
        e.preventDefault();
        onSubmitPlain();
        close();
      }
    }
  }

  const activeDescendant =
    showList && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined;

  return (
    <div ref={wrapperRef} className={`relative w-full min-w-0 ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
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
      {showList && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-sm border border-border-light bg-surface py-1 shadow-card"
        >
          {filtered.map((tag, i) => {
            const active = activeIndex === i;
            return (
              <button
                key={tag}
                id={`${id}-opt-${i}`}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full px-3 py-2 text-left text-sm ${
                  active ? "bg-bg text-text-primary" : "text-text-primary hover:bg-bg"
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
