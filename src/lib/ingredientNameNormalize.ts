/**
 * Pure ingredient name normalization (no Dexie/sync). Shared by storage, import flows, and CLI.
 */

const SINGULAR_EXCEPTIONS_GK = new Set([
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

function singularizeForGroupKey(word: string): string {
  const w = word.toLowerCase();
  if (w.length < 3) return w;
  if (SINGULAR_EXCEPTIONS_GK.has(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ves')) return w.slice(0, -3) + 'f';
  if (w.endsWith('oes') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ses') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('xes') || w.endsWith('zes'))
    return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/, '');
}

export function normalizeIngredientGroupKey(name: string): string {
  return normalizeIngredientName(name)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(singularizeForGroupKey)
    .join(' ');
}
