# Superpowers Plugin Conventions

These rules apply only to plan/spec files managed by the `superpowers` plugin under `docs/superpowers/`.

- Plan and spec files must be written in Japanese.
- Filename format: `YYYYMMDD-NN-<topic>-design.md` (specs), `YYYYMMDD-NN-<topic>.md` (plans). `NN` is the sequential number within the same date — check existing files before creating a new one. This overrides the superpowers skill default of `YYYY-MM-DD-`.

# Coding Rules

- Code comments must be written in English.

# Release Notes

- `CHANGELOG.md` is the single source of truth for release history. Each version groups entries under `### Breaking Changes` / `### Changes` / `### Fixes` subheadings. VS Code Marketplace renders this file directly.
- GitHub Release body: paste the `CHANGELOG.md` entry for the released version verbatim.
- `README.md` / `README.ja.md` upper sections surface a short excerpt:
  - `## What's New`: one-line bullets scoped to **v2 and later**, each ending with a link to the existing Features / Options / FAQ section for detail. No prose blocks.
  - `## Breaking Changes`: entries scoped to **v2 and later**, each linking to the FAQ entry that explains the migration.
- README bottom section is `## [Change Log](CHANGELOG.md)` with only a pointer sentence — no CHANGELOG excerpts.
- Do not introduce a separate `RELEASE_NOTES.md` layer (a 2026-04-20 design attempt was rejected; see `docs/superpowers/specs/20260420-03-release-notes-file-design.md`).

# Development Workflow

This repository follows the GitFlow branching model without `hotfix/*`. All bug fixes go through `develop` via `bugfix/*`. `master` is updated only when publishing to the VS Code Marketplace, so it always reflects the latest published release.

Branches (all working branches are created from `develop` and merged back into `develop`):

- `master`: production — matches the latest Marketplace release
- `develop`: integration
- `feature/<name>`, `release/<version>`, `bugfix/<name>`: working branches

Rules:

- Do not change this branching model. Do not use `hotfix/*`, and do not assume `main` exists.
- Never delete `develop`. Never commit directly to `master` or `develop` — all changes arrive via merges. When changes need to be committed while on `develop`, ask the user which branch type (`feature/*`, `release/*`, or `bugfix/*`) to create first.
- Working branches (`feature/*`, `release/*`, `bugfix/*`) are created as isolated `git worktree` under `.worktrees/`, not via `git checkout` on the main tree.
- Update `master` only by merging from `develop` at Marketplace publish time. Never merge `release/*` or any other branch directly into `master`.
- Before any merge operation (integration into another branch, including `git merge` and PR merges), show a confirmation message and wait for user approval — even in auto-accept mode.
- When delegating to subagents, always pass the current branch name and require them to stay on it.

# Release Process

The full step-by-step procedure for cutting a Marketplace release (release branch → master merge → tag → GitHub Release → `vsce publish`) lives in [`docs/release-process.md`](docs/release-process.md). Reference it whenever a `release/x.x.x` branch is being prepared.

Naming conventions encoded in past releases (immutable):

- Release tags use the unprefixed `x.x.x` form (annotated). The series `1.0.0` … `2.1.0` is unbroken.
- The `master` merge commit message at publish time follows `Merge branch 'develop' into master for x.x.x release`.

# Branch Completion

- On branch completion, default to a local merge into `develop` (still subject to the merge-confirmation rule above).
- Do not present the default completion-options menu unless the user explicitly asks for alternatives.

# Code Exploration

- Use the `cocoindex-code` MCP first; fall back to Grep/Glob if unavailable.
- Prefer semantic search over broad file reads. Read the minimum context needed. Make narrow changes and run narrow validation first.

# Precedence

1. Explicit user instruction
2. These project instructions (`AGENTS.md` / `CLAUDE.md`)
3. Existing repository conventions
4. Tool or skill defaults
