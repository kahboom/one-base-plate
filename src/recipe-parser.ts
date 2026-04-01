import type { Ingredient, IngredientCategory, MealComponent } from './types';
import type { CatalogIngredient } from './catalog';
import { MASTER_CATALOG } from './catalog';

export interface ParsedIngredientLine {
  raw: string;
  quantity: string;
  unit: string;
  quantityValue?: number;
  name: string;
  prepNotes?: string[];
  matchedIngredient: Ingredient | null;
  matchedCatalog: CatalogIngredient | null;
  status: 'matched' | 'catalog' | 'unmatched';
}

export interface RecipeImportResult {
  lines: ParsedIngredientLine[];
  sourceUrl: string;
  sourceText: string;
}

// Imperative verbs that suggest an instruction line, not an ingredient
const IMPERATIVE_VERBS =
  /^(preheat|heat|cook|bake|roast|saut[eé]|boil|simmer|blend|mix|stir|whisk|fold|drain|rinse|combine|serve|garnish|let|place|remove|set|pour|add|season|toss|arrange|slice|dice|chop|mince|grill|fry|broil|marinate|reduce|reserve|note|optional|tip|see)\b/i;
const PREP_DESCRIPTORS = new Set([
  'grated',
  'shredded',
  'chopped',
  'diced',
  'minced',
  'sliced',
  'crushed',
  'zested',
  'peeled',
  'rinsed',
  'drained',
  'julienned',
  'trimmed',
  'cubed',
  'halved',
  'quartered',
  'torn',
  'packed',
  'sifted',
  'freshly',
  'finely',
  'roughly',
  'thinly',
  'thickly',
  'softened',
  'melted',
  'toasted',
  'thawed',
  'frozen',
  'skinless',
  'boneless',
  'bone-in',
  'skin-on',
  'stewed',
  'cooked',
  'roasted',
  'smoked',
  'dried',
  'fresh',
  'lightly',
  'loosely',
]);

const SIZE_DESCRIPTORS = new Set([
  'large',
  'small',
  'medium',
  'big',
  'jumbo',
  'extra-large',
  'thin',
  'thick',
]);

const PACKAGING_WORDS = new Set([
  'can',
  'cans',
  'jar',
  'jars',
  'pack',
  'packs',
  'package',
  'packages',
  'bag',
  'bags',
  'bottle',
  'bottles',
  'box',
  'boxes',
  'tin',
  'tins',
  'carton',
  'cartons',
  'container',
  'containers',
  'packet',
  'packets',
]);

const QUALIFIER_PREFIXES = [
  'low-sodium',
  'reduced-sodium',
  'no-salt-added',
  'unsalted',
  'salted',
  'extra-virgin',
  'light',
];

const LEADING_MARKER_RE = /^[-+•*–—]/;

/** Units / measures — longest match wins (includes packaging used as measure). */
const UNIT_PHRASES_ORDERED: string[] = [
  'fluid ounces',
  'fluid ounce',
  'fl. oz.',
  'fl oz',
  'tablespoons',
  'tablespoon',
  'teaspoons',
  'teaspoon',
  'pounds',
  'pound',
  'ounces',
  'ounce',
  'packages',
  'package',
  'containers',
  'container',
  'bottles',
  'bottle',
  'jars',
  'jar',
  'boxes',
  'box',
  'bags',
  'bag',
  'loaves',
  'loaf',
  'fillets',
  'fillet',
  'handfuls',
  'handful',
  'packets',
  'packet',
  'cans',
  'can',
  'tins',
  'tin',
  'cups',
  'cup',
  'tbsp',
  'tsp',
  'pinches',
  'pinch',
  'bunches',
  'bunch',
  'cloves',
  'clove',
  'slices',
  'slice',
  'pieces',
  'piece',
  'sticks',
  'stick',
  'heads',
  'head',
  'stalks',
  'stalk',
  'sprigs',
  'sprig',
  'dashes',
  'dash',
  'drops',
  'drop',
  'litres',
  'liters',
  'litre',
  'liter',
  'quarts',
  'quart',
  'pints',
  'pint',
  'ml',
  'kg',
  'lbs',
  'lb',
  'oz',
  'g',
];

/** When used as unit but no ingredient name follows, the measure word is the ingredient (e.g. "5 cloves"). */
const MEASURE_WORD_AS_INGREDIENT = new Set([
  'clove',
  'cloves',
  'pinch',
  'pinches',
  'dash',
  'dashes',
  'drop',
  'drops',
  'bunch',
  'bunches',
  'head',
  'heads',
  'stalk',
  'stalks',
  'sprig',
  'sprigs',
  'slice',
  'slices',
  'piece',
  'pieces',
  'stick',
  'sticks',
  'fillet',
  'fillets',
]);

/** Section / subrecipe labels — not ingredients. */
const SECTION_HEADING_ONE_WORD = new RegExp(
  '^(?:marinade|salsa|sauce|salad|dressing|vegetables|veggies|dip|spread|topping|toppings|garnish|garnishes|filling|frosting|gravy|glaze|stock|broth|relish|vinaigrette|pesto|chutney|puree|medley|mix|blend|crust|dough|batter|layers|equipment|notes|instructions|method|directions|soup|salads|vegetable|veggie)\\s*:?\\s*$',
  'i',
);

const PACKAGING_LEAD_STRIP = new RegExp(
  '^(?:packages?|containers?|jars?|bottles?|boxes?|bags?|cans?|tins?|packs?|packets?|cartons?)\\s+',
  'i',
);

/** After ". N ", first token starts a measure → list marker / whole number, not "0.N". */
const MEASURE_HEAD_AFTER_DOT_SPACE = new RegExp(
  '^(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|oz\\.?|ounces?|lbs?\\.?|pounds?|ml|kg|pinch(?:es)?|fluid|fl\\.?|packages?|containers?|jars?|bottles?|boxes?|bags?|cans?|tins?|loaves?|loaf|fillets?|fillet|handfuls?|packets?|sticks?|cloves?|slices?|pieces?|bunches?|dashes?|drops?|liters?|litres?|quarts?|pints?|grams?|mg)\\b',
  'i',
);

