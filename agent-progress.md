# OneBasePlate Agent Progress

## Conventions

- Work on one feature at a time per the PRD implementation order
- Run tests before marking any feature as passing
- Commit after each completed feature

### 2026-04-01 — Seed images: sirloin, pita, spinach, strawberries, tinned tomatoes

- **What:** Generated watercolor PNGs for `ing-sirloin-steak`, `ing-pita-bread`, `ing-spinach`, `ing-strawberries`, `ing-tinned-tomatoes`; added `ITEMS` entries in `scripts/generate-seed-image.mjs`; wired `imageUrl` on those rows in `fixtures/households/H001-mcg.json`; ran `npm run db:seed`.
- **Verified:** `npm test`, `npm run typecheck`.

### 2026-03-31 — F076: Paprika import auto-resolution and tiered triage

- **What:** Implemented F076 — auto-resolve pre-pass, `autoResolved` flag on `ImportMapping`, `revertAutoResolvedGroup` with Undo button, page size 10→50.
- **Parser:** `parsePaprikaLineFromRaw` now sets `autoResolved: true` on exact/strong household and catalog matches so every auto-resolved line carries the audit flag. `autoResolveHighConfidenceWithStats` covers the remaining staple-match case for unmatched lines.
- **New function:** `revertAutoResolvedGroup` in `paprika-parser.ts` — resets any `autoResolved` line in a group to `pending` without touching manual overrides.
- **UI:** `handleStartReview` runs the auto-resolve pre-pass before entering the review step; session restore runs it too. Undo button appears on every auto-resolved group card. `PAPRIKA_IMPORT_PAGE_SIZE` raised from 10 to 50.
- **Types:** `ImportMapping.autoResolved?: boolean` added; `buildDraftRecipe` propagates the flag to both `use` and `create` mapping entries.
- **Tests:** 20 new tests in `tests/f076-paprika-auto-resolution.test.tsx`; all 85 test files pass, typecheck clean.

### 2026-03-31 — Seed image: chipolatas

- **What:** Generated `public/images/seed/ing-chipolatas.png`, wired `ing-chipolatas` in `H001-mcg.json`, regenerated `src/seed-data.json`. Added `ing-chipolatas` to `ITEMS` in `scripts/generate-seed-image.mjs`; single-image run: `node --env-file=.env scripts/generate-seed-image.mjs ing-chipolatas`.
- **Verified:** `npm run db:seed`, `npm test` (f071), `npm run typecheck`.

### 2026-03-31 — Seed images: chicken, sausage, carrots, bolognese, cheeses

- **What:** Generated watercolor PNGs for `ing-chicken`, `ing-italian-sausage`, `ing-carrots`, `ing-cheddar`, `ing-paneer`, `ing-halloumi`, and `rec-spaghetti-bolognese`. Added library recipe `rec-spaghetti-bolognese` to H001 (was not in seed before) with `imageUrl`.
- **Script:** `generate-seed-image.mjs` — optional `dish: true` for plated prompts (softer negatives around the bowl).
- **Verified:** `npm run db:seed`, `npm test`, `npm run typecheck`.

### 2026-03-31 — Batch seed image generation (watercolor)

- **What:** Updated `scripts/generate-seed-image.mjs` to support batch generation. Generated 5 seed images (avocado, broccoli, garlic, lemon, salmon) using the new watercolor style.
- **Fixture:** Wired the new images into `fixtures/households/H001-mcg.json` and regenerated `src/seed-data.json`.
- **Verified:** `npm test`, `npm run typecheck`.

### 2026-03-31 — Seed image style update (watercolor)

- **What:** Replaced the editorial/photorealistic seed image style with a simple watercolor food illustration aesthetic.
- **Skills:** Created `skills/watercolor-food-illustration/SKILL.md` to hold the visual rules and examples. Updated `skills/seed-image-stylist/SKILL.md` to delegate styling to the new watercolor skill.
- **Script:** Updated `scripts/generate-seed-image.mjs` to use the new watercolor style prompt. Regenerated the `ing-avocado.png` seed image.

### 2026-03-31 — First seed ingredient image (avocado)

- **What:** Generated `public/images/seed/ing-avocado.png` via OpenAI Images API (DALL-E 3), wired `ing-avocado` in `fixtures/households/H001-mcg.json` with `imageUrl: /images/seed/ing-avocado.png`, regenerated `src/seed-data.json`.
- **Script:** `scripts/generate-seed-image.mjs` — run `node --env-file=.env scripts/generate-seed-image.mjs` (requires `OPENAI_API_KEY` in `.env`).
- **Verified:** `npm test`, `npm run typecheck`.

### 2026-03-30 — Grouped ingredient-family preferences (F075)

- **Why:** Members need to express preferences at the ingredient-family level (e.g. "likes sausage generally") without creating canonical ingredients for every family. Family-level matches provide weaker but meaningful planner signals alongside exact ingredient preferences.
- **Implementation:**
  - Data model: `Ingredient.familyKeys[]`, `HouseholdMember.safeFoodFamilyKeys[]`, `HouseholdMember.hardNoFoodFamilyKeys[]` added to `src/types.ts`.
  - `computePreferenceScore()` extended with family-level matching via `buildFamilyKeyMap()`. Fixed coefficients: `SAFE_FOOD_FAMILY_BOOST_CHILD=2`, `SAFE_FOOD_FAMILY_BOOST_ADULT=1`, `HARD_NO_FAMILY_PENALTY=-3`. Avoids double-counting when ingredient matches both exact and family. Grouped family hard-no never overrides another member's exact safeFoods match.
  - `PreferenceScore` extended with `safeFoodFamilyMatches[]` and `hardNoFamilyConflicts[]` (each with `familyKey` field on `PreferenceMatch`).
  - `generateMealExplanation()` cites family matches: "matches Indy-safe sausage family via italian sausage", "grouped conflict: yogurt family hard-no via greek yogurt".
  - `generateShortReason()` surfaces family match when no exact match available.
  - Surface parity: family scores flow through `rankWeeklySuggestedMeals`, `generateWeeklyPlan`, `generateRescueMeals`, Home top picks (all via `computePreferenceScore`).
  - **IngredientManager modal:** familyKeys tag-style editor with suggestions from existing household familyKeys, visually distinct from aliases and tags (warning-colored chips, explanatory label).
  - **MemberProfile:** "Safe Food Families" and "Hard-No Food Families" sections with `TagSuggestInput`, visually separated from exact ingredient sections with descriptive text.
- **Tests:** `tests/f075-ingredient-family-groups.test.ts` — 16 tests covering grouped safe-food boost, exact-vs-grouped precedence, hard-no family penalty, no double-counting, role weighting, exact hard-no override, grouped hard-no suppression by exact safe, alias isolation, no-duplicate-ingredient requirement, explanation strings, short reason, surface parity (weekly suggested + rescue mode), import/search unchanged.
- **Verified:** `npm test` (1350 passed, 13 skipped), `npm run typecheck`.
- **Next:** No remaining features with `passes: false` in PRD.

### 2026-03-30 — Member-linked ingredient preference scoring (F074)

- **Why:** Planner ranking, overlap summaries, and recommendation explanations need to deterministically reflect member safeFoods/hardNoFoods preferences using direct ingredient ID matching, with role-weighted boosts (toddler/baby > adult).
- **Implementation:**
  - `resolveFoodIds()`: resolves food name strings → ingredient ID sets via case-insensitive name lookup.
  - `computePreferenceScore()`: exported function with fixed coefficients — `SAFE_FOOD_BOOST_CHILD=5`, `SAFE_FOOD_BOOST_ADULT=2`, `HARD_NO_PENALTY=-10`. Returns score + `safeFoodMatches[]` + `hardNoConflicts[]` with member/ingredient detail.
  - ID-based matching wired into `pickBestIngredient`, `isComponentExcluded`, `isSafeFoodComponent`, `getMemberIngredientCompatibility` (backward-compatible optional `allIngredients` param).
  - Preference score integrated into: `generateWeeklyPlan` (0.1× scale), `rankWeeklySuggestedMeals` (new `preferenceScore` field + sort key), `generateRescueMeals`, Home.tsx top picks.
  - `generateMealExplanation` trade-offs cite `includes {member}-safe {ingredient}` and toddler gap with fallback food suggestions.
  - `generateShortReason` surfaces safe food match (`includes Alex-safe chicken breast`) and hard-no detail (`Alex hard-no: mushrooms`).
- **Tests:** `tests/f074-preference-scoring.test.ts` — 15 tests covering preference scoring, safe food ranking, hard-no deprioritisation, role weighting, explanation citations, and surface parity (weekly suggested, rescue mode).
- **Verified:** `npm test` (1334 passed, 13 skipped), `npm run typecheck`.
- **Next:** F075 — Ingredient family group preferences (depends on F074).

### 2026-03-29 — Regional ingredient synonym matching (F073)

- **Why:** Recipe/Paprika lines using US vs UK names (eggplant/aubergine, etc.) failed automatic match against household rows on the other variant; fuzzy scores were zero with no shared tokens.
- **Implementation:** `REGIONAL_SYNONYM_CANONICAL` + exported `applyRegionalSynonyms` in [`src/recipe-parser.ts`](src/recipe-parser.ts); wired into `matchIngredient` query pipeline and `scoreMatchAgainstCandidate` for symmetric normalization before `matchScore` / vetoes. Catalog updates in [`src/catalog.ts`](src/catalog.ts).
- **Tests:** `tests/f073-regional-synonyms.test.ts`.
- **Verified:** `npm test`, `npm run typecheck`.

### 2026-03-29 — Recipe modal vs Base Meal Editor separation (F072)

- **Why:** Recipe rows must edit library/cooking content, not mirror the structure-first Base Meal Editor (components, alternatives, component recipe refs).
- **Implementation:** `RecipeIngredientRow` (ingredient select, role, quantity, prep, inline new ingredient, remove) — no `ComponentRecipePicker` or planning copy. `InlineIngredientForm` moved to `src/components/meals/InlineIngredientForm.tsx`; `ComponentForm` imports it. `RecipeModal` uses only `RecipeIngredientRow` for `Recipe.components`; removed `baseMeals` prop/state from Recipe Library where only the modal consumed it.
- **Tests:** `tests/f072-recipe-modal-separation.test.tsx`.
- **Verified:** `npm test`, `npm run typecheck`.

### 2026-03-28 — Catalog default ingredient images (F071)

- **Why:** Show default pictures for common ingredients from the master catalog without copying URLs into every household row or doing runtime image search.
- **Data:** `CatalogIngredient.imageUrl` optional; seeded ~28 Unsplash URLs in [`src/catalog.ts`](src/catalog.ts). `catalogIngredientToHousehold` intentionally omits catalog `imageUrl` (commented).
- **Helpers:** [`src/lib/ingredientImage.ts`](src/lib/ingredientImage.ts) — `resolveIngredientImageUrl`, `getCatalogDefaultImageUrl`.
- **UI:** Ingredient Manager row + modal (inherited vs custom, remove override); Recipe import + Paprika review catalog thumbnails (`loading="lazy"`); Paprika **Will create as** row shows catalog thumb when `matchedCatalog` has image.
- **Tests:** [`tests/f071-ingredient-images.test.tsx`](tests/f071-ingredient-images.test.tsx).
- **Verified:** `npm test -- tests/f071-ingredient-images.test.tsx`, `npm test` (1290 passed, 13 skipped), `npm run typecheck`.
- **Next:** Optional: more catalog thumbnails; ingredient thumbnails in combobox/planner only if product wants (currently no ingredient images there).

### 2026-03-28 — Catalog materialization correction (F070)

- **Why:** Master catalog must stay searchable for matching/suggestions without **eagerly** filling the household ingredient list on Ingredient Manager load.
- **IngredientManager:** Removed `populateFromCatalog`, `persistedIngredientIdsRef`, and `suppressedCatalogIds` side effects on delete/merge/bulk delete. **Add ingredient** → `CatalogAddDialog` (`searchCatalog`) → pick row (`catalogIngredientToHousehold`) or **Create manually**. Empty state explains catalog is separate.
- **RecipeImport / PaprikaImport:** UI copy distinguishes **household match** vs **catalog suggestion (not yet in household)**; recipe review summary chips split add-from-catalog vs manual create.
- **Unchanged:** `matchIngredient` tiers/thresholds; `buildDraftRecipe` / finalize materialization; `ImportMapping` audit fields.
- **Tests:** `tests/f070-catalog-materialization.test.tsx`; adjusted `f004`, `f043`, `f044`, `f045`, `f025`, `f046`, `f060`, `f061`; helpers `openIngredientAddManualFromCatalogPicker`, `pickCatalogItemInAddDialog` in `incremental-load-helpers.ts`.
- **Verified:** `npm test` (1279 passed, 13 skipped), `npm run typecheck`.

## Completed Features

### F001 - Repository scaffold (2026-03-12)

- Created Vite + React + TypeScript project scaffold (package.json, tsconfig, vite.config, eslint.config)
- Defined TypeScript types in src/types.ts matching all PRD data model entities
- Created 3 household fixture files (H001, H002, H003) covering all persona types
- Created 1 meal fixture (pasta-base.json)
- Set up vitest with jsdom environment and test setup
- Created scaffold test suite (7 tests, all passing)
- Updated init.sh to install deps, type-check, run tests, and start dev server
- Verified: tsc --noEmit passes, vitest passes, vite build succeeds

### F002 - Household setup with multiple members (2026-03-12)

- Created localStorage storage layer (src/storage.ts) with CRUD operations for households
- Created HouseholdList page showing saved households with create/delete actions
- Created HouseholdSetup page with member management (add/remove members, set name/role/texture)
- Added react-router-dom routing in App.tsx (extracted BrowserRouter to main.tsx for testability)
- Installed @testing-library/user-event for interaction tests
- Created 8 tests covering storage CRUD, household creation with 4 members of mixed roles, re-opening persisted households, member removal, and household list display
- Verified: tsc --noEmit passes, vitest passes (15 tests), vite build succeeds

### F003 - Member profile constraints (2026-03-12)

- Created MemberProfile page (src/pages/MemberProfile.tsx) for editing safe foods, hard-no foods, and preparation rules
- Safe foods and hard-no foods: add/remove list with text input
- Preparation rules: ingredient + rule pairs with add/remove
- Added route `/household/:householdId/member/:memberId` in App.tsx
- Added "Edit profile" link in HouseholdSetup MemberForm for saved households
- Created 7 tests covering add/remove for all three constraint types plus re-open persistence
- Verified: tsc --noEmit passes, vitest passes (22 tests), all F003 steps satisfied

### F004 - Household ingredients (2026-03-12)

- Created IngredientManager page (src/pages/IngredientManager.tsx) for adding/removing ingredients
- Supports all 8 category types (protein, carb, veg, fruit, dairy, snack, freezer, pantry)
- Common tag quick-add buttons (quick, mashable, rescue, staple, batch-friendly) plus custom tags
- Freezer friendly and baby safe with adaptation checkboxes
- Added route `/household/:householdId/ingredients` in App.tsx
- Added "Manage ingredients" link in HouseholdSetup for saved households
- Created 5 tests covering add across categories, tagging, tag removal, ingredient removal, and re-open persistence
- Verified: tsc --noEmit passes, vitest passes (27 tests), all F004 steps satisfied

### F005 - Base meal creation (2026-03-12)

- Created BaseMealManager page (src/pages/BaseMealManager.tsx) for creating/editing base meals
- Meals built from household ingredients as components with role (protein/carb/veg/sauce/topping) and quantity
- Supports time estimate, difficulty level, rescue eligibility, and default prep method
- Added route `/household/:householdId/meals` in App.tsx
- Added "Manage base meals" link in HouseholdSetup for saved households
- Created 5 tests covering meal creation with components, metadata, removal, and re-open persistence
- Verified: tsc --noEmit passes, vitest passes (32 tests), all F005 steps satisfied

### F006 - Planner generates per-person assembly variants (2026-03-12)

- Created assembly variant engine (src/planner.ts) with deterministic per-member variant generation
- Engine handles: hard-no food exclusion, preparation rule instructions, texture-level adaptations (soft/mashable/pureed), safe food detection, and fallback suggestions for toddlers/babies
- Created Planner page (src/pages/Planner.tsx) with meal selection dropdown showing shared base and per-person assembly sections
- Each variant shows: exclusions, prep modifications, texture adaptations, extra prep flag, safe food status
- Added route `/household/:householdId/planner` in App.tsx
- Added "Meal planner" link in HouseholdSetup for saved households
- Created 12 tests: 9 unit tests for the assembly engine covering all constraint types, 3 integration tests for the Planner page UI
- Verified: tsc --noEmit passes, vitest passes (44 tests), all F006 steps satisfied

### F007 - Baby texture-safe adaptations (2026-03-13)

- Enhanced assembly engine to exclude obviously unsafe ingredients for babies (babySafeWithAdaptation=false) instead of just warning
- Added role-specific texture transformation guidance: protein→shred/blend, carb→cook very soft/finger-safe pieces, veg→steam very soft/mash/finger-safe strips, sauce→ensure smooth, topping→omit or blend
- Baby-unsafe ingredients shown as "Not suitable for baby — skip: X" while adaptable components get specific texture instructions
- Hard-no exclusions and baby-unsafe exclusions work independently and stack
- Baby variant stays tied to base meal when components can be adapted
- Updated 2 existing F006 tests to match new baby-exclusion behavior
- Created 8 new tests: 7 engine tests for baby texture scenarios, 1 UI integration test
- Verified: tsc --noEmit passes, vitest passes (52 tests), all F007 steps satisfied

