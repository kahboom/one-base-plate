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
