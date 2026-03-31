# Workflow: PRD feature slice

1. Find the feature in `PRD.json` (id, `passes`, dependencies, uiSpec refs).
2. Read referenced **uiSpec** screens before changing UI.
3. Implement **only** that scope (+ strictly necessary enabling changes).
4. Run `npm test` and `npm run typecheck` (and `npm run lint` if style touched).
5. Flip `passes` in `PRD.json` **only** after behavior is verified.
6. Note the slice in `agent-progress.md`; use a clear commit message.

Cold context: prefer `./init.sh` or at least typecheck + tests first. See [`conventions.md`](../conventions.md) for the full session loop.
