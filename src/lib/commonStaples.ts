/**
 * Common kitchen staples that should auto-resolve during Paprika import
 * even when the household ingredient list is empty and catalog scoring
 * falls below threshold. Bypasses fuzzy matching entirely.
 *
 * Keep this list small (~50 items) and restricted to universally
 * recognizable pantry/dairy/produce basics.
 */
import type { IngredientCategory } from '../types';

export interface CommonStaple {
  name: string;
  aliases: string[];
  category: IngredientCategory;
}

export const COMMON_STAPLES: CommonStaple[] = [
  // Pantry essentials
  {
    name: 'salt',
    aliases: ['sea salt', 'table salt', 'fine salt', 'coarse salt', 'flaky salt', 'iodized salt'],
    category: 'pantry',
  },
  {
    name: 'black pepper',
    aliases: [
      'pepper',
      'ground pepper',
      'ground black pepper',
      'freshly ground pepper',
      'cracked pepper',
      'freshly ground black pepper',
      'cracked black pepper',
      'white pepper',
    ],
    category: 'pantry',
  },
  {
    name: 'water',
    aliases: [
      'cold water',
      'warm water',
      'hot water',
      'lukewarm water',
      'boiling water',
      'ice water',
      'room temperature water',
    ],
    category: 'pantry',
  },
  {
    name: 'cooking oil',
    aliases: [
      'vegetable oil',
      'canola oil',
      'neutral oil',
      'cooking spray',
      'nonstick spray',
      'nonstick cooking spray',
    ],
    category: 'pantry',
  },
  {
    name: 'brown sugar',
    aliases: ['light brown sugar', 'dark brown sugar', 'packed brown sugar', 'demerara sugar'],
    category: 'pantry',
  },
  {
    name: 'powdered sugar',
    aliases: ['confectioners sugar', 'icing sugar', "confectioners' sugar"],
    category: 'pantry',
  },
  { name: 'baking powder', aliases: [], category: 'pantry' },
  {
    name: 'baking soda',
    aliases: ['bicarbonate of soda', 'bicarb', 'sodium bicarbonate'],
    category: 'pantry',
  },
  {
    name: 'vanilla extract',
    aliases: ['vanilla', 'pure vanilla extract', 'vanilla essence'],
    category: 'pantry',
  },
  {
    name: 'lemon juice',
    aliases: ['fresh lemon juice', 'juice of lemon', 'juice of a lemon'],
    category: 'pantry',
  },
  {
    name: 'lime juice',
    aliases: ['fresh lime juice', 'juice of lime', 'juice of a lime'],
    category: 'pantry',
  },
  {
    name: 'rice vinegar',
    aliases: ['rice wine vinegar', 'seasoned rice vinegar'],
    category: 'pantry',
  },
  { name: 'balsamic vinegar', aliases: ['balsamic', 'aged balsamic'], category: 'pantry' },
  { name: 'fish sauce', aliases: ['nam pla'], category: 'pantry' },
  { name: 'maple syrup', aliases: ['pure maple syrup'], category: 'pantry' },
  { name: 'ketchup', aliases: ['catsup', 'tomato ketchup'], category: 'pantry' },
  { name: 'hot sauce', aliases: ['tabasco', "frank's red hot"], category: 'pantry' },

  // Herbs & spices not reliably in catalog
  { name: 'cinnamon', aliases: ['ground cinnamon', 'cinnamon powder'], category: 'pantry' },
  { name: 'nutmeg', aliases: ['ground nutmeg'], category: 'pantry' },
  {
    name: 'cayenne pepper',
    aliases: ['cayenne', 'ground cayenne', 'cayenne powder'],
    category: 'pantry',
  },
  {
    name: 'red pepper flakes',
    aliases: ['crushed red pepper', 'red chili flakes', 'chilli flakes', 'pepper flakes'],
    category: 'pantry',
  },
  { name: 'turmeric', aliases: ['ground turmeric', 'turmeric powder'], category: 'pantry' },
  { name: 'thyme', aliases: ['dried thyme', 'fresh thyme', 'thyme leaves'], category: 'pantry' },
  {
    name: 'rosemary',
    aliases: ['dried rosemary', 'fresh rosemary', 'rosemary leaves'],
    category: 'pantry',
  },
  { name: 'bay leaves', aliases: ['bay leaf', 'dried bay leaves'], category: 'pantry' },
  {
    name: 'sage',
    aliases: ['dried sage', 'fresh sage', 'ground sage', 'sage leaves'],
    category: 'pantry',
  },
  { name: 'dill', aliases: ['fresh dill', 'dried dill', 'dill weed'], category: 'pantry' },
  { name: 'allspice', aliases: ['ground allspice'], category: 'pantry' },
  { name: 'cloves', aliases: ['ground cloves', 'whole cloves'], category: 'pantry' },
  { name: 'cardamom', aliases: ['ground cardamom', 'cardamom pods'], category: 'pantry' },
  {
    name: 'coriander',
    aliases: ['ground coriander', 'coriander seeds', 'coriander powder'],
    category: 'pantry',
  },

  // Produce basics
  { name: 'lemon', aliases: ['lemons', 'fresh lemon'], category: 'fruit' },
  {
    name: 'parsley',
    aliases: [
      'fresh parsley',
      'dried parsley',
      'flat-leaf parsley',
      'italian parsley',
      'curly parsley',
    ],
    category: 'veg',
  },
  {
    name: 'green onion',
    aliases: ['green onions', 'scallion', 'scallions', 'spring onion', 'spring onions'],
    category: 'veg',
  },
  { name: 'shallot', aliases: ['shallots'], category: 'veg' },
  { name: 'celery', aliases: ['celery stalks', 'celery stalk', 'celery ribs'], category: 'veg' },

  // Dairy/protein basics
  {
    name: 'cream cheese',
    aliases: ['softened cream cheese', 'whipped cream cheese'],
    category: 'dairy',
  },
  { name: 'sour cream', aliases: [], category: 'dairy' },
  {
    name: 'heavy cream',
    aliases: ['double cream', 'whipping cream', 'heavy whipping cream', 'single cream'],
    category: 'dairy',
  },
  {
    name: 'parmesan',
    aliases: ['parmesan cheese', 'parmigiano-reggiano', 'parmigiano reggiano', 'grated parmesan'],
    category: 'dairy',
  },
  {
    name: 'cheddar cheese',
    aliases: ['cheddar', 'sharp cheddar', 'mild cheddar', 'shredded cheddar'],
    category: 'dairy',
  },
  {
    name: 'mozzarella',
    aliases: ['mozzarella cheese', 'fresh mozzarella', 'shredded mozzarella'],
    category: 'dairy',
  },

  // Cooking fats/oils
  {
    name: 'coconut oil',
    aliases: ['virgin coconut oil', 'refined coconut oil'],
    category: 'pantry',
  },

  // Misc staples
  {
    name: 'chicken broth',
    aliases: ['chicken stock', 'low sodium chicken broth', 'low-sodium chicken broth'],
    category: 'pantry',
  },
  {
    name: 'vegetable broth',
    aliases: ['vegetable stock', 'veggie broth', 'veggie stock'],
    category: 'pantry',
  },
  { name: 'beef broth', aliases: ['beef stock', 'low sodium beef broth'], category: 'pantry' },
  {
    name: 'breadcrumbs',
    aliases: [
      'bread crumbs',
      'panko breadcrumbs',
      'panko bread crumbs',
      'panko',
      'italian breadcrumbs',
    ],
    category: 'pantry',
  },
  {
    name: 'tortilla',
    aliases: ['tortillas', 'flour tortilla', 'flour tortillas'],
    category: 'carb',
  },
];

const stapleIndex = new Map<string, CommonStaple>();

function normalizeForStapleMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildIndex() {
  if (stapleIndex.size > 0) return;
  for (const staple of COMMON_STAPLES) {
    stapleIndex.set(normalizeForStapleMatch(staple.name), staple);
    for (const alias of staple.aliases) {
      stapleIndex.set(normalizeForStapleMatch(alias), staple);
    }
  }
}

/**
 * Check if a parsed ingredient name matches a common staple (exact after normalization).
 * Returns the staple entry or undefined.
 */
export function matchCommonStaple(parsedName: string): CommonStaple | undefined {
  buildIndex();
  const norm = normalizeForStapleMatch(parsedName);
  if (!norm) return undefined;
  return stapleIndex.get(norm);
}
