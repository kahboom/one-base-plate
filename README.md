# OneBasePlate

Reduce grocery stress, separate cooking events, takeaway reliance, and food waste in households with overlapping but conflicting food preferences—including ARFID-style preparation constraints, picky children, and babies requiring texture-adapted food.

**North star:** One base meal, multiple household-specific assemblies, with a merged grocery list and low-decision rescue mode.

---

## Quick Start

```bash
./init.sh
```

This script will:
1. Install dependencies (`npm install`)
2. Run type check (`npx tsc --noEmit`)
3. Run tests (`npm test`)
4. Start the dev server (`npm run dev`)

---

## Manual Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript build + Vite production build |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest tests (single run) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run typecheck` | TypeScript type check only |
| `npm run lint` | Run ESLint |
| `npm run db:seed` | Regenerate `src/seed-data.json` from fixture households |
| `npm run db:migrate-ingredients -- --in <file>` | Normalize + dedupe ingredient data in exported household JSON |

---

## Project Structure

- **`src/`** — React app (Vite + TypeScript)
- **`src/types.ts`** — TypeScript types matching PRD data model entities
- **`fixtures/households/`** — Household fixture files (H001, H002, H003)
- **`fixtures/meals/`** — Meal fixtures (e.g. `pasta-base.json`)
- **`tests/`** — Vitest test suite with jsdom environment
- **`PRD.json`** — Product requirements and feature list
- **`agent-progress.md`** — Session progress log and next task
- **`init.sh`** — One-command setup and verification

---

## Progress (F001 Complete)

### F001: Repository scaffold — COMPLETE

- [x] Vite + React + TypeScript project scaffold
- [x] TypeScript types in `src/types.ts` matching all PRD data model entities
- [x] 3 household fixtures (H001, H002, H003) covering all persona types
- [x] 1 meal fixture (`pasta-base.json`)
- [x] Vitest with jsdom environment and test setup
- [x] Scaffold test suite (7 tests, all passing)
- [x] `init.sh` runs: install → typecheck → test → dev server
- [x] Verified: `tsc --noEmit`, vitest, and `vite build` all succeed

### Next: F002

**User can create a household with multiple members and role types**

---

## Requirements

- Node.js (recommended: v18+)
- npm

---

## Ingredient Migration (Legacy Data)

To apply the lowercase naming standard and duplicate cleanup to existing ingredient records, run the migration against an exported household JSON file.

### Recommended flow

1. Export household data from the app as JSON.
2. Run migration:

```bash
npm run db:migrate-ingredients -- --in ./households-export.json
```

3. Import the generated file (`./households-export.migrated.json`) back into the app.

### Optional flags

- `--out <file>`: write to a custom output path.
- `--write`: overwrite the input file in place.

Example:

```bash
npm run db:migrate-ingredients -- --in ./households-export.json --write
```
