import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { vi } from 'vitest';
import { resetAppStorageForTests } from '../src/storage';

// Node.js 25+ exposes a native localStorage global that lacks the full Storage
// interface (no .clear(), .setItem(), etc.) unless --localstorage-file is provided.
// When running under vitest/jsdom, the jsdom window's proper Storage is available
// via globalThis.jsdom.window.localStorage — promote it to globalThis so tests
// get the correct implementation.
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsdomWindow = (globalThis as any).jsdom?.window;
  if (jsdomWindow?.localStorage) {
    Object.defineProperty(globalThis, 'localStorage', {
      value: jsdomWindow.localStorage,
      writable: true,
      configurable: true,
    });
  }
}

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
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
} as unknown as typeof IntersectionObserver;

/* WeeklyPlanner and other screens use matchMedia for responsive caps */
Object.defineProperty(window, 'matchMedia', {
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