/** Paprika / HTML list noise: bullets, + additions, metric conversion in brackets, label prefixes. */
export function stripLeadingIngredientNoise(line: string): string {
  let s = line.trim();
  let progress = true;
  while (progress) {
    progress = false;
    s = s.trim();
    while (LEADING_MARKER_RE.test(s)) {
      s = s.slice(1);
      if (!/^[\d¼½¾⅓⅔⅛⅜⅝⅞.]/.test(s)) {
        s = s.replace(/^\s+/, '');
      }
      progress = true;
    }
    const bracket = s.match(/^(?:\[|［)\s*[\d.,]+\s*(?:kg|g|oz|lbs?|ml)\s*(?:\]|］)\s*/i);
    if (bracket) {
      s = s.slice(bracket[0]!.length).trim();
      progress = true;
      continue;
    }
    const label = s.match(/^(?:accompaniment|garnish|optional|notes?):\s*/i);
    if (label) {
      s = s.slice(label[0]!.length).trim();
      progress = true;
    }
  }
  /** "Or 3 sprigs …" / "and/or 2 cups …" — list alternatives before a quantity, not "or oregano". */
  while (true) {
    const orAlt = s.match(/^(?:or|and\/or)\b\s+/i);
    if (!orAlt) break;
    const rest = s.slice(orAlt[0]!.length).trimStart();
    const quantityLed =
      /^[\d¼½¾⅓⅔⅛⅜⅝⅞.]/.test(rest) ||
      /^(a\s+few|a\s+couple(?:\s+of)?|several|some|few)\b/i.test(rest) ||
      /^an?\b\s+/i.test(rest);
    if (!quantityLed) break;
    s = s.slice(orAlt[0]!.length).trim();
  }
  if (/^lbs?\s+of\s+/i.test(s)) {
    s = `1 ${s}`;
  }
  return s.trim();
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

/** Parse a single numeric value (no ranges). */
function parseSingleNumericValue(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  if (UNICODE_FRACTIONS[t] !== undefined) return UNICODE_FRACTIONS[t];

  const unicodeMixed = t.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (unicodeMixed) {
    const whole = parseInt(unicodeMixed[1]!, 10);
    const frac = UNICODE_FRACTIONS[unicodeMixed[2]!];
    if (frac !== undefined) return whole + frac;
  }

  const mixedMatch = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]!, 10);
    const num = parseInt(mixedMatch[2]!, 10);
    const den = parseInt(mixedMatch[3]!, 10);
    if (den !== 0) return whole + num / den;
  }

  const fracMatch = t.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]!, 10);
    const den = parseInt(fracMatch[2]!, 10);
    if (den !== 0) return num / den;
  }

  const normalized = t.replace(',', '.');
  if (/^\d*\.?\d+$/.test(normalized)) {
    return parseFloat(normalized);
  }
  return undefined;
}

function parseQuantityValue(rawQuantity: string): number | undefined {
  const trimmed = rawQuantity.trim();
  if (!trimmed) return undefined;

  const single = parseSingleNumericValue(trimmed);
  if (single !== undefined) return single;

  const rangeMatch = trimmed.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (rangeMatch) {
    const left = parseSingleNumericValue(rangeMatch[1]!.trim());
    const right = parseSingleNumericValue(rangeMatch[2]!.trim());
    if (left !== undefined && right !== undefined) return left;
  }

  return undefined;
}

const RANGE_SEP = '\\s*[-–—]\\s*';

/** Any single numeric token: decimal, fraction, integer, or unicode fraction. */
const NUM_ATOM = `(?:\\d+\\.\\d+|\\.\\d+|\\d+\\/\\d+|\\d+|[¼½¾⅓⅔⅛⅜⅝⅞])`;

/** Leading quantity cluster: ranges first, then 1 3/4, 1/2, 1.5, etc. — order matters. */
function parseLeadingNumberCluster(s: string): { raw: string; end: number } | null {
  const rangeFirst = s.match(new RegExp(`^(${NUM_ATOM}${RANGE_SEP}${NUM_ATOM})(?=\\s|$)`));
  if (rangeFirst) {
    let raw = rangeFirst[1]!;
    let end = rangeFirst[0]!.length;
    const mixedTail = s.slice(end).match(/^\s+(\d+\/\d+)(?=\s|$)/);
    if (mixedTail) {
      raw += mixedTail[0]!;
      end += mixedTail[0]!.length;
    }
    return { raw, end };
  }

  const re =
    /^(\d+\.\d+|\d+\s+\d+\/\d+|\d+\/\d+|\d+[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\s+\d+\/\d+)?|\.\d+|\d+|¼|½|¾|⅓|⅔|⅛|⅜|⅝|⅞)/;
  const m = s.match(re);
  if (!m) return null;
  let raw = m[1]!;
  let end = m[0]!.length;
  const tail = s.slice(end).match(/^\s+(\d+\/\d+)/);
  if (tail && /^\d+$/.test(raw.trim()) && !raw.includes('/')) {
    raw += tail[0]!;
    end += tail[0]!.length;
  }
  return { raw, end };
}

function consumeOptionalParentheticals(s: string, start: number, prepNotes: string[]): number {
  let i = start;
  while (true) {
    const sub = s.slice(i);
    const sp = sub.match(/^\s*\(([^)]*)\)/);
    if (!sp) break;
    if (sp[1]!.trim()) prepNotes.push(sp[1]!.trim().toLowerCase());
    i += sp[0]!.length;
  }
  return i;
}

function matchUnitAt(s: string, start: number): { unit: string; end: number } | null {
  const sub = s.slice(start);
  const ws = sub.match(/^\s+/);
  const i0 = ws ? ws[0]!.length : 0;
  const from = sub.slice(i0);
  const lower = from.toLowerCase();

  for (const phrase of UNIT_PHRASES_ORDERED) {
    const pl = phrase.toLowerCase();
    if (!lower.startsWith(pl)) continue;
    const after = from[phrase.length];
    if (after !== undefined && /[a-z]/i.test(after)) {
      if (phrase.length === 1 && after && /[a-z]/i.test(after)) {
        continue;
      }
      if (phrase.length >= 2 && /[a-z]/i.test(after)) {
        continue;
      }
    }
    const consumed = i0 + phrase.length;
    let total = start + consumed;
    if (from[phrase.length] === '.') total += 1;
    return {
      unit: from.slice(0, phrase.length + (from[phrase.length] === '.' ? 1 : 0)),
      end: total,
    };
  }
  return null;
}

export interface ParsedQuantityPrefix {
  quantityRaw: string;
  quantityValue: number | undefined;
  unitRaw: string;
  consumed: number;
  parenPrepNotes: string[];
}

/** Parse leading quantity + unit; returns null if no numeric prefix. */
export function parseLeadingQuantityPrefix(
  cleaned: string,
  prepNotes: string[],
): ParsedQuantityPrefix | null {
  const num = parseLeadingNumberCluster(cleaned);
  if (!num) return null;

  let pos = num.end;
  pos = consumeOptionalParentheticals(cleaned, pos, prepNotes);

  const unitMatch = matchUnitAt(cleaned, pos);
  if (!unitMatch) {
    const qv = parseQuantityValue(num.raw.trim());
    return {
      quantityRaw: num.raw.trim(),
      quantityValue: qv,
      unitRaw: '',
      consumed: pos,
      parenPrepNotes: [],
    };
  }

  const quantityRaw = cleaned.slice(0, unitMatch.end).trim();
  const qv = parseQuantityValue(num.raw.trim());

  return {
    quantityRaw,
    quantityValue: qv,
    unitRaw: unitMatch.unit.replace(/\.$/, '').trim(),
    consumed: unitMatch.end,
    parenPrepNotes: [],
  };
}

