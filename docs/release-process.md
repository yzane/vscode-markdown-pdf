# Release Process

Step-by-step procedure for cutting a Marketplace release of `yzane.markdown-pdf`. Follow this whenever a new `release/x.x.x` branch is being prepared.

## Overview

The repository follows GitFlow without `hotfix/*`:

- `master` reflects the latest VS Code Marketplace release. **Updated only at publication time.**
- `develop` is the integration branch.
- `release/x.x.x` and `bugfix/*` are short-lived working branches, always created as `git worktree` under `.worktrees/`.

See [`../AGENTS.md`](../AGENTS.md) for the full branching rules.

A release goes through five stages:

1. **Release preparation** — finalize content on `release/x.x.x` and merge into `develop`.
2. **Pre-publish smoke test** — install a verification vsix locally.
3. **Master integration** — merge into `master`, tag, push.
4. **GitHub Release** — create release page with the vsix as asset.
5. **Marketplace publication** — `vsce publish`.

Each step from 3 onward is irreversible in practice — confirm with the user before every push / publish.

## Prerequisites

Before starting:

1. `vsce verify-pat yzane` succeeds (the credential-store warning on Linux/WSL is harmless).
2. `gh auth status` succeeds.
3. `CHANGELOG.md` has a `## x.x.x (YYYY/MM/DD)` entry with all placeholder text resolved.
4. `README.md` / `README.ja.md` have their `### x.x.x` headings under "What's New" and "Breaking Changes" / "仕様変更" confirmed.
5. `develop` is in sync with `origin/develop`.

## Step 1 — Release preparation

Work on `release/x.x.x`, created as a worktree from `develop`:

```bash
# From the main tree, on develop
git worktree add .worktrees/release-x.x.x -b release/x.x.x develop
cd .worktrees/release-x.x.x
npm install --no-audit --no-fund
```

Inside the worktree, finalize the release content with one commit per concern:

1. `chore: bump version to x.x.x` — `package.json` `"version"` field only.
2. `docs: finalize x.x.x changelog entry` — replace the `X.Y.Z (YYYY/MM/DD)` placeholder in `CHANGELOG.md`.
3. `docs: finalize READMEs for x.x.x release` — replace `### X.Y.Z` placeholders in both `README.md` and `README.ja.md`.
4. `docs(sample): regenerate sample for x.x.x release` — run `npm run sample` and commit `sample/*` (and `package-lock.json` if the version field re-syncs).
5. Optional polishing commits as needed.

Run the full test suite from inside the worktree:

```bash
npm test
```

Then get user approval and merge into `develop`:

```bash
cd ../..   # back to the main tree (repository root)
git checkout develop
git merge --no-ff release/x.x.x -m "Merge branch 'release/x.x.x' into develop"
```

## Step 2 — Pre-publish smoke test

Build a verification vsix that points images at the `develop` branch (since `master` does not yet contain the new images):

```bash
cd .worktrees/release-x.x.x
npm run build
vsce package --baseImagesUrl https://github.com/yzane/vscode-markdown-pdf/raw/develop/
```

This produces `markdown-pdf-x.x.x.vsix` inside the worktree. **Push `develop` to `origin` first** so the URL is reachable:

```bash
git push origin develop
```

Install the vsix locally and verify in the VS Code extensions view:

- Banner image displays (Marketplace and locally-installed).
- Feature preview PNGs (checkbox / container / mermaid / PlantUML / math) display.
- The `Markdown PDF: Export (pdf)` command exports a PDF successfully.

**Do not** add `--no-rewrite-relative-links` — VS Code's extensions view cannot resolve relative URLs against the vsix-extracted folder, so all images would vanish.

## Step 3 — Master integration

This is the first irreversible publication step. Confirm with the user before every push.

```bash
# Merge develop into master
cd ../..   # back to the main tree (repository root)
git checkout master
git merge --no-ff develop -m "Merge branch 'develop' into master for x.x.x release"

# Create annotated tag — NO 'v' prefix (see existing tags 1.0.0 ... 2.1.0)
git tag -a x.x.x -m "Release x.x.x"

# Push master and tag together
git push origin master x.x.x
```

Regenerate the production vsix in the main tree and sanity-check it:

```bash
npm install --no-audit --no-fund   # if main tree node_modules is stale
npm run package
ls -la markdown-pdf-x.x.x.vsix
unzip -l markdown-pdf-x.x.x.vsix | head -30
unzip -p markdown-pdf-x.x.x.vsix extension/readme.md | grep -E "banner|raw/HEAD"
```

Expected:

