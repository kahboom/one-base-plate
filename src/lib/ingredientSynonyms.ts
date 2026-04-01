/**
 * Ingredient synonym groups for search and UI matching.
 * Covers common regional/dialect name variants so that searching either term
 * returns results for the other (e.g. "zucchini" ↔ "courgette").
 *
 * Keep in sync with REGIONAL_SYNONYM_CANONICAL in recipe-parser.ts, which handles
 * the same pairs during import/matching (using token-level singularization).
 *
 * Convention: first entry in each group is the canonical/primary display name.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['courgette', 'zucchini'],
  ['aubergine', 'eggplant'],
  ['coriander', 'cilantro'],
  ['rocket', 'arugula'],
  // Plurals included so "shrimps" or "prawns" also expand correctly
  ['prawn', 'prawns', 'shrimp', 'shrimps'],
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
