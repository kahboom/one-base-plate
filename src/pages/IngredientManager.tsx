import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type FormEvent,
} from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { Ingredient, IngredientCategory, Household } from '../types';
import {
  loadHousehold,
  saveHousehold,
  toSentenceCase,
  normalizeIngredientName,
  normalizeIngredientForStorage,
  mergeDuplicateMetadata,
  remapIngredientReferences,
  validateIngredientAliases,
  ingredientMatchesQuery,
  sanitizeIngredientAliasesAgainstHousehold,
} from '../storage';
import type { CatalogIngredient } from '../catalog';
import { catalogIngredientToHousehold, findNearDuplicates, searchCatalog } from '../catalog';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Chip,
  FieldLabel,
  EmptyState,
  ConfirmDialog,
  useConfirm,
} from '../components/ui';
import AppModal from '../components/AppModal';
import TagSuggestInput from '../components/TagSuggestInput';
import { sortIngredients, type IngredientSortKey, type SortDir } from '../lib/listSort';
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE, type PageSize } from '../hooks/usePaginatedList';
import { findIngredientReferences, type IngredientReference } from '../lib/ingredientRefs';
import { getCatalogDefaultImageUrl, resolveIngredientImageUrl } from '../lib/ingredientImage';
import { useListKeyNav } from '../hooks/useListKeyNav';
import {
  suggestIngredientMergePairs,
  type IngredientMergePairSuggestion,
} from '../lib/suggestIngredientMergePairs';
import {
  addDismissedMergePairKeys,
  loadDismissedMergePairKeys,
  mergePairKey,
  pickMergeSurvivorHeuristic,
} from '../lib/ingredientMergeDismissals';

const INGREDIENT_SORT_OPTIONS: {
  value: string;
  label: string;
  key: IngredientSortKey;
  dir: SortDir;
}[] = [
  { value: 'name-asc', label: 'Name (A–Z)', key: 'name', dir: 'asc' },
  { value: 'name-desc', label: 'Name (Z–A)', key: 'name', dir: 'desc' },
  { value: 'category-asc', label: 'Category (A–Z)', key: 'category', dir: 'asc' },
  { value: 'category-desc', label: 'Category (Z–A)', key: 'category', dir: 'desc' },
];

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

const COMMON_TAGS = ['quick', 'mashable', 'rescue', 'staple', 'batch-friendly'];

type SourceFilter = '' | 'manual' | 'catalog' | 'pending-import';

function parseIngredientListPage(sp: URLSearchParams): number {
  const raw = sp.get('page');
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseIngredientListPerPage(sp: URLSearchParams): PageSize | undefined {
  const raw = sp.get('perPage');
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return PAGE_SIZE_OPTIONS.includes(n as PageSize) ? (n as PageSize) : undefined;
}

function createEmptyIngredient(): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: '',
    category: 'pantry',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
  };
}

const CATEGORY_CHIP_VARIANT: Record<
  IngredientCategory,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  protein: 'danger',
  carb: 'warning',
  veg: 'success',
  fruit: 'success',
  dairy: 'info',
  snack: 'neutral',
  freezer: 'info',
  pantry: 'neutral',
};

const CATALOG_PICKER_RESULT_CAP = 50;

/* ---------- Add from catalog: search master catalog (F070) ---------- */
function CatalogAddDialog({
  open,
  onClose,
  onPickCatalog,
  onCreateManual,
}: {
  open: boolean;
  onClose: () => void;
  onPickCatalog: (item: CatalogIngredient) => void;
  /** Trimmed search text from the dialog, used to pre-fill the manual ingredient name. */
  onCreateManual: (searchText: string) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const results = useMemo(() => {
    const all = searchCatalog(query);
    return all.slice(0, CATALOG_PICKER_RESULT_CAP);
  }, [query]);

  if (!open) return null;

  return (
    <AppModal
      open
      onClose={onClose}
      ariaLabel="Add ingredient from catalog"
      backdropClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      className="max-h-[85vh] w-full max-w-md flex flex-col overflow-hidden p-0"
      panelTestId="catalog-add-dialog"
    >
      <div className="border-b border-border-light px-4 py-3">
        <h2 className="text-base font-bold text-text-primary">Add ingredient</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Search the master catalog first, or create a manual ingredient if it is not listed.
        </p>
        <Input
          type="search"
          className="mt-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search catalog…"
          data-testid="catalog-add-search"
          autoFocus
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {query.trim() && results.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-text-muted">No catalog matches.</p>
        )}
        {!query.trim() && (
          <p className="px-2 py-4 text-center text-sm text-text-muted">
            Type to search the master ingredient catalog.
          </p>
        )}
        <ul className="space-y-1" data-testid="catalog-add-results">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border-light bg-surface-card px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-bg"
                data-testid={`catalog-add-result-${item.id}`}
                onClick={() => onPickCatalog(item)}
              >
                <span className="min-w-0 truncate font-medium">{toSentenceCase(item.name)}</span>
                <Chip
                  variant={CATEGORY_CHIP_VARIANT[item.category]}
                  className="flex-shrink-0 text-[10px]"
                >
                  {item.category}
                </Chip>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2 border-t border-border-light bg-bg px-4 py-3">
        <Button
          variant="primary"
          onClick={() => onCreateManual(query)}
          data-testid="catalog-add-create-manual"
        >
          Create manually (not in catalog)
        </Button>
        <Button onClick={onClose} data-testid="catalog-add-cancel">
          Cancel
        </Button>
      </div>
    </AppModal>
  );
}

/* ---------- Duplicate warning dialog ---------- */
function DuplicateWarningDialog({
  open,
  duplicateName,
  existingIngredient,
  onMerge,
  onCancel,
}: {
  open: boolean;
  duplicateName: string;
  existingIngredient: Ingredient | null;
  onMerge: () => void;
  onCancel: () => void;
}) {
  if (!open || !existingIngredient) return null;
  return (
    <AppModal
      open
      onClose={onCancel}
      ariaLabel="Duplicate ingredient warning"
      backdropClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      className="max-w-sm p-6"
      panelTestId="duplicate-warning-dialog"
    >
      <h2 className="mb-2 text-lg font-bold text-text-primary">Duplicate ingredient</h2>
      <p className="mb-4 text-sm text-text-secondary">
        An ingredient named &ldquo;{duplicateName}&rdquo; already exists in your list. Would you
        like to keep the existing one or add a duplicate?
      </p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={onMerge} data-testid="duplicate-merge-btn">
          Keep existing
        </Button>
        <Button onClick={onCancel} data-testid="duplicate-cancel-btn">
          Cancel
        </Button>
      </div>
    </AppModal>
  );
}

