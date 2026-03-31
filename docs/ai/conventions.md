# Working conventions

## Day-to-day

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

## Paprika test data (local only)

If you need real Paprika export files to exercise the importer/parser, use **`.tmp-paprika`** (not in git). Load or process those files only when necessary; delegate heavy exploration to a sub-agent if appropriate.
