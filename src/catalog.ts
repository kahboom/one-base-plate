import type { Ingredient, IngredientCategory } from './types';

export interface CatalogIngredient {
  id: string;
  name: string;
  category: IngredientCategory;
  tags: string[];
  freezerFriendly: boolean;
  babySafeWithAdaptation: boolean;
  /** Alternative names for matching during import / search. */
  aliases?: string[];
}

function c(
  id: string,
  name: string,
  category: IngredientCategory,
  tags: string[] = [],
  freezerFriendly = false,
  babySafeWithAdaptation = false,
  aliases?: string[],
): CatalogIngredient {
  const item: CatalogIngredient = {
    id,
    name: name.toLowerCase(),
    category,
    tags,
    freezerFriendly,
    babySafeWithAdaptation,
  };
  if (aliases) item.aliases = aliases.map((a) => a.toLowerCase());
  return item;
}

export const MASTER_CATALOG: CatalogIngredient[] = [
  // Proteins
  c('cat-chicken-breast', 'Chicken breast', 'protein', ['quick'], true, true),
  c('cat-chicken-thigh', 'Chicken thigh', 'protein', ['batch-friendly'], true, true),
  c('cat-ground-beef', 'Ground beef', 'protein', ['quick'], true, false),
  c('cat-ground-turkey', 'Ground turkey', 'protein', ['quick'], true, true),
  c('cat-salmon', 'Salmon', 'protein', ['quick'], true, true),
  c('cat-cod', 'Cod', 'protein', ['quick'], true, true),
  c('cat-tuna', 'Tuna (canned)', 'protein', ['quick', 'staple', 'rescue'], false, true),
  c('cat-prawns', 'Prawns', 'protein', ['quick'], true, false),
  c('cat-tofu', 'Tofu', 'protein', ['quick'], false, true),
  c('cat-eggs', 'Eggs', 'protein', ['quick', 'rescue', 'staple'], false, true),
  c('cat-lentils', 'Lentils', 'protein', ['batch-friendly', 'staple'], false, true),
  c('cat-chickpeas', 'Chickpeas', 'protein', ['batch-friendly', 'staple'], false, true),
  c('cat-pork-mince', 'Pork mince', 'protein', ['batch-friendly'], true, false),
  c('cat-sausages', 'Sausages', 'protein', ['quick', 'rescue'], true, false),
  c('cat-fish-fingers', 'Fish fingers', 'protein', ['quick', 'rescue'], true, true),

  // Carbs
  c('cat-pasta', 'Pasta', 'carb', ['quick', 'staple'], false, true),
  c('cat-rice', 'Rice', 'carb', ['staple', 'batch-friendly'], false, true),
  c('cat-bread', 'Bread', 'carb', ['quick', 'staple', 'rescue'], true, true),
  c('cat-wraps', 'Tortillas', 'carb', ['quick'], false, false, [
    'flour tortillas',
    'soft tortillas',
  ]),
  c('cat-potatoes', 'Potatoes', 'carb', ['staple', 'batch-friendly', 'mashable'], false, true),
  c('cat-sweet-potato', 'Sweet potato', 'carb', ['batch-friendly', 'mashable'], false, true),
  c('cat-couscous', 'Couscous', 'carb', ['quick'], false, true),
  c('cat-noodles', 'Noodles', 'carb', ['quick'], false, true, [
    'noodles',
    'egg noodles',
    'chinese noodles',
    'japanese noodles',
    'korean noodles',
    'thai noodles',
    'vietnamese noodles',
    'indian noodles',
    'malaysian noodles',
    'filipino noodles',
    'philippine noodles',
    'indonesian noodles',
    'singaporean noodles',
    'malaysian noodles',
    'filipino noodles',
    'philippine noodles',
    'indonesian noodles',
    'singaporean noodles',
  ]),
  c('cat-oats', 'Oats', 'carb', ['quick', 'staple'], false, true, [
    'oats',
    'rolled oats',
    'quick oats',
    'steel cut oats',
    'old fashioned oats',
    'instant oats',
    'instant rolled oats',
    'instant quick oats',
    'instant steel cut oats',
    'instant old fashioned oats',
  ]),
  c('cat-pitta', 'Pitta bread', 'carb', ['quick'], false, false, ['pita bread', 'pitas']),
  c('cat-gnocchi', 'Gnocchi', 'carb', ['quick'], false, true),
  c('cat-hamburger-buns', 'Hamburger buns', 'carb', ['quick'], false, false, ['burger buns']),
  c('cat-tortellini', 'Tortellini', 'carb', ['quick'], true, true),

  // Vegetables
  c('cat-asparagus', 'Asparagus', 'veg', ['quick'], true, true, [
    'asparagus spears',
    'asparagus spear',
  ]),
  c('cat-beetroot', 'Beetroot', 'veg', ['quick'], true, true, ['beetroots', 'beetroot']),
  c('cat-broccoli', 'Broccoli', 'veg', ['quick', 'mashable'], true, true, [
    'broccoli florets',
    'broccoli floret',
    'broccoli buds',
    'broccoli bud',
    'broccoli stems',
    'broccoli stem',
  ]),
  c('cat-carrots', 'Carrots', 'veg', ['staple', 'mashable'], false, true),
  c('cat-peas', 'Peas', 'veg', ['quick'], true, true, [
    'green peas',
    'yellow peas',
    'red peas',
    'purple peas',
    'green pea',
    'yellow pea',
    'red pea',
    'purple pea',
  ]),
  c('cat-sweetcorn', 'Sweetcorn', 'veg', ['quick'], true, true, [
    'corn',
    'sweetcorn',
    'sweet corn',
  ]),
  c('cat-spinach', 'Spinach', 'veg', ['quick', 'mashable'], true, true, [
    'fresh spinach',
    'spinach leaves',
    'baby spinach',
  ]),
  c('cat-peppers', 'Peppers', 'veg', ['quick'], true, false, [
    'bell peppers',
    'red peppers',
    'green peppers',
    'yellow peppers',
    'orange peppers',
    'purple peppers',
    'jalapeno peppers',
    'bell pepper',
    'red pepper',
    'green pepper',
    'yellow pepper',
    'orange pepper',
    'purple pepper',
    'jalapeno pepper',
  ]),
  c('cat-courgette', 'Courgette', 'veg', ['mashable'], false, true, [
    'zucchini',
    'courgette',
    'zucchini squash',
    'courgette squash',
  ]),
  c('cat-tomatoes', 'Tomatoes', 'veg', ['staple'], false, true, [
    'chopped tomatoes',
    'plum tomatoes',
    'stewed tomatoes',
    'cherry tomatoes',
    'grape tomatoes',
  ]),
  c('cat-green-beans', 'Green beans', 'veg', ['quick'], true, true),
  c('cat-cucumber', 'Cucumber', 'veg', ['quick'], false, false, [
    'cucumbers',
    'cucumber',
    'cucumber slices',
    'cucumber pieces',
  ]),
  c('cat-onion', 'Onion', 'veg', ['staple'], false, false, [
    'onions',
    'onion',
    'onion slices',
    'onion pieces',
  ]),
  c('cat-brussels-sprouts', 'Brussels sprouts', 'veg', ['quick'], true, true, [
    'brussels sprouts',
    'brussels sprout',
    'brussels',
    'brussel',
  ]),
  c('cat-cauliflower', 'Cauliflower', 'veg', ['quick', 'mashable'], true, true, [
    'cauliflower florets',
    'cauliflower floret',
    'cauliflower buds',
    'cauliflower bud',
    'cauliflower stems',
    'cauliflower stem',
  ]),
  c('cat-celery', 'Celery', 'veg', ['quick'], true, true, [
    'celery sticks',
    'celery stick',
    'celery',
    'celery stalks',
    'celery stalk',
  ]),
  c('cat-garlic', 'Garlic', 'veg', ['staple'], false, false, [
    'garlic',
    'garlic cloves',
    'garlic slices',
    'garlic pieces',
  ]),
  c('cat-mushrooms', 'Mushrooms', 'veg', ['quick'], false, false, [
    'white mushrooms',
    'brown mushrooms',
    'portobello mushrooms',
    'button mushrooms',
    'cremini mushrooms',
    'chanterelle mushrooms',
    'porcini mushrooms',
    'oyster mushrooms',
    'shroom',
    'shrooms',
    'mush',
    'mushroom',
  ]),
  c('cat-avocado', 'Avocado', 'veg', ['quick', 'mashable'], false, true),
  c('cat-leek', 'Leek', 'veg', ['quick'], false, true, ['leeks', 'baby leeks']),
  c('cat-cabbage', 'Cabbage', 'veg', ['staple'], false, true, [
    'savoy cabbage',
    'red cabbage',
    'green cabbage',
    'purple cabbage',
  ]),
  c('cat-kale', 'Kale', 'veg', ['quick', 'mashable'], true, true),

  // Fruit
  c('cat-banana', 'Banana', 'fruit', ['quick', 'mashable'], false, true),
  c('cat-apple', 'Apple', 'fruit', ['quick'], false, true),
  c('cat-blueberries', 'Blueberries', 'fruit', ['quick'], true, true),
  c('cat-strawberries', 'Strawberries', 'fruit', ['quick'], true, true),
  c('cat-grapes', 'Grapes', 'fruit', ['quick'], false, false),
  c('cat-orange', 'Orange', 'fruit', ['quick'], false, true, [
    'navel oranges',
    'oranges',
    'clementines',
    'mandarin oranges',
  ]),
  c('cat-raisins', 'Raisins', 'fruit', ['quick', 'staple'], false, false, [
    'golden raisins',
    'sultana raisins',
  ]),

  // Dairy
  c('cat-milk', 'Milk', 'dairy', ['staple'], false, true),
  c('cat-cheese', 'Cheese', 'dairy', ['quick', 'staple', 'rescue'], true, true),
  c('cat-yogurt', 'Yogurt', 'dairy', ['quick'], false, true, ['plain yogurt', 'greek yogurt']),
  c('cat-butter', 'Butter', 'dairy', ['staple'], true, true),
  c('cat-cream-cheese', 'Cream cheese', 'dairy', ['quick'], false, true),

  // Snacks
  c('cat-crackers', 'Crackers', 'snack', ['quick', 'rescue'], false, false),
  c('cat-rice-cakes', 'Rice cakes', 'snack', ['quick', 'rescue'], false, true),
  c('cat-breadsticks', 'Breadsticks', 'snack', ['quick', 'rescue'], false, true),
  c('cat-hummus', 'Hummus', 'snack', ['quick'], false, true),
  c('cat-peanut-butter', 'Peanut butter', 'snack', ['quick', 'staple'], false, false),

  // Freezer
  c('cat-frozen-peas', 'Frozen peas', 'freezer', ['quick', 'rescue'], true, true),
  c('cat-frozen-sweetcorn', 'Frozen sweetcorn', 'freezer', ['quick', 'rescue'], true, true),
  c('cat-frozen-berries', 'Frozen berries', 'freezer', ['quick'], true, true),
  c('cat-frozen-spinach', 'Frozen spinach', 'freezer', ['quick', 'mashable'], true, true),
  c('cat-ice-cream', 'Ice cream', 'freezer', [], true, false),

  // Pantry
  c('cat-tinned-tomatoes', 'Tinned tomatoes', 'pantry', ['staple', 'batch-friendly'], false, true, [
    'canned tomatoes',
    'diced tomatoes',
  ]),
  c('cat-coconut-milk', 'Coconut milk', 'pantry', ['staple'], false, true),
  c('cat-passata', 'Passata', 'pantry', ['staple'], false, true, [
    'tomato puree',
    'strained tomatoes',
    'tomato passata',
  ]),
  c('cat-stock-cubes', 'Stock cubes', 'pantry', ['staple'], false, false),
  c('cat-chicken-stock', 'Chicken stock', 'pantry', ['staple'], false, false, ['chicken broth']),
  c('cat-vegetable-stock', 'Vegetable stock', 'pantry', ['staple'], false, false, [
    'vegetable broth',
  ]),
  c('cat-beef-stock', 'Beef stock', 'pantry', ['staple'], false, false, ['beef broth']),
  c('cat-olive-oil', 'Olive oil', 'pantry', ['staple'], false, true),
  c('cat-soy-sauce', 'Soy sauce', 'pantry', ['staple'], false, false),
  c('cat-flour', 'Flour', 'pantry', ['staple'], false, false),
  c('cat-baked-beans', 'Baked beans', 'pantry', ['quick', 'rescue', 'staple'], false, true),
  c('cat-pesto', 'Pesto', 'pantry', ['quick'], false, false),
  c('cat-garlic-powder', 'Garlic powder', 'pantry', ['staple'], false, false),
  c('cat-onion-powder', 'Onion powder', 'pantry', ['staple'], false, false),
  c('cat-parmesan-cheese', 'Parmesan cheese', 'dairy', ['quick', 'staple'], true, true, [
    'parmesan',
  ]),
  c('cat-monterey-jack-cheese', 'Monterey Jack cheese', 'dairy', ['quick'], true, true, [
    'monterey jack',
  ]),
  c('cat-cheddar-cheese', 'Cheddar cheese', 'dairy', ['quick', 'staple'], true, true, ['cheddar']),
  c('cat-worcestershire-sauce', 'Worcestershire sauce', 'pantry', ['staple'], false, false, [
    'worcestershire',
  ]),
  c('cat-breadcrumbs', 'Breadcrumbs', 'pantry', ['staple'], false, false),
  c('cat-green-onion', 'Green onion', 'veg', ['quick'], false, false, ['spring onion']),
  c('cat-red-onion', 'Red onion', 'veg', ['staple'], false, false),
  c('cat-kosher-salt', 'Kosher salt', 'pantry', ['staple'], false, false),
  c('cat-black-pepper', 'Black pepper', 'pantry', ['staple'], false, false),
  c('cat-french-onion-soup', 'French onion soup', 'pantry', ['staple'], false, true),

  // Taco ingredients
  c('cat-black-beans', 'Black beans', 'protein', ['batch-friendly', 'staple'], false, true, [
    'canned black beans',
  ]),
  c('cat-corn-tortillas', 'Corn tortillas', 'carb', ['quick'], false, false, [
    'taco shells',
    'blue corn tortillas',
  ]),
  c('cat-cilantro', 'Cilantro', 'veg', ['quick'], false, false, [
    'fresh coriander',
    'coriander leaves',
    'cilantro leaves',
  ]),
  c('cat-lime', 'Lime', 'fruit', ['quick'], false, true),
  c('cat-jalapeno', 'Jalapeño', 'veg', ['quick'], false, false, ['jalapeno pepper']),
  c('cat-cumin', 'Cumin', 'pantry', ['staple'], false, false, ['ground cumin']),
  c('cat-chili-powder', 'Chili powder', 'pantry', ['staple'], false, false),
  c('cat-sour-cream', 'Sour cream', 'dairy', ['quick'], false, false),
  c('cat-taco-seasoning', 'Taco seasoning', 'pantry', ['quick', 'staple'], false, false),
  c('cat-lettuce', 'Lettuce', 'veg', ['quick'], false, false, ['iceberg lettuce', 'romaine']),

  // Pizza ingredients
  c('cat-mozzarella', 'Mozzarella', 'dairy', ['quick'], true, true, [
    'mozzarella cheese',
    'fresh mozzarella',
  ]),
  c('cat-yeast', 'Yeast', 'pantry', ['staple'], false, false, [
    'active dry instant yeast',
    'active dry yeast',
    'instant yeast',
  ]),
  c('cat-italian-seasoning', 'Italian seasoning', 'pantry', ['staple'], false, false),
  c('cat-oregano', 'Oregano', 'pantry', ['staple'], false, false, ['dried oregano']),
  c('cat-basil', 'Basil', 'veg', ['quick'], false, false, ['fresh basil']),
  c('cat-tomato-paste', 'Tomato paste', 'pantry', ['staple'], false, true, ['tomato concentrate']),
  c('cat-sugar', 'Sugar', 'pantry', ['staple'], false, false, ['granulated sugar', 'white sugar']),

  // Pasta bake ingredients
  c('cat-ricotta', 'Ricotta', 'dairy', ['quick'], false, true, ['ricotta cheese']),
  c('cat-heavy-cream', 'Heavy cream', 'dairy', [], false, false, [
    'double cream',
    'whipping cream',
  ]),

  // Bowl / rice bowl ingredients
  c('cat-sesame-oil', 'Sesame oil', 'pantry', ['staple'], false, false, ['toasted sesame oil']),
  c('cat-sriracha', 'Sriracha', 'pantry', ['staple'], false, false, ['hot sauce']),
  c('cat-ginger', 'Ginger', 'pantry', ['staple'], false, false, ['fresh ginger', 'ground ginger']),
  c('cat-edamame', 'Edamame', 'protein', ['quick'], true, true, ['frozen edamame']),
  c('cat-sesame-seeds', 'Sesame seeds', 'pantry', ['staple'], false, false),

  // Sauces and pantry basics
  c('cat-honey', 'Honey', 'pantry', ['staple'], false, false),
  c('cat-paprika', 'Paprika', 'pantry', ['staple'], false, false, ['smoked paprika']),
  c('cat-vinegar', 'Vinegar', 'pantry', ['staple'], false, false, [
    'white vinegar',
    'apple cider vinegar',
  ]),
  c('cat-mustard', 'Mustard', 'pantry', ['staple'], false, false, [
    'dijon mustard',
    'yellow mustard',
  ]),
  c('cat-cornstarch', 'Cornstarch', 'pantry', ['staple'], false, false, ['cornflour']),
  c('cat-mayonnaise', 'Mayonnaise', 'pantry', ['staple'], false, false, ['mayo']),
];

export function searchCatalog(query: string): CatalogIngredient[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return MASTER_CATALOG.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      (item.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
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
    shelfLifeHint: '',
    freezerFriendly: catalogItem.freezerFriendly,
    babySafeWithAdaptation: catalogItem.babySafeWithAdaptation,
    catalogId: catalogItem.id,
    source: 'catalog',
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
