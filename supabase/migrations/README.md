# Supabase Migrations

## Current schema version

There are currently 4 migration files (`001` through `004`). The next migration must be `005_`.

## Rules — read before writing a migration

### 1. Sequential numbering, always

Files must be named `NNN_description.sql` in ascending order with no gaps.
The next file should be `005_your_description.sql`.

### 2. Additive only — never destructive

- **OK:** `ALTER TABLE foo ADD COLUMN bar TEXT DEFAULT ''`
- **OK:** New tables, new indexes, new RLS policies
- **NOT OK:** `DROP COLUMN`, `ALTER TABLE foo RENAME COLUMN`, `DROP TABLE`
- **NOT OK:** Changing a column type in a way that loses data

If you need to rename a column: add the new column, backfill, migrate app code, then (much later, in a separate PR) drop the old one.

### 3. Idempotent where possible

Prefer `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so re-running is safe.

### 4. Apply with the Supabase CLI

```bash
# Push all pending migrations to the remote project
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

Or paste the SQL directly in the Supabase dashboard → SQL Editor for one-off migrations if you don't have the CLI set up. Either way, migrations are applied in numeric order.

### 5. Coordinate with `household-repair.ts`

The `households.data` column stores the entire `Household` JSON blob. If your SQL migration implies the app code will now write new fields to that blob, also update `src/storage/household-repair.ts` to handle rows written _before_ the app change (old blobs will lack those fields).

The PR template will remind you.

## Applied migrations

| File | Description |
|------|-------------|
| `001_households.sql` | Initial `households` + `household_memberships` tables |
| `002_invites.sql` | Household invite codes |
| `003_fix_household_memberships_rls_recursion.sql` | RLS recursion fix for memberships |
| `004_households_owner_select_update_rls.sql` | Owner-scoped select/update policies |
