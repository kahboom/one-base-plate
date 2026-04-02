# Changelog agent — memory (short)

- **Owns:** Appending to `CHANGELOG.md` from `agent-progress.md` + `git log`; synthesizing user-facing entries in the repo's format.
- **Append-only** — never rewrite or remove existing changelog entries.
- **Sources:** `agent-progress.md` (session log), `git log --oneline --since=<last entry date>`, `PRD.json` (feature titles).
- **Format:** Most-recent-first; `Added` / `Fixed` / `Changed` / `Removed`; use `F0NN:` prefix for PRD-mapped features.
- **Skip:** In-progress work, internal-only tooling changes (agent files, docs), version bumps (ask user first).

_Last updated: 2026-04-02 (agent created)._
