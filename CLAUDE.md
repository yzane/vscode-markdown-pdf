# Documentation Rules

- Plan and spec files under `docs/superpowers/` must be written in Japanese.

# Coding Rules

- Code comments must be written in English.

# Development Workflow

This repository uses the following branches:

- `master`: production branch
- `develop`: integration branch
- `feature/<name>`: created from `develop`
- `release/<version>`: created from `develop`

Rules:

- Do not change this branching model.
- Do not assume `main` is used in this repository.
- Never delete the `develop` branch.
- Create `feature/*` from `develop` and merge or open pull requests into `develop`.
- Create `release/*` from `develop` and merge or open pull requests into `develop`.
- For the final release, merge or open a pull request from `develop` into `master`.
- When delegating tasks to subagents, always include the current working branch name in the prompt and instruct them to work on that branch.
- Subagents must not switch to any branch other than the one specified.
- If the current branch is `develop` and changes need to be committed, ask the user whether to create a new feature or release branch before proceeding.

# Code Exploration Rules

- Use `cocoindex-code` MCP first when exploring code. Fall back to Grep/Glob if unavailable.
- Prefer semantic search before broad file reads.
- Read the minimum context needed.
- Make narrow changes only.
- Run narrow validation first.

# Precedence

1. Explicit user instruction
2. This `CLAUDE.md`
3. Existing repository conventions
4. Tool or skill defaults
