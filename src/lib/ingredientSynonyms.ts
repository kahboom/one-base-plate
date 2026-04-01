/**
 * Ingredient synonym groups for search and UI matching.
 * Covers common regional/dialect name variants so that searching either term
 * returns results for the other (e.g. "zucchini" ↔ "courgette").
 *
 * Keep in sync with REGIONAL_SYNONYM_CANONICAL in recipe-parser.ts, which handles
 * the same pairs during import/matching (using token-level singularization).
 * Additional phrase pairs (multi-word) may appear here only; align token-level pairs
 * with the parser map when both should affect matching.
 *
 * Convention: first entry in each group is the canonical/primary display name.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['courgette', 'zucchini'],
  ['aubergine', 'eggplant'],
  ['coriander', 'cilantro'],
  ['rocket', 'arugula'],
  ['prawn', 'prawns', 'shrimp', 'shrimps'],
  ['corn starch', 'corn flour'],
  ['pickles', 'gherkins', 'pickle', 'gherkin'],
  ['slices of bacon', 'bacon rashers', 'bacon rasher', 'bacon strips'],
  // US ↔ UK and related regional names (cookbook / grocery wording; overlaps e.g.
  // https://culinaryginger.com/a-guide-of-american-to-british-food-names/)
  ['beetroot', 'beet', 'beets'],
  ['spring onions', 'green onions', 'green onion', 'scallions', 'scallion'],
  ['icing sugar', 'powdered sugar', 'confectioners sugar'],
  ['plain flour', 'all-purpose flour', 'all purpose flour'],
  // UK cornflour ≈ US corn starch (not cornmeal / masa harina)
  ['cornflour', 'corn starch', 'cornstarch'],
  ['jacket potato', 'baked potato', 'baked potatoes', 'jacket potatoes'],
  ['cos lettuce', 'romaine lettuce', 'romaine'],
  ['semi-skimmed milk', 'semi skimmed milk', 'low-fat milk', 'low fat milk'],
  ['fish fingers', 'fish sticks', 'fish stick'],
  ['mangetout', 'snow peas', 'snow pea'],
  ['swede', 'rutabaga'],
  ['fava beans', 'broad beans', 'fava bean', 'broad bean'],
  ['popsicle', 'ice lolly', 'ice lollies'],
  ['oatmeal', 'porridge'],
  ['green beans', 'runner beans', 'string beans'],
  ['caster sugar', 'castor sugar', 'superfine sugar'],
  ['crisps', 'potato crisps', 'potato chips'],
  // Spelling variants
  ['yogurt', 'yoghurt'],
  ['hummus', 'houmous'],
  ['whiskey', 'whisky'],
  // Regional name variants (multi-word phrases work too)
  ['ground beef', 'beef mince', 'minced beef'],
  ['ground chicken', 'chicken mince', 'minced chicken'],
  ['ground lamb', 'lamb mince', 'minced lamb'],
  ['ground turkey', 'turkey mince', 'minced turkey'],
  ['ground pork', 'pork mince'],
  ['almond butter', 'nut butter'],
  ['baguette', 'french bread'],
  ['brown lentils', 'green lentils', 'orange lentils'],
  ['butter beans', 'lima beans'],
  ['chipolatas', 'chipolata sausages'],
  ['chorizo', 'spanish chorizo'],
  ['cornmeal', 'polenta', 'corn meal'],
  ['creme fraiche', 'crème fraîche'],
  ['duck breast', 'duck'],
  ['halloumi', 'halloumi cheese'],
  ['kale', 'curly kale'],
  ['mayonnaise', 'mayo'],
  ['mirin', 'sweet sake'],
  ['molasses', 'blackstrap molasses'],
  ['mustard', 'american mustard', 'yellow mustard', 'prepared mustard'],
  ['parmesan', 'parmesan cheese', 'parmigiano-reggiano', 'parmigiano reggiano', 'grated parmesan'],
];

const _synonymMap = new Map<string, readonly string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    _synonymMap.set(term, group);
  }
}

/**
 * Returns all equivalent search terms for the given query string, including
 * the query itself. Looks up the full lowercased query as a phrase key.
 *
 * @example
 * getSynonymForms('zucchini')  // → ['courgette', 'zucchini']
 * getSynonymForms('shrimp')    // → ['prawn', 'prawns', 'shrimp', 'shrimps']
 * getSynonymForms('chicken')   // → ['chicken']
 */
export function getSynonymForms(query: string): readonly string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [q];
  return _synonymMap.get(q) ?? [q];
}
