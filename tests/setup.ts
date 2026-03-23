import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { vi } from "vitest";
import { resetAppStorageForTests } from "../src/storage";

beforeEach(async () => {
  localStorage.clear();
  await resetAppStorageForTests();
});

/* useIncrementalList (Base meals, ingredients, browse modal) */
globalThis.IntersectionObserver = class IntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root: Element | null = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
} as unknown as typeof IntersectionObserver;

/* WeeklyPlanner and other screens use matchMedia for responsive caps */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
