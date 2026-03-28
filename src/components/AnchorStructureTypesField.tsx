import { useEffect, useId, useRef, useState } from 'react';
import { MEAL_STRUCTURE_TYPE_OPTIONS } from '../planner';

const STRUCTURE_TYPES_HELP =
  'Each base meal is tagged as single-protein (one protein component) or multi-protein (more than one). Choosing types here lets this theme night gently prefer matching meals in weekly suggestions—after household fit.';

function formatOptionLabel(value: string): string {
  return value.replace(/-/g, ' ');
}

export function AnchorStructureTypesField({
  selected,
  onChange,
  'data-testid': testId = 'anchor-structure',
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  'data-testid'?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const helpId = useId();

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setMenuOpen(false);
      setHelpOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function toggleValue(value: string) {
    const set = new Set(selected);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange(MEAL_STRUCTURE_TYPE_OPTIONS.filter((o) => set.has(o)));
  }

  const summary =
    selected.length === 0 ? 'None selected' : selected.map(formatOptionLabel).join(', ');

  return (
    <div ref={rootRef} className="relative">
      <div className="relative mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text-secondary">Structure types</span>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-light bg-bg text-xs font-semibold text-text-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
          aria-expanded={helpOpen}
          aria-controls={helpId}
          aria-label="What are structure types?"
          onClick={() => {
            setHelpOpen((o) => !o);
            setMenuOpen(false);
          }}
        >
          ?
        </button>
        {helpOpen && (
          <div
            id={helpId}
            role="tooltip"
            className="absolute left-0 top-full z-30 mt-1 max-w-sm rounded-md border border-border-light bg-surface p-3 text-xs leading-relaxed text-text-secondary shadow-card"
          >
            {STRUCTURE_TYPES_HELP}
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid={testId}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-sm border border-border-default bg-surface px-4 py-2 text-left text-base text-text-primary transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
        onClick={() => {
          setMenuOpen((o) => !o);
          setHelpOpen(false);
        }}
      >
        <span className={selected.length === 0 ? 'text-text-muted' : ''}>{summary}</span>
        <span className="text-text-muted" aria-hidden>
          ▾
        </span>
      </button>

      {menuOpen && (
        <ul
          className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-md border border-border-light bg-surface p-2 shadow-card"
          role="listbox"
          aria-multiselectable
        >
          {MEAL_STRUCTURE_TYPE_OPTIONS.map((value) => {
            const checked = selected.includes(value);
            return (
              <li key={value} role="option" aria-selected={checked}>
                <label className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm text-text-primary hover:bg-bg">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={checked}
                    data-testid={`anchor-structure-${value}`}
                    onChange={() => toggleValue(value)}
                  />
                  <span className="capitalize">{formatOptionLabel(value)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
