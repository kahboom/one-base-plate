# Skill: flip-prd-passes

**Use when:** A feature implementation is complete and needs `"passes": true` set in `PRD.json`, followed by an `agent-progress.md` entry.

---

## Steps

### 1 — Identify the feature

Confirm the feature ID (e.g. `F076`) from the user or from the current session context.

### 2 — Verify before flipping

Run the full verification suite:

```sh
npm test -- --testPathPattern=<fNNN>   # feature-specific tests
npm run typecheck                       # no type regressions
```

If tests fail, **stop here** and fix them before flipping `passes`. Do not flip a feature as passing when the suite is red.

Also confirm:
- The uiSpec referenced in `PRD.json` for this feature (if any) matches what was implemented.
- No critical `TODO` or `FIXME` comments were left in touched files relating to this feature.

### 3 — Flip `passes` in PRD.json

In `PRD.json`, find the feature object with `"id": "F0NN"` and set:

```json
"passes": true
```

Do not change any other fields in the feature object.

### 4 — Append to agent-progress.md

Add a brief entry at the bottom of `agent-progress.md`:

```
## YYYY-MM-DD — F0NN: <Feature title>

- Passes flipped: `passes: true` in PRD.json.
- Tests: `npm test` green, `npm run typecheck` clean.
- Brief summary of what was implemented (1–3 bullets max).
```

### 5 — Commit

Stage `PRD.json` and `agent-progress.md` (and any other files from the feature), then commit:

```sh
git add PRD.json agent-progress.md
git commit -m "F0NN: mark passes, update progress log"
```

---

## Checklist

- [ ] Feature-specific tests pass
- [ ] `npm run typecheck` clean
- [ ] uiSpec alignment confirmed (if applicable)
- [ ] `PRD.json` `passes` flipped to `true`
- [ ] `agent-progress.md` entry appended
- [ ] Committed
