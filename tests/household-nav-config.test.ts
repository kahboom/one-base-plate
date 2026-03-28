import { describe, it, expect } from 'vitest';
import {
  buildHouseholdPath,
  isGlobalNavItemActive,
  isSecondaryNavItemActive,
} from '../src/nav/householdNavConfig';

describe('householdNavConfig', () => {
  const hid = 'h1';
  const prefix = `/household/${hid}`;

  it('buildHouseholdPath maps global segments under household', () => {
    expect(buildHouseholdPath(hid, '/weekly')).toBe(`${prefix}/weekly`);
    expect(buildHouseholdPath(hid, '/settings')).toBe(`${prefix}/settings`);
    expect(buildHouseholdPath(hid, '/households')).toBe('/households');
  });

  it('Home is active only on /home, not on setup index', () => {
    expect(isGlobalNavItemActive(`${prefix}/home`, hid, '/home')).toBe(true);
    expect(isGlobalNavItemActive(prefix, hid, '/home')).toBe(false);
    expect(isGlobalNavItemActive(`${prefix}/meal/m1`, hid, '/home')).toBe(false);
  });

  it('Meal planner is not active on meal detail', () => {
    expect(isGlobalNavItemActive(`${prefix}/planner`, hid, '/planner')).toBe(true);
    expect(isGlobalNavItemActive(`${prefix}/meal/m1`, hid, '/planner')).toBe(false);
  });

  it('secondary: All households active on list, root redirect, and setup index', () => {
    expect(isSecondaryNavItemActive('/households', hid, '/households')).toBe(true);
    expect(isSecondaryNavItemActive('/', hid, '/households')).toBe(true);
    expect(isSecondaryNavItemActive(prefix, hid, '/households')).toBe(true);
  });

  it('secondary: Recipes active on library and detail', () => {
    expect(isSecondaryNavItemActive(`${prefix}/recipes`, hid, '/recipes')).toBe(true);
    expect(isSecondaryNavItemActive(`${prefix}/recipes/r1`, hid, '/recipes')).toBe(true);
    expect(isSecondaryNavItemActive(`${prefix}/meals`, hid, '/recipes')).toBe(false);
  });

  it('secondary: Base meals active on list and meal detail', () => {
    expect(isSecondaryNavItemActive(`${prefix}/meals`, hid, '/meals')).toBe(true);
    expect(isSecondaryNavItemActive(`${prefix}/meal/abc`, hid, '/meals')).toBe(true);
    expect(isSecondaryNavItemActive(`${prefix}/ingredients`, hid, '/meals')).toBe(false);
  });

  it('secondary: Settings active only on settings', () => {
    expect(isSecondaryNavItemActive(`${prefix}/settings`, hid, '/settings')).toBe(true);
    expect(isSecondaryNavItemActive(`${prefix}/meals`, hid, '/settings')).toBe(false);
  });
});
