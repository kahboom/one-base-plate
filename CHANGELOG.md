### 2026-03-27 — Base meal theme tags editor (F069)

- **Base Meals** meal modal: optional **theme tags** under Planning metadata (chips, remove, typeahead from other meals’ tags, Add tag). Values trimmed + lowercased on add so they align with **Weekly theme nights** anchor `matchTags`. Separate header chip row `meal-theme-tag-chips` when tags exist; summary chips unchanged.
- **PRD** F069 (M5); **tests** `f005-base-meals`, `weekly-suggested-ranking`; **README** Base meal theme tags blurb.

### 2026-03-27 — Supabase sync hardening (F068 follow-up)

- **Auth / queue:** `setCurrentUserId` clears the in-memory incremental queue and timers on sign-out or user switch so pending work cannot flush under a different account. **`flushQueuedSync`** snapshots the user id at flush start and **aborts** the rest of the batch if the session changes mid-flush (discards remaining remote ops for that batch; local Dexie data unchanged).
- **Payloads:** `console.warn` when a household JSON snapshot is **≥ 256 KiB**; per-household `console.debug` payload size only **≥ 64 KiB** (quieter normal flushes).
- **Cleanup:** Removed no-op **`setLoadHouseholdsRef(loadHouseholds)`** from `main.tsx`; **`syncAfterSave`** JSDoc marked test/legacy-only. PRD F063 step + F068 steps updated; tests: sign-out clears queue, mid-flush sign-out, backoff retry, duplicate `online` events.

### 2026-03-27 — Safer Supabase sync (incremental queue, F068)

- **Cloud sync** no longer upserts every household on each local save. Edits queue **only the changed household**, coalesce rapid changes (~1s debounce), and **serialize** remote flushes so small Supabase instances are not overwhelmed. Reconnect flushes the **queued** set; transient failures use **backoff** instead of tight retries. JSON import, hydrate-from-remote, and one-time migrations stay **local-only** unless you use **Manual sync** or first-login push. Optional local-only mode when Supabase is not configured is unchanged.

### 2026-03-26 — Paprika category → curated recipe tags (F067)

- Requestor: product owner
- Reason: Paprika exports carry freeform `categories[]`; only a controlled subset should become `Recipe.tags` so the library stays aligned with the curated taxonomy, while originals remain available for provenance and re-import.
- Scope: **`src/lib/paprikaCategoryMap.ts`** — `normalizePaprikaCategory`, `PAPRIKA_CATEGORY_TAG_MAP` (aliases → curated values only), `mapPaprikaCategories` (deduped tags + `rawCategories` + `unmappedCount`). **`RecipeProvenance.rawCategories`** in [`src/types.ts`](src/types.ts). **`buildDraftRecipe`** in [`src/paprika-parser.ts`](src/paprika-parser.ts) sets `tags` and `provenance.rawCategories`. **Paprika import UI** ([`src/pages/PaprikaImport.tsx`](src/pages/PaprikaImport.tsx)): select-step preview (library tag chips + unmapped note); review-step collapsible summary. **Tests:** [`tests/f067-paprika-category-tags.test.ts`](tests/f067-paprika-category-tags.test.ts). **PRD** F067, data model, screen map; **agent-progress**.
- Files changed: `src/types.ts`, `src/lib/paprikaCategoryMap.ts` (new), `src/paprika-parser.ts`, `src/pages/PaprikaImport.tsx`, `tests/f067-paprika-category-tags.test.ts`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- New feature IDs: F067
- Data model changes: optional `RecipeProvenance.rawCategories?: string[]`

### 2026-03-26 — Recipe tag taxonomy, migrations, and library UI copy (F057/F066 follow-up)

