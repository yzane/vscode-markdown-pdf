# Tests

## Overview

This directory contains developer-facing documentation for the repository test suite.
The tests are split into unit tests for utility behavior and integration tests for VS Code command-driven export behavior.

## Test Structure

- `test/unit/utils.test.js` covers helper functions in `src/utils.js`.
- `test/integration/extension.test.js` covers HTML snapshots, binary generation, and error-handling behavior in the VS Code extension test environment.
- `test/integration/fixtures/` contains Markdown inputs used by integration tests.
- `test/integration/expected/` contains normalized HTML snapshots used for comparison.

## Unit Tests

The unit test suite focuses on `src/utils.js`.
It covers boolean handling, file and directory existence checks, slug generation, template placeholder replacement, file loading, CSS assembly, image path conversion, exclusion matching, href resolution, output directory resolution, and style tag construction.
Path-oriented cases intentionally cover spaces, `#`, `file://`, `~`, parent-directory traversal, data URIs, and Windows-only behavior where the implementation differs by platform.

## Integration Tests

The integration suite checks the extension from the command layer.
HTML-oriented tests open fixture Markdown files, run the HTML export command, normalize environment-dependent values such as file URIs and timestamps, and compare the generated output with committed snapshots.
The PlantUML fixture runs in the HTML group with a focused uncaught-exception filter so that missing local Java does not mask the intended assertion.
Binary-generation tests build a combined Markdown input and verify that generated PDF, PNG, and JPEG files exist, are non-empty, and start with the expected magic bytes.
Error-handling tests execute the same commands against a non-Markdown file and an untitled document to confirm the extension returns safely without generating stray HTML output.

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