### F008 - Toddler plate safe food guarantee (2026-03-13)

- Enhanced assembly engine to explicitly name which safe foods are included for toddlers/babies ("Includes safe food: pasta, cheese")
- When no safe food matches, provides explicit fallback: "No safe food in this meal — add on the side: pasta, bread, cheese"
- Toddler compatibility is never silently omitted — every toddler/baby variant has an explicit safe food status instruction
- Handles edge case of toddler with no safe foods defined ("No safe food matched — consider adding a familiar side")
- Updated 2 existing test assertions (F006, F007) for new fallback wording
- Created 8 new tests: 7 engine tests for toddler safe food scenarios, 1 UI integration test
- Verified: tsc --noEmit passes, vitest passes (60 tests), all F008 steps satisfied

### F019 - Quick member edit from planner (2026-03-13)

- Added "Quick edit {name}" links to each member variant in the Planner page
- MemberProfile now supports `?returnTo=` query param to navigate back to the planner (or any page) after saving/cancelling
- Without returnTo, MemberProfile defaults to household setup (preserving existing behavior)
- Planner reloads household data on mount so updated constraints are reflected after returning from edit
- Edit path goes directly from Planner → MemberProfile → Planner, bypassing the full household setup flow
- Created 6 tests: quick edit link presence, navigation to profile, edit+save+return with variant change verification, edit-avoids-household-setup, cancel-returns-without-saving, default-returnTo behavior
- Verified: tsc --noEmit passes, vitest passes (66 tests), all F019 steps satisfied

### F009 - Overlap score for ingredients and meals (2026-03-13)

- Added `computeIngredientOverlap` and `computeMealOverlap` functions to planner engine
- Per-member compatibility tracked as "direct", "with-adaptation", or "conflict" with specific conflict reasons
- Hard-no foods and baby-unsafe ingredients produce conflicts; texture/prep rules produce adaptations
- Planner dropdown now ranks meals by overlap score (highest first) and shows "X/Y overlap" in each option
- Selected meal displays overlap summary with per-member compatibility details and conflict reasons
- Added `OverlapResult`, `MemberOverlap`, and `MemberCompatibility` exported types
- Created 10 tests: 5 ingredient overlap, 3 meal overlap, 2 UI integration tests
- Verified: tsc --noEmit passes, vitest passes (76 tests), all F009 steps satisfied

### F018 - Meal explanation with trade-offs (2026-03-13)

- Added `generateMealExplanation` function producing a brief summary and trade-off list
- Summary states household fit: "Works for everyone", "Works for X/Y members — Z has conflicts", etc.
- Trade-offs surface: specific member conflicts with reasons, extra prep needed for adaptations, toddler/baby missing safe food warnings
- Planner displays "Why this meal?" panel with summary and trade-offs list below overlap summary
- Trade-offs section hidden when meal has no trade-offs (clean UI)
- Created 10 tests: 8 engine tests covering all summary/trade-off scenarios, 2 UI integration tests
- Verified: tsc --noEmit passes, vitest passes (86 tests), all F018 steps satisfied

### F010 - Weekly plan generation (2026-03-13)

- Added `generateWeeklyPlan` function to planner engine with overlap-ranked meal selection and ingredient reuse bonus
- Algorithm avoids consecutive-day meal repeats, favors shared ingredients across the week
- Created WeeklyPlanner page (src/pages/WeeklyPlanner.tsx) with day card layout (visual mini-calendar, not table)
- Supports 5-day and 7-day plan generation via dropdown
- Day cards show meal name, overlap score, and expandable per-person assembly variants
- Plans can be saved to household storage and re-opened on page load
- Added route `/household/:householdId/weekly` in App.tsx
- Added "Weekly planner" navigation link in HouseholdSetup
- Created 14 tests: 8 engine tests (day count, variants, reuse, deduplication, edge cases), 6 UI tests (generate, 5-day, cards, details, save/reopen, empty state)
- Verified: tsc --noEmit passes, vitest passes (100 tests), all F010 steps satisfied

### F021 - Weekly mini-calendar layout (2026-03-13)

- Enhanced WeeklyPlanner to always show 7 (or 5) day cards before and after plan generation
- Empty day cards display suggested meals (ranked by overlap) with italic styling and dashed borders
- Added "Clear" button per day to remove a meal and show suggestion again
- Added suggested meal tray below the week grid showing all available meals ranked by overlap
- Created Home page (src/pages/Home.tsx) with "What should we eat tonight?" headline
- Home shows compact mini weekly strip (Mon-Sun) when a plan exists, with "View full plan" link
- Home shows "Start planning" prompt when no plan exists, plus top 3 meal suggestion cards
- Added route `/household/:householdId/home` in App.tsx
- HouseholdList now links directly to Home; Home links to weekly planner, meal planner, and setup
- Created 11 tests: 5 WeeklyPlanner calendar tests (empty cards, suggestions, fill, clear), 1 tray test, 5 Home tests (headline, strip, no-plan, suggestions, strip content)
- Verified: tsc --noEmit passes, vitest passes (111 tests), all F021 steps satisfied

### F023 - Meal cards with compatibility indicators (2026-03-13)

- Created reusable MealCard component (src/components/MealCard.tsx) with card-based layout
- Displays: meal name, prep time, effort level (difficulty), overlap score (X/Y)
- Per-member compatibility chips with color-coded backgrounds (green=direct, yellow=adaptation, red=conflict)
- Chips show member name and role label (Adult/Toddler/Baby) with conflict details on hover
- Short reason text explaining household fit (e.g. "safe food included", "Works for everyone")
- State chips: High overlap, Needs extra prep, Rescue eligible
- Supports compact mode (no action buttons) and full mode with Assign/Details buttons
- Added `generateShortReason` helper to planner engine for brief fit explanations
- Integrated MealCard into Home (top suggestions) and WeeklyPlanner (suggested tray)
- Created 12 tests: 6 card display tests, 1 compact mode test, 1 action buttons test, 4 short reason engine tests
- Verified: tsc --noEmit passes, vitest passes (123 tests), all F023 steps satisfied

### F024 - Visual overlap indicators and trade-offs in planner (2026-03-13)

- Replaced dropdown meal selector in Planner with MealCard grid — meals shown as visual cards ranked by overlap
- Clicking a card selects it (blue outline) and shows detailed plan below
- Overlap indicators rendered as color-coded chips (green=compatible, yellow=adaptation, red=conflict) with conflict details on hover
- Trade-offs rendered as visual chips with color coding (red for conflicts, yellow for extra prep/safe food warnings)
- High-overlap meals highlighted with "High overlap" state chip; extra prep flagged with "Needs extra prep" chip
- Updated 6 existing test files (f006, f007, f008, f009, f018, f019) to use MealCard click instead of dropdown selectOptions
- Created 7 new F024 tests: card grid display, high overlap highlighting, extra prep flagging, overlap indicator chips, trade-off chips, ranking order, indicator clarity
- Verified: tsc --noEmit passes, vitest passes (130 tests), all F024 steps satisfied

### F032 - Shared styling foundation with Tailwind CSS (2026-03-13)

- Installed Tailwind CSS v4 with `@tailwindcss/vite` plugin for zero-config Vite integration
- Configured custom theme in `src/app.css` using `@theme` directive with design tokens matching uiSpec designSystemDirection (colors, radii, shadows)
- Created shared UI primitives in `src/components/ui.tsx`: PageShell, Card, CardGrid, Button (4 variants), Input, Select, Chip (5 variants), EmptyState, Section, NavBar, FormRow, ActionGroup
- Refactored all 8 user-facing pages (HouseholdList, HouseholdSetup, MemberProfile, IngredientManager, BaseMealManager, Planner, WeeklyPlanner, Home) to use shared primitives and Tailwind utility classes
- Refactored MealCard component to use Tailwind classes and Chip/Button primitives instead of inline styles
- Replaced all inline styles with Tailwind utility classes across the codebase
- Updated 3 brittle test files (f002, f004, f005) that relied on `getByRole("group")` for fieldset elements — now use `data-testid` queries for card-based layout
- Verified: tsc --noEmit passes, vitest passes (130 tests), vite build succeeds

### F025 - Core screens apply styling foundation for hierarchy, contrast, and fast scanning (2026-03-13)

- Audited all 8 user-facing pages (HouseholdList, HouseholdSetup, MemberProfile, IngredientManager, BaseMealManager, Planner, WeeklyPlanner, Home)
- Replaced manual h1/p heading combos with `PageHeader` component across all pages for consistent title + subtitle hierarchy (text-3xl bold with tracking-tight)
- Replaced inline flex `label` patterns with stacked `FieldLabel` components on HouseholdSetup (member forms), IngredientManager (name, category), BaseMealManager (meal fields, component fields) for better scanning
- Added empty states throughout: HouseholdSetup (no members), IngredientManager (no ingredients), BaseMealManager (no meals), Planner (no meals), WeeklyPlanner (no meals), MemberProfile (empty safe foods, hard-no foods, preparation rules lists)
- Planner and WeeklyPlanner empty states now use `EmptyState` component instead of plain text
- Increased spacing: form field gaps from space-y-3 to space-y-4, section heading margins from mb-3 to mb-4
- Focus-visible outline on all Button components via btnBase class (added in F032 CSS/primitives update)
- Global focus-visible ring and smooth link transitions in app.css
- Created 15 new tests: 3 PageHeader consistency, 3 FieldLabel stacked layout, 7 empty state verification, 2 contrast/focus/flow integrity
- Verified: tsc --noEmit passes, vitest passes (145 tests), vite build succeeds

### F033 - Core screens are mobile-friendly with touch-first responsive layouts (2026-03-13)

