export type MemberRole = "adult" | "toddler" | "baby" | "pet";

export type TextureLevel = "regular" | "soft" | "mashable" | "pureed";

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
  | "protein"
  | "carb"
  | "veg"
  | "fruit"
  | "dairy"
  | "snack"
  | "freezer"
  | "pantry";

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  tags: string[];
  shelfLifeHint: string;
  freezerFriendly: boolean;
  babySafeWithAdaptation: boolean;
  imageUrl?: string;
  catalogId?: string;
  source?: "manual" | "catalog";
}

export type ComponentRecipeSourceType =
  | "internal-meal"
  | "imported-recipe"
  | "external-url"
  | "note";

/** Optional per-component “how to make this” source; backwards-compatible when absent. */
export interface ComponentRecipeRef {
  id: string;
  componentId: string;
  sourceType: ComponentRecipeSourceType;
  linkedBaseMealId?: string;
  /** When the source is an imported/stored recipe row; may match linkedBaseMealId. */
  importedRecipeSourceId?: string;
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
  role: "protein" | "carb" | "veg" | "sauce" | "topping";
  quantity: string;
  unit?: string;
  prepNote?: string;
  recipeRefs?: ComponentRecipeRef[];
  originalSourceLine?: string;
  matchType?: "existing" | "new" | "ignored";
  confidence?: number;
}

export interface RecipeProvenance {
  sourceSystem: string;
  externalId?: string;
  sourceUrl?: string;
  importTimestamp: string;
  syncTimestamp?: string;
}

export interface RecipeLink {
  label: string;
  url: string;
}

export interface BaseMeal {
  id: string;
  name: string;
  /** Optional tags for theme matching and organization (e.g. taco, pizza). */
  tags?: string[];
  components: MealComponent[];
  defaultPrep: string;
  estimatedTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  rescueEligible: boolean;
  wasteReuseHints: string[];
  recipeLinks?: RecipeLink[];
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
  action: "use" | "create" | "ignore";
  chosenAction?: "use" | "create" | "ignore";
  ingredientId?: string;
  finalMatchedIngredientId?: string;
  matchType?: "existing" | "new" | "ignored";
  /** Paprika / import audit */
  matchScore?: number;
  confidenceBand?: "exact" | "strong" | "low";
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

export type MealOutcomeResult = "success" | "partial" | "failure";

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
  name: string;
  members: HouseholdMember[];
  ingredients: Ingredient[];
  baseMeals: BaseMeal[];
  weeklyPlans: WeeklyPlan[];
  pinnedMealIds?: string[];
  mealOutcomes?: MealOutcome[];
  weeklyAnchors?: WeeklyAnchor[];
}
