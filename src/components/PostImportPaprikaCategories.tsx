import { useMemo, useState } from 'react';
import type { Recipe } from '../types';
import { loadHousehold, saveHouseholdAsync, normalizeHousehold } from '../storage';
import { applyPaprikaCategoryTagMappings } from '../lib/applyPaprikaCategoryTagMappings';
import {
  collectPaprikaCategoryRows,
  householdRecipeTagCandidates,
  rankPaprikaCategoryTagMatches,
  normalizeNewRecipeTagFromUser,
  type TagCandidate,
} from '../lib/paprikaCategoryTagSuggest';
import { recipeTagLabel } from '../lib/recipeTags';
import { Card, Button, ActionGroup, Chip, FieldLabel, Input, Select } from './ui';

function initialChoicesFromRows(
  rows: ReturnType<typeof collectPaprikaCategoryRows>,
  candidates: TagCandidate[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const ranked = rankPaprikaCategoryTagMatches(row.displayLabel, candidates, 1);
    out[row.normalizeKey] =
      ranked.length > 0 && ranked[0]!.score >= 0.45 ? ranked[0]!.candidate.value : '';
  }
  return out;
}

export default function PostImportPaprikaCategories({
  householdId,
  importedRecipes,
  onComplete,
}: {
  householdId: string;
  importedRecipes: Recipe[];
  onComplete: () => void;
}) {
  const rows = useMemo(() => collectPaprikaCategoryRows(importedRecipes), [importedRecipes]);
  const tagCandidates = useMemo(() => {
    const h = loadHousehold(householdId);
    if (!h) return householdRecipeTagCandidates({ recipes: [], baseMeals: [] });
    return householdRecipeTagCandidates(normalizeHousehold(h));
  }, [householdId, importedRecipes]);

  const [choices, setChoices] = useState<Record<string, string>>(() =>
    initialChoicesFromRows(rows, tagCandidates),
  );
  const [newTagDrafts, setNewTagDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const importedIds = useMemo(() => new Set(importedRecipes.map((r) => r.id)), [importedRecipes]);

  function setChoiceForRow(normalizeKey: string, value: string) {
    setChoices((prev) => ({ ...prev, [normalizeKey]: value }));
  }

  async function handleSaveMappings() {
    setError('');
    const mappings: Record<string, string> = {};
    for (const row of rows) {
      const v = choices[row.normalizeKey]?.trim();
      if (v) mappings[row.normalizeKey] = v;
    }
    if (Object.keys(mappings).length === 0) {
      onComplete();
      return;
    }
    const h = loadHousehold(householdId);
    if (!h) {
      setError('Could not load household.');
      return;
    }
    setSaving(true);
    try {
      const updated = applyPaprikaCategoryTagMappings(
        normalizeHousehold(h),
        importedIds,
        mappings,
      );
      await saveHouseholdAsync(updated);
      onComplete();
    } catch {
      setError('Could not save tag mappings. Try again or skip for now.');
    } finally {
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div data-testid="post-import-paprika-categories">
        <Card className="mb-4">
          <p className="text-sm text-text-secondary">
            No Paprika category labels were stored on these recipes (only recipes with categories in
            the export appear here). You can add tags anytime from the recipe library.
          </p>
        </Card>
        <ActionGroup>
          <Button variant="primary" onClick={onComplete} data-testid="paprika-cat-skip-btn">
            Continue
          </Button>
        </ActionGroup>
      </div>
    );
  }

  return (
    <div data-testid="post-import-paprika-categories">
      <Card className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary mb-2">Map Paprika categories to tags</h3>
        <p className="text-sm text-text-secondary mb-4">
          Each label below came from your Paprika export. Pick an existing recipe tag or create a new
          one. Suggestions are ranked with fuzzy matching. Tags are applied to every imported recipe that
          had that category.
        </p>

        <ul className="space-y-6">
          {rows.map((row) => {
            const ranked = rankPaprikaCategoryTagMatches(row.displayLabel, tagCandidates, 3);
            const rowTestId = `paprika-cat-row-${row.normalizeKey.replace(/[^a-z0-9]+/gi, '-')}`;
            const selectValue = choices[row.normalizeKey] ?? '';
            const selectOptions: TagCandidate[] = [...tagCandidates];
            if (selectValue && !selectOptions.some((c) => c.value === selectValue)) {
              selectOptions.push({ value: selectValue, label: recipeTagLabel(selectValue) });
            }

            return (
              <li
                key={row.normalizeKey}
                className="border-b border-border-light pb-6 last:border-0 last:pb-0"
                data-testid={rowTestId}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text-primary">&quot;{row.displayLabel}&quot;</span>
                  <Chip variant="neutral">
                    {row.recipeCount} recipe{row.recipeCount !== 1 ? 's' : ''}
                  </Chip>
                </div>

                {ranked.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                      Suggested matches
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ranked.map(({ candidate, score }) => (
                        <Button
                          key={candidate.value}
                          type="button"
                          variant={selectValue === candidate.value ? 'primary' : 'default'}
                          className="text-sm"
                          onClick={() => setChoiceForRow(row.normalizeKey, candidate.value)}
                          data-testid={`paprika-cat-suggest-${candidate.value}`}
                          title={`Match score ${(score * 100).toFixed(0)}%`}
                        >
                          {candidate.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <FieldLabel label="Tag to apply">
                  <Select
                    value={selectValue}
                    onChange={(e) => setChoiceForRow(row.normalizeKey, e.target.value)}
                    className="w-full max-w-md"
                    data-testid={`paprika-cat-select-${row.normalizeKey.replace(/[^a-z0-9]+/gi, '-')}`}
                  >
                    <option value="">Skip this category</option>
                    {selectOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label} ({c.value})
                      </option>
                    ))}
                  </Select>
                </FieldLabel>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <FieldLabel label="Or create a new tag" className="min-w-[200px] flex-1">
                    <Input
                      value={newTagDrafts[row.normalizeKey] ?? ''}
                      onChange={(e) =>
                        setNewTagDrafts((d) => ({ ...d, [row.normalizeKey]: e.target.value }))
                      }
                      placeholder="e.g. weeknight, italian"
                      data-testid={`paprika-cat-new-${row.normalizeKey.replace(/[^a-z0-9]+/gi, '-')}`}
                    />
                  </FieldLabel>
                  <Button
                    type="button"
                    onClick={() => {
                      const slug = normalizeNewRecipeTagFromUser(
                        newTagDrafts[row.normalizeKey] ?? '',
                      );
                      if (!slug) return;
                      setChoiceForRow(row.normalizeKey, slug);
                    }}
                    data-testid={`paprika-cat-use-new-${row.normalizeKey.replace(/[^a-z0-9]+/gi, '-')}`}
                  >
                    Use new tag
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {error && (
        <Card className="mb-4 border-danger bg-danger/5">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      )}

      <ActionGroup>
        <Button
          variant="primary"
          onClick={() => void handleSaveMappings()}
          disabled={saving}
          data-testid="paprika-cat-save-btn"
        >
          {saving ? 'Saving…' : 'Save tag mappings'}
        </Button>
        <Button type="button" onClick={onComplete} disabled={saving} data-testid="paprika-cat-skip-btn">
          Skip — continue
        </Button>
      </ActionGroup>
    </div>
  );
}