/** "Rosemary 3 sprigs" → name rosemary, move count+unit into prep notes. */
function stripTrailingCountMeasureSuffix(name: string, prepNotes: string[]): string {
  const re =
    /\s+(\d+)\s+(sprigs?|stalks?|stems?|bunches?|heads?|cloves?|slices?|pieces?|sticks?|fillets?|leaves?)\s*$/i;
  const m = name.match(re);
  if (!m || m.index === undefined) return name;
  prepNotes.push(`${m[1]} ${m[2]!.toLowerCase()}`);
  return name.slice(0, m.index).trim();
}

function stripRedundantPackagingLead(name: string): string {
  let n = name.trim();
  if (!n) return n;
  if (PACKAGING_LEAD_STRIP.test(n)) {
    const stripped = n.replace(PACKAGING_LEAD_STRIP, '').trim();
    if (stripped) n = stripped;
  }
  return n;
}

function startsWithQuantityLike(stripped: string): boolean {
  const c = stripLeadingIngredientNoise(stripped).trim();
  return /^[\d¼½¾⅓⅔⅛⅜⅝⅞.]/.test(c);
}

function isAllCapsSectionLabel(stripped: string): boolean {
  const t = stripped.replace(/:\s*$/, '').trim();
  if (t.length < 2 || t.length > 90) return false;
  if (/^\d/.test(t)) return false;
  if (!/^[A-Z0-9\s\-'']+$/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => w === w.toUpperCase() && /[A-Z]/.test(w));
}

function isTitleColonLabel(stripped: string): boolean {
  const t = stripped.trim();
  if (!/:\s*$/.test(t)) return false;
  if (t.length < 3 || t.length > 90) return false;
  if (/^\d/.test(t)) return false;
  const body = t.replace(/:\s*$/, '').trim();
  if (body.split(/\s+/).length < 2) return false;
  if (/[.!?]\s/.test(body)) return false;
  return true;
}

function stripLeadingPrepDescriptors(name: string, notes: string[]): string {
  const parts = name.split(/\s+/).filter(Boolean);
  let idx = 0;
  while (idx < parts.length && PREP_DESCRIPTORS.has(parts[idx]!.toLowerCase())) {
    notes.push(parts[idx]!.toLowerCase());
    idx += 1;
  }
  return parts.slice(idx).join(' ').trim();
}

function stripLeadingQualifiers(name: string, notes: string[]): string {
  let out = name.trim();
  for (const prefix of QUALIFIER_PREFIXES) {
    const pattern = new RegExp(`^${prefix}\\s+`, 'i');
    if (pattern.test(out)) {
      notes.push(prefix);
      out = out.replace(pattern, '').trim();
    }
  }
  return out;
}

function commaSegmentIsOnlyDescriptors(segment: string): boolean {
  const words = segment.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => PREP_DESCRIPTORS.has(w.toLowerCase()));
}

/** Move leading comma-separated descriptor clauses into prep notes (Paprika-style "skinless, boneless chicken breasts"). */
function peelLeadingCommaDescriptorClauses(name: string, prepNotes: string[]): string {
  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  while (parts.length > 1 && commaSegmentIsOnlyDescriptors(parts[0]!)) {
    prepNotes.push(parts.shift()!.toLowerCase());
  }
  if (parts.length === 0) return '';
  const rest = parts.join(', ');
  return rest;
}

