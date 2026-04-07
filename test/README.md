# Tests

## Overview

This directory contains developer-facing documentation for the repository test suite.
The tests are split into unit tests for helper behavior and integration tests for VS Code command-driven export behavior.

## Test Structure

- `test/unit/chromium-resolver.test.ts` verifies the Chromium/Chrome executable resolver helpers, including configuration lookup, system probing, build-id derivation, and cache cleanup.
- `test/unit/utils.test.ts` exercises the shared helpers in `src/utils`, covering boolean logic, path utilities, template replacements, stylesheet assembly, and HTML/asset conveniences.
- `test/unit/vscodeignore.test.ts` codifies the expectations for `.vscodeignore` so the esbuild bundle keeps node_modules out while re-including runtime asset packages.
- `test/integration/extension.test.ts` drives the extension through the VS Code test harness, comparing generated markup, binaries, and error responses with trusted fixtures.
- `test/integration/fixtures/` contains the Markdown inputs used by the integration suite.
- `test/integration/expected/` stores the normalized HTML snapshots used for deterministic comparisons.

## Unit Tests

Each unit suite runs under `tsx --test` with Node's built-in test runner and targets a specific helper surface:

- The `chromium-resolver` tests confirm both user-provided paths and system-discovered executables, validate the build-id formatting, and ensure that cache cleanup only removes outdated browser entries.
- The `utils` tests exercise the shared helper surface in `src/utils.ts`, spanning boolean normalization, file/directory detection, slug generation, template substitutions, file loading, CSS builders, image URI conversions, exclusion matching, href/output-directory resolution, highlight callbacks, and MIME-specific options. Platform-sensitive scenarios (spaces, `#`, `file://`, `~/`, `../`, data URIs, Windows-only directories) remain covered.
- The `.vscodeignore` tests read the repository ignore file to verify that node_modules are stripped, bundled sources stay out, runtime assets are re-included, and puppeteer-related packages are not reintroduced inadvertently.

## Integration Tests

The integration suite drives the extension through `test/integration/extension.test.ts` using the VS Code test harness and the same command palette entry points.
HTML-focused tests open fixture Markdown files, export them, normalize values that fluctuate across runs (file URIs, timestamps, caches), and compare the results with the stored snapshots.
The PlantUML fixture runs in that suite with a targeted exception filter so the absence of a local Java VM does not mask the assertions.
Binary-generation tests reuse Markdown fixtures to produce PDF, PNG, and JPEG outputs and assert their existence, nonzero length, and magic-byte signatures.
Error-handling tests run the commands against a non-Markdown file and an untitled document to ensure the command exits cleanly without emitting stray HTML content.

## How to Run

- `npm run test:unit`
- `npm test`

## Notes and Limitations

- Integration tests run through the VS Code extension test environment instead of a plain Node.js process.
- Binary generation depends on a Chromium or Chrome executable being available to the extension runtime.
- Some integration assertions normalize environment-dependent content before comparison.
- Windows-specific unit tests are skipped on non-Windows platforms.
- Error-handling tests verify safe command completion, but they do not assert user-facing warning UI text.
- These tests do not guarantee pixel-perfect visual quality or full end-to-end UI interaction coverage.
