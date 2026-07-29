# Change Log

## 2.2.0 (2026/07/28)

### Breaking Changes

* Sanitization behavior change: with `markdown-pdf.sanitize` set to `"gfm"` (default) or `"gfm-allow-style"`, block-level `<style>`, `<script>`, and `<iframe>` elements in the Markdown body are now removed entirely — tag and content — instead of having the opening `<` escaped and the content left as visible text in the output. This prevents CSS / JavaScript source code from appearing as literal text in exported files. Inline occurrences are still escaped as before. When something is removed during an export, a notification summarizes what was removed: a toast with a "Show Details" button on manual export, or an entry in the "Markdown PDF" output channel on automatic convert-on-save [#437](https://github.com/yzane/vscode-markdown-pdf/issues/437)

### Changes

* Add `Markdown PDF: Output Diagnostics` command (Command Palette) that writes environment and configuration diagnostics — extension version, VS Code / OS info, Chromium path and its resolution source, and relevant settings — to the "Markdown PDF" output channel. Home directory paths are masked. Attach its output when filing an issue
* Add a "Markdown PDF" output channel (log level aware) that collects all extension logs, and log an environment snapshot and conversion context at the start of each export to make failure reports diagnosable [#437](https://github.com/yzane/vscode-markdown-pdf/issues/437)
* Improve error notifications: toasts now describe what failed in plain language instead of showing internal function names, add a one-line hint for common causes (Chromium launch failure, locked output file / permission denied, disk full, invalid output directory — with an "Open Settings" shortcut where applicable), and provide a "Show Details" button that opens the log with the full context, error message, and stack trace [#437](https://github.com/yzane/vscode-markdown-pdf/issues/437)
* Chromium resolution failures now report the underlying reason — network / proxy download failure, `markdown-pdf.chromium.autoDownload` disabled, or no usable browser found — instead of a generic "Chromium does not exist" message [#436](https://github.com/yzane/vscode-markdown-pdf/issues/436)
* Error logs now follow `Error.cause` chains and expand `AggregateError`, and missing shared system libraries (a common Chromium launch failure on minimal Linux environments) are detected and called out explicitly

### Fixes

* Fix: Documents containing an unmatched backtick before a fenced code block no longer have a chunk of content duplicated as raw Markdown in the export. The `markdown-it-include` code-region scanner could pair an opening backtick with a closing backtick on the far side of a fenced block, producing overlapping protected regions that were emitted twice. Affects 2.0.0 through 2.1.0; the include scan runs on every export because `markdown-pdf.markdown-it-include.enable` defaults to `true` [#443](https://github.com/yzane/vscode-markdown-pdf/issues/443) [#444](https://github.com/yzane/vscode-markdown-pdf/pull/444)
* Fix: Export no longer hangs indefinitely when `markdown-pdf.sanitize` is `"none"` and the document contains scripts that open blocking dialogs (`alert()`, `confirm()`, `prompt()`, `beforeunload`). Such dialogs are now auto-dismissed during rendering and recorded in the output channel
* Fix: When HTML generation fails, the export is now skipped instead of writing a corrupted file. Previously the literal string `undefined` or template-wrapped garbage was written to the output path, silently overwriting a previous good export
* Fix: The `Exporting (pdf) ...` progress notification no longer stays open indefinitely when post-export cleanup stalls. Browser shutdown is now bounded by a timeout, and the temporary HTML file is reliably removed [#374](https://github.com/yzane/vscode-markdown-pdf/issues/374)

## 2.1.0 (2026/05/24)

### Breaking Changes

* Security hardening: Raw HTML in Markdown is now sanitized by default according to the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). The following are removed from Markdown body content:
  * Tags: `<script>`, `<iframe>`, `<style>`, `<textarea>`, `<title>`, `<xmp>`, `<noembed>`, `<noframes>`, `<plaintext>` (opening `<` is escaped to `&lt;`, content is preserved as visible text)
  * `on*` event handler attributes (`onclick`, `onload`, etc.)
  * `href` / `src` attributes whose value begins with `javascript:`
* The behavior is controlled by the new `markdown-pdf.sanitize` setting (`"gfm"` / `"gfm-allow-style"` / `"none"`, default `"gfm"`). See README for details and migration notes.
* To preserve pre-change behavior, set `markdown-pdf.sanitize` to `"none"`. To keep inline `<style>` only, use `"gfm-allow-style"`. Existing layout CSS can also be migrated to external files via `markdown-pdf.styles`.

### Changes

* Add `markdown-pdf.sanitize` setting for raw HTML sanitization (see Breaking Changes above)
* Add support for `` ```plantuml `` fenced code blocks as a PlantUML syntax in addition to the existing `@startuml` / `@enduml` block markers. Both are supported on equal footing (the fence form is the same one used by VS Code preview, GitHub, and GitLab) [#92](https://github.com/yzane/vscode-markdown-pdf/issues/92) [#162](https://github.com/yzane/vscode-markdown-pdf/issues/162) [#389](https://github.com/yzane/vscode-markdown-pdf/issues/389)
* Automatically download the latest Chrome Stable build when Chromium is needed, instead of using only the build id pinned by `puppeteer-core`. If the Chrome for Testing API is unreachable, the extension falls back to the latest cached build, and finally to the `puppeteer-core` bundled build id. Add the new `markdown-pdf.chromium.autoDownload` setting (default `true`); set it to `false` to opt out of the automatic download and rely on an installed system browser (Chrome / Chromium / Edge) or `markdown-pdf.executablePath`.
* Add math rendering support via KaTeX for `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, and `` ```math `` fenced code blocks (matches VS Code's built-in Markdown preview). Controlled by the new `markdown-pdf.math.enabled` (default `true`) and `markdown-pdf.math.katex.macros` settings.

## 2.0.1 (2026/04/14)

### Fixes

* Fix: Self-closing `<div class="page" />` now correctly triggers a page break [#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)

## 2.0.0 (2026/04/13)

### Breaking Changes

* Heading IDs now follow GitHub-compatible VS Code slug generation. Existing internal anchors in your documents may change.
* Highlight.js upgraded from v9 to v11. Some highlight style names have been renamed or removed. Legacy names are mapped to current names when possible, and `tomorrow.css` is used as a fallback when no mapping is available.
* Front matter parsing is now handled by a custom implementation. YAML sequences and non-plain objects in front matter are now rejected.
* Chromium download and cache management moved to a built-in `chromium-resolver`. The previous temporary directory fallback has been removed; the managed Chromium is stored under the VS Code global storage directory.

### Changes

* Migrate source code to TypeScript and bundle the extension with esbuild
* Bundle `puppeteer-core` and manage Chromium via the built-in `chromium-resolver`, preferring an installed Chrome/Edge and falling back to an automatic download
* Replace `markdown-it-include`, `markdown-it-named-headers`, and `markdown-it-checkbox` with in-repo custom implementations
* Remove `cheerio`, `mustache`, and `gray-matter` dependencies in favor of internal implementations
* Add unit and integration test suites using `vscode-test-cli`, including sample generation and HTML snapshot comparison
* Simplify VS Code variant detection and remove the obsolete temp-cache fallback

### Fixes

* Fix global storage path resolution for the Chromium cache
* Gracefully handle include errors in the custom `markdown-it-include` plugin
* Image `src` transformation now handles quoted attributes, flexible spacing, and raw-text contexts correctly
* Front matter parsing now handles BOM-prefixed files and rejects invalid structures

## 1.6.0 (2025/04/15)
* Fix: Allow underscores in section header identifiers [#404](https://github.com/yzane/vscode-markdown-pdf/pull/404)
* Update: align slug generation with [latest VSCode behavior](https://github.com/microsoft/vscode/blob/c07cee3039c8ea6e9bab02645599ec9e7796fd4c/extensions/markdown-language-features/src/slugify.ts#L27)

## 1.5.0 (2023/09/08)
* Improve: The default date format for headers and footers has been changed to the ISO-based format (YYYY-MM-DD).
  * Support different date formats in templates [#197](https://github.com/yzane/vscode-markdown-pdf/pull/197)
* Improve: Avoid TimeoutError: Navigation timeout of 30000 ms exceeded and TimeoutError: waiting for Page.printToPDF failed: timeout 30000ms exceeded [#266](https://github.com/yzane/vscode-markdown-pdf/pull/266)
* Fix: Fix description of outputDirectoryRelativePathFile [#238](https://github.com/yzane/vscode-markdown-pdf/pull/238)
* README
  * Add: Specification Changes
  * Fix: Broken link

## 1.4.4 (2020/03/19)
* Change: mermaid javascript reads from URL instead of from local file
  * Add: `markdown-pdf.mermaidServer` option
  * add an option to disable mermaid [#175](https://github.com/yzane/vscode-markdown-pdf/issues/175)
* Add: `markdown-pdf.plantumlServer` option
  * support configuration of plantUML server [#139](https://github.com/yzane/vscode-markdown-pdf/issues/139)
* Add: configuration scope
  * extend setting 'headerTemplate' with scope\.\.\. [#184](https://github.com/yzane/vscode-markdown-pdf/pull/184)
* Update: [slug](https://github.com/yzane/vscode-markdown-pdf/commit/3f4aeaa724999c46fc37423d4b188fd7ce72ffce) for markdown-it-named-headers
* Update: markdown.css, markdown-pdf.css
* Update: dependent packages
* Fix: Fix for issue \#186 [#187](https://github.com/yzane/vscode-markdown-pdf/pull/187)
* Fix: move the Meiryo font to the end of the font-family setting
  * Meiryo font causing \\ to show as ¥ [#83](https://github.com/yzane/vscode-markdown-pdf/issues/83)
  * Backslash false encoded [#124](https://github.com/yzane/vscode-markdown-pdf/issues/124)
  * Errors in which 한글\(korean word\) is not properly printed [#148](https://github.com/yzane/vscode-markdown-pdf/issues/148)
* Fix: Improve the configuration schema of package.json
    * Some settings can now be set from the settings editor.

## 1.4.3 (2020/03/12)
* Fix: markdown-include regular expression
    * Fix: Unable to export to pdf from markdown [#166](https://github.com/yzane/vscode-markdown-pdf/issues/166)
    * Fix: python code export err [#178](https://github.com/yzane/vscode-markdown-pdf/issues/178)
* Fix: Add support for Ubuntu and Centos
    * Fix: Error: Failed to lanuch chrome! [#97](https://github.com/yzane/vscode-markdown-pdf/issues/97)
    * Fix: I failed to launch chrome in WSL [#160](https://github.com/yzane/vscode-markdown-pdf/issues/160)
    * Fix: Unable to export to pdf from markdown [#166](https://github.com/yzane/vscode-markdown-pdf/issues/166)

## 1.4.2 (2020/02/16)
* Add: Support [gray-matter](https://github.com/jonschlinkert/gray-matter) (preview)
    * Avoid to display front matter [#157](https://github.com/yzane/vscode-markdown-pdf/pull/157)
    * Currently, only some settings can be specified.
* Fix: Improve the configuration schema of package.json
    * Some settings can now be set from the settings editor.
* Fix: Specifying custom style sheets with a relative path does not work [#170](https://github.com/yzane/vscode-markdown-pdf/pull/170)
* Fix: Pass language to markdown-pdf puppeteer [#172](https://github.com/yzane/vscode-markdown-pdf/pull/172)
    * Date Format [#95](https://github.com/yzane/vscode-markdown-pdf/issues/95)
* Improve: Reduce Regex strictness of markdown-it-include [#174](https://github.com/yzane/vscode-markdown-pdf/pull/174)

## 1.4.1 (2019/10/28)
* Fix: "ReferenceError: MarkdownPdf is not defined" on auto create PDF on save in VSCodium [#156](https://github.com/yzane/vscode-markdown-pdf/issues/156)

## 1.4.0 (2019/10/27)
* Add: Support [mermaid](https://github.com/knsv/mermaid)
    * Added mermaid support. [#144](https://github.com/yzane/vscode-markdown-pdf/pull/144)

## 1.3.1 (2019/09/30)
* Update: README
* Update: CHANGELOG

## 1.3.0 (2019/09/30)
* Add: Support [markdown-it-include](https://github.com/camelaissani/markdown-it-include)
    * Integrate markdown-it-include plugin [#138](https://github.com/yzane/vscode-markdown-pdf/pull/138)
    * Add: `markdown-pdf.markdown-it-include.enable` option
* Update: README

## 1.2.1 (2019/09/23)
* Fix: fix typo, grammar [#122](https://github.com/yzane/vscode-markdown-pdf/pull/122)
* Add: Option to specify the plantuml delimiter [#104](https://github.com/yzane/vscode-markdown-pdf/pull/104)
* Update: dependencies packages
* Update: README
   * Delete the description of the obsolete options.

## 1.2.0 (2018/05/03)
* Add: Support [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)
    * Support for lightweight diagrams (PlantUML) [#60](https://github.com/yzane/vscode-markdown-pdf/issues/60)

## 1.1.0 (2018/05/03)
* Add: Support [markdown-it-container](https://github.com/markdown-it/markdown-it-container) [#72](https://github.com/yzane/vscode-markdown-pdf/issues/72)

## 1.0.5 (2018/05/03)
* Improve: Exception handling
* Improve: Chromium install check
* Add: Page break
    * Is it possible to insert page breaks? [#25](https://github.com/yzane/vscode-markdown-pdf/issues/25)
* Update: README
    * FAQ: Page break
* Update: markdown-pdf.css
    * Add: Meiryo to font-family

## 1.0.4 (2018/05/01)
* Fix: Display error message when downloading Chromium
* Improve: Chromium install. Display download progress on status bar

## 1.0.3 (2018/04/30)
* Fix: Support [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces) with `markdown-pdf.styles` option
    * Japanese font is not good [#79](https://github.com/yzane/vscode-markdown-pdf/issues/79)
    * relative stylesheet paths are not working when multiple folders in workspace [#68](https://github.com/yzane/vscode-markdown-pdf/issues/68)
* Fix: `markdown-pdf.styles` option
    * [BUG] Custom PDF style not being used [#35](https://github.com/yzane/vscode-markdown-pdf/issues/35)
    * How to change font size of generated pdf [#40](https://github.com/yzane/vscode-markdown-pdf/issues/40)
    * How do you change font-family? [#64](https://github.com/yzane/vscode-markdown-pdf/issues/64)

* Improve: Support [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces) with `markdown-pdf.outputDirectory` option
    * How do I specify a relative output directory? [#29](https://github.com/yzane/vscode-markdown-pdf/issues/29)

* Fix: File encoding
    * Not correctly rendering Windows 1252 encoding [#39](https://github.com/yzane/vscode-markdown-pdf/issues/39)
    * First H1 header not recognized if file starts with UTF-8 BOM [#44](https://github.com/yzane/vscode-markdown-pdf/issues/44)

* Fix: Can not convert pdf [#76](https://github.com/yzane/vscode-markdown-pdf/issues/76)

* Add: `markdown-pdf.outputDirectoryRelativePathFile` option
* Add: `markdown-pdf.stylesRelativePathFile` option

## 1.0.2 (2018/04/24)
* Improve: puppeteer install [#76](https://github.com/yzane/vscode-markdown-pdf/issues/76), [#77](https://github.com/yzane/vscode-markdown-pdf/issues/77)

## 1.0.1 (2018/04/21)
* Add: Allow online (https) CSS in `markdown-pdf.styles` [#67](https://github.com/yzane/vscode-markdown-pdf/issues/67)

## 1.0.0 (2018/04/15)
* Change: Replace pdf converter with puppeteer instead of html-pdf
* Add: Support multiple types in markdown-pdf.type option
    * Add: Define Multiple outputformats [#20](https://github.com/yzane/vscode-markdown-pdf/issues/20)
* Add: Support markdown-it-named-headers
    * Fix: TOC extension not working on Convert Markdown to PDF [#31](https://github.com/yzane/vscode-markdown-pdf/issues/31)
* Add: Increase menu items (pdf, html, png, jpeg)
* Update: dependencies packages

## 0.1.8 (2018/03/22)
* Add: markdown-pdf.includeDefaultStyles option [#49](https://github.com/yzane/vscode-markdown-pdf/issues/49)
* Fix: Inline code blocks do not use a proportional font [#26](https://github.com/yzane/vscode-markdown-pdf/issues/26)
* Update: dependencies packages

## 0.1.7 (2017/04/05)
* Change: Display completion message on status bar [#19](https://github.com/yzane/vscode-markdown-pdf/issues/19)
* Add: markdown-pdf.convertOnSaveExclude option [#16](https://github.com/yzane/vscode-markdown-pdf/issues/16)
* Fix: broken code-blocks [#18](https://github.com/yzane/vscode-markdown-pdf/pull/18)
* Fix: Image path error [#14](https://github.com/yzane/vscode-markdown-pdf/issues/14)
* Update: [markdown.css](https://github.com/Microsoft/vscode/blob/master/extensions/markdown/media/markdown.css) of the vscode
* Update: dependencies packages

## 0.1.6 (2017/02/05)
* Fix: Relative path error of markdown-pdf.styles [#9](https://github.com/yzane/vscode-markdown-pdf/issues/9)
* Fix: Output file is not created [#10](https://github.com/yzane/vscode-markdown-pdf/issues/10)
* Add: markdown-pdf.outputDirectory option

## 0.1.5 (2017/01/09)

* Add: Support for relative path in markdown-pdf.styles option [#5](https://github.com/yzane/vscode-markdown-pdf/issues/5)
* Fix: ERROR: phantomjs binary does not exist [#2](https://github.com/yzane/vscode-markdown-pdf/issues/2)
* Update: README
* Add: CHANGELOG
* Update: dependencies packages

## 0.1.4 (2016/09/19)

* Add: markdown-pdf.convertOnSave option

## 0.1.3 (2016/08/29)

* Fix: Color of the inline code (`)

## 0.1.2 (2016/08/20)

* Add: Ability to convert markdown file from editor context
* Update: README

## 0.1.1 (2016/08/16)

* Add: Japanese README

## 0.1.0 (2016/08/14)

* Initial release.
