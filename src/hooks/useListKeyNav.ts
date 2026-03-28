import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, KeyboardEvent } from 'react';

export interface UseListKeyNavResult {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  /** Attach to the scrollable list container so Enter/arrow selection auto-scrolls. */
  listRef: RefObject<HTMLElement | null>;
}

/**
 * Keyboard navigation for a list of items tied to a search input.
 * Handles ArrowDown, ArrowUp (with wrap), Enter to select, and Escape.
 *
 * Attach `onKeyDown` to the `<input>`, `listRef` to the scrollable list container,
 * and use `activeIndex` to highlight the active row.
 */
export function useListKeyNav(
  itemCount: number,
  onSelect: (index: number) => void,
  opts?: { onEscape?: () => void },
): UseListKeyNavResult {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setActiveIndex(-1);
  }, [itemCount]);

  const scrollTo = useCallback((index: number) => {
    const el = listRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ block: 'nearest' });
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (itemCount === 0) {
        if (e.key === 'Escape' && opts?.onEscape) {
          e.preventDefault();
          opts.onEscape();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev < itemCount - 1 ? prev + 1 : 0;
          scrollTo(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev <= 0 ? itemCount - 1 : prev - 1;
          scrollTo(next);
          return next;
        });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < itemCount) {
          e.preventDefault();
          onSelect(activeIndex);
        }
      } else if (e.key === 'Escape' && opts?.onEscape) {
        e.preventDefault();
        opts.onEscape();
      }
    },
    [itemCount, activeIndex, onSelect, scrollTo, opts],
  );

  return { activeIndex, setActiveIndex, onKeyDown, listRef };
}
