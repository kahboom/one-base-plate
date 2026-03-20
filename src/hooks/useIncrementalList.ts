import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

export const DEFAULT_INCREMENTAL_PAGE_SIZE = 48;

export interface UseIncrementalListOptions {
  pageSize?: number;
  /** When any of these change, visible count resets to the first page. */
  resetDeps: unknown[];
  /** Scroll container for IntersectionObserver (e.g. modal body). Omit for viewport. */
  rootRef?: RefObject<Element | null>;
}

export interface UseIncrementalListResult<T> {
  visibleItems: T[];
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

/**
 * Client-side incremental list: slice of `items` with optional infinite scroll via
 * IntersectionObserver on `sentinelRef`, plus `loadMore` for accessibility and tests.
 */
export function useIncrementalList<T>(
  items: T[],
  options: UseIncrementalListOptions,
): UseIncrementalListResult<T> {
  const pageSize = options.pageSize ?? DEFAULT_INCREMENTAL_PAGE_SIZE;
  const { resetDeps, rootRef } = options;

  const depsStr = JSON.stringify(resetDeps);

  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(pageSize, items.length),
  );

  /** Reset to first page when filters/sort/search (resetDeps) or page size changes — not when list grows from add/save. */
  useEffect(() => {
    setVisibleCount(Math.min(pageSize, items.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items.length intentionally omitted from deps: reset only on depsStr/pageSize, not on add/remove.
  }, [pageSize, depsStr]);

  /** Cap when list shrinks; expand from 0 when list becomes non-empty (e.g. first load). */
  useEffect(() => {
    setVisibleCount((c) => {
      if (items.length === 0) return 0;
      if (c === 0) return Math.min(pageSize, items.length);
      return Math.min(c, items.length);
    });
  }, [items.length, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => {
      if (c >= items.length) return c;
      return Math.min(c + pageSize, items.length);
    });
  }, [pageSize, items.length]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );
  const hasMore = visibleCount < items.length;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const root = rootRef?.current ?? null;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) loadMoreRef.current();
      },
      { root, rootMargin: "80px", threshold: 0 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, items.length, pageSize, rootRef]);

  return {
    visibleItems,
    visibleCount,
    totalCount: items.length,
    hasMore,
    loadMore,
    sentinelRef,
  };
}
