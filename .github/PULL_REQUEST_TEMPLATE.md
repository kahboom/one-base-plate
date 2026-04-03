## Summary

<!-- What does this PR do? One or two sentences. -->

## Migration checklist

Work through each item. Check the box if it applies and you've handled it, or mark N/A.

### Data / storage

- [ ] **Paprika parser changed** → bumped `PAPRIKA_INGREDIENT_PARSER_VERSION` in `src/paprika-parser.ts`
- [ ] **Dexie schema changed** → added a `.version(N).upgrade(tx => ...)` handler in `src/storage/dexie-db.ts` (never add a version without one)
- [ ] **Supabase schema changed** → added a sequentially numbered SQL file in `supabase/migrations/` (e.g. `005_...sql`); no `DROP COLUMN` or renames — only additive changes
- [ ] **Household type changed** (new required field, removed field, renamed key) → updated `repairHouseholds()` in `src/storage/household-repair.ts` with a safe default

### Verification

- [ ] `npm run typecheck` passes locally
- [ ] `npm test` passes locally
- [ ] Tested against a real household (or fixture) with the change applied

### Agents / docs

- [ ] Updated `agent-progress.md` if this is a meaningful feature slice
- [ ] Updated `PRD.json` passes if a PRD feature is complete
