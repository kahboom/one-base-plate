# Plan: Catalog ontology splits (MASTER_CATALOG)

Execution plan for splitting over-merged `MASTER_CATALOG` rows so distinct SKUs get distinct `c()` ids and aliases remain true synonyms. Hand to an agent batch-by-batch; delegate import/matcher tests and fixture consistency as noted.

## Goal

- Import matching and grocery merge should not collapse non-interchangeable products into one canonical catalog id.
- **Aliases** = matching/search only (per PRD). Optional **`familyKeys`** on household `Ingredient` = weak planner grouping, not synonyms.

## Constraints

- **Verify each batch:** `npm run typecheck`, `npm test`; run `npm run db:seed` if fixtures change materially.
- **Files:** Primarily `src/catalog.ts`; update `fixtures/households/*.json` and `src/seed-data.json` when `catalogId` or seeded ingredients change.
- **No drive-by refactors** outside catalog + necessary fixture/test updates.
- **After id changes:** `rg '<old-catalog-id>'` across the repo; adjust tests (e.g. `tests/f064-parser-matcher-hardening.test.ts`) when matcher behavior is intentionally changed.

## Already completed

- **Oats** split: `cat-rolled-oats`, `cat-quick-oats`, `cat-steel-cut-oats`, `cat-instant-oats` (removed `cat-oats`).
- Seed household `ing-oats` uses `catalogId: cat-rolled-oats` in fixtures and `seed-data.json`.

---

## Batch A — Wrong-target alias removals (small, low risk)

**Intent:** Stop false positives; new rows optional.

| Item           | Action                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Ground beef    | Remove alias `ground meat` from `cat-ground-beef` (or accept unmatched until user picks). |
| Sirloin steak  | Remove alias `steak` from `cat-sirloin-steak`.                         |
| Almond butter  | Remove `nut butter`; add `cat-nut-butter` only if product needs a bucket. |
| Sriracha       | Remove generic `hot sauce` or add `cat-hot-sauce` (prefer remove first). |

**Suggested delegate:** import-focused + matcher tests. **Size:** ~1 short PR.

---

## Batch B — Liquids / acids

| Item          | Split                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Vinegar       | `cat-white-vinegar` vs `cat-apple-cider-vinegar`; tight aliases each. |
| Rice vinegar  | Plain vs seasoned rows.                                               |

**Suggested delegate:** data-agent + import regression check. **Size:** 1 PR.

---

## Batch C — Fresh vs dried (produce vs spice)

| Item   | Split                                                          |
| ------ | -------------------------------------------------------------- |
| Ginger | `cat-fresh-ginger` vs `cat-ground-ginger`.                     |
| Herbs  | Thyme, rosemary, sage, parsley, dill: fresh vs dried per herb. |

**Suggested delegate:** ingredient-ontology-steward (read-only alias review) + implementation. **Size:** 1–2 PRs (ginger first; herbs are many lines).

---

## Batch D — Starches, legumes, tortillas, radish

| Item             | Split                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Rice flour       | `cat-rice-flour` vs `cat-glutinous-rice-flour` (mochiko); no cross-aliases. |
| Corn tortillas   | Soft `cat-corn-tortillas` vs `cat-taco-shells`.                       |
| Cannellini beans | Separate white bean types or strip cross-type aliases to true synonyms only. |
| Radish           | `cat-radish` vs `cat-daikon`.                                         |

**Size:** 1 PR, or split legumes vs the rest.

---

## Batch E — Dairy, meat analog, tomatoes

| Item      | Split                                                                 |
| --------- | --------------------------------------------------------------------- |
| Yogurt    | `cat-plain-yogurt` vs `cat-greek-yogurt` (spellings `yoghurt` as needed). |
| Bacon     | `cat-bacon` (pork) vs `cat-turkey-bacon`.                             |
| Tomatoes  | Canned/stewed-style phrases → `cat-tinned-tomatoes` (or dedicated row); fresh on fresh row. |

**Size:** 1 PR; likely `catalogId` updates in seed/fixtures for yogurt/bacon/tomato rows.

---

## Batch F — Optional / product judgment

Defer unless import or prefs need it:

- Whiskey styles (scotch / Irish vs generic).
- Smoked vs sweet paprika; broccoli vs broccolini; orange vs mandarin.
- Balsamic vs glaze; whole vs ground cloves/cinnamon/etc.

**Size:** small PRs or backlog.

---

## Recommended order

1. **A** (alias fixes + tests).
2. **B**, then **D**.
3. **C** (largest edit surface).
4. **E** (fixture churn).
5. **F** only when justified.

---

## Per-batch checklist

1. Edit `src/catalog.ts` (`c()` rows and alias arrays).
2. `rg '<old-catalog-id>'` → update fixtures, `seed-data.json`, tests.
3. `npm run typecheck && npm test`.
4. Note the slice in `agent-progress.md` if that is part of your session workflow.
5. Commit: scoped message, e.g. `catalog: split vinegar rows; remove steak alias from sirloin`.

---

## Effort note

**Too much for one PR** if B–E are combined: many `catalogId` updates and matcher edge cases. **Batch A** is a good first agent task. **B through E** is roughly **4–6 focused PRs**, or **2–3** if batches are merged carefully by someone who greps every old id.

## Delegation map

| Batch | Primary                         | Support                          |
| ----- | ------------------------------- | -------------------------------- |
| A     | import-agent / test fixes       | —                                |
| B–E   | data-agent (catalog + fixtures) | import-agent for matcher tests   |
| C–E   | —                               | ingredient-ontology-steward (review aliases before merge) |
