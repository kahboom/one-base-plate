const fs = require('fs');
const path = './src/pages/IngredientManager.tsx';
let content = fs.readFileSync(path, 'utf8');

const startStr = '/* ---------- Ingredient edit modal ---------- */\nfunction IngredientModal({';
const endStr = '/* ---------- Bulk delete confirmation dialog ---------- */';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find start or end index');
  process.exit(1);
}

const newModal = `/* ---------- Ingredient edit modal ---------- */
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
                        aria-label={\`Remove alias \${a}\`}
                        data-testid={\`alias-remove-\${a.replace(/\\s+/g, '-')}\`}
                        onClick={() => removeAlias(a)}
                        className="ml-1 text-text-muted hover:text-danger"
                      >
                        ✕
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
                        className="h-4 w-4 rounded border-gray-300 accent-brand"
                        checked={ingredient.freezerFriendly}
                        onChange={(e) => onChange({ ...ingredient, freezerFriendly: e.target.checked })}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">Freezer friendly ❄️</span>
                      <span className="text-xs text-text-muted">Can be stored in the freezer for later use</span>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 transition-colors hover:bg-bg">
                    <div className="flex h-5 items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 accent-brand"
                        checked={ingredient.babySafeWithAdaptation}
                        onChange={(e) =>
                          onChange({ ...ingredient, babySafeWithAdaptation: e.target.checked })
                        }
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">Baby safe 🍼</span>
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
                          className="h-full w-full object-cover"
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
                          ✓ Using catalog default
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
                      data-testid={\`tag-\${tag}\`}
                      className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-info-text"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:text-info-text/70">✕</button>
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
                      + {tag}
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
                    placeholder="Custom tag..."
                    className="flex-1"
                    onPick={(tag) => addTag(tag)}
                    onSubmitPlain={() => addTag(tagInput)}
                  />
                  <Button type="button" onClick={() => addTag(tagInput)}>
                    Add
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
                        aria-label={\`Remove family key \${fk}\`}
                        data-testid={\`family-key-remove-\${fk}\`}
                        onClick={() => removeFamilyKey(fk)}
                        className="ml-0.5 hover:text-warning-text/70"
                      >
                        ✕
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
                  key={\`\${ingredient.id}-\${mergeTarget.id}\`}
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
                            className={\`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors \${
                              mergeKeyNav.activeIndex === i
                                ? 'bg-brand/5 text-brand'
                                : 'hover:bg-bg'
                            }\`}
                            onClick={() => setMergeTarget(r)}
                            onMouseEnter={() => mergeKeyNav.setActiveIndex(i)}
                            data-testid={\`merge-result-\${r.id}\`}
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
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppModal>
  );
}
`;

const finalContent = content.substring(0, startIndex) + newModal + '\n' + content.substring(endIndex);
fs.writeFileSync(path, finalContent);
console.log('Successfully replaced modal');