- Requestor: product owner
- Reason: Default and cuisine-style tags did not match how recipes are used (mostly components); the product needed a broader curated vocabulary (soup, salad, seafood, etc.) without keeping obsolete defaults or “Entree” as a quick-pick.
- Scope: **No default `whole-meal` tag** — removed automatic tagging in `migrateHouseholdRecipeRefs` and removed Paprika draft `tags: ["whole-meal"]` in [`src/paprika-parser.ts`](src/paprika-parser.ts). **One-time storage migrations** (startup in [`src/main.tsx`](src/main.tsx)): `runStripWholeMealTagsIfNeeded` ([`STRIP_WHOLE_MEAL_TAGS_KEY`](src/storage/constants.ts)) strips stored `whole-meal`; `runStripThemeRecipeTagsIfNeeded` strips `taco`, `pizza`, `pasta` from recipe and base-meal tags. **Curated tags** in [`src/lib/recipeTags.ts`](src/lib/recipeTags.ts): added soup, salad, snack, bread, seafood; **`whole-meal` removed from the quick-pick list** — legacy JSON may still contain `whole-meal`; chips show **Whole meal** via `DEPRECATED_TAG_LABELS` until edited. **Seed/fixtures** ([`src/seed-data.json`](src/seed-data.json), [`fixtures/households/H001-mcg.json`](fixtures/households/H001-mcg.json)): dropped theme tags; added **Simple tomato soup** recipe; tray pizza may still carry `whole-meal` for demo. **UI copy** for `BaseMeal.recipeRefs`: **Library recipes** / **Library recipe** in [`Planner.tsx`](src/pages/Planner.tsx), [`BaseMealManager.tsx`](src/pages/BaseMealManager.tsx), [`MealDetail.tsx`](src/pages/MealDetail.tsx), [`ComponentRecipePicker.tsx`](src/components/meals/ComponentRecipePicker.tsx), resolution labels in [`componentRecipes.ts`](src/lib/componentRecipes.ts). Tests: [`tests/f057-recipe-model.test.ts`](tests/f057-recipe-model.test.ts), [`tests/f066-recipe-tags.test.tsx`](tests/f066-recipe-tags.test.tsx), [`tests/f058-recipe-attachment-ux.test.ts`](tests/f058-recipe-attachment-ux.test.ts). **PRD** [`PRD.json`](PRD.json) curated-tag and feature steps reconciled.
- Files changed: `src/lib/recipeTags.ts`, `src/storage.ts`, `src/storage/constants.ts`, `src/main.tsx`, `src/paprika-parser.ts`, `src/pages/Planner.tsx`, `src/pages/BaseMealManager.tsx`, `src/pages/MealDetail.tsx`, `src/components/meals/ComponentRecipePicker.tsx`, `src/lib/componentRecipes.ts`, `src/seed-data.json`, `fixtures/households/H001-mcg.json`, tests above, `PRD.json`, `CHANGELOG.md`
- New feature IDs: none (extends F057/F066)
- Data model changes: none (`Recipe.tags` / `BaseMeal.tags` remain optional `string[]`; migration flags in localStorage only)

### 2026-03-26 — Recipe classification unified into tags (removed RecipeType)

- Requestor: product owner
- Reason: `Recipe.recipeType` overlapped with curated tags (e.g. sauce, batch-prep); `component` / `sub-recipe` values had no runtime behavior; `parentRecipeId` was unused. A single tagging model reduces confusion and duplicate scoring paths.
- Scope: Removed `RecipeType` union, `Recipe.recipeType`, and `Recipe.parentRecipeId` from [`src/types.ts`](src/types.ts). Added `whole-meal` to curated tags in [`src/lib/recipeTags.ts`](src/lib/recipeTags.ts); replaced `recipeTypeContextScore` with `tagContextScore` (role vs sauce / batch-prep tags). `compareRecipesForSuggestion` no longer uses recipe-type substring match. [`src/lib/listSort.ts`](src/lib/listSort.ts): dropped `recipeType` sort key. [`src/lib/componentRecipes.ts`](src/lib/componentRecipes.ts): batch-prep detection uses `recipeHasTag(..., "batch-prep")`. [`src/paprika-parser.ts`](src/paprika-parser.ts): Paprika draft recipes get `tags: ["whole-meal"]`. [`src/storage.ts`](src/storage.ts): `sanitizeRecipe()` strips legacy JSON fields and maps old `recipeType` to tags; migration adds `whole-meal` tag for provenance recipes without a legacy type; `RecipeRefMigrationResult.wholeMealTagsAdded` replaces `recipeTypesInferred`. UI: removed recipe-type chip from [`ComponentRecipePicker`](src/components/meals/ComponentRecipePicker.tsx) and [`MealDetail`](src/pages/MealDetail.tsx); removed recipe-kind select from Recipe Library Organization section. Seed/fixtures: removed `recipeType` fields; added `whole-meal` / `sauce` tags where needed. Tests: [`tests/f057-recipe-model.test.ts`](tests/f057-recipe-model.test.ts), [`tests/f058-recipe-attachment-ux.test.ts`](tests/f058-recipe-attachment-ux.test.ts), [`tests/f066-recipe-tags.test.tsx`](tests/f066-recipe-tags.test.tsx). PRD Recipe entity + F057/F066 steps updated.
- Files changed: `src/types.ts`, `src/lib/recipeTags.ts`, `src/lib/listSort.ts`, `src/lib/componentRecipes.ts`, `src/paprika-parser.ts`, `src/storage.ts`, `src/pages/RecipeLibrary.tsx`, `src/components/meals/ComponentRecipePicker.tsx`, `src/pages/MealDetail.tsx`, `src/seed-data.json`, `fixtures/households/H001-mcg.json`, tests above, `PRD.json`, `CHANGELOG.md`
- New feature IDs: none (refactor of F057/F066 model)
- Data model changes: **removed** `Recipe.recipeType`, `Recipe.parentRecipeId`; optional `Recipe.tags` remains the sole classification surface (adds curated value `whole-meal`)

### 2026-03-26 — Lightweight recipe organization tags (F066)

