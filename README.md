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

## Top suggestions & overlap

On the **household home** screen, **Top suggestions** lists up to **three** meals from your base meal library. They are **ranked** by a combined score:

1. **Overlap** — For each meal, we count how many **human** household members can eat it **without an ingredient conflict** (they may still need small adaptations, e.g. sauce on the side). **Pets are not included** in this count. The card shows this as `score/total overlap` (for example, `4/4` means all counted members are conflict-free).

2. **Past outcomes** — If you’ve logged how meals went, each meal gets a score from that history: successes and partials help; failures count against it.

3. **Learned patterns** — After you’ve logged some outcomes, the app also nudges rankings based on which ingredients and meal patterns have tended to work or not work for your household.

**Pinned** meals appear in their own section; pinning does **not** change how the top-three list is ordered.

**Weekly Planner** and other screens may rank meals differently (for example, avoiding repeats already on the plan). The above applies specifically to **Top suggestions** on the home screen.

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
