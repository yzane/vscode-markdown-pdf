# Release Notes

User-facing summary of changes. For the detailed development log, see [CHANGELOG.md](CHANGELOG.md).

## X.Y.Z (YYYY/MM/DD)

**New feature: PlantUML fenced code block support**

` ```plantuml ` fenced code blocks are now rendered as PlantUML diagrams alongside the existing `@startuml` / `@enduml` block-marker form. Both syntaxes produce the same `<img>` tag and share the [markdown-pdf.plantumlServer](README.md#markdown-pdfplantumlserver) setting, so you can mix them in the same document and pick whichever fits the editor you primarily use.

```plantuml
Alice -> Bob: hello
```

**New feature: Math rendering via KaTeX**

LaTeX math is now rendered via [KaTeX](https://katex.org/), matching VS Code's built-in Markdown preview. Inline (`$…$`, `\(…\)`), display (`$$…$$`, `\[…\]`), LaTeX environments, and ` ```math ` fenced code blocks are supported. Rendering runs locally — no network access is required.

To keep `$X$`-style placeholders as plain text, set [markdown-pdf.math.enabled](README.md#markdown-pdfmathenabled) to `false`, or disable math per document via `math.enabled: false` in the front matter.

**Improvement: Chromium auto-download fetches the latest Chrome Stable**

Chromium auto-download now resolves the latest Chrome Stable build id from the [Chrome for Testing API](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json) instead of relying only on the build id pinned by `puppeteer-core`. The new [markdown-pdf.chromium.autoDownload](README.md#markdown-pdfchromiumautodownload) setting (default `true`) lets you opt out and rely on an installed browser or [markdown-pdf.executablePath](README.md#markdown-pdfexecutablepath) instead.

**Breaking change: Markdown HTML is sanitized by default**

To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), HTML in Markdown is now sanitized by default following the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). The following are stripped from the Markdown body:

- Tags: `<script>`, `<iframe>`, `<style>`, `<textarea>`, `<title>`, `<xmp>`, `<noembed>`, `<noframes>`, `<plaintext>` (the opening `<` is escaped to `&lt;`; content is preserved as visible text).
- `on*` event handler attributes (`onclick`, `onload`, ...).
- `href` / `src` values that start with `javascript:`.

The behavior is controlled by the new [markdown-pdf.sanitize](README.md#markdown-pdfsanitize) setting:

- `"gfm"` (default) — strip disallowed tags and dangerous attributes. Recommended when opening Markdown written by others.
- `"gfm-allow-style"` — same as `"gfm"` but keeps `<style>`. Useful for self-contained PDFs built from Markdown you trust.
- `"none"` — legacy behavior, no sanitization. Not recommended.

**Migration — keep the previous behavior or embedded `<style>`:**

- Set `"markdown-pdf.sanitize": "none"` to preserve the previous behavior exactly.
- Use `"gfm-allow-style"` if you only need inline `<style>` blocks.
- Move layout CSS into a stylesheet file and reference it via [markdown-pdf.styles](README.md#markdown-pdfstyles) — external stylesheets are not sanitized.

## 2.0.1 (2026/04/14)

**Fix: Self-closing `<div class="page" />` now triggers a page break**

Self-closing `<div class="page" />` now correctly triggers a page break, matching the paired `<div class="page"></div>` form ([#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)).

## 2.0.0 (2026/04/13)

**Improvement: Include errors are reported inline**

Include (`:[label](path.md)`) now reports errors inline at the include site instead of aborting the whole export. A missing or unreadable fragment no longer breaks the rest of the document.

**Improvement: Image `src` rewriting handles more edge cases**

Image `src` rewriting now correctly handles quoted attributes, flexible whitespace, and raw-text contexts.

**Improvement: Front matter supports BOM-prefixed files**

Front matter parsing now accepts YAML front matter even when the file begins with a UTF-8 byte order mark.

**Breaking change: Heading IDs follow GitHub-compatible slug generation**

Heading IDs are now generated using GitHub-compatible VS Code slug generation. Compared to the previous implementation, the new slug generator preserves CJK characters and underscores while removing unsupported punctuation, which can cause existing internal anchors (e.g. `#some-heading`) to resolve differently.

If your Markdown relies on specific anchor strings (table of contents, cross-document links), re-check the generated anchors after exporting and update links as needed. See the FAQ entry [Why did my heading anchors change?](README.md#why-did-my-heading-anchors-change) for details.

**Breaking change: highlight.js upgraded to v11**

`highlight.js` was upgraded from v9 to v11. Some v9 style names were renamed or removed. Markdown PDF maps legacy style names to current names where possible and falls back to `tomorrow.css` when no mapping is available.

Check the [available styles](https://github.com/highlightjs/highlight.js/tree/main/src/styles) and update `markdown-pdf.highlightStyle` to a current style name. See [Why did my syntax highlight style stop working?](README.md#why-did-my-syntax-highlight-style-stop-working) for details.

**Breaking change: Front matter parsing is stricter**

Front matter parsing now uses a custom implementation instead of `gray-matter`. The new parser rejects the following structures that the previous parser may have accepted:

- Top-level YAML sequences (arrays).
- Front matter that does not parse into a plain object.
- Malformed YAML structures.

Valid front matter must be a YAML mapping (object) at the top level. BOM-prefixed files are still supported. See [Why is my front matter no longer parsed?](README.md#why-is-my-front-matter-no-longer-parsed) for details.

**Breaking change: Chromium resolution and cache moved to a built-in resolver**

Chromium download and cache management moved to a built-in `chromium-resolver`. The previous temporary-directory fallback was removed; the managed Chromium is stored under the VS Code global storage directory. An installed Chrome/Edge browser is preferred before falling back to auto-download. See [How is the Chromium browser selected?](README.md#how-is-the-chromium-browser-selected) and [Where is Chromium downloaded?](README.md#where-is-chromium-downloaded) for details.
