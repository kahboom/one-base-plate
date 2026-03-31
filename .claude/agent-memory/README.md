# `.claude/agent-memory/`

Per-agent folders for **specialist** knowledge. Shared truths live in [`docs/ai/`](../../docs/ai/) — see [`docs/ai/memory-system.md`](../../docs/ai/memory-system.md).

## Layout (per agent)

| File | Purpose |
| ---- | ------- |
| **`MEMORY.md`** | **Short** curated summary: current focus, last verified facts, 3–7 bullets max when possible. This is what should feel “injected” — keep it tight. |
| **`<agent-name>.md`** (or `findings.md`) | Deeper notes: file pointers, edge cases, links to tests, optional checklists. |
| **`patterns.md`**, **`checklists.md`** | Optional; only if they help humans maintain the agent without duplicating `docs/ai/`. |

## What belongs in `MEMORY.md`

- Active priorities and **verified** constraints for this domain.
- “Read this file first” pointers inside the repo (paths, not pasted code).
- One-line reminders of boundaries (“does not own sync”).

## What belongs in supporting files

- Performance profiles, benchmark notes, long file lists.
- Step-by-step debugging recipes.
- Copy-paste command logs (prefer summarizing).

## What must **not** go in [`docs/ai/global-rules.md`](../../docs/ai/global-rules.md)

- Anything only **one** specialist needs → keep it here.
- Long narratives → supporting file or `decision-log.md` if it’s a project decision.
- Raw stack dumps → [`docs/ai/canonical-state.md`](../../docs/ai/canonical-state.md) if it’s truly shared.

## Keeping memory concise

- Update `MEMORY.md` when something is **confirmed**, not speculative.
- Move stale bullets to supporting files or delete.
- Prefer links to `docs/ai/` and `PRD.json` over repeating them.
