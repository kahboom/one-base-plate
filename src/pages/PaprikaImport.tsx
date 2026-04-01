import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Ingredient, IngredientCategory, Recipe } from '../types';
import {
  loadHousehold,
  saveHouseholdAsync,
  toSentenceCase,
  normalizeIngredientName,
  normalizeHousehold,
  type NormalizedHousehold,
} from '../storage';
import {
  parsePaprikaFile,
  parsePaprikaRecipes,
  buildDraftRecipe,
  computeBulkSummary,
  applyBulkAction,
  saveImportSession,
  loadImportSession,
  clearImportSession,
  migrateLegacyPaprikaRecipes,
  canFinalizePaprikaImport,
  applyGroupResolution,
  groupKeyForParsedName,
  countLowConfidencePending,
  refreshPaprikaSessionParsedLines,
  autoResolveHighConfidenceWithStats,
  revertAutoResolvedGroup,
  PAPRIKA_INGREDIENT_PARSER_VERSION,
} from '../paprika-parser';
import type {
  ParsedPaprikaRecipe,
  PaprikaReviewLine,
  PaprikaGroupResolution,
  PaprikaCreateDraft,
  AutoResolveStats,
} from '../paprika-parser';
import { findNearDuplicates, searchCatalog, type CatalogIngredient } from '@/catalog';
import { mapPaprikaCategories } from '../lib/paprikaCategoryMap';
import { recipeTagLabel } from '../lib/recipeTags';
import PaprikaIngredientPicker from '../components/PaprikaIngredientPicker';
import TagSuggestInput from '../components/TagSuggestInput';
import { useListKeyNav } from '../hooks/useListKeyNav';
import AppModal from '../components/AppModal';
import PostImportPaprikaCategories from '../components/PostImportPaprikaCategories';
import {
  PageHeader,
  Card,
  Button,
  Select,
  ActionGroup,
  Chip,
  FieldLabel,
  EmptyState,
  Section,
  Input,
} from '../components/ui';

type Step = 'upload' | 'select' | 'review' | 'done';

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

/** Default page size for Paprika import recipe list */
const PAPRIKA_IMPORT_PAGE_SIZE = 50;

type ReviewFilter = 'all' | 'exceptions' | 'ambiguous' | 'ignored' | 'matched' | 'low-confidence';

type ReviewTier = 'confirm' | 'create' | 'check';

function lineMatchesReviewFilter(line: PaprikaReviewLine, filter: ReviewFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ambiguous' || filter === 'exceptions') {
    return line.resolutionStatus === 'pending';
  }
  if (filter === 'ignored') return line.action === 'ignore';
  if (filter === 'matched') {
    return (
      line.action === 'use' && line.status === 'matched' && line.resolutionStatus === 'resolved'
    );
  }
  if (filter === 'low-confidence') {
    return line.confidenceBand === 'low' && line.resolutionStatus === 'pending';
  }
  return true;
}

interface ReviewGroupWithTier {
  groupKey: string;
  parsedName: string;
  lines: { line: PaprikaReviewLine; globalRecipeIdx: number; lineIdx: number }[];
  tier: ReviewTier;
}

function classifyGroupTier(sample: PaprikaReviewLine): ReviewTier {
  if (sample.resolutionStatus === 'resolved') {
    if (sample.action === 'use') return 'confirm';
    if (sample.action === 'create') return 'create';
    return 'confirm';
  }

  if (
    sample.matchedIngredient &&
    (sample.confidenceBand === 'exact' || sample.confidenceBand === 'strong')
  ) {
    return 'confirm';
  }
  if (
    sample.matchedCatalog &&
    (sample.confidenceBand === 'exact' || sample.confidenceBand === 'strong')
  ) {
    return 'confirm';
  }

  if (sample.status === 'unmatched' && !sample.matchedCatalog && !sample.matchedIngredient) {
    return 'create';
  }

  return 'check';
}

function findReviewLineByGroupKey(
  recipes: ParsedPaprikaRecipe[],
  groupKey: string,
  predicate?: (line: PaprikaReviewLine) => boolean,
): PaprikaReviewLine | undefined {
  for (const r of recipes) {
    for (const l of r.parsedLines) {
      if ((l.groupKey ?? groupKeyForParsedName(l.name)) !== groupKey) continue;
      if (predicate && !predicate(l)) continue;
      return l;
    }
  }
  return undefined;
}