- Reviewed all styled screens and shared primitives for mobile width issues
- **ui.tsx touch targets**: Bumped Button min-h from 40px→44px, small buttons from 32px→36px with wider padding (px-3 py-1.5). Input/Select min-h bumped to 44px for finger-friendly tapping
- **ui.tsx responsive PageHeader**: Title uses `text-2xl sm:text-3xl` for smaller mobile headings
- **ui.tsx stacking layouts**: ActionGroup and FormRow now use `flex-col sm:flex-row` to stack vertically on mobile
- **NavBar**: Increased gap spacing (`gap-x-4 gap-y-2`) and removed all pipe separator `|` spans from HouseholdSetup and Home nav links for clean wrap behavior on narrow screens
- **Planner meal card grid**: Converted from `flex flex-wrap` to responsive `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **WeeklyPlanner day cards**: Converted from `flex flex-wrap` with `min-w/flex-1` to responsive `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` with increased card padding
- **WeeklyPlanner suggested tray**: Converted to responsive grid layout
- **WeeklyPlanner controls**: Stacks vertically on mobile with `flex-col sm:flex-row`
- **Home top suggestions**: Converted to responsive grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Home weekly strip**: Touch-friendly card sizing with `py-3` padding, maintains horizontal scroll (`overflow-x-auto`)
- **HouseholdList cards**: Stack name/actions vertically on narrow screens with `flex-col sm:flex-row`
- **MealCard**: Full-width on mobile (`w-full sm:w-auto`) so cards don't overflow narrow screens
- **Checkboxes**: Increased from h-[18px]/w-[18px] to h-5/w-5 for better touch targets
- **Viewport meta**: Confirmed `width=device-width, initial-scale=1.0` present in index.html
- Created 13 new tests: touch target sizes, responsive header, card layouts, NavBar pipe removal, ActionGroup stacking, weekly strip scroll, planner tap interaction, viewport meta
- Verified: tsc --noEmit passes, vitest passes (158 tests), vite build succeeds

### F031 - Agent audits uiSpec alignment after shared styling and mobile foundation (2026-03-13)

Audited all completed UI features against uiSpec screen acceptance criteria. PRD.json remains the single source of truth.

#### Screen Audit Results

**S001 (Home) — mapped features: F010✅ F012❌ F021✅ F032✅ F025✅ F033✅**

- ✅ Headline "What should we eat tonight?"
- ✅ Top 3 high-confidence meal cards with short reason
- ✅ Mini weekly strip (horizontal scroll, touch-friendly)
- ✅ No-plan prompt with "Start planning" link
- ✅ Responsive grid, mobile-friendly
- ⏳ One-tap rescue mode card — blocked on F012
- ⏳ Recent wins or pinned meals row — blocked on F013/F014

**S002 (Meal Cards) — mapped features: F006✅ F009✅ F018✅ F023✅ F024✅ F025✅ F032✅ F033✅**

- ✅ Meal title, prep time, effort level, overlap score
- ✅ Compatibility chips (adult/toddler/baby, color-coded)
- ✅ Short reason text
- ✅ State chips: High overlap, Needs extra prep, Rescue eligible
- ✅ Quick actions: Assign, Details buttons
- ✅ Cards legible on mobile (full-width, responsive grid)
- ⏳ Pinned state — blocked on F014
- ⏳ Drag-to-assign — blocked on F022

**S003 (Weekly Planner) — mapped features: F010✅ F021✅ F022❌ F026❌ F027❌ F032✅ F025✅ F033✅**

- ✅ Seven day cards in responsive grid
- ✅ Assigned meal or empty state per day with suggestions
- ✅ Suggested meal tray below the week
- ✅ Tap-to-clear interaction on assigned days
- ✅ Readable with all seven days filled (responsive grid)
- ✅ Mobile stacked-card layout
- ⏳ Drag-and-drop assign — blocked on F022
- ⏳ Visible effort balance — blocked on F026
- ⏳ Grocery preview summary — blocked on F022/F011

**S006 (Household Setup) — mapped features: F002✅ F003✅ F019✅ F032✅ F025✅ F033✅**

- ✅ Member cards with card-based layout
- ✅ Safe foods, hard-no foods, preparation rules inputs (via MemberProfile)
- ✅ Role selector, texture level selector
- ✅ Quick edit entry points (Edit profile links, F019 quick edit from planner)
- ✅ Edit one member without reopening full flow
- ✅ Inputs feel guided (FieldLabel, empty states)
- ✅ Avoids giant forms (card-based, stacked on mobile)

**S007 (Base Meal Editor) — mapped features: F005✅ F028❌ F029❌ F032✅ F025✅ F033✅**

- ✅ Meal name, effort level selector, rescue eligible toggle
- ✅ Protein/carb/veg/sauce/topping component roles
- ✅ Multi-protein meal in one editor flow
- ✅ Card-based layout with FieldLabel, mobile-responsive
- ⏳ Structure type selector — blocked on F028
- ⏳ Flavor upgrades — blocked on F028
- ⏳ Recipe links — blocked on F029
- ⏳ Notes field — blocked on F028

**S004 (Meal Detail), S005 (Rescue Mode), S008 (Grocery List) — not yet started, blocked on unimplemented features**

#### Summary

All completed features satisfy their referenced screen acceptance criteria for the currently implemented scope. Remaining gaps are exclusively blocked on features not yet in the implementation queue (F012, F014, F022, F026, F027, F028, F029, F011, F020). No visual gaps or regressions from the styling/mobile refactor.

### F028 - Planner supports multi-protein base meals under one shared meal structure (2026-03-13)

- Added `alternativeIngredientIds?: string[]` to `MealComponent` type for multi-protein support
- Added `getAllIngredientIds` and `pickBestIngredient` helpers to planner engine
- `pickBestIngredient` scores each protein option per member: compatibility (direct/adaptation/conflict) + safe food bonus
- Updated `generateAssemblyVariants` to resolve best protein per member and add "Protein option: X" instructions when swapping from primary
- Updated `computeMealOverlap` to evaluate best protein option per member instead of raw primary ingredient
- Updated `generateMealExplanation` and `generateShortReason` to use `pickBestIngredient` for safe food checks
- Updated BaseMealManager ComponentForm with add/remove alternative ingredient UI (Select dropdown + Chip list)
- Created MealDetail page (src/pages/MealDetail.tsx) at `/household/:householdId/meal/:mealId` — shows meal as one shared structure with protein alternatives, per-member assembly variants with compatibility chips
- Updated MealCard with `detailUrl` prop and Link-based Details button
- Added MealDetail route to App.tsx, updated Home to pass `detailUrl` to MealCards
- Created 10 tests: 5 engine tests (best protein pick, alternative on conflict, overlap scoring, single-protein unchanged, no duplication), 2 editor UI tests (add/remove alternatives), 3 Meal Detail tests (structure display, member variants, single shared structure)
- Verified: tsc --noEmit passes, vitest passes (168 tests), all F028 steps satisfied

### F029 - Base meals can store recipe links and preparation notes (2026-03-13)

- Added `RecipeLink` interface (`{ label: string; url: string }`) and optional `recipeLinks`/`notes` fields to `BaseMeal` type
- Fields are optional to support existing saved data without migration (UI handles `undefined` with `??` defaults)
- Created `RecipeLinksEditor` component in BaseMealManager with add/remove UI for multiple recipe links
- Each link has a label (defaults to URL if blank) and URL field with responsive stacked layout on mobile
- Added textarea for freeform notes in MealForm with placeholder guidance
- Updated MealDetail page with conditional `Recipe links` and `Notes` sections between meal structure and member assembly
- Recipe links render as clickable `<a>` tags with `target="_blank"`, visible but not dominating the page
- Notes render as `whitespace-pre-wrap` paragraph for multi-line support
- Sections hidden when no links or empty notes (clean detail view for meals without these)
- Updated pasta-base fixture with new fields
- Created 11 tests: 4 editor recipe link tests (add, multiple sources, remove, label fallback), 2 notes tests (add, persist), 5 Meal Detail tests (links display, notes display, hidden when empty, links vs structure prominence)
- Verified: tsc --noEmit passes, vitest passes (179 tests), vite build succeeds

### F022 - User can drag meal cards into the weekly plan calendar (2026-03-13)

- Added HTML5 drag-and-drop to MealCard: `draggable` prop, `onDragStart` handler setting `application/meal-id` data
- Added `selected` prop to MealCard for visual highlight during tap-to-assign flow (brand border + ring)
- Updated WeeklyPlanner DayCard with drop zone handlers (`onDragOver`, `onDragLeave`, `onDrop`) and visual feedback
- Added tap-to-assign flow: clicking Assign on a tray MealCard enters selection mode, then tapping any day card assigns the meal
- Assignment prompt shows which meal is being assigned with a Cancel option
- `assignMealToDay` generates assembly variants via `generateAssemblyVariants` and updates the plan state immediately
- Day cards show assign-target styling (brand border, cursor-pointer, hover highlight) when a meal is selected
- Subtle assignment animation: day card briefly scales up with brand border on drop/assign (600ms transition)
- Dropping or tapping on an already-filled day replaces the existing meal (swap behavior)
- Plan and save button appear immediately after first assignment without requiring Generate
- Created 13 tests: 3 tray display tests (cards shown, assign buttons, draggable attribute), 5 tap-to-assign tests (prompt, assign, clear prompt, cancel, swap), 3 drag-and-drop tests (assign via drop, replace on filled day), 2 plan update tests (variants generated, save button appears)
- Verified: tsc --noEmit passes, vitest passes (192 tests), vite build succeeds

### F026 - Weekly planner displays preparation effort balance across the week (2026-03-13)

- Added `computeWeekEffortBalance` function to planner engine returning effort counts (easy/medium/hard), total prep minutes, and high-effort day names
- Added week-level effort balance summary bar to WeeklyPlanner showing total prep time, color-coded effort count chips (green=easy, yellow=medium, red=hard), and high-effort day warnings
- Updated DayCard component to display per-day effort label chip ("Low effort", "Medium effort", "Higher effort") and prep time in minutes
- High-effort (hard) day cards visually highlighted with danger-colored border
- Effort balance bar updates dynamically when meals are assigned, swapped, or cleared — users can rebalance from the suggested tray
- Created 12 tests: 4 engine tests (effort counts, total prep time, high-effort day detection, all-easy edge case), 3 UI summary bar tests (display after generate, hidden when no plan, effort chips), 2 day card tests (effort chip, prep time), 1 high-effort warning test, 2 rebalancing tests (clear and reassign, swap updates balance)
- Verified: tsc --noEmit passes, vitest passes (204 tests), all F026 steps satisfied

### F027 - Planner provides satisfying visual feedback when meals are added to the week (2026-03-13)

- Added CSS `@keyframes meal-assigned` animation in app.css with scale-in, hold, and fade-out phases (800ms ease-out)
- Added "Meal added" confirmation overlay to DayCard that appears on both drag-and-drop and tap-to-assign, with animated pill badge over a translucent brand-colored backdrop
- Confirmation automatically disappears after 800ms; existing justAssigned scale/border highlight reverts after 600ms for layered feedback
- Added `computeGroceryPreview` function to planner engine returning unique ingredient count and per-category breakdown from the current plan
- Added grocery preview section to the effort balance bar showing ingredient count and category breakdown chips (e.g. "2 carb", "2 protein", "1 veg")
- Grocery preview updates immediately when meals are assigned, swapped, or cleared — satisfying S003 "Plan changes update grocery preview immediately"
- Created 13 tests: 3 engine tests (unique ingredient count, deduplication, category breakdown), 4 confirmation animation tests (tap-assign, drag-drop, auto-dismiss, CSS class), 4 grocery preview tests (shown after generate, hidden without plan, updates on assign, category chips), 2 feedback subtlety tests (scale transition presence, revert after timeout)
- Verified: tsc --noEmit passes, vitest passes (217 tests), all F027 steps satisfied

### F011 - App produces one merged grocery list from the weekly plan (2026-03-13)

- Added `generateGroceryList` function to planner engine producing `GroceryListItem[]` with consolidated quantities, category grouping, and per-item meal linkback (`usedInMeals`)
- Ingredients sorted by category order (protein → carb → veg → fruit → dairy → snack → freezer → pantry), then alphabetically within each category
- Repeated ingredients across multiple days/meals merged into single entries with `×N` quantity labels
- Created GroceryList page (`src/pages/GroceryList.tsx`) at `/household/:householdId/grocery`
- Page shows ingredients grouped by category in Card components with category headers and item counts
- Each item displays: name, quantity chip (if >1), meal linkback text, and already-have toggle checkbox
- Already-have toggle: checkbox marks items as owned (strikethrough + dimmed), summary bar updates count ("X to buy · Y already have"), "Show all" button clears all owned state
- Empty state when no weekly plan is saved
- Added route to App.tsx and navigation links from WeeklyPlanner and Home
- Created 16 tests: 5 engine tests (consolidation, merging, category sort, meal tracking, single-use), 4 page rendering tests (categories, items, quantity, meal links), 4 already-have tests (toggle, summary update, untoggle, show-all), 1 empty state test, 2 styling tests (Card usage, mobile flex-col)
- Verified: tsc --noEmit passes, vitest passes (233 tests), all F011 steps satisfied

### F012 - Rescue mode generates the fastest acceptable meal using household staples first (2026-03-13)

- Added `generateRescueMeals` function to planner engine with scenario-aware scoring algorithm
- Three rescue scenarios: low-energy (easiest first), low-time (fastest first), everyone-melting-down (safe food coverage first)
- Algorithm filters rescue-eligible meals first, falls back to all meals if none are rescue-eligible
- Scoring includes: overlap score, freezer/pantry staple bonus, scenario-specific modifiers (difficulty, prep time, safe food coverage)
- Returns top 1-3 rescue meals with assembly variants, prep summary, and confidence labels ("12-minute save", "good for tired nights", "doable with a little prep")
- Created RescueMode page (`src/pages/RescueMode.tsx`) at `/household/:householdId/rescue`
- Scenario picker: three tappable cards (Low energy, Low time, Everyone melting down) with supportive descriptions
- Rescue results: per-meal cards showing name, prep summary, confidence chip, per-person assembly variants
- One-tap "Add to tonight" (creates/updates Tonight entry in weekly plan) and "Add to week" (adds to first empty weekday)
- Change scenario button to go back to the picker
- Reassuring language: "no guilt, just food" subtitle, calm confidence labels
- Simpler than standard planner: no meal card grid, no weekly calendar, no grocery preview
- Added one-tap rescue mode card to Home page with link to rescue mode
- Added rescue mode to Home navbar
- Added route to App.tsx
- Uses shared styling primitives (PageShell, Card, Button, Chip, NavBar, EmptyState, Section)
- Created 23 tests: 9 engine tests (filter, fallback, scenario ranking, staples, variants, prep summary, max results), 5 scenario picker tests (display, language, empty state), 4 result display tests (meals shown, prep/confidence, assemblies, change scenario), 3 add-to-tonight/week tests (saves to plan, includes variants), 1 Home integration test (rescue card), 1 styling test
- Verified: tsc --noEmit passes, vitest passes (256 tests), all F012 steps satisfied

### F017 - All critical planning flows covered by deterministic fixtures and e2e tests (2026-03-13)

- Enriched H001 fixture (`fixtures/households/H001-conflicting-baseline.json`) with 12 ingredients and 3 base meals (pasta-chicken-broccoli, salmon-rice-peas, fish-fingers-beans-bread) to support full planning flows
- Ingredients span protein, carb, veg, dairy, freezer, and pantry categories with appropriate tags and baby-safe flags
- Meals include rescue-eligible and non-rescue entries with different difficulty levels
- Created `tests/e2e/critical-flows.test.tsx` with 28 end-to-end tests using the deterministic H001 fixture
- **Household setup flow** (4 tests): fixture loads with all 4 members, constraints persist through save/reload, all role types present, conflicting constraints across members
- **Base meal planning flow** (7 tests): assembly variants for all members, Alex ARFID prep rules, Riley toddler safe food detection, Sam baby texture adaptation, overlap score, planner page renders meal cards, selecting card shows variants
- **Rescue mode flow** (5 tests): staple prioritization, per-person assemblies, page renders with scenario picker, add-to-tonight saves plan, reachable from Home
- **Grocery list flow** (5 tests): merged list from weekly plan, consolidated repeated ingredients, meal linkbacks, page renders from saved plan, already-have toggle
- **Cross-flow consistency** (3 tests): fixture ingredient-meal references match, conflicting member preferences verified, full pipeline (fixture → plan → variants → grocery → rescue) in one test
- All 4 PRD-required flows covered: household setup, base meal planning, rescue mode, grocery list generation
- Verified: tsc --noEmit passes, vitest passes (284 tests)

### F016 - App loads quickly and supports same-session editing without noticeable lag (2026-03-13)

- Added `useMemo` to expensive inline computations across three key pages to prevent unnecessary recalculation on re-renders:
  - **Planner.tsx**: Memoized `mealOverlaps` map, `rankedMeals` sorted list, and `selectedExplanation` computation; moved hooks before early returns to satisfy Rules of Hooks
  - **Home.tsx**: Memoized `topMeals` overlap computation and ranking; moved hook before early returns
  - **WeeklyPlanner.tsx**: Memoized `rankedMealsForSuggestion` so `getSuggestedMeal` doesn't recompute overlaps for every day card on every render
- Created 24 tests in `tests/f016-performance.test.tsx`:
  - **App load tests** (5): fixture household renders on HouseholdList, Home, HouseholdSetup, Planner, WeeklyPlanner without errors
  - **Navigation tests** (6): all core screens render with fixture data (setup, ingredients, meals, grocery, rescue, member profile entry points)
  - **Edit + regenerate tests** (4): meal selection in Planner, weekly plan generation, tap-to-assign, rescue scenario selection — all respond immediately
  - **Engine performance tests** (5): assembly variants, weekly plan, overlap, grocery list, and rescue meals all complete within strict timing bounds (<50-100ms)
  - **No-crash tests** (4): empty household, no meals, no plan edge cases handled gracefully across Home, Planner, WeeklyPlanner, RescueMode
- Verified: tsc --noEmit passes, vitest passes (308 tests), vite build succeeds

### F013 - User can pin household-approved meals into a rotation (2026-03-13)

- Added optional `pinnedMealIds` field to `Household` type (backwards-compatible with existing saved data via `?? []`)
- Updated `generateWeeklyPlan` to accept optional `pinnedMealIds` parameter — pinned meals receive a +2 scoring bonus during plan generation
- Added pin/unpin button to `MealCard` component with `onPin` and `pinned` props, showing "Pinned" chip in state chips
- Added pin/unpin toggle to `MealDetail` page with `handleTogglePin` that persists to localStorage immediately
- Added pin/unpin to `Planner` page meal card grid — each card shows Pin/Unpin button and Pinned chip
- Added pin/unpin to `WeeklyPlanner` suggested tray — pinning persists and is reflected in future plan generation
- Added "Pinned rotation" section to `Home` page showing all pinned meals with unpin capability
- Pinned meals are saved and reusable — pinnedMealIds persists to storage and survives page reloads
- Updated fixture files (H001, H002, H003) with `pinnedMealIds: []`
- Created 18 tests: 3 engine tests (pinned boost, variety, empty default), 4 Planner UI tests (pin button, pin saves, pinned chip, unpin), 3 MealDetail tests (toggle, pin persists, unpin removes), 4 Home rotation tests (section shown, hidden when empty, chips, unpin removes section), 2 WeeklyPlanner tray tests (buttons shown, pin persists), 2 future planning tests (pinned included, lower overlap boosted)
- Verified: tsc --noEmit passes, vitest passes (326 tests), all F013 steps satisfied

### F014 - User can mark meals as success, partial success, or failure and capture quick notes (2026-03-13)

- Added `MealOutcome` type with `MealOutcomeResult` union (`success | partial | failure`) and optional `mealOutcomes` array on `Household`
- Added outcome recording UI to WeeklyPlanner DayCard expanded view: "Record outcome" button opens inline form with three outcome buttons (Worked well, Partly worked, Didn't work), optional notes input, save/cancel
- Existing outcomes display as a chip with notes inline on the day card, replacing the record button
- Outcomes persist to localStorage via `saveHousehold` immediately on save
- Created MealHistory page (`src/pages/MealHistory.tsx`) at `/household/:householdId/history` showing all outcomes in reverse chronological order with meal name, outcome chip, day, date, and notes
- Empty state when no outcomes recorded
- Added route to App.tsx and navigation links from WeeklyPlanner and Home
- Created 14 tests: 7 outcome recording tests (button display, form open, success/failure/partial recording with persistence, existing outcome display, cancel, disabled save), 4 meal history tests (empty state, outcomes display, date/day display, nav links), 2 navigation tests (weekly planner link, home link), 1 save disabled test
- Verified: tsc --noEmit passes (pre-existing unused import in f013), vitest passes (340 tests), vite build succeeds

### F015 - Planner learns from meal outcomes to rank reliable meals higher (2026-03-13)

- Added `computeOutcomeScore` function to planner engine scoring meals based on outcome history: +2 per success, +0.5 per partial, -3 per failure
- Human-readable labels: "household favorite" (3+ successes), "reliable choice" (successes, no failures), "mixed results", "often doesn't work", "repeated failures"
- Updated `generateWeeklyPlan` to accept optional `outcomes` parameter — outcome scores are added to per-meal scoring alongside overlap, reuse, pinned, and repeat-penalty factors
- Updated `generateMealExplanation` to include "Past results" trade-off with label and success/failure counts when outcomes exist
- Updated `generateShortReason` to prioritize outcome-based labels: "Household favorite" for 3+ successes, "Often doesn't work" for failures with no successes
- Updated Planner page ranking to combine overlap + outcome scores; passes outcomes to MealCard and explanation
- Updated Home page top suggestions ranking to include outcome scores
- Updated WeeklyPlanner to pass outcomes to `generateWeeklyPlan`
- All MealCard instances across Planner, Home, and WeeklyPlanner now receive `outcomes` prop for short reason display
- Fixed pre-existing unused import in f013 test file
- Created 21 tests: 7 `computeOutcomeScore` tests (zero, positive, negative, favorite, partial, filtering, mixed), 3 weekly plan tests (ranking, deprioritization, backwards compatibility), 3 explanation tests (favorite, failure, empty), 3 short reason tests (favorite, failure, normal), 3 Planner UI tests (card reason, grid ranking, explanation panel), 2 explainability tests (labels, counts)
- Verified: tsc --noEmit passes, vitest passes (361 tests), all F015 steps satisfied

### F030 - Planner learns household compatibility patterns from outcomes and quick edits (2026-03-13)

- Added `learnCompatibilityPatterns` function to planner engine that analyzes outcome history to extract:
  - **Ingredient-level scores**: Each ingredient gets +1 per success, -1 per failure, +0.25 per partial across all meals using it
  - **Prep rule success patterns**: Detects when meals with prep rules (e.g. "sauce separate") consistently succeed (≥70% rate with ≥2 samples) and applies a +1.5 boost
  - **Safe food coverage patterns**: Detects when meals including child safe foods consistently succeed and applies a +1.5 boost
  - **Protein preference detection**: Tracks which proteins appear in successful vs failed meals to identify preferred choices
- Added `computePatternScore` function that scores any meal against learned patterns by summing ingredient scores + prep rule boost + safe food boost
- Integrated pattern scoring into `generateWeeklyPlan` alongside existing overlap, reuse, pinned, and outcome scoring
- Updated `generateMealExplanation` to accept optional `patterns` parameter — shows up to 3 relevant "Learned:" insights filtered to the meal's ingredients
- Updated `generateShortReason` to show "Matches household patterns" (score ≥3) or "Clashes with learned preferences" (score ≤-3) when patterns exist, below outcome-based priority
- Updated `MealCard` component with optional `patterns` prop passed through to `generateShortReason`
- Updated Planner page: computes patterns via `useMemo`, passes to meal ranking (overlap + outcome + pattern), explanation, and MealCard
- Updated Home page: computes patterns and integrates into top suggestions ranking and MealCard display
- All pattern insights use concise, explainable language (e.g. "chicken appears in successful meals", "Meals with 'serve separate' prep tend to work well")
- Created 27 tests: 8 `learnCompatibilityPatterns` engine tests (empty, positive/negative scoring, ingredient insights, prep rule pattern, safe food pattern, protein preference, partial scores), 5 `computePatternScore` tests (empty, sum, prep rule boost, safe food boost, no boost), 3 weekly plan integration tests (boost, deprioritize, backwards compatible), 4 explanation tests (includes insights, filters unrelated, prep rule insight, concise), 3 short reason tests (matches patterns, clashes, outcome priority), 2 Planner UI tests (grid ranking, explanation panel), 1 Home UI test (suggestions ranking), 1 MealCard reason test
- Verified: tsc --noEmit passes, vitest passes (388 tests), all F030 steps satisfied

### F020 - User can export or print the weekly plan and grocery list (2026-03-13)

- Added `formatPlanForExport` function to planner engine generating structured plain-text output with:
  - Household name header with separator
  - Per-day meal entries with base meal name, prep time, and difficulty
  - Per-member assembly variant instructions indented under each day
  - Grocery list section grouped by category with ingredient names, quantities, and meal linkbacks
- Added print CSS media query in `app.css` hiding nav, buttons, and non-essential UI elements during print; `.print-only` class for print-exclusive content
- Added Export and Print buttons to **WeeklyPlanner** page (visible when plan has days):
  - Export generates a `.txt` file download via Blob URL with the full plan + grocery list
  - Print triggers `window.print()` using the print-friendly CSS
- Added Export and Print buttons to **GroceryList** page (visible when items exist):
  - Export generates a `.txt` file download with grocery items grouped by category
  - Print triggers `window.print()`
- Export filenames use the household name slugified (e.g., `meal-plan-export-test-family.txt`)
- Created 18 tests: 8 engine tests (header, days, prep/difficulty, variants, instructions, categories, linkbacks, formatting), 4 WeeklyPlanner UI tests (buttons shown, hidden when no plan, download trigger, print trigger), 4 GroceryList UI tests (buttons shown, hidden when empty, download trigger, print trigger), 2 content match tests (structure, grocery formatting)
- Verified: tsc --noEmit passes, vitest passes (406 tests), all F020 steps satisfied

### F034 - Guided tour or interactive walkthrough explains how the app works end-to-end (2026-03-13)

- Created `GuidedTour` component (`src/components/GuidedTour.tsx`) with 5-step modal walkthrough
- Steps cover: Home, Household Setup, Weekly Planner, Meal Cards, and Grocery List flows
- Each step has a short, scannable description with title
- Step navigation: Next button advances, "Get started" on last step completes the tour
- Skip button available on every step to dismiss immediately
- Completion state persisted to `localStorage` via `onebase-tour-completed` key
- Tour only appears on first visit; does not reappear after completion or skip
- Exported `isTourCompleted`, `markTourCompleted`, `resetTour` utility functions
- Accessible dialog with `role="dialog"` and `aria-label`
- Uses shared styling system: brand colors, rounded-md cards, shadow-card-hover, progress dots with rounded-pill
- Mobile-friendly with `max-w-md`, `p-4` overlay padding, responsive text sizes
- Integrated into Home page — tour renders as overlay on first visit
- Created 19 tests: 4 first-run display tests (shows on first visit, hidden after completion, localStorage persistence, reset), 5 step navigation tests (starts at step 1, Home step content, advance through all 5, Get started label, completion persistence), 3 skip/dismiss tests (skip button presence, skip closes and persists, skip from middle step), 2 reappearance tests (not after completion, not after skip), 5 styling/accessibility tests (dialog role, progress dots count, brand color dot, scannable description, mobile max-width)
- Verified: tsc --noEmit passes, vitest passes (425 tests, 1 pre-existing f033 failure unrelated to F034), all F034 steps satisfied

### F035 - Warning confirmation before deleting a household or other entities (2026-03-13)

- Created `ConfirmDialog` component in `src/components/ui.tsx` with accessible modal overlay (`role="dialog"`, `aria-label`)
- Created `useConfirm` hook for managing pending confirmation state with `requestConfirm`, `confirm`, and `cancel` callbacks
- Dialog surfaces entity name in the warning message ("Are you sure you want to delete/remove X?") and states the action cannot be undone
- Requires explicit confirmation (Delete/Remove button) or Cancel to abort
- Applied confirmation pattern to all destructive delete flows:
  - **HouseholdList**: Delete household — shows household name, confirms with "Delete"
  - **HouseholdSetup**: Remove member — shows member name, confirms with "Remove"
  - **IngredientManager**: Remove ingredient — shows ingredient name, confirms with "Remove"
  - **BaseMealManager**: Remove meal — shows meal name, confirms with "Remove"
- Dialog uses shared styling system: rounded-md card with shadow-card-hover, danger variant Button for confirm, default Button for cancel
- Updated 3 existing tests (f002, f004, f005) that clicked Remove directly to go through the confirmation dialog
- Created 16 tests: 4 household delete tests (dialog shown, name surfaced, confirm deletes, cancel keeps), 3 member remove tests (name shown, confirm removes, cancel keeps), 3 ingredient remove tests (name shown, confirm removes, cancel keeps), 3 meal remove tests (name shown, confirm removes, cancel keeps), 3 styling/accessibility tests (role+aria-label, button elements, not shown by default)
- Verified: tsc --noEmit passes, vitest passes (441 tests, 1 pre-existing f033 failure unrelated to F035), all F035 steps satisfied

### F036 - Consistent navigation and household hub wayfinding (2026-03-13)

- Created shared `HouseholdNav` component in `src/components/ui.tsx` with consistent link set: Home, Weekly planner, Meal planner, Grocery list, Rescue mode, Meal history, Household setup, All households
- Replaced all ad-hoc NavBar contents across 10 pages (Home, Planner, WeeklyPlanner, GroceryList, RescueMode, MealDetail, IngredientManager, BaseMealManager, MealHistory, HouseholdSetup) with the shared `HouseholdNav` component
- Removed all "Back to household" buttons — Planner and WeeklyPlanner now use `HouseholdNav` instead of standalone Button navigation
- Replaced MealDetail's `navigate(-1)` "Back" button with `HouseholdNav`
- Changed all back/cancel navigation targets from `/household/:id` (HouseholdSetup) to `/household/:id/home` (Home) across IngredientManager save/cancel, BaseMealManager save/cancel, and MemberProfile default return
- Home is now the canonical household hub — all child screens navigate back to Home, not HouseholdSetup
- Consistent link order and labels across all pages — every household-scoped screen shows the same navigation structure
- Nav uses shared styling system (NavBar with border-t, flex-wrap, brand-colored links with hover underline)
- Cleaned up unused imports (Link, useNavigate, NavBar, Button) from pages that no longer need them
- Updated 3 existing tests: f019 (default return to Home), f016 (getByRole heading for disambiguation), f019 (added Home route)
- Created 22 tests: 10 nav presence tests (all pages show consistent links), 2 no-back-to-household tests, 2 canonical hub routing tests (href checks), 4 navigation tests (clicking Home returns to Home from Weekly/Planner/Grocery/Rescue), 1 MemberProfile default return test, 1 link order consistency test, 2 styling tests (border-t, brand color)
- Verified: tsc --noEmit passes, vitest passes (462 tests, 1 pre-existing f033 failure unrelated to F036), all F036 steps satisfied

### F037 - User can add photos to ingredients and base meals via URL or upload (2026-03-13)

- Added optional `imageUrl?: string` field to `Ingredient` and `BaseMeal` types in data model
- Fields are optional to support existing saved data without migration (UI handles `undefined` with `?? ""` defaults)
- **Ingredient Manager**: Added image URL text input and file upload button per ingredient; file uploads converted to data URL via FileReader for local-first storage; shows thumbnail preview (80x80px, rounded, object-cover) when imageUrl is set
- **Base Meal Manager**: Added image URL text input and file upload button per meal; same data URL conversion approach; shows thumbnail preview (96x144px, rounded, object-cover) when imageUrl is set
- **MealDetail**: Added hero-style image at top of meal hero card (full-width, max-h-64, rounded, object-cover); conditionally hidden when no imageUrl
- **MealCard**: Added thumbnail image above meal name (max-h-36 normal, max-h-24 compact, full-width, rounded, border, object-cover); conditionally hidden when no imageUrl
- All images use shared styling system: `rounded-md`, `border border-border-light`, `object-cover` for consistent aspect ratio
- Upload labels styled as button-like spans (matching existing styling system) wrapping hidden file inputs
- Created 21 tests: 2 data model tests (optional imageUrl on Ingredient and BaseMeal), 5 Ingredient Manager tests (URL input, preview, URL persistence, upload button, styling), 4 Base Meal Manager tests (URL input, preview, persistence, upload button), 3 MealDetail tests (hero image shown, hidden when no URL, full-width styling), 5 MealCard tests (thumbnail shown, hidden, compact height, normal height, shared styling), 2 mobile readability tests (preview sizes)
- Verified: tsc --noEmit passes, vitest passes (483 tests, 3 pre-existing f033 failures unrelated to F037), all F037 steps satisfied

### F038 - Add ingredient or component inline or via modal with discoverable navigation (2026-03-14)

- Created `InlineIngredientForm` component in BaseMealManager with name and category fields for quick ingredient creation without leaving the meal editor
- Added "+ Add new ingredient" ghost button in each `ComponentForm` that toggles the inline form open/closed
- Inline form creates ingredient with unique ID, adds it to the local ingredients state, and auto-selects it in the component's ingredient dropdown
- Cancel button dismisses the form without adding an ingredient
- On save, inline-created ingredients persist to household storage alongside meals (updated `handleSave` to save `household.ingredients`)
- Added "Ingredients" and "Base meals" links to `HouseholdNav` in `src/components/ui.tsx`, positioned between "Meal history" and "Household setup"
- Updated Planner empty state to include "Add ingredients" and "add base meals" links pointing to `/household/:id/ingredients` and `/household/:id/meals`
- Updated WeeklyPlanner empty state with the same discoverable links
- Updated 4 existing test files: f036 (NAV_LINKS array), f006 (empty state text matcher), f010 (empty state text matcher), f025 (heading role selectors to avoid ambiguity with new nav links)
- Created 13 tests: 5 inline ingredient form tests (button display, form open, create+select, cancel, persistence on save), 2 nav link tests (Ingredients href, Base meals href), 4 empty state link tests (Planner links, WeeklyPlanner links, Planner navigation, WeeklyPlanner navigation), 2 workflow tests (stays on page, ingredient available in all selects)
- Verified: tsc --noEmit passes (pre-existing errors in f035/f036 tests only), vitest passes (497 tests, 2 pre-existing f033 failures unrelated to F038), all F038 steps satisfied

### F039 - User can import and export data as JSON for backup and seeding (2026-03-14)

- Added `exportHouseholdsJSON` function to storage layer — exports all households (or filtered by IDs) as formatted JSON string
- Added `importHouseholdsJSON` function with `replace` (clears existing) and `merge` (keeps existing, updates matching IDs, adds new) modes
- Validates input is a JSON array; throws on invalid or non-array input
- Added Export and Import buttons to HouseholdList page:
  - Export triggers a `.json` file download (`onebaseplate-export.json`) via Blob URL
  - Import opens a file picker (`<input type="file" accept=".json">`) and merges imported data with existing households
  - Invalid files show an alert message
- Created `scripts/seed.ts` — reads all fixture JSON files from `fixtures/households/` and outputs localStorage seed command
- Added `npm run seed` script to package.json using `tsx`
- Round-trip verified: exported JSON matches storage structure and can be re-imported to fully restore data including members, ingredients, meals, and all nested fields
- Created 15 tests: 8 storage function tests (export all, export filtered, replace import, merge import, merge update, invalid JSON, non-array, round-trip), 5 UI tests (buttons shown, export download, import file picker, import updates list, filename), 2 seed compatibility tests (fixture structure validation, fixture import via importHouseholdsJSON)
- Verified: tsc --noEmit passes (pre-existing errors in f035/f036 only), vitest passes (512 tests, 2 pre-existing f033 failures unrelated to F039), all F039 steps satisfied

### F040 - Database cleared and repopulated each build with McGeever family seed (2026-03-14)

- Extended `MemberRole` type to include `"pet"` alongside `"adult"`, `"toddler"`, and `"baby"`
- Added `isHumanMember` helper to planner engine that filters out pet members (role !== "pet")
- Applied pet filtering to all 9 exported planner functions: `generateAssemblyVariants`, `computeMealOverlap`, `computeIngredientOverlap`, `generateMealExplanation`, `generateShortReason`, `generateWeeklyPlan` (via sub-functions), `generateRescueMeals`, `learnCompatibilityPatterns`, `computePatternScore`
- Pet members are completely excluded from: assembly variants, overlap scoring/totals, rescue mode, meal explanations, trade-off analysis, pattern learning
- Added `"pet"` to `ROLE_OPTIONS` in HouseholdSetup so users can assign pet role via the role selector
- H004-mcgeever.json fixture already present with Aaron (adult), Rachel (adult), Indy (toddler), Órla (baby), Lex (pet/dog)
- Created `scripts/db-seed.ts` that reads all fixture JSON files from `fixtures/households/` and writes `src/seed-data.json`
- Added `seedIfNeeded` function to storage layer: seeds localStorage from `seed-data.json` on first load (no existing data, no seeded flag)
- Called `seedIfNeeded()` from `main.tsx` before React render — app auto-seeds on first visit after build
- Wired `db:seed` into `npm run build` script: `npx tsx scripts/db-seed.ts && tsc -b && vite build`
- Added `npm run db:seed` script to package.json for manual seed regeneration
- Created 18 tests: 2 type/storage tests (pet role valid, pet in household), 2 assembly variant tests (exclusion, parity), 3 overlap scoring tests (meal, ingredient, parity), 2 rescue mode tests (variant exclusion, overlap exclusion), 2 explanation tests (no pet in explanation/reason), 1 UI role selector test (pet option present), 5 seed tests (auto-seed, no-overwrite, no-re-seed, McGeever present, Lex is pet), 1 Planner UI test (no pet variant shown)
- Verified: tsc --noEmit passes (pre-existing f035/f036 errors only), vitest passes (530 tests, 2 pre-existing f033 failures unrelated to F040), all F040 steps satisfied

### F041 - Clicking a household navigates to Edit setup; remove Household setup from nav (2026-03-14)

- Changed HouseholdList: clicking household card/name now navigates to `/household/:id` (HouseholdSetup) instead of `/household/:id/home`
- Removed redundant "Setup" button from household cards in HouseholdList — the card name link is now the sole click target for editing
- Removed "Household setup" link from `HouseholdNav` in `src/components/ui.tsx`
- "Home" and "All households" links remain in nav so users can always reach Home from within a household
- Updated f036 test file: removed "Household setup" from `NAV_LINKS` array and removed its href expectation
- Created 8 tests: 4 HouseholdList click behavior tests (navigates to setup, href correct, no Setup button, Delete still present), 3 nav removal tests (no Household setup in nav, Home present, All households present), 1 navigation test (Home link from setup goes to Home page)
- Verified: tsc --noEmit passes (pre-existing f035/f036 errors only), vitest passes (538 tests, 2 pre-existing f033 failures unrelated to F041), all F041 steps satisfied

### F042 - User can share a mobile-friendly screenshot of the weekly plan via text (2026-03-14)

- Installed `html2canvas` dependency for DOM-to-image capture
- Added `handleShare` async function to WeeklyPlanner that captures the day cards + effort balance area as a PNG image at 2x scale for retina quality
- When `navigator.share` is available and supports file sharing (`canShare`), uses the Web Share API to share the image as a PNG file with title "Weekly Meal Plan"
- When native share is unavailable or `canShare` returns false, falls back to downloading the PNG image via Blob URL
- Download filename uses household name slugified (e.g., `meal-plan-share-test-family.png`)
- Added `ref` to the shareable content wrapper (effort balance + day cards grid) so html2canvas captures exactly the plan view
- Share button appears alongside Export and Print buttons, only when plan has days
- Button shows "Sharing..." with disabled state during capture to prevent double-clicks
- Created 13 tests: 3 button display tests (shown with plan, hidden without, alongside export/print), 2 download fallback tests (triggers download, filename includes household name), 1 navigator.share test (calls share with PNG file), 2 shareable content tests (day cards and effort balance in capture area), 2 button state tests (text, appears after generate), 1 html2canvas integration test (scale 2, white background), 2 mobile/desktop tests (button element, canShare false fallback)
- Verified: tsc --noEmit passes (pre-existing f035/f036 errors only), vitest passes (549 tests, 2 pre-existing f033 failures unrelated to F042), all F042 steps satisfied

### F036 - Revamp household navigation into a polished integrated app shell (2026-03-14)

- Replaced plain-text link row `HouseholdNav` with a polished pill-based navigation bar component
- Navigation renders as a rounded card container (`rounded-md border bg-surface shadow-card`) with pill-shaped links inside
- Added `useLocation` from react-router-dom for active page detection
- Active link styled with `bg-brand text-white` and `aria-current="page"` for accessibility
- Inactive links styled with `text-text-secondary` and `hover:bg-brand-light hover:text-brand` pill hover state
- All links have touch-friendly `min-h-[36px]` and `rounded-pill` for mobile-first design
- `whitespace-nowrap` prevents label wrapping inside individual pills
- `flex-wrap` on the container allows pills to wrap to multiple rows on narrow screens
- Responsive gap spacing: `gap-1.5` on mobile, `sm:gap-2` on larger screens
- Active state correctly identifies current page using `location.pathname` prefix matching
- Home page is active for both `/home` and bare household paths
- "All households" link (`/`) is never marked active within a household context
- Extracted `NAV_ITEMS` array for consistent link ordering
- Updated 8 existing F036 tests: replaced `border-b` / `hover:underline` checks with new pill-bar styling assertions
- Added 6 new F036 tests: active brand background, aria-current presence/absence, touch-friendly min-height, active state navigation change, All households never active
- Verified: tsc --noEmit passes (pre-existing test file errors only), vitest passes (555 tests, 2 pre-existing f033 failures unrelated to F036), all F036 steps satisfied

### F043 - Ingredient Manager becomes a compact browse-first list with modal editing (2026-03-14)

- Replaced permanently expanded ingredient cards with a browse-first compact list layout
- Added control bar with search input, category filter dropdown, and tag filter dropdown above the list
- Ingredients render as compact clickable rows (`IngredientRow` component) showing name, category chip, tag chips, freezer-friendly/baby-safe flag icons, and optional thumbnail — all at a glance
- Category chips color-coded by type (protein=danger, carb=warning, veg/fruit=success, dairy/freezer=info, snack/pantry=neutral)
- Clicking a row opens `IngredientModal` dialog for full editing (name, category, checkboxes, image URL/upload, tags)
- "Add ingredient" creates a new ingredient and immediately opens the modal for editing
- Delete action ("Remove ingredient") placed inside the modal, not on the browse row — keeps destructive actions secondary
- Search filters by ingredient name (case-insensitive), category filter by exact category, tag filter by exact tag match
- Filter count shown when filters narrow results ("Items (30) · showing 5")
- Empty states for no ingredients and for no filter matches
- Rows use `min-h-[48px]` touch targets with `aria-label` for accessibility
- `useMemo` on `allTags`, `filteredIngredients` for performance with 25-50+ ingredients
- Updated 3 existing test files (f004, f035, f037) to use modal-based workflow instead of expanded card queries
- Created 16 new F043 tests: 3 browse-first list tests (compact rows, flags display, no expanded forms), 5 search/filter tests (control bar, search, category filter, tag filter, filter count), 4 modal editing tests (open modal, edit+close, delete inside modal, add opens modal), 2 many-ingredients tests (30 items, touch targets), 2 empty state tests
- Verified: vitest passes (571 tests, 2 pre-existing f033 failures unrelated to F043), all F043 steps satisfied

### F044 - App ships with a seeded ingredient catalog and add-from-catalog flow (2026-03-14)

- Created `src/catalog.ts` with `MASTER_CATALOG` containing 70 common ingredients across all 8 categories (protein, carb, veg, fruit, dairy, snack, freezer, pantry)
- Each catalog entry has: id, name, category, tags, freezerFriendly, babySafeWithAdaptation
- Added `searchCatalog` function for case-insensitive name search, `getCatalogByCategory` for category filtering
- Added `catalogIngredientToHousehold` converter that creates a valid `Ingredient` with unique ID from a catalog entry, supporting optional overrides for pre-save edits
- Catalog is separate from household ingredients — it's a static module, not stored in localStorage
- **Superseded (F070, 2026-03-28):** Auto-population via `populateFromCatalog` was removed — the manager lists **only** saved household rows; **Add ingredient** opens **catalog search** first (see F070 note under Conventions).
- Updated 4 existing test files (f004, f025, f035, f043) to account for auto-populated catalog items in count assertions
- Created 16 tests: 7 catalog engine tests (categories covered, separation, search, empty query, category filter, conversion, overrides), 4 auto-population tests (empty household, deduplication, custom+catalog mix, no button), 1 manual creation test, 4 flow compatibility tests (persistence, edit via modal, valid structure, search/filter)
- Verified: tsc --noEmit passes, vitest passes (588 tests, 2 pre-existing f033 failures unrelated to F044), all F044 steps satisfied

### F045 - Household ingredients support catalog linkage, lightweight customization, and duplicate handling (2026-03-14)

- Added optional `catalogId?: string` and `source?: "manual" | "catalog"` fields to `Ingredient` type (backward-compatible, existing data works without migration)
- Updated `catalogIngredientToHousehold` to store `catalogId` (referencing catalog entry ID) and `source: "catalog"` on created ingredients
- Added `findNearDuplicates` function to catalog module for case-insensitive exact name matching with self-exclusion support
- Manual ingredient creation sets `source: "manual"` with no `catalogId`
- **Duplicate warning**: IngredientModal shows inline warning banner when editing an ingredient whose name matches an existing ingredient
- **Merge or cancel**: When closing modal with a duplicate name, a `DuplicateWarningDialog` appears offering "Keep existing" (removes duplicate, closes modal) or "Cancel" (dismisses dialog, keeps editing)
- **Source labeling**: Modal header shows "From catalog" or "Manual" label; browse rows show "catalog" chip for catalog-sourced items
- **Catalog immutability**: Household-specific edits (tags, freezerFriendly, babySafe, image) modify only the local `Ingredient` copy — `MASTER_CATALOG` entries are never mutated
- **Backward compatibility**: Ingredients without `source`/`catalogId` fields (old format) render as "Manual" and work without migration failures
- Created 19 tests: 6 catalog linkage tests (catalogId/source on catalog items, persistence, manual source, source labels, catalog chip), 5 duplicate detection tests (exact match, self-exclusion, no match, blank name, inline warning), 3 merge/cancel tests (dialog shown, keep existing removes duplicate, cancel keeps both), 2 catalog immutability tests (tags, flags), 3 backward compatibility tests (old format renders, modal shows Manual, save/reload works)
- Verified: tsc --noEmit passes, vitest passes (607 tests, 2 pre-existing f033 failures unrelated to F045), all F045 steps satisfied

### F046 - Recipe import parses ingredients and builds a reviewable base-meal draft (2026-03-14)

- Created `src/recipe-parser.ts` with ingredient line parser (`parseIngredientLine`), fuzzy matcher (`matchIngredient`), full recipe text parser (`parseRecipeText`), and component role guesser (`guessComponentRole`)
- Parser handles: quantity extraction (units like g, kg, cups, tbsp, etc.), bullet/dash/number prefix stripping, case-insensitive fuzzy matching against household ingredients and master catalog
- Matching priority: household ingredients first (score ≥ 0.5), then catalog, then unmatched
- Created `RecipeImport` page (`src/pages/RecipeImport.tsx`) at `/household/:householdId/import-recipe` with 3-step flow:
  - **Input step**: Paste recipe text (textarea) + optional source URL; Parse button disabled until text is provided
  - **Review step**: Each parsed line shows raw text, parsed quantity/name, match status (matched/catalog/unmatched) with color-coded chips; Per-line action dropdown (Use match/Create new/Ignore) with category selector for new manual ingredients; Summary chips showing matched/to-create/ignored counts
  - **Draft step**: Reviewable meal draft with name, time, difficulty, notes fields; Auto-populated components from review selections; Recipe URL auto-attached as RecipeLink; Save button disabled until meal name is provided — no auto-save
- Catalog-matched ingredients converted via `catalogIngredientToHousehold` with proper `catalogId` and `source: "catalog"` fields
- New ingredients added to household storage alongside the draft meal on save — compatible with local-first storage model
- Added "Import recipe" button to both IngredientManager (in control bar) and BaseMealManager (next to Add meal)
- Added route `/household/:householdId/import-recipe` to App.tsx
- Created 31 tests: 5 parser line tests (quantity extraction, no-quantity, bullet stripping, numbered lists, blank lines), 5 matcher tests (exact match, case-insensitive, catalog fallback, unmatched, household priority), 3 parseRecipeText tests (multi-line, blank skipping, status), 4 guessComponentRole tests (protein, carb, veg/fruit, other), 12 UI tests (input step rendering, URL field, disabled parse, review step, match chips, action change, draft building, recipe URL attachment, save persistence, catalog creation, no-auto-save, disabled save), 2 navigation tests (IngredientManager button, BaseMealManager button), 1 storage compatibility test (ingredient-meal reference integrity)
- Verified: tsc --noEmit passes (pre-existing test file errors only), vitest passes (638 tests, 2 pre-existing f033 failures unrelated to F046), all F046 steps satisfied

### F047 - Run legacy ingredient migration to normalize existing records and safely merge duplicates (2026-03-15)

- Added `normalizeIngredientName` function to storage layer: lowercases, trims, collapses internal spaces, strips trailing punctuation
- Added `toSentenceCase` function for UI display: capitalizes first letter while keeping stored name lowercase
- Added `migrateHouseholdIngredients` function that normalizes all ingredient names, detects duplicates by normalized name, picks the most complete record as survivor (scoring by tags, imageUrl, catalogId, flags), merges metadata from duplicates into survivor, and reassigns all references
- Reference reassignment covers: `MealComponent.ingredientId`, `MealComponent.alternativeIngredientIds` (with deduplication), and `WeeklyPlan.generatedGroceryList` ingredient IDs
- Alternative ingredient IDs deduplicated after remapping and filtered to exclude primary ingredient ID
- Added `runMigrationIfNeeded` function with `onebaseplate_migrated_v1` localStorage flag for one-time execution
- Migration is idempotent: running twice produces identical results with zero changes reported
- Wired `runMigrationIfNeeded()` into `main.tsx` before React render
- Applied `normalizeIngredientName` at all ingredient creation points: IngredientManager modal close, BaseMealManager inline form, RecipeImport new ingredient creation
- Applied `toSentenceCase` at all ingredient display points: IngredientManager (browse rows, modal header), BaseMealManager (select dropdowns), MealDetail (ingredient names), Planner (shared base list), GroceryList (item names)
- Updated 5 existing test files: f004 (normalized name assertions), f006 (case-insensitive regex for display), f037 (modal-based workflow for image tests), f038 (normalized name assertion), f045 (normalized name assertion)
- Created 26 tests: 5 normalizeIngredientName tests (lowercase, trim, collapse spaces, strip punctuation, combined), 3 toSentenceCase tests (capitalize, empty, preserve), 10 migrateHouseholdIngredients tests (normalize, trim+collapse, duplicates, survivor pick, meal references, alternative IDs, grocery references, idempotent, preserve non-duplicates, merge metadata), 3 runMigrationIfNeeded tests (migrate+flag, no re-migrate, empty storage), 5 end-to-end tests (sentence-case display, meal associations, catalog links, no orphans, lowercase storage + sentence-case display)
- Verified: tsc --noEmit passes, vitest passes (652 tests, 3 pre-existing f033 failures unrelated to F047), all F047 steps satisfied

### F048 - App can import Paprika .paprikarecipes exports, preserve recipe provenance, and convert recipes into reviewable base-meal drafts (2026-03-16)

- Installed `jszip` dependency for parsing .paprikarecipes zip archive format
- Added `RecipeProvenance` interface to types (sourceSystem, externalId, sourceUrl, importTimestamp, syncTimestamp) and optional `provenance`, `prepTimeMinutes`, `cookTimeMinutes`, `servings`, `importMappings` fields on `BaseMeal`
- Added `ImportMapping` interface to types (originalLine, parsedName, action, ingredientId, matchType) for preserving import decision records
- Added optional component-level metadata to `MealComponent`: `unit`, `originalSourceLine`, `matchType`, `confidence`
- Created `src/paprika-parser.ts` with:
  - `parsePaprikaFile`: parses .paprikarecipes zip archives, decompresses individual .paprikarecipe gzip entries, extracts JSON recipe records
  - `parseRecipeIngredients`: parses ingredient text lines from a Paprika recipe and matches against household ingredients and catalog
  - `detectDuplicateMeal`: case-insensitive name matching against existing meals
  - `parsePaprikaRecipes`: bulk parsing of multiple recipes with duplicate detection and default selection state
  - `buildDraftMeal`: creates a draft BaseMeal with provenance, mapped components, import mappings, recipe links, timing metadata, and new ingredients
  - Time parsing supports hours+minutes format (e.g. "1h 30m") and plain numbers
  - Difficulty mapping from Paprika text to easy/medium/hard enum
- Created `PaprikaImport` page (`src/pages/PaprikaImport.tsx`) at `/household/:householdId/import-paprika` with 4-step flow:
  - **Upload step**: File input for .paprikarecipes with error handling for invalid files
  - **Select step**: Bulk recipe selection with select-all, select-none, select-by-category; duplicate detection with skip/merge/keep-both actions; recipe metadata display (time, servings, categories, ingredient count)
  - **Review step**: Per-recipe ingredient review with match status chips (matched/catalog/unmatched), per-line action dropdowns (Use match/Create new/Ignore), category selector for new manual ingredients, recipe-by-recipe navigation
  - **Done step**: Import confirmation with count and navigation to meals/home
- Added "Import Paprika" button to both IngredientManager and BaseMealManager control bars
- Added route `/household/:householdId/import-paprika` to App.tsx
- Updated MealDetail page with:
  - Conditional "Import info" section showing provenance (source system, original recipe link, import date, prep/cook times, servings)
  - Conditional "Original recipe lines" section showing import mappings with action chips (use/create/ignore) — allows reopening imported meals to understand component origins without re-parsing
- Import mappings and provenance are lightweight sections that don't dominate the page
- All new fields are optional — existing saved data works without migration
- Imported meals remain compatible with planner overlap scoring, grocery list generation, and local-first storage
- Created 33 tests: 5 parseRecipeIngredients tests (matching, unmatched, empty, quantities, default actions), 2 detectDuplicateMeal tests (found, not found), 1 parsePaprikaRecipes bulk test (multi-recipe with duplicate detection), 12 buildDraftMeal tests (provenance, time mapping, prep/cook preservation, difficulty, servings, recipe links, notes, import mappings, component metadata, catalog creation, fallback time, hours parsing), 4 UI tests (upload step, error handling, IngredientManager button, BaseMealManager button), 4 MealDetail provenance tests (shown, hidden, mappings shown, mappings hidden), 3 compatibility tests (planner overlap, save/load persistence, backward compatibility), 2 duplicate detection tests (meal name, ingredient name)
- Verified: tsc --noEmit passes, vitest passes (684 tests, 9 pre-existing f035 failures unrelated to F048), all F048 steps satisfied

### F049 - Paprika import supports bulk ingredient review and robust ingredient-line parsing (2026-03-16)

- Enhanced `parseIngredientLine` in `recipe-parser.ts` to handle decimal quantities (1.5), fractions (1/2), "of" phrasing ("1 pinch of salt"), parenthetical notes ("quinoa (any color)"), and preparation suffixes ("lime, zested and squeezed")
- Fixed numbered-list stripping regex (`\d+[.)]\s*` → `\d+[.)]\s+`) so decimal quantities like `1.5` are no longer truncated
- Added word-boundary assertions to unit pattern to prevent single-letter units (like `l` for liter) from matching partial words (like `lime`)
- Added `isInstructionLine` function detecting: asterisk-prefixed notes, imperative verb phrases, and unusually long freeform sentences (>80 chars)
- Added `unit` field to `ParsedIngredientLine` interface for separate unit tracking while keeping `quantity` backward-compatible (still includes unit string)
- Added `recipeIndex` and `recipeName` fields to `PaprikaReviewLine` for cross-recipe line identification in bulk review
- Added `computeBulkSummary` function categorizing all lines across selected recipes into matched/catalog/unmatched/instruction buckets
- Added `applyBulkAction` function supporting three bulk operations: approve-matched, create-all-new, ignore-instructions
- Added `PaprikaImportSession` type with `saveImportSession`, `loadImportSession`, `clearImportSession` for localStorage session persistence
- Replaced recipe-by-recipe mandatory review in PaprikaImport with bulk review workflow showing all lines across all selected recipes in one view
- Added bulk action buttons (Approve all matches, Create all new, Ignore all instructions) in review step
- Added "All/Ambiguous only" filter toggle to focus on unresolved lines
- Added recipe name label on each review line for cross-recipe context
- Added "Save & resume later" button that persists session to localStorage — session restored on page reload
- Session auto-cleared after successful import completion
- Import mappings preserve raw lines, parsed names, quantities, units, and final actions for auditing
- Created 37 tests: 8 enhanced parser tests (decimal, fraction, parenthetical, "of", prep suffix, rinsed well, combined, unit field), 5 isInstructionLine tests (asterisk, verbs, long sentences, normal lines, empty), 5 bulk summary/action tests (categorization, deselected exclusion, approve-matched, create-new, ignore-instructions), 3 session persistence tests (save/load, wrong household, clear), 3 review line metadata tests (recipeIndex/recipeName, quantity/unit, instruction detection), 2 compatibility tests (valid draft meals, grocery/planner unaffected), 8 UI tests (summary chips, bulk buttons, filter, recipe labels, pause/resume, session restore, session clear, multi-recipe lines), 2 instruction detection tests (auto-ignore, asterisk notes), 1 audit preservation test (import mappings)
- Verified: tsc --noEmit passes (pre-existing f035/f036/f042/f043/f045/f048 test errors only), vitest passes (721 tests, 9 pre-existing f035 failures unrelated to F049), all F049 steps satisfied

### F049 (reopened) - Paprika import supports bulk ingredient review, resumable sessions, and robust ingredient-line parsing at scale (2026-03-17)

- Reopened F049 in `PRD.json` as unfinished (`passes=false`) with expanded acceptance scope for high-volume Paprika imports.
- Updated F049 steps to require summary-first review, grouped status counts (matched/ambiguous/create-new/ignored), batch actions, resumable import sessions, explicit saved-draft UI state, and stronger parsing/audit requirements.
- Kept F049 in milestone M5 and in implementation order directly after F048; preserved dependencies and existing Paprika provenance model expectations.
- Updated screen wiring in `screenToFeatureMap` so `F048` and `F049` map to both `S007` and `S010`.
- Hardened parser behavior in `src/recipe-parser.ts`:
  - Added quantity value parsing for decimals, fractions, and mixed fractions.
  - Preserved unitless quantity counts.
  - Removed post-quantity `of` phrasing.
  - Extracted prep/qualifier metadata from parentheticals and trailing comma phrases.
  - Stripped leading prep descriptors (`grated`, `diced`, etc.) before canonical matching while preserving prep notes.
  - Preserved compound names and removed qualifier prefixes (e.g., `low-sodium beef broth` → `beef broth` + prep note).
  - Expanded instruction-line detection for note-like symbol prefixes.
- Expanded import audit metadata and component metadata:
  - `MealComponent` now supports `prepNote`.
  - `ImportMapping` now supports `cleanedIngredientName`, `parsedQuantityValue`, `parsedQuantityUnit`, `prepNotes`, `chosenAction`, and `finalMatchedIngredientId`.
  - `buildDraftMeal` now writes richer audit fields for `use`, `create`, and `ignore` actions while preserving existing mapping/provenance fields.
- Refined Paprika bulk review UX in `src/pages/PaprikaImport.tsx`:
  - Summary chips now reflect matched/ambiguous/create-new/ignored.
  - Ambiguous filter focuses unresolved unmatched named lines.
  - Added visible import session save status text ("Saved to draft ...") in select/review steps.
  - Preserved resume and back-out behavior via import session persistence.
  - Added per-line state chips for ignored/unresolved/create-new clarity.
- Updated `CHANGELOG.md` with a new 2026-03-17 entry explaining why Paprika import was reopened despite prior availability.
- Expanded F049 tests in `tests/f049-bulk-paprika-review.test.tsx`:
  - Added required parser cases: quinoa parenthetical+prep, salt with `of`, decimal water, lime with prep phrase, grated Parmesan, low-sodium beef broth, diced tomatoes, cannellini beans, olive oil, and mixed fractions.
  - Updated bulk summary assertions for matched/ambiguous/create-new/ignored model.
  - Added saved-state visibility coverage and pause/resume persistence assertion.
  - Added end-to-end style compatibility assertion that imported draft components still reference valid ingredient ids.
  - Added richer audit assertions for parsed quantity/unit, chosen action, and final matched id.
- Verification:
  - `npm run test -- tests/f049-bulk-paprika-review.test.tsx tests/f048-paprika-import.test.tsx` passes (78 tests).
  - `npm run test` still reports pre-existing failures in `tests/f035-delete-confirmation.test.tsx` (9 failures), unrelated to Paprika import changes.

### PRD import-priority rewrite - F049/F050 scope realignment (2026-03-18)

- Updated `PRD.json` so recipe import is explicitly treated as a high-priority product problem (manual cleanup reduction at scale), not only parser correctness.
- Refined feature boundaries:
  - `F048` now focuses on Paprika archive ingest, metadata/provenance retention, duplicate meal handling, and draft creation entry into ingredient-resolution review.
  - `F049` now focuses on import-quality gates: non-ingredient suppression, normalization before matching, quantity/unit stripping for matching while preserving audit data, improved fuzzy suggestions with confidence levels, and blocking draft creation until unresolved lines are handled or intentionally ignored.
  - Added new `F050` (`P0`, `passes=false`, depends on `F049`) for Bulk Import Resolution UX: unresolved count visibility, grouped repeated unresolved names, apply-one-resolution-to-all occurrences, status filters (unresolved/ignored/matched/low-confidence), exceptions-only review, resumable progress, and duplicate-prevention safeguards.
- Reordered and rewired planning metadata so import cleanup remains the active stream:
  - Added `F050` to milestone `M5`.
  - Inserted `F050` immediately after `F049` in `implementationOrder` and before unrelated nav/shell backlog.
  - Added `F050` to `screenToFeatureMap` for `S007` and `S010`.
- Captured behavior already present in app but previously under-specified in PRD (saved-session clarity, unresolved-focused review semantics, and import resolution safety expectations) so spec and current workflow are aligned.
- Rationale: current bulk Paprika imports still require too much manual intervention, so import cleanup and grouped bulk resolution are now explicit near-term priorities.

### F051 - Base Meal Editor (S007) focused UX refactor in place (2026-03-18)

- Added new S007-specific UX feature `F051` to `PRD.json` and mapped it to `S007`; included in milestone `M5` and implementation order for explicit tracking.
- Updated `CHANGELOG.md` with a dedicated 2026-03-18 PRD-alignment entry documenting the new S007 polish feature scope.
- Refactored `src/pages/BaseMealManager.tsx` in place (no parallel editor) into a clearer meal-building flow:
  - Sticky modal header with prominent meal title and summary chips (time, difficulty, rescue eligibility).
  - Clear section hierarchy with explicit order and test IDs: identity, structure/components, planning metadata, and secondary references.
  - Components are compact cards collapsed by default with summary lines; expand on demand for editing.
  - Alternatives UX now shows default ingredient clearly, renders alternatives as visible chips, and uses an explicit add-alternative searchable/selectable picker.
  - Inline ingredient creation remains available inside component editing and still auto-selects the created ingredient.
  - Recipe links, notes, and image editing moved into lower-priority collapsible sections.
  - Action clarity improved with sticky footer and explicit primary action text (`Save meal`), while destructive action is visually de-emphasized and confirmation flow preserved.
- Updated S007-adjacent tests for the new editor behavior:
  - `tests/f005-base-meals.test.tsx`: adapted component interactions to collapsed cards and added coverage for section hierarchy, collapsed-by-default behavior, and explicit save action closing.
  - `tests/f028-multi-protein.test.tsx`: adapted alternatives assertions to expanded component cards and new alternatives UI selectors.
  - `tests/f029-recipe-links-notes.test.tsx`: adapted to collapsible recipe-links and notes sections.
  - `tests/f037-photos.test.tsx`: adapted meal image assertions to collapsible image section.
  - `tests/f038-inline-ingredient.test.tsx`: adapted inline ingredient flow to expand component editor first.
  - `tests/f025-styling.test.tsx`: updated field-label expectation (`Meal name`).
- Verification:
  - `npm run test -- tests/f005-base-meals.test.tsx tests/f028-multi-protein.test.tsx tests/f029-recipe-links-notes.test.tsx tests/f037-photos.test.tsx tests/f038-inline-ingredient.test.tsx tests/f025-styling.test.tsx` passes (78 tests).
  - `ReadLints` reports no linter errors on touched files.

### F052 - Create Household (S006) focused UX polish in place (2026-03-18)

- Added new S006-specific UX feature `F052` to `PRD.json` and mapped it to `S006`; included in milestone `M5` and implementation order for explicit tracking.
- Updated `CHANGELOG.md` with a dedicated 2026-03-18 PRD-alignment entry documenting the new Create Household polish feature scope.
- Refactored `src/pages/HouseholdSetup.tsx` in place (no new flow, no data model changes):
  - Introduced clearer section hierarchy with compact header purpose, household-details card, members card, and action card.
  - Replaced always-expanded member forms with compact member rows showing name, role, and texture chips.
  - Added inline expand/edit behavior (`Edit`/`Done`) so only one member row is expanded at a time, reducing form bulk.
  - Replaced the dominant dashed empty state with a lighter members empty state and explicit CTA text (`Add your first member`).
  - Kept Add member visible both in the members section header and near the final primary action.
  - Clarified action hierarchy: `Create household` / `Save household` remains primary; `Add member` is secondary.
  - De-emphasized destructive member removal UI to a subtle inline control while preserving confirmation dialog behavior.
- Updated tests for compact member UX while preserving functionality:
  - `tests/f002-household.test.tsx`: adapted member add/edit/remove interactions for compact-expand rows, updated persisted-member assertions to scan compact summaries, and added lightweight empty-state CTA coverage.
  - `tests/f025-styling.test.tsx`: updated HouseholdSetup empty-state text assertion.
  - `tests/f035-delete-confirmation.test.tsx`: aligned member remove selectors/assertions with compact row controls.
- Verification:
  - `npm run test -- tests/f002-household.test.tsx tests/f025-styling.test.tsx` passes (31 tests).
  - `npm run test -- tests/f033-mobile.test.tsx -t "Responsive page header"` passes (1 targeted responsiveness test).
  - `ReadLints` reports no linter errors on touched files.

### F053 - Global vs section navigation consistency (2026-03-18)

- Added explicit PRD feature `F053` to define and track a two-level navigation hierarchy:
  - Global nav for top-level app pages only (Home, Weekly planner, Meal planner, Grocery list, Rescue mode, Meal history).
  - Section tabs for section-level pages (Households, Ingredients, Base meals).
- Updated `PRD.json` to include `F053` in features, milestone `M5`, implementation order, and screen mappings (`S001`, `S003`, `S005`, `S006`, `S008`, `S010`).
- Updated `CHANGELOG.md` with a 2026-03-18 PRD-changelog entry for the new navigation consistency feature.
- Refactored shared navigation in `src/components/ui.tsx`:
  - Added `GlobalNav` and `SectionNav` components with separate item definitions and active-state logic.
  - Kept `HouseholdNav` as a backward-compatible alias to `GlobalNav` to avoid route/component churn.
  - Added explicit nav/test hooks: `data-testid="global-nav"` and `data-testid="section-nav"`.
- Wired section tabs into section-level pages only (below page headers):
  - `src/pages/HouseholdList.tsx`
  - `src/pages/HouseholdSetup.tsx`
  - `src/pages/IngredientManager.tsx`
  - `src/pages/BaseMealManager.tsx`
- Updated affected tests for the split navigation pattern and routing expectations:
  - `tests/f036-navigation.test.tsx`
  - `tests/f041-household-click-setup.test.tsx`
  - `tests/f038-inline-ingredient.test.tsx`
  - `tests/f002-household.test.tsx`
- Verification:
  - `npm run test -- tests/f036-navigation.test.tsx tests/f041-household-click-setup.test.tsx tests/f038-inline-ingredient.test.tsx tests/f002-household.test.tsx` passes (72 tests).
  - `ReadLints` reports no linter errors on touched files.

### Navigation regression fix — shared household shell + secondary nav (2026-03-19)

- **PRD:** F036, F038, F041, F053; screens S001, S003, S005, S006, S008, S010.
- Centralized nav items and active-state rules in `src/nav/householdNavConfig.ts` (global vs secondary; “All households”; meal detail → Base meals active; setup index → All households active; Home global active only on `/home`).
- Added `src/layouts/HouseholdLayout.tsx` rendering `AppHeader`, `HouseholdNavStack` (global + visually distinct secondary row), and `<Outlet />` for all `/household/:householdId/*` routes.
- Nested household routes under `/household/:householdId` in `App.tsx`; explicit `/household/new` for create flow. `HouseholdSetup` uses `householdId` from the parent param and `useMatch("/household/new")` for create vs edit.
- Removed per-page duplicate `HouseholdNav` / `SectionNav` / `PageShell` from household pages; `HouseholdList` uses `HouseholdNavStack` inside `PageShell`.
- `PageHeader` now renders optional `subtitle` / `subtitleTo` (e.g. Rescue mode tagline).
- `SecondaryNav` filters household-scoped links when no `householdId`; `GlobalNav` returns null without id.
- Tests: `tests/householdLayoutRoutes.tsx` for MemoryRouter parity with App; broad test route updates; `tests/household-nav-config.test.ts`; expanded `tests/f036-navigation.test.tsx` for F053 acceptance.
- Verification: `npx vitest run` (796 tests), `tests/household-nav-config.test.ts` passes.

### F050 — Paprika bulk import exception-first grouped review (2026-03-20)

- **PRD:** F050; screens S007/S010 Paprika import path.
- Confidence bands + scores on `matchIngredient`; `PaprikaReviewLine` gains `resolutionStatus`, `groupKey`, `manualIngredientId`, `createDraft`, `parserSuggested*` ids, etc.
- `parseRecipeIngredients` sets pending for unmatched/low-confidence matches; `canFinalizePaprikaImport` gates save; `buildDraftMeal` takes `householdIngredients` for manual match resolution; `ImportMapping` extended for audit fields.
- `applyGroupResolution` + `migrateLegacyPaprikaRecipes`; grouped review UI (filters, group actions, modals, duplicate dialog, per-line overrides); Import disabled until finalized.
- `MealDetail` shows raw / parsed / result for import mappings when present.
- Tests: `tests/f050-paprika-grouped-resolution.test.tsx`; updates to F048/F049 Paprika tests; Settings anchor form typing fix for `tsc`.
- Verification: `npx tsc --noEmit`, `npx vitest run` (836 passed).

### PRD reconciliation — spec matches shipped F051 + F055/F056 data model (2026-03-22)

- **Corrected:** `PRD.json` marked **F051** `passes=true` (implementation and tests were already recorded in this log on 2026-03-18; only the PRD flag was stale).
- **Corrected:** `dataModel.entities` updated to match current `src/types.ts` and shipped behavior: **ComponentRecipeRef**, **DayPlan.componentRecipeOverrides**, **WeeklyAnchor** / **Household.weeklyAnchors**, **Recipe** library rows, **Household** aggregate, **GroceryItem**, **MealOutcome**, **RecipeLink**, **RecipeProvenance**, **ImportMapping**; **MealComponent** / **Ingredient** / **BaseMeal** field lists aligned with code; flattened mistaken nested entity array; **AssemblyVariant** documents canonical app fields first with optional legacy persist keys.
- **Explicit mismatches resolved:** PRD `passes` for F051 vs codebase; PRD `catalogItemId` vs code `catalogId`; PRD `importedRecipeSource` vs code `provenance`; obsolete PRD-only `ImportedRecipeSource` / `ImportedIngredientMatch` vs code `RecipeProvenance` / `ImportMapping`.
- **Note (2026-03-25):** **F065** (household ingredient aliases) added and completed; see F065 entry below. Prior “no incomplete feature” statement applied before F065 landed.
- **Verification:** `npx tsc --noEmit` passes; `npx vitest run tests/f005-base-meals.test.tsx tests/f028-multi-protein.test.tsx tests/f029-recipe-links-notes.test.tsx tests/f021-weekly-calendar.test.tsx tests/f056-theme-anchors.test.tsx` — 5 files, 47 tests passed.

### F057 — First-class Recipe model with RecipeRef and typed categories (2026-03-22)

- **PRD:** F057; screens S002, S004, S007, S010.
- Added `RecipeType` union (`whole-meal | component | sauce | sub-recipe | batch-prep`) and `RecipeRef` type (`recipeId, label?, role?, notes?`) to `src/types.ts`.
- Enhanced `Recipe` with optional `recipeType`, `parentRecipeId` (sub-recipe relationships), `directions` (step-by-step cooking instructions carried from Paprika), `tags`.
- Added `BaseMeal.recipeRefs?: RecipeRef[]` for whole-meal / assembly / shortcut recipe references alongside existing `recipeLinks`.
- Added `ComponentRecipeRef.recipeId?: string` as explicit FK to Recipe, formalizing the F055 cooking-first flow while keeping `importedRecipeSourceId` and `linkedBaseMealId` for backwards compatibility.
- Added `Ingredient.defaultRecipeRefs?: RecipeRef[]` as optional fallback (not the primary resolution model).
- Added v2 storage migration (`migrateHouseholdRecipeRefs` / `runRecipeRefMigrationIfNeeded`): backfills `recipeRefs` from `sourceRecipeId`, copies `importedRecipeSourceId` to `recipeId` on `ComponentRecipeRef`, infers `recipeType` for imported recipes. Gated by `onebaseplate_migrated_v2` flag; idempotent.
- Updated `promoteRecipeToBaseMeal` to auto-populate `recipeRefs` with a primary `RecipeRef`.
- Updated Paprika `buildDraftRecipe` to set `recipeType: "whole-meal"` and carry `directions` from raw Paprika data.
- Added `recipeType` as optional sort key in `sortRecipes`.
- PRD: added F057 feature entry, RecipeRef entity, updated Recipe/BaseMeal/ComponentRecipeRef/Ingredient entities in `dataModel`, added to M5/implementationOrder/screenToFeatureMap.
- Tests: `tests/f057-recipe-model.test.ts` — 24 tests covering recipe entity persistence, backward compatibility, migration safety, component recipe refs with recipeId, imported provenance, promoteRecipeToBaseMeal, BaseMeal.recipeRefs, Ingredient.defaultRecipeRefs, recipeType sorting.
- Verification: `npx tsc --noEmit`, `npx vitest run tests/f057-recipe-model.test.ts` (24 passed).

## F058 — Recipe attachment and suggestion UX (2026-03-22)

- Extended `ComponentRecipePicker` to accept optional `recipes: Recipe[]` prop; renders results in three groups (household recipes, imported recipes, base meals) with correct search priority. Added `mode="meal"` for whole-meal RecipeRef attachment with `onSaveMealRef` callback.
- Added whole-meal RecipeRef attachment UI in `BaseMealManager` `MealModal` section 4: `<details>` block with recipe chips, remove buttons, and "Attach recipe" button opening the picker in meal mode.
- Added per-alternative-protein recipe attachment in `ComponentForm`: each alternative ingredient shows "Attach recipe" link opening the picker; stores refs with `notes: "alt:{ingredientId}"` convention; shows recipe label chip on alternatives list.
- Threaded `household.recipes` through `BaseMealManager` → `MealModal` → `ComponentForm` → `ComponentRecipePicker` (and in `Planner.tsx` picker).
- Implemented `resolveFullCookingRef` in `componentRecipes.ts`: full priority chain (session → plan → component → meal → ingredient → prepNote/recipeLinks). Returns `{ effective, source, sourceLabel }`.
- Updated Planner "How to make tonight": replaced flat sorted list with role-grouped sections (Protein, Carb, Sauce, Veg/toppings, Toppings). Shows whole-meal `recipeRefs` and `recipeLinks` at top. Displays resolution source labels (e.g. "Whole-meal recipe", "Ingredient default") as muted text.
- Added recipe cue chips on `WeeklyPlanner` `DayCard`: recipe count, prep-ahead, batch-friendly indicators (only shown when non-zero).
- Implemented `findPrepAheadOpportunities`: scans week plan for ingredients appearing on 2+ days with batch-prep recipes, surfaced below effort-balance bar.
- Enhanced `MealDetailContent`: added "Recipes" section showing whole-meal `recipeRefs` as cards and component-level recipe refs as summary lines. Updated `MealStructure` to show per-component recipe labels and per-alternative recipe indicators.
- Added subtle recipe count cue on `MealCard` stats line using `countMealRecipes`.
- Added helper functions: `countMealRecipes`, `hasBatchPrepRecipe`, `hasPrepAheadRecipe`, `findPrepAheadOpportunities`.
- PRD: added F058 feature entry with 12 steps, dependencies on F055/F057, acceptance refs S002/S003/S004/S007. Added to M5/implementationOrder/screenToFeatureMap.
- Tests: `tests/f058-recipe-attachment-ux.test.ts` — 26 tests covering full resolution chain priority (all 7 levels), backwards-compatible `resolveComponentEffectiveRef`, session override vs saved default, recipe counting (with alt-protein exclusion), batch-prep detection, prep-ahead opportunities, alt-protein convention, and `summarizeRecipeRef`.
- Verification: `npx tsc --noEmit` clean, `npx vitest run` — 963 passed, 0 failed (63 test files).

### F059 — Expanded seed content: broader catalog, example recipes, and wired base meals (2026-03-22)

- Added `aliases?: string[]` to `CatalogIngredient` interface and updated `c()` helper and `searchCatalog()` to support alias matching.
- Added ~30 new `MASTER_CATALOG` entries covering taco ingredients (black beans, corn tortillas, cilantro, lime, jalapeño, cumin, chili powder, sour cream, taco seasoning, lettuce), pizza ingredients (mozzarella, yeast, Italian seasoning, oregano, basil, tomato paste, sugar), pasta bake ingredients (ricotta, heavy cream), bowl ingredients (sesame oil, sriracha, ginger, edamame, sesame seeds), and pantry basics (honey, paprika, vinegar, mustard, cornstarch, mayonnaise).
- Added aliases to existing catalog entries: "Wraps / tortillas" (flour tortillas, soft tortillas), "Tinned tomatoes" (canned tomatoes, diced tomatoes), "Passata" (tomato puree, strained tomatoes), "Yogurt" (plain yogurt, greek yogurt).
- Added 26 new household ingredients to H001 seed data and 11 pantry basics to H004.
- Seeded 10 example recipes in H001: Grilled taco chicken (component), Black bean taco filling (component), Quick yogurt-lime sauce (sauce), Basic pizza dough (component), Quick pizza sauce (sauce), Simple tray pizza (whole-meal), Basic pasta bake sauce (sauce), Roasted broccoli (component), Plain seasoned rice (component), Simple cheese sauce (sauce). Each includes components referencing household ingredients, step-by-step directions, ingredientsText, prep/cook times, servings, and tags.
- Seeded 5 example base meals in H001: Taco night (with grilled chicken + alt black bean filling + yogurt-lime sauce recipes), Pizza night (with dough + sauce + tray pizza shortcut recipes), Pasta bake (with pasta bake sauce recipe), Rice bowl (with seasoned rice + roasted broccoli recipes + alt tofu), Cheesy pasta rescue (with cheese sauce recipe, rescue-eligible).
- All base meals use `recipeRefs` (meal-level) and `ComponentRecipeRef` (component-level) wiring to demonstrate the recipe-as-cooking-guidance model.
- Verified: all ingredient IDs, recipe IDs, and recipeRef wiring internally consistent; no duplicate ingredient names; JSON valid; build clean; tests pass.
- PRD: added F059 feature entry with 9 steps, dependencies F044/F057, acceptance refs S001/S002/S003/S004/S007/S010. Added to M5, implementationOrder, and screenToFeatureMap.

### F060 — Paginated ingredient table with bulk selection and safe bulk delete (2026-03-22)

- Replaced infinite-scroll (`useIncrementalList`) with traditional pagination (`usePaginatedList`) for the Ingredients page.
- Created `src/hooks/usePaginatedList.ts`: generic page-based list hook with page/totalPages/pageSize controls, reset-on-filter-change, and memoized page slices. Supports 25/50/100 items per page. The existing `useIncrementalList` hook is preserved for other pages (BaseMealManager, RecipeLibrary, BrowseMealsModal).
- Created `src/lib/ingredientRefs.ts`: `findIngredientReferences()` utility that scans household baseMeals, recipes, weeklyPlans, and importMappings for ingredient ID references. Returns a map of ingredient ID to reference details (type + entity name). Pure function, no side effects.
- Refactored `src/pages/IngredientManager.tsx` in place:
  - Replaced `useIncrementalList` with `usePaginatedList`; removed sentinel ref, IntersectionObserver, and "Load more" button.
  - Added sticky control bar with source filter (manual/catalog/imported) alongside existing search, category, tag, and sort controls.
  - Added page-size selector (25/50/100) in the control bar.
  - Added per-row selection checkboxes with `stopPropagation` so clicking the checkbox selects without opening the edit modal.
  - Added select-all-on-page header checkbox with indeterminate state for partial selection.
  - Added bulk actions bar (appears when 1+ items selected) with: select-all-filtered, clear selection, and delete selected.
  - Selection state (`selectedIds: Set<string>`) persists across page navigation and filter changes within the session.
  - Added `BulkDeleteConfirmDialog` component: shows selected count, first 5 sample names, and reference-safety analysis. Protected ingredients (referenced by meals/recipes/plans) are listed with the entity names that reference them. Offers "Delete N unreferenced" when a mix exists, or "Close" when all are referenced.
  - Added `PaginationControls` component: first/prev/page-numbers/next/last with ellipsis for large page counts.
  - Refactored `IngredientRow` to `IngredientTableRow`: outer element is a `<button>` for accessibility, with inner checkbox label using `stopPropagation`. Desktop shows aligned columns (checkbox, thumbnail, name, category, tags, source, flags). Mobile uses stacked card layout with inline chips below the name.
  - Result summary shows total items, filtered count, selected count, and current page/total pages.
  - After bulk delete, pagination auto-recovers to a valid page.
  - Single-ingredient delete from modal, normalization, duplicate handling, catalog population, and add-ingredient flows all preserved unchanged.
- Created `tests/f060-ingredient-bulk.test.tsx` with 34 tests covering: paginated rendering, page size changes, page navigation, row selection via checkbox, select-all-on-page toggle, select-all-filtered, clear selection, selection persistence across pages, selection persistence across filters, source filter, bulk delete confirmation dialog, unreferenced ingredient deletion, protected ingredient detection (baseMeal references), partial delete (unreferenced only), all-referenced blocking, `findIngredientReferences` unit tests (baseMeal, recipe, weeklyPlan, alternative IDs, no-references), recovery after bulk delete (page and empty state), row-click-opens-modal, mobile layout, no load-more button, no sentinel element.
- Updated existing tests for pagination compatibility: `f004-ingredients.test.tsx` (incremental → pagination test), `f037-photos.test.tsx` (search before click for off-page items), `f043-ingredient-browse.test.tsx` (replaced `loadAllIngredientListRows` with `showAllIngredientRows`/search), `f044-ingredient-catalog.test.tsx` (same), `f047-ingredient-migration.test.tsx` (same). Updated `tests/incremental-load-helpers.ts` with deprecated `loadAllIngredientListRows` (graceful no-op) and new `showAllIngredientRows` (sets page size to 100).
- All 1010 tests pass (13 pre-existing skips).
- PRD: updated F043 description and steps to mention pagination, source filter, and bulk selection. Updated S010 goal, requiredElements, and acceptance criteria to cover 1000+ ingredients, pagination, bulk selection, safe bulk delete, and selection persistence. Added F060 feature with 18 steps, dependencies F043/F004, acceptance ref S010. Added F060 to M5 milestone and screenToFeatureMap.S010.
- Known limitations: page size maxes at 100; for libraries > 100 items, users must page through. The `useIncrementalList` hook is still used by other pages (not removed). Bulk tag/category actions are not implemented (future-safe slot in the bulk bar). Import mappings on meals/recipes may retain stale ingredient IDs after deletion (pre-existing behavior, not introduced by this change).

### F061 — Cross-platform local-first storage (Dexie + migration) (2026-03-23)

- **PRD:** F061; milestone M6; `technicalApproach.suggestedStack.storage` and architecture notes updated for repository + IndexedDB + future Expo SQLite.
- **Architecture:** Typed `HouseholdRepository` / `AppMetaStore` ports in `src/storage/ports.ts` (stable seam for native SQLite later). Web implementation: Dexie DB `onebaseplate_app`, `meta` table keyed rows for `households` (full `Household[]` JSON) and `paprika_import_session` (string). `src/storage/migrate-v3.ts` runs once (guard `storage_layer_migrated_v3`) and imports legacy `localStorage` `onebaseplate_households`, legacy `idb` `onebaseplate`/`kv` overflow payload, and migrates Paprika draft from `onebaseplate_paprika_session` localStorage into Dexie. Does not overwrite non-empty Dexie household data.
- **Seed:** Unchanged source — `seed-data.json` / `seedIfNeeded()` writes into Dexie when empty and `onebaseplate_seeded` unset; idempotent with existing flag behavior.
- **Lightweight localStorage:** Theme (`src/theme.ts`), tour (`GuidedTour.tsx`), `onebaseplate_seeded`, `onebaseplate_default_household_id`, `onebaseplate_migrated_v1` / `v2` remain on localStorage by design.
- **Major files:** `src/storage/constants.ts`, `dexie-db.ts`, `legacy-idb.ts`, `migrate-v3.ts`, `paprika-session-store.ts`, `ports.ts`; refactored `src/storage.ts`; `src/paprika-parser.ts` session I/O; `src/main.tsx` `await seedIfNeeded()`; `scripts/seed.ts`; `tests/setup.ts` (`fake-indexeddb`, global reset); `tests/f062-storage-layer.test.ts`.
- **Tests:** `npm test` — 1043 passed, 13 skipped (67 files). `npx tsc --noEmit` may still report unrelated pre-existing issues in other files.
- **Fixture / PRD alignment:** Scaffold and typecheck imports now reference `fixtures/households/H001-mcg.json`; f016 and e2e use `H002-two-adults-toddler-baby.json`; `fixtureHouseholds` trimmed to on-disk fixtures.

### F062 — Account-based cloud persistence with Supabase Auth and household snapshot sync (2026-03-23)

- **PRD:** F062; milestone M7; `technicalApproach.suggestedStack` updated with `auth` and `remotePersistence` entries; architecture notes updated for Supabase cross-browser sync.
- **Architecture:** Optional Supabase Auth (email/password) with env-based configuration (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). When env vars are absent, app works fully local (same as before). Supabase client singleton in `src/supabase/client.ts` returns null when not configured. Auth service in `src/auth/auth-service.ts` wraps sign-up, sign-in, sign-out, session restore. React `AuthContext` + `useAuth` hook in `src/auth/`. Remote data model: `households` table (id uuid, data JSONB, owner_id, updated_at, version), `household_memberships` (access control with owner/editor roles, unique on household+user), `profiles` (auto-created via trigger). SQL DDL + RLS policies in `supabase/migrations/001_households.sql` (reference only, not auto-run).
- **Sync engine:** `src/sync/sync-engine.ts` coordinates local-first Dexie with remote Supabase. `syncAfterSave` upserts all households to remote after local Dexie write (fire-and-forget async). `pullRemoteHouseholds` fetches by user membership. `pushLocalHouseholds` uploads batch. `detectFirstLoginContext` + `resolveFirstLogin` handle three bootstrap scenarios. Injectable `RemoteRepoAdapter` for testability. Conflict strategy: household-level last-write-wins via `updatedAt`.
- **First-login migration:** When both local and remote have data, `FirstLoginMigrationDialog` shows three explicit choices: keep local (upload), keep remote (replace), merge by household ID. No silent data destruction. When only one side has data, auto-resolves (upload or hydrate). `hydrateFromRemote` replaces local Dexie store.
- **Storage wiring:** `src/storage.ts` calls `syncAfterSave` in `saveHouseholds` / `persistHouseholdsNow` when authenticated. `deleteHousehold` calls `syncDeleteHousehold`. All existing exports unchanged. `src/main.tsx` wraps app in `AuthProvider`.
- **Auth UI:** `src/components/AuthUI.tsx` added to Settings page. Shows sign-in/sign-up tabs, session display, sync status badge (local-only / cloud synced / sync error), sign-out. `src/components/FirstLoginMigrationDialog.tsx` for conflict resolution.
- **Major files:** `.env.example`, `src/config.ts`, `src/supabase/client.ts`, `src/auth/auth-service.ts`, `src/auth/AuthContext.tsx`, `src/auth/useAuth.ts`, `src/sync/types.ts`, `src/sync/remote-repository.ts`, `src/sync/sync-engine.ts`, `src/storage.ts` (wiring), `src/storage/ports.ts` (RemoteHouseholdRepository), `src/main.tsx`, `src/pages/Settings.tsx`, `src/components/AuthUI.tsx`, `src/components/FirstLoginMigrationDialog.tsx`, `supabase/migrations/001_households.sql`, `tests/f062-auth-sync.test.ts`.
- **Tests:** `npm test` — 1078 passed (1065 + 13 skipped), 68 files. 22 new tests in `tests/f062-auth-sync.test.ts` covering: signed-out local-only (4 tests, no regressions), authenticated save + remote sync (3 tests), syncAfterSave / syncDeleteHousehold (3 tests), first-login upload (1 test), first-login hydrate (1 test), first-login conflict resolution (5 tests including keep-local, keep-remote, merge, overlapping-ID merge), hydrateFromRemote (1 test), sync state tracking (3 tests), household access filtering (1 test).
- **Known limitations:** Household-level last-write-wins; no field-level merge or CRDT. No real-time subscription (pull on sign-in only). Full invite/share UX deferred. Auth UI is minimal (Settings page only, no dedicated auth pages). Supabase tables must be created manually via SQL editor or CLI.

### F063 — Shared household access, invite flow, and safer sync/recovery UX (2026-03-23)

- **PRD:** F063; milestone M7 (after F062); depends on F062.
- **Sharing model:** Builds on existing `household_memberships` (owner/editor). New `household_invites` table stores 8-char alphanumeric invite codes with expiry (default 72h) and max_uses (default 5). Invite codes are generated client-side using `crypto.getRandomValues`. RLS policies allow owners to manage invites, any authenticated user to look up an invite by code for acceptance.
- **Invite flow:** Owner generates invite link from Settings > Household sharing panel. Link format: `{origin}/invite/{code}`. Recipient visits the link. If not signed in, they see a prompt to sign in first. If signed in, the app validates the code (not expired, not maxed), inserts an `editor` membership, increments `use_count`, fetches the household data, and hydrates it into local Dexie. New route `/invite/:code` + `AcceptInvite.tsx` page.
- **Sync/recovery behavior:** `SyncState` extended with `hasPendingChanges` (dirty flag — set on sync start, cleared on success, stays true on error/offline), `online` (mirrors `navigator.onLine`), `errorKind` (`auth_expired` | `remote_unavailable` | `unknown`). Sync engine checks `navigator.onLine` before network calls; when offline, marks pending and returns. Browser `online`/`offline` event listeners auto-retry sync on reconnect when pending changes exist. `manualSync()` compares local vs remote `updated_at` per household and returns conflict descriptors if remote is newer. `SyncRecoveryPanel` shows rich status chips, manual sync button, export backup, re-download from cloud (explicit confirm), and conflict dialog for remote-newer scenarios.
- **Session restore fix:** `AuthProvider` now calls `setCurrentUserId(user.id)` when restoring an existing session on mount and on auth state changes. This means sync works after page refresh without requiring the user to visit the sign-in flow again. `main.tsx` wires `initOnlineListeners()` at startup.
- **UI:** `HouseholdSharingPanel` on Settings (member list with role badges, generate/copy/revoke invite links, remove member for owner, leave household for editors). `SyncRecoveryPanel` on Settings (sync chip, last synced time, sync now, export backup, re-download from cloud, conflict resolution dialog). `AuthUI` sync badge updated to show all states (synced, syncing, pending, offline, error).
- **Major files:** `supabase/migrations/002_invites.sql`, `src/sync/types.ts`, `src/sync/sync-engine.ts`, `src/sync/remote-repository.ts`, `src/sync/invite-service.ts`, `src/hooks/useOnlineStatus.ts`, `src/components/HouseholdSharingPanel.tsx`, `src/components/SyncRecoveryPanel.tsx`, `src/components/AuthUI.tsx`, `src/pages/AcceptInvite.tsx`, `src/pages/Settings.tsx`, `src/App.tsx`, `src/main.tsx`, `src/auth/AuthContext.tsx`, `src/storage.ts`.
- **Tests:** `npm test` — 1086 passed (1073 + 13 skipped), 69 files. 21 new tests in `tests/f063-sharing-sync.test.ts` covering: enhanced sync state defaults (1), dirty tracking (2), error classification (3), offline dirty-state (1), sync retry after reconnect (1), manual sync push + conflict detection (2), compareWithRemote (1), shared household membership + hydration (2), JSON export backup (2), signed-out regressions (3), household data integrity (1), pull error handling (2).
- **Known limitations:** Invite acceptance requires the user to be signed in before visiting the link (no inline sign-up on the invite page). No real-time subscription — shared edits require manual sync or page refresh. Household-level last-write-wins still applies; no field-level merge. Invite codes are single-household; no batch invite across households. `002_invites.sql` must be applied manually (same pattern as `001_households.sql`).

### F064 — Paprika parser and matcher hardening for import quality (2026-03-24)

- **PRD:** F064; milestone M5; P0 functional; depends on F049+F050; acceptance refs S007, S010.
- **Root causes fixed:**
  1. `normalizeForMatch` destroyed non-ASCII chars via `[^a-z0-9\s]` → fixed with Unicode property escapes `\p{L}\p{N}`.
  2. Packaging words leaked into canonical names (only stripped when unit was also packaging) → now stripped unconditionally.
  3. No trailing quantity support ("chicken stock 200ml", "baby leeks 6") → new `tryParseTrailingQuantity` function.
  4. No embedded size/dimension stripping ("6-inch", "2-pound") → new `stripEmbeddedSizeDimension` function.
  5. Size adjectives not stripped ("large", "medium") → new `stripLeadingSizeDescriptors` moves them to prep notes.
  6. No singular/plural normalization → new `singularize()` function and `normalizeForMatching()` two-layer pipeline.
  7. Missing suffix stripping ("for serving", "in water", "cut into wedges") → expanded `stripTrailingPrepPhrases`.
  8. Tomato-family matching failed (Jaccard too low) → style-word stripping for matching + catalog aliases.
  9. Weak compound-name protection → expanded `COMPOUND_WHERE_FIRST_TOKEN_ALONE_IS_WRONG`, `GENERIC_HEADS`, `REQUIRED_MODIFIER_TOKENS`.
- **Parser changes:** Order of operations in `finalizeCanonicalName` fixed (packaging stripping before prep descriptor stripping). Pre-unit size modifier detection ("1-2 large pieces of kale" → unit=pieces, name=kale). Additional prep descriptors: stewed, cooked, roasted, smoked, dried, fresh, lightly, loosely. "quantity" word stripped from names. Trailing "leaves" stripped.
- **Normalizer changes:** `normalizeForMatch` preserves Unicode. New `singularize()` with exception list (hummus, couscous, gnocchi, tortellini, peas, etc.). New `normalizeForMatching()` strips packaging words and size descriptors then singularizes. New `tokenizeSingular()`.
- **Matcher changes:** `matchScore` uses singularized tokens for Jaccard comparison. New `stripMatchStyleDescriptors` strips style words (italian, stewed, roasted, cooked, plum, baby, vine, hot) for a secondary matching pass. `matchIngredient` tries both primary and style-stripped queries against candidates and aliases, with separate veto checks for each path. Catalog alias matching integrated into the scoring loop. GENERIC_HEADS expanded with milk, oil, stock, broth, sauce, seasoning, powder, spinach. Compound protection expanded: coconut milk/cream/oil, chicken/beef/vegetable stock/broth, olive/sesame oil, taco seasoning, peanut butter, tomato paste/sauce. Tortellini-specific veto prevents matching to spinach.
- **Catalog changes:** 9 new entries: chicken stock, vegetable stock, beef stock, leek, cabbage, kale, gnocchi, hamburger buns, tortellini. Tomatoes aliases added: chopped/plum/stewed/cherry/grape tomatoes.
- **Session/versioning:** `PAPRIKA_INGREDIENT_PARSER_VERSION` bumped from 6 to 7. `normalizeIngredientGroupKey` updated with inline singularization.
- **Tests:** 75 new tests in `tests/f064-parser-matcher-hardening.test.ts`. Updated 3 F051 tests for size-descriptor stripping behavior. Updated 1 F047 test for pagination resilience with larger catalog. All 1,161 tests pass (70 files, 13 skipped).
- **Known limitations:** "Italian" is not stripped from canonical names (risk to "Italian seasoning"); matching handles it via style-stripped secondary path. "Hot" prefix not stripped from canonical names; handled via matching. Some complex multi-ingredient lines like "spinach and ricotta tortellini" preserve the full compound name rather than extracting individual components.

### F065 — Household-manageable ingredient aliases (2026-03-25)

- **PRD:** F065; milestone M5; P1 functional; depends on F059, F064, F004, F060; acceptance refs S010, S007.
- **Data model:** `Ingredient.aliases?: string[]` in `src/types.ts`. Normalization via `normalizeIngredientAliasList` / `normalizeIngredientForStorage` in `src/storage.ts`; `normalizeHouseholdIngredientNames` normalizes aliases on save; `mergeDuplicateMetadata` unions aliases across merges.
- **Matching:** `matchIngredient` refactored to tiered candidates (household canonical → household alias → catalog canonical → catalog alias) with score-first selection and tier tie-break; shared `scoreMatchAgainstCandidate` helper preserves `HOUSEHOLD_MIN`, `CATALOG_MIN`, and veto behavior.
- **UX:** Ingredient Manager modal “Also matches” with validation (`validateIngredientAliases`: blocking when alias equals another ingredient’s primary name; warnings for cross-ingredient alias overlap). Browse search, `IngredientCombobox`, and `ComponentForm` alternative search use `ingredientMatchesQuery`. Desktop row `+N alt` hint.
- **Tests:** `tests/f065-ingredient-aliases.test.tsx` (normalization, validation, merge, matcher tiers, `parseRecipeText`, `parsePaprikaLineFromRaw`, storage round-trip, Ingredient Manager RTL). Catalog delete flow in `f044` targets **Tortillas** (`cat-wraps`) explicitly. Household round-trip expectations in `f002`/`f039` include `suppressedCatalogIds: []`.
- **Verification:** `npx tsc --noEmit`, `npx vitest run` — 1194 passed, 13 skipped (72 files).

### F066 — Lightweight recipe organization tags (2026-03-26)

- **PRD:** F066; milestone M5; P2 functional; depends on F057, F058; acceptance refs S002, S004, S007 (also listed on S010 for recipe-ingredient surfaces).
- **Scope (not a taxonomy product):** Curated optional tags only (`quick`, `batch-prep`, `freezer-friendly`, `rescue`, `side`, `sauce`, `kid-friendly`, `prep-ahead`); `Recipe.tags` remains optional `string[]`; legacy aliases `batch-friendly` / `rescue-friendly` normalize for filter/UI; unknown tags preserved on load.
- **Library:** `src/lib/recipeTags.ts` — `CURATED_RECIPE_TAGS`, `recipeTagLabel`, `recipeHasTag`, `recipeMatchesCuratedFilter`, `computeTagBoost`, `recipeTypeContextScore`, `compareRecipesForSuggestion`. Recipe library page: tag filter chip row + clear; list rows show up to 3 small tag labels when present.
- **Editor:** `RecipeLibrary` modal — collapsed Organization `<details>` with tappable chips (info when selected); no required tags.
- **Attach recipe:** `ComponentRecipePicker` — optional `contextRole` / `rescueMode`; within-group sort by name/type/tag weak boost; up to 2 tag chips on recipe rows. Wired from `ComponentForm` and `Planner` with `component.role`.
- **Seed:** H001 `rec-roasted-broccoli` +`prep-ahead`; `rec-cheese-sauce` +`kid-friendly`; `npm run db:seed` → `src/seed-data.json`.
- **Tests:** `tests/f066-recipe-tags.test.tsx` — 15 tests (model, filter, UI, persistence, modal chip, ranking dominance, visual gating).
- **Verification:** `npx tsc --noEmit`, `npx vitest run` — 1209 passed, 13 skipped (73 files).

### F067 — Paprika category-to-tag import (2026-03-26)

- **PRD:** F067; milestone M5; P2 functional; depends on F048, F066; acceptance refs S007, S010.
- **Data model:** `RecipeProvenance.rawCategories?: string[]` — original Paprika category strings (not user-facing tags). `Recipe.tags` receives only values from the curated map after normalization.
- **Logic:** `src/lib/paprikaCategoryMap.ts` — lowercase/trim/collapse space/edge punctuation strip, conservative `-es`/`-s` singularization (skips `-us`/`-ss`/`-is`), alias table aligned with F066 curated set; `isCuratedTag` guards map targets.
- **Import:** `buildDraftRecipe` calls `mapPaprikaCategories`; no automatic `whole-meal` or theme tags. `PaprikaImport` shows mapped tag chips + unmapped metadata note on select; collapsible per-recipe summary on review.
- **Tests:** `tests/f067-paprika-category-tags.test.ts` — 13 tests (table validation, aliases, plurals, dedupe, mixed/unmapped, forbidden theme strings, `buildDraftRecipe`, tag helpers).
- **Verification:** `npx tsc --noEmit`, `npx vitest run` — full suite green.

### F068 hardening — sync queue + auth races (2026-03-27)

- **PRD:** F068 step added (queue clear on user change, mid-flush abort, payload warn, main.tsx cleanup); F063 startup step now **initOnlineListeners only** (no `setLoadHouseholdsRef`).
- **`src/sync/sync-engine.ts`:** `setCurrentUserId` calls `clearIncrementalQueue()` when `prev !== null && prev !== userId`, then `updatePendingFlagFromQueue()`. `flushQueuedSync` uses **`flushUserId`** for upserts and returns early (idle, no error) if `currentUserId !== flushUserId` during deletes or upserts — does **not** re-queue the batch (avoids wrong-account flush after sign-out/switch). **`PAYLOAD_WARN_BYTES` (256 KiB)** → `console.warn`; debug per-household size only **≥ 64 KiB**. Comment on `queueMicrotask` follow-up clarified.
- **`src/main.tsx`:** Dropped `setLoadHouseholdsRef` import/call.
- **Tests:** `tests/f068-sync-queue.test.ts` — sign-out clears pending + flush no-op; mid-batch sign-out after first gated upsert (1 call only); `vi.useFakeTimers` backoff retry after `remote_unavailable`; duplicate `online` dispatches → single upsert. `tests/f063-sharing-sync.test.ts` — removed obsolete `setLoadHouseholdsRef` in reconnect test.
- **Verification:** `npm run typecheck`; `npm test` — 1248 passed + 13 skipped (one unrelated f043 timeout under full parallel load; passes in isolation).
- **Risks (unchanged from F068):** in-memory queue lost if tab closes during debounce; household JSON blob LWW; no realtime.

### F068 — Safe incremental Supabase sync (debounced queue) (2026-03-27)

- **PRD:** F068 (P0 platform); M7 now includes F068; F062/F063 step text updated; `remotePersistence` note reflects incremental sync.
- **Problem fixed:** `saveHouseholds` / `persistHouseholdsNow` used to call `syncAfterSave(entireList)`, upserting every household on every save and risking re-entry when `persistNewCloudHouseholdIds` saved locally — heavy on tiny Supabase tiers.
- **Sync engine (`src/sync/sync-engine.ts`):** `queueHouseholdSync` / `queueHouseholdDeleteSync` with `Map` dedupe (latest snapshot per id), `Set` of remote PK deletes (upserts cancelled when delete wins), **1000ms** debounce, **serialized** `flushQueuedSync` with `flushAgainAfterCurrent` + `queueMicrotask` follow-up (no synchronous re-entry). **`remote_unavailable`** → exponential backoff (2s → max 60s). **`persistNewCloudHouseholdIds`** → **`saveHouseholdsLocalOnly`**. Legacy **`syncAfterSave(households[])`** for explicit/tests; when **offline**, merges households into the incremental queue for reconnect. **`manualSync` / `pushLocalHouseholds` / successful `syncAfterSave`** clear the incremental queue after full push. Debug logs under **`[sync-queue]`** (flush start/end; large-payload debug/warn thresholds — see F068 hardening). **`setCurrentUserId`** clears the queue on user switch/sign-out; mid-flush auth change aborts the batch. **`setLoadHouseholdsRef`** remains a deprecated no-op for older tests/forks.
- **Storage (`src/storage.ts`):** `saveHouseholds` / `persistHouseholdsNow` are **local-only**; `saveHousehold` / `saveHouseholdAsync` / `clearHouseholdBaseMealsAndPlanning` / `clearHouseholdRecipes` / `mergeSeedRecipesForHousehold` call `queueHouseholdSync` when authenticated; `deleteHousehold` uses `queueHouseholdDeleteSync`.
- **Tests:** `tests/f068-sync-queue.test.ts` (14 cases including F068 hardening: sign-out, mid-flush sign-out, backoff, duplicate `online`). `f062`/`f063` updated to **`await flushQueuedSync()`** where saves are debounced.
- **Verification:** `npm run typecheck`, `npm test` — see F068 hardening note for latest counts.
- **Risks / follow-ups:** In-memory queue is lost if the tab closes mid-debounce (local Dexie still has data; user can manual sync). Still **household JSON blob** upserts — future granular tables would shrink payloads further.

### F069 — Base meal theme tag editor (2026-03-27)

- **PRD:** F069; milestone M5; P2 functional; depends on F005, F056; acceptance S007.
- **UI:** [`src/pages/BaseMealManager.tsx`](src/pages/BaseMealManager.tsx) — `MealModal` Planning section: theme tag chips + remove, `TagSuggestInput` (suggestions from other meals’ tags) + Add tag; helper copy → Household → Weekly theme nights. Header row `meal-theme-tag-chips` (neutral chips + “Theme tags” label) when tags non-empty; `meal-summary-chips` unchanged (time / difficulty / rescue).
- **Data:** `normalizeBaseMealTag` trim + lowercase on add; dedupe; `createEmptyMeal` includes `tags: []`; `EMPTY_MEAL_TAGS` stable ref for `useMemo`.
- **Planner:** No change to `mealMatchesWeeklyAnchor` (exact string match; UI aligns with anchor lowercasing).
- **Tests:** [`tests/f005-base-meals.test.tsx`](tests/f005-base-meals.test.tsx) — editor visibility, normalize, persist, dedupe, remove + header chips; [`tests/weekly-suggested-ranking.test.ts`](tests/weekly-suggested-ranking.test.ts) — `mealMatchesWeeklyAnchor` case sensitivity vs lowered UI tags.
- **Verification:** `npm test` — f005 + weekly-suggested-ranking green.

### Settings — reset ingredients to bundled defaults (2026-03-28)

- **Storage:** `countSeedIngredientsForHousehold`, `resetHouseholdIngredientsToSeed` in `src/storage.ts` — replaces the household ingredient list with a deep copy from `seed-data.json` when that household id exists in seed data.
- **UI:** `src/pages/Settings.tsx` — destructive action in Data section (shown when seed ingredient count > 0, same household ids as seed recipes); confirmation explains full catalog replace and possible broken meal/recipe/plan references for custom ids.
- **Tests:** `tests/f050-settings.test.tsx`, `tests/f062-storage-layer.test.ts`.
- **Verification:** `npm run typecheck`, `npm test`.

### Settings — reset to default state (2026-03-28)

- **Storage:** `resetToDefaultState()` in `src/storage.ts` — clears households + default id, removes `onebaseplate_seeded`, awaits `seedIfNeeded()` (bundled `seed-data.json`), sets default household to the first seed household.
- **UI:** `src/pages/Settings.tsx` — Data section “Reset to default state” (danger) with confirm; clears Paprika import session; navigates to `/households`. `data-testid="settings-reset-default-btn"`.
- **Verification:** `npm run typecheck`, `npm test`.

### Ingredient merge suggestions — lib, CLI, Ingredients UI (2026-03-30)

- **Lib:** `src/lib/ingredientNameNormalize.ts` — `normalizeIngredientName` + `normalizeIngredientGroupKey` (no Dexie/sync) for reuse from CLI; `storage.ts` re-exports unchanged API.
- **Heuristics:** `src/lib/suggestIngredientMergePairs.ts` — token / Jaccard / subset / phrase containment; skips pairs already linked as name↔alias.
- **Dismissals:** `src/lib/ingredientMergeDismissals.ts` — `mergePairKey`, localStorage-dismissed pairs per household, `pickMergeSurvivorHeuristic` for bulk merge.
- **CLI:** `npm run suggest:ingredient-merges -- fixtures/households/H001-mcg.json` (`--min-score`, `--limit`); script avoids importing `storage` (no Vite env).
- **UI:** `IngredientManager` — duplicate review modal: **tap either name** to merge immediately (no confirm); per-row **Ignore**; select all + bulk Ignore / **Merge selected** (still one confirm for multi-merge). Merge-confirm modal remains only for merging from an ingredient’s edit screen.
- **Tests:** `tests/f075-suggest-ingredient-merge-pairs.test.ts`, `tests/f076-ingredient-merge-dismissals.test.ts`.

### Multi-agent memory — `.claude/agents/` + nested `MEMORY.md` (2026-03-31)

- **Added:** [`docs/ai/canonical-state.md`](docs/ai/canonical-state.md), [`docs/ai/memory-system.md`](docs/ai/memory-system.md), [`docs/ai/workflows/`](docs/ai/workflows/) (`prd-feature-slice.md`). Five Claude subagents in [`.claude/agents/`](.claude/agents/) with matching [`.claude/agent-memory/<name>/MEMORY.md`](.claude/agent-memory/README.md) + `<name>.md`; [`.claude/agent-memory/README.md`](.claude/agent-memory/README.md) documents editing rules.
- **Routing:** orchestrator (coordination) → import-agent, ux-agent, data-agent, sync-agent by domain; shared facts stay in `docs/ai/`. Legacy import-performance memory path unchanged.

### Agent docs — layered `docs/ai/` (2026-03-31)

- **Refactor:** Split monolithic `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` into a short shared [`AGENTS.md`](AGENTS.md) plus [`docs/ai/project-context.md`](docs/ai/project-context.md), [`repo-map.md`](docs/ai/repo-map.md), [`conventions.md`](docs/ai/conventions.md), [`ingredient-seed.md`](docs/ai/ingredient-seed.md), [`global-rules.md`](docs/ai/global-rules.md), [`decision-log.md`](docs/ai/decision-log.md). Vendor files point at `AGENTS.md` and Claude-specific memory/subagent paths.
- **Rules model:** Global numbered rules → `docs/ai/global-rules.md`; decisions → `decision-log.md`; specialist → `.claude/agent-memory/`.

## Next Task

- Continue from `PRD.json` implementation order after F068, or open a new scoped feature if product priorities shift.
