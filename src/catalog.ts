/**
 * Master ingredient catalog (`MASTER_CATALOG`): static reference rows for browse/search,
 * import matching (plain-text and Paprika recipes), near-duplicate hints, and creating
 * household ingredients via `catalogIngredientToHousehold`.
 *
 * This is not the same as first-run storage: `seed-data.json` is loaded by `seedIfNeeded()`
 * in `storage.ts` when the app has no households yet, and that snapshot includes each
 * household’s persisted `ingredients` array. The catalog does not automatically populate
 * IndexedDB. To change shipped seed ingredients, edit `fixtures/households/` and run
 * `npm run db:seed`.
 */
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
  /** Optional default thumbnail (static URL); not copied to household rows unless user overrides. */
  imageUrl?: string;
}

/** Unsplash-hosted thumbnails (Unsplash License); display-only catalog defaults. */
const CAT_IMG = {
  chickenBreast:
    'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=128&h=128&fit=crop&q=80',
  chickenThigh:
    'https://images.unsplash.com/photo-1587593818170-4d4fd48427e5?w=128&h=128&fit=crop&q=80',
  groundBeef:
    'https://images.unsplash.com/photo-1603048588665-791ca8d61732?w=128&h=128&fit=crop&q=80',
  salmon: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=128&h=128&fit=crop&q=80',
  tuna: 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=128&h=128&fit=crop&q=80',
  eggs: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=128&h=128&fit=crop&q=80',
  chickpeas:
    'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=128&h=128&fit=crop&q=80',
  pasta: 'https://images.unsplash.com/photo-1551462147-85805da1cdb5?w=128&h=128&fit=crop&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=128&h=128&fit=crop&q=80',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=128&h=128&fit=crop&q=80',
  potatoes:
    'https://images.unsplash.com/photo-1518977822533-641ea4f59c03?w=128&h=128&fit=crop&q=80',
  broccoli:
    'https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=128&h=128&fit=crop&q=80',
  carrots: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=128&h=128&fit=crop&q=80',
  onion: 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=128&h=128&fit=crop&q=80',
  garlic: 'https://images.unsplash.com/photo-1547514701-427821017420?w=128&h=128&fit=crop&q=80',
  tomatoes: 'https://images.unsplash.com/photo-1546470427-e26264939801?w=128&h=128&fit=crop&q=80',
  milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=128&h=128&fit=crop&q=80',
  cheese: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=128&h=128&fit=crop&q=80',
  butter: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=128&h=128&fit=crop&q=80',
  oliveOil:
    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=128&h=128&fit=crop&q=80',
  flour: 'https://images.unsplash.com/photo-1598626430994-067a10d1d7b8?w=128&h=128&fit=crop&q=80',
  banana: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=128&h=128&fit=crop&q=80',
  apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=128&h=128&fit=crop&q=80',
  strawberries:
    'https://images.unsplash.com/photo-1464965911861-ce-a9effa5daa8?w=128&h=128&fit=crop&q=80',
  lettuce: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=128&h=128&fit=crop&q=80',
  mozzarella:
    'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=128&h=128&fit=crop&q=80',
  blackBeans:
    'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=128&h=128&fit=crop&q=80',
  lime: 'https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=128&h=128&fit=crop&q=80',
  yogurt: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=128&h=128&fit=crop&q=80',
} as const;

function c(
  id: string,
  name: string,
  category: IngredientCategory,
  tags: string[] = [],
  freezerFriendly = false,
  babySafeWithAdaptation = false,
  aliases?: string[],
  imageUrl?: string,
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
  if (imageUrl) item.imageUrl = imageUrl;
  return item;
}

