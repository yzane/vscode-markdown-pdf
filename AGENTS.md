# Superpowers Plugin Conventions

These rules apply only to plan/spec files managed by the `superpowers` plugin under `docs/superpowers/`.

- Plan and spec files must be written in Japanese.
- Filename format: `YYYYMMDD-NN-<topic>-design.md` (specs), `YYYYMMDD-NN-<topic>.md` (plans). `NN` is the sequential number within the same date — check existing files before creating a new one. This overrides the superpowers skill default of `YYYY-MM-DD-`.

# Coding Rules

- Code comments must be written in English.

# Development Workflow

This repository follows the GitFlow branching model without `hotfix/*`. All bug fixes go through `develop` via `bugfix/*`. `master` is updated only when publishing to the VS Code Marketplace, so it always reflects the latest published release.

Branches (all working branches are created from `develop` and merged back into `develop`):

- `master`: production — matches the latest Marketplace release
- `develop`: integration
- `feature/<name>`, `release/<version>`, `bugfix/<name>`: working branches

Rules:

- Do not change this branching model. Do not use `hotfix/*`, and do not assume `main` exists.
- Never delete `develop`. Never commit directly to `master` or `develop` — all changes arrive via merges. When changes need to be committed while on `develop`, ask the user which branch type (`feature/*`, `release/*`, or `bugfix/*`) to create first.
- Update `master` only by merging from `develop` at Marketplace publish time. Never merge `release/*` or any other branch directly into `master`.
- Before any merge operation (integration into another branch, including `git merge` and PR merges), show a confirmation message and wait for user approval — even in auto-accept mode.
- When delegating to subagents, always pass the current branch name and require them to stay on it.

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
