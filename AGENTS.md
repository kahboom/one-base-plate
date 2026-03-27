# Agent instructions — OneBasePlate

This file is for **automated coding agents** (Cursor, Claude Code, Codex, etc.). Humans: see **`README.md`** for setup and product behavior.

## Project summary

**OneBasePlate** — React + TypeScript SPA for household meal planning with member constraints (safe foods, hard nos, prep rules), recipes, planning, and grocery-style workflows. Runs **fully offline** by default; **Supabase** is optional for auth/sync.

## Tech stack

- React 19, Vite 6, TypeScript (strict, `noUnusedLocals`, `noUncheckedIndexedAccess`, etc.)
- Tailwind CSS 4 via Vite plugin
- Vitest + jsdom + Testing Library; `fake-indexeddb` where needed
- Dexie for IndexedDB; optional `@supabase/supabase-js`

## Import alias

Use **`@/`** for `src/` (e.g. `import { … } from "@/types"`).

## Essential commands

```bash
./init.sh              # npm install, typecheck, test, dev (full check)
npm run dev            # development
npm test               # CI-style test run
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # tsc -b && vite build
npm run db:seed        # refresh src/seed-data.json from fixtures
```

## Repository map

| Area | Role |
|------|------|
| `src/types.ts` | Domain types — keep in sync with PRD entities |
| `src/storage.ts`, `src/storage/` | Local DB, migrations, ports |
| `src/sync/` | Sync engine and remote adapter |
| `src/auth/` | Supabase auth context/hooks |
| `src/pages/` | Top-level routes / screens |
| `src/components/` | Reusable UI |
| `src/lib/`, `src/catalog.ts` | Business logic, parsing, sorting, tags |
| `tests/` | Vitest specs; many align to PRD feature IDs (`fNNN-…`) |
| `fixtures/` | Household and meal JSON fixtures |
| `PRD.json` | Structured requirements, feature pass/fail, uiSpec |
| `agent-progress.md` | Session handoff and completed work log |
| `supabase/migrations/` | SQL reference for remote schema + RLS |

## How to work safely

1. **Scope** — Change only what the task requires; match existing patterns (naming, file layout, hooks, storage APIs).
2. **Specs** — For PRD-driven features, read the feature block and any **uiSpec** screen definitions in `PRD.json` before editing UI.
3. **Tests** — Add or update tests in `tests/` for behavior changes; run `npm test` before finishing.
4. **PRD updates** — Flip `passes` to `true` only after verification; do not mark passing on speculation.
5. **Handoff** — Log significant completions in `agent-progress.md` so the next session knows what changed.

## Environment

- **Local-only:** No `.env` required.
- **Supabase:** `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example` and README).

## Related docs

- **`CLAUDE.md`** — Claude-oriented session checklist (overlaps with this file).
- **`README.md`** — User/developer documentation, cloud setup, ingredient migration CLI.