export const MASTER_CATALOG: CatalogIngredient[] = [
  // Proteins
  c(
    'cat-chicken-breast',
    'Chicken breast',
    'protein',
    ['quick'],
    true,
    true,
    undefined,
    CAT_IMG.chickenBreast,
  ),
  c(
    'cat-chicken-thigh',
    'Chicken thigh',
    'protein',
    ['batch-friendly'],
    true,
    true,
    undefined,
    CAT_IMG.chickenThigh,
  ),
  c(
    'cat-ground-beef',
    'Ground beef',
    'protein',
    ['quick'],
    true,
    false,
    ['beef mince', 'mince meat', 'mince beef', 'ground meat'],
    CAT_IMG.groundBeef,
  ),
  c('cat-ground-turkey', 'Ground turkey', 'protein', ['quick'], true, true),
  c(
    'cat-salmon',
    'Salmon',
    'protein',
    ['quick'],
    true,
    true,
    [
      'salmon fillets',
      'salmon steaks',
      'salmon chunks',
      'salmon pieces',
      'salmon',
      'salmon fish',
      'salmon seafood',
    ],
    CAT_IMG.salmon,
  ),
  c('cat-cod', 'Cod', 'protein', ['quick'], true, true, [
    'cod fillets',
    'cod steaks',
    'cod chunks',
    'cod pieces',
    'cod',
    'cod fish',
    'cod seafood',
  ]),
  c(
    'cat-tuna',
    'Tuna (canned)',
    'protein',
    ['quick', 'staple', 'rescue'],
    false,
    true,
    undefined,
    CAT_IMG.tuna,
  ),
  c('cat-prawns', 'Prawns', 'protein', ['quick'], true, false, ['shrimp']),
  c('cat-tofu', 'Tofu', 'protein', ['quick'], false, true),
  c(
    'cat-eggs',
    'Eggs',
    'protein',
    ['quick', 'rescue', 'staple'],
    false,
    true,
    undefined,
    CAT_IMG.eggs,
  ),
  c('cat-lentils', 'Lentils', 'protein', ['batch-friendly', 'staple'], false, true),
  c(
    'cat-chickpeas',
    'Chickpeas',
    'protein',
    ['batch-friendly', 'staple'],
    false,
    true,
    undefined,
    CAT_IMG.chickpeas,
  ),
  c('cat-pork-mince', 'Pork mince', 'protein', ['batch-friendly'], true, false),
  c('cat-sausages', 'Sausages', 'protein', ['quick', 'rescue'], true, false),
  c('cat-fish-fingers', 'Fish fingers', 'protein', ['quick', 'rescue'], true, true),

  // Carbs
  c('cat-pasta', 'Pasta', 'carb', ['quick', 'staple'], false, true, undefined, CAT_IMG.pasta),
  c('cat-rice', 'Rice', 'carb', ['staple', 'batch-friendly'], false, true, undefined, CAT_IMG.rice),
  c(
    'cat-bread',
    'Bread',
    'carb',
    ['quick', 'staple', 'rescue'],
    true,
    true,
    undefined,
    CAT_IMG.bread,
  ),
  c('cat-wraps', 'Tortillas', 'carb', ['quick'], false, false, [
    'flour tortillas',
    'soft tortillas',
  ]),
  c(
    'cat-potatoes',
    'Potatoes',
    'carb',
    ['staple', 'batch-friendly', 'mashable'],
    false,
    true,
    undefined,
    CAT_IMG.potatoes,
  ),
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
  c(
    'cat-broccoli',
    'Broccoli',
    'veg',
    ['quick', 'mashable'],
    true,
    true,
    [
      'broccoli florets',
      'broccoli floret',
      'broccoli buds',
      'broccoli bud',
      'broccoli stems',
      'broccoli stem',
      'broccolini',
    ],
    CAT_IMG.broccoli,
  ),
  c(
    'cat-carrots',
    'Carrots',
    'veg',
    ['staple', 'mashable'],
    false,
    true,
    undefined,
    CAT_IMG.carrots,
  ),
  c('cat-peas', 'Peas', 'veg', ['quick'], true, true, ['green peas']),
  c('cat-sweetcorn', 'Sweetcorn', 'veg', ['quick'], true, true, ['sweetcorn', 'sweet corn']),
  c('cat-spinach', 'Spinach', 'veg', ['quick', 'mashable'], true, true, [
    'fresh spinach',
    'spinach leaves',
    'baby spinach',
  ]),
  c('cat-peppers', 'Peppers', 'veg', ['quick'], true, false, ['bell peppers', 'capsicum']),
  c('cat-aubergine', 'Aubergine', 'veg', ['mashable'], false, true, ['eggplant']),
  c('cat-courgette', 'Courgette', 'veg', ['mashable'], false, true, [
    'zucchini',
    'courgette',
    'zucchini squash',
    'courgette squash',
  ]),
  c(
    'cat-tomatoes',
    'Tomatoes',
    'veg',
    ['staple'],
    false,
    true,
    [
      'chopped tomatoes',
      'plum tomatoes',
      'stewed tomatoes',
      'cherry tomatoes',
      'grape tomatoes',
      'tomatoes on the vine',
      'vine-ripened tomatoes',
    ],
    CAT_IMG.tomatoes,
  ),
  c('cat-green-beans', 'Green beans', 'veg', ['quick'], true, true),
  c('cat-cucumber', 'Cucumber', 'veg', ['quick'], false, false, [
    'cucumbers',
    'cucumber',
    'cucumber slices',
  ]),
  c(
    'cat-onion',
    'Onion',
    'veg',
    ['staple'],
    false,
    false,
    ['onions', 'onion', 'onion slices', 'onion pieces'],
    CAT_IMG.onion,
  ),
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
  c(
    'cat-garlic',
    'Garlic',
    'veg',
    ['staple'],
    false,
    false,
    ['garlic', 'garlic cloves'],
    CAT_IMG.garlic,
  ),
  c('cat-mushrooms', 'Mushrooms', 'veg', ['quick'], false, false),
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
  c('cat-banana', 'Banana', 'fruit', ['quick', 'mashable'], false, true, undefined, CAT_IMG.banana),
  c('cat-apple', 'Apple', 'fruit', ['quick'], false, true, undefined, CAT_IMG.apple),
  c('cat-blueberries', 'Blueberries', 'fruit', ['quick'], true, true),
  c(
    'cat-strawberries',
    'Strawberries',
    'fruit',
    ['quick'],
    true,
    true,
    undefined,
    CAT_IMG.strawberries,
  ),
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
  c('cat-milk', 'Milk', 'dairy', ['staple'], false, true, undefined, CAT_IMG.milk),
  c(
    'cat-cheese',
    'Cheese',
    'dairy',
    ['quick', 'staple', 'rescue'],
    true,
    true,
    undefined,
    CAT_IMG.cheese,
  ),
  c(
    'cat-yogurt',
    'Yogurt',
    'dairy',
    ['quick'],
    false,
    true,
    ['plain yogurt', 'greek yogurt', 'yoghurt'],
    CAT_IMG.yogurt,
  ),
  c('cat-butter', 'Butter', 'dairy', ['staple'], true, true, undefined, CAT_IMG.butter),
  c('cat-cream-cheese', 'Cream cheese', 'dairy', ['quick'], false, true),

  // Snacks
  c('cat-crackers', 'Crackers', 'snack', ['quick', 'rescue'], false, false),
  c('cat-rice-cakes', 'Rice cakes', 'snack', ['quick', 'rescue'], false, true),
  c('cat-breadsticks', 'Breadsticks', 'snack', ['quick', 'rescue'], false, true),
  c('cat-hummus', 'Hummus', 'snack', ['quick'], false, true),
  c('cat-peanut-butter', 'Peanut butter', 'snack', ['quick', 'staple'], false, false),
  c('cat-almond-butter', 'Almond butter', 'snack', ['quick', 'staple'], false, false, ['nut butter']),

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
  c('cat-passata', 'Passata', 'pantry', ['staple'], false, true, ['tomato passata']),
  c('cat-stock-cubes', 'Stock cubes', 'pantry', ['staple'], false, false),
  c('cat-chicken-stock', 'Chicken stock', 'pantry', ['staple'], false, false, ['chicken broth']),
  c('cat-vegetable-stock', 'Vegetable stock', 'pantry', ['staple'], false, false, [
    'vegetable broth',
  ]),
  c('cat-beef-stock', 'Beef stock', 'pantry', ['staple'], false, false, ['beef broth']),
  c('cat-olive-oil', 'Olive oil', 'pantry', ['staple'], false, true, undefined, CAT_IMG.oliveOil),
  c('cat-soy-sauce', 'Soy sauce', 'pantry', ['staple'], false, false),
  c(
    'cat-flour',
    'Flour',
    'pantry',
    ['staple'],
    false,
    false,
    [
      'all purpose flour',
      'all-purpose flour',
      'whole wheat flour',
      'whole wheat pastry flour',
      'plain flour',
      'bread flour',
    ],
    CAT_IMG.flour,
  ),
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
  c(
    'cat-black-beans',
    'Black beans',
    'protein',
    ['batch-friendly', 'staple'],
    false,
    true,
    ['canned black beans'],
    CAT_IMG.blackBeans,
  ),
  c('cat-corn-tortillas', 'Corn tortillas', 'carb', ['quick'], false, false, ['taco shells']),
  c('cat-cilantro', 'Cilantro', 'veg', ['quick'], false, false, [
    'coriander',
    'fresh coriander',
    'coriander leaves',
    'cilantro leaves',
  ]),
  c('cat-lime', 'Lime', 'fruit', ['quick'], false, true, undefined, CAT_IMG.lime),
  c('cat-jalapeno', 'Jalapeño', 'veg', ['quick'], false, false, ['jalapeno pepper']),
  c('cat-cumin', 'Cumin', 'pantry', ['staple'], false, false, ['ground cumin']),
  c('cat-chili-powder', 'Chili powder', 'pantry', ['staple'], false, false),
  c('cat-sour-cream', 'Sour cream', 'dairy', ['quick'], false, false),
  c('cat-taco-seasoning', 'Taco seasoning', 'pantry', ['quick', 'staple'], false, false),
  c(
    'cat-lettuce',
    'Lettuce',
    'veg',
    ['quick'],
    false,
    false,
    ['iceberg lettuce', 'romaine'],
    CAT_IMG.lettuce,
  ),

  // Pizza ingredients
  c(
    'cat-mozzarella',
    'Mozzarella',
    'dairy',
    ['quick'],
    true,
    true,
    ['mozzarella cheese', 'fresh mozzarella'],
    CAT_IMG.mozzarella,
  ),
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

  // ── Common staples (F076 expansion) ──

  // Salt & water
  c('cat-salt', 'Salt', 'pantry', ['staple'], false, false, [
    'table salt',
    'fine salt',
    'sea salt',
    'coarse salt',
    'flaky salt',
  ]),
  c('cat-water', 'Water', 'pantry', ['staple'], false, true),

  // Oils & fats
  c('cat-vegetable-oil', 'Vegetable oil', 'pantry', ['staple'], false, false, [
    'canola oil',
    'rapeseed oil',
    'cooking oil',
    'neutral oil',
  ]),
  c('cat-coconut-oil', 'Coconut oil', 'pantry', ['staple'], false, false),
  c('cat-cooking-spray', 'Cooking spray', 'pantry', ['staple'], false, false, [
    'nonstick spray',
    'non-stick cooking spray',
    'nonstick cooking spray',
  ]),

  // Baking basics
  c('cat-baking-soda', 'Baking soda', 'pantry', ['staple'], false, false, [
    'bicarbonate of soda',
    'bicarb',
  ]),
  c('cat-baking-powder', 'Baking powder', 'pantry', ['staple'], false, false),
  c('cat-brown-sugar', 'Brown sugar', 'pantry', ['staple'], false, false, [
    'light brown sugar',
    'dark brown sugar',
    'demerara sugar',
    'muscovado sugar',
  ]),
  c('cat-powdered-sugar', 'Powdered sugar', 'pantry', ['staple'], false, false, [
    'confectioners sugar',
    'icing sugar',
  ]),
  c('cat-vanilla-extract', 'Vanilla extract', 'pantry', ['staple'], false, false, [
    'vanilla',
    'pure vanilla extract',
    'vanilla essence',
  ]),

  // Herbs & spices
  c('cat-cinnamon', 'Cinnamon', 'pantry', ['staple'], false, false, ['ground cinnamon']),
  c('cat-nutmeg', 'Nutmeg', 'pantry', ['staple'], false, false, ['ground nutmeg']),
  c('cat-thyme', 'Thyme', 'pantry', ['staple'], false, false, ['dried thyme', 'fresh thyme']),
  c('cat-rosemary', 'Rosemary', 'pantry', ['staple'], false, false, [
    'dried rosemary',
    'fresh rosemary',
  ]),
  c('cat-bay-leaves', 'Bay leaves', 'pantry', ['staple'], false, false, ['bay leaf']),
  c('cat-cayenne-pepper', 'Cayenne pepper', 'pantry', ['staple'], false, false, ['cayenne']),
  c('cat-red-pepper-flakes', 'Red pepper flakes', 'pantry', ['staple'], false, false, [
    'crushed red pepper',
    'crushed red pepper flakes',
    'chilli flakes',
    'chili flakes',
  ]),
  c('cat-turmeric', 'Turmeric', 'pantry', ['staple'], false, false, ['ground turmeric']),
  c('cat-curry-powder', 'Curry powder', 'pantry', ['staple'], false, false),
  c('cat-dried-parsley', 'Parsley', 'pantry', ['staple'], false, false, [
    'dried parsley',
    'fresh parsley',
    'flat leaf parsley',
    'italian parsley',
    'curly parsley',
  ]),
  c('cat-dried-dill', 'Dill', 'pantry', ['staple'], false, false, [
    'dried dill',
    'fresh dill',
    'dill weed',
  ]),
  c('cat-coriander-ground', 'Ground coriander', 'pantry', ['staple'], false, false, [
    'coriander powder',
  ]),
  c('cat-allspice', 'Allspice', 'pantry', ['staple'], false, false, ['ground allspice']),
  c('cat-cloves', 'Cloves', 'pantry', ['staple'], false, false, ['ground cloves', 'whole cloves']),

  // Condiments & sauces
  c('cat-ketchup', 'Ketchup', 'pantry', ['staple'], false, false, ['tomato ketchup', 'catsup']),
  c('cat-bbq-sauce', 'BBQ sauce', 'pantry', ['staple'], false, false, ['barbecue sauce']),
  c('cat-tomato-sauce', 'Tomato sauce', 'pantry', ['staple'], false, true, [
    'marinara sauce',
    'pizza sauce',
  ]),
  c('cat-rice-vinegar', 'Rice vinegar', 'pantry', ['staple'], false, false, [
    'rice wine vinegar',
    'seasoned rice vinegar',
  ]),
  c('cat-balsamic-vinegar', 'Balsamic vinegar', 'pantry', ['staple'], false, false, [
    'balsamic glaze',
  ]),
  c('cat-maple-syrup', 'Maple syrup', 'pantry', ['staple'], false, false, ['pure maple syrup']),
  c('cat-lemon-juice', 'Lemon juice', 'pantry', ['staple'], false, true, [
    'fresh lemon juice',
    'bottled lemon juice',
  ]),
  c('cat-lime-juice', 'Lime juice', 'pantry', ['staple'], false, true, [
    'fresh lime juice',
    'bottled lime juice',
  ]),
  c('cat-fish-sauce', 'Fish sauce', 'pantry', ['staple'], false, false),
  c('cat-hoisin-sauce', 'Hoisin sauce', 'pantry', ['staple'], false, false),

  // Proteins
  c('cat-bacon', 'Bacon', 'protein', ['quick'], true, false, [
    'streaky bacon',
    'back bacon',
    'bacon rashers',
    'turkey bacon',
  ]),
  c('cat-italian-sausage', 'Italian sausage', 'protein', ['batch-friendly'], true, false, [
    'mild italian sausage',
    'hot italian sausage',
    'sweet italian sausage',
  ]),
  c('cat-ground-pork', 'Ground pork', 'protein', ['batch-friendly'], true, false, ['pork mince']),
  c('cat-kidney-beans', 'Kidney beans', 'protein', ['batch-friendly', 'staple'], false, true, [
    'red kidney beans',
    'canned kidney beans',
  ]),
  c('cat-cannellini-beans', 'Cannellini beans', 'protein', ['batch-friendly', 'staple'], false, true, [
    'white beans',
    'great northern beans',
    'navy beans',
  ]),
  c('cat-pinto-beans', 'Pinto beans', 'protein', ['batch-friendly', 'staple'], false, true, [
    'canned pinto beans',
    'refried beans',
  ]),

  // Dairy
  c('cat-cream', 'Cream', 'dairy', ['staple'], false, false, [
    'single cream',
    'light cream',
    'half and half',
    'half & half',
    'pouring cream',
  ]),
  c('cat-buttermilk', 'Buttermilk', 'dairy', [], false, false),
  c('cat-feta-cheese', 'Feta cheese', 'dairy', ['quick'], false, false, [
    'feta',
    'crumbled feta',
  ]),
  c('cat-swiss-cheese', 'Swiss cheese', 'dairy', ['quick'], true, false, ['gruyere', 'gruyère']),

  // Vegetables
  c('cat-shallot', 'Shallot', 'veg', ['staple'], false, false, ['shallots']),
  c('cat-chives', 'Chives', 'veg', ['quick'], false, false, ['fresh chives']),
  c('cat-butternut-squash', 'Butternut squash', 'veg', ['batch-friendly', 'mashable'], true, true),
  c('cat-corn', 'Corn', 'veg', ['quick'], true, true, [
    'corn on the cob',
    'corn kernels',
    'fresh corn',
    'canned corn',
    'whole kernel corn',
  ]),

  // Fruits
  c('cat-lemon', 'Lemon', 'fruit', ['quick', 'staple'], false, true, ['lemons']),
  c('cat-pineapple', 'Pineapple', 'fruit', ['quick'], true, true, [
    'canned pineapple',
    'pineapple chunks',
    'crushed pineapple',
  ]),
  c('cat-cranberries', 'Cranberries', 'fruit', ['quick'], true, false, [
    'dried cranberries',
    'fresh cranberries',
  ]),

  // Carbs
  c('cat-quinoa', 'Quinoa', 'carb', ['batch-friendly'], false, true, [
    'white quinoa',
    'red quinoa',
    'tricolor quinoa',
  ]),
  c('cat-panko', 'Panko breadcrumbs', 'pantry', ['staple'], false, false, ['panko']),

  // Nuts & seeds
  c('cat-almonds', 'Almonds', 'pantry', ['staple'], false, false, [
    'sliced almonds',
    'slivered almonds',
    'whole almonds',
    'almond',
  ]),
  c('cat-walnuts', 'Walnuts', 'pantry', ['staple'], false, false, [
    'walnut pieces',
    'walnut halves',
  ]),
  c('cat-pecans', 'Pecans', 'pantry', ['staple'], false, false, [
    'pecan halves',
    'pecan pieces',
  ]),
  c('cat-pine-nuts', 'Pine nuts', 'pantry', ['staple'], false, false, ['pignoli']),
  c('cat-peanuts', 'Peanuts', 'pantry', ['staple'], false, false, ['roasted peanuts']),
  c('cat-cashews', 'Cashews', 'pantry', ['staple'], false, false, ['cashew nuts', 'raw cashews']),
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
  // Do not copy catalogItem.imageUrl: household imageUrl is only for explicit user overrides;
  // display uses resolveIngredientImageUrl() for catalog fallback.
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