/* ---------- Merge confirmation sub-view ---------- */
function MergeConfirmView({
  ingredientA,
  ingredientB,
  refCountA,
  refCountB,
  onConfirm,
  onCancel,
  onIgnoreSuggestion,
}: {
  ingredientA: Ingredient;
  ingredientB: Ingredient;
  refCountA: number;
  refCountB: number;
  onConfirm: (survivorId: string, absorbedId: string) => void;
  onCancel: () => void;
  /** When set, offer “keep both” so this pair stops appearing in duplicate suggestions. */
  onIgnoreSuggestion?: () => void;
}) {
  const autoRulePair = useMemo(
    () => pickMergeSurvivorHeuristic(ingredientA, ingredientB, refCountA, refCountB),
    [ingredientA, ingredientB, refCountA, refCountB],
  );
  const autoRuleSurvivor = autoRulePair.survivor;

  const [survivorId, setSurvivorId] = useState(ingredientA.id);
  const survivor = survivorId === ingredientA.id ? ingredientA : ingredientB;
  const absorbed = survivorId === ingredientA.id ? ingredientB : ingredientA;
  const absorbedRefCount = survivorId === ingredientA.id ? refCountB : refCountA;

  const preview = mergeDuplicateMetadata(survivor, [absorbed]);
  const newTags = preview.tags.filter((t) => !survivor.tags.includes(t));

  return (
    <div data-testid="merge-confirm-view">
      <h3 className="mb-3 text-sm font-bold text-text-primary">Confirm merge</h3>
      <p className="mb-3 text-xs text-text-secondary" data-testid="merge-auto-survivor-hint">
        Bulk duplicate scan would keep &ldquo;{toSentenceCase(autoRuleSurvivor.name)}&rdquo;.
        {survivorId !== autoRuleSurvivor.id ? (
          <span className="text-text-muted">
            {' '}
            You are keeping &ldquo;{toSentenceCase(survivor.name)}&rdquo; — Confirm uses your radio
            choice.
          </span>
        ) : (
          <span className="text-text-muted"> Matches that automatic rule.</span>
        )}
      </p>

      <fieldset className="mb-3" data-testid="merge-survivor-picker">
        <legend className="mb-1.5 text-xs font-medium text-text-secondary">Keep (survivor):</legend>
        <div className="flex flex-col gap-1.5">
          {[ingredientA, ingredientB].map((ing) => (
            <label
              key={ing.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                survivorId === ing.id
                  ? 'border-brand bg-brand/5 font-medium text-text-primary'
                  : 'border-border-light text-text-secondary hover:bg-bg'
              }`}
            >
              <input
                type="radio"
                name="merge-survivor"
                className="accent-brand"
                checked={survivorId === ing.id}
                onChange={() => setSurvivorId(ing.id)}
                data-testid={`merge-survivor-radio-${ing.id}`}
              />
              {toSentenceCase(ing.name)}
              <Chip variant={CATEGORY_CHIP_VARIANT[ing.category]} className="ml-auto text-[10px]">
                {ing.category}
              </Chip>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-3 rounded-md border border-border-light bg-bg px-3 py-2 text-sm">
        <p className="font-medium text-text-primary">
          Merge &ldquo;{toSentenceCase(absorbed.name)}&rdquo; into &ldquo;
          {toSentenceCase(survivor.name)}&rdquo;
        </p>
        <ul className="mt-2 list-disc pl-4 text-text-secondary">
          {newTags.length > 0 && <li>Tags added: {newTags.join(', ')}</li>}
          {!survivor.imageUrl && absorbed.imageUrl && (
            <li>Image inherited from &ldquo;{toSentenceCase(absorbed.name)}&rdquo;</li>
          )}
          {absorbed.freezerFriendly && !survivor.freezerFriendly && (
            <li>Freezer friendly flag applied</li>
          )}
          {absorbed.babySafeWithAdaptation && !survivor.babySafeWithAdaptation && (
            <li>Baby safe flag applied</li>
          )}
          {absorbedRefCount > 0 && (
            <li>
              {absorbedRefCount} reference{absorbedRefCount !== 1 ? 's' : ''} will be remapped
            </li>
          )}
          {newTags.length === 0 &&
            (survivor.imageUrl || !absorbed.imageUrl) &&
            !(absorbed.freezerFriendly && !survivor.freezerFriendly) &&
            !(absorbed.babySafeWithAdaptation && !survivor.babySafeWithAdaptation) &&
            absorbedRefCount === 0 && <li>No additional metadata to merge</li>}
        </ul>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        &ldquo;{toSentenceCase(absorbed.name)}&rdquo; will be removed after merging. This cannot be
        undone.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={() => onConfirm(survivor.id, absorbed.id)}
          data-testid="merge-confirm-btn"
        >
          Confirm merge
        </Button>
        {onIgnoreSuggestion && (
          <Button onClick={onIgnoreSuggestion} data-testid="merge-ignore-suggestion-btn">
            Keep both (ignore)
          </Button>
        )}
        <Button onClick={onCancel} data-testid="merge-cancel-btn">
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ---------- Ingredient edit modal ---------- */
function IngredientModal({
  ingredient,
  isNewIngredient,
  allIngredients,
  householdRef,
  onChange,
  onDelete,
  onDismiss,
  onDone,
  onDuplicateFound,
  onMerge,
}: {
  ingredient: Ingredient;
  isNewIngredient: boolean;
  allIngredients: Ingredient[];
  householdRef: Household | null;
  onChange: (updated: Ingredient) => void;
  onDelete: () => void;
  onDismiss: () => void;
  onDone: () => void;
  onDuplicateFound: (newIng: Ingredient, existing: Ingredient) => void;
  onMerge: (survivorId: string, absorbedId: string) => void;
}) {
  const [tagInput, setTagInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliasCommitError, setAliasCommitError] = useState('');
  const [familyKeyInput, setFamilyKeyInput] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeTarget, setMergeTarget] = useState<Ingredient | null>(null);

  const tagSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const ing of allIngredients) {
      for (const t of ing.tags) {
        set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allIngredients]);
  const duplicates = useMemo(
    () => findNearDuplicates(ingredient.name, allIngredients, ingredient.id),
    [ingredient.name, allIngredients, ingredient.id],
  );

  const aliasValidation = useMemo(() => {
    const canon = normalizeIngredientName(ingredient.name);
    return validateIngredientAliases({ ...ingredient, name: canon }, allIngredients);
  }, [ingredient, allIngredients]);

  const catalogDefaultImageUrl = useMemo(
    () => getCatalogDefaultImageUrl(ingredient),
    [ingredient.catalogId],
  );
  const effectiveImageUrl = useMemo(
    () => resolveIngredientImageUrl(ingredient),
    [ingredient.imageUrl, ingredient.catalogId],
  );

  const mergeResults = useMemo(() => {
    if (!mergeMode || !mergeSearch.trim()) return [];
    const q = mergeSearch.trim();
    return allIngredients
      .filter((i) => i.id !== ingredient.id && ingredientMatchesQuery(i, q))
      .slice(0, 8);
  }, [mergeMode, mergeSearch, allIngredients, ingredient.id]);

  const handleMergeResultSelect = useCallback(
    (index: number) => {
      setMergeTarget(mergeResults[index]!);
    },
    [mergeResults],
  );
  const handleMergeSearchCancel = useCallback(() => {
    setMergeMode(false);
    setMergeSearch('');
  }, []);
  const mergeKeyNav = useListKeyNav(mergeResults.length, handleMergeResultSelect, {
    onEscape: handleMergeSearchCancel,
  });

  const mergeRefCounts = useMemo(() => {
    if (!mergeTarget || !householdRef) return { current: 0, target: 0 };
    const refs = findIngredientReferences(new Set([ingredient.id, mergeTarget.id]), householdRef);
    return {
      current: refs.get(ingredient.id)?.length ?? 0,
      target: refs.get(mergeTarget.id)?.length ?? 0,
    };
  }, [mergeTarget, householdRef, ingredient.id]);

  const familyKeySuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const ing of allIngredients) {
      for (const fk of ing.familyKeys ?? []) {
        set.add(fk);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allIngredients]);

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || ingredient.tags.includes(trimmed)) return;
    onChange({ ...ingredient, tags: [...ingredient.tags, trimmed] });
    setTagInput('');
  }

  function removeTag(tag: string) {
    onChange({ ...ingredient, tags: ingredient.tags.filter((t) => t !== tag) });
  }

  function addFamilyKey(key: string) {
    const normalized = key.trim().toLowerCase();
    if (!normalized) return;
    const current = ingredient.familyKeys ?? [];
    if (current.includes(normalized)) return;
    onChange({ ...ingredient, familyKeys: [...current, normalized] });
    setFamilyKeyInput('');
  }

  function removeFamilyKey(key: string) {
    onChange({ ...ingredient, familyKeys: (ingredient.familyKeys ?? []).filter((k) => k !== key) });
  }

  function commitAlias() {
    const canon = normalizeIngredientName(ingredient.name);
    const a = normalizeIngredientName(aliasInput);
    if (!a || a === canon) {
      setAliasInput('');
      setAliasCommitError('');
      return;
    }
    const list = [...(ingredient.aliases ?? [])];
    if (list.some((x) => normalizeIngredientName(x) === a)) {
      setAliasInput('');
      setAliasCommitError('');
      return;
    }
    const trial: Ingredient = { ...ingredient, name: canon, aliases: [...list, a] };
    const v = validateIngredientAliases(trial, allIngredients);
    if (v.blockingReason) {
      setAliasCommitError(v.blockingReason);
      return;
    }
    setAliasCommitError('');
    onChange(trial);
    setAliasInput('');
  }

  function removeAlias(alias: string) {
    const norm = normalizeIngredientName(alias);
    onChange({
      ...ingredient,
      aliases: (ingredient.aliases ?? []).filter((x) => normalizeIngredientName(x) !== norm),
    });
  }

  function handleModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (aliasValidation.blockingReason || aliasCommitError) return;
    if (duplicates.length > 0) {
      onDuplicateFound(ingredient, duplicates[0]!);
    } else {
      onDone();
    }
  }

  return (
    <AppModal
      open
      onClose={onDismiss}
      ariaLabel="Edit ingredient"
      className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-0 sm:p-0"
      panelTestId="ingredient-modal"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-light bg-surface px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {toSentenceCase(ingredient.name) || 'New ingredient'}
          </h2>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider" data-testid="ingredient-source-label">
            {ingredient.source === 'catalog' ? 'From catalog' : 'Manual'}
          </span>
        </div>
        <Button variant="ghost" onClick={onDismiss} aria-label="Close modal" className="h-8 w-8 rounded-full p-0 flex items-center justify-center bg-bg hover:bg-border-light">
          ✕
        </Button>
      </div>

      <div className="p-6">
        {duplicates.length > 0 && (
          <div
            className="mb-6 flex items-start gap-3 rounded-lg border border-warning bg-warning/10 p-4 text-sm text-text-primary"
            data-testid="duplicate-inline-warning"
          >
            <span className="text-warning">⚠️</span>
            <div>
              <p className="font-medium">Possible duplicate</p>
              <p className="text-text-secondary">A similar ingredient &ldquo;{duplicates[0]!.name}&rdquo; already exists in your list.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleModalSubmit}>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <FieldLabel label="Name">
                <Input
                  type="text"
                  value={ingredient.name}
                  onChange={(e) => onChange({ ...ingredient, name: e.target.value })}
                  placeholder="e.g. Cherry tomatoes"
                  required
                  className="text-lg"
                  data-testid="modal-ingredient-name"
                />
              </FieldLabel>

              <FieldLabel label="Category">
                <Select
                  value={ingredient.category}
                  onChange={(e) =>
                    onChange({ ...ingredient, category: e.target.value as IngredientCategory })
                  }
                  data-testid="modal-ingredient-category"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {toSentenceCase(c)}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <div>
                <span className="mb-1 block text-sm font-medium text-text-secondary">Also matches</span>
                <p className="mb-3 text-xs text-text-muted">
                  Used for recipe import and search. Example: cilantro, fresh coriander.
                </p>
                
                {(aliasValidation.blockingReason || aliasCommitError) && (
                  <div
                    className="mb-3 rounded-md border border-danger bg-conflict-bg px-3 py-2 text-sm text-conflict-text"
                    data-testid="alias-blocking-error"
                    role="alert"
                  >
                    {aliasCommitError || aliasValidation.blockingReason}
                  </div>
                )}
                {aliasValidation.warnings.length > 0 && (
                  <div
                    className="mb-3 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-text-primary"
                    data-testid="alias-warnings"
                  >
                    <ul className="list-disc pl-4">
                      {aliasValidation.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2 mb-3" data-testid="ingredient-alias-list">
                  {(ingredient.aliases ?? []).map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-md bg-bg border border-border-light px-2 py-1 text-sm">
                      {toSentenceCase(a)}
                      <button
                        type="button"
                        aria-label={`Remove alias ${a}`}
                        data-testid={`alias-remove-${a.replace(/\s+/g, '-')}`}
                        onClick={() => removeAlias(a)}
                        className="ml-1 text-text-muted hover:text-danger"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={aliasInput}
                    onChange={(e) => {
                      setAliasInput(e.target.value);
                      setAliasCommitError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitAlias();
                      }
                    }}
                    placeholder="Add alternate name..."
                    className="flex-1"
                    data-testid="alias-add-input"
                  />
                  <Button type="button" onClick={commitAlias} data-testid="alias-add-btn">
                    Add
                  </Button>
                </div>
              </div>

              <div>
                <span className="mb-3 block text-sm font-medium text-text-secondary">Properties</span>
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 transition-colors hover:bg-bg">
                    <div className="flex h-5 items-center">
                        <input
                        type="checkbox"
                        aria-label="Freezer friendly"
                        className="h-4 w-4 rounded border-gray-300 accent-brand"
                        checked={ingredient.freezerFriendly}
                        onChange={(e) => onChange({ ...ingredient, freezerFriendly: e.target.checked })}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">Freezer friendly</span>
                      <span className="text-xs text-text-muted">Can be stored in the freezer for later use</span>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 transition-colors hover:bg-bg">
                    <div className="flex h-5 items-center">
                        <input
                        type="checkbox"
                        aria-label="Baby safe with adaptation"
                        className="h-4 w-4 rounded border-gray-300 accent-brand"
                        checked={ingredient.babySafeWithAdaptation}
                        onChange={(e) =>
                          onChange({ ...ingredient, babySafeWithAdaptation: e.target.checked })
                        }
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">Baby safe with adaptation</span>
                      <span className="text-xs text-text-muted">Safe for babies with adaptation</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column: Organization & Image */}
            <div className="space-y-6">
              <div>
                <span className="mb-1 block text-sm font-medium text-text-secondary">Image</span>
                <p className="mb-3 text-xs text-text-muted">
                  Linked catalog entries can supply a default image. Set a URL or upload only when you
                  want a custom household image.
                </p>
                
                <div className="rounded-lg border border-border-light bg-surface p-4">
                  <div className="flex items-start gap-4">
                    {effectiveImageUrl ? (
                      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-border-light bg-bg">
                        <img
                          src={effectiveImageUrl}
                          alt={ingredient.name || 'Ingredient'}
                          loading="lazy"
                          className="h-20 w-20 object-cover rounded-md"
                          data-testid={
                            ingredient.imageUrl
                              ? 'ingredient-image-preview'
                              : 'ingredient-catalog-image-preview'
                          }
                        />
                        {ingredient.imageUrl && (
                          <button
                            type="button"
                            onClick={() => onChange({ ...ingredient, imageUrl: undefined })}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                            title="Remove custom image"
                            data-testid="ingredient-remove-custom-image"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border-default bg-bg text-text-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      </div>
                    )}
                    
                    <div className="flex flex-1 flex-col gap-2">
                      <Input
                        type="url"
                        value={ingredient.imageUrl ?? ''}
                        onChange={(e) => onChange({ ...ingredient, imageUrl: e.target.value || undefined })}
                        placeholder="Image URL"
                        className="h-9 text-sm"
                        data-testid="ingredient-image-url"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">or</span>
                        <label className="cursor-pointer text-sm font-medium text-brand hover:underline">
                          Upload file
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            data-testid="ingredient-image-upload"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                onChange({ ...ingredient, imageUrl: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                      
                      {!ingredient.imageUrl && catalogDefaultImageUrl && (
                        <span className="mt-1 text-[10px] font-medium text-success" data-testid="ingredient-catalog-image-label">
                          From catalog (default)
                        </span>
                      )}
                      {ingredient.imageUrl && (
                        <span className="mt-1 text-[10px] font-medium text-brand" data-testid="ingredient-custom-image-label">
                          Custom household image
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-text-secondary">Tags</span>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {ingredient.tags.map((tag) => (
                    <span
                      key={tag}
                      data-testid={`tag-${tag}`}
                      className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-info-text"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:text-info-text/70">x</button>
                    </span>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {COMMON_TAGS.filter((t) => !ingredient.tags.includes(t)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full border border-border-light bg-surface px-2.5 py-1 text-xs text-text-secondary hover:border-info hover:text-info"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <TagSuggestInput
                    mode="single"
                    value={tagInput}
                    onChange={setTagInput}
                    suggestions={tagSuggestions}
                    exclude={new Set(ingredient.tags)}
                    placeholder="Custom tag"
                    className="flex-1"
                    onPick={(tag) => addTag(tag)}
                    onSubmitPlain={() => addTag(tagInput)}
                  />
                  <Button type="button" onClick={() => addTag(tagInput)}>
                    Add tag
                  </Button>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-text-secondary">
                  Ingredient families
                </span>
                <p className="mb-3 text-xs text-text-muted">
                  Planner preference grouping (e.g. &quot;sausage&quot;, &quot;pasta&quot;). Not tags or
                  aliases.
                </p>
                <div className="mb-3 flex flex-wrap gap-1.5" data-testid="ingredient-family-key-list">
                  {(ingredient.familyKeys ?? []).map((fk) => (
                    <span key={fk} className="inline-flex items-center gap-1 rounded-md bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning-text">
                      {fk}
                      <button
                        type="button"
                        aria-label={`Remove family key ${fk}`}
                        data-testid={`family-key-remove-${fk}`}
                        onClick={() => removeFamilyKey(fk)}
                        className="ml-0.5 hover:text-warning-text/70"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <TagSuggestInput
                    mode="single"
                    value={familyKeyInput}
                    onChange={setFamilyKeyInput}
                    suggestions={familyKeySuggestions}
                    exclude={new Set(ingredient.familyKeys ?? [])}
                    placeholder="Add family key..."
                    className="flex-1"
                    data-testid="family-key-add-input"
                    onPick={(key) => addFamilyKey(key)}
                    onSubmitPlain={() => addFamilyKey(familyKeyInput)}
                  />
                  <Button
                    type="button"
                    onClick={() => addFamilyKey(familyKeyInput)}
                    data-testid="family-key-add-btn"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Merge section */}
          {!isNewIngredient && (
            <div className="mt-8 rounded-lg border border-border-light bg-bg p-4" data-testid="merge-section">
              {mergeTarget ? (
                <MergeConfirmView
                  key={`${ingredient.id}-${mergeTarget.id}`}
                  ingredientA={ingredient}
                  ingredientB={mergeTarget}
                  refCountA={mergeRefCounts.current}
                  refCountB={mergeRefCounts.target}
                  onConfirm={(survivorId, absorbedId) => {
                    onMerge(survivorId, absorbedId);
                    setMergeTarget(null);
                    setMergeMode(false);
                    setMergeSearch('');
                  }}
                  onCancel={() => setMergeTarget(null)}
                />
              ) : mergeMode ? (
                <div data-testid="merge-search-panel">
                  <div className="mb-3 flex items-center gap-2">
                    <Input
                      type="search"
                      value={mergeSearch}
                      onChange={(e) => {
                        setMergeSearch(e.target.value);
                        mergeKeyNav.setActiveIndex(-1);
                      }}
                      onKeyDown={mergeKeyNav.onKeyDown}
                      placeholder="Search ingredient to merge in..."
                      data-testid="merge-search-input"
                      autoFocus
                      className="flex-1"
                    />
                    <Button onClick={handleMergeSearchCancel} data-testid="merge-search-cancel">
                      Cancel
                    </Button>
                  </div>
                  {mergeSearch.trim() && mergeResults.length === 0 && (
                    <p className="text-sm text-text-muted">No matching ingredients found.</p>
                  )}
                  {mergeResults.length > 0 && (
                    <ul
                      ref={mergeKeyNav.listRef as React.RefObject<HTMLUListElement>}
                      className="max-h-48 overflow-y-auto rounded-md border border-border-light bg-surface"
                      data-testid="merge-search-results"
                    >
                      {mergeResults.map((r, i) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                              mergeKeyNav.activeIndex === i
                                ? 'bg-brand/5 text-brand'
                                : 'hover:bg-bg'
                            }`}
                            onClick={() => setMergeTarget(r)}
                            onMouseEnter={() => mergeKeyNav.setActiveIndex(i)}
                            data-testid={`merge-result-${r.id}`}
                          >
                            <span className="flex-1 truncate font-medium">
                              {toSentenceCase(r.name)}
                            </span>
                            <Chip variant={CATEGORY_CHIP_VARIANT[r.category]} className="text-[10px]">
                              {r.category}
                            </Chip>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-text-primary">Merge ingredients</h4>
                    <p className="text-xs text-text-muted">Combine this ingredient with another one</p>
                  </div>
                  <Button onClick={() => setMergeMode(true)} data-testid="merge-open-btn">
                    Merge...
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-8 flex items-center justify-between border-t border-border-light pt-6">
            {isNewIngredient ? (
              <span />
            ) : (
              <Button variant="danger" type="button" onClick={onDelete} data-testid="delete-ingredient-btn">
                Delete ingredient
              </Button>
            )}
            <div className="flex gap-3">
              <Button variant="default" type="button" onClick={onDismiss}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" data-testid="ingredient-modal-done" className="px-8">
                Done
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppModal>
  );
}

/* ---------- Bulk delete confirmation dialog ---------- */
function BulkDeleteConfirmDialog({
  open,
  selectedIngredients,
  referencedMap,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  selectedIngredients: Ingredient[];
  referencedMap: Map<string, IngredientReference[]>;
  onConfirm: (idsToDelete: string[]) => void;
  onCancel: () => void;
}) {
  if (!open || selectedIngredients.length === 0) return null;

  const unreferenced = selectedIngredients.filter((i) => !referencedMap.has(i.id));
  const referenced = selectedIngredients.filter((i) => referencedMap.has(i.id));
  const allReferenced = unreferenced.length === 0;
  const someReferenced = referenced.length > 0 && unreferenced.length > 0;
  const noneReferenced = referenced.length === 0;

  const sampleNames = selectedIngredients
    .slice(0, 5)
    .map((i) => toSentenceCase(i.name) || 'Unnamed');
  const remaining = selectedIngredients.length - sampleNames.length;

  return (
    <AppModal
      open
      onClose={onCancel}
      ariaLabel="Bulk delete confirmation"
      className="max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
      panelTestId="bulk-delete-dialog"
    >
      <h2 className="mb-2 text-lg font-bold text-text-primary">Delete ingredients</h2>

      <p className="mb-3 text-sm text-text-secondary">
        {noneReferenced
          ? `Delete ${selectedIngredients.length} selected ingredient${selectedIngredients.length !== 1 ? 's' : ''}? This cannot be undone.`
          : someReferenced
            ? `${referenced.length} of ${selectedIngredients.length} selected ingredient${selectedIngredients.length !== 1 ? 's' : ''} ${referenced.length !== 1 ? 'are' : 'is'} used by meals, recipes, or plans and cannot be deleted.`
            : `All ${selectedIngredients.length} selected ingredient${selectedIngredients.length !== 1 ? 's' : ''} ${selectedIngredients.length !== 1 ? 'are' : 'is'} used by meals, recipes, or plans and cannot be deleted.`}
      </p>

      <div
        className="mb-4 rounded-md border border-border-light bg-bg px-3 py-2"
        data-testid="bulk-delete-sample-names"
      >
        <ul className="list-disc pl-4 text-sm text-text-primary">
          {sampleNames.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
        {remaining > 0 && <p className="mt-1 text-xs text-text-muted">and {remaining} more...</p>}
      </div>

      {referenced.length > 0 && (
        <div
          className="mb-4 rounded-md border border-warning bg-warning/10 px-3 py-2"
          data-testid="bulk-delete-protected-warning"
        >
          <p className="mb-1 text-sm font-medium text-text-primary">
            Protected ingredients ({referenced.length}):
          </p>
          <ul className="list-disc pl-4 text-sm text-text-secondary">
            {referenced.slice(0, 5).map((ing) => {
              const refs = referencedMap.get(ing.id) ?? [];
              const refSummary = [...new Set(refs.map((r) => r.entityName))].slice(0, 2).join(', ');
              return (
                <li key={ing.id}>
                  {toSentenceCase(ing.name)} &mdash; used in {refSummary}
                  {refs.length > 2 ? ` and ${refs.length - 2} more` : ''}
                </li>
              );
            })}
          </ul>
          {referenced.length > 5 && (
            <p className="mt-1 text-xs text-text-muted">
              and {referenced.length - 5} more protected...
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {allReferenced ? (
          <Button onClick={onCancel}>Close</Button>
        ) : (
          <>
            <Button
              variant="danger"
              onClick={() => onConfirm(unreferenced.map((i) => i.id))}
              data-testid="bulk-delete-confirm-btn"
            >
              {someReferenced
                ? `Delete ${unreferenced.length} unreferenced`
                : `Delete ${selectedIngredients.length}`}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </>
        )}
      </div>
    </AppModal>
  );
}

/* ---------- Ingredient row (desktop table / mobile card) ---------- */
function IngredientTableRow({
  ingredient,
  selected,
  onToggleSelect,
  onClick,
}: {
  ingredient: Ingredient;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  const rowImageUrl = resolveIngredientImageUrl(ingredient);
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-md border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card min-h-[48px] cursor-pointer ${
        selected ? 'border-brand bg-brand/5' : 'border-border-light'
      }`}
      data-testid={`ingredient-row-${ingredient.id}`}
      aria-label={`Edit ${
        ingredient.name.trim() ? toSentenceCase(ingredient.name) : 'unnamed ingredient'
      }`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <label
        className="flex flex-shrink-0 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand cursor-pointer"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          aria-label={`Select ${
            ingredient.name.trim() ? toSentenceCase(ingredient.name) : 'unnamed ingredient'
          }`}
          data-testid={`ingredient-select-${ingredient.id}`}
        />
      </label>

      {/* Content area */}
      <span className="flex flex-1 items-center gap-3 min-w-0 text-left">
        {/* Thumbnail */}
        {rowImageUrl ? (
          <img
            src={rowImageUrl}
            alt=""
            loading="lazy"
            className="h-8 w-8 flex-shrink-0 rounded object-cover border border-border-light hidden sm:block"
            data-testid={`ingredient-list-thumb-${ingredient.id}`}
          />
        ) : (
          <span className="h-8 w-8 flex-shrink-0 hidden sm:block" />
        )}

        {/* Name */}
        <span className="flex flex-1 min-w-0 items-center sm:flex-[2] self-center gap-1.5">
          <span className="block text-sm font-medium leading-tight text-text-primary truncate">
            {ingredient.name ? (
              toSentenceCase(ingredient.name)
            ) : (
              <span className="italic text-text-muted">Unnamed</span>
            )}
          </span>
          {(ingredient.aliases?.length ?? 0) > 0 && (
            <span
              className="flex-shrink-0 text-[10px] text-text-muted hidden sm:inline"
              data-testid={`ingredient-row-alias-hint-${ingredient.id}`}
              title={(ingredient.aliases ?? []).map((a) => toSentenceCase(a)).join(', ')}
            >
              +{ingredient.aliases!.length} alt
            </span>
          )}
          {/* Mobile: category + tags inline below name */}
          <span className="flex flex-wrap items-center gap-1 mt-0.5 sm:hidden">
            <Chip
              variant={CATEGORY_CHIP_VARIANT[ingredient.category]}
              className="text-[10px] leading-none"
            >
              {ingredient.category}
            </Chip>
            {ingredient.tags.slice(0, 2).map((tag) => (
              <Chip key={tag} variant="info" className="text-[10px] leading-none">
                {tag}
              </Chip>
            ))}
            {ingredient.tags.length > 2 && (
              <span className="text-[10px] text-text-muted">+{ingredient.tags.length - 2}</span>
            )}
          </span>
        </span>

        {/* Desktop columns */}
        <span className="hidden sm:flex sm:flex-1 sm:items-center sm:gap-1 sm:self-center">
          <Chip
            variant={CATEGORY_CHIP_VARIANT[ingredient.category]}
            className="text-[10px] leading-none"
          >
            {ingredient.category}
          </Chip>
        </span>

        <span className="hidden sm:flex sm:flex-1 sm:flex-wrap sm:items-center sm:gap-1 sm:min-w-0 sm:self-center">
          {ingredient.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} variant="info" className="text-[10px] leading-none">
              {tag}
            </Chip>
          ))}
          {ingredient.tags.length > 3 && (
            <span className="text-[10px] leading-none text-text-muted">
              +{ingredient.tags.length - 3}
            </span>
          )}
        </span>

        {/* Flags */}
        <span className="flex w-16 flex-shrink-0 items-center justify-center gap-1.5 self-center">
          {ingredient.freezerFriendly && (
            <Chip variant="info" className="text-[10px] leading-none" title="Freezer friendly">
              ❄️
            </Chip>
          )}
          {ingredient.babySafeWithAdaptation && (
            <Chip variant="success" className="text-[10px] leading-none" title="Baby safe">
              🍼
            </Chip>
          )}
        </span>
      </span>
    </button>
  );
}

/** Page buttons for large lists: current ± siblingCount, plus first/last with ellipses when needed. */
function paginationPageNumbers(
  page: number,
  totalPages: number,
  siblingCount: number,
): (number | 'ellipsis')[] {
  const showAllThreshold = 11;
  if (totalPages <= showAllThreshold) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const result: (number | 'ellipsis')[] = [];
  const left = Math.max(2, page - siblingCount);
  const right = Math.min(totalPages - 1, page + siblingCount);

  result.push(1);
  if (left > 2) {
    result.push('ellipsis');
  }
  for (let i = left; i <= right; i++) {
    result.push(i);
  }
  if (right < totalPages - 1) {
    result.push('ellipsis');
  }
  result.push(totalPages);
  return result;
}

/* ---------- Pagination controls ---------- */
function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const [goToDraft, setGoToDraft] = useState('');

  const pages = useMemo(() => paginationPageNumbers(page, totalPages, 2), [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div
      className="flex flex-col items-center gap-3 pt-4 sm:flex-row sm:flex-wrap sm:justify-center"
      data-testid="pagination-controls"
    >
      <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
        <Button
          small
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="First page"
          data-testid="pagination-first"
        >
          ««
        </Button>
        <Button
          small
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          data-testid="pagination-prev"
        >
          «
        </Button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1 text-sm text-text-muted">
              …
            </span>
          ) : (
            <Button
              key={p}
              small
              variant={p === page ? 'primary' : 'default'}
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              data-testid={`pagination-page-${p}`}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          small
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          data-testid="pagination-next"
        >
          »
        </Button>
        <Button
          small
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Last page"
          data-testid="pagination-last"
        >
          »»
        </Button>
      </nav>

      <form
        className="flex items-center gap-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number.parseInt(goToDraft.trim(), 10);
          if (!Number.isFinite(n)) return;
          onPageChange(Math.min(Math.max(1, n), totalPages));
          setGoToDraft('');
        }}
      >
        <Input
          type="number"
          min={1}
          max={totalPages}
          inputMode="numeric"
          value={goToDraft}
          onChange={(e) => setGoToDraft(e.target.value)}
          placeholder={`1–${totalPages}`}
          aria-label="Go to page number"
          className="h-8 w-[4.5rem] py-0 text-center text-sm"
          data-testid="pagination-go-to-input"
        />
        <Button
          type="submit"
          small
          aria-label="Go to entered page"
          data-testid="pagination-go-to-submit"
        >
          Go
        </Button>
      </form>
    </div>
  );
}

/* ---------- Main component ---------- */
export default function IngredientManager() {
  const { householdId } = useParams<{ householdId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const prevHouseholdIdForPaginationRef = useRef<string | undefined>(undefined);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<IngredientCategory | ''>('');
  const [tagFilter, setTagFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('');
  const [ingredientSort, setIngredientSort] = useState(INGREDIENT_SORT_OPTIONS[0]!.value);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    newIngredient: Ingredient;
    existingIngredient: Ingredient;
  } | null>(null);
  /** In-memory draft for Add ingredient — not persisted until Done */
  const [draftNewIngredient, setDraftNewIngredient] = useState<Ingredient | null>(null);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Household ref for reference checking
  const [householdRef, setHouseholdRef] = useState<Household | null>(null);
  /** F070: Add ingredient opens catalog search before the edit modal */
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [dismissVersion, setDismissVersion] = useState(0);
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [mergeReviewSelectedKeys, setMergeReviewSelectedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkMergeConfirmOpen, setBulkMergeConfirmOpen] = useState(false);
  /** `null` = user has not run a scan since load / last ingredient change. */
  const [duplicateScanPairs, setDuplicateScanPairs] = useState<
    IngredientMergePairSuggestion[] | null
  >(null);

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients([...household.ingredients]);
      setHouseholdName(household.name);
      setHouseholdRef(household);
    }
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    if (!loaded || !householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.ingredients = sanitizeIngredientAliasesAgainstHousehold(ingredients);
    saveHousehold(household);
    setHouseholdRef(household);
  }, [loaded, householdId, ingredients]);

  const dismissedMergeKeys = useMemo(() => {
    if (!householdId) return new Set<string>();
    return loadDismissedMergePairKeys(householdId);
  }, [householdId, dismissVersion]);

  useEffect(() => {
    setDuplicateScanPairs(null);
  }, [householdId]);

  /** Pairs from last scan that still exist (drops absorbed ids after merges without re-scanning). */
  const duplicateScanPairsActive = useMemo(() => {
    if (!duplicateScanPairs) return [];
    const idSet = new Set(ingredients.map((i) => i.id));
    return duplicateScanPairs.filter(
      (s) => idSet.has(s.ingredientA.id) && idSet.has(s.ingredientB.id),
    );
  }, [duplicateScanPairs, ingredients]);

  const mergePairSuggestionsVisible = useMemo(
    () =>
      duplicateScanPairsActive.filter(
        (s) => !dismissedMergeKeys.has(mergePairKey(s.ingredientA.id, s.ingredientB.id)),
      ),
    [duplicateScanPairsActive, dismissedMergeKeys],
  );

  const runDuplicateScan = useCallback(() => {
    setDuplicateScanPairs(suggestIngredientMergePairs(ingredients, { minScore: 0.55, limit: 200 }));
  }, [ingredients]);

  const mergeDuplicateReviewSelectState = useMemo(() => {
    const n = mergePairSuggestionsVisible.length;
    if (n === 0) return { all: false, some: false };
    let selected = 0;
    for (const s of mergePairSuggestionsVisible) {
      if (mergeReviewSelectedKeys.has(mergePairKey(s.ingredientA.id, s.ingredientB.id))) {
        selected++;
      }
    }
    return { all: selected === n, some: selected > 0 && selected < n };
  }, [mergePairSuggestionsVisible, mergeReviewSelectedKeys]);

  /** Ingredient id bulk “Merge selected” would keep (catalog over refs over name). */
  const mergeReviewBulkSurvivorIdByPairKey = useMemo(() => {
    if (!householdRef || mergePairSuggestionsVisible.length === 0) return new Map<string, string>();
    const ids = new Set<string>();
    for (const s of mergePairSuggestionsVisible) {
      ids.add(s.ingredientA.id);
      ids.add(s.ingredientB.id);
    }
    const refMap = findIngredientReferences(ids, householdRef);
    const out = new Map<string, string>();
    for (const s of mergePairSuggestionsVisible) {
      const pk = mergePairKey(s.ingredientA.id, s.ingredientB.id);
      const ra = refMap.get(s.ingredientA.id)?.length ?? 0;
      const rb = refMap.get(s.ingredientB.id)?.length ?? 0;
      const { survivor } = pickMergeSurvivorHeuristic(s.ingredientA, s.ingredientB, ra, rb);
      out.set(pk, survivor.id);
    }
    return out;
  }, [householdRef, mergePairSuggestionsVisible]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    ingredients.forEach((ing) => ing.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (searchQuery) {
        if (!ingredientMatchesQuery(ing, searchQuery)) return false;
      }
      if (categoryFilter && ing.category !== categoryFilter) return false;
      if (tagFilter && !ing.tags.includes(tagFilter)) return false;
      if (sourceFilter) {
        const s = ing.source ?? 'manual';
        if (s !== sourceFilter) return false;
      }
      return true;
    });
  }, [ingredients, searchQuery, categoryFilter, tagFilter, sourceFilter]);

  const sortedIngredients = useMemo(() => {
    const opt =
      INGREDIENT_SORT_OPTIONS.find((o) => o.value === ingredientSort) ??
      INGREDIENT_SORT_OPTIONS[0]!;
    return sortIngredients(filteredIngredients, opt.key, opt.dir);
  }, [filteredIngredients, ingredientSort]);

  const paginationResetDepsStr = useMemo(
    () => JSON.stringify([searchQuery, categoryFilter, tagFilter, sourceFilter, ingredientSort]),
    [searchQuery, categoryFilter, tagFilter, sourceFilter, ingredientSort],
  );

  const urlPageFromUrl = useMemo(() => parseIngredientListPage(searchParams), [searchParams]);
  const pageSize = useMemo(
    () => parseIngredientListPerPage(searchParams) ?? DEFAULT_PAGE_SIZE,
    [searchParams],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedIngredients.length / pageSize)),
    [sortedIngredients.length, pageSize],
  );

  const page = Math.min(Math.max(1, urlPageFromUrl), totalPages);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedIngredients.slice(start, start + pageSize);
  }, [sortedIngredients, page, pageSize]);

  const setPage = useCallback(
    (p: number) => {
      const next = Math.max(1, Math.min(p, totalPages));
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (next <= 1) n.delete('page');
          else n.set('page', String(next));
          return n.toString() === prev.toString() ? prev : n;
        },
        { replace: true },
      );
    },
    [totalPages, setSearchParams],
  );

  const setPageSize = useCallback(
    (size: PageSize) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('page');
          if (size === DEFAULT_PAGE_SIZE) n.delete('perPage');
          else n.set('perPage', String(size));
          return n.toString() === prev.toString() ? prev : n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const paginationResetSkipFirst = useRef(true);
  useEffect(() => {
    if (paginationResetSkipFirst.current) {
      paginationResetSkipFirst.current = false;
      return;
    }
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (!n.has('page')) return prev;
        n.delete('page');
        return n;
      },
      { replace: true },
    );
  }, [paginationResetDepsStr]);

  useLayoutEffect(() => {
    if (urlPageFromUrl === page) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (page <= 1) next.delete('page');
        else next.set('page', String(page));
        return next.toString() === prev.toString() ? prev : next;
      },
      { replace: true },
    );
  }, [page, urlPageFromUrl]);

  useEffect(() => {
    if (!householdId) return;
    const prev = prevHouseholdIdForPaginationRef.current;
    prevHouseholdIdForPaginationRef.current = householdId;
    if (prev === undefined || prev === householdId) return;
    setSearchParams(
      (prevParams) => {
        const n = new URLSearchParams(prevParams);
        if (!n.has('page')) return prevParams;
        n.delete('page');
        return n;
      },
      { replace: true },
    );
  }, [householdId]);

  const editingIngredient =
    draftNewIngredient ??
    (editingId ? (ingredients.find((ing) => ing.id === editingId) ?? null) : null);

  function addIngredient() {
    setEditingId(null);
    setDraftNewIngredient(null);
    setCatalogPickerOpen(true);
  }

  function pickCatalogItemForAdd(item: CatalogIngredient) {
    setCatalogPickerOpen(false);
    setEditingId(null);
    setDraftNewIngredient(catalogIngredientToHousehold(item));
  }

  function startManualIngredientFromPicker(searchText: string) {
    setCatalogPickerOpen(false);
    setEditingId(null);
    const draft = createEmptyIngredient();
    const trimmed = searchText.trim();
    if (trimmed) {
      draft.name = toSentenceCase(trimmed);
    }
    setDraftNewIngredient(draft);
  }

  function updateIngredient(updated: Ingredient) {
    setIngredients((prev) => prev.map((ing) => (ing.id === updated.id ? updated : ing)));
  }

  function handleModalChange(updated: Ingredient) {
    if (draftNewIngredient && updated.id === draftNewIngredient.id) {
      setDraftNewIngredient(updated);
    } else {
      updateIngredient(updated);
    }
  }

  function dismissIngredientModal() {
    if (draftNewIngredient) {
      setDraftNewIngredient(null);
      return;
    }
    if (editingIngredient?.name) {
      const normalized = normalizeIngredientForStorage(editingIngredient);
      updateIngredient(normalized);
    }
    setEditingId(null);
  }

  function doneIngredientModal() {
    if (draftNewIngredient) {
      const ing = draftNewIngredient;
      const normalized = normalizeIngredientForStorage(ing);
      if (!normalized.name.trim()) {
        setDraftNewIngredient(null);
        return;
      }
      const v = validateIngredientAliases(normalized, ingredients);
      if (v.blockingReason) return;
      setIngredients((prev) => [...prev, normalized]);
      setDraftNewIngredient(null);
      return;
    }
    if (editingIngredient) {
      if (editingIngredient.name) {
        const normalized = normalizeIngredientForStorage(editingIngredient);
        const v = validateIngredientAliases(
          normalized,
          ingredients.map((i) => (i.id === normalized.id ? normalized : i)),
        );
        if (v.blockingReason) return;
        updateIngredient(normalized);
      }
      setEditingId(null);
    }
  }

  function removeIngredient(ingredientId: string) {
    const ing = ingredients.find((i) => i.id === ingredientId);
    const displayName = ing?.name.trim() ? toSentenceCase(ing.name) : 'this ingredient';
    requestConfirm(displayName, () => {
      setIngredients((prev) => prev.filter((item) => item.id !== ingredientId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(ingredientId);
        return next;
      });
      setEditingId(null);
    });
  }

  const handleMerge = useCallback(
    (survivorId: string, absorbedId: string, options?: { focusSurvivorInEditor?: boolean }) => {
      if (!householdId) return;
      const survivor = ingredients.find((i) => i.id === survivorId);
      const absorbed = ingredients.find((i) => i.id === absorbedId);
      if (!survivor || !absorbed) return;

      const merged = mergeDuplicateMetadata(survivor, [absorbed]);
      const household = loadHousehold(householdId);
      if (!household) return;

      const idRemap = new Map([[absorbed.id, survivor.id]]);
      remapIngredientReferences(household, idRemap);

      household.ingredients = household.ingredients
        .map((i) => (i.id === survivor.id ? merged : i))
        .filter((i) => i.id !== absorbed.id);
      saveHousehold(household);

      setIngredients([...household.ingredients]);
      setHouseholdRef(household);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(absorbed.id);
        return next;
      });
      if (options?.focusSurvivorInEditor ?? true) {
        setEditingId(merged.id);
      } else {
        setEditingId(null);
      }
    },
    [householdId, ingredients],
  );

  const applySequentialMergesToHousehold = useCallback(
    (ops: Array<{ survivorId: string; absorbedId: string }>) => {
      if (!householdId) return 0;
      const household = loadHousehold(householdId);
      if (!household) return 0;
      let applied = 0;
      for (const { survivorId, absorbedId } of ops) {
        const survivor = household.ingredients.find((i) => i.id === survivorId);
        const absorbed = household.ingredients.find((i) => i.id === absorbedId);
        if (!survivor || !absorbed) continue;
        const merged = mergeDuplicateMetadata(survivor, [absorbed]);
        remapIngredientReferences(household, new Map([[absorbedId, survivorId]]));
        household.ingredients = household.ingredients
          .map((i) => (i.id === survivorId ? merged : i))
          .filter((i) => i.id !== absorbedId);
        applied += 1;
      }
      if (applied === 0) return 0;
      saveHousehold(household);
      setIngredients([...household.ingredients]);
      setHouseholdRef(household);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const op of ops) next.delete(op.absorbedId);
        return next;
      });
      return applied;
    },
    [householdId],
  );

  const openDuplicateReview = useCallback(() => {
    setMergeReviewSelectedKeys(new Set());
    setDuplicateReviewOpen(true);
  }, []);

  const toggleMergeReviewPairKey = useCallback((pairKeyStr: string) => {
    setMergeReviewSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(pairKeyStr)) next.delete(pairKeyStr);
      else next.add(pairKeyStr);
      return next;
    });
  }, []);

  const toggleSelectAllMergeReview = useCallback(() => {
    setMergeReviewSelectedKeys((prev) => {
      const allKeys = mergePairSuggestionsVisible.map((s) =>
        mergePairKey(s.ingredientA.id, s.ingredientB.id),
      );
      const allSelected = allKeys.length > 0 && allKeys.every((k) => prev.has(k));
      if (allSelected) return new Set();
      return new Set(allKeys);
    });
  }, [mergePairSuggestionsVisible]);

  const handleBulkIgnoreMergeSuggestions = useCallback(() => {
    if (!householdId || mergeReviewSelectedKeys.size === 0) return;
    addDismissedMergePairKeys(householdId, mergeReviewSelectedKeys);
    setDismissVersion((v) => v + 1);
    setMergeReviewSelectedKeys(new Set());
  }, [householdId, mergeReviewSelectedKeys]);

  const dismissSingleMergeReviewPair = useCallback(
    (pairKeyStr: string) => {
      if (!householdId) return;
      addDismissedMergePairKeys(householdId, [pairKeyStr]);
      setDismissVersion((v) => v + 1);
      setMergeReviewSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(pairKeyStr);
        return next;
      });
    },
    [householdId],
  );

  const confirmBulkMergeSelected = useCallback(() => {
    if (!householdId || !householdRef || mergeReviewSelectedKeys.size === 0) return;
    const selectedRows = mergePairSuggestionsVisible.filter((s) =>
      mergeReviewSelectedKeys.has(mergePairKey(s.ingredientA.id, s.ingredientB.id)),
    );
    selectedRows.sort((a, b) => b.score - a.score);
    const ops: Array<{ survivorId: string; absorbedId: string }> = [];
    for (const row of selectedRows) {
      const refMap = findIngredientReferences(
        new Set([row.ingredientA.id, row.ingredientB.id]),
        householdRef,
      );
      const ra = refMap.get(row.ingredientA.id)?.length ?? 0;
      const rb = refMap.get(row.ingredientB.id)?.length ?? 0;
      const { survivor, absorbed } = pickMergeSurvivorHeuristic(
        row.ingredientA,
        row.ingredientB,
        ra,
        rb,
      );
      ops.push({ survivorId: survivor.id, absorbedId: absorbed.id });
    }
    applySequentialMergesToHousehold(ops);
    setMergeReviewSelectedKeys(new Set());
    setBulkMergeConfirmOpen(false);
  }, [
    householdId,
    householdRef,
    mergeReviewSelectedKeys,
    mergePairSuggestionsVisible,
    applySequentialMergesToHousehold,
  ]);

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pageItemIds = useMemo(() => new Set(pageItems.map((i) => i.id)), [pageItems]);
  const allPageSelected = pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
  const somePageSelected = pageItems.some((i) => selectedIds.has(i.id));

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageItemIds) next.delete(id);
      } else {
        for (const id of pageItemIds) next.add(id);
      }
      return next;
    });
  }, [allPageSelected, pageItemIds]);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(sortedIngredients.map((i) => i.id)));
  }, [sortedIngredients]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;

  // Bulk delete
  const selectedIngredients = useMemo(
    () => ingredients.filter((i) => selectedIds.has(i.id)),
    [ingredients, selectedIds],
  );

  const referencedMap = useMemo(() => {
    if (!bulkDeleteOpen || !householdRef) return new Map<string, IngredientReference[]>();
    return findIngredientReferences(selectedIds, householdRef);
  }, [bulkDeleteOpen, selectedIds, householdRef]);

  const handleBulkDeleteConfirm = useCallback((idsToDelete: string[]) => {
    const deleteSet = new Set(idsToDelete);
    setIngredients((prev) => prev.filter((i) => !deleteSet.has(i.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of idsToDelete) next.delete(id);
      return next;
    });
    setBulkDeleteOpen(false);
  }, []);

  if (!loaded) return null;

  return (
    <>
      <PageHeader
        title="Ingredients"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      <AppModal
        open={duplicateReviewOpen}
        onClose={() => setDuplicateReviewOpen(false)}
        ariaLabel="Review likely duplicate ingredients"
        backdropClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden flex flex-col p-0"
        panelTestId="ingredient-merge-review-modal"
      >
        <div className="border-b border-border-light px-4 py-3 sm:px-5">
          <h2 className="text-lg font-bold text-text-primary">Review likely duplicates</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Matches are fuzzy. Click a name to keep that ingredient and merge the other into it
            immediately (no second step). The outlined name is what &ldquo;Merge selected&rdquo;
            would keep for that row. Use checkboxes + Ignore selected to leave both names separate.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand"
                checked={mergeDuplicateReviewSelectState.all}
                ref={(el) => {
                  if (el) el.indeterminate = mergeDuplicateReviewSelectState.some;
                }}
                onChange={toggleSelectAllMergeReview}
                aria-label="Select all duplicate pairs on this list"
                data-testid="merge-review-select-all"
              />
              Select all
            </label>
            <Button
              small
              disabled={mergeReviewSelectedKeys.size === 0}
              onClick={handleBulkIgnoreMergeSuggestions}
              data-testid="merge-review-bulk-ignore"
            >
              Ignore selected
            </Button>
            <Button
              small
              variant="primary"
              disabled={mergeReviewSelectedKeys.size === 0}
              onClick={() => setBulkMergeConfirmOpen(true)}
              data-testid="merge-review-bulk-merge"
            >
              Merge selected
            </Button>
            <Button small onClick={runDuplicateScan} data-testid="merge-review-scan-again">
              Scan again
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-4">
          {mergePairSuggestionsVisible.length === 0 ? (
            <p
              className="px-2 py-6 text-center text-sm text-text-muted"
              data-testid="merge-review-empty"
            >
              {duplicateScanPairs?.length === 0
                ? 'No likely duplicates found.'
                : 'No pairs left to review.'}
            </p>
          ) : (
            <>
              <div
                className="mb-1 hidden items-center gap-3 rounded-t-md border border-border-light bg-bg px-3 py-2 text-xs font-medium text-text-muted sm:flex"
                data-testid="merge-review-table-header"
              >
                <span className="w-8 flex-shrink-0" aria-hidden />
                <span className="flex-[2] min-w-0">Keep (tap)</span>
                <span className="flex-[2] min-w-0">Keep (tap)</span>
                <span className="w-14 flex-shrink-0 text-center">Match</span>
                <span className="w-[4.5rem] flex-shrink-0 text-right">Ignore</span>
              </div>
              <div
                className="space-y-1 sm:space-y-0 sm:[&>div+div]:border-t-0"
                data-testid="merge-review-rows"
              >
                {mergePairSuggestionsVisible.map((row, idx) => {
                  const pk = mergePairKey(row.ingredientA.id, row.ingredientB.id);
                  const checked = mergeReviewSelectedKeys.has(pk);
                  const bulkSurvivorId = mergeReviewBulkSurvivorIdByPairKey.get(pk);
                  const ia =
                    ingredients.find((i) => i.id === row.ingredientA.id) ?? row.ingredientA;
                  const ib =
                    ingredients.find((i) => i.id === row.ingredientB.id) ?? row.ingredientB;
                  const keepBtnBase =
                    'min-w-0 flex-[2] cursor-pointer truncate rounded-md border px-2 py-1.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';
                  const keepBtnDefault =
                    'border-border-light bg-bg text-text-primary hover:border-brand hover:bg-brand/5';
                  const keepBtnBulkPick =
                    'border-brand bg-brand/10 text-text-primary ring-1 ring-brand/35';
                  return (
                    <div
                      key={pk}
                      className={`rounded-md border px-3 py-2 sm:py-2.5 ${
                        checked ? 'border-brand bg-brand/5' : 'border-border-light bg-surface'
                      }`}
                      data-testid={`merge-review-row-${idx}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <label
                          className="flex flex-shrink-0 items-center justify-center sm:w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-brand cursor-pointer"
                            checked={checked}
                            onChange={() => toggleMergeReviewPairKey(pk)}
                            aria-label={`Select pair ${toSentenceCase(ia.name)} and ${toSentenceCase(ib.name)}`}
                            data-testid={`merge-review-row-check-${idx}`}
                          />
                        </label>
                        <button
                          type="button"
                          className={`${keepBtnBase} ${
                            bulkSurvivorId === ia.id ? keepBtnBulkPick : keepBtnDefault
                          }`}
                          onClick={() =>
                            handleMerge(ia.id, ib.id, { focusSurvivorInEditor: false })
                          }
                          aria-label={`Keep ${toSentenceCase(ia.name)} and merge ${toSentenceCase(ib.name)} into it${
                            bulkSurvivorId === ia.id ? ' (same as bulk merge for this pair)' : ''
                          }`}
                          data-testid={`merge-review-keep-a-${idx}`}
                        >
                          {toSentenceCase(ia.name)}
                        </button>
                        <button
                          type="button"
                          className={`${keepBtnBase} ${
                            bulkSurvivorId === ib.id ? keepBtnBulkPick : keepBtnDefault
                          }`}
                          onClick={() =>
                            handleMerge(ib.id, ia.id, { focusSurvivorInEditor: false })
                          }
                          aria-label={`Keep ${toSentenceCase(ib.name)} and merge ${toSentenceCase(ia.name)} into it${
                            bulkSurvivorId === ib.id ? ' (same as bulk merge for this pair)' : ''
                          }`}
                          data-testid={`merge-review-keep-b-${idx}`}
                        >
                          {toSentenceCase(ib.name)}
                        </button>
                        <span className="flex sm:w-14 sm:justify-center">
                          <Chip variant="neutral" className="text-[10px]">
                            {Math.round(row.score * 100)}%
                          </Chip>
                        </span>
                        <div className="flex justify-end sm:w-[4.5rem] sm:flex-none">
                          <Button
                            small
                            onClick={() => dismissSingleMergeReviewPair(pk)}
                            data-testid={`merge-review-row-ignore-${idx}`}
                          >
                            Ignore
                          </Button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-text-muted sm:ml-11">
                        {row.reasons.join(' · ')}
                        <span className="mt-0.5 block text-text-secondary sm:hidden">
                          Highlighted name is what bulk merge would keep. Tap a name to merge, or
                          Ignore to keep both.
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="border-t border-border-light px-4 py-3 sm:px-5">
          <Button onClick={() => setDuplicateReviewOpen(false)} data-testid="merge-review-close">
            Close
          </Button>
        </div>
      </AppModal>

      <AppModal
        open={bulkMergeConfirmOpen}
        onClose={() => setBulkMergeConfirmOpen(false)}
        ariaLabel="Confirm bulk merge"
        backdropClassName="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
        className="max-w-md p-6"
        panelTestId="merge-review-bulk-confirm-modal"
      >
        <h2 className="mb-2 text-lg font-bold text-text-primary">Merge selected pairs?</h2>
        <p className="mb-6 text-sm text-text-secondary">
          This will merge {mergeReviewSelectedKeys.size} pair
          {mergeReviewSelectedKeys.size !== 1 ? 's' : ''}. For each pair, the survivor is chosen
          automatically: catalog ingredient over manual, then the one used in more meals/recipes,
          then the earlier name alphabetically. This cannot be undone.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={confirmBulkMergeSelected}
            data-testid="merge-bulk-confirm-yes"
          >
            Merge
          </Button>
          <Button
            onClick={() => setBulkMergeConfirmOpen(false)}
            data-testid="merge-bulk-confirm-cancel"
          >
            Cancel
          </Button>
        </div>
      </AppModal>

      {/* Sticky control bar */}
      <Card className="mb-4 sticky top-0 z-10" data-testid="ingredient-control-bar">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ingredients..."
              data-testid="ingredient-search"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as IngredientCategory | '')}
            className="sm:w-36"
            data-testid="ingredient-category-filter"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {allTags.length > 0 && (
            <Select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="sm:w-36"
              data-testid="ingredient-tag-filter"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="sm:w-32"
            data-testid="ingredient-source-filter"
          >
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="catalog">Catalog</option>
            <option value="pending-import">Imported</option>
          </Select>
          <Select
            value={ingredientSort}
            onChange={(e) => setIngredientSort(e.target.value)}
            className="sm:w-44"
            data-testid="ingredient-sort"
          >
            {INGREDIENT_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
            className="sm:w-24"
            data-testid="ingredient-page-size"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <div className="relative group flex items-center">
              <button
                type="button"
                className="cursor-pointer flex h-[44px] w-[44px] items-center justify-center rounded-sm border border-border-default bg-surface text-text-secondary transition-colors hover:border-brand hover:text-brand focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
                onClick={() => {
                  runDuplicateScan();
                  openDuplicateReview();
                }}
                aria-label="Check for duplicates"
                data-testid="ingredient-merge-check-btn"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <div className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-50 shadow-lg">
                Check for duplicates
                <div className="absolute left-1/2 bottom-full -translate-x-1/2 border-4 border-transparent border-b-gray-800" />
              </div>
            </div>
            <Button onClick={addIngredient}>Add ingredient</Button>
          </div>
        </div>
      </Card>

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-brand bg-brand/5 px-4 py-2.5"
          data-testid="bulk-actions-bar"
        >
          <span className="text-sm font-medium text-text-primary" data-testid="bulk-selected-count">
            {selectedCount} selected
          </span>
          <Button small onClick={selectAllFiltered} data-testid="bulk-select-all-filtered">
            Select all {sortedIngredients.length} filtered
          </Button>
          <Button small onClick={clearSelection} data-testid="bulk-clear-selection">
            Clear selection
          </Button>
          <Button
            small
            variant="danger"
            onClick={() => setBulkDeleteOpen(true)}
            data-testid="bulk-delete-btn"
          >
            Delete selected
          </Button>
        </div>
      )}

      {/* Result summary */}
      <h2
        className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium text-text-secondary"
        data-testid="ingredient-list-summary"
      >
        <span>Items ({ingredients.length})</span>
        {filteredIngredients.length !== ingredients.length && (
          <span>{` · ${filteredIngredients.length} match${filteredIngredients.length !== 1 ? 'es' : ''}`}</span>
        )}
        {selectedCount > 0 && <span>{` · ${selectedCount} selected`}</span>}
        {totalPages > 1 && <span>{` · page ${page} of ${totalPages}`}</span>}
      </h2>

      {/* Table header (desktop) */}
      {sortedIngredients.length > 0 && (
        <div
          className="hidden sm:flex items-center gap-3 rounded-t-md border border-border-light bg-bg px-3 py-2 text-xs font-medium text-text-muted"
          role="row"
          data-testid="ingredient-table-header"
        >
          <label
            className="flex flex-shrink-0 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand cursor-pointer"
              checked={allPageSelected}
              ref={(el) => {
                if (el) el.indeterminate = somePageSelected && !allPageSelected;
              }}
              onChange={toggleSelectAllOnPage}
              aria-label="Select all on page"
              data-testid="select-all-page-checkbox"
            />
          </label>
          <span className="flex-1 sm:flex-[2] min-w-0">Name</span>
          <span className="flex-1">Category</span>
          <span className="flex-1">Tags</span>
          <span className="w-16 flex-shrink-0 text-center">Flags</span>
        </div>
      )}

      {/* Browse list */}
      {ingredients.length === 0 ? (
        <EmptyState>
          <p className="mb-3">
            No household ingredients yet. The master catalog stays separate — add only what you use.
          </p>
          <Button onClick={addIngredient} data-testid="empty-add-ingredient">
            Add ingredient
          </Button>
        </EmptyState>
      ) : filteredIngredients.length === 0 ? (
        <EmptyState>No ingredients match your filters.</EmptyState>
      ) : (
        <div
          className="space-y-1.5 sm:space-y-0 sm:[&>div+div]:border-t-0"
          data-testid="ingredient-list"
        >
          {pageItems.map((ingredient) => (
            <IngredientTableRow
              key={ingredient.id}
              ingredient={ingredient}
              selected={selectedIds.has(ingredient.id)}
              onToggleSelect={() => toggleSelect(ingredient.id)}
              onClick={() => {
                setDraftNewIngredient(null);
                setEditingId(ingredient.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />

      <div className="mt-4">
        <Button onClick={addIngredient}>Add ingredient</Button>
      </div>

      {/* Edit modal */}
      {editingIngredient && (
        <IngredientModal
          key={editingIngredient.id}
          ingredient={editingIngredient}
          isNewIngredient={draftNewIngredient !== null}
          allIngredients={ingredients}
          householdRef={householdRef}
          onChange={handleModalChange}
          onDelete={() => removeIngredient(editingIngredient.id)}
          onMerge={handleMerge}
          onDismiss={dismissIngredientModal}
          onDone={doneIngredientModal}
          onDuplicateFound={(newIng, existing) => {
            setDuplicateWarning({ newIngredient: newIng, existingIngredient: existing });
          }}
        />
      )}

      <DuplicateWarningDialog
        open={!!duplicateWarning}
        duplicateName={duplicateWarning?.newIngredient.name ?? ''}
        existingIngredient={duplicateWarning?.existingIngredient ?? null}
        onMerge={() => {
          if (duplicateWarning) {
            setIngredients((prev) =>
              prev.filter((i) => i.id !== duplicateWarning.newIngredient.id),
            );
            setDraftNewIngredient(null);
            setEditingId(null);
          }
          setDuplicateWarning(null);
        }}
        onCancel={() => {
          setDuplicateWarning(null);
        }}
      />

      <ConfirmDialog
        open={!!pending}
        title="Delete ingredient"
        message={`Are you sure you want to delete "${pending?.entityName}"? This cannot be undone. Meals that use this ingredient may be affected.`}
        confirmLabel="Delete"
        onConfirm={confirm}
        onCancel={cancel}
      />

      <BulkDeleteConfirmDialog
        open={bulkDeleteOpen}
        selectedIngredients={selectedIngredients}
        referencedMap={referencedMap}
        onConfirm={handleBulkDeleteConfirm}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      <CatalogAddDialog
        open={catalogPickerOpen}
        onClose={() => setCatalogPickerOpen(false)}
        onPickCatalog={pickCatalogItemForAdd}
        onCreateManual={startManualIngredientFromPicker}
      />
    </>
  );
}
