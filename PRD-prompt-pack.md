# PRD Prompt Pack

Use these prompts deliberately. Keep PRD editing separate from implementation.

---

## 1) PRD editor — targeted change

You are editing `PRD.json`, which is the single source of truth for implementation.

Rules:
- Preserve valid JSON.
- Do not renumber existing feature IDs.
- Keep dependencies, milestones, implementationOrder, screenToFeatureMap, and acceptanceRefs consistent.
- If a change affects UI behavior, update both the relevant feature entries and the embedded `uiSpec`.
- If a change affects data structure, update `dataModel` and any affected feature steps.
- Preserve existing `passes` fields unless the changed requirement should explicitly reopen a feature.
- After editing, output:
  1. a summary of changes
  2. the exact sections changed
  3. any new feature IDs added
  4. any features that should be reset to `passes=false`

Change request:
- Goal:
- Why:
- Scope:
- Affected sections:
- New feature or amend existing:
- Reopen any completed features:
- Should `uiSpec` change:
- Should `implementationOrder` change:

---

## 2) Implementation agent — build from spec

Read `PRD.json` and treat it as the only source of truth.

Implementation rules:
- Work strictly in sequential order using `implementationOrder`.
- Only implement the next feature with `passes=false` whose dependencies are satisfied.
- Use `uiSpec`, `screenToFeatureMap`, and `acceptanceRefs` when building or verifying UI.
- Do not invent new requirements.
- Do not modify `PRD.json` unless explicitly instructed to act as a PRD editor.
- Leave the codebase in a clean, mergeable state after each feature.
- Run verification before changing `passes` to true.
- Log progress clearly.

Begin by:
1. reading `PRD.json`
2. identifying the next available feature
3. summarizing what will be implemented
4. implementing only that feature

---

## 3) Add a new feature cleanly

You are editing `PRD.json`.

Task:
Add a new feature without breaking sequence integrity.

Requirements:
- Create a new feature ID using the next available number.
- Place the new feature in the correct phase and milestone.
- Update `dependencies`, `implementationOrder`, `milestones`, `screenToFeatureMap`, and any `acceptanceRefs`.
- If the feature creates or changes a screen, update `uiSpec.screens`.
- If the feature needs new data fields, update `dataModel.entities`.
- Do not silently alter unrelated features.

Return:
- the new feature object
- every other section that changed
- a short explanation of why the feature was inserted where it was

Feature request:
[describe the new feature]

---

## 4) Reopen or extend an existing completed feature

You are editing `PRD.json`.

Goal:
Decide whether this request should:
- reopen an existing feature by setting `passes=false`, or
- create a new follow-on feature

Rules:
- Reopen a feature only if the underlying requirement changed materially.
- Add a new feature if this is an extension of the existing requirement.
- Explain the choice briefly.
- Update all connected sections consistently.

Change request:
[describe the change]

---

## 5) UI sync audit

You are auditing `PRD.json` for consistency between the feature list and the embedded `uiSpec`.

Check:
- every UI-facing feature has relevant `acceptanceRefs`
- every screen in `uiSpec.screens` is referenced by at least one feature
- `screenToFeatureMap` matches the feature list
- implementation order still makes sense for the UI dependencies
- no UI requirement exists only in `uiSpec` without corresponding feature coverage

Output:
- mismatches
- missing links
- suggested repairs
- whether any features should be added or reopened

---

## 6) Data model sync audit

You are auditing `PRD.json` for consistency between `dataModel` and feature requirements.

Check:
- every feature that depends on structured data has matching entity fields
- no field is present in the data model without clear feature usage
- migration implications are noted when fields are added or changed
- references in `uiSpec` are still possible with the current data model

Output:
- mismatches
- missing fields
- redundant fields
- suggested repairs

---

## 7) PRD reuse template bootstrap

You are creating a new `PRD.json` from `PRD-template.json`.

Task:
Replace placeholders with concrete values for the new product.

Rules:
- Keep the overall structure intact.
- Remove unused placeholder examples once replaced.
- Add at least one persona, one milestone, three features, one screen spec, and one fixture.
- Make sure `implementationOrder` references only real feature IDs.
- Keep `agentExecutionRules` intact unless there is a strong reason to change them.

Provide:
- the completed `PRD.json`
- a short note on any sections that still need manual input

---

## 8) Product migration prompt

You are updating `PRD.json` for a product direction change.

Task:
Integrate the new direction without destroying implementation history.

Rules:
- Prefer deprecating old features over deleting them if work may already exist.
- Keep completed IDs stable.
- Add a `deprecated: true` flag to retired features if needed.
- Add new features for the replacement flow.
- Update milestones and implementation order so the agent does not work on obsolete paths next.

Migration request:
[describe the new direction]

Return:
- changed sections
- deprecated features
- new features
- any recommended manual cleanup in code
