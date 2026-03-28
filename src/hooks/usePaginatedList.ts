import { useCallback, useEffect, useMemo, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

export interface UsePaginatedListOptions {
  initialPageSize?: PageSize;
  /** When any of these change, page resets to 1. */
  resetDeps: unknown[];
}

export interface UsePaginatedListResult<T> {
  pageItems: T[];
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: PageSize;
  setPage: (p: number) => void;
  setPageSize: (size: PageSize) => void;
}

export function usePaginatedList<T>(
  items: T[],
  options: UsePaginatedListOptions,
): UsePaginatedListResult<T> {
  const [pageSize, setPageSize] = useState<PageSize>(options.initialPageSize ?? DEFAULT_PAGE_SIZE);
  const [page, setPageRaw] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const depsStr = JSON.stringify(options.resetDeps);

  useEffect(() => {
    setPageRaw(1);
  }, [depsStr, pageSize]);

  useEffect(() => {
    setPageRaw((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const setPage = useCallback(
    (p: number) => setPageRaw(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  );

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    pageItems,
    page,
    totalPages,
    totalCount: items.length,
    pageSize,
    setPageSize,
    setPage,
  };
}
