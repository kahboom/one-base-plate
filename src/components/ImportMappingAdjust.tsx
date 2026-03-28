import { useEffect, useState } from 'react';
import type { BaseMeal, Household, Ingredient, IngredientCategory, ImportMapping } from '../types';
import { applyImportMappingEdit, type ImportMappingEditPayload } from '../import-mapping-edit';
import { Button, Input, Select } from './ui';

const CATEGORY_OPTIONS: IngredientCategory[] = [
  'protein',
  'carb',
  'veg',
  'fruit',
  'dairy',
  'snack',
  'freezer',
  'pantry',
];

type DraftAction = 'ignore' | 'use' | 'create';

export default function ImportMappingAdjust({
  meal,
  household,
  onPersist,
}: {
  meal: BaseMeal;
  household: Household;
  onPersist: (meal: BaseMeal, newIngredients: Ingredient[]) => void;
}) {
  const mappings = meal.importMappings ?? [];
  const sorted = [...household.ingredients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  function persist(index: number, payload: Parameters<typeof applyImportMappingEdit>[2]) {
    const { meal: next, newIngredients } = applyImportMappingEdit(
      meal,
      index,
      payload,
      household.ingredients,
    );
    const merged = newIngredients.filter((n) => !household.ingredients.some((x) => x.id === n.id));
    onPersist(next, merged);
  }

  return (
    <details className="mt-2 rounded-md border border-dashed border-border-light bg-bg/40 p-2">
      <summary className="cursor-pointer text-xs text-text-muted hover:text-text-secondary">
        Adjust ingredient links
      </summary>
      <div
        className="mt-2 space-y-2 border-t border-border-light pt-2"
        data-testid="import-mapping-adjust"
      >
        {mappings.map((mapping, index) => (
          <ImportMappingRow
            key={`${mapping.originalLine}-${index}`}
            mapping={mapping}
            index={index}
            sortedIngredients={sorted}
            onPersist={persist}
          />
        ))}
      </div>
    </details>
  );
}

function ImportMappingRow({
  mapping,
  index,
  sortedIngredients,
  onPersist,
}: {
  mapping: ImportMapping;
  index: number;
  sortedIngredients: Ingredient[];
  onPersist: (index: number, payload: ImportMappingEditPayload) => void;
}) {
  const [draftAction, setDraftAction] = useState<DraftAction>(mapping.action);
  const [createName, setCreateName] = useState(
    () => mapping.cleanedIngredientName || mapping.parsedName || '',
  );
  const [createCategory, setCreateCategory] = useState<IngredientCategory>('pantry');

  useEffect(() => {
    setDraftAction(mapping.action);
    setCreateName(mapping.cleanedIngredientName || mapping.parsedName || '');
  }, [mapping.action, mapping.ingredientId, mapping.cleanedIngredientName, mapping.parsedName]);

  const useIngredientValue =
    mapping.action === 'use'
      ? (mapping.finalMatchedIngredientId ?? mapping.ingredientId ?? '')
      : '';

  return (
    <div
      className="flex flex-col gap-1.5 rounded-sm border border-border-light/80 bg-surface/50 p-2 sm:flex-row sm:flex-wrap sm:items-center"
      data-testid={`import-mapping-row-${index}`}
    >
      <p
        className="min-w-0 flex-1 text-xs text-text-secondary line-clamp-2"
        title={mapping.originalLine}
      >
        {mapping.originalLine}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          aria-label={`Link mode for line ${index + 1}`}
          className="!min-h-0 max-w-[140px] py-1 px-2 text-xs"
          value={draftAction}
          onChange={(e) => {
            const v = e.target.value as DraftAction;
            setDraftAction(v);
            if (v === 'ignore') {
              onPersist(index, { kind: 'ignore' });
            }
          }}
        >
          <option value="ignore">Ignore</option>
          <option value="use">Use existing</option>
          <option value="create">Create new</option>
        </Select>

        {draftAction === 'use' && (
          <Select
            aria-label={`Ingredient for line ${index + 1}`}
            className="!min-h-0 min-w-[120px] max-w-[200px] py-1 px-2 text-xs"
            value={useIngredientValue}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              onPersist(index, { kind: 'use', ingredientId: id });
            }}
          >
            <option value="">{mapping.action === 'use' ? 'Change…' : 'Select…'}</option>
            {sortedIngredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name}
              </option>
            ))}
          </Select>
        )}

        {draftAction === 'create' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              className="!min-h-0 min-w-[100px] max-w-[160px] py-1 px-2 text-xs"
              placeholder="Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              aria-label={`New ingredient name line ${index + 1}`}
            />
            <Select
              aria-label={`Category line ${index + 1}`}
              className="!min-h-0 py-1 px-2 text-xs"
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value as IngredientCategory)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              small
              className="!min-h-0 py-1 px-2 text-xs"
              onClick={() =>
                onPersist(index, {
                  kind: 'create',
                  category: createCategory,
                  name: createName.trim() || undefined,
                })
              }
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
