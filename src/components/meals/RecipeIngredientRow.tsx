import { useState } from 'react';
import type { Ingredient, MealComponent } from '../../types';
import { Button, Input, Select, FieldLabel, Chip } from '../ui';
import { toSentenceCase } from '../../storage';
import InlineIngredientForm from './InlineIngredientForm';

type ComponentRole = MealComponent['role'];
const COMPONENT_ROLES: ComponentRole[] = ['protein', 'carb', 'veg', 'sauce', 'topping'];

export default function RecipeIngredientRow({
  component,
  ingredients,
  index,
  defaultExpanded,
  onChange,
  onRemove,
  onAddIngredient,
}: {
  component: MealComponent;
  ingredients: Ingredient[];
  index: number;
  defaultExpanded?: boolean;
  onChange: (updated: MealComponent) => void;
  onRemove: () => void;
  onAddIngredient: (ingredient: Ingredient) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [showInlineForm, setShowInlineForm] = useState(false);

  const primaryIngredient = ingredients.find((item) => item.id === component.ingredientId);

  const summaryParts = [
    primaryIngredient ? toSentenceCase(primaryIngredient.name) : 'Choose ingredient',
    component.role,
    component.quantity?.trim() ? component.quantity : 'No quantity',
  ];

  return (
    <div
      data-testid={`recipe-ingredient-row-${index}`}
      className="rounded-md border border-border-light bg-surface-card p-3"
    >
      <button
        type="button"
        data-testid={`recipe-ingredient-toggle-${index}`}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-text-primary">
            {summaryParts.join(' · ')}
          </span>
        </span>
        <Chip variant="neutral">{expanded ? 'Collapse' : 'Edit'}</Chip>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border-light pt-4">
          <FieldLabel label="Ingredient">
            <Select
              value={component.ingredientId}
              onChange={(e) => onChange({ ...component, ingredientId: e.target.value })}
            >
              <option value="">Select ingredient</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {toSentenceCase(ing.name)} ({ing.category})
                </option>
              ))}
            </Select>
          </FieldLabel>

          {showInlineForm ? (
            <InlineIngredientForm
              onAdd={(ing) => {
                onAddIngredient(ing);
                onChange({ ...component, ingredientId: ing.id });
                setShowInlineForm(false);
              }}
              onCancel={() => setShowInlineForm(false)}
            />
          ) : (
            <Button
              variant="ghost"
              small
              onClick={() => setShowInlineForm(true)}
              data-testid="recipe-add-ingredient-inline"
            >
              + Add new ingredient
            </Button>
          )}

          <div data-testid={`recipe-ingredient-selected-${index}`}>
            <span className="mb-1 block text-xs font-medium text-text-secondary">Selected</span>
            <Chip variant="success">
              {primaryIngredient
                ? toSentenceCase(primaryIngredient.name)
                : 'No ingredient selected'}
            </Chip>
          </div>

          <FieldLabel label="Role">
            <Select
              value={component.role}
              onChange={(e) =>
                onChange({
                  ...component,
                  role: e.target.value as ComponentRole,
                })
              }
            >
              {COMPONENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="Quantity">
            <Input
              type="text"
              value={component.quantity}
              onChange={(e) => onChange({ ...component, quantity: e.target.value })}
              placeholder="e.g. 200g"
              className="max-w-[220px]"
            />
          </FieldLabel>

          <FieldLabel label="Prep note (optional)">
            <Input
              type="text"
              value={component.prepNote ?? ''}
              onChange={(e) =>
                onChange({
                  ...component,
                  prepNote: e.target.value || undefined,
                })
              }
              placeholder="e.g. diced, room temperature"
            />
          </FieldLabel>

          <Button
            variant="ghost"
            small
            className="text-danger hover:text-danger"
            onClick={onRemove}
            data-testid={`recipe-remove-ingredient-${index}`}
          >
            Remove ingredient
          </Button>
        </div>
      )}
    </div>
  );
}
