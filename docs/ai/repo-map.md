# Repo map — stack, commands, locations

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
- **`CHANGELOG.md`** — Longer-running product/technical history

**Ingredient fixtures:** See [ingredient-seed.md](./ingredient-seed.md).
