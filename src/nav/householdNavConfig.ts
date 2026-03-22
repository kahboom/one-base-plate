/**
 * Central config for household-scoped navigation (PRD F036, F053).
 * Global = top-level app areas; secondary = household library / switching.
 */

export const GLOBAL_NAV_ITEMS = [
  { label: "Home", path: "/home" },
  { label: "Weekly planner", path: "/weekly" },
  { label: "Meal planner", path: "/planner" },
  { label: "Grocery list", path: "/grocery" },
  { label: "Rescue mode", path: "/rescue" },
  { label: "Meal history", path: "/history" },
] as const;

export type GlobalNavPath = (typeof GLOBAL_NAV_ITEMS)[number]["path"];

export const SECONDARY_NAV_ITEMS = [
  { label: "All households", path: "/households" },
  { label: "Ingredients", path: "/ingredients" },
  { label: "Recipes", path: "/recipes" },
  { label: "Base meals", path: "/meals" },
  { label: "Settings", path: "/settings" },
] as const;

export type SecondaryNavPath = (typeof SECONDARY_NAV_ITEMS)[number]["path"];

export function buildHouseholdPath(
  householdId: string | undefined,
  itemPath: string,
): string {
  if (itemPath === "/households") {
    return "/households";
  }
  if (!householdId) {
    return itemPath;
  }
  return `/household/${householdId}${itemPath}`;
}

export function isGlobalNavItemActive(
  currentPath: string,
  householdId: string | undefined,
  itemPath: string,
): boolean {
  if (!householdId) return false;
  const prefix = `/household/${householdId}`;
  if (itemPath === "/home") {
    return currentPath === `${prefix}/home`;
  }
  if (itemPath === "/planner") {
    return currentPath.startsWith(`${prefix}/planner`);
  }
  return currentPath.startsWith(`${prefix}${itemPath}`);
}

export function isSecondaryNavItemActive(
  currentPath: string,
  householdId: string | undefined,
  itemPath: string,
): boolean {
  if (itemPath === "/households") {
    if (currentPath === "/households" || currentPath === "/") {
      return true;
    }
    if (!householdId) return false;
    return currentPath === `/household/${householdId}`;
  }
  if (!householdId) return false;
  const prefix = `/household/${householdId}`;
  if (itemPath === "/ingredients") {
    return currentPath.startsWith(`${prefix}/ingredients`);
  }
  if (itemPath === "/recipes") {
    return currentPath.startsWith(`${prefix}/recipes`);
  }
  if (itemPath === "/meals") {
    return (
      currentPath.startsWith(`${prefix}/meals`) ||
      currentPath.startsWith(`${prefix}/meal/`)
    );
  }
  if (itemPath === "/settings") {
    return currentPath.startsWith(`${prefix}/settings`);
  }
  return false;
}