- File count ~1.5K, size ~7-8 MB. If it is 10K+ files / 70+ MB, `.worktrees/` or `.superpowers/` leaked in — fix `.vscodeignore` (see Gotchas).
- README contains `https://github.com/yzane/vscode-markdown-pdf/raw/HEAD/images/banner.png` (rewritten by vsce).
- No `.worktrees/` or `.superpowers/` entries in `unzip -l`.

## Step 4 — GitHub Release

Create the GitHub Release **before** Marketplace publication so any title/body/asset mistake can still be corrected with `gh release edit` while there is no Marketplace artifact yet.

```bash
sed -n '/^## x.x.x (/,/^## <previous> (/p' CHANGELOG.md | sed '$d' > /tmp/release-notes.md

gh release create x.x.x \
  --title "x.x.x" \
  --notes-file /tmp/release-notes.md \
  markdown-pdf-x.x.x.vsix
```

Verify at `https://github.com/yzane/vscode-markdown-pdf/releases/tag/x.x.x`:

- Title equals the tag name (no `v` prefix).
- Body matches the CHANGELOG entry verbatim.
- vsix asset is downloadable.

## Step 5 — Marketplace publication

Reuse the production vsix from Step 3 so the Marketplace bytes match the GitHub Release asset exactly:

```bash
vsce publish --packagePath markdown-pdf-x.x.x.vsix
```

Expected: `DONE  Published yzane.markdown-pdf vx.x.x.`. Marketplace propagation takes a few minutes.

Verify at https://marketplace.visualstudio.com/items?itemName=yzane.markdown-pdf

## Post-publish hygiene

```bash
# Ensure origin/develop is up to date (master merge above leaves develop ahead if bugfixes were merged late)
git push origin develop

# Tear down the working worktree (keep the branch itself, per existing convention)
git worktree remove .worktrees/release-x.x.x

# Remove merged bugfix branches (release branches are kept)
git branch -d bugfix/<name>
```

The local `release/x.x.x` branch is kept (mirrors the existing pattern for `release/1.x.x` / `release/2.0.0` / `release/2.0.1` / `release/2.1.0`). It is not pushed to `origin`.

## Gotchas checklist

Run through this **before** Step 3 to avoid wasting a publication cycle. Full background is in the memory entry `marketplace-release-gotchas`.

- [ ] `.vscodeignore` excludes `.worktrees/**` and `.superpowers/**` (otherwise the vsix balloons ~10×).
- [ ] `.vscodeignore` excludes `images/**` except `!images/icon.png` (other assets are fetched from GitHub by the extensions view, not read from the vsix).
- [ ] README references no SVG (vsce 3.x rejects SVGs in README; use PNG and keep editable SVG sources excluded from the vsix).
- [ ] README does not rely on `<picture>` / `<source srcset>` for dark-mode banners (VS Code Webview ignores `<source>` and always falls back to `<img>`). Use a single `<img>`.
- [ ] Never pass `vsce package --no-rewrite-relative-links` — it makes all README images disappear.

## Verification quick reference

| Check | Command |
|---|---|
| vsce auth | `vsce verify-pat yzane` |
| Files vsce will ship | `vsce ls` |
| Remote tag exists | `git ls-remote origin refs/tags/x.x.x` |
| Production vsix content | `unzip -l markdown-pdf-x.x.x.vsix \| head -30` |
| README image base URL | `unzip -p markdown-pdf-x.x.x.vsix extension/readme.md \| grep raw/HEAD` |
| GitHub Release | `gh release view x.x.x` |
| Marketplace listing | https://marketplace.visualstudio.com/items?itemName=yzane.markdown-pdf |

## Rollback

| Stage | What can be undone |
|---|---|
| Before pushing master/tag | Delete local tag and reset master (`git tag -d`, `git reset --hard <previous>`). |
| After pushing, before GitHub Release | Force-update the tag and re-push master (`git push origin --force-with-lease`, `git push origin --force <tag>`). |
| After GitHub Release | `gh release edit x.x.x` for title/body, `gh release upload --clobber` for asset. The tag itself can still be force-moved if necessary. |
| After `vsce publish` | The version number is consumed. `vsce unpublish` removes the listing but the same version cannot be re-uploaded. **The right fix is to ship `x.x.(x+1)` with the correction.** |

## Reference: 2.1.0 worked example

A real walk-through of all five steps — including recovery from a 76 MB vsix caused by `.worktrees/` not being in `.vscodeignore` — is recorded in the `release/2.1.0` branch history. Inspect with:

```bash
git log --oneline release/2.1.0
```

The corresponding fix commit is `a9479c2 fix(vscodeignore): exclude .worktrees and .superpowers from vsix`, and the cleanup commits that produced the minimal-image / no-`<picture>` layout are `cd8597d` and `6912a70`.
