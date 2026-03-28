import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { WeeklySuggestedMealRow } from '../../planner';
import { useIncrementalList } from '../../hooks/useIncrementalList';
import { Button, Select, Input } from '../ui';
import AppModal from '../AppModal';

export const BROWSE_MEALS_PAGE_SIZE = 48;

export interface BrowseMealsModalProps {
  open: boolean;
  onClose: () => void;
  rows: WeeklySuggestedMealRow[];
  renderMealCard: (row: WeeklySuggestedMealRow) => ReactNode;
}

export default function BrowseMealsModal({
  open,
  onClose,
  rows,
  renderMealCard,
}: BrowseMealsModalProps) {
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseEffort, setBrowseEffort] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

  const browseFilteredRows = useMemo(() => {
    const q = browseQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (browseEffort !== 'all' && row.meal.difficulty !== browseEffort) return false;
      if (!q) return true;
      return row.meal.name.toLowerCase().includes(q);
    });
  }, [rows, browseQuery, browseEffort]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const browseResetDeps = useMemo(
    () => [browseQuery, browseEffort, open],
    [browseQuery, browseEffort, open],
  );
  const {
    visibleItems: browseVisibleRows,
    visibleCount,
    totalCount: browseFilteredTotal,
    hasMore: browseHasMore,
    loadMore: browseLoadMore,
    sentinelRef: browseSentinelRef,
  } = useIncrementalList(browseFilteredRows, {
    pageSize: BROWSE_MEALS_PAGE_SIZE,
    resetDeps: [...browseResetDeps],
    rootRef: scrollRootRef,
  });

  return (
    <AppModal
      open={open}
      onClose={onClose}
      ariaLabel="Browse meals"
      backdropClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      backdropTestId="browse-meals-modal"
      className="flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-md p-0 sm:rounded-md"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-light p-4">
        <h2 id="browse-meals-title" className="text-lg font-bold text-text-primary">
          All meals
        </h2>
        <button
          type="button"
          className="min-h-[36px] rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-brand-light hover:text-brand"
          data-testid="browse-meals-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="shrink-0 space-y-3 border-b border-border-light p-4">
        <Input
          type="search"
          placeholder="Search meals…"
          value={browseQuery}
          onChange={(e) => setBrowseQuery(e.target.value)}
          data-testid="browse-meals-search"
          aria-label="Search meals"
        />
        <label className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          Effort
          <Select
            value={browseEffort}
            onChange={(e) => setBrowseEffort(e.target.value as typeof browseEffort)}
            data-testid="browse-meals-effort-filter"
            className="w-auto"
          >
            <option value="all">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </label>
        <p className="text-xs text-text-muted" data-testid="browse-meals-count">
          {browseFilteredTotal} meal{browseFilteredTotal !== 1 ? 's' : ''}
          {browseFilteredTotal > 0 && visibleCount < browseFilteredTotal
            ? ` · showing ${visibleCount} of ${browseFilteredTotal}`
            : ''}
        </p>
      </div>
      <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        <div
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="browse-meals-grid"
        >
          {browseVisibleRows.map((row) => (
            <div key={row.meal.id} className="flex h-full min-h-0 flex-col">
              {renderMealCard(row)}
            </div>
          ))}
        </div>
        <div ref={browseSentinelRef} className="h-px w-full" aria-hidden />
      </div>
      {browseHasMore && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border-light p-4">
          <Button
            type="button"
            variant="default"
            onClick={browseLoadMore}
            data-testid="browse-meals-load-more"
          >
            Load more
          </Button>
        </div>
      )}
    </AppModal>
  );
}