- Requestor: product owner
- Reason: Recipe library needed optional curated tags for light filtering and attach-recipe scannability without a heavyweight tag-management system or noisy modals.
- Scope: Added `src/lib/recipeTags.ts` with curated tag list (quick, batch-prep, freezer-friendly, rescue, side, sauce, kid-friendly, prep-ahead), legacy alias normalization (`batch-friendly` → `batch-prep`, `rescue-friendly` → `rescue`), `computeTagBoost` / `recipeTypeContextScore` / `compareRecipesForSuggestion` for weak tie-break ranking. Recipe library: compact tag filter bar, tag chips on rows when present. Recipe modal: collapsed Organization section with tappable curated chips; unknown tags remain stored but are not in the picker. `ComponentRecipePicker`: up to two tag chips per recipe row, optional `contextRole` / `rescueMode`, within-group sort using name + type context + soft tag boost. Seed: `prep-ahead` on roasted broccoli, `kid-friendly` on cheese sauce in H001 fixture; regenerated `src/seed-data.json`. Tests: `tests/f066-recipe-tags.test.tsx`. PRD F066, screen maps S002/S004/S007/S010.
- Files changed: `src/lib/recipeTags.ts` (new), `src/pages/RecipeLibrary.tsx`, `src/components/meals/ComponentRecipePicker.tsx`, `src/components/meals/ComponentForm.tsx`, `src/pages/Planner.tsx`, `fixtures/households/H001-mcg.json`, `src/seed-data.json`, `tests/f066-recipe-tags.test.tsx`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- New feature IDs: F066
- Data model changes: none (`Recipe.tags` already optional `string[]`)

### 2026-03-25 — Household-manageable ingredient aliases for import and search (F065)

- Requestor: product owner
- Reason: Users need alternate names (cilantro / coriander, courgette / zucchini) so recipe and Paprika imports match the right household ingredient without duplicating rows or changing the canonical display name. Catalog aliases (F059) alone cannot capture household-specific wording.
- Scope: Optional `aliases?: string[]` on `Ingredient` with the same normalization rules as canonical names; persistence via existing household save paths; `mergeDuplicateMetadata` unions aliases on merge; `sanitizeIngredientAliasesAgainstHousehold` strips alias/cross-name collisions on save. Tiered `matchIngredient`: collect household canonical and alias candidates, then per catalog item take the best of canonical vs alias scores (preserving F064-style combined catalog scoring), then pick global winner by score with tie-break household canonical → household alias → catalog canonical → catalog alias. Ingredient Manager modal “Also matches” with validation before add and on Done. Browse search, `IngredientCombobox`, and base-meal alternative picker use `ingredientMatchesQuery`. Catalog `Passata` gains alias `tomato passata` for import matching. PRD `S010`/`S007` updated. Tests: `tests/f065-ingredient-aliases.test.tsx`; small fixture/assertion updates in f002/f004/f039/f044/f047 for normalized household fields and catalog copy (`Tortillas` vs legacy “Wraps / tortillas”).
- Files changed: `src/types.ts`, `src/storage.ts`, `src/recipe-parser.ts`, `src/catalog.ts`, `src/pages/IngredientManager.tsx`, `src/components/IngredientCombobox.tsx`, `src/components/meals/ComponentForm.tsx`, `tests/f065-ingredient-aliases.test.tsx` (new), `tests/f002-household.test.tsx`, `tests/f004-ingredients.test.tsx`, `tests/f039-import-export.test.tsx`, `tests/f044-ingredient-catalog.test.tsx`, `tests/f047-ingredient-migration.test.tsx`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- New feature IDs: F065
- Data model changes: `Ingredient.aliases` optional string array

### 2026-03-24 — Paprika parser and matcher hardening for import quality (F064)

