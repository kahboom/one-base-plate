# PRD Changelog

This file records product-spec changes made to `PRD.json`.

## Entry template

### YYYY-MM-DD — Short summary
- Requestor:
- Reason:
- Scope:
- Files changed:
- Sections changed:
- New feature IDs:
- Reopened feature IDs:
- Removed/deprecated feature IDs:
- Dependency changes:
- Milestone changes:
- UI spec changes:
- Data model changes:
- Notes:

## Rules
- Log every material PRD change before or alongside implementation.
- Do not treat code changes as PRD changes unless the spec itself changed.
- If the UI changes, note both the feature IDs and the affected `uiSpec.screens`.
- If the data model changes, list the affected entities and any migration implications.
- If a completed feature is reopened, say why.

## Examples

### 2026-03-12 — Added visual weekly planner and meal cards
- Requestor: product owner
- Reason: weekly planning needed a visual, interactive flow instead of a list
- Scope: planning UI, feature sequencing, acceptance criteria
- Files changed: PRD.json, PRD-changelog.md
- Sections changed: features, implementationOrder, milestones, uiSpec, screenToFeatureMap
- New feature IDs: F021, F022, F023
- Reopened feature IDs: none
- Removed/deprecated feature IDs: none
- Dependency changes: F022 depends on F021
- Milestone changes: M3 expanded to include weekly visual planner
- UI spec changes: weeklyPlanner, mealCards
- Data model changes: none
- Notes: drag-and-drop kept optional for mobile fallback, but required on desktop
