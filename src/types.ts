export type MemberRole = 'adult' | 'toddler' | 'baby' | 'pet';

export type TextureLevel = 'regular' | 'soft' | 'mashable' | 'pureed';

export interface PreparationRule {
  ingredient: string;
  rule: string;
}

export interface HouseholdMember {
  id: string;
  name: string;
  role: MemberRole;
  safeFoods: string[];
  hardNoFoods: string[];
  preparationRules: PreparationRule[];
  textureLevel: TextureLevel;
  allergens: string[];
  notes: string;
}

export type IngredientCategory =
  | 'protein'
  | 'carb'
  | 'veg'
  | 'fruit'
  | 'dairy'
  | 'snack'
  | 'freezer'
  | 'pantry';

export interface RecipeRef {
  recipeId: string;
  label?: string;
  role?: 'primary' | 'assembly' | 'shortcut' | 'component' | 'sub-recipe' | 'batch-prep';
  notes?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  /** Alternate match/search/import names; canonical display remains `name`. */
  aliases?: string[];
  category: IngredientCategory;
  tags: string[];
  shelfLifeHint: string;
  freezerFriendly: boolean;
  babySafeWithAdaptation: boolean;
  imageUrl?: string;
  catalogId?: string;
  source?: 'manual' | 'catalog' | 'pending-import';
  /** Optional fallback recipe refs; not the primary model for recipe resolution. */
  defaultRecipeRefs?: RecipeRef[];
}

export type ComponentRecipeSourceType =
  | 'internal-meal'
  | 'imported-recipe'
  | 'external-url'
  | 'note';

/** Optional per-component “how to make this” source; backwards-compatible when absent. */
export interface ComponentRecipeRef {
  id: string;
  componentId: string;
  sourceType: ComponentRecipeSourceType;
  linkedBaseMealId?: string;
  /** When the source is an imported/stored recipe row; may match linkedBaseMealId. */
  importedRecipeSourceId?: string;
  /** Explicit FK to a Recipe library entry. */
  recipeId?: string;
  label: string;
  url?: string;
  notes?: string;
  isDefault?: boolean;
}

export interface MealComponent {
  /** Stable id for overrides and recipe refs; assigned on load/save if missing. */
  id?: string;
  ingredientId: string;
  alternativeIngredientIds?: string[];
  role: 'protein' | 'carb' | 'veg' | 'sauce' | 'topping';
  quantity: string;
  unit?: string;
  prepNote?: string;
  recipeRefs?: ComponentRecipeRef[];
  originalSourceLine?: string;
  matchType?: 'existing' | 'new' | 'ignored';
  confidence?: number;
}

export interface RecipeProvenance {
  sourceSystem: string;
  externalId?: string;
  sourceUrl?: string;
  importTimestamp: string;
  syncTimestamp?: string;
  /** Original Paprika category strings from export (provenance only; not user-facing tags). */
  rawCategories?: string[];
}

export interface RecipeLink {
  label: string;
  url: string;
}

/**
 * Imported or hand-entered recipe in the household library. Not directly scheduled;
 * promote to a {@link BaseMeal} for planning and groceries.
 */
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  /** Optional tags for search/filter and classification (parallels BaseMeal.tags). */
  tags?: string[];
  components: MealComponent[];
  /** Original ingredients block from import (e.g. Paprika or pasted text). */
  ingredientsText?: string;
  /** Step-by-step cooking directions. */
  directions?: string;
  defaultPrep?: string;
  notes?: string;
  recipeLinks?: RecipeLink[];
  imageUrl?: string;
  provenance?: RecipeProvenance;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: string;
  importMappings?: ImportMapping[];
}

export interface BaseMeal {
  id: string;
  /** When this base meal was created from a library recipe. */
  sourceRecipeId?: string;
  name: string;
  /** Optional tags for theme matching and organization (e.g. taco, pizza). */
  tags?: string[];
  components: MealComponent[];
  defaultPrep: string;
  estimatedTimeMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  rescueEligible: boolean;
  wasteReuseHints: string[];
  recipeLinks?: RecipeLink[];
  /** Explicit references to Recipe library entries for whole-meal / assembly / shortcut cooking. */
  recipeRefs?: RecipeRef[];
  notes?: string;
  imageUrl?: string;
  provenance?: RecipeProvenance;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: string;
  importMappings?: ImportMapping[];
}

export interface ImportMapping {
  originalLine: string;
  parsedName: string;
  cleanedIngredientName?: string;
  parsedQuantityValue?: number;
  parsedQuantityUnit?: string;
  prepNotes?: string[];
  action: 'use' | 'create' | 'ignore';
  chosenAction?: 'use' | 'create' | 'ignore';
  ingredientId?: string;
  finalMatchedIngredientId?: string;
  matchType?: 'existing' | 'new' | 'ignored';
  /** Paprika / import audit */
  matchScore?: number;
  confidenceBand?: 'exact' | 'strong' | 'low';
  parserSuggestedIngredientId?: string;
  parserSuggestedCatalogId?: string;
  /** User-edited canonical name when creating a new ingredient from import */
  finalCanonicalName?: string;
  importAliasRetained?: boolean;
  explicitIgnore?: boolean;
}

export interface AssemblyVariant {
  id: string;
  baseMealId: string;
  memberId: string;
  instructions: string[];
  requiresExtraPrep: boolean;
  safeFoodIncluded: boolean;
}

export interface DayPlan {
  day: string;
  baseMealId: string;
  variants: AssemblyVariant[];
  /** Plan-night only; does not change BaseMeal defaults. */
  componentRecipeOverrides?: ComponentRecipeRef[];
}

export interface GroceryItem {
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  quantity: string;
  owned: boolean;
}

export interface WeeklyPlan {
  id: string;
  days: DayPlan[];
  selectedBaseMeals: string[];
  generatedGroceryList: GroceryItem[];
  notes: string;
}

export type MealOutcomeResult = 'success' | 'partial' | 'failure';

export interface MealOutcome {
  id: string;
  baseMealId: string;
  day: string;
  outcome: MealOutcomeResult;
  notes: string;
  date: string;
}

/** Soft weekly theme (e.g. Taco night); optional and non-blocking. */
export interface WeeklyAnchor {
  id: string;
  weekday: string;
  label: string;
  matchTags: string[];
  matchStructureTypes: string[];
  matchMealIds?: string[];
  enabled: boolean;
  notes?: string;
  icon?: string;
}

export interface Household {
  id: string;
  /**
   * Supabase `households.id` when `id` is not a UUID (e.g. seed `H001`).
   * Set on first successful cloud sync; keep local `id` for URLs and references.
   */
  cloudHouseholdId?: string;
  name: string;
  members: HouseholdMember[];
  ingredients: Ingredient[];
  /** Recipe library (imports, reference). Omitted in raw JSON until loaded; use `normalizeHousehold`. */
  recipes?: Recipe[];
  baseMeals: BaseMeal[];
  weeklyPlans: WeeklyPlan[];
  /** Catalog item ids intentionally removed/merged by user; prevents auto re-population. */
  suppressedCatalogIds?: string[];
  pinnedMealIds?: string[];
  mealOutcomes?: MealOutcome[];
  weeklyAnchors?: WeeklyAnchor[];
}
