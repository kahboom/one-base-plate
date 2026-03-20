import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIncrementalList } from "../src/hooks/useIncrementalList";

describe("useIncrementalList", () => {
  it("shows first page and loadMore reveals more", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const { result } = renderHook(() =>
      useIncrementalList(items, {
        pageSize: 10,
        resetDeps: ["a"],
      }),
    );
    expect(result.current.visibleItems.length).toBe(10);
    expect(result.current.hasMore).toBe(true);
    act(() => {
      result.current.loadMore();
    });
    expect(result.current.visibleItems.length).toBe(20);
  });

  it("resets visible count when resetDeps change", () => {
    const { result, rerender } = renderHook(
      ({ dep, items }: { dep: string; items: number[] }) =>
        useIncrementalList(items, {
          pageSize: 10,
          resetDeps: [dep],
        }),
      { initialProps: { dep: "one", items: Array.from({ length: 50 }, (_, i) => i) } },
    );
    act(() => {
      result.current.loadMore();
    });
    expect(result.current.visibleItems.length).toBeGreaterThan(10);

    rerender({ dep: "two", items: Array.from({ length: 50 }, (_, i) => i) });
    expect(result.current.visibleItems.length).toBe(10);
  });

  it("caps visible count when items shrink", () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: number[] }) =>
        useIncrementalList(items, {
          pageSize: 10,
          resetDeps: ["x"],
        }),
      { initialProps: { items: Array.from({ length: 100 }, (_, i) => i) } },
    );
    act(() => {
      result.current.loadMore();
    });
    expect(result.current.visibleItems.length).toBe(20);

    rerender({ items: [1, 2, 3] });
    expect(result.current.visibleItems.length).toBe(3);
  });
});