- Requestor: product owner
- Reason: Paprika bulk import produced noisy canonical names (packaging words, size descriptors, trailing quantities leaking into names) and weak matching (singular/plural splits, accent destruction, tomato-family variants unmatched, compound names like coconut milk matching generic milk). Manual cleanup at scale was too high.
- Root causes: `normalizeForMatch` stripped all non-ASCII via `[^a-z0-9\s]`; `stripRedundantPackagingLead` only fired when the parsed unit was also a packaging word; no trailing quantity detection; no embedded size/dimension stripping; no singular/plural normalization; no compound-name protection beyond a small set; style/cooking descriptors blocked matching.
- Scope: Unconditional packaging-word stripping (can/jar/pack/bag/bottle/tin/box/carton/container/packet) from canonical names regardless of parsed unit. Trailing quantity detection for patterns like "chicken stock 200ml", "baby leeks 6", "olive oil 100ml". Embedded size/dimension stripping for "6-inch", "14.5 ounce", "2-pound", "1/2-inch-thick" patterns. Size adjective stripping (large/small/medium/big/jumbo/extra-large) moved to prep notes. Enhanced suffix stripping for "for serving", "to serve", "in water", "in brine", "cut into wedges", "drained but liquid reserved". Pre-unit size modifier detection so "1-2 large pieces of kale" correctly parses unit=pieces, name=kale. Unicode preservation in `normalizeForMatch` via `\p{L}\p{N}` Unicode property escapes. New `singularize()` function for matching normalization (tomatoes→tomato, potatoes→potato, leeks→leek). New `normalizeForMatching()` two-layer normalization separating display names from matching keys. Style-word stripping for matching (italian/stewed/roasted/cooked/plum/baby/vine/hot). Compound-name protection expanded: coconut milk, chicken/beef/vegetable stock/broth, olive/sesame oil, taco seasoning, peanut butter, tomato paste/sauce. Tomato-family matching via catalog aliases and style-stripped matching. GENERIC_HEADS expanded with milk/oil/stock/broth/sauce/seasoning/powder/spinach. Tortellini compound protection (prevents "spinach and ricotta tortellini" matching "spinach"). Catalog aliases added for tomatoes (chopped/plum/stewed/cherry/grape). 9 new catalog entries: chicken/vegetable/beef stock, leek, cabbage, kale, gnocchi, hamburger buns, tortellini. `normalizeIngredientGroupKey` updated with singularization so "tomato" and "tomatoes" produce the same group key. `PAPRIKA_INGREDIENT_PARSER_VERSION` bumped from 6 to 7. 75 new regression tests covering packaging stripping, trailing quantities, embedded sizes, size/descriptor stripping, singular/plural normalization, tomato family matching, unicode/accent preservation, compound name protection, and no-regression checks. Updated 3 existing F051 tests for intentional size-descriptor behavior change and 1 F047 test for pagination resilience with larger catalog. All 1,161 tests pass (70 files).
- Files changed: `src/recipe-parser.ts`, `src/paprika-parser.ts`, `src/storage.ts`, `src/catalog.ts`, `tests/f064-parser-matcher-hardening.test.ts` (new), `tests/f051-paprika-ingredient-parser-hardening.test.tsx`, `tests/f047-ingredient-migration.test.tsx`, `tests/incremental-load-helpers.ts`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- New feature IDs: F064
- Data model changes: none (parsing/matching logic only)

### 2026-03-23 — Shared household access, invite flow, and safer sync/recovery UX (F063)

