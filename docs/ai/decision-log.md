# Decision log

Use this for **architectural or product decisions** that need a dated, human-readable record (not one-line global rules).

**Format (copy per entry):**

```markdown
### YYYY-MM-DD — Short title

- **Context:** …
- **Decision:** …
- **Consequences:** …
- **Links:** PR/issue/PRD if any
```

### 2026-03-31 — Paprika import scale: staples seed + tiered triage, no AI

- **Context:** Real-world Paprika imports (100+ recipes) produce 1000+ ingredient groups in review, with ~55% still pending after using current bulk actions. Root causes: volume amplification (every line across all selected recipes), first-import cold start (empty household has nothing to match against), conservative `CATALOG_MIN` threshold (0.86) leaving many valid ingredients unmatched, bulk actions too coarse ("Approve all" only clears already-matched lines; "Create all" floods the household with unvetted entries), and flat paginated review with no triage tiers. AI-assisted parsing was evaluated and deferred — the dominant failure modes are not parser comprehension failures but structural UX and catalog-coverage gaps.
- **Decision:** Reduce import review load through three deterministic levers, in priority order: (1) **smart auto-resolution pass** — before showing review, auto-resolve exact/strong household matches ("use"), exact/strong catalog matches ("add from catalog"), and a curated ~50-item common-staples list ("create" with appropriate category) — targeting 40–60% reduction in pending queue; (2) **tiered review UX** — replace flat paginated list with three progressive tiers: Tier 1 confirm suggestions (high-confidence, tap to accept), Tier 2 new ingredients to create (name + guessed category, bulk-create with preview), Tier 3 lines to check (low-confidence or ambiguous, explicit human decision); (3) **batch create with category preview** — "Create all unmatched" shows a preview list (name + inferred category, editable per-row or in bulk) before writing anything. Do **not** lower `CATALOG_MIN` globally, do **not** auto-resolve everything silently (draft gate rule stands), do **not** rebuild the core grouped-resolution/session/draft infrastructure. AI for parsing deferred indefinitely — revisit only if tiered triage still leaves >30% of groups pending on a typical 100-recipe import.
- **Consequences:** New F076 added to PRD. Depends on F049/F050. Staples list is owned by the ingredient ontology steward (aliases and catalog rows, not a parallel data structure). Any schema additions (e.g. `autoResolved: true` flag on `ImportMapping`) need migration-sync guardian sign-off. Page-size and virtual-scroll changes (quick win) are safe with no migration.
- **Links:** `PRD.json` F076, `docs/ai/canonical-state.md`, `.cursor/agents/paprika-import-qa.md` (known issues / priority fixes section)

### 2026-03-31 — Layered agent memory + Claude subagents

- **Context:** Need clear split between shared canonical docs, global rules, and per-specialist memory without one giant file.
- **Decision:** Shared facts in `docs/ai/canonical-state.md`; workflows in `docs/ai/workflows/`; specialist trees under `.claude/agent-memory/<agent>/` with short `MEMORY.md`; Claude definitions in `.claude/agents/` (orchestrator, import, ux, data, sync).
- **Consequences:** Cursor may keep a wider `.cursor/agents/` set; Claude uses the focused five for routing. Legacy `import-performance-scaling` memory remains until merged into `import-agent/`.
- **Links:** [`docs/ai/memory-system.md`](./memory-system.md), [`CHANGELOG.md`](../CHANGELOG.md)

