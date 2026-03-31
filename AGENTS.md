# OneBasePlate

# Agent Instructions

Read this entire file before starting any task.

## Self-Correcting Rules Engine

This file contains a growing ruleset that improves over time. **At session start, read the entire "Learned Rules" section before doing anything.**

### How it works

1. When the user corrects you or you make a mistake, **immediately append a new rule** to the "Learned Rules" section at the bottom of this file.
2. Rules are numbered sequentially and written as clear, imperative instructions.
3. Format: `N. [CATEGORY] Never/Always do X — because Y.`
4. Categories: `[STYLE]`, `[CODE]`, `[ARCH]`, `[TOOL]`, `[PROCESS]`, `[DATA]`, `[UX]`, `[OTHER]`
5. Before starting any task, scan all rules below for relevant constraints.
6. If two rules conflict, the higher-numbered (newer) rule wins.
7. Never delete rules. If a rule becomes obsolete, append a new rule that supersedes it.

### When to add a rule

- User explicitly corrects your output ("no, do it this way")
- User rejects a file, approach, or pattern
- You hit a bug caused by a wrong assumption about this codebase
- User states a preference ("always use X", "never do Y")

### Rule format example

```
14. [CODE] Always use `bun` instead of `npm` — user preference, bun is installed globally.
15. [STYLE] Never add emojis to commit messages — project convention.
16. [ARCH] API routes live in `src/server/routes/`, not `src/api/` — existing codebase pattern.
```

---

## About the OneBasePlate

Household meal-planning app: **one base meal, multiple assemblies**, merged grocery lists, and conflict-aware suggestions for picky eaters, texture needs, and preparation constraints. See `README.md` for product context and user-facing docs.

This app exists to make family meal planning feel manageable when people in the same household eat differently. The goal is not to build a generic recipe app, but to help a real household cook one shared dinner that can be assembled in different ways for different people.

The core idea is simple: one base meal, multiple assemblies. That means supporting households where one person has strong preparation preferences, a child needs familiar safe foods, and a baby may need texture-adapted food, without turning dinner into multiple separate cooking events.

The broader aim is to reduce stress, decision fatigue, food waste, and takeaway reliance. When working in this codebase, prefer changes that make the app more practical, lower-friction, and more useful on an ordinary tired weeknight.

## Stack

- **UI:** React 19, TypeScript (strict), Vite 6, Tailwind CSS 4 (`@tailwindcss/vite`)
- **Client data:** Dexie (IndexedDB), optional Supabase Auth + sync (`src/sync/`, `src/supabase/`)
- **Tests:** Vitest 3, jsdom, Testing Library (`tests/setup.ts`)
- **Path alias:** `@/*` → `src/*` (see `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`)

## Commands

| Command                           | Use                                                         |
| --------------------------------- | ----------------------------------------------------------- |
| `./init.sh`                       | Install, typecheck, test, start dev (full local verify)     |
| `npm run dev`                     | Vite dev server                                             |
| `npm run build`                   | `tsc -b` + production build                                 |
| `npm test`                        | Vitest single run                                           |
| `npm run test:watch`              | Vitest watch                                                |
| `npm run typecheck`               | `tsc --noEmit`                                              |
| `npm run lint`                    | ESLint                                                      |
| `npm run format` / `format:check` | Prettier                                                    |
| `npm run db:seed`                 | Regenerate `src/seed-data.json` from `fixtures/households/` |

Optional cloud: copy `.env.example` → `.env` with `VITE_SUPABASE_*` (see README). Without env vars the app is local-only.

## Where things live

- **`src/types.ts`** — Core domain types aligned with the PRD model
- **`src/storage.ts`** / **`src/storage/`** — Local persistence and migrations
- **`src/pages/`** — Route-level screens
- **`src/components/`** — Shared UI
- **`src/catalog.ts`**, **`src/lib/`** — Domain helpers (recipes, tags, sorting, etc.)
- **`fixtures/households/`**, **`fixtures/meals/`** — Deterministic test/fixture data
- **`tests/`** — Feature tests (naming like `fNNN-*.test.ts(x)`)
- **`PRD.json`** — Requirements, feature flags (`passes`), uiSpec references, agent workflow notes under `anthropicLongRunningAgentAlignment`
- **`agent-progress.md`** — Human/agent session log and completed features

### Ingredient seed data (household fixtures)

- **Where:** Each household is **`fixtures/households/<id>.json`**. The top-level **`ingredients`** array is that household’s seed ingredient library (loaded on first run via **`seedIfNeeded()`** in **`src/storage.ts`**).
- **Bundled output:** **`npm run db:seed`** (**`scripts/db-seed.ts`**) merges every JSON file in **`fixtures/households/`** into **`src/seed-data.json`**. Edit fixtures first, regenerate, then commit **both** the fixture(s) and **`src/seed-data.json`**.
- **Schema:** **`Ingredient`** in **`src/types.ts`** — required: `id`, `name`, `category` (`protein` \| `carb` \| `veg` \| `fruit` \| `dairy` \| `snack` \| `freezer` \| `pantry`), `tags`, `shelfLifeHint`, `freezerFriendly`, `babySafeWithAdaptation`. Optional: `aliases`, **`familyKeys`** (planner grouping / F075), `imageUrl`, `catalogId`, `source`, `defaultRecipeRefs`.
- **Stable ids:** Recipes and base meals use **`ingredientId`** pointing at these rows. Do not reuse an `id` for a different food; add new ids for new ingredients. Removing or renaming ids breaks fixture recipes unless every reference is updated.
- **McG (H001):** **`fixtures/households/H001-mcg.json`** holds the large demo list — keep **`name`** unique per household and rows sorted **alphabetically by `name`** for maintainability.
- **Catalog vs household:** Import/browse matching uses **`MASTER_CATALOG`** in **`src/catalog.ts`** — separate from household seed ingredients. Fixture changes do not update the master catalog unless **`catalog.ts`** is edited too.

For workflows and checklists, see **`skills/onebaseplate-ingredient-seed/SKILL.md`**.

## Working conventions

1. **One feature at a time** — Prefer a small, mergeable change set; avoid unrelated refactors.
2. **PRD-first** — For scoped work, find the feature in `PRD.json`, read any referenced **uiSpec** screens before changing UI, and update only the relevant `passes` (and tests) when truly done.
3. **Verify** — Run `npm test` and `npm run typecheck` (and `npm run lint` when touching code style) before calling work complete. Use `./init.sh` when you need a full sanity check.
4. **Progress** — Append a short note to `agent-progress.md` when finishing a meaningful slice; keep commits descriptive.

## Session loop (from PRD)

Aligned with `PRD.json` → `anthropicLongRunningAgentAlignment.sessionLoop`:

1. Run `./init.sh` or at least typecheck + tests when picking up cold context.
2. Read `agent-progress.md` and recent git history.
3. Choose the next PRD feature (or the task the user gave you); read uiSpec for that feature if applicable.
4. Implement only that scope (+ strictly necessary enabling changes).
5. Run targeted tests; update PRD `passes` only when verified.
6. Commit with a clear message.

When the user overrides this loop (e.g. hotfix only), follow their instructions.

---

## Learned Rules

<!-- New rules are appended below this line. Do not edit above this section. -->

1. [ARCH] Agent-specific memory belongs in `.claude/agent-memory/<agent-name>.md`, not in this file — keeps Learned Rules short and avoids loading irrelevant specialist context into every agent’s context window. When a specialist agent (e.g. import-performance-scaling) produces durable findings, write them to its own memory file and add a “Read <path> at session start” instruction in the agent’s body.
