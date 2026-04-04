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

### Base meal theme tags

On **Base Meals**, each meal’s edit modal includes optional **theme tags** under _Planning metadata_. Tags are stored lowercase and are used as a **soft tie-break** when a day has a **weekly theme anchor** whose _match tags_ overlap (configure anchors under **Household → Weekly theme nights**). They are separate from recipe library tags.

---

## Manual Commands

### Development

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm install`     | Install dependencies                     |
| `npm run dev`     | Start Vite dev server                    |
| `npm run build`   | TypeScript build + Vite production build |
| `npm run preview` | Preview production build                 |

### Code Quality

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run lint`         | Run ESLint to check for code issues            |
| `npm run format`       | Run Prettier to fix formatting issues          |
| `npm run format:check` | Run Prettier to check formatting (CI-friendly) |
| `npm run typecheck`    | TypeScript type check only (no emit)           |

### Testing

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `npm test`           | Run Vitest tests (single run) |
| `npm run test:watch` | Run Vitest in watch mode      |

### Data & Fixtures

| Command                                         | Description                                                   |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `npm run db:seed`                               | Regenerate `src/seed-data.json` from fixture households       |
| `npm run seed`                                  | Alias for `db:seed`                                           |
| `npm run generate:thumbs`                       | Generate meal thumbnail images for the library                |
| `npm run suggest:ingredient-merges`             | Suggest ingredient merge pairs from household data            |
| `npm run db:migrate-ingredients -- --in <file>` | Normalize + dedupe ingredient data in exported household JSON |

---

## Project Structure

- **`src/`** — React app (Vite + TypeScript)
- **`src/types.ts`** — TypeScript types matching PRD data model entities
- **`src/storage/`** — Local persistence (Dexie IndexedDB, migration, ports)
- **`src/auth/`** — Authentication service, context, and hook (Supabase Auth)
- **`src/sync/`** — Remote sync engine, remote repository, sync types
- **`src/supabase/`** — Supabase client singleton
- **`supabase/migrations/`** — SQL DDL reference for remote tables and RLS
- **`fixtures/households/`** — Household fixture files (H001, H002)
- **`fixtures/meals/`** — Meal fixtures (e.g. `pasta-base.json`)
- **`tests/`** — Vitest test suite with jsdom environment
- **`PRD.json`** — Product requirements and feature list
- **`agent-progress.md`** — Session progress log and next task
- **`init.sh`** — One-command setup and verification

---

## Requirements

- Node.js (v20+ recommended; v24 LTS is current default)
- npm

---

## Cloud Sync (Optional)

The app works fully locally by default. To enable cross-browser sync with user accounts:

1. Create a [Supabase](https://supabase.com) project.
2. Run the SQL migrations against your project (via the Supabase SQL editor or CLI):
   - `supabase/migrations/001_households.sql` — creates `households`, `household_memberships`, and `profiles` tables with RLS policies.
   - `supabase/migrations/002_invites.sql` — creates `household_invites` table for sharing and adds additional RLS policies for member/profile visibility.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Restart the dev server. The Settings page will now show an Account section where users can sign up, sign in, and sync data.

When the env vars are absent, the app runs in local-only mode with no Supabase dependency.

### Household Sharing

Once signed in, household owners can share access via invite links:

1. Go to Settings > Household sharing > Generate invite link.
2. Copy the link and share it with another person.
3. The recipient signs in (or creates an account) and visits the invite link (`/invite/{code}`).
4. They join the household as an editor and can view/edit shared data.

Owners can view members, revoke invites, and remove members from the Settings page. Editors can leave a household at any time.

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
