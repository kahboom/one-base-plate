# Skill: run-and-fix-tests

**Use when:** You need to drive the test suite to green autonomously — after a feature lands, after a refactor, or as a standalone fix session.

This skill is the reusable loop used by `test-agent`. Any Claude agent can invoke it.

---

## The loop

Repeat until green or a stopping condition is hit (max 5 iterations):

### Iteration step

**1. Run full suite (first pass) or targeted subset (subsequent passes):**

```sh
# First pass — always run everything
npm test 2>&1 | tail -100

# Subsequent passes — run only failing file(s) first
npm test -- --testPathPattern=<failing-file> 2>&1 | tail -60
```

**2. Run typecheck:**

```sh
npm run typecheck 2>&1 | tail -60
```

**3. Triage each failure:**

| Failure type | Action |
|---|---|
| Stale snapshot / fixture | Update the fixture or snapshot to match intentional change |
| Type mismatch from recent type edit | Fix the type at the call site, not with `@ts-ignore` |
| Production code broken | Find root cause, apply minimal fix |
| Test assertion hiding real bug | **Stop** — surface to user / specialist |
| Sync / Supabase domain | **Stop** — route to sync-agent |
| Schema / migration domain | **Stop** — route to data-agent |

**4. Apply fix, then confirm:**

```sh
npm test -- --testPathPattern=<fixed-file>
```

Confirm that specific test is green before moving to the next failure.

**5. After all targeted fixes, run full suite:**

```sh
npm test && npm run typecheck
```

If green: done. If new failures appeared: loop again (up to max iterations).

---

## Stopping conditions (do not loop forever)

Stop and report clearly when:

- The same test has failed 3 fix attempts in a row.
- A fix would require changing a test assertion that is testing real expected behavior.
- The failure is in sync, Supabase, or schema migration territory.
- A fix requires a product/design decision (e.g. changing a type's shape or removing a field).

Report format when stopping early:

```
## Test loop stopped

**Failing test:** <file:line>
**Error:** <exact error message>
**Why stopped:** <one sentence>
**Recommended next step:** Route to <specialist> / ask user about <decision>
```

---

## Fix discipline

- **No `@ts-ignore` or `@ts-expect-error`** — fix the underlying type.
- **No `.skip` or `.todo`** without explicitly flagging it as a known limitation.
- **Preserve `fNNN-*` test naming** — these are PRD-linked; do not rename.
- **Update fixtures, not assertions** — when production behavior changed intentionally.
- **Check the whole `fNNN` group** — if one test in a feature group fails, scan the sibling tests before declaring done.

---

## Key commands reference

```sh
npm test                                        # full suite
npm run typecheck                               # TypeScript only
npm test -- --testPathPattern=f050              # by feature id
npm test -- --testPathPattern=f050 --watch      # watch mode
npm test -- --testNamePattern="<test name>"     # by test name substring
./init.sh                                       # full cold check (seed + test + lint)
```
