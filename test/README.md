# Tests

## Overview

This directory contains developer-facing documentation for the repository test suite.
The tests are split into unit tests for helper behavior, integration tests for VS Code command-driven export behavior, and sample/preview generation tasks that run on the same VS Code test harness.

## How to Run

- `npm run test:unit` — unit tests only (`tsx --test`).
- `npm run test:integration` — integration tests only (VS Code test harness; runs `npm run build` first).
- `npm test` — `test:unit` followed by `test:integration`.
- `npm run sample` — regenerate `sample/README.{pdf,html,png,jpeg}`.
- `npm run update-readme-previews` — regenerate preview PNGs under `images/` referenced by the README.

## Test Structure

- `test/unit/chromium-resolver.test.ts` verifies the Chromium/Chrome executable resolver helpers, including configuration lookup, system probing, build-id derivation, and cache cleanup.
- `test/unit/utils.test.ts` exercises the shared helpers in `src/utils.ts`, covering boolean logic, path utilities, template replacements, stylesheet assembly, and HTML/asset conveniences.
- `test/unit/vscodeignore.test.ts` codifies the expectations for `.vscodeignore` so the esbuild bundle keeps node_modules out while re-including runtime asset packages.
- `test/unit/markdown-it-checkbox.test.ts` verifies the in-repo GitHub-style checkbox plugin (`- [ ]` / `- [x]`).
- `test/unit/markdown-it-named-headers.test.ts` verifies heading ID generation and the `githubSlugify` helper used to keep anchors GitHub-compatible.
- `test/unit/markdown-it-math-brackets.test.ts` verifies tokenization for the `\(...\)` / `\[...\]` math bracket syntax.
- `test/unit/markdown-it-math-fence.test.ts` verifies tokenization for the ` ```math ` fenced code block syntax.
- `test/unit/math-renderer.test.ts` verifies the KaTeX-backed `renderMath()` output (inline vs display, user-defined macros, error handling).
- `test/unit/readme-previews.test.ts` verifies the helpers that drive README preview generation (section/fence extraction, Mermaid render HTML, PlantUML URL building, export path resolution).
- `test/integration/extension.test.ts` drives the extension through the VS Code test harness, comparing generated markup, binaries, and error responses with trusted fixtures.
- `test/integration/fixtures/` contains the Markdown inputs used by the integration suite.
- `test/integration/expected/` stores the normalized HTML snapshots used for deterministic comparisons.
- `test/sample/generate-sample.ts` runs under the VS Code test harness to export `README.md` into `sample/` as pdf/html/png/jpeg.
- `test/sample/update-readme-previews.ts` runs under the VS Code test harness to regenerate the preview PNGs referenced from `README.md` under `images/`.

## Unit Tests

Each unit suite runs under `tsx --test` with Node's built-in test runner and targets a specific helper surface:

- The `chromium-resolver` tests confirm both user-provided paths and system-discovered executables, validate the build-id formatting, and ensure that cache cleanup only removes outdated browser entries.
- The `utils` tests exercise the shared helper surface in `src/utils.ts`, spanning boolean normalization, file/directory detection, slug generation, template substitutions, file loading, CSS builders, image URI conversions, exclusion matching, href/output-directory resolution, highlight callbacks, and MIME-specific options. Platform-sensitive scenarios (spaces, `#`, `file://`, `~/`, `../`, data URIs, Windows-only directories) remain covered.
- The `.vscodeignore` tests read the repository ignore file to verify that node_modules are stripped, bundled sources stay out, runtime assets are re-included, and puppeteer-related packages are not reintroduced inadvertently.
- The `markdown-it-checkbox` tests render fixture Markdown through the in-repo plugin and assert the resulting HTML matches the GitHub disabled-checkbox shape.
- The `markdown-it-named-headers` tests cover the ID assignment for ASCII, CJK, underscore, and symbol-containing headings, plus the standalone `githubSlugify` behavior so the generator stays VS Code / GitHub compatible.
- The `markdown-it-math-brackets` / `markdown-it-math-fence` tests verify the parser-level tokenization for bracket-delimited and fenced math respectively, including precedence with neighboring inline syntax and how escaped delimiters fall through.
- The `math-renderer` tests render representative inline / display / environment expressions through KaTeX, validate the `katex` / `katex-display` wrapper classes, and confirm user-defined macros are honored without leaking between calls.
- The `readme-previews` tests target the pure helpers that the integration suite reuses: extracting Markdown sections, the first fenced block, the first `<pre>` block, building Mermaid render scaffolding and PlantUML image URLs, and resolving the export destination for each preview.

## Integration Tests

The integration suite drives the extension through `test/integration/extension.test.ts` using the VS Code test harness and the same command palette entry points.
HTML-focused tests open fixture Markdown files, export them, normalize values that fluctuate across runs (file URIs, timestamps, caches), and compare the results with the stored snapshots.
Fixtures cover the syntactic surface area of the extension: checkbox, container, emoji, image, syntax highlighting, breaks, page-break, mermaid, include (success / missing / code-block / target variants), front matter (breaks / no-emoji), math (enabled and disabled), and PlantUML in both the `@startuml`/`@enduml` block-marker form and the ` ```plantuml ` fenced form (both should produce the same encoded image URL).
The PlantUML fixtures run with a targeted exception filter so the absence of a local Java VM does not mask the assertions — the suite compares the deterministic `<img src="...">` URL rather than the rendered image bytes.
Binary-generation tests reuse Markdown fixtures to produce PDF, PNG, and JPEG outputs and assert their existence, nonzero length, and magic-byte signatures.
Error-handling tests run the commands against a non-Markdown file and an untitled document to ensure the command exits cleanly without emitting stray HTML content.

## Sample and Preview Generation

Two helper tasks run on the same VS Code test harness as the integration suite. They are not part of `npm test` because they mutate tracked artifacts (`sample/`, `images/`).

- `npm run sample` invokes `test/sample/generate-sample.ts`, which opens `README.md` in the test workspace and exports the full set of formats into `sample/` (`README.pdf`, `README.html`, `README.png`, `README.jpeg`). These are the artifacts linked from the "Sample files" section of the README.
- `npm run update-readme-previews` invokes `test/sample/update-readme-previews.ts`, which extracts each preview source from the README (Mermaid block, PlantUML block, math block, checkbox sample, container sample, etc.), exports it as a standalone PNG under a transient `.tmp-readme-previews/` workspace, and writes the result into `images/` where the README references it. Use this whenever a feature section's preview asset needs to be refreshed.

Both tasks require a working Chromium/Chrome executable (the same resolution path as the runtime extension) and run through the bundled `dist/` build, so a `npm run build` precedes them automatically via the `pretest:*` / `presample` npm scripts.

## Notes and Limitations

- Integration tests run through the VS Code extension test environment instead of a plain Node.js process.
- Binary generation, sample generation, and README preview generation all depend on a Chromium or Chrome executable being available to the extension runtime.
- Some integration assertions normalize environment-dependent content (file URIs, timestamps, cache paths) before comparison.
- The PlantUML integration assertions compare the deterministic image URL, not the rendered image bytes — they do not require a local Java VM.
- Windows-specific unit tests are skipped on non-Windows platforms.
- Error-handling tests verify safe command completion, but they do not assert user-facing warning UI text.
- `npm run sample` and `npm run update-readme-previews` write tracked artifacts; review the diff before committing.
- These tests do not guarantee pixel-perfect visual quality or full end-to-end UI interaction coverage.