- Requestor: product owner
- Reason: Multiple signed-in people should be able to access the same household across browsers/devices. Sharing should be cheap and simple via invite codes. Sync state and recovery options should be visible to reduce fear of data loss.
- Scope: Added `household_invites` Supabase table with 8-char alphanumeric codes, configurable expiry, and usage limits (SQL migration `002_invites.sql`). Invite service module for create/accept/revoke/list operations. Extended `SyncState` with dirty tracking (`hasPendingChanges`), network awareness (`online`), and error classification (`auth_expired`, `remote_unavailable`, `unknown`). Enhanced sync engine with offline detection via `navigator.onLine`, auto-retry on reconnect, `manualSync()` with remote comparison, and `compareWithRemote()` for conflict detection. Fixed session restore so `setCurrentUserId` is called in `AuthProvider` on mount and auth state changes (sync now works after page refresh). Added `/invite/:code` route and `AcceptInvite` page for invite acceptance flow. Added `HouseholdSharingPanel` component on Settings: member list with roles, generate invite link with copy, revoke invite, remove member (owner), leave household (editor). Added `SyncRecoveryPanel` component on Settings: rich sync status chips (synced/syncing/pending/offline/error with guidance), manual sync button, export backup download, re-download from cloud with explicit confirm dialog, conflict resolution dialog for remote-newer scenarios. Updated `AuthUI` sync badge to reflect all enhanced states. Added remote repository functions for member management (`fetchHouseholdMembers`, `removeHouseholdMember`, `fetchRemoteHouseholdById`). Added `useOnlineStatus` React hook, storage helpers (`replaceLocalWithRemote`, `downloadHouseholdsBackup`). 21 new tests covering sync state defaults, dirty tracking, error classification, offline dirty-state, sync retry after reconnect, manual sync, conflict detection, shared household membership, JSON export backup, signed-out regressions, and household data integrity. All 1086 tests pass (69 files).
- Files changed: `supabase/migrations/002_invites.sql`, `src/sync/types.ts`, `src/sync/sync-engine.ts`, `src/sync/remote-repository.ts`, `src/sync/invite-service.ts`, `src/hooks/useOnlineStatus.ts`, `src/components/HouseholdSharingPanel.tsx`, `src/components/SyncRecoveryPanel.tsx`, `src/components/AuthUI.tsx`, `src/pages/AcceptInvite.tsx`, `src/pages/Settings.tsx`, `src/App.tsx`, `src/main.tsx`, `src/auth/AuthContext.tsx`, `src/storage.ts`, `tests/f063-sharing-sync.test.ts`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`, `README.md`
- New feature IDs: F063
- Data model changes: New remote table `household_invites`. Extended `SyncState` type with `hasPendingChanges`, `online`, `errorKind`. New types `HouseholdMember`, `HouseholdInvite`, `HouseholdCompareResult`, `SyncErrorKind`. No changes to local Household type or Dexie schema.

### 2026-03-23 — Account-based cloud persistence with Supabase Auth and household snapshot sync (F062)

- Requestor: product owner
- Reason: Users need to access the same household data across browsers and devices. The app should support optional sign-in with cross-browser sync while preserving the existing local-first architecture for signed-out / offline use.
- Scope: Added `@supabase/supabase-js` with env-based configuration (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Supabase client singleton returns null when env vars are absent, so the app degrades gracefully to local-only mode. Auth service wraps Supabase Auth (email/password sign-up, sign-in, sign-out, session restore). React `AuthContext` + `useAuth` hook provide session state to the component tree. Remote data model uses three Supabase tables: `households` (JSONB aggregate snapshots), `household_memberships` (access control with owner/editor roles), and `profiles` (auto-created on sign-up). SQL migration reference file at `supabase/migrations/001_households.sql` with RLS policies. Sync engine coordinates local-first Dexie with remote Supabase: save locally first, then fire-and-forget upsert to remote. Conflict strategy is household-level last-write-wins via `updatedAt`. Safe first-login migration detects three scenarios (local-only, remote-only, both-sides) and shows an explicit chooser dialog when both local and remote have data. Auth UI added to Settings page with sign-in/sign-up tabs, session display, sync status badge, and sign-out. Signed-out mode preserves all existing local behavior unchanged. 22 new tests covering signed-out local-only regressions, authenticated sync, first-login migration (upload/hydrate/conflict), hydrateFromRemote, sync state tracking, and household access filtering. All 1078 tests pass (68 files).
- Files changed: `package.json`, `.gitignore`, `.env.example`, `src/config.ts`, `src/supabase/client.ts`, `src/auth/*`, `src/sync/*`, `src/storage.ts`, `src/storage/ports.ts`, `src/main.tsx`, `src/pages/Settings.tsx`, `src/components/AuthUI.tsx`, `src/components/FirstLoginMigrationDialog.tsx`, `supabase/migrations/001_households.sql`, `tests/f062-auth-sync.test.ts`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`, `README.md`
- New feature IDs: F062
- Data model changes: Remote tables only (households JSONB, household_memberships, profiles). No changes to local Household type or Dexie schema.

### 2026-03-23 — Local-first storage: Dexie IndexedDB, migration off localStorage, preserved seed (F061)

- Requestor: product owner
- Reason: Primary household data and large Paprika import drafts should not rely on scattered `localStorage` calls or ad hoc `idb` overflow paths; the codebase should expose a portable repository seam for a future React Native / SQLite adapter.
- Scope: Added Dexie (`onebaseplate_app` meta store) for households JSON and Paprika session strings. One-time idempotent v3 migration copies legacy `localStorage` households and legacy `idb` KV overflow data into Dexie without overwriting existing Dexie rows. Paprika `saveImportSession` / `loadImportSession` use memory hydrated at `initStorage()` plus async Dexie writes. `seedIfNeeded` remains driven by existing `src/seed-data.json` (same bundled fixture-derived content as before). Domain migration flags (`migrated_v1` / `v2`), default household id, and seeded flag stay on localStorage. Theme and guided tour remain documented lightweight localStorage. New modules under `src/storage/` (constants, Dexie db, legacy idb reader, migrate-v3, ports, paprika session store). `scripts/seed.ts` output updated for IndexedDB-first workflow. Tests: `fake-indexeddb` in `tests/setup.ts`, `tests/f062-storage-layer.test.ts`, updates to f013/f014/f039/f040/f049/f016/e2e/scaffold for fixture and assertion alignment.
- Files changed: `package.json`, `src/storage.ts`, `src/storage/*`, `src/main.tsx`, `src/paprika-parser.ts`, `scripts/seed.ts`, `tests/setup.ts`, `tests/f062-storage-layer.test.ts`, multiple test files, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- New feature IDs: F061
- Data model changes: none

### 2026-03-22 — Paginated ingredient table with bulk selection and safe bulk delete (F060)

- Requestor: product owner
- Reason: The Ingredients page used infinite scroll / load-more, which was poor for cleanup and maintenance of large ingredient libraries (100+ items from catalog + imports). Users needed to scan many items quickly, select in bulk, and safely delete junk ingredients without creating orphaned references.
- Scope: Replaced infinite-scroll `useIncrementalList` with a new `usePaginatedList` hook providing traditional page-based navigation (25/50/100 per page). Refactored `IngredientManager.tsx` in place with: sticky control bar, source filter (manual/catalog/imported), per-row selection checkboxes, select-all-on-page with indeterminate state, select-all-filtered, bulk actions bar, bulk delete confirmation dialog with reference-safety analysis. Created `findIngredientReferences()` utility that scans baseMeals, recipes, weeklyPlans, and importMappings for ingredient ID usage. Bulk delete dialog shows selected count, sample names, and classifies ingredients as protected (referenced) or deletable. Desktop rows show aligned columns (checkbox, thumbnail, name, category, tags, source, flags). Mobile uses compact stacked card layout. Selection persists across page and filter changes. Added 34 new tests covering pagination, selection persistence, bulk delete, reference protection, recovery states, and no-infinite-scroll assertions. Updated existing tests (f004, f037, f043, f044, f047) for pagination compatibility.
- Files changed: `src/pages/IngredientManager.tsx`, `src/hooks/usePaginatedList.ts` (new), `src/lib/ingredientRefs.ts` (new), `tests/f060-ingredient-bulk.test.tsx` (new), `tests/f004-ingredients.test.tsx`, `tests/f037-photos.test.tsx`, `tests/f043-ingredient-browse.test.tsx`, `tests/f044-ingredient-catalog.test.tsx`, `tests/f047-ingredient-migration.test.tsx`, `tests/incremental-load-helpers.ts`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- New feature IDs: F060
- Data model changes: none (no type changes; new utility function only)

### 2026-03-22 — Expanded seed content: broader catalog, example recipes, and wired base meals (F059)

- Requestor: product owner
- Reason: App seed data demonstrated only flat base meals with no recipe references. Needed richer examples that show the planning + cooking model (recipes as components of base meals, one base meal = many plates, alternative proteins, rescue meals).
- Scope: Added ~30 new ingredients to MASTER_CATALOG (taco, pizza, pasta bake, bowl, sauces, pantry basics). Added optional `aliases` field to `CatalogIngredient` for future import quality; updated `searchCatalog` to match aliases. Added 26 new household ingredients to H001 and 11 to H004. Seeded 10 example recipes (grilled taco chicken, black bean taco filling, yogurt-lime sauce, pizza dough, pizza sauce, tray pizza, pasta bake sauce, roasted broccoli, seasoned rice, cheese sauce). Seeded 5 example base meals (Taco night, Pizza night, Pasta bake, Rice bowl, Cheesy pasta rescue) with `recipeRefs` and component-level `ComponentRecipeRef` wiring. Meals include alternative proteins (black beans, tofu), rescue-eligible examples, and waste-reuse hints.
- Files changed: `src/catalog.ts`, `src/seed-data.json`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- New feature IDs: F059
- Data model changes: `CatalogIngredient.aliases` (optional)

### 2026-03-22 — First-class Recipe model with RecipeRef, typed categories, and migration (F057)

- Requestor: product owner
- Reason: Recipe was a flat library entry with no typed categories, no sub-recipe support, and no way to reference it from BaseMeal or Ingredient. ComponentRecipeRef lacked an explicit FK to Recipe.
- Scope: Added `RecipeType` union and `RecipeRef` type to `src/types.ts`. Enhanced `Recipe` with `recipeType`, `parentRecipeId`, `directions`, `tags`. Added `recipeRefs` on `BaseMeal` for whole-meal / assembly / shortcut recipe references. Added `recipeId` on `ComponentRecipeRef` as explicit FK to Recipe. Added `defaultRecipeRefs` on `Ingredient` as optional fallback. Added v2 storage migration (`migrateHouseholdRecipeRefs` / `runRecipeRefMigrationIfNeeded`) to backfill `recipeRefs` from `sourceRecipeId`, copy `importedRecipeSourceId` to `recipeId`, and infer `recipeType` for imported recipes. Updated `promoteRecipeToBaseMeal` to populate `recipeRefs`. Updated Paprika import to set `recipeType` and `directions` on Recipe. Added `recipeType` sort key. Added F057 to PRD.json with data model entities, milestones, implementation order, and screen mappings.
- Sections changed: types, storage, migration, lib helpers, Paprika parser, PRD, tests
- New feature IDs: F057
- Data model changes: RecipeType, RecipeRef, Recipe.recipeType/parentRecipeId/directions/tags, BaseMeal.recipeRefs, ComponentRecipeRef.recipeId, Ingredient.defaultRecipeRefs
- Files changed: `src/types.ts`, `src/storage.ts`, `src/main.tsx`, `src/lib/promoteRecipe.ts`, `src/lib/listSort.ts`, `src/paprika-parser.ts`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`, `tests/f057-recipe-model.test.ts`

### 2026-03-22 — PRD / spec reconciliation with implemented code (no product behavior change)

- Requestor: product owner
- Reason: `PRD.json` had drifted from the repo: F051 (Base Meal Editor UX refactor) was already implemented and tested but still marked `passes=false`; the embedded `dataModel` did not document cooking-first planner concepts already shipped under F055/F056 (`ComponentRecipeRef`, `DayPlan.componentRecipeOverrides`, `Household.weeklyAnchors`, recipe library `Recipe`, etc.).
- Scope: Updated `PRD.json` feature pass state and expanded/corrected `dataModel.entities` to match `src/types.ts` (flattened the accidental nested entity array; replaced stale import entity names with `ImportMapping` / `RecipeProvenance`; aligned `Ingredient`/`BaseMeal`/`MealComponent` with current fields; added `Household`, `DayPlan`, `WeeklyAnchor`, `ComponentRecipeRef`, `Recipe`, `GroceryItem`, `MealOutcome`, `RecipeLink`). Added `coreConcepts` entries for component recipe refs and weekly theme anchors. Adjusted one F049 acceptance line to reference `ImportMapping`.
- Files changed: `PRD.json`, `CHANGELOG.md`, `agent-progress.md`
- Mismatches fixed: F051 pass flag vs codebase; PRD `MealComponent` / `Ingredient` / `BaseMeal` vs `types.ts`; missing planner/household entities; `catalogItemId` vs `catalogId`; `importedRecipeSource` vs `provenance`; removed obsolete `ImportedRecipeSource` / `ImportedIngredientMatch` blocks in favor of shipped shapes (legacy persist notes kept on `AssemblyVariant` where extra keys may exist in old JSON).

### 2026-03-20 — Paprika bulk import exception-first grouped review (F050)

- Requestor: product owner
- Reason: Large Paprika imports need grouped resolution, explicit pending/low-confidence gates, searchable match/create flows, duplicate safeguards, and richer import audit without abandoning the existing session + provenance model.
- Scope: `matchIngredient` confidence bands; `PaprikaReviewLine` resolution state + `buildDraftMeal(..., householdIngredients)`; `applyGroupResolution` / `canFinalizePaprikaImport` / `migrateLegacyPaprikaRecipes`; grouped review UI with filters, modals, blocked Import; extended `ImportMapping`; Meal Detail mapping audit rows; `tests/f050-paprika-grouped-resolution.test.tsx`; F048/F049 test updates.
- Files changed: `src/recipe-parser.ts`, `src/paprika-parser.ts`, `src/types.ts`, `src/pages/PaprikaImport.tsx`, `src/pages/MealDetail.tsx`, `src/pages/Settings.tsx` (TS anchor form typing), `src/components/PaprikaIngredientPicker.tsx`, `tests/f048-paprika-import.test.tsx`, `tests/f049-bulk-paprika-review.test.tsx`, `tests/f050-paprika-grouped-resolution.test.tsx`, `tests/f056-theme-anchors.test.tsx`, `PRD.json`, `CHANGELOG.md`, `agent-progress.md`

### 2026-03-20 — Meal Planner choose/build/use + weekly theme anchors (F055, F056)

- Requestor: product owner
- Reason: Meal Planner needed a cooking-first selected-meal flow with component-level recipe refs and plan-time overrides; households need optional soft weekly theme anchors for suggestion ranking and day context.
- Scope: `ComponentRecipeRef`, stable `MealComponent.id` migration, `DayPlan.componentRecipeOverrides`, `Household.weeklyAnchors`, `src/lib/componentRecipes.ts`, `src/lib/weeklyPlanOps.ts`, theme tie-breaker in `rankWeeklySuggestedMeals`, Planner CTAs + How to make tonight + session overrides, Base Meal Editor recipe picker modal, Settings weekly anchors editor, Weekly Planner theme labels and match chips, tests.
- Files changed: `PRD.json`, `CHANGELOG.md`, `src/types.ts`, `src/storage.ts`, `src/main.tsx`, `src/planner.ts`, `src/lib/componentRecipes.ts`, `src/lib/weeklyPlanOps.ts`, `src/components/meals/ComponentRecipePicker.tsx`, `src/pages/Planner.tsx`, `src/pages/BaseMealManager.tsx`, `src/pages/WeeklyPlanner.tsx`, `src/pages/Settings.tsx`, `src/components/MealCard.tsx`, tests.

### 2026-03-20 — Browse-first Meal + Weekly planner (4/6/8 caps, shared modal, ranking tweak)

- Requestor: product owner
- Reason: align tray caps with mobile/tablet/desktop spec; avoid rendering full libraries on Meal Planner; pinned meals should not sit in failure-only deprioritization tier.
- Scope: `useSuggestedTrayCap` hook (640/1024 breakpoints), shared `BrowseMealsModal`, Meal Planner capped tray + browse parity, `rankWeeklySuggestedMeals` pinned exception for failure-only tier, tighter compact `MealCard`, tests (`planner-suggested-ui`, weekly UI/ranking, `f033`, `f042` matchMedia).
- Files changed: `src/hooks/useSuggestedTrayCap.ts`, `src/components/planner/BrowseMealsModal.tsx`, `src/pages/WeeklyPlanner.tsx`, `src/pages/Planner.tsx`, `src/planner.ts`, `src/components/MealCard.tsx`, `tests/weekly-planner-suggested-ui.test.tsx`, `tests/planner-suggested-ui.test.tsx`, `tests/weekly-suggested-ranking.test.ts`, `tests/f033-mobile.test.tsx`, `tests/f042-share-plan.test.tsx`, `CHANGELOG.md`

### 2026-03-19 — Weekly Planner capped suggested meals + browse library

- Requestor: product owner
- Reason: the suggested-meals tray rendered every base meal, overwhelming large libraries; suggestions were overlap-only and not aligned with learned signals.
- Scope: `rankWeeklySuggestedMeals` in planner engine, Weekly Planner tray UX (responsive cap, horizontal strip on small viewports), browse-all modal with search, effort filter, and pagination; MealCard `showActionsWhenCompact`; tests and PRD S003 / F054.
- Files changed: `src/planner.ts`, `src/pages/WeeklyPlanner.tsx`, `src/components/MealCard.tsx`, `tests/setup.ts`, `tests/weekly-suggested-ranking.test.ts`, `tests/weekly-planner-suggested-ui.test.tsx`, `tests/f010-weekly-plan.test.tsx`, `PRD.json`, `CHANGELOG.md`
- New feature IDs: F054
- UI spec changes: S003 Weekly Planner (subset tray, browse path, ranking, mobile strip)

### 2026-03-14 — Revamped navigation and ingredient workflow

- Requestor: product owner
- Reason: current ingredient management is too manual and too bulky; household navigation still looks visually weak and out of place
- Scope: navigation UX, ingredient manager UX, ingredient catalog, recipe import, data model
- Files changed: PRD.json, PRD-changelog.md
- Sections changed: features, implementationOrder, milestones, dataModel, uiSpec, screenToFeatureMap
- New feature IDs: F043, F044, F045, F046
- Reopened feature IDs: F036
- Removed/deprecated feature IDs: none
- Dependency changes: F043 depends on F036; F044 depends on F043; F045 depends on F044; F046 depends on F029, F044, F045
- Milestone changes: added M5 Ingredient workflow and recipe intake
- UI spec changes: added S010 Ingredient Manager
- Data model changes: Ingredient gains source and catalogItemId; added IngredientCatalogItem
- Notes: ingredient screen should be browse-first and compact; desktop may be table-like but must not become a dense spreadsheet UI

### 2026-03-17 — Reopen Paprika import for scale and parser hardening

- Requestor: product owner
- Reason: Paprika import already existed, but large libraries still required overly manual review and parser output still made obvious ingredient mistakes.
- Scope: PRD alignment for F049, Paprika bulk-review UX, resumable import drafts, ingredient-line parser hardening, audit metadata, and regression coverage.
- Files changed: PRD.json, src/recipe-parser.ts, src/paprika-parser.ts, src/pages/PaprikaImport.tsx, src/types.ts, tests/f049-bulk-paprika-review.test.tsx, agent-progress.md
- Sections changed: features, screenToFeatureMap, parser/matching, import session behavior, import mapping metadata, test coverage
- New feature IDs: none
- Reopened feature IDs: F049
- Removed/deprecated feature IDs: none
- Dependency changes: none
- Milestone changes: none (F049 remains in M5 after F048)
- UI spec changes: no new screens; wired F048/F049 into existing S007 and S010 screen mappings
- Data model changes: added prep metadata and richer import audit fields (quantity value/unit, cleaned ingredient name, prep notes, chosen action, final matched ingredient id) while preserving existing provenance and local-first storage behavior

### 2026-03-18 — Add focused S007 Base Meal Editor UX polish feature

- Requestor: product owner
- Reason: Base Meal Editor is functional but still feels like a long admin form; S007 needs a cleaner structure-first meal-building flow without changing core planner/storage behavior.
- Scope: PRD alignment for S007 UX refactor, compact component editing, alternatives UX clarity, section hierarchy, and calmer action design.
- Files changed: PRD.json
- Sections changed: features, milestones, implementationOrder, screenToFeatureMap
- New feature IDs: F051
- Reopened feature IDs: none
- Removed/deprecated feature IDs: none
- Dependency changes: F051 depends on F038, F035, F033
- Milestone changes: M5 now includes F051
- UI spec changes: no new screen; added explicit S007 polish feature mapped to S007
- Data model changes: none

### 2026-03-18 — Add focused S006 Create Household UX polish feature

- Requestor: product owner
- Reason: Create Household worked functionally but still felt like a bulky form with weak hierarchy and clunky member editing.
- Scope: PRD alignment for S006 in-place UX polish, compact member editing rows, lighter empty state, and clearer primary/secondary action hierarchy.
- Files changed: PRD.json
- Sections changed: features, milestones, implementationOrder, screenToFeatureMap
- New feature IDs: F052
- Reopened feature IDs: none
- Removed/deprecated feature IDs: none
- Dependency changes: F052 depends on F041, F035, F033
- Milestone changes: M5 now includes F052
- UI spec changes: no new screen; added explicit S006 polish feature mapped to S006
- Data model changes: none

### 2026-03-18 — Add global-vs-section navigation consistency feature

- Requestor: product owner
- Reason: nav hierarchy was ambiguous and mixed global app pages with section-level pages in one row, causing inconsistent wayfinding.
- Scope: PRD alignment for two-level navigation (global nav + section tabs), consistent placement across pages, and active-state clarity.
- Files changed: PRD.json
- Sections changed: features, milestones, implementationOrder, screenToFeatureMap
- New feature IDs: F053
- Reopened feature IDs: none
- Removed/deprecated feature IDs: none
- Dependency changes: F053 depends on F036
- Milestone changes: M5 now includes F053
- UI spec changes: no new screen; added explicit navigation-consistency feature mapped to S001/S003/S005/S006/S008/S010
- Data model changes: none