export function applyIngredientMatchSynonyms(name: string): string {
  let out = name.trim().replace(/\s+/g, ' ');
  if (!out) return out;

  const phraseSynonyms: Array<[RegExp, string]> = [
    [/\b(?:skinless\s+)?(?:boneless\s+)?chicken\s+breasts?\b/gi, 'chicken breast'],
    [/\bpitas\b/gi, 'pittas'],
    [/\bpita\b/gi, 'pittas'],
  ];
  for (const [re, replacement] of phraseSynonyms) {
    out = out.replace(re, replacement);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Phrase aliases applied only during matching (does not change parsed display name on the line). */
function applyMatchAliases(name: string): string {
  let out = name.trim().replace(/\s+/g, ' ');
  if (!out) return out;

  const phraseAliases: Array<[RegExp, string]> = [
    [/\bgarlic\s+powder\b/gi, 'garlic powder'],
    [/\bonion\s+powder\b/gi, 'onion powder'],
    [/\bworcestershire\s+sauce\b/gi, 'worcestershire sauce'],
    [/\b(?:green\s+)?onions?\s*\(\s*scallions?\s*\)/gi, 'green onion'],
    [/\bscallions?\b/gi, 'green onion'],
    [/\bgreen\s+onions?\b/gi, 'green onion'],
    [/\bred\s+onions?\b/gi, 'red onion'],
    [/\bkosher\s+salt\b/gi, 'kosher salt'],
    [/\b(?:ground\s+)?black\s+pepper\b/gi, 'black pepper'],
    [/\b(?:dry\s+)?bread\s*crumbs?\b/gi, 'breadcrumbs'],
    [/\bbreadcrumbs?\b/gi, 'breadcrumbs'],
    [/\bmonterey\s+jack(?:\s+cheese)?\b/gi, 'monterey jack cheese'],
    [/\bparmesan(?:\s+cheese)?\b/gi, 'parmesan cheese'],
    [/\bcheddar(?:\s+cheese)?\b/gi, 'cheddar cheese'],
    [/\bcream\s+cheese\b/gi, 'cream cheese'],
    [/\bcondensed\s+french\s+onion\s+soup\b/gi, 'french onion soup'],
    [/\bfrench\s+onion\s+soup\b/gi, 'french onion soup'],
  ];
  for (const [re, replacement] of phraseAliases) {
    out = out.replace(re, replacement);
  }
  return out.replace(/\s+/g, ' ').trim();
}

function stripLeadingSizeDescriptors(name: string, notes: string[]): string {
  const parts = name.split(/\s+/).filter(Boolean);
  let idx = 0;
  while (idx < parts.length - 1) {
    const w = parts[idx]!.toLowerCase();
    if (SIZE_DESCRIPTORS.has(w)) {
      notes.push(w);
      idx += 1;
    } else {
      break;
    }
  }
  if (idx > 0 && idx < parts.length) {
    return parts.slice(idx).join(' ').trim();
  }
  return name;
}

function stripTrailingPrepPhrases(name: string, notes: string[]): string {
  let out = name.trim();
  let progress = true;
  while (progress) {
    progress = false;
    const trailingPatterns = [
      /\s+(?:to\s+taste|optional|for\s+serving|for\s+garnish|to\s+serve|for\s+coating|for\s+dusting|for\s+frying|for\s+dipping|for\s+drizzling|for\s+topping|for\s+rolling|for\s+brushing|for\s+greasing|for\s+dredging|for\s+breading|for\s+sprinkling|for\s+finishing|for\s+basting|for\s+marinating|for\s+glazing)$/i,
      /\s+(?:in\s+water|in\s+brine|in\s+oil)(?:,.*)?$/i,
      /\s+(?:drained\s+but\s+liquid\s+reserved)$/i,
      /\s+(?:cut\s+into\s+(?:wedges|strips|pieces|chunks|cubes|rounds|rings|slices))$/i,
      /\s+(?:thinly|thickly|roughly|finely)\s+(?:sliced|chopped|diced|minced|cut|shredded)$/i,
      /\s+(?:rinsed|drained|peeled|zested|minced|chopped|diced|sliced|grated|shredded|crushed|deseeded|cored|seeded)(?:\s+well)?$/i,
      /,\s*(?:halved|quartered|drained|rinsed|peeled|sliced|chopped|diced|thawed|defrosted)$/i,
    ];
    for (const pattern of trailingPatterns) {
      const match = out.match(pattern);
      if (match) {
        notes.push(
          match[0]!
            .replace(/^[,\s]+/, '')
            .trim()
            .toLowerCase(),
        );
        out = out.replace(pattern, '').trim();
        progress = true;
      }
    }
  }
  return out;
}

export function isInstructionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const stripped = stripLeadingIngredientNoise(trimmed);
  if (!stripped) return true;

  if (/^\*{1,2}\s/.test(trimmed)) return true;
  if (/^(?:#+|>{1,2})\s*(?:note|tip|optional|see|for\s+)/i.test(stripped)) return true;

  if (isAllCapsSectionLabel(stripped)) return true;
  if (SECTION_HEADING_ONE_WORD.test(stripped.trim())) return true;
  if (isTitleColonLabel(stripped)) return true;

  if (stripped.length > 120) return true;
  if (stripped.length > 80 && !startsWithQuantityLike(trimmed)) return true;

  if (/^(?:adding|for\s+the)\b.*:\s*$/i.test(stripped)) return true;

  if (IMPERATIVE_VERBS.test(stripped)) return true;

  if (
    stripped.endsWith('.') &&
    !startsWithQuantityLike(trimmed) &&
    stripped.split(/\s+/).length > 5
  ) {
    return true;
  }

  return false;
}

function finalizeCanonicalName(namePart: string, unitRaw: string, prepNotes: string[]): string {
  let namePart2 = namePart.replace(/^of\s+/i, '').trim();
  namePart2 = namePart2.replace(/^(?:or|and\/or)\b\s+(?=[\d¼½¾⅓⅔⅛⅜⅝⅞.])/i, '').trim();

  namePart2 = namePart2.replace(/\[[\d.,]+\s*(?:kg|g|oz|lbs?|ml)\s*\]/gi, ' ').trim();
  namePart2 = namePart2.replace(/^of\s+/i, '').trim();
  namePart2 = namePart2.replace(/^\d+(?:\/\d+)?\s+(?=[a-z])/i, '').trim();

  namePart2 = namePart2.replace(/\(([^)]*)\)/g, (_, note: string) => {
    if (note.trim()) prepNotes.push(note.trim().toLowerCase());
    return ' ';
  });
  namePart2 = peelLeadingCommaDescriptorClauses(namePart2, prepNotes);
  const commaParts = namePart2
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  let canonical = commaParts.shift() ?? '';
  if (commaParts.length > 0) {
    prepNotes.push(...commaParts.map((part) => part.toLowerCase()));
  }

  canonical = stripRedundantPackagingLead(canonical);
  canonical = stripLeadingQualifiers(canonical, prepNotes);
  canonical = stripLeadingPrepDescriptors(canonical, prepNotes);
  canonical = stripLeadingSizeDescriptors(canonical, prepNotes);
  canonical = canonical.replace(/^quantity\s+/i, '').trim();
  canonical = stripTrailingPrepPhrases(canonical, prepNotes);
  canonical = stripTrailingCountMeasureSuffix(canonical, prepNotes);
  canonical = canonical.replace(/\s+leaves?\b/i, '').trim();
  canonical = canonical.replace(/\s+/g, ' ').trim();
  canonical = applyIngredientMatchSynonyms(canonical);

  const u = unitRaw.toLowerCase().replace(/\.$/, '').trim();
  if (!canonical && u && MEASURE_WORD_AS_INGREDIENT.has(u)) {
    canonical = u;
  }

  return canonical;
}

const WORD_QTY_RE = /^(a\s+few|a\s+couple(?:\s+of)?|several|some|few)\b\s*/i;
const ARTICLE_QTY_RE = /^(an?)\b\s+/i;
const PRE_UNIT_MOD_RE = /^(good|large|small|big|generous|scant|heaping)\s+/i;

function tryParseWordQuantity(
  cleaned: string,
  prepNotes: string[],
): {
  quantity: string;
  unit: string;
  quantityValue?: number;
  name: string;
  prepNotes: string[];
} | null {
  let qtyStr: string;
  let qtyValue: number | undefined;
  let rest: string;

  const wqm = cleaned.match(WORD_QTY_RE);
  if (wqm) {
    qtyStr = wqm[1]!.replace(/\s+/g, ' ').toLowerCase();
    qtyValue = qtyStr === 'a couple' || qtyStr === 'a couple of' ? 2 : undefined;
    rest = cleaned.slice(wqm[0]!.length);
  } else {
    const am = cleaned.match(ARTICLE_QTY_RE);
    if (!am) return null;
    qtyStr = '1';
    qtyValue = 1;
    rest = cleaned.slice(am[0]!.length);
  }

  const modM = rest.match(PRE_UNIT_MOD_RE);
  if (modM) {
    const afterMod = rest.slice(modM[0]!.length);
    if (matchUnitAt(afterMod, 0)) {
      prepNotes.push(modM[1]!.toLowerCase());
      rest = afterMod;
    }
  }

  let unitRaw = '';
  const unitM = matchUnitAt(rest, 0);
  if (unitM) {
    unitRaw = unitM.unit.replace(/\.$/, '').trim();
    rest = rest.slice(unitM.end).trim();
  }

  const canonical = finalizeCanonicalName(rest.trim(), unitRaw, prepNotes);
  if (!canonical) return null;

  return { quantity: qtyStr, unit: unitRaw, quantityValue: qtyValue, name: canonical, prepNotes };
}

const TRAILING_QTY_UNIT_RE =
  /\s+(\d+(?:\.\d+)?)\s*(ml|g|kg|oz|lbs?|litres?|liters?|pints?|quarts?|fl\.?\s*oz\.?)\s*$/i;
const TRAILING_QTY_SPACE_UNIT_RE =
  /\s+(\d+(?:\.\d+)?)\s+(ml|g|kg|oz|lbs?|litres?|liters?|pints?|quarts?|packs?|packages?|cans?|tins?|bottles?|jars?|bags?|fl\.?\s*oz\.?)\s*$/i;
const TRAILING_COUNT_RE = /\s+(\d+)\s*$/;

function tryParseTrailingQuantity(
  text: string,
  prepNotes: string[],
): {
  quantity: string;
  unit: string;
  quantityValue?: number;
  name: string;
  prepNotes: string[];
} | null {
  let namePart = text;
  let qtyRaw = '';
  let unitRaw = '';
  let qtyValue: number | undefined;

  let m = namePart.match(TRAILING_QTY_UNIT_RE);
  if (!m) m = namePart.match(TRAILING_QTY_SPACE_UNIT_RE);
  if (m) {
    qtyRaw = m[1]!;
    unitRaw = m[2]!.replace(/\.$/, '').trim();
    qtyValue = parseFloat(m[1]!);
    namePart = namePart.slice(0, m.index!).trim();
  } else {
    const cm = namePart.match(TRAILING_COUNT_RE);
    if (cm) {
      const candidate = namePart.slice(0, cm.index!).trim();
      if (candidate && /[a-z]/i.test(candidate)) {
        qtyRaw = cm[1]!;
        qtyValue = parseInt(cm[1]!, 10);
        namePart = candidate;
      }
    }
  }

  if (!qtyRaw) return null;

  const commaParts = namePart
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  namePart = commaParts.shift() ?? '';
  if (commaParts.length > 0) {
    prepNotes.push(...commaParts.map((p) => p.toLowerCase()));
  }

  const canonical = finalizeCanonicalName(namePart, unitRaw, prepNotes);
  if (!canonical) return null;

  return {
    quantity: qtyRaw,
    unit: unitRaw,
    quantityValue: qtyValue,
    name: canonical,
    prepNotes,
  };
}

function stripEmbeddedSizeDimension(namePart: string, prepNotes: string[]): string {
  const embeddedDimRe =
    /^(\d+(?:\/\d+)?[-–]?\s*(?:inch(?:es)?|ounces?|oz\.?|pounds?|lbs?\.?|cm|centimete?rs?|mm|millimete?rs?)(?:[-–](?:thick|wide|long|tall))?)\s+/i;
  let out = namePart;
  const dm = out.match(embeddedDimRe);
  if (dm) {
    prepNotes.push(dm[1]!.trim().toLowerCase());
    out = out.slice(dm[0]!.length).trim();
  }
  return out;
}

export function parseIngredientLine(line: string): {
  quantity: string;
  unit: string;
  quantityValue?: number;
  name: string;
  prepNotes: string[];
} {
  const trimmed = line.trim();
  if (!trimmed)
    return { quantity: '', unit: '', quantityValue: undefined, name: '', prepNotes: [] };

  if (isInstructionLine(trimmed))
    return { quantity: '', unit: '', quantityValue: undefined, name: '', prepNotes: [] };

  let cleaned = stripLeadingIngredientNoise(trimmed);
  if (!cleaned)
    return { quantity: '', unit: '', quantityValue: undefined, name: '', prepNotes: [] };

  cleaned = cleaned
    // ". 5 large …" → ".5 …" when the next word is not a measure (Word/list spacing before decimals)
    .replace(/^\.\s+([2-9])(?=\s+)/, (full, digit: string, offset: number, str: string) => {
      const after = str.slice(offset + full.length).trimStart();
      const head = (after.match(/^[^\s]+/) ?? [''])[0] ?? '';
      if (MEASURE_HEAD_AFTER_DOT_SPACE.test(head)) return full;
      return `.${digit}`;
    })
    .replace(/^\.\s+(\d+\.\d+)(?=\s|$)/, '.$1')
    .replace(/^\.\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();

  const prepNotes: string[] = [];

  const approxRe = /^(?:about|approximately|approx\.?|roughly|around)\s+(?=[\d¼½¾⅓⅔⅛⅜⅝⅞.]|a\s)/i;
  if (approxRe.test(cleaned)) {
    cleaned = cleaned.replace(approxRe, '');
    prepNotes.push('approximately');
  }

  const pq = parseLeadingQuantityPrefix(cleaned, prepNotes);

  if (pq && pq.quantityRaw) {
    let namePart = cleaned.slice(pq.consumed).trim();
    namePart = namePart.replace(/^\.\s+/, '').trim();

    let unitRaw = pq.unitRaw;

    if (!unitRaw && /^[-–—]\s*/.test(namePart)) {
      const afterDash = namePart.replace(/^[-–—]\s*/, '');
      const dashUnit = matchUnitAt(afterDash, 0);
      if (dashUnit) {
        unitRaw = dashUnit.unit.replace(/\.$/, '').trim();
        namePart = afterDash.slice(dashUnit.end).trim();
      }
    }

    if (unitRaw && /^[-–—]\s*\d/.test(namePart)) {
      const uEsc = unitRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rangeCont = namePart.match(
        new RegExp(`^[-–—]\\s*\\d+(?:\\.\\d+)?\\s*${uEsc}\\b\\s*`, 'i'),
      );
      if (rangeCont) {
        namePart = namePart.slice(rangeCont[0]!.length).trim();
      }
    }

    const dimRe = /^-?\s*(?:inch(?:es)?|cm|centimete?rs?|mm|millimete?rs?)\b\s*/i;
    if (!unitRaw && dimRe.test(namePart)) {
      const dimMatch = namePart.match(dimRe)!;
      const dimWord = dimMatch[0]!.replace(/^-?\s*/, '').trim();
      prepNotes.push(`${pq.quantityRaw.trim()}-${dimWord}`);
      namePart = namePart.slice(dimMatch[0]!.length).trim();
      const reUnit = matchUnitAt(namePart, 0);
      if (reUnit) {
        unitRaw = reUnit.unit.replace(/\.$/, '').trim();
        namePart = namePart.slice(reUnit.end).trim();
      }
    }

    const sizeUnitRe =
      /^(\d+(?:[-–]\d+)?[-–]?\s*(?:ounces?|oz\.?|pounds?|lbs?\.?|grams?|g|ml|fl\.?\s*oz\.?))\s+/i;
    if (!unitRaw && sizeUnitRe.test(namePart)) {
      const sizeMatch = namePart.match(sizeUnitRe)!;
      const afterSize = namePart.slice(sizeMatch[0]!.length);
      const reUnit = matchUnitAt(afterSize, 0);
      if (reUnit) {
        prepNotes.push(sizeMatch[1]!.trim());
        unitRaw = reUnit.unit.replace(/\.$/, '').trim();
        namePart = afterSize.slice(reUnit.end).trim();
      } else {
        prepNotes.push(sizeMatch[1]!.trim());
        namePart = afterSize.trim();
      }
    }

    namePart = stripEmbeddedSizeDimension(namePart, prepNotes);

    const preUnitSizeRe = /^(large|small|medium|big|jumbo|extra-large|thin|thick)\s+/i;
    if (!unitRaw && preUnitSizeRe.test(namePart)) {
      const modMatch = namePart.match(preUnitSizeRe)!;
      const afterMod = namePart.slice(modMatch[0]!.length);
      const reUnit = matchUnitAt(afterMod, 0);
      if (reUnit) {
        prepNotes.push(modMatch[1]!.toLowerCase());
        unitRaw = reUnit.unit.replace(/\.$/, '').trim();
        namePart = afterMod.slice(reUnit.end).trim();
      }
    }

    if (namePart || unitRaw) {
      const canonical = finalizeCanonicalName(namePart, unitRaw, prepNotes);
      return {
        quantity: pq.quantityRaw.trim(),
        unit: unitRaw,
        quantityValue: pq.quantityValue,
        name: canonical,
        prepNotes,
      };
    }
  }

  const wordResult = tryParseWordQuantity(cleaned, prepNotes);
  if (wordResult) return wordResult;

  const trailingResult = tryParseTrailingQuantity(cleaned, prepNotes);
  if (trailingResult) return trailingResult;

  cleaned = cleaned
    .replace(/\(([^)]*)\)/g, (_, note: string) => {
      if (note.trim()) prepNotes.push(note.trim().toLowerCase());
      return ' ';
    })
    .trim();
  cleaned = peelLeadingCommaDescriptorClauses(cleaned, prepNotes);
  const commaParts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  let canonical = commaParts.shift() ?? '';
  if (commaParts.length > 0) {
    prepNotes.push(...commaParts.map((part) => part.toLowerCase()));
  }
  canonical = canonical.replace(/^\.\s+/, '').trim();
  canonical = canonical.replace(/\[[\d.,]+\s*(?:kg|g|oz|lbs?|ml)\s*\]/gi, ' ').trim();
  canonical = canonical.replace(/^of\s+/i, '').trim();
  canonical = canonical.replace(/^(?:or|and\/or)\b\s+(?=[\d¼½¾⅓⅔⅛⅜⅝⅞.])/i, '').trim();
  canonical = stripLeadingQualifiers(canonical, prepNotes);
  canonical = stripLeadingPrepDescriptors(canonical, prepNotes);
  canonical = stripLeadingSizeDescriptors(canonical, prepNotes);
  canonical = stripTrailingPrepPhrases(canonical, prepNotes);
  canonical = stripTrailingCountMeasureSuffix(canonical, prepNotes);
  canonical = canonical.replace(/\s+/g, ' ').trim();
  canonical = applyIngredientMatchSynonyms(canonical);

  return { quantity: '', unit: '', quantityValue: undefined, name: canonical, prepNotes };
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SINGULAR_EXCEPTIONS = new Set([
  'hummus',
  'couscous',
  'lentils',
  'chickpeas',
  'oats',
  'peas',
  'noodles',
  'greens',
  'grits',
  'grains',
  'sprouts',
  'capers',
  'molasses',
  'quinoa',
  'edamame',
  'gnocchi',
  'tortellini',
  'rigatoni',
  'penne',
  'fusilli',
]);

export function singularize(word: string): string {
  const w = word.toLowerCase();
  if (w.length < 3) return w;
  if (SINGULAR_EXCEPTIONS.has(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ves')) return w.slice(0, -3) + 'f';
  if (w.endsWith('oes') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ses') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('xes') || w.endsWith('zes'))
    return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

/**
 * Singular lowercase ingredient tokens → canonical regional form for matching only.
 * Keeps import lines and household display names unchanged; `matchIngredient` applies
 * this to the query and each candidate so pairs like eggplant/aubergine match both ways.
 */
const REGIONAL_SYNONYM_CANONICAL: Readonly<Record<string, string>> = {
  aubergine: 'aubergine',
  eggplant: 'aubergine',
  courgette: 'courgette',
  zucchini: 'courgette',
  coriander: 'coriander',
  cilantro: 'coriander',
  rocket: 'rocket',
  arugula: 'rocket',
  prawns: 'prawns',
  prawn: 'prawns',
  shrimp: 'prawns',
  shrimps: 'prawns',
  beetroot: 'beetroot',
  beet: 'beetroot',
  beets: 'beetroot',
  swede: 'swede',
  rutabaga: 'swede',
};

export function applyRegionalSynonyms(name: string): string {
  const out = name.trim().replace(/\s+/g, ' ');
  if (!out) return out;
  const parts = out.split(/\s+/);
  const mapped = parts.map((raw) => {
    const w = raw.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!w) return raw;
    const stem = singularize(w);
    const canon = REGIONAL_SYNONYM_CANONICAL[stem] ?? REGIONAL_SYNONYM_CANONICAL[w];
    if (!canon) return raw;
    return canon;
  });
  return mapped.join(' ');
}

function tokenize(s: string): string[] {
  return normalizeForMatch(s).split(/\s+/).filter(Boolean);
}

function tokenizeSingular(s: string): string[] {
  return tokenize(s).map(singularize);
}

const MATCH_STRIP_STYLE_WORDS = new Set([
  'italian',
  'style',
  'vine',
  'baby',
  'plum',
  'fire',
  'sun',
  'stewed',
  'roasted',
  'cooked',
  'grilled',
  'baked',
  'steamed',
  'hot',
  'tuscan',
  'lacinato',
  'dinosaur',
]);

export function normalizeForMatching(s: string): string {
  const tokens = tokenize(s);
  const cleaned = tokens
    .filter((t) => !PACKAGING_WORDS.has(t) && !SIZE_DESCRIPTORS.has(t))
    .map(singularize);
  return cleaned.join(' ');
}

const STOPWORDS = new Set([
  'of',
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'with',
  'to',
  'in',
  'on',
  'at',
  'any',
  'some',
]);

/** Query tokens that must appear in the candidate for a catalog match when present in the query. */
const REQUIRED_MODIFIER_TOKENS = new Set([
  'powder',
  'condensed',
  'worcestershire',
  'parmesan',
  'monterey',
  'cheddar',
  'jack',
  'french',
  'breadcrumbs',
  'breadcrumb',
  'crumbs',
  'crumb',
  'kosher',
  'scallion',
  'scallions',
  'soup',
  'green',
  'red',
  'ground',
  'black',
  'brown',
  'sea',
  'smoked',
  'dried',
  'dry',
  'panko',
  'seasoned',
  'coconut',
  'sesame',
  'peanut',
  'olive',
  'taco',
  'tortellini',
]);

const GENERIC_HEADS = new Set([
  'cheese',
  'onion',
  'garlic',
  'bread',
  'cream',
  'pepper',
  'salt',
  'milk',
  'oil',
  'stock',
  'broth',
  'sauce',
  'seasoning',
  'powder',
  'spinach',
]);

const COMPOUND_WHERE_FIRST_TOKEN_ALONE_IS_WRONG = new Set([
  'cream cheese',
  'ice cream',
  'sour cream',
  'french onion soup',
  'cream of chicken soup',
  'cream of mushroom soup',
  'coconut milk',
  'coconut cream',
  'coconut oil',
  'chicken stock',
  'chicken broth',
  'beef stock',
  'beef broth',
  'vegetable stock',
  'vegetable broth',
  'taco seasoning',
  'olive oil',
  'sesame oil',
  'peanut butter',
  'almond butter',
  'nut butter',
  'tomato paste',
  'tomato sauce',
]);

export function matchScore(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const singa = tokenizeSingular(a);
  const singb = tokenizeSingular(b);
  const singaJoined = singa.join(' ');
  const singbJoined = singb.join(' ');
  if (singaJoined === singbJoined) return 1;

  const ta = tokenize(a);
  const tb = tokenize(b);
  const sa = new Set(singa.filter((t) => !STOPWORDS.has(t)));
  const sb = new Set(singb.filter((t) => !STOPWORDS.has(t)));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) {
    if (sb.has(t)) inter += 1;
  }
  const union = sa.size + sb.size - inter;
  const jaccard = union > 0 ? inter / union : 0;
  if (jaccard >= 0.99) return 1;
  if (jaccard >= 0.66) return 0.72 + jaccard * 0.2;
  if (jaccard >= 0.4) return 0.45 + jaccard * 0.35;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length > nb.length ? na : nb;
    if (longer === shorter) return 1;
    const extra = longer.slice(shorter.length).trim();
    if (extra.length > 0 && !longer.startsWith(shorter + ' ')) {
      return jaccard > 0 ? 0.35 + jaccard * 0.2 : 0.35;
    }
    return 0.68;
  }
  if (singaJoined.includes(singbJoined) || singbJoined.includes(singaJoined)) {
    return 0.68;
  }
  const wordsA = ta.filter((w) => !STOPWORDS.has(w));
  const wordsB = tb.filter((w) => !STOPWORDS.has(w));
  const wordsASing = wordsA.map(singularize);
  const wordsBSing = wordsB.map(singularize);
  const sharedWords = wordsASing.filter((w) =>
    wordsBSing.some((wb) => wb === w || (w.length > 3 && (wb.includes(w) || w.includes(wb)))),
  );
  if (sharedWords.length > 0) {
    return 0.28 + (sharedWords.length / Math.max(wordsA.length, wordsB.length)) * 0.35;
  }
  return 0;
}

function catalogMatchVeto(
  queryNorm: string,
  queryTokens: string[],
  candidateName: string,
): boolean {
  const cn = normalizeForMatch(candidateName);
  const ctoks = tokenize(candidateName);
  const querySing = queryTokens.map(singularize);
  const candSing = ctoks.map(singularize);

  for (const t of querySing) {
    if (STOPWORDS.has(t) || t.length < 3) continue;
    if (!REQUIRED_MODIFIER_TOKENS.has(t)) continue;
    if (!candSing.some((c) => c === t || singularize(c) === t)) return true;
  }

  const qNonStop = querySing.filter((t) => !STOPWORDS.has(t) && t.length > 0);
  const cNonStop = candSing.filter((t) => !STOPWORDS.has(t));

  if (cNonStop.length === 1 && qNonStop.length > 1) {
    const head = cNonStop[0]!;
    if (GENERIC_HEADS.has(head) || GENERIC_HEADS.has(singularize(head))) {
      for (const t of qNonStop) {
        if (t !== head && singularize(t) !== singularize(head) && !candSing.includes(t))
          return true;
      }
    }
  }

  const candLower = candidateName.toLowerCase().trim();
  const queryNormSing = querySing.join(' ');
  for (const compound of COMPOUND_WHERE_FIRST_TOKEN_ALONE_IS_WRONG) {
    if (candLower === compound || candLower.endsWith(compound)) {
      const q = queryNormSing.trim();
      if (q === compound) break;
      if (
        compound.startsWith(q + ' ') ||
        (q.length < compound.length && compound.startsWith(q) && q.split(/\s+/).length === 1)
      ) {
        return true;
      }
    }
  }

  if (cn.includes('onion') && queryNorm.includes('soup') && !cn.includes('soup')) return true;
  if (queryNorm.includes('crumb') && !cn.includes('crumb') && !cn.includes('breadcrumbs'))
    return true;

  if (queryNorm.includes('tortellini') && cn === 'spinach') return true;
  if (queryNorm.includes('tortellini') && !cn.includes('tortellini')) return true;

  return false;
}

function householdMatchVeto(
  queryNorm: string,
  queryTokens: string[],
  candidateName: string,
): boolean {
  const cn = normalizeForMatch(candidateName);
  if (cn.includes('onion') && queryNorm.includes('soup') && !cn.includes('soup')) return true;
  if (queryNorm.includes('crumb') && !cn.includes('crumb') && !cn.includes('bread')) return true;
  if (queryNorm.includes('tortellini') && !cn.includes('tortellini')) return true;
  return catalogMatchVeto(queryNorm, queryTokens, candidateName);
}

const HOUSEHOLD_MIN = 0.56;
const CATALOG_MIN = 0.86;

/** Bands for matches that meet the minimum fuzzy threshold. */
export type MatchConfidenceBand = 'exact' | 'strong' | 'low';

export function confidenceBandFromScore(score: number): MatchConfidenceBand {
  if (score >= 0.95 || score === 1) return 'exact';
  if (score >= 0.75) return 'strong';
  return 'low';
}

function stripMatchStyleDescriptors(name: string): string {
  const tokens = tokenize(name);
  const cleaned = tokens.filter((t) => !MATCH_STRIP_STYLE_WORDS.has(t) && !STOPWORDS.has(t));
  return cleaned.join(' ');
}

/** -1 if both veto paths reject; otherwise fuzzy score (may be below caller's minimum). */
function scoreMatchAgainstCandidate(
  matchName: string,
  queryNorm: string,
  queryTokens: string[],
  querySingular: string,
  strippedQuery: string,
  strippedNorm: string,
  strippedTokens: string[],
  candidateName: string,
  vetoFn: (queryNorm: string, queryTokens: string[], candidateName: string) => boolean,
  minForStrippedBoost: number,
): number {
  candidateName = applyRegionalSynonyms(candidateName);
  const vetoed = vetoFn(queryNorm, queryTokens, candidateName);
  const strippedVetoed =
    strippedQuery !== matchName ? vetoFn(strippedNorm, strippedTokens, candidateName) : true;
  if (vetoed && strippedVetoed) return -1;

  let score = matchScore(matchName, candidateName);
  const candSingular = normalizeForMatching(candidateName);
  if (querySingular === candSingular && score < 1) score = 1;

  if (score < minForStrippedBoost && strippedQuery && strippedQuery !== matchName) {
    const strippedScore = matchScore(strippedQuery, candidateName);
    if (strippedScore > score) score = strippedScore;
    const strippedSingular = normalizeForMatching(strippedQuery);
    if (strippedSingular === candSingular && score < 1) score = 1;
  }

  return score;
}

export function matchIngredient(
  name: string,
  householdIngredients: Ingredient[],
  catalog: CatalogIngredient[] = MASTER_CATALOG,
): {
  ingredient: Ingredient | null;
  catalogItem: CatalogIngredient | null;
  status: ParsedIngredientLine['status'];
  matchScore: number;
  confidenceBand: MatchConfidenceBand;
} {
  if (!name.trim()) {
    return {
      ingredient: null,
      catalogItem: null,
      status: 'unmatched',
      matchScore: 0,
      confidenceBand: 'low',
    };
  }

  const matchName = applyMatchAliases(
    applyIngredientMatchSynonyms(applyRegionalSynonyms(name.trim())),
  );
  const queryNorm = normalizeForMatch(matchName);
  const queryTokens = tokenize(matchName);
  const querySingular = normalizeForMatching(matchName);

  const strippedQuery = stripMatchStyleDescriptors(matchName);
  const strippedNorm = normalizeForMatch(strippedQuery);
  const strippedTokens = tokenize(strippedQuery);

  type BestPick = {
    tier: number;
    score: number;
    ingredient: Ingredient | null;
    catalogItem: CatalogIngredient | null;
  };

  const candidatePicks: BestPick[] = [];

  for (const ing of householdIngredients) {
    const sCanon = scoreMatchAgainstCandidate(
      matchName,
      queryNorm,
      queryTokens,
      querySingular,
      strippedQuery,
      strippedNorm,
      strippedTokens,
      ing.name,
      householdMatchVeto,
      HOUSEHOLD_MIN,
    );
    if (sCanon >= HOUSEHOLD_MIN)
      candidatePicks.push({ tier: 0, score: sCanon, ingredient: ing, catalogItem: null });

    for (const alias of ing.aliases ?? []) {
      const sAlias = scoreMatchAgainstCandidate(
        matchName,
        queryNorm,
        queryTokens,
        querySingular,
        strippedQuery,
        strippedNorm,
        strippedTokens,
        alias,
        householdMatchVeto,
        HOUSEHOLD_MIN,
      );
      if (sAlias >= HOUSEHOLD_MIN)
        candidatePicks.push({ tier: 1, score: sAlias, ingredient: ing, catalogItem: null });
    }
  }

  for (const ci of catalog) {
    let catScore = -1;
    let catTier: 2 | 3 = 2;

    const sCanon = scoreMatchAgainstCandidate(
      matchName,
      queryNorm,
      queryTokens,
      querySingular,
      strippedQuery,
      strippedNorm,
      strippedTokens,
      ci.name,
      catalogMatchVeto,
      CATALOG_MIN,
    );
    if (sCanon >= CATALOG_MIN) {
      catScore = sCanon;
      catTier = 2;
    }

    for (const alias of ci.aliases ?? []) {
      const sAlias = scoreMatchAgainstCandidate(
        matchName,
        queryNorm,
        queryTokens,
        querySingular,
        strippedQuery,
        strippedNorm,
        strippedTokens,
        alias,
        catalogMatchVeto,
        CATALOG_MIN,
      );
      if (sAlias < CATALOG_MIN) continue;
      if (catScore < 0 || sAlias > catScore || (sAlias === catScore && catTier > 2)) {
        catScore = sAlias;
        catTier = 3;
      }
    }

    if (catScore >= CATALOG_MIN) {
      candidatePicks.push({ tier: catTier, score: catScore, ingredient: null, catalogItem: ci });
    }
  }

  let best: BestPick | null = null;
  for (const c of candidatePicks) {
    if (!best || c.score > best.score || (c.score === best.score && c.tier < best.tier)) {
      best = c;
    }
  }

  if (!best) {
    return {
      ingredient: null,
      catalogItem: null,
      status: 'unmatched',
      matchScore: 0,
      confidenceBand: 'low',
    };
  }
  if (best.ingredient) {
    return {
      ingredient: best.ingredient,
      catalogItem: null,
      status: 'matched',
      matchScore: best.score,
      confidenceBand: confidenceBandFromScore(best.score),
    };
  }
  if (best.catalogItem) {
    return {
      ingredient: null,
      catalogItem: best.catalogItem,
      status: 'catalog',
      matchScore: best.score,
      confidenceBand: confidenceBandFromScore(best.score),
    };
  }

  return {
    ingredient: null,
    catalogItem: null,
    status: 'unmatched',
    matchScore: 0,
    confidenceBand: 'low',
  };
}

export function parseRecipeText(
  text: string,
  householdIngredients: Ingredient[],
): RecipeImportResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: ParsedIngredientLine[] = lines.map((raw) => {
    const { quantity, unit, quantityValue, name, prepNotes } = parseIngredientLine(raw);
    if (!name) {
      return {
        raw,
        quantity: '',
        unit: '',
        quantityValue: undefined,
        name: '',
        prepNotes: [],
        matchedIngredient: null,
        matchedCatalog: null,
        status: 'unmatched' as const,
      };
    }
    const { ingredient, catalogItem, status } = matchIngredient(name, householdIngredients);
    return {
      raw,
      quantity,
      unit,
      quantityValue,
      name,
      prepNotes,
      matchedIngredient: ingredient,
      matchedCatalog: catalogItem,
      status,
    };
  });

  return { lines: parsed, sourceUrl: '', sourceText: text };
}

export function guessComponentRole(category: IngredientCategory): MealComponent['role'] {
  switch (category) {
    case 'protein':
      return 'protein';
    case 'carb':
      return 'carb';
    case 'veg':
    case 'fruit':
      return 'veg';
    default:
      return 'topping';
  }
}
