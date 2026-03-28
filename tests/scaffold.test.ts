import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Household } from '../src/types';

const ROOT = join(__dirname, '..');

describe('F001: Repository scaffold', () => {
  it('has package.json with correct project metadata', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('one-base-plate');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
  });

  it('has PRD.json as structured source of truth', () => {
    const prd = JSON.parse(readFileSync(join(ROOT, 'PRD.json'), 'utf-8'));
    expect(prd.project.name).toBe('OneBasePlate');
    expect(prd.features).toBeDefined();
    expect(prd.features.length).toBeGreaterThan(0);
  });

  it('has init.sh', () => {
    expect(existsSync(join(ROOT, 'init.sh'))).toBe(true);
  });

  it('has agent-progress.md', () => {
    expect(existsSync(join(ROOT, 'agent-progress.md'))).toBe(true);
  });

  it('has at least one household fixture with valid structure', () => {
    const fixturePath = join(ROOT, 'fixtures/households/H001-mcg.json');
    expect(existsSync(fixturePath)).toBe(true);

    const household: Household = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    expect(household.id).toBe('H001');
    expect(household.members.length).toBeGreaterThanOrEqual(3);

    const roles = household.members.map((m) => m.role);
    expect(roles).toContain('adult');
    expect(roles).toContain('toddler');
    expect(roles).toContain('baby');

    for (const member of household.members) {
      expect(member.id).toBeDefined();
      expect(member.name).toBeDefined();
      expect(member.role).toBeDefined();
      expect(Array.isArray(member.safeFoods)).toBe(true);
      expect(Array.isArray(member.hardNoFoods)).toBe(true);
      expect(Array.isArray(member.preparationRules)).toBe(true);
    }
  });

  it('has a sample meal fixture', () => {
    const mealPath = join(ROOT, 'fixtures/meals/pasta-base.json');
    expect(existsSync(mealPath)).toBe(true);

    const meal = JSON.parse(readFileSync(mealPath, 'utf-8'));
    expect(meal.id).toBeDefined();
    expect(meal.name).toBeDefined();
    expect(meal.components.length).toBeGreaterThan(0);
  });

  it('has TypeScript types matching PRD data model', () => {
    const typesPath = join(ROOT, 'src/types.ts');
    expect(existsSync(typesPath)).toBe(true);

    const content = readFileSync(typesPath, 'utf-8');
    expect(content).toContain('HouseholdMember');
    expect(content).toContain('Ingredient');
    expect(content).toContain('BaseMeal');
    expect(content).toContain('AssemblyVariant');
    expect(content).toContain('WeeklyPlan');
  });
});
