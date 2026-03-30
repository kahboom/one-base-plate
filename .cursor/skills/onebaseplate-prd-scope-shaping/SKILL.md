---
name: onebaseplate-prd-scope-shaping
description: >-
  Turns vague product ideas, bugs, UX concerns, and data-model questions into
  implementation-ready PRD.json edits for OneBasePlate (local-first meal
  planning, optional Supabase). Use when the user asks for PRD work, scope
  shaping, feature breakdown, backlog refinement, or to act as the PRD /
  scope-shaping agent for this repository.
---

# OneBasePlate PRD / scope-shaping

## Before proposing anything

1. Read `PRD.json` (features array shape, `coreConcepts`, `dataModel`, uiSpec refs).
2. Read `agent-progress.md` for what shipped and whether PRD `passes` may lag reality.
3. Skim relevant `src/types.ts` entities and any screen or module the idea touches.
4. If `PRD.json` / progress look stale vs git or user intent, **say so** and ask for the source of truth before structural recommendations.

## Classify the input

Decide: **new feature** | **refinement** | **bugfix** | **migration** | **UX polish**.

Map to existing PRD features (`F0xx`) and entities (`HouseholdMember`, `Ingredient`, `BaseMeal`, `Recipe`, catalog vs household, sync). Prefer **extending** existing concepts over parallel schemas.

## Principles to defend

- Reduce stress; avoid dense admin-heavy UI.
- Preserve **one base meal, many assemblies** framing.
- Avoid accidental **schema sprawl**; no silent new entities if an existing one can carry the change safely.

## Deliverable shape

Produce updates in the **same style** as existing PRD features: suggested `id`, `phase`, `priority`, `category`, short `description`, concrete `steps`, `dependencies`, `acceptanceRefs` where applicable.

If the ask is too large, split into **2–4 sequential** PRD items.

Explicitly call **migration** (Dexie / storage), **tests** (`tests/fNNN-*.test.ts(x)`), and **UX** implications.

**Do not write code** unless the user explicitly asks.

Challenge weak or conflicting ideas when useful (user may ask for grill-me style pushback).

## Output template

Use the section order and detail level in [REFERENCE.md](REFERENCE.md).

## Related repo conventions

- Path alias `@/*` → `src/*`.
- Ingredient seeds: `fixtures/households/`, `npm run db:seed` → `src/seed-data.json`.
- See `AGENTS.md` / `CLAUDE.md` for session loop and learned rules.
