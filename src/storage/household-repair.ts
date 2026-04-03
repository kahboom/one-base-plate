/**
 * Backwards-compatibility repair layer for persisted household JSON.
 *
 * The Household shape evolves over time. Data stored in IndexedDB or in Supabase
 * JSON blobs may be missing fields that were added in newer builds. This module
 * ensures that loaded data is always safe to hand to the rest of the app, without
 * throwing or silently producing undefined-access crashes.
 *
 * Rules:
 * - Required arrays (members, ingredients, baseMeals, weeklyPlans) default to [].
 * - Required strings (name) default to ''.
 * - Optional fields are left absent — the app already handles `undefined`.
 * - Never mutate the input; always return a new object.
 * - If a row is completely unrecognisable (not an object), return null so the caller
 *   can log and skip rather than crash.
 *
 * When to update this file:
 * - You add a new required field to `Household` → add a default here.
 * - You remove or rename a field → add a strip/rename step here.
 * - The PR template checklist will remind you.
 */

import type { Household } from '../types';

/**
 * Repair a single raw value that is supposed to be a `Household`.
 * Returns `null` when the value is so broken it cannot be safely used
 * (e.g. not an object at all).
 *
 * A `fallbackId` may be supplied by the sync layer when the embedded
 * `data.id` is missing but the Supabase row id is known — this avoids
 * discarding otherwise-valid remote data.
 */
export function repairHousehold(raw: unknown, fallbackId?: string): Household | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    console.warn('[household-repair] skipping non-object household row:', typeof raw);
    return null;
  }

  const h = raw as Record<string, unknown>;

  const id = typeof h['id'] === 'string' && h['id'] ? h['id'] : fallbackId;
  if (!id) {
    console.warn('[household-repair] skipping household with no id');
    return null;
  }

  let repaired = false;

  function defaultArray(key: string): unknown[] {
    const v = h[key];
    if (Array.isArray(v)) return v;
    if (v !== undefined) {
      console.warn(`[household-repair] "${key}" was not an array (${typeof v}); resetting to []`);
    }
    repaired = true;
    return [];
  }

  function defaultString(key: string, fallback: string): string {
    const v = h[key];
    if (typeof v === 'string') return v;
    if (v !== undefined) {
      console.warn(`[household-repair] "${key}" was not a string; using fallback`);
    }
    repaired = true;
    return fallback;
  }

  const result: Household = {
    ...(h as object),
    id,
    name: defaultString('name', ''),
    members: defaultArray('members') as Household['members'],
    ingredients: defaultArray('ingredients') as Household['ingredients'],
    baseMeals: defaultArray('baseMeals') as Household['baseMeals'],
    weeklyPlans: defaultArray('weeklyPlans') as Household['weeklyPlans'],
  };

  if (repaired) {
    console.warn(`[household-repair] household "${id}" was repaired — check for schema drift`);
  }

  return result;
}

/**
 * Repair an array of raw household values.
 * Rows that cannot be repaired are dropped with a warning rather than crashing the app.
 */
export function repairHouseholds(raw: unknown[]): Household[] {
  const out: Household[] = [];
  for (let i = 0; i < raw.length; i++) {
    const repaired = repairHousehold(raw[i]);
    if (repaired) {
      out.push(repaired);
    } else {
      console.warn(`[household-repair] dropped unparseable household at index ${i}`);
    }
  }
  return out;
}
