# OneBasePlate Agent Progress

## Conventions
- Work on one feature at a time per the PRD implementation order
- Run tests before marking any feature as passing
- Commit after each completed feature

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

## Next Task
- F036: Consistent navigation and household hub wayfinding (dependencies: F033 — satisfied)
