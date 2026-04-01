# Canonical state (shared facts)

**Purpose:** Stable, cross-agent facts about this repo. Update when the stack or sources of truth change — not for session notes or opinions.

| Fact                       | Value                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product**                | OneBasePlate — one base meal, multiple assemblies; merged groceries; conflict-aware suggestions. See [`project-context.md`](./project-context.md). |
| **PRD**                    | `PRD.json` — features, `passes`, uiSpec refs, `anthropicLongRunningAgentAlignment`                                                                 |
| **Session log**            | `agent-progress.md`                                                                                                                                |
| **History**                | `CHANGELOG.md`                                                                                                                                     |
| **User-facing overview**   | `README.md`                                                                                                                                        |
| **Client**                 | React 19 + TS (strict) + Vite 6 + Tailwind 4                                                                                                       |
| **Local data**             | Dexie (IndexedDB) — `src/storage.ts`, `src/storage/`                                                                                               |
| **Optional cloud**         | Supabase auth + sync — `src/supabase/`, `src/sync/`                                                                                                |
| **Tests**                  | Vitest + Testing Library — `tests/` (`fNNN-*.test.ts(x)`)                                                                                          |
| **Household fixtures**     | `fixtures/households/*.json` → `npm run db:seed` → `src/seed-data.json`                                                                            |
| **Ingredient seed detail** | [`ingredient-seed.md`](./ingredient-seed.md)                                                                                                       |
| **Commands / layout**      | [`repo-map.md`](./repo-map.md)                                                                                                                     |

**Do not duplicate** long explanations here — link to the doc above instead.
