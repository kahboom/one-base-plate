# Import Performance and Scaling — Agent Memory

This file is the persistent knowledge store for the **import-performance-scaling** agent.
It is read at the start of every session and updated when new findings are confirmed.

---

## Confirmed hot paths (Entrees.paprikarecipes — 314 recipes, ~12.8 MB, tested 2026-03-31)

### 1. `matchIngredient` — `src/recipe-parser.ts`

**Type:** Algorithmic  
**Pattern:** O(lines × (|household| + |catalog|)) — full linear scan of household ingredients (plus aliases) and all ~106 MASTER_CATALOG rows (plus aliases), scored per line. No early exit once a good-enough match is found.  
**Impact:** Dominant CPU cost for large imports. With a real household library (H001-scale) this is the single biggest multiplier.  
**Safe fix directions:** Narrowing/two-stage scan (exact/prefix check before fuzzy); precomputed token index to prune candidates; per-session match cache keyed on normalized name (cache must be invalidated on parser version bump).  
**Do not:** Lower `CATALOG_MIN` globally, skip veto checks, or merge household and catalog scoring in ways that change determinism.

### 2. `parsePaprikaFile` — `src/paprika-parser.ts`

**Type:** I/O sequencing / perceived responsiveness  
**Pattern:** Sequentially `await`s each of 314 zip entries: `DecompressionStream` → buffer merge → `JSON.parse`. Correct and simple but produces a long uninterrupted main-thread run.  
**Impact:** Perceived freeze during initial file load before any recipe appears on screen.  
**Safe fix directions:** Yield between entries (`queueMicrotask` / `requestAnimationFrame`) with a "Parsing _k_/314" progress indicator; or offload to a Web Worker (larger change, only if yield-based approach is insufficient).  
**Do not:** Skip parsing or JSON validation to go faster.

### 3. `saveImportSession` called on every `parsedRecipes` change — `src/pages/PaprikaImport.tsx` (useEffect)

**Type:** Storage / serialization  
**Pattern:** A `useEffect` depending on `[loaded, householdId, step, parsedRecipes]` calls `saveImportSession` → `JSON.stringify` of the compact session → `rememberAndQueuePaprikaImportSessionPersist` → IndexedDB `meta.put`. Fires on every individual user action during review.  
**Impact:** Frequent serialization + IndexedDB writes during interactive review. Low latency per write but adds up at scale and creates main-thread jank.  
**Safe fix directions:** Debounce 300–1000 ms idle; flush immediately on step transitions, `beforeunload`, and "Finalize" action. Keep memory copy (`paprikaImportSessionJson`) always current; only the IndexedDB write needs debouncing.  
**Do not:** Remove persistence or make resume sessions unreliable; the memory copy is still written synchronously.

### 4. `reviewGroups.findIndex` per group row in tier render — `src/pages/PaprikaImport.tsx` ~line 1221

**Type:** Rendering — O(n²)  
**Pattern:** Inside `tierGroups.map(...)`, each group calls `reviewGroups.findIndex((g) => g.groupKey === group.groupKey)` to resolve a render-time index. With hundreds of groups (Entrees produced ~1043 groups at 10/page) this is quadratic per render triggered by any state change.  
**Safe fix directions:** Precompute `Map<groupKey, index>` alongside `reviewGroups` (single `useMemo`), use it in the render loop in O(1).  
**Do not:** Change grouping keys or group identity in a way that breaks test assertions in `f050-paprika-grouped-resolution.test.tsx`.

---

## Known scale characteristics (Entrees.paprikarecipes, first-import cold start)

- 314 recipes, ~3,000–4,500 ingredient lines estimated
- ~1,043 review groups at page size 10 → 105 pages when most lines pending
- Cold-start household has few ingredients → most lines unmatched → high pending rate
- CATALOG_MIN = 0.86 is correctly conservative; many real ingredients (e.g. "whole wheat pastry flour") won't fuzzy-match any catalog entry at this threshold

## Bulk review UX: scaling issue (documented by paprika-import-qa agent)

Not a performance issue per se, but interacts with render scaling:

- "Approve all matches" only clears already-matched lines — does not reduce pending queue
- "Create all new" floods household — does not reduce cognitive load
- Tiered review (confirm / create / check) is the right direction; virtual scroll or larger page size reduces DOM pressure when tiers are expanded

---

## Optimizations already in place (do not re-suggest)

- `toSessionRecipeSnapshot` strips `ingredients`, `directions`, `photo_data` from session snapshots — keeps persisted JSON small
- `rememberAndQueuePaprikaImportSessionPersist` writes memory synchronously and IndexedDB asynchronously — memory copy is always current for sync reads
- `refreshPaprikaSessionParsedLines` re-parses from `raw` on parser version bump — session stale-data handled
- `allReviewLines`, `filteredReviewLines`, `reviewGroups`, `tieredGroups`, `tierData` are all `useMemo`-gated — only recompute on `parsedRecipes` change

---

## Correctness guardrails (never weaken these when optimizing)

- Duplicate prevention: `detectDuplicateRecipe` must run per recipe on every full parse
- Low-confidence review: `confidenceBand === 'low'` lines must stay `resolutionStatus === 'pending'`
- Import mapping retention: `originalSourceLine`, `ImportMapping`, `parserSuggestedIngredientId/CatalogId` must survive any caching layer
- Resumable sessions: memory copy must always reflect latest state; IndexedDB flush must happen on step transitions and unload
- Draft gate: `canFinalizePaprikaImport` must not pass while unresolved lines remain

---

## Verification checklist for any perf change

- `npm test` — especially `f048`, `f049`, `f050`, `f051`, `f067`, `f074`, `f070`
- `npm run typecheck`
- Manual: upload `Entrees.paprikarecipes`, confirm review groups still appear, grouped resolution still works, session resume still works after page reload
- `performance.mark`/`measure` before and after the changed path to confirm the hot path improved

---

## Update log

| Date       | Finding                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-03-31 | Initial audit — Entrees.paprikarecipes 314 recipes. Four hot paths identified: matchIngredient scans, sequential parsePaprikaFile, per-change saveImportSession, findIndex in tier render. |
