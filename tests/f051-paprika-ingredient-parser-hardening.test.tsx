import { describe, it, expect } from 'vitest';
import {
  parseIngredientLine,
  matchIngredient,
  isInstructionLine,
  parseRecipeText,
} from '../src/recipe-parser';
import { parsePaprikaLineFromRaw, parsePaprikaRecipes } from '../src/paprika-parser';
import { MASTER_CATALOG } from '../src/catalog';
import type { PaprikaRecipe } from '../src/paprika-parser';
import type { Ingredient } from '../src/types';

const emptyHousehold: Ingredient[] = [];

function makeRecipe(ingredients: string): PaprikaRecipe {
  return {
    name: 'Test',
    ingredients,
    directions: '',
    notes: '',
    source: '',
    source_url: '',
    prep_time: '',
    cook_time: '',
    total_time: '',
    difficulty: '',
    servings: '',
    categories: [],
    image_url: '',
    photo_data: null,
    uid: 'u1',
  };
}

describe('F051 Paprika ingredient parser hardening', () => {
  describe('parseIngredientLine — US measures and packaging', () => {
    it('parses pounds and mixed fractions', () => {
      const r = parseIngredientLine('1 3/4 pounds ground beef or ground lamb');
      expect(r.quantity.toLowerCase()).toMatch(/1\s+3\/4\s+pounds/i);
      expect(r.unit.toLowerCase()).toBe('pounds');
      expect(r.name.toLowerCase()).toContain('ground beef');
    });

    it('parses fluid ounces', () => {
      const r = parseIngredientLine('5 fluid ounces Worcestershire sauce');
      expect(r.quantity).toMatch(/5\s+fluid ounces/i);
      expect(r.unit.toLowerCase()).toContain('fluid');
      expect(r.name.toLowerCase()).toContain('worcestershire');
    });

    it('parses parenthetical size + package + cream cheese', () => {
      const r = parseIngredientLine('1 (8 ounce) package cream cheese, softened');
      expect(r.unit.toLowerCase()).toBe('package');
      expect(r.name.toLowerCase()).toBe('cream cheese');
      expect(r.prepNotes.some((n) => n.includes('8 ounce'))).toBe(true);
      expect(r.prepNotes.some((n) => n.includes('softened'))).toBe(true);
    });

    it('parses package + monterey jack cheese', () => {
      const r = parseIngredientLine('1 (8 ounce) package Monterey Jack cheese, shredded');
      expect(r.name.toLowerCase()).toContain('monterey jack cheese');
    });

    it('parses pound pasta', () => {
      const r = parseIngredientLine('1 pound angel hair pasta');
      expect(r.unit.toLowerCase()).toBe('pound');
      expect(r.name.toLowerCase()).toContain('angel hair pasta');
    });

    it('parses multiple cans with parenthetical weights', () => {
      const r = parseIngredientLine('2 (10 3/4 ounce) cans condensed cream of chicken soup');
      expect(r.unit.toLowerCase()).toMatch(/cans/);
      expect(r.name.toLowerCase()).toContain('condensed cream of chicken soup');
    });

    it('parses single can with decimal ounce', () => {
      const r = parseIngredientLine('1 (10.5 ounce) can condensed French onion soup');
      expect(r.unit.toLowerCase()).toMatch(/can/);
      expect(r.name.toLowerCase()).toContain('french onion soup');
    });
  });

  describe('parseIngredientLine — quantity ranges (hyphen / en-dash)', () => {
    it('parses integer ranges with units', () => {
      const r = parseIngredientLine('1-2 tablespoons green curry paste');
      expect(r.quantity.toLowerCase()).toMatch(/1-2\s+tablespoons/);
      expect(r.name.toLowerCase()).toBe('green curry paste');
    });

    it('parses integer ranges before size words (no measure unit)', () => {
      const carrots = parseIngredientLine('3-4 large carrots');
      expect(carrots.quantity).toBe('3-4');
      expect(carrots.name.toLowerCase()).toBe('carrots');

      const scallions = parseIngredientLine('4-5 scallions');
      expect(scallions.quantity).toBe('4-5');
      expect(scallions.name.toLowerCase()).toBe('scallions');
    });

    it('parses fraction ranges with teaspoon', () => {
      const r = parseIngredientLine('1/4-1/2 teaspoon cayenne pepper');
      expect(r.quantity.toLowerCase()).toMatch(/1\/4-1\/2\s+teaspoon/);
      expect(r.name.toLowerCase()).toBe('cayenne pepper');
    });

    it('parses fraction ranges with optional spaces around the dash', () => {
      const r = parseIngredientLine('1/4 - 1/2 teaspoon salt');
      expect(r.quantity.toLowerCase()).toMatch(/1\/4\s*-\s*1\/2\s+teaspoon/);
      expect(r.name.toLowerCase()).toBe('salt');
    });

    it('parses mixed fraction-to-integer ranges', () => {
      const r = parseIngredientLine('1/2-1 teaspoon crushed red pepper flakes');
      expect(r.quantity.toLowerCase()).toMatch(/1\/2-1\s+teaspoon/);
      expect(r.quantityValue).toBeCloseTo(0.5);
      expect(r.name.toLowerCase()).toBe('red pepper flakes');
      expect(r.prepNotes).toContain('crushed');
    });

    it('parses unicode-fraction-to-integer ranges with spaces', () => {
      const r = parseIngredientLine('½ - 1 red chilli, deseeded and chopped');
      expect(r.quantity).toMatch(/½\s*-\s*1/);
      expect(r.quantityValue).toBeCloseTo(0.5);
      expect(r.name.toLowerCase()).toContain('red chilli');
    });

    it('parses decimal-to-integer ranges', () => {
      const r = parseIngredientLine('1.5-2 tablespoons of olive oil');
      expect(r.quantity.toLowerCase()).toMatch(/1\.5-2\s+tablespoons/);
      expect(r.quantityValue).toBeCloseTo(1.5);
      expect(r.name.toLowerCase()).toContain('olive oil');
    });

    it('parses fraction-to-integer ranges with different units', () => {
      const r = parseIngredientLine('1/2-2 tsp salt, to taste');
      expect(r.quantity.toLowerCase()).toMatch(/1\/2-2\s+tsp/);
      expect(r.quantityValue).toBeCloseTo(0.5);
      expect(r.name.toLowerCase()).toBe('salt');
    });
  });

  describe('parseIngredientLine — dimension modifiers (e.g. 1/2-inch)', () => {
    it('handles fraction-inch dimension as prep note, not ingredient name', () => {
      const r = parseIngredientLine('1/2-inch cubes (about 4 cups)');
      expect(r.name.toLowerCase()).not.toContain('-inch');
      expect(r.prepNotes.some((n) => n.includes('1/2-inch'))).toBe(true);
    });

    it('handles space-dash-inch with unit and ingredient', () => {
      const r = parseIngredientLine('1 -inch piece ginger, peeled and finely chopped');
      expect(r.name.toLowerCase()).toBe('ginger');
      expect(r.unit.toLowerCase()).toBe('piece');
      expect(r.prepNotes.some((n) => n.includes('1-inch'))).toBe(true);
    });

    it('handles integer-dash-inch dimension', () => {
      const r = parseIngredientLine('2-inch piece fresh ginger');
      expect(r.name.toLowerCase()).toContain('ginger');
      expect(r.prepNotes.some((n) => n.includes('2-inch'))).toBe(true);
    });
  });

  describe('parseIngredientLine — size-packaging patterns (e.g. 14-ounce cans)', () => {
    it('parses quantity + size-unit + packaging unit + ingredient', () => {
      const r = parseIngredientLine(
        '2 14-ounce cans of cherry tomatoes, such as Corbara Datterino or Pomodorini',
      );
      expect(r.quantity).toBe('2');
      expect(r.unit.toLowerCase()).toBe('cans');
      expect(r.name.toLowerCase()).toBe('cherry tomatoes');
      expect(r.prepNotes.some((n) => n.includes('14-ounce'))).toBe(true);
    });

    it('parses size-oz packaging', () => {
      const r = parseIngredientLine('1 15-oz can black beans, drained');
      expect(r.quantity).toBe('1');
      expect(r.unit.toLowerCase()).toBe('can');
      expect(r.name.toLowerCase()).toBe('black beans');
      expect(r.prepNotes.some((n) => n.includes('15-oz'))).toBe(true);
    });

    it('parses size with space instead of dash', () => {
      const r = parseIngredientLine('2 28 ounce cans crushed tomatoes');
      expect(r.quantity).toBe('2');
      expect(r.unit.toLowerCase()).toBe('cans');
      expect(r.name.toLowerCase()).toContain('tomatoes');
      expect(r.prepNotes.some((n) => n.includes('28 ounce'))).toBe(true);
    });
  });

  describe('parseIngredientLine — word-based quantities', () => {
    it('parses "a few sprigs of cilantro" with unit and name', () => {
      const r = parseIngredientLine('A few sprigs of cilantro');
      expect(r.quantity).toBe('a few');
      expect(r.unit.toLowerCase()).toBe('sprigs');
      expect(r.name.toLowerCase()).toBe('cilantro');
    });

    it('parses "a few whole peppercorns" without unit', () => {
      const r = parseIngredientLine('A few whole peppercorns');
      expect(r.quantity).toBe('a few');
      expect(r.name.toLowerCase()).toContain('peppercorns');
    });

    it('parses "a good handful of fresh cilantro"', () => {
      const r = parseIngredientLine('A good handful of fresh cilantro');
      expect(r.quantity).toBe('1');
      expect(r.unit.toLowerCase()).toBe('handful');
      expect(r.name.toLowerCase()).toContain('cilantro');
      expect(r.prepNotes).toContain('good');
    });

    it('parses "dill a handful" as dill with trailing measure in prep notes', () => {
      const r = parseIngredientLine('dill a handful');
      expect(r.name.toLowerCase()).toBe('dill');
      expect(r.prepNotes.some((n) => n.includes('handful'))).toBe(true);
    });

    it('parses "Knob of butter" as butter with knob phrase in prep notes', () => {
      const r = parseIngredientLine('Knob of butter');
      expect(r.name.toLowerCase()).toBe('butter');
      expect(r.prepNotes.some((n) => n.includes('knob'))).toBe(true);
    });

    it('parses "Ground beef or 1 lb ground turkey" as ground beef', () => {
      const r = parseIngredientLine('Ground beef or 1 lb ground turkey');
      expect(r.name.toLowerCase()).toContain('ground beef');
      expect(r.prepNotes.some((n) => n.includes('or ') && n.includes('turkey'))).toBe(true);
    });

    it('does not strip "cream or milk" (no quantity-led alternative)', () => {
      const r = parseIngredientLine('cream or milk');
      expect(r.name.toLowerCase()).toMatch(/cream or milk/);
    });

    it('parses "an avocado"', () => {
      const r = parseIngredientLine('An avocado');
      expect(r.quantity).toBe('1');
      expect(r.name.toLowerCase()).toBe('avocado');
    });

    it('parses "a large onion, diced"', () => {
      const r = parseIngredientLine('A large onion, diced');
      expect(r.quantity).toBe('1');
      expect(r.name.toLowerCase()).toContain('onion');
    });

    it('parses "some fresh basil"', () => {
      const r = parseIngredientLine('Some fresh basil');
      expect(r.quantity).toBe('some');
      expect(r.name.toLowerCase()).toContain('basil');
    });

    it('parses "a generous pinch of salt"', () => {
      const r = parseIngredientLine('A generous pinch of salt');
      expect(r.unit.toLowerCase()).toBe('pinch');
      expect(r.name.toLowerCase()).toBe('salt');
      expect(r.prepNotes).toContain('generous');
    });

    it('does not match words that merely start with a/an', () => {
      const r = parseIngredientLine('Arugula, washed');
      expect(r.name.toLowerCase()).toContain('arugula');
      expect(r.quantity).toBe('');
    });
  });

  describe('parseIngredientLine — approximation words (About, Roughly, etc.)', () => {
    it('strips "About" before a fraction quantity', () => {
      const r = parseIngredientLine('About 1/3 cup water');
      expect(r.quantity.toLowerCase()).toMatch(/1\/3\s+cup/);
      expect(r.unit.toLowerCase()).toBe('cup');
      expect(r.name.toLowerCase()).toBe('water');
      expect(r.prepNotes).toContain('approximately');
    });

    it('strips "About" before an integer quantity', () => {
      const r = parseIngredientLine('About 3 teaspoons Cajun spice mix');
      expect(r.quantity.toLowerCase()).toMatch(/3\s+teaspoons/);
      expect(r.name.toLowerCase()).toContain('cajun spice mix');
      expect(r.prepNotes).toContain('approximately');
    });

    it('strips "About" before a quantity with unit-as-noun', () => {
      const r = parseIngredientLine('About 8 leaves of basil');
      expect(r.quantity).toMatch(/^8/);
      expect(r.name.toLowerCase()).toContain('basil');
      expect(r.prepNotes).toContain('approximately');
    });

    it('does not strip "About" when not followed by a number', () => {
      const r = parseIngredientLine('About the same amount');
      expect(r.name.toLowerCase()).toContain('about');
    });
  });

  describe('parseIngredientLine — leading decimal .5 (Word / list spacing)', () => {
    it('parses .5 before a size word + ingredient', () => {
      const r = parseIngredientLine('.5 large zucchinis');
      expect(r.quantity).toBe('.5');
      expect(r.quantityValue).toBeCloseTo(0.5);
      expect(r.name.toLowerCase()).toBe('zucchinis');
    });

    it('normalizes ". 5" (dot space digit) to a decimal before the name', () => {
      const r = parseIngredientLine('. 5 large zucchinis');
      expect(r.quantity).toBe('.5');
      expect(r.quantityValue).toBeCloseTo(0.5);
      expect(r.name.toLowerCase()).toBe('zucchinis');
    });

    it('leaves ". 5 tbsp" as list-style whole number (not 0.5 tbsp)', () => {
      const r = parseIngredientLine('. 5 tbsp soy sauce');
      expect(r.quantity.toLowerCase()).toMatch(/^5\s+tbsp/);
      expect(r.name.toLowerCase()).toBe('soy sauce');
    });
  });

  describe('dual-use measure as ingredient noun', () => {
    it('parses "5 cloves" as ingredient cloves', () => {
      const r = parseIngredientLine('5 cloves');
      expect(r.quantity).toMatch(/^5\b/);
      expect(r.unit.toLowerCase()).toBe('cloves');
      expect(r.name.toLowerCase()).toBe('cloves');
    });

    it('parses "8 cloves garlic" as garlic with clove unit', () => {
      const r = parseIngredientLine('8 cloves garlic');
      expect(r.unit.toLowerCase()).toBe('cloves');
      expect(r.name.toLowerCase()).toBe('garlic');
    });
  });

  describe('isInstructionLine — section headings', () => {
    it('treats ALL CAPS labels as non-ingredients', () => {
      expect(isInstructionLine('MARINADE')).toBe(true);
      expect(isInstructionLine('GRILLED VEGETABLES')).toBe(true);
      expect(isInstructionLine('LIME MAYONNAISE')).toBe(true);
      expect(isInstructionLine('SALSA')).toBe(true);
    });

    it('treats titled subrecipe labels with colon as instructions', () => {
      expect(isInstructionLine("Aarti's Tandoori Marinade:")).toBe(true);
    });

    it('does not treat normal ingredient lines as headings', () => {
      expect(isInstructionLine('1 cup quinoa (any color), rinsed well')).toBe(false);
      expect(isInstructionLine('1 pinch of salt')).toBe(false);
      expect(isInstructionLine('1 lime, zested and squeezed')).toBe(false);
    });
  });

  describe('matchIngredient — no weak generic catalog matches', () => {
    it('does not map garlic powder to Garlic', () => {
      const m = matchIngredient('garlic powder', emptyHousehold, MASTER_CATALOG);
      expect(m.catalogItem?.id).toBe('cat-garlic-powder');
      expect(m.catalogItem?.name).toBe('garlic powder');
    });

    it('does not map onion powder to Onion', () => {
      const m = matchIngredient('onion powder', emptyHousehold, MASTER_CATALOG);
      expect(m.catalogItem?.id).toBe('cat-onion-powder');
    });

    it('does not map parmesan cheese to generic Cheese', () => {
      const m = matchIngredient('parmesan cheese', emptyHousehold, MASTER_CATALOG);
      expect(m.catalogItem?.id).toBe('cat-parmesan-cheese');
    });

    it('does not map monterey jack cheese to Cheese', () => {
      const m = matchIngredient('monterey jack cheese', emptyHousehold, MASTER_CATALOG);
      expect(m.catalogItem?.id).toBe('cat-monterey-jack-cheese');
    });

    it('maps cream to Cream (not Cream cheese)', () => {
      const m = matchIngredient('cream', emptyHousehold, MASTER_CATALOG);
      expect(m.catalogItem?.id).toBe('cat-cream');
    });

    it('does not map dry bread crumbs to Bread', () => {
      const m = matchIngredient('dry bread crumbs', emptyHousehold, MASTER_CATALOG);
      expect(m.catalogItem?.id).toBe('cat-breadcrumbs');
    });

    it('does not map condensed French onion soup to Onion', () => {
      const m = matchIngredient('condensed French onion soup', emptyHousehold, MASTER_CATALOG);
      expect(m.catalogItem?.id).toBe('cat-french-onion-soup');
    });
  });

  describe('parsePaprikaLineFromRaw / parsePaprikaRecipes import flow', () => {
    it('parses a full Paprika line through parsePaprikaLineFromRaw', () => {
      const line = parsePaprikaLineFromRaw('5 fluid ounces Worcestershire sauce', 'R', 0, []);
      expect(line.name.toLowerCase()).toContain('worcestershire');
      expect(line.matchedCatalog?.id).toBe('cat-worcestershire-sauce');
      expect(line.action).toBe('create');
    });

    it('ignores section headings in parsePaprikaRecipes', () => {
      const parsed = parsePaprikaRecipes([makeRecipe('MARINADE\n1 cup soy sauce')], [], []);
      expect(parsed[0]!.parsedLines[0]!.action).toBe('ignore');
      expect(parsed[0]!.parsedLines[1]!.name.toLowerCase()).toContain('soy');
    });

    it('parseRecipeText preserves quinoa and long olive oil lines', () => {
      const text =
        '1 cup quinoa (any color), rinsed well\n1 tablespoon extra-virgin olive oil, 1 turn of the pan';
      const res = parseRecipeText(text, []);
      expect(res.lines[0]!.name.toLowerCase()).toContain('quinoa');
      expect(res.lines[1]!.name.toLowerCase()).toContain('olive oil');
      expect(res.lines[1]!.raw.length).toBeGreaterThan(50);
    });
  });
});
