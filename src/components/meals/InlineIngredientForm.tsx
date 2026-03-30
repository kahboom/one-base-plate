import { useState } from 'react';
import type { Ingredient, IngredientCategory } from '../../types';
import { Button, Input, Select, FieldLabel } from '../ui';
import { normalizeIngredientName } from '../../storage';

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

export default function InlineIngredientForm({
  onAdd,
  onCancel,
}: {
  onAdd: (ingredient: Ingredient) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<IngredientCategory>('pantry');

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ingredient: Ingredient = {
      id: crypto.randomUUID(),
      name: normalizeIngredientName(trimmed),
      category,
      tags: [],
      shelfLifeHint: '',
      freezerFriendly: false,
      babySafeWithAdaptation: false,
    };
    onAdd(ingredient);
  }

  return (
    <div
      data-testid="inline-ingredient-form"
      className="mt-2 rounded-sm border border-brand bg-bg p-3 space-y-3"
    >
      <span className="block text-xs font-semibold text-brand">New ingredient</span>
      <FieldLabel label="Name">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ingredient name"
          data-testid="inline-ingredient-name"
        />
      </FieldLabel>
      <FieldLabel label="Category">
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as IngredientCategory)}
          data-testid="inline-ingredient-category"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FieldLabel>
      <div className="flex gap-2">
        <Button small variant="primary" onClick={handleAdd} data-testid="inline-ingredient-save">
          Add ingredient
        </Button>
        <Button small onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
