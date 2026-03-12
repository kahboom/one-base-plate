export type MemberRole = "adult" | "toddler" | "baby";

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
}

export interface MealComponent {
  ingredientId: string;
  role: "protein" | "carb" | "veg" | "sauce" | "topping";
  quantity: string;
}

export interface BaseMeal {
  id: string;
  name: string;
  components: MealComponent[];
  defaultPrep: string;
  estimatedTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  rescueEligible: boolean;
  wasteReuseHints: string[];
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

export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
  ingredients: Ingredient[];
  baseMeals: BaseMeal[];
  weeklyPlans: WeeklyPlan[];
}
