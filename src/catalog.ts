import type { Ingredient, IngredientCategory } from "./types";

export interface CatalogIngredient {
  id: string;
  name: string;
  category: IngredientCategory;
  tags: string[];
  freezerFriendly: boolean;
  babySafeWithAdaptation: boolean;
}

function c(
  id: string,
  name: string,
  category: IngredientCategory,
  tags: string[] = [],
  freezerFriendly = false,
  babySafeWithAdaptation = false,
): CatalogIngredient {
  return { id, name, category, tags, freezerFriendly, babySafeWithAdaptation };
}

export const MASTER_CATALOG: CatalogIngredient[] = [
  // Proteins
  c("cat-chicken-breast", "Chicken breast", "protein", ["quick"], true, true),
  c("cat-chicken-thigh", "Chicken thigh", "protein", ["batch-friendly"], true, true),
  c("cat-ground-beef", "Ground beef", "protein", ["quick"], true, false),
  c("cat-ground-turkey", "Ground turkey", "protein", ["quick"], true, true),
  c("cat-salmon", "Salmon", "protein", ["quick"], true, true),
  c("cat-cod", "Cod", "protein", ["quick"], true, true),
  c("cat-tuna", "Tuna (canned)", "protein", ["quick", "staple", "rescue"], false, true),
  c("cat-prawns", "Prawns", "protein", ["quick"], true, false),
  c("cat-tofu", "Tofu", "protein", ["quick"], false, true),
  c("cat-eggs", "Eggs", "protein", ["quick", "rescue", "staple"], false, true),
  c("cat-lentils", "Lentils", "protein", ["batch-friendly", "staple"], false, true),
  c("cat-chickpeas", "Chickpeas", "protein", ["batch-friendly", "staple"], false, true),
  c("cat-pork-mince", "Pork mince", "protein", ["batch-friendly"], true, false),
  c("cat-sausages", "Sausages", "protein", ["quick", "rescue"], true, false),
  c("cat-fish-fingers", "Fish fingers", "protein", ["quick", "rescue"], true, true),

  // Carbs
  c("cat-pasta", "Pasta", "carb", ["quick", "staple"], false, true),
  c("cat-rice", "Rice", "carb", ["staple", "batch-friendly"], false, true),
  c("cat-bread", "Bread", "carb", ["quick", "staple", "rescue"], true, true),
  c("cat-wraps", "Wraps / tortillas", "carb", ["quick"], false, false),
  c("cat-potatoes", "Potatoes", "carb", ["staple", "batch-friendly", "mashable"], false, true),
  c("cat-sweet-potato", "Sweet potato", "carb", ["batch-friendly", "mashable"], false, true),
  c("cat-couscous", "Couscous", "carb", ["quick"], false, true),
  c("cat-noodles", "Noodles", "carb", ["quick"], false, true),
  c("cat-oats", "Oats", "carb", ["quick", "staple"], false, true),
  c("cat-pitta", "Pitta bread", "carb", ["quick"], false, false),

  // Vegetables
  c("cat-broccoli", "Broccoli", "veg", ["quick", "mashable"], true, true),
  c("cat-carrots", "Carrots", "veg", ["staple", "mashable"], false, true),
  c("cat-peas", "Peas", "veg", ["quick"], true, true),
  c("cat-sweetcorn", "Sweetcorn", "veg", ["quick"], true, true),
  c("cat-spinach", "Spinach", "veg", ["quick", "mashable"], true, true),
  c("cat-peppers", "Peppers", "veg", ["quick"], true, false),
  c("cat-courgette", "Courgette", "veg", ["mashable"], false, true),
  c("cat-tomatoes", "Tomatoes", "veg", ["staple"], false, true),
  c("cat-green-beans", "Green beans", "veg", ["quick"], true, true),
  c("cat-cucumber", "Cucumber", "veg", ["quick"], false, false),
  c("cat-onion", "Onion", "veg", ["staple"], false, false),
  c("cat-garlic", "Garlic", "veg", ["staple"], false, false),
  c("cat-mushrooms", "Mushrooms", "veg", ["quick"], false, false),
  c("cat-avocado", "Avocado", "veg", ["quick", "mashable"], false, true),

  // Fruit
  c("cat-banana", "Banana", "fruit", ["quick", "mashable"], false, true),
  c("cat-apple", "Apple", "fruit", ["quick"], false, true),
  c("cat-blueberries", "Blueberries", "fruit", ["quick"], true, true),
  c("cat-strawberries", "Strawberries", "fruit", ["quick"], true, true),
  c("cat-grapes", "Grapes", "fruit", ["quick"], false, false),
  c("cat-orange", "Orange", "fruit", ["quick"], false, true),
  c("cat-raisins", "Raisins", "fruit", ["quick", "staple"], false, false),

  // Dairy
  c("cat-milk", "Milk", "dairy", ["staple"], false, true),
  c("cat-cheese", "Cheese", "dairy", ["quick", "staple", "rescue"], true, true),
  c("cat-yogurt", "Yogurt", "dairy", ["quick"], false, true),
  c("cat-butter", "Butter", "dairy", ["staple"], true, true),
  c("cat-cream-cheese", "Cream cheese", "dairy", ["quick"], false, true),

  // Snacks
  c("cat-crackers", "Crackers", "snack", ["quick", "rescue"], false, false),
  c("cat-rice-cakes", "Rice cakes", "snack", ["quick", "rescue"], false, true),
  c("cat-breadsticks", "Breadsticks", "snack", ["quick", "rescue"], false, true),
  c("cat-hummus", "Hummus", "snack", ["quick"], false, true),
  c("cat-peanut-butter", "Peanut butter", "snack", ["quick", "staple"], false, false),

  // Freezer
  c("cat-frozen-peas", "Frozen peas", "freezer", ["quick", "rescue"], true, true),
  c("cat-frozen-sweetcorn", "Frozen sweetcorn", "freezer", ["quick", "rescue"], true, true),
  c("cat-frozen-berries", "Frozen berries", "freezer", ["quick"], true, true),
  c("cat-frozen-spinach", "Frozen spinach", "freezer", ["quick", "mashable"], true, true),
  c("cat-ice-cream", "Ice cream", "freezer", [], true, false),

  // Pantry
  c("cat-tinned-tomatoes", "Tinned tomatoes", "pantry", ["staple", "batch-friendly"], false, true),
  c("cat-coconut-milk", "Coconut milk", "pantry", ["staple"], false, true),
  c("cat-passata", "Passata", "pantry", ["staple"], false, true),
  c("cat-stock-cubes", "Stock cubes", "pantry", ["staple"], false, false),
  c("cat-olive-oil", "Olive oil", "pantry", ["staple"], false, true),
  c("cat-soy-sauce", "Soy sauce", "pantry", ["staple"], false, false),
  c("cat-flour", "Flour", "pantry", ["staple"], false, false),
  c("cat-baked-beans", "Baked beans", "pantry", ["quick", "rescue", "staple"], false, true),
  c("cat-pesto", "Pesto", "pantry", ["quick"], false, false),
];

export function searchCatalog(query: string): CatalogIngredient[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return MASTER_CATALOG.filter((item) =>
    item.name.toLowerCase().includes(q),
  );
}

export function catalogIngredientToHousehold(
  catalogItem: CatalogIngredient,
  overrides?: Partial<Ingredient>,
): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: catalogItem.name,
    category: catalogItem.category,
    tags: [...catalogItem.tags],
    shelfLifeHint: "",
    freezerFriendly: catalogItem.freezerFriendly,
    babySafeWithAdaptation: catalogItem.babySafeWithAdaptation,
    catalogId: catalogItem.id,
    source: "catalog",
    ...overrides,
  };
}

export function findNearDuplicates(
  name: string,
  existingIngredients: Ingredient[],
  excludeId?: string,
): Ingredient[] {
  const normalized = name.toLowerCase().trim();
  if (!normalized) return [];
  return existingIngredients.filter((ing) => {
    if (excludeId && ing.id === excludeId) return false;
    return ing.name.toLowerCase().trim() === normalized;
  });
}

export function getCatalogByCategory(category: IngredientCategory): CatalogIngredient[] {
  return MASTER_CATALOG.filter((item) => item.category === category);
}
