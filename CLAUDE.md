# OneBasePlate — guidance for Claude

Household meal-planning app: **one base meal, multiple assemblies**, merged grocery lists, and conflict-aware suggestions for picky eaters, texture needs, and preparation constraints. See `README.md` for product context and user-facing docs.

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
