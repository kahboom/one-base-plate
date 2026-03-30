import type { Household } from '../types';
import { normalizePaprikaCategory } from './paprikaCategoryMap';
import { normalizeRecipeTagForCurated } from './recipeTags';

/**
 * For each imported recipe, add recipe tags for Paprika categories where the user chose a tag.
 * Keys in `mappings` must be {@link normalizePaprikaCategory} keys; values are stored tag strings.
 */
export function applyPaprikaCategoryTagMappings(
  household: Household,
  importedRecipeIds: ReadonlySet<string>,
  mappings: Readonly<Record<string, string>>,
): Household {
  const recipes = (household.recipes ?? []).map((r) => {
    if (!importedRecipeIds.has(r.id)) return r;
    const rawCats = r.provenance?.rawCategories;
    if (!rawCats?.length) return r;

    const tags = [...(r.tags ?? [])];
    const normalizedSeen = new Set(tags.map((t) => normalizeRecipeTagForCurated(t)));

    for (const raw of rawCats) {
      const key = normalizePaprikaCategory(raw);
      if (!key) continue;
      const chosen = mappings[key]?.trim();
      if (!chosen) continue;
      const stored = chosen.toLowerCase();
      const norm = normalizeRecipeTagForCurated(stored);
      if (!norm) continue;
      if (!normalizedSeen.has(norm)) {
        normalizedSeen.add(norm);
        tags.push(stored);
      }
    }

    return { ...r, tags: tags.length > 0 ? tags : undefined };
  });

  return { ...household, recipes };
}
