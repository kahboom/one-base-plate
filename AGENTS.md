# OneBasePlate — agent instructions (shared)

**Read this file first** for any automated assistant working in this repo.

**Product (one line):** Household meal planning with **one base meal, multiple assemblies**, merged groceries, and conflict-aware suggestions. Details: [`docs/ai/project-context.md`](docs/ai/project-context.md), [`README.md`](README.md).

## Reference docs

| Topic                                            | Doc                                                        |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Stack, commands, repo layout                     | [`docs/ai/repo-map.md`](docs/ai/repo-map.md)               |
| Conventions, PRD session loop, Paprika test data | [`docs/ai/conventions.md`](docs/ai/conventions.md)         |
| Ingredient fixtures / seed workflow              | [`docs/ai/ingredient-seed.md`](docs/ai/ingredient-seed.md) |
| Shared facts (canonical)                         | [`docs/ai/canonical-state.md`](docs/ai/canonical-state.md) |
| Layered memory (what goes where)                 | [`docs/ai/memory-system.md`](docs/ai/memory-system.md)     |
| Reusable workflows                               | [`docs/ai/workflows/`](docs/ai/workflows/)                 |
| Global rules (corrections, constraints)          | [`docs/ai/global-rules.md`](docs/ai/global-rules.md)       |
| Architectural decisions                          | [`docs/ai/decision-log.md`](docs/ai/decision-log.md)       |

**Sources of truth:** `PRD.json` (features, `passes`, uiSpec refs), `agent-progress.md` (session log), `CHANGELOG.md` (history).

## Core workflow

1. **One feature at a time** — Small, mergeable changes; no drive-by refactors.
2. **PRD-first** — Match work to `PRD.json`; read referenced uiSpecs before UI edits; flip `passes` only when verified.
3. **Verify** — `npm test` + `npm run typecheck` (and `npm run lint` when style matters); `./init.sh` for a full cold check.
4. **Progress** — Note meaningful slices in `agent-progress.md`; use clear commit messages.

**Vendor overlays:** Claude → [`CLAUDE.md`](CLAUDE.md) (`.claude/agents/` + `.claude/agent-memory/`). Gemini → [`GEMINI.md`](GEMINI.md).