export default function PaprikaImport() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState<Step>('upload');
  const [parsedRecipes, setParsedRecipes] = useState<ParsedPaprikaRecipe[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  /** Recipes from the last successful import; drives post-import category → tag mapping. */
  const [postImportRecipes, setPostImportRecipes] = useState<Recipe[]>([]);
  const [postImportBatchId, setPostImportBatchId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [sessionSavedAt, setSessionSavedAt] = useState<string | null>(null);
  const [selectPage, setSelectPage] = useState(0);
  const [matchPickerGroupKey, setMatchPickerGroupKey] = useState<string | null>(null);
  const [catalogPickerGroupKey, setCatalogPickerGroupKey] = useState<string | null>(null);
  const [createGroupKey, setCreateGroupKey] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [autoResolveStats, setAutoResolveStats] = useState<AutoResolveStats | null>(null);
  const [batchCreatePreviewOpen, setBatchCreatePreviewOpen] = useState(false);
  const [batchCreateCategories, setBatchCreateCategories] = useState<
    Record<string, IngredientCategory>
  >({});
  const catalogResults = useMemo<CatalogIngredient[]>(
    () => (catalogSearch ? searchCatalog(catalogSearch) : []).slice(0, 40),
    [catalogSearch],
  );
  const catalogSelectRef = useRef<(index: number) => void>(() => {});
  const catalogKeyNav = useListKeyNav(
    catalogResults.length,
    useCallback((index: number) => catalogSelectRef.current(index), []),
  );

  const [createForm, setCreateForm] = useState<{
    canonicalName: string;
    category: IngredientCategory;
    tags: string;
    retainImportAlias: boolean;
  }>({ canonicalName: '', category: 'pantry', tags: '', retainImportAlias: false });
  const [duplicateDialog, setDuplicateDialog] = useState<{
    draft: PaprikaCreateDraft;
    groupKey: string;
    existing: Ingredient;
  } | null>(null);

  const existingTagSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const ing of ingredients) {
      for (const t of ing.tags) {
        set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  const pendingCreateIngredients = useMemo(() => {
    const seen = new Set<string>();
    const result: Ingredient[] = [];
    for (const recipe of parsedRecipes) {
      if (!recipe.selected) continue;
      for (const line of recipe.parsedLines) {
        if (line.action !== 'create' || !line.createDraft || line.resolutionStatus !== 'resolved')
          continue;
        const key = line.groupKey ?? groupKeyForParsedName(line.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: `pending-create:${key}`,
          name: normalizeIngredientName(line.createDraft.canonicalName),
          category: line.createDraft.category,
          tags: [...(line.createDraft.tags ?? [])],
          shelfLifeHint: '',
          freezerFriendly: false,
          babySafeWithAdaptation: false,
          source: 'pending-import',
        });
      }
    }
    return result;
  }, [parsedRecipes]);

  const allPickerIngredients = useMemo(
    () => [...ingredients, ...pendingCreateIngredients],
    [ingredients, pendingCreateIngredients],
  );

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients(household.ingredients);
      setHouseholdName(household.name);
    }

    // Restore saved session if available (re-parse lines from `raw` when parser version bumps — full
    // recipe text is stripped from snapshots, so names would otherwise stay stale forever).
    const session = loadImportSession(householdId);
    if (session && session.step !== 'done') {
      let recipes = migrateLegacyPaprikaRecipes(session.parsedRecipes);
      if ((session.importParserVersion ?? 0) < PAPRIKA_INGREDIENT_PARSER_VERSION) {
        recipes = refreshPaprikaSessionParsedLines(recipes, household?.ingredients ?? []);
      }
      // Run auto-resolve pre-pass on restored review sessions so the triage queue
      // is already reduced when the user returns to the review step.
      if (session.step === 'review') {
        const { recipes: autoResolved, stats } = autoResolveHighConfidenceWithStats(recipes);
        recipes = autoResolved;
        if (stats.total > 0) setAutoResolveStats(stats);
      }
      setParsedRecipes(recipes);
      setStep(session.step);
      setSessionSavedAt(session.savedAt);
    }

    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(parsedRecipes.length / PAPRIKA_IMPORT_PAGE_SIZE) - 1);
    setSelectPage((p) => Math.min(p, maxPage));
  }, [parsedRecipes.length]);

  /** Persist draft after state updates (never call setState from inside another setState updater — React 19). */
  useEffect(() => {
    if (!loaded || !householdId) return;
    if (step === 'done' || step === 'upload') return;
    saveImportSession({
      householdId,
      parsedRecipes,
      step,
      savedAt: new Date().toISOString(),
    });
    setSessionSavedAt(new Date().toISOString());
  }, [loaded, householdId, step, parsedRecipes]);

  const sessionSaveLabel = useMemo(() => {
    if (!sessionSavedAt) return 'Not saved yet';
    const date = new Date(sessionSavedAt);
    if (Number.isNaN(date.getTime())) return 'Saved to draft';
    return `Saved to draft ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [sessionSavedAt]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    try {
      const recipes = await parsePaprikaFile(file);
      if (recipes.length === 0) {
        setError('No recipes found in this file.');
        return;
      }
      const hh = householdId ? loadHousehold(householdId) : undefined;
      const parsed = parsePaprikaRecipes(recipes, ingredients, hh?.recipes ?? []);
      setParsedRecipes(parsed);
      setStep('select');
    } catch (err) {
      console.error('Paprika import parse failed', err);
      setError('Failed to parse file. Make sure it is a valid .paprikarecipes export.');
    }
  }

  const selectedRecipes = useMemo(() => parsedRecipes.filter((r) => r.selected), [parsedRecipes]);

  const duplicateCount = useMemo(
    () => parsedRecipes.filter((r) => r.isDuplicate).length,
    [parsedRecipes],
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of parsedRecipes) {
      for (const c of r.raw.categories) {
        cats.add(c);
      }
    }
    return [...cats].sort();
  }, [parsedRecipes]);

  const bulkSummary = useMemo(() => computeBulkSummary(selectedRecipes), [selectedRecipes]);

  const allReviewLines = useMemo(() => {
    const lines: { line: PaprikaReviewLine; globalRecipeIdx: number; lineIdx: number }[] = [];
    for (let globalIdx = 0; globalIdx < parsedRecipes.length; globalIdx++) {
      const recipe = parsedRecipes[globalIdx]!;
      if (!recipe.selected) continue;
      recipe.parsedLines.forEach((line, lineIdx) => {
        lines.push({ line, globalRecipeIdx: globalIdx, lineIdx });
      });
    }
    return lines;
  }, [parsedRecipes]);

  const filteredReviewLines = useMemo(() => {
    return allReviewLines.filter(({ line }) => lineMatchesReviewFilter(line, reviewFilter));
  }, [allReviewLines, reviewFilter]);

  const reviewGroups = useMemo(() => {
    const gm = new Map<
      string,
      { line: PaprikaReviewLine; globalRecipeIdx: number; lineIdx: number }[]
    >();
    for (const ref of filteredReviewLines) {
      const key = ref.line.groupKey ?? groupKeyForParsedName(ref.line.name);
      if (!key) continue;
      const arr = gm.get(key) ?? [];
      arr.push(ref);
      gm.set(key, arr);
    }
    return [...gm.entries()]
      .map(([groupKey, lines]) => ({
        groupKey,
        parsedName: lines[0]!.line.name,
        lines,
      }))
      .sort((a, b) => a.parsedName.localeCompare(b.parsedName, undefined, { sensitivity: 'base' }));
  }, [filteredReviewLines]);

  const pendingCount = useMemo(
    () => allReviewLines.filter(({ line }) => line.resolutionStatus === 'pending').length,
    [allReviewLines],
  );

  const lowConfidenceCount = useMemo(
    () => countLowConfidencePending(parsedRecipes),
    [parsedRecipes],
  );

  const [collapsedTiers, setCollapsedTiers] = useState<Record<ReviewTier, boolean>>({
    confirm: true,
    create: true,
    check: true,
  });

  const toggleTierCollapse = useCallback((tier: ReviewTier) => {
    setCollapsedTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  }, []);

  const tieredGroups = useMemo(() => {
    const groups: ReviewGroupWithTier[] = reviewGroups.map((g) => ({
      ...g,
      tier: classifyGroupTier(g.lines[0]!.line),
    }));
    return groups;
  }, [reviewGroups]);

  const tierData = useMemo(() => {
    const confirm = tieredGroups.filter((g) => g.tier === 'confirm');
    const create = tieredGroups.filter((g) => g.tier === 'create');
    const check = tieredGroups.filter((g) => g.tier === 'check');
    const confirmPending = confirm.filter(
      (g) => g.lines[0]!.line.resolutionStatus === 'pending',
    ).length;
    const createPending = create.filter(
      (g) => g.lines[0]!.line.resolutionStatus === 'pending',
    ).length;
    const checkPending = check.filter(
      (g) => g.lines[0]!.line.resolutionStatus === 'pending',
    ).length;
    return {
      confirm,
      create,
      check,
      confirmPending,
      createPending,
      checkPending,
    };
  }, [tieredGroups]);

  const totalGroups = useMemo(() => reviewGroups.length, [reviewGroups]);
  const resolvedGroups = useMemo(
    () => reviewGroups.filter((g) => g.lines[0]!.line.resolutionStatus === 'resolved').length,
    [reviewGroups],
  );
  const progressPct = totalGroups === 0 ? 100 : Math.round((resolvedGroups / totalGroups) * 100);

  const handleAutoResolve = useCallback(() => {
    setParsedRecipes((prev) => {
      const { recipes, stats } = autoResolveHighConfidenceWithStats(prev);
      setAutoResolveStats(stats);
      return recipes;
    });
  }, []);

  const batchCreateRows = useMemo(() => {
    return tierData.create.filter((g) => g.lines[0]!.line.resolutionStatus === 'pending');
  }, [tierData.create]);

  const selectPaging = useMemo(() => {
    const total = parsedRecipes.length;
    const pageCount = total === 0 ? 0 : Math.ceil(total / PAPRIKA_IMPORT_PAGE_SIZE);
    const start = selectPage * PAPRIKA_IMPORT_PAGE_SIZE;
    const end = Math.min(start + PAPRIKA_IMPORT_PAGE_SIZE, total);
    return {
      total,
      pageCount,
      start,
      end,
      showPager: total > PAPRIKA_IMPORT_PAGE_SIZE,
      from1: total === 0 ? 0 : start + 1,
    };
  }, [parsedRecipes.length, selectPage]);

  function toggleRecipe(index: number) {
    setParsedRecipes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, selected: !next[index]!.selected };
      return next;
    });
  }

  function selectAll() {
    setParsedRecipes((prev) => {
      const next = prev.map((r) => ({ ...r, selected: true }));
      return next;
    });
  }

  function selectNone() {
    setParsedRecipes((prev) => {
      const next = prev.map((r) => ({ ...r, selected: false }));
      return next;
    });
  }

  function selectByCategory(cat: string) {
    setParsedRecipes((prev) => {
      const next = prev.map((r) => ({
        ...r,
        selected: r.raw.categories.includes(cat),
      }));
      return next;
    });
  }

  function handleDuplicateAction(index: number, action: 'skip' | 'merge' | 'keep-both') {
    setParsedRecipes((prev) => {
      const next = [...prev];
      const recipe = { ...next[index]! };
      if (action === 'skip') {
        recipe.selected = false;
      } else if (action === 'merge' || action === 'keep-both') {
        recipe.selected = true;
        if (action === 'keep-both') {
          recipe.isDuplicate = false;
          recipe.existingRecipeId = undefined;
        }
      }
      next[index] = recipe;
      return next;
    });
  }

  function updateReviewLine(
    recipeIdx: number,
    lineIdx: number,
    updates: Partial<PaprikaReviewLine>,
  ) {
    setParsedRecipes((prev) => {
      const next = [...prev];
      const recipe = { ...next[recipeIdx]! };
      const lines = [...recipe.parsedLines];
      const prevLine = lines[lineIdx]!;
      let merged: PaprikaReviewLine = { ...prevLine, ...updates };
      if (updates.action === 'ignore') {
        merged = { ...merged, resolutionStatus: 'resolved', explicitIgnore: true };
      } else if (updates.action === 'use' || updates.action === 'create') {
        merged = { ...merged, resolutionStatus: 'resolved', lowConfidenceAccepted: true };
      }
      if (updates.action !== undefined && updates.action !== prevLine.action) {
        merged = { ...merged, perLineOverride: true };
      }
      lines[lineIdx] = merged;
      recipe.parsedLines = lines;
      next[recipeIdx] = recipe;
      return next;
    });
  }

  const applyResolutionToGroup = useCallback(
    (groupKey: string, resolution: PaprikaGroupResolution) => {
      setParsedRecipes((prev) => applyGroupResolution(prev, groupKey, resolution));
    },
    [],
  );

  const handleRevertAutoResolvedGroup = useCallback((groupKey: string) => {
    setParsedRecipes((prev) => revertAutoResolvedGroup(prev, groupKey));
  }, []);

  const handleBatchCreateAll = useCallback(() => {
    for (const group of batchCreateRows) {
      const sample = group.lines[0]!.line;
      const category = batchCreateCategories[group.groupKey] ?? sample.newCategory;
      applyResolutionToGroup(group.groupKey, {
        kind: 'create',
        draft: {
          canonicalName: sample.name,
          category,
          tags: [],
          retainImportAlias: false,
        },
      });
    }
    setBatchCreatePreviewOpen(false);
    setBatchCreateCategories({});
  }, [batchCreateRows, batchCreateCategories, applyResolutionToGroup]);

  catalogSelectRef.current = (index: number) => {
    const item = catalogResults[index];
    if (!item) return;
    if (catalogPickerGroupKey) {
      applyResolutionToGroup(catalogPickerGroupKey, { kind: 'catalog', catalogItem: item });
    }
    setCatalogPickerGroupKey(null);
  };

  const approveSuggestedHouseholdMatch = useCallback(
    (groupKey: string, ingredient: Ingredient | null | undefined) => {
      setError('');
      if (!ingredient) return;
      applyResolutionToGroup(groupKey, {
        kind: 'use',
        ingredientId: ingredient.id,
        ingredient,
      });
    },
    [applyResolutionToGroup],
  );

  const openCreateModalForGroup = useCallback(
    (groupKey: string) => {
      const line = findReviewLineByGroupKey(parsedRecipes, groupKey);
      if (!line) return;
      const draft = line.createDraft;
      setCreateForm({
        canonicalName: draft?.canonicalName ?? line.name,
        category: draft?.category ?? line.newCategory,
        tags: draft?.tags?.join(', ') ?? '',
        retainImportAlias: draft?.retainImportAlias ?? false,
      });
      setCreateGroupKey(groupKey);
    },
    [parsedRecipes],
  );

  const editingCreateDraft = useMemo(() => {
    if (!createGroupKey) return false;
    return parsedRecipes.some((r) =>
      r.parsedLines.some(
        (l) => (l.groupKey ?? groupKeyForParsedName(l.name)) === createGroupKey && !!l.createDraft,
      ),
    );
  }, [createGroupKey, parsedRecipes]);

  const submitCreateIngredientModal = useCallback(() => {
    if (!createGroupKey) return;
    const draft: PaprikaCreateDraft = {
      canonicalName: createForm.canonicalName,
      category: createForm.category,
      tags: createForm.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      retainImportAlias: createForm.retainImportAlias,
    };
    const norm = normalizeIngredientName(draft.canonicalName);
    const dups = findNearDuplicates(norm, ingredients);
    if (dups.length > 0) {
      setDuplicateDialog({ draft, groupKey: createGroupKey, existing: dups[0]! });
      return;
    }
    const sample = findReviewLineByGroupKey(parsedRecipes, createGroupKey);
    if (
      sample?.matchedCatalog &&
      (sample.confidenceBand === 'exact' || sample.confidenceBand === 'strong')
    ) {
      const ok = window.confirm(
        `A strong catalog match (${toSentenceCase(sample.matchedCatalog.name)}) exists. Create a new ingredient anyway?`,
      );
      if (!ok) return;
    }
    applyResolutionToGroup(createGroupKey, { kind: 'create', draft });
    setCreateGroupKey(null);
  }, [createGroupKey, createForm, ingredients, parsedRecipes, applyResolutionToGroup]);

  function handleBulkAction(action: 'approve-matched' | 'create-all-new' | 'ignore-instructions') {
    setParsedRecipes((prev) => applyBulkAction(prev, action));
  }

  function handleStartReview() {
    if (selectedRecipes.length === 0) return;
    // Run auto-resolve pre-pass before entering review so the queue is already reduced.
    const { recipes: autoResolved, stats } = autoResolveHighConfidenceWithStats(parsedRecipes);
    setParsedRecipes(autoResolved);
    if (stats.total > 0) setAutoResolveStats(stats);
    setStep('review');
  }

  async function handleSaveAll() {
    if (!householdId) return;
    const rawHousehold = loadHousehold(householdId);
    if (!rawHousehold) {
      setError('Could not load this household. Return to the household list and try again.');
      return;
    }
    const household: NormalizedHousehold = normalizeHousehold(rawHousehold);
    setError('');

    if (!canFinalizePaprikaImport(parsedRecipes)) {
      setError(
        'Resolve or intentionally ignore every pending ingredient line (including low-confidence matches) before importing.',
      );
      return;
    }

    let allNewIngredients: Ingredient[] = [];
    const newRecipes: Recipe[] = [];
    let currentIngredients = [...household.ingredients];
    const importedRecipeIds: string[] = [];

    for (const parsed of selectedRecipes) {
      const { recipe: libraryRecipe, newIngredients } = buildDraftRecipe(
        parsed.raw,
        parsed.parsedLines,
        currentIngredients,
      );

      importedRecipeIds.push(libraryRecipe.id);

      if (parsed.isDuplicate && parsed.existingRecipeId) {
        const existingIdx = household.recipes.findIndex((r) => r.id === parsed.existingRecipeId);
        if (existingIdx >= 0) {
          libraryRecipe.id = parsed.existingRecipeId;
          household.recipes[existingIdx] = libraryRecipe;
        } else {
          newRecipes.push(libraryRecipe);
        }
      } else {
        newRecipes.push(libraryRecipe);
      }

      allNewIngredients = [...allNewIngredients, ...newIngredients];
      currentIngredients = [...currentIngredients, ...newIngredients];
    }

    const ingredientsByName = new Map<string, Ingredient>();
    const idRemap = new Map<string, string>();
    const dedupedIngredients: Ingredient[] = [];
    for (const ing of allNewIngredients) {
      const nameKey = ing.name.toLowerCase().trim();
      const existing = ingredientsByName.get(nameKey);
      if (existing) {
        idRemap.set(ing.id, existing.id);
      } else {
        ingredientsByName.set(nameKey, ing);
        dedupedIngredients.push(ing);
      }
    }
    if (idRemap.size > 0) {
      for (const row of [...newRecipes, ...household.recipes, ...household.baseMeals]) {
        for (const comp of row.components) {
          const remapped = idRemap.get(comp.ingredientId);
          if (remapped) comp.ingredientId = remapped;
        }
      }
    }

    household.ingredients = [...household.ingredients, ...dedupedIngredients];
    household.recipes = [...household.recipes, ...newRecipes];

    const postImportSnapshot = importedRecipeIds
      .map((id) => household.recipes.find((r) => r.id === id))
      .filter((r): r is Recipe => r != null);

    try {
      await saveHouseholdAsync(household);
      clearImportSession();
      setImportedCount(selectedRecipes.length);
      setPostImportRecipes(postImportSnapshot);
      setPostImportBatchId(crypto.randomUUID());

      setStep('done');
    } catch (err) {
      console.error('Paprika import save failed', err);
      setError(
        'Could not save imported recipes. Your browser storage quota was exceeded or data could not be written. Try exporting a backup, removing old households or meals, then importing again.',
      );
    }
  }

  if (!loaded) return null;

  return (
    <>
      <PageHeader
        title="Import from Paprika"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      {step === 'upload' && (
        <div data-testid="paprika-upload-step">
          <Card className="mb-4">
            <FieldLabel label="Upload .paprikarecipes file">
              <input
                type="file"
                accept=".paprikarecipes"
                onChange={handleFileUpload}
                className="block w-full text-sm text-text-primary file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark"
                data-testid="paprika-file-input"
              />
            </FieldLabel>
            <p className="mt-2 text-sm text-text-muted">
              Export your recipes from Paprika as a .paprikarecipes file, then upload it here.
            </p>
          </Card>

          {error && (
            <Card className="mb-4 border-danger bg-danger/5">
              <p className="text-sm text-danger" data-testid="paprika-error">
                {error}
              </p>
            </Card>
          )}

          <ActionGroup>
            <Button onClick={() => navigate(`/household/${householdId}/meals`)}>Cancel</Button>
          </ActionGroup>
        </div>
      )}

      {step === 'select' && (
        <div data-testid="paprika-select-step">
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip variant="info">{parsedRecipes.length} recipes found</Chip>
            <Chip variant="success">{selectedRecipes.length} selected</Chip>
            <Chip variant="neutral" data-testid="import-session-status">
              {sessionSaveLabel}
            </Chip>
            {duplicateCount > 0 && <Chip variant="warning">{duplicateCount} duplicates</Chip>}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button small onClick={selectAll} data-testid="select-all-btn">
              Select all
            </Button>
            <Button small onClick={selectNone} data-testid="select-none-btn">
              Select none
            </Button>
            {categories.length > 0 && (
              <Select
                onChange={(e) => {
                  if (e.target.value) selectByCategory(e.target.value);
                }}
                className="w-auto"
                data-testid="select-by-category"
              >
                <option value="">Select by category...</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {selectPaging.showPager && (
            <div
              className="mb-2 flex flex-wrap items-center justify-between gap-2"
              data-testid="recipe-select-pagination"
            >
              <span className="text-xs text-text-muted">
                Showing {selectPaging.from1}–{selectPaging.end} of {selectPaging.total}
                {' · '}
                Page {selectPage + 1} of {selectPaging.pageCount}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  small
                  disabled={selectPage <= 0}
                  onClick={() => setSelectPage((p) => Math.max(0, p - 1))}
                  data-testid="recipe-select-prev"
                >
                  Previous
                </Button>
                <Button
                  small
                  disabled={selectPage >= selectPaging.pageCount - 1}
                  onClick={() => setSelectPage((p) => Math.min(selectPaging.pageCount - 1, p + 1))}
                  data-testid="recipe-select-next"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1" data-testid="recipe-list">
            {parsedRecipes.slice(selectPaging.start, selectPaging.end).map((recipe, localIdx) => {
              const i = selectPaging.start + localIdx;
              const cats = recipe.raw.categories;
              const { tags: previewMappedTags, unmappedCount: previewUnmappedCount } =
                mapPaprikaCategories(cats);
              return (
                <Card
                  key={i}
                  data-testid={`recipe-item-${i}`}
                  className={`!p-2.5 shadow-none ${!recipe.selected ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2 sm:items-center">
                    <input
                      type="checkbox"
                      checked={recipe.selected}
                      onChange={() => toggleRecipe(i)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded sm:mt-0"
                      data-testid={`recipe-checkbox-${i}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium leading-tight text-text-primary">
                          {recipe.raw.name}
                        </p>
                        {recipe.isDuplicate && (
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            <Chip variant="warning" className="text-[10px]">
                              Duplicate
                            </Chip>
                            <Select
                              onChange={(e) =>
                                handleDuplicateAction(
                                  i,
                                  e.target.value as 'skip' | 'merge' | 'keep-both',
                                )
                              }
                              className="max-w-[11rem] py-1 text-xs"
                              data-testid={`duplicate-action-${i}`}
                            >
                              <option value="skip">Skip</option>
                              <option value="merge">Merge</option>
                              <option value="keep-both">Keep both</option>
                            </Select>
                          </div>
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-snug text-text-muted">
                        {recipe.raw.total_time && <span>{recipe.raw.total_time}</span>}
                        {recipe.parsedLines.length > 0 && (
                          <span>{recipe.parsedLines.length} ing.</span>
                        )}
                        {cats.slice(0, 2).map((c) => (
                          <span key={c} className="truncate text-text-secondary">
                            {c}
                          </span>
                        ))}
                        {cats.length > 2 && (
                          <span className="text-text-muted">+{cats.length - 2}</span>
                        )}
                      </p>
                      {(previewMappedTags.length > 0 || previewUnmappedCount > 0) && (
                        <div
                          className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] leading-snug"
                          data-testid={`paprika-category-tag-preview-${i}`}
                        >
                          {previewMappedTags.length > 0 && (
                            <>
                              <span className="shrink-0 text-text-muted">Library tags:</span>
                              {previewMappedTags.map((t) => (
                                <Chip key={t} variant="neutral" className="text-[10px]">
                                  {recipeTagLabel(t)}
                                </Chip>
                              ))}
                            </>
                          )}
                          {previewUnmappedCount > 0 && (
                            <span className="text-text-muted">
                              {previewMappedTags.length > 0 ? '· ' : ''}
                              {previewUnmappedCount} unmapped — kept as import metadata only
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {parsedRecipes.length === 0 && (
            <EmptyState>No recipes found in the uploaded file.</EmptyState>
          )}

          <div className="mt-4">
            <ActionGroup>
              <Button
                variant="primary"
                onClick={handleStartReview}
                disabled={selectedRecipes.length === 0}
                data-testid="start-review-btn"
              >
                Review {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? 's' : ''}
              </Button>
              <Button
                onClick={() => {
                  setStep('upload');
                  setParsedRecipes([]);
                  clearImportSession();
                }}
              >
                Back
              </Button>
            </ActionGroup>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div data-testid="paprika-review-step">
          {error && (
            <Card className="mb-4 border-danger bg-danger/5">
              <p className="text-sm text-danger" data-testid="paprika-error">
                {error}
              </p>
            </Card>
          )}
          {selectedRecipes.some((r) => (r.raw.categories?.length ?? 0) > 0) && (
            <details
              className="mb-4 rounded-md border border-border-subtle bg-surface-raised/40 px-3 py-2 text-xs text-text-muted"
              data-testid="paprika-review-category-tag-summary"
            >
              <summary className="cursor-pointer select-none text-text-secondary">
                Paprika categories → library tags (selected recipes)
              </summary>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-1">
                {selectedRecipes
                  .map((r, idx) => ({ r, idx }))
                  .filter(({ r }) => (r.raw.categories?.length ?? 0) > 0)
                  .map(({ r, idx }) => {
                    const { tags: sumTags, unmappedCount: sumUnmapped } = mapPaprikaCategories(
                      r.raw.categories,
                    );
                    return (
                      <li key={r.raw.uid || `paprika-sel-${idx}`}>
                        <span className="font-medium text-text-primary">{r.raw.name}</span>
                        {sumTags.length > 0 && (
                          <>
                            {': '}
                            {sumTags.map((t) => (
                              <Chip key={t} variant="neutral" className="mx-0.5 text-[10px]">
                                {recipeTagLabel(t)}
                              </Chip>
                            ))}
                          </>
                        )}
                        {sumUnmapped > 0 && (
                          <span className="text-text-muted">
                            {sumTags.length > 0 ? ' · ' : ': '}
                            {sumUnmapped} unmapped (metadata only)
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </details>
          )}
          <Section title="Ingredient review">
            {/* Progress bar */}
            <div className="mb-4" data-testid="review-progress">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {resolvedGroups} of {totalGroups} ingredient groups resolved
                </span>
                <span className="text-xs tabular-nums text-text-muted">{progressPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border-light">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                  data-testid="review-progress-bar"
                />
              </div>
              {pendingCount > 0 && (
                <p className="mt-1.5 text-xs text-[color:var(--color-warning-text)]">
                  {totalGroups - resolvedGroups} group
                  {totalGroups - resolvedGroups !== 1 ? 's' : ''} still need a decision before
                  import.
                </p>
              )}
            </div>

            {/* Compact summary chips */}
            <div className="mb-4 flex flex-wrap gap-2" data-testid="bulk-summary">
              <Chip variant="success">{bulkSummary.matched.length} matched</Chip>
              <Chip variant="info">{bulkSummary.createNew.length} create new</Chip>
              <Chip variant="neutral">{bulkSummary.ignored.length} ignored</Chip>
              {lowConfidenceCount > 0 && (
                <Chip variant="warning">{lowConfidenceCount} low-confidence</Chip>
              )}
            </div>

            <p className="mb-3 text-xs text-text-muted" data-testid="import-session-status">
              {sessionSaveLabel}
            </p>

            {autoResolveStats && autoResolveStats.total > 0 && (
              <div
                className="mb-4 rounded-md border border-brand/25 bg-brand/5 px-3 py-2 text-xs text-text-secondary"
                data-testid="auto-resolve-summary"
              >
                Auto-resolved {autoResolveStats.total} ingredient
                {autoResolveStats.total !== 1 ? 's' : ''}
                {autoResolveStats.householdMatches > 0 && (
                  <span> &middot; {autoResolveStats.householdMatches} matched to household</span>
                )}
                {autoResolveStats.catalogMatches > 0 && (
                  <span> &middot; {autoResolveStats.catalogMatches} from catalog</span>
                )}
                {autoResolveStats.stapleMatches > 0 && (
                  <span> &middot; {autoResolveStats.stapleMatches} common staples</span>
                )}
              </div>
            )}
            {/* Smart actions */}
            <div className="mb-4 flex flex-wrap gap-2" data-testid="bulk-actions">
              <Button
                small
                variant="primary"
                onClick={() => {
                  setError('');
                  handleAutoResolve();
                }}
                disabled={pendingCount === 0}
                data-testid="bulk-auto-resolve"
              >
                Auto-resolve high-confidence
              </Button>
              <Button
                small
                onClick={() => {
                  setError('');
                  handleBulkAction('approve-matched');
                }}
                data-testid="bulk-approve-matched"
              >
                Approve all matches
              </Button>
              <Button
                small
                onClick={() => {
                  setError('');
                  setBatchCreatePreviewOpen(true);
                }}
                disabled={tierData.createPending === 0}
                data-testid="bulk-create-new"
              >
                Create all unmatched ({tierData.createPending})
              </Button>
              <Button
                small
                onClick={() => {
                  setError('');
                  handleBulkAction('ignore-instructions');
                }}
                data-testid="bulk-ignore-instructions"
              >
                Ignore all instructions
              </Button>
            </div>

            {/* Filter row */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-text-secondary">Filter:</span>
              <Button
                small
                variant={reviewFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setReviewFilter('all')}
                data-testid="filter-all"
              >
                All ({allReviewLines.length})
              </Button>
              <Button
                small
                variant={
                  reviewFilter === 'ambiguous' || reviewFilter === 'exceptions'
                    ? 'primary'
                    : 'default'
                }
                onClick={() => setReviewFilter('ambiguous')}
                data-testid="filter-ambiguous"
              >
                Pending ({pendingCount})
              </Button>
              <Button
                small
                variant={reviewFilter === 'ignored' ? 'primary' : 'default'}
                onClick={() => setReviewFilter('ignored')}
                data-testid="filter-ignored"
              >
                Ignored
              </Button>
              <Button
                small
                variant={reviewFilter === 'matched' ? 'primary' : 'default'}
                onClick={() => setReviewFilter('matched')}
                data-testid="filter-matched"
              >
                Matched
              </Button>
              <Button
                small
                variant={reviewFilter === 'low-confidence' ? 'primary' : 'default'}
                onClick={() => setReviewFilter('low-confidence')}
                data-testid="filter-low-confidence"
              >
                Low-confidence
              </Button>
            </div>
          </Section>

          {/* ── Guided triage (tier groups; collapsed by default — content mounts when expanded) ── */}
          <div className="space-y-4" data-testid="review-tiered">
              {[
                {
                  tier: 'confirm' as ReviewTier,
                  title: 'Confirm suggestions',
                  subtitle: 'High-confidence matches — tap to confirm or change',
                  groups: tierData.confirm,
                  pending: tierData.confirmPending,
                  variant: 'success' as const,
                },
                {
                  tier: 'create' as ReviewTier,
                  title: 'New ingredients to create',
                  subtitle: 'No match found — review names and categories',
                  groups: tierData.create,
                  pending: tierData.createPending,
                  variant: 'info' as const,
                },
                {
                  tier: 'check' as ReviewTier,
                  title: 'Lines to check',
                  subtitle: 'Low-confidence or ambiguous — needs your attention',
                  groups: tierData.check,
                  pending: tierData.checkPending,
                  variant: 'warning' as const,
                },
              ].map(
                ({ tier, title, subtitle, groups: tierGroups, pending: tierPending, variant }) => {
                  if (tierGroups.length === 0) return null;
                  const isDone = tierPending === 0;
                  const tierCollapsed = collapsedTiers[tier];
                  return (
                    <div
                      key={tier}
                      className="rounded-lg border border-border-light"
                      data-testid={`tier-${tier}`}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        onClick={() => toggleTierCollapse(tier)}
                        aria-expanded={!tierCollapsed}
                        data-testid={`tier-${tier}-toggle`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text-primary">{title}</span>
                            <Chip variant={isDone ? 'success' : variant} className="text-[10px]">
                              {isDone ? 'Done' : `${tierPending} pending`}
                            </Chip>
                            <span className="text-xs text-text-muted">
                              {tierGroups.length} group{tierGroups.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
                        </div>
                        <span className="shrink-0 text-text-muted" aria-hidden>
                          {tierCollapsed ? '▸' : '▾'}
                        </span>
                      </button>

                      {!tierCollapsed && (
                        <div className="space-y-1 border-t border-border-light px-3 py-3">
                          {tierGroups.map((group) => {
                            const gi = reviewGroups.findIndex((g) => g.groupKey === group.groupKey);
                            const sample = group.lines[0]!.line;
                            const band = sample.confidenceBand;
                            const recipeNames = Array.from(
                              new Set(group.lines.map((r) => r.line.recipeName)),
                            );
                            const resolvedHouseholdName =
                              sample.action === 'use' && sample.resolutionStatus === 'resolved'
                                ? (sample.matchedIngredient?.name ??
                                  ingredients.find((ing) => ing.id === sample.manualIngredientId)
                                    ?.name)
                                : undefined;
                            return (
                              <Card
                                key={group.groupKey}
                                data-testid={`review-group-${gi}`}
                                className={`!p-3 shadow-none ${sample.resolutionStatus === 'resolved' ? 'opacity-60' : ''}`}
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-start gap-2.5">
                                      {sample.matchedCatalog?.imageUrl ? (
                                        <img
                                          src={sample.matchedCatalog.imageUrl}
                                          alt=""
                                          loading="lazy"
                                          decoding="async"
                                          className="h-10 w-10 shrink-0 rounded-md border border-border-light bg-bg object-cover"
                                          data-testid={`review-group-catalog-suggestion-thumb-${gi}`}
                                          onError={(e) => e.currentTarget.classList.add('hidden')}
                                        />
                                      ) : null}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-text-primary">
                                          {toSentenceCase(group.parsedName)}
                                        </p>
                                        <p className="text-[11px] text-text-muted">
                                          {group.lines.length} occurrence
                                          {group.lines.length !== 1 ? 's' : ''} ·{' '}
                                          {recipeNames.length} recipe
                                          {recipeNames.length !== 1 ? 's' : ''}
                                          {sample.resolutionStatus === 'pending' && (
                                            <Chip variant="warning" className="ml-2 text-[10px]">
                                              Pending
                                            </Chip>
                                          )}
                                          {band && (
                                            <Chip variant="neutral" className="ml-1 text-[10px]">
                                              {band}
                                            </Chip>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {resolvedHouseholdName && (
                                        <div
                                          className="w-full rounded-md border border-brand/25 bg-brand/5 px-2.5 py-2"
                                          data-testid={`review-group-use-preview-${gi}`}
                                        >
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                            Will use household ingredient
                                          </p>
                                          <p
                                            className="text-sm font-medium text-text-primary"
                                            data-testid={`review-group-use-name-${gi}`}
                                          >
                                            {toSentenceCase(resolvedHouseholdName)}
                                          </p>
                                          <p className="mt-0.5 text-[11px] text-text-muted">
                                            This is the name stored on the ingredient and used in
                                            meals and groceries.
                                          </p>
                                        </div>
                                      )}
                                      {sample.resolutionStatus === 'pending' &&
                                        sample.matchedIngredient && (
                                          <Chip
                                            variant="success"
                                            className="max-w-full cursor-pointer truncate text-[10px] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                                            role="button"
                                            tabIndex={0}
                                            title="Use suggested household match"
                                            aria-label={`Use suggested match: ${sample.matchedIngredient.name}`}
                                            data-testid={`review-group-suggested-${gi}`}
                                            onClick={() =>
                                              approveSuggestedHouseholdMatch(
                                                group.groupKey,
                                                sample.matchedIngredient,
                                              )
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key !== 'Enter' && e.key !== ' ') return;
                                              e.preventDefault();
                                              approveSuggestedHouseholdMatch(
                                                group.groupKey,
                                                sample.matchedIngredient,
                                              );
                                            }}
                                          >
                                            Suggested: {sample.matchedIngredient.name}
                                          </Chip>
                                        )}
                                      {sample.resolutionStatus === 'pending' &&
                                        sample.matchedCatalog && (
                                          <div
                                            className="max-w-full space-y-0.5"
                                            data-testid={`review-group-catalog-suggestion-${gi}`}
                                          >
                                            <div className="min-w-0 space-y-0.5">
                                              <Chip
                                                variant="info"
                                                className="max-w-full truncate text-[10px]"
                                              >
                                                Catalog suggestion:{' '}
                                                {toSentenceCase(sample.matchedCatalog.name)}
                                              </Chip>
                                              <p className="text-[10px] text-text-muted">
                                                Not yet in your household
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                    {sample.action === 'create' && sample.createDraft && (
                                      <div
                                        className="rounded-md border border-brand/25 bg-brand/5 px-2.5 py-2"
                                        data-testid={`review-group-create-preview-${gi}`}
                                      >
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                          Will create as
                                        </p>
                                        <p
                                          className="text-sm font-medium text-text-primary"
                                          data-testid={`review-group-create-canonical-${gi}`}
                                        >
                                          {toSentenceCase(
                                            normalizeIngredientName(
                                              sample.createDraft.canonicalName,
                                            ),
                                          )}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-text-muted">
                                          {sample.createDraft.category}
                                          {(sample.createDraft.tags?.length ?? 0) > 0 &&
                                            ` · ${(sample.createDraft.tags ?? []).join(', ')}`}
                                          {sample.createDraft.retainImportAlias &&
                                            ' · alias from import kept'}
                                        </p>
                                        <Button
                                          small
                                          className="mt-2"
                                          onClick={() => openCreateModalForGroup(group.groupKey)}
                                          data-testid={`group-edit-create-${gi}`}
                                        >
                                          Edit name &amp; details
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 flex-wrap gap-1">
                                    {sample.autoResolved && sample.resolutionStatus === 'resolved' && (
                                      <Button
                                        small
                                        onClick={() =>
                                          handleRevertAutoResolvedGroup(group.groupKey)
                                        }
                                        data-testid={`group-revert-auto-${gi}`}
                                        title="Undo auto-resolution and choose manually"
                                      >
                                        Undo
                                      </Button>
                                    )}
                                    <Button
                                      small
                                      variant="primary"
                                      onClick={() => setMatchPickerGroupKey(group.groupKey)}
                                      data-testid={`group-match-${gi}`}
                                    >
                                      Match household
                                    </Button>
                                    <Button
                                      small
                                      onClick={() => {
                                        setCatalogSearch('');
                                        setCatalogPickerGroupKey(group.groupKey);
                                      }}
                                      data-testid={`group-catalog-${gi}`}
                                    >
                                      Pick from catalog
                                    </Button>
                                    <Button
                                      small
                                      onClick={() => openCreateModalForGroup(group.groupKey)}
                                      data-testid={`group-create-${gi}`}
                                    >
                                      {sample.createDraft ? 'Edit create' : 'Create new'}
                                    </Button>
                                    <Button
                                      small
                                      onClick={() =>
                                        applyResolutionToGroup(group.groupKey, { kind: 'ignore' })
                                      }
                                      data-testid={`group-ignore-${gi}`}
                                    >
                                      Ignore all
                                    </Button>
                                  </div>
                                </div>

                                <div className="mt-3 space-y-2 border-t border-border-light pt-2">
                                  <p className="text-[10px] font-medium uppercase text-text-muted">
                                    {group.lines.length > 1 ? 'Per-line override' : 'Source line'}
                                  </p>
                                  {group.lines.length === 1 && (
                                    <p className="text-[11px] text-text-muted">
                                      Resolve this ingredient using the buttons above; per-line
                                      actions appear when the same name appears in more than one
                                      recipe line.
                                    </p>
                                  )}
                                  {group.lines.map((ref, j) => {
                                    const line = ref.line;
                                    const globalRecipeIdx = ref.globalRecipeIdx;
                                    const lineIdx = ref.lineIdx;
                                    const lineKey = `${globalRecipeIdx}-${lineIdx}-${j}`;
                                    return (
                                      <div
                                        key={lineKey}
                                        data-testid={`review-line-${gi}-${j}`}
                                        className="rounded border border-border-light/60 bg-bg/40 p-2"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
                                            {line.recipeName}: {line.raw}
                                          </span>
                                          {group.lines.length > 1 && (
                                            <Select
                                              value={line.action}
                                              onChange={(e) => {
                                                const v = e.target.value as PaprikaReviewLine['action'];
                                                const patch: Partial<PaprikaReviewLine> = {
                                                  action: v,
                                                };
                                                if (v === 'use' && line.matchedIngredient) {
                                                  patch.manualIngredientId = line.matchedIngredient.id;
                                                }
                                                if (
                                                  v === 'create' &&
                                                  line.status === 'unmatched' &&
                                                  !line.matchedCatalog
                                                ) {
                                                  patch.matchedIngredient = null;
                                                  patch.matchedCatalog = null;
                                                }
                                                updateReviewLine(globalRecipeIdx, lineIdx, patch);
                                              }}
                                              className="w-[min(100%,10rem)] py-1 text-xs"
                                              data-testid={`review-action-${gi}-${j}`}
                                            >
                                              {line.action === 'pending' && (
                                                <option value="pending">Needs resolution</option>
                                              )}
                                              {(line.matchedIngredient || line.manualIngredientId) && (
                                                <option value="use">Use household match</option>
                                              )}
                                              <option value="create">
                                                {line.matchedCatalog
                                                  ? 'Add from catalog'
                                                  : 'Create new (manual)'}
                                              </option>
                                              <option value="ignore">Ignore</option>
                                            </Select>
                                          )}
                                          {line.action === 'create' && !line.matchedCatalog && (
                                            <Select
                                              value={line.newCategory}
                                              onChange={(e) =>
                                                updateReviewLine(globalRecipeIdx, lineIdx, {
                                                  newCategory: e.target.value as IngredientCategory,
                                                })
                                              }
                                              className="w-[min(100%,7.5rem)] py-1 text-xs"
                                              data-testid={`review-category-${gi}-${j}`}
                                            >
                                              {CATEGORY_OPTIONS.map((c) => (
                                                <option key={c} value={c}>
                                                  {c}
                                                </option>
                                              ))}
                                            </Select>
                                          )}
                                        </div>
                                        {line.createDraft && (
                                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-light/50 pt-2">
                                            <p className="text-[11px] text-text-secondary">
                                              <span className="text-text-muted">Will create as </span>
                                              <span
                                                className="font-medium text-text-primary"
                                                data-testid={`review-line-create-canonical-${gi}-${j}`}
                                              >
                                                {toSentenceCase(
                                                  normalizeIngredientName(line.createDraft.canonicalName),
                                                )}
                                              </span>
                                            </p>
                                            <Button
                                              type="button"
                                              small
                                              onClick={() => openCreateModalForGroup(group.groupKey)}
                                              data-testid={`review-line-edit-create-${gi}-${j}`}
                                            >
                                              Edit
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>

          {reviewGroups.length === 0 &&
            (reviewFilter === 'ambiguous' || reviewFilter === 'exceptions') && (
              <EmptyState>No exceptions to review. All ingredients are resolved.</EmptyState>
            )}

          <AppModal
            open={matchPickerGroupKey !== null}
            onClose={() => setMatchPickerGroupKey(null)}
            ariaLabel="Match household ingredient"
            className="max-w-md p-4"
            panelTestId="paprika-match-modal"
          >
            <h3 className="mb-2 text-base font-semibold text-text-primary">
              Match household ingredient
            </h3>
            <p className="mb-3 text-xs text-text-muted">
              Search and pick the household ingredient for this group (apply to all occurrences).
            </p>
            <PaprikaIngredientPicker
              ingredients={allPickerIngredients}
              onSelect={(ing) => {
                if (matchPickerGroupKey) {
                  if (ing.id.startsWith('pending-create:')) {
                    const sourceKey = ing.id.slice('pending-create:'.length);
                    const sourceLine = findReviewLineByGroupKey(
                      parsedRecipes,
                      sourceKey,
                      (l) => !!l.createDraft,
                    );
                    if (sourceLine?.createDraft) {
                      applyResolutionToGroup(matchPickerGroupKey, {
                        kind: 'create',
                        draft: sourceLine.createDraft,
                      });
                    }
                  } else {
                    applyResolutionToGroup(matchPickerGroupKey, {
                      kind: 'use',
                      ingredientId: ing.id,
                      ingredient: ing,
                    });
                  }
                }
                setMatchPickerGroupKey(null);
              }}
            />
          </AppModal>

          <AppModal
            open={catalogPickerGroupKey !== null}
            onClose={() => setCatalogPickerGroupKey(null)}
            ariaLabel="Add from catalog"
            className="max-w-md p-4"
            panelTestId="paprika-catalog-modal"
          >
            <h3 className="mb-2 text-base font-semibold text-text-primary">Add from catalog</h3>
            <Input
              value={catalogSearch}
              onChange={(e) => {
                setCatalogSearch(e.target.value);
                catalogKeyNav.setActiveIndex(-1);
              }}
              onKeyDown={catalogKeyNav.onKeyDown}
              placeholder="Search catalog…"
              className="mb-2"
            />
            <ul
              ref={catalogKeyNav.listRef as React.RefObject<HTMLUListElement>}
              className="max-h-52 space-y-1 overflow-y-auto rounded border border-border-light bg-bg p-1 text-sm"
            >
              {catalogResults.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`w-full rounded px-2 py-1.5 text-left transition-colors ${
                      catalogKeyNav.activeIndex === i
                        ? 'bg-bg-elevated ring-1 ring-brand'
                        : 'hover:bg-bg-elevated'
                    }`}
                    onClick={() => {
                      if (catalogPickerGroupKey) {
                        applyResolutionToGroup(catalogPickerGroupKey, {
                          kind: 'catalog',
                          catalogItem: item,
                        });
                      }
                      setCatalogPickerGroupKey(null);
                    }}
                    onMouseEnter={() => catalogKeyNav.setActiveIndex(i)}
                  >
                    {toSentenceCase(item.name)}
                  </button>
                </li>
              ))}
            </ul>
          </AppModal>

          <AppModal
            open={createGroupKey !== null}
            onClose={() => setCreateGroupKey(null)}
            ariaLabel="Create new ingredient"
            className="max-w-md p-4"
            panelTestId="paprika-create-modal"
          >
            <h3 className="mb-1 text-base font-semibold text-text-primary">
              {editingCreateDraft ? 'Edit new ingredient' : 'Create new ingredient'}
            </h3>
            <p className="mb-3 text-xs text-text-muted">
              This name appears on the review card after you apply (sentence case in the UI; stored
              in lowercase).
            </p>
            <div className="space-y-2">
              <FieldLabel label="Canonical name">
                <Input
                  value={createForm.canonicalName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, canonicalName: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitCreateIngredientModal();
                    }
                  }}
                  data-testid="paprika-create-canonical"
                />
              </FieldLabel>
              <FieldLabel label="Category">
                <Select
                  value={createForm.category}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      category: e.target.value as IngredientCategory,
                    }))
                  }
                  className="w-full"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <FieldLabel label="Tags (comma-separated)">
                <TagSuggestInput
                  mode="comma"
                  value={createForm.tags}
                  onChange={(tags) => setCreateForm((f) => ({ ...f, tags }))}
                  suggestions={existingTagSuggestions}
                  inputTestId="paprika-create-tags"
                  onSubmitPlain={submitCreateIngredientModal}
                />
              </FieldLabel>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={createForm.retainImportAlias}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, retainImportAlias: e.target.checked }))
                  }
                  data-testid="paprika-create-alias"
                />
                Keep imported wording as import alias tag
              </label>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="primary"
                  onClick={submitCreateIngredientModal}
                  data-testid="paprika-create-submit"
                >
                  {editingCreateDraft ? 'Save changes' : 'Apply to group'}
                </Button>
                <Button onClick={() => setCreateGroupKey(null)}>Cancel</Button>
              </div>
            </div>
          </AppModal>

          <AppModal
            open={duplicateDialog !== null}
            onClose={() => setDuplicateDialog(null)}
            ariaLabel="Possible duplicate ingredient"
            className="max-w-sm p-4"
            panelTestId="paprika-duplicate-modal"
          >
            <h3 className="mb-2 text-base font-semibold text-text-primary">
              Ingredient may already exist
            </h3>
            <p className="mb-3 text-sm text-text-secondary">
              &quot;{duplicateDialog?.draft.canonicalName}&quot; matches existing household
              ingredient &quot;
              {duplicateDialog?.existing.name}&quot;.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  if (!duplicateDialog) return;
                  applyResolutionToGroup(duplicateDialog.groupKey, {
                    kind: 'use',
                    ingredientId: duplicateDialog.existing.id,
                    ingredient: duplicateDialog.existing,
                  });
                  setDuplicateDialog(null);
                  setCreateGroupKey(null);
                }}
                data-testid="paprika-dup-use-existing"
              >
                Use existing
              </Button>
              <Button
                onClick={() => {
                  if (!duplicateDialog) return;
                  applyResolutionToGroup(duplicateDialog.groupKey, {
                    kind: 'create',
                    draft: duplicateDialog.draft,
                  });
                  setDuplicateDialog(null);
                  setCreateGroupKey(null);
                }}
                data-testid="paprika-dup-create-anyway"
              >
                Create new anyway
              </Button>
            </div>
          </AppModal>

          <AppModal
            open={batchCreatePreviewOpen}
            onClose={() => setBatchCreatePreviewOpen(false)}
            ariaLabel="Create all unmatched ingredients"
            className="max-w-lg p-4"
            panelTestId="paprika-batch-create-modal"
          >
            <h3 className="mb-2 text-base font-semibold text-text-primary">
              Create unmatched ingredients
            </h3>
            {batchCreateRows.length === 0 ? (
              <p className="text-sm text-text-secondary">No unmatched ingredients to create.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-text-secondary">
                  {batchCreateRows.length} ingredient
                  {batchCreateRows.length !== 1 ? 's' : ''} will be created. You can adjust
                  categories before confirming.
                </p>
                <div className="mb-4 max-h-64 space-y-1 overflow-y-auto">
                  {batchCreateRows.map((group) => {
                    const sample = group.lines[0]!.line;
                    const cat = batchCreateCategories[group.groupKey] ?? sample.newCategory;
                    return (
                      <div
                        key={group.groupKey}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm odd:bg-surface-secondary"
                      >
                        <span className="min-w-0 truncate text-text-primary">{sample.name}</span>
                        <Select
                          value={cat}
                          onChange={(e) =>
                            setBatchCreateCategories((prev) => ({
                              ...prev,
                              [group.groupKey]: e.target.value as IngredientCategory,
                            }))
                          }
                          className="w-28 shrink-0 py-1 text-xs"
                          aria-label={`Category for ${sample.name}`}
                          data-testid={`batch-cat-${group.groupKey}`}
                        >
                          {CATEGORY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={handleBatchCreateAll}
                    disabled={batchCreateRows.length === 0}
                    data-testid="batch-create-confirm"
                  >
                    Create {batchCreateRows.length} ingredient
                    {batchCreateRows.length !== 1 ? 's' : ''}
                  </Button>
                  <Button onClick={() => setBatchCreatePreviewOpen(false)}>Cancel</Button>
                </div>
              </>
            )}
          </AppModal>

          <div className="mt-4">
            <ActionGroup>
              <Button
                variant="primary"
                onClick={handleSaveAll}
                disabled={!canFinalizePaprikaImport(parsedRecipes)}
                data-testid="import-save-all-btn"
              >
                Import {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? 's' : ''}
              </Button>
              <Button
                onClick={() => {
                  setStep('select');
                }}
              >
                Back to selection
              </Button>
              <Button
                onClick={() => {
                  navigate(`/household/${householdId}/home`);
                }}
                data-testid="pause-import-btn"
              >
                Save &amp; resume later
              </Button>
            </ActionGroup>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div data-testid="paprika-done-step">
          <Card className="mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Import complete</h3>
            <p className="text-sm text-text-secondary">
              Successfully imported {importedCount} recipe{importedCount !== 1 ? 's' : ''} from
              Paprika.
            </p>
          </Card>
          {postImportBatchId && postImportRecipes.length > 0 && householdId ? (
            <PostImportPaprikaCategories
              key={postImportBatchId}
              householdId={householdId}
              importedRecipes={postImportRecipes}
              onComplete={() => navigate(`/household/${householdId}/recipes`)}
            />
          ) : (
            <ActionGroup>
              <Button
                variant="primary"
                onClick={() => navigate(`/household/${householdId}/recipes`)}
                data-testid="go-to-recipes-btn"
              >
                View recipe library
              </Button>
              <Button onClick={() => navigate(`/household/${householdId}/home`)}>Home</Button>
            </ActionGroup>
          )}
        </div>
      )}
    </>
  );
}
