# PRD scope-shaping — reference

## Required response structure

Answer in this order (headings as written):

1. **Recommended direction** — One or two sentences: what to do and at what granularity.
2. **Why** — Tie to product goals, existing features, or risk reduction.
3. **PRD changes** — Concrete JSON-oriented edits: new or updated feature object(s), or state “none” if only process guidance.
4. **Implementation notes** — Files/areas likely touched, ordering, optional splits.
5. **Risks / watchouts** — Stale PRD, scope creep, sync/local edge cases, test burden.

## PRD feature object checklist

When adding or editing a feature in `PRD.json`, align with neighbors:

| Field | Notes |
|--------|--------|
| `id` | Next `F0xx` if new; otherwise target existing id. |
| `phase`, `priority`, `category` | Match existing enums/conventions in file. |
| `description` | One clear sentence; user-visible outcome when possible. |
| `steps` | Verifiable, ordered; include data model, UI, tests, verification where relevant. |
| `dependencies` | Other `F0xx` ids only. |
| `acceptanceRefs` | uiSpec screen ids (`Sxxx`) when UI is involved. |
| `passes` | Do not set `true` in the skill output unless user verified tests (normally leave for implementer). |

## Conflict flags

Call out explicitly when a suggestion would:

- Bloat settings or admin surfaces.
- Undermine shared base meal + per-member assembly.
- Duplicate preference or matching systems (e.g. parallel to `safeFoods` / `familyKeys`).
- Expand the data model without a migration story.

## When the transcript or context is missing

If the user references a chat UUID or transcript that is not available on disk, state that limitation and proceed from their pasted requirements or the current thread.
