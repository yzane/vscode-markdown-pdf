# README レビュー実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2.0.0 リリース後の README レビューで洗い出した 15 件の修正を `README.md` と `README.ja.md` に反映し、README ダイアグラムおよびサンプルスナップショットを更新する。

**Architecture:** 変更はすべてドキュメントのみ。テストはなく、検証は既存の `npm run test:integration`・`npm run update-readme-diagrams`・`npm run sample` に依拠する。各タスクは意味のある粒度でコミットを分け、差分をレビューしやすくする。

**Tech Stack:** Markdown (README.md / README.ja.md)、npm scripts (vscode-test ベースの統合テストおよびサンプル生成)

---

## 前提

- 現在のブランチは `feature/readme-review` である。作業中にブランチを切り替えない。
- 本プランで使用する仕様書: `docs/superpowers/specs/20260411-04-readme-review-design.md`
- すべての編集対象ファイル:
  - `README.md` (英語版)
  - `README.ja.md` (日本語版)
  - `sample/README.pdf`, `sample/README.html`, `sample/README.png`, `sample/README.jpeg` (最終段で再生成)
- `package.json`・ソースコード・`test/` 配下のテストファイルは変更しない。
- 各タスクの最後にコミットを作成する。コミットメッセージは `docs:` プレフィックスで統一する。

## ファイル変更サマリー

| ファイル | 主な変更 |
|---|---|
| `README.md` | タイポ修正、URL 更新、"the each" → "each"、`Specification Changes` → `Breaking Changes in 2.0.0`、`Install` → `Chromium`、Features 表化、サブセクションリネーム、`Checkbox` / `Heading IDs` 追加 |
| `README.ja.md` | `Visutal` タイポ修正、`^` → `~`、URL 更新、`default:` 大小文字、空行追加、`markdown-it-checkbox` の built-in 表記、1.6.0 Release Notes 同期、`インストール` → `Chromium`、Features 表化、サブセクションリネーム、`Checkbox` / `Heading IDs` 追加 |
| `sample/README.*` | README 変更後に最終段で再生成 |

---

### Task 1: EN タイポ・文法修正 (Fix-8, Fix-10)

**対象:** `README.md` のタイポおよび英文法の修正のみ。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: `Oppening` を `Opening` に修正 (Fix-8)**

`README.md` の `markdown-pdf.plantumlOpenMarker` セクションを編集する:

Old:
```markdown
#### `markdown-pdf.plantumlOpenMarker`
  - Oppening delimiter used for the plantuml parser.
  - Default: @startuml
```

New:
```markdown
#### `markdown-pdf.plantumlOpenMarker`
  - Opening delimiter used for the plantuml parser.
  - Default: @startuml
```

- [ ] **Step 2: `the each root folder` を `each root folder` に修正 (Fix-10, 1 箇所目)**

`markdown-pdf.outputDirectory` セクションを編集する:

Old:
```markdown
    - If you open the `workspace`, it will be interpreted as a relative path from the each root folder
      - See [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)
```

New:
```markdown
    - If you open the `workspace`, it will be interpreted as a relative path from each root folder
      - See [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)
```

- [ ] **Step 3: `the each root folder` を `each root folder` に修正 (Fix-10, 2 箇所目)**

`markdown-pdf.styles` セクションの同じパターンを編集する:

Old:
```markdown
    - If you open the `workspace`, it will be interpreted as a relative path from the each root folder
      - See [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)
```

New:
```markdown
    - If you open the `workspace`, it will be interpreted as a relative path from each root folder
      - See [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)
```

注: Step 2 と Step 3 の Old/New は文字列として同一なので、1 つの Edit で `replace_all: true` を使う実装でも構わない。

- [ ] **Step 4: 変更を確認**

`README.md` を開き、以下を grep で 0 件であることを確認する:
- `Oppening`
- `from the each`

- [ ] **Step 5: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: fix typo and grammar in README.md

- Oppening → Opening in plantumlOpenMarker description
- from the each root folder → from each root folder (2 places)
EOF
)"
```

---

### Task 2: JA タイポ・空行修正 (Fix-9, Fix-14, Fix-15)

**対象:** `README.ja.md` の日本語版固有のタイポと空行欠落の修正。

**Files:**
- Modify: `README.ja.md`

- [ ] **Step 1: `Visutal` を `Visual` に修正 (Fix-9, 1 箇所目)**

`markdown-pdf.convertOnSave` セクションを編集する:

Old:
```markdown
#### `markdown-pdf.convertOnSave`
  - 保存時の自動変換を有効にします
  - boolean. Default: false
  - 設定の反映には、Visutal Studio Code の再起動が必要です
```

New:
```markdown
#### `markdown-pdf.convertOnSave`
  - 保存時の自動変換を有効にします
  - boolean. Default: false
  - 設定の反映には、Visual Studio Code の再起動が必要です
```

- [ ] **Step 2: `Visutal` を `Visual` に修正 (Fix-9, 2 箇所目)**

`markdown-pdf.executablePath` セクションを編集する:

Old:
```markdown
  - バンドルされた Chromium の代わりに実行する Google Chrome / Microsoft Edge / Chromium のパスを指定します
  - この設定がインストール済みブラウザの検出や管理済み Chromium のダウンロードとどう連携するかは、FAQ の [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) を参照してください
  - 全ての `\` は `\\` と記述する必要があります (Windows)
  - 設定の反映には、Visutal Studio Code の再起動が必要です
```

New:
```markdown
  - バンドルされた Chromium の代わりに実行する Google Chrome / Microsoft Edge / Chromium のパスを指定します
  - この設定がインストール済みブラウザの検出や管理済み Chromium のダウンロードとどう連携するかは、FAQ の [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) を参照してください
  - 全ての `\` は `\\` と記述する必要があります (Windows)
  - 設定の反映には、Visual Studio Code の再起動が必要です
```

- [ ] **Step 3: `convertOnSaveExclude` のコードブロック後に空行を追加 (Fix-14)**

`convertOnSaveExclude` のコードブロック閉じと次の見出しの間に空行を追加する:

Old:
```markdown
"markdown-pdf.convertOnSaveExclude": [
  "^work",
  "work.md$",
  "work|test",
  "[0-9][0-9][0-9][0-9]-work",
  "work\\test"  // 全ての \ は \\ と記述する必要があります。(Windows)
],
```
#### `markdown-pdf.outputDirectory`
```

New:
```markdown
"markdown-pdf.convertOnSaveExclude": [
  "^work",
  "work.md$",
  "work|test",
  "[0-9][0-9][0-9][0-9]-work",
  "work\\test"  // 全ての \ は \\ と記述する必要があります。(Windows)
],
```

#### `markdown-pdf.outputDirectory`
```

- [ ] **Step 4: `headerTemplate` のコードブロック後に空行を追加 (Fix-15)**

`headerTemplate` の最後のコードブロック閉じと `footerTemplate` 見出しの間に空行を追加する:

Old:
```markdown
    "markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \"> <span class='date'></span></div>",
    ```
#### `markdown-pdf.footerTemplate`
```

New:
```markdown
    "markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \"> <span class='date'></span></div>",
    ```

#### `markdown-pdf.footerTemplate`
```

- [ ] **Step 5: 変更を確認**

`README.ja.md` 内に `Visutal` が 0 件であることを確認する。

- [ ] **Step 6: コミット**

```bash
git add README.ja.md
git commit -m "$(cat <<'EOF'
docs: fix typo and spacing in README.ja.md

- Visutal → Visual (2 places)
- Add blank lines before headings after code blocks (2 places)
EOF
)"
```

---

### Task 3: URL・文字修正 (Fix-2, Fix-5, Fix-11, Fix-12)

**対象:** EN/JA 両方の URL、ホームディレクトリ記号、Default 大小文字の修正。

**Files:**
- Modify: `README.md`
- Modify: `README.ja.md`

- [ ] **Step 1: EN - PNG/JPEG puppeteer screenshot URL を更新 (Fix-2)**

`README.md` の PNG, JPEG options セクションを編集する:

Old:
```markdown
### PNG, JPEG options

  - png and jpeg only. [puppeteer page.screenshot options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagescreenshotoptions)
```

New:
```markdown
### PNG, JPEG options

  - png and jpeg only. [puppeteer page.screenshot options](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.screenshotoptions.md)
```

- [ ] **Step 2: JA - PNG/JPEG puppeteer screenshot URL を更新 (Fix-2)**

`README.ja.md` の PNG, JPEG options セクションを編集する:

Old:
```markdown
### PNG, JPEG options

  - png and jpeg only. [puppeteer page.screenshot options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagescreenshotoptions)
```

New:
```markdown
### PNG, JPEG options

  - png and jpeg only. [puppeteer page.screenshot options](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.screenshotoptions.md)
```

- [ ] **Step 3: 新 URL が実在することを検証**

ブラウザ (または `curl -I`) で `https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.screenshotoptions.md` が 200 を返すことを確認する。

```bash
curl -sI https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.screenshotoptions.md | head -1
```

Expected: `HTTP/2 200` (または `HTTP/1.1 200 OK`)

**404 の場合の対応:** `https://github.com/puppeteer/puppeteer/tree/main/docs/api` を開き、`screenshotoptions` を含むドキュメントページを特定し、そのパスに差し替える。差し替えたら Step 1・Step 2 を該当 URL でやり直す。

- [ ] **Step 4: JA - ホームディレクトリ相対パスの記号を修正 (Fix-5)**

`README.ja.md` の `markdown-pdf.outputDirectory` セクションを編集する:

Old:
```markdown
  - 相対パス (ホームディレクトリ)
    - パスが `^` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます

```javascript
"markdown-pdf.outputDirectory": "~/output",
```

New:
```markdown
  - 相対パス (ホームディレクトリ)
    - パスが `~` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます

```javascript
"markdown-pdf.outputDirectory": "~/output",
```

注: `markdown-pdf.styles` セクションにも同様の記述があるか確認し、あれば同じ修正を適用する。

- [ ] **Step 5: JA - `markdown-pdf.styles` のホームディレクトリ記号を確認**

`README.ja.md` で `markdown-pdf.styles` セクション配下の「ホームディレクトリ」に関する記述を確認し、`^` が使われていれば Step 4 と同じ修正を適用する。

Old (該当した場合):
```markdown
  - 相対パス (ホームディレクトリ)
    - パスが `^` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます
```

New:
```markdown
  - 相対パス (ホームディレクトリ)
    - パスが `~` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます
```

- [ ] **Step 6: EN - emoji cheat sheet URL を webfx.com に更新 (Fix-11)**

`README.md` の Emoji options セクションを編集する:

Old:
```markdown
#### `markdown-pdf.emoji`
  - Enable emoji. [EMOJI CHEAT SHEET](https://www.webpagefx.com/tools/emoji-cheat-sheet/)
  - boolean. Default: true
```

New:
```markdown
#### `markdown-pdf.emoji`
  - Enable emoji. [EMOJI CHEAT SHEET](https://www.webfx.com/tools/emoji-cheat-sheet/)
  - boolean. Default: true
```

- [ ] **Step 7: JA - emoji cheat sheet URL を webfx.com に更新 (Fix-11)**

`README.ja.md` の Emoji options セクションを編集する:

Old:
```markdown
#### `markdown-pdf.emoji`
  - 絵文字を有効にします [EMOJI CHEAT SHEET](https://www.webpagefx.com/tools/emoji-cheat-sheet/)
  - boolean. Default: true
```

New:
```markdown
#### `markdown-pdf.emoji`
  - 絵文字を有効にします [EMOJI CHEAT SHEET](https://www.webfx.com/tools/emoji-cheat-sheet/)
  - boolean. Default: true
```

- [ ] **Step 8: EN - `markdown-pdf.scale` の Default 大小文字 (Fix-12)**

`README.md` の Common Options セクションを編集する:

Old:
```markdown
#### `markdown-pdf.scale`
  - Scale of the page rendering
  - number. default: 1
```

New:
```markdown
#### `markdown-pdf.scale`
  - Scale of the page rendering
  - number. Default: 1
```

- [ ] **Step 9: JA - `markdown-pdf.scale` の Default 大小文字 (Fix-12)**

`README.ja.md` の Common Options セクションを編集する:

Old:
```markdown
#### `markdown-pdf.scale`
  - ページレンダリングのスケール
  - number. default: 1
```

New:
```markdown
#### `markdown-pdf.scale`
  - ページレンダリングのスケール
  - number. Default: 1
```

- [ ] **Step 10: 変更を確認**

両 README で以下が 0 件であることを確認する:
- `webpagefx.com`
- `GoogleChrome/puppeteer`
- `number. default:`

`README.ja.md` で以下が 0 件であることを確認する:
- `パスが \`^\` で始まっている`

- [ ] **Step 11: コミット**

```bash
git add README.md README.ja.md
git commit -m "$(cat <<'EOF'
docs: update stale URLs and minor inconsistencies

- Update puppeteer screenshot docs URL to puppeteer/puppeteer on main
- Fix home directory prefix symbol in README.ja.md (^ → ~)
- Update emoji cheat sheet URL to webfx.com
- Normalize Default casing in markdown-pdf.scale
EOF
)"
```

---

### Task 4: JA 1.6.0 Release Notes 同期 (Fix-7)

**対象:** `README.ja.md` の 1.6.0 Release Notes に不足している Refactor 行を追加する。

**Files:**
- Modify: `README.ja.md`

- [ ] **Step 1: EN 側の 1.6.0 Release Notes を確認**

`README.md` の 1.6.0 エントリを開き、現在の文言を確認する (参考):

```markdown
### 1.6.0 (2025/04/15)
* Refactor: replace external checkbox and named-header markdown-it packages with built-in implementations
* Fix: Allow underscores in section header identifiers [#404](https://github.com/yzane/vscode-markdown-pdf/pull/404)
* Update: use GitHub-compatible [VS Code slug generation](https://github.com/microsoft/vscode/blob/c07cee3039c8ea6e9bab02645599ec9e7796fd4c/extensions/markdown-language-features/src/slugify.ts#L27) for heading identifiers
```

- [ ] **Step 2: JA の 1.6.0 Release Notes に Refactor 行を追加**

`README.ja.md` の 1.6.0 エントリを編集する:

Old:
```markdown
### 1.6.0 (2025/04/15)
* Fix: Allow underscores in section header identifiers [#404](https://github.com/yzane/vscode-markdown-pdf/pull/404)
* Update: align slug generation with [latest VSCode behavior](https://github.com/microsoft/vscode/blob/c07cee3039c8ea6e9bab02645599ec9e7796fd4c/extensions/markdown-language-features/src/slugify.ts#L27)
```

New:
```markdown
### 1.6.0 (2025/04/15)
* Refactor: 外部 checkbox / named-header の markdown-it パッケージを内製実装に置換
* Fix: Allow underscores in section header identifiers [#404](https://github.com/yzane/vscode-markdown-pdf/pull/404)
* Update: align slug generation with [latest VSCode behavior](https://github.com/microsoft/vscode/blob/c07cee3039c8ea6e9bab02645599ec9e7796fd4c/extensions/markdown-language-features/src/slugify.ts#L27)
```

- [ ] **Step 3: コミット**

```bash
git add README.ja.md
git commit -m "$(cat <<'EOF'
docs: sync 1.6.0 release notes between README.md and README.ja.md

Add missing Refactor bullet to README.ja.md to match README.md.
EOF
)"
```

---

### Task 5: EN `Specification Changes` → `Breaking Changes in 2.0.0` (Fix-17)

**対象:** `README.md` のみ。JA 側の「仕様変更」見出しは現状維持。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: TOC の該当エントリを更新**

`README.md` の目次 (`## Table of Contents` 直下) を編集する:

Old:
```markdown
- [Specification Changes](#specification-changes)
- [Features](#features)
```

New:
```markdown
- [Breaking Changes in 2.0.0](#breaking-changes-in-200)
- [Features](#features)
```

- [ ] **Step 2: セクション見出しを変更**

`README.md` の該当見出しを編集する:

Old:
```markdown
## Specification Changes

Version 2.0.0 introduces changes that may affect existing behavior. See the [FAQ](#faq) section for details.
```

New:
```markdown
## Breaking Changes in 2.0.0

Version 2.0.0 introduces changes that may affect existing behavior. See the [FAQ](#faq) section for details.
```

- [ ] **Step 3: 他のセクションから `#specification-changes` への参照がないことを確認**

`README.md` 内で `#specification-changes` を grep し、0 件であることを確認する。1 件以上ある場合は、そのリンクを `#breaking-changes-in-200` に修正する。

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: rename Specification Changes to Breaking Changes in 2.0.0

The old heading sounds like protocol spec changes in English.
Breaking Changes better reflects the section's actual content.
Japanese heading (仕様変更) remains unchanged.
EOF
)"
```

---

### Task 6: EN `Install` → `Chromium` リネーム (Fix-16)

**対象:** `README.md` のみ。JA 側は Task 7 で対応する。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: TOC の該当エントリを更新**

Old:
```markdown
- [Install](#install)
- [Usage](#usage)
```

New:
```markdown
- [Chromium](#chromium)
- [Usage](#usage)
```

- [ ] **Step 2: セクション見出しと `### Chromium resolution` サブセクションを統合**

Old:
```markdown
## Install

### Chromium resolution

Markdown PDF uses a Chromium-based browser for PDF/PNG/JPEG export. It tries the following sources in order:

1. The path specified in [markdown-pdf.executablePath](#markdown-pdfexecutablepath)
2. An installed Google Chrome, Microsoft Edge, or Chromium on your system
3. A managed Chromium automatically downloaded on first use

See [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) and [Where is Chromium downloaded?](#where-is-chromium-downloaded) in the FAQ for details.

If you are behind a proxy, set the `http.proxy` option in settings.json and restart Visual Studio Code.
```

New:
```markdown
## Chromium

Markdown PDF uses a Chromium-based browser for PDF/PNG/JPEG export. It tries the following sources in order:

1. The path specified in [markdown-pdf.executablePath](#markdown-pdfexecutablepath)
2. An installed Google Chrome, Microsoft Edge, or Chromium on your system
3. A managed Chromium automatically downloaded on first use

See [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) and [Where is Chromium downloaded?](#where-is-chromium-downloaded) in the FAQ for details.

If you are behind a proxy, set the `http.proxy` option in settings.json and restart Visual Studio Code.
```

- [ ] **Step 3: 他のセクションから `#install` / `#chromium-resolution` への参照がないことを確認**

`README.md` 内で `#install` と `#chromium-resolution` を grep し、0 件であることを確認する。存在する場合は `#chromium` に修正する。

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: rename Install section to Chromium in README.md

The section only describes Chromium resolution, not extension
installation. Rename to match its actual content and merge the
redundant Chromium resolution subsection into the section body.
EOF
)"
```

---

### Task 7: JA `インストール` → `Chromium` リネーム (Fix-16)

**対象:** `README.ja.md` のみ。

**Files:**
- Modify: `README.ja.md`

- [ ] **Step 1: TOC の該当エントリを更新**

Old:
```markdown
- [インストール](#インストール)
- [使い方](#使い方)
```

New:
```markdown
- [Chromium](#chromium)
- [使い方](#使い方)
```

- [ ] **Step 2: セクション見出しと `### Chromium の解決` サブセクションを統合**

Old:
```markdown
## インストール

### Chromium の解決

Markdown PDF は PDF/PNG/JPEG エクスポートに Chromium ベースのブラウザを使用します。以下の順番で解決を試みます:

1. [markdown-pdf.executablePath](#markdown-pdfexecutablepath) で指定されたパス
2. システムにインストール済みの Google Chrome / Microsoft Edge / Chromium
3. 初回使用時に自動ダウンロードされる管理済み Chromium

詳細は FAQ の [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) および [Where is Chromium downloaded?](#where-is-chromium-downloaded) を参照してください。

プロキシ経由で接続している場合は、settings.json に `http.proxy` オプションを設定し、Visual Studio Code を再起動してください。
```

New:
```markdown
## Chromium

Markdown PDF は PDF/PNG/JPEG エクスポートに Chromium ベースのブラウザを使用します。以下の順番で解決を試みます:

1. [markdown-pdf.executablePath](#markdown-pdfexecutablepath) で指定されたパス
2. システムにインストール済みの Google Chrome / Microsoft Edge / Chromium
3. 初回使用時に自動ダウンロードされる管理済み Chromium

詳細は FAQ の [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) および [Where is Chromium downloaded?](#where-is-chromium-downloaded) を参照してください。

プロキシ経由で接続している場合は、settings.json に `http.proxy` オプションを設定し、Visual Studio Code を再起動してください。
```

- [ ] **Step 3: 他のセクションから `#インストール` への参照がないことを確認**

`README.ja.md` 内で `#インストール` を grep し、0 件であることを確認する。

- [ ] **Step 4: コミット**

```bash
git add README.ja.md
git commit -m "$(cat <<'EOF'
docs: rename インストール section to Chromium in README.ja.md

Mirror the rename from README.md. The section content is about
Chromium resolution, not extension installation.
EOF
)"
```

---

### Task 8: EN Features 箇条書きを 3 列表に置換 (Fix-18 a)

**対象:** `README.md` の Features 箇条書きを表に置き換える。サブセクション (INPUT/OUTPUT 例) は次タスク以降で扱う。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Features 箇条書きを表に置換**

Old:
```markdown
## Features

Supports the following features
* [Syntax highlighting](https://highlightjs.org/demo)
* [emoji](https://www.webfx.com/tools/emoji-cheat-sheet/)
* Built-in checkbox syntax support (custom markdown-it plugin)
* Built-in heading IDs with GitHub-compatible slug generation
* [markdown-it-container](https://github.com/markdown-it/markdown-it-container)
* [markdown-it-include](https://github.com/camelaissani/markdown-it-include)
* [PlantUML](https://plantuml.com/)
  * [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)
* [mermaid](https://mermaid-js.github.io/mermaid/)

Sample files
 * [pdf](sample/README.pdf)
 * [html](sample/README.html)
 * [png](sample/README.png)
 * [jpeg](sample/README.jpeg)
```

New:
```markdown
## Features

| Feature | Description | Example |
|---|---|---|
| [Syntax highlighting](https://highlightjs.org/demo) | Code block highlighting via highlight.js | ` ```js ` |
| [Emoji](https://www.webfx.com/tools/emoji-cheat-sheet/) | Emoji shortcodes | `:smile:` |
| Checkbox | GitHub-style task lists (built-in custom plugin) | `- [ ]` / `- [x]` |
| Heading IDs | GitHub-compatible heading anchors (built-in custom plugin) | `# Heading` → `#heading` |
| [Container](https://github.com/markdown-it/markdown-it-container) | Admonition-like blocks | `::: warning` |
| Include | Embed Markdown fragments (built-in custom plugin) | `:[label](path.md)` |
| [PlantUML](https://plantuml.com/) | UML diagrams from code blocks | `@startuml` … `@enduml` |
| [Mermaid](https://mermaid-js.github.io/mermaid/) | Diagrams from fenced code blocks | ` ```mermaid ` |

Sample files
 * [pdf](sample/README.pdf)
 * [html](sample/README.html)
 * [png](sample/README.png)
 * [jpeg](sample/README.jpeg)
```

注: これで Fix-3 (markdown-it-include を built-in 表記に) も同時に反映される。

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: convert English Features list to table format

Organize by notation rather than markdown-it plugin name so that
built-in custom plugins and external plugins can be listed in a
unified way. This also corrects the markdown-it-include entry to
indicate it is now a built-in custom plugin.
EOF
)"
```

---

### Task 9: EN Features サブセクションをリネーム (Fix-18 b)

**対象:** `README.md` の Features 配下のサブセクション見出しをプラグイン名から記法名に変更する。INPUT/OUTPUT 例自体は変更しない。ただし `### PlantUML` には導入テキストを追加する。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: `### markdown-it-container` を `### Container` にリネーム**

Old:
```markdown
### markdown-it-container

INPUT
```

New:
```markdown
### Container

INPUT
```

- [ ] **Step 2: `### markdown-it-plantuml` を `### PlantUML` にリネームし、導入テキストを追加**

Old:
```markdown
### markdown-it-plantuml

INPUT
```
@startuml
```

New:
```markdown
### PlantUML

Render UML diagrams via [PlantUML](https://plantuml.com/) using [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml).

INPUT
```
@startuml
```

- [ ] **Step 3: `### markdown-it-include` を `### Include` にリネーム**

Old:
```markdown
### markdown-it-include

Include markdown fragment files: `:[alternate-text](relative-path-to-file.md)`.
```

New:
```markdown
### Include

Include markdown fragment files: `:[alternate-text](relative-path-to-file.md)`.
```

- [ ] **Step 4: `### mermaid` を `### Mermaid` にリネーム**

Old:
```markdown
### mermaid

INPUT
```

New:
```markdown
### Mermaid

INPUT
```

- [ ] **Step 5: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: rename Features subsections to notation names in README.md

Rename markdown-it-container/plantuml/include/mermaid to Container,
PlantUML, Include, Mermaid. Add intro line for PlantUML that links
to both the upstream tool and the markdown-it-plantuml plugin.
EOF
)"
```

---

### Task 10: EN `Checkbox` / `Heading IDs` サブセクション追加 (Fix-18 c, Fix-19)

**対象:** `README.md` に 2 つの新規サブセクションを追加する。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: `### Checkbox` サブセクションを追加**

`### Container` の直前に追加する:

Old:
```markdown
### Container

INPUT
```

New:
```markdown
### Checkbox

INPUT
```
- [ ] Task A
- [x] Task B
```

OUTPUT
```html
<ul>
  <li><input type="checkbox" disabled> Task A</li>
  <li><input type="checkbox" disabled checked> Task B</li>
</ul>
```

### Container

INPUT
```

注: 実装時には既存の `### markdown-it-container` セクション (INPUT/OUTPUT の 3 バックティックフェンス形式) に倣って追加する。

- [ ] **Step 2: `### Heading IDs` サブセクションを追加**

`### Checkbox` の直前 (Features 表のすぐ下、Sample files の後) に追加する:

Old:
```markdown
 * [jpeg](sample/README.jpeg)

### Checkbox
```

New:
```markdown
 * [jpeg](sample/README.jpeg)

### Heading IDs

Headings automatically receive GitHub-compatible anchor IDs. For example:

| Heading | Generated ID |
|---|---|
| `# My Heading` | `#my-heading` |
| `# API Reference` | `#api-reference` |
| `# 日本語見出し` | `#日本語見出し` |

See [Why did my heading anchors change?](#why-did-my-heading-anchors-change) in the FAQ for details.

### Checkbox
```

- [ ] **Step 3: 追加した 2 サブセクションのアンカーを確認**

`README.md` をプレビューで開き、以下のアンカーが正しく生成されることを確認する:
- `#checkbox`
- `#heading-ids`

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add Checkbox and Heading IDs subsections to README.md

Checkbox documents the built-in GitHub-style task list syntax.
Heading IDs shows the anchor generation examples and links to the
2.0.0 FAQ entry explaining the slug change.
EOF
)"
```

---

### Task 11: JA Features 箇条書きを 3 列表に置換 (Fix-18 a, Fix-6)

**対象:** `README.ja.md` の Features 箇条書きを表に置き換える。この変更で Fix-6 (`markdown-it-checkbox` を built-in 表記に)、`Built-in checkbox` / `Built-in heading IDs` の JA 側欠落 (Fix-19 の一部) も同時に解消される。

**Files:**
- Modify: `README.ja.md`

- [ ] **Step 1: Features 箇条書きを表に置換**

Old:
```markdown
## 機能

以下の機能をサポートしています。
* [Syntax highlighting](https://highlightjs.org/demo)
* [emoji](https://www.webfx.com/tools/emoji-cheat-sheet/)
* [markdown-it-checkbox](https://github.com/mcecot/markdown-it-checkbox)
* [markdown-it-container](https://github.com/markdown-it/markdown-it-container)
* [markdown-it-include](https://github.com/camelaissani/markdown-it-include)
* [PlantUML](https://plantuml.com/)
  * [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)
* [mermaid](https://mermaid-js.github.io/mermaid/)

サンプルファイル
 * [pdf](sample/README.pdf)
 * [html](sample/README.html)
 * [png](sample/README.png)
 * [jpeg](sample/README.jpeg)
```

New:
```markdown
## 機能

| 機能 | 説明 | 記法例 |
|---|---|---|
| [Syntax highlighting](https://highlightjs.org/demo) | highlight.js によるコードブロックのハイライト | ` ```js ` |
| [Emoji](https://www.webfx.com/tools/emoji-cheat-sheet/) | 絵文字ショートコード | `:smile:` |
| Checkbox | GitHub 形式のタスクリスト (内製カスタムプラグイン) | `- [ ]` / `- [x]` |
| Heading IDs | GitHub 互換の見出しアンカー生成 (内製カスタムプラグイン) | `# 見出し` → `#見出し` |
| [Container](https://github.com/markdown-it/markdown-it-container) | 注記ブロック | `::: warning` |
| Include | Markdown フラグメントの埋め込み (内製カスタムプラグイン) | `:[label](path.md)` |
| [PlantUML](https://plantuml.com/) | コードブロックから UML 図を生成 | `@startuml` … `@enduml` |
| [Mermaid](https://mermaid-js.github.io/mermaid/) | フェンスドコードブロックから図を生成 | ` ```mermaid ` |

サンプルファイル
 * [pdf](sample/README.pdf)
 * [html](sample/README.html)
 * [png](sample/README.png)
 * [jpeg](sample/README.jpeg)
```

- [ ] **Step 2: コミット**

```bash
git add README.ja.md
git commit -m "$(cat <<'EOF'
docs: convert Japanese Features list to table format

Mirror the English change. This also corrects markdown-it-checkbox
to the built-in custom plugin description and adds the previously
missing Checkbox / Heading IDs entries.
EOF
)"
```

---

### Task 12: JA Features サブセクションをリネーム (Fix-18 b)

**対象:** `README.ja.md` の Features 配下のサブセクション見出しをリネームし、`### PlantUML` に導入テキストを追加する。

**Files:**
- Modify: `README.ja.md`

- [ ] **Step 1: `### markdown-it-container` を `### Container` にリネーム**

Old:
```markdown
### markdown-it-container

INPUT
```

New:
```markdown
### Container

INPUT
```

- [ ] **Step 2: `### markdown-it-plantuml` を `### PlantUML` にリネームし、導入テキストを追加**

Old:
```markdown
### markdown-it-plantuml

INPUT
```
@startuml
```

New:
```markdown
### PlantUML

[markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml) を使って [PlantUML](https://plantuml.com/) の UML 図を生成します。

INPUT
```
@startuml
```

- [ ] **Step 3: `### markdown-it-include` を `### Include` にリネーム**

Old:
```markdown
### markdown-it-include

Include markdown fragment files: `:[alternate-text](relative-path-to-file.md)`.
```

New:
```markdown
### Include

Include markdown fragment files: `:[alternate-text](relative-path-to-file.md)`.
```

- [ ] **Step 4: `### mermaid` を `### Mermaid` にリネーム**

Old:
```markdown
### mermaid

INPUT
```

New:
```markdown
### Mermaid

INPUT
```

- [ ] **Step 5: コミット**

```bash
git add README.ja.md
git commit -m "$(cat <<'EOF'
docs: rename Features subsections to notation names in README.ja.md

Mirror the English change. Add intro line for PlantUML that links
to both the upstream tool and the markdown-it-plantuml plugin.
EOF
)"
```

---

### Task 13: JA `Checkbox` / `Heading IDs` サブセクション追加 (Fix-18 c, Fix-19)

**対象:** `README.ja.md` に 2 つの新規サブセクションを追加する。

**Files:**
- Modify: `README.ja.md`

- [ ] **Step 1: `### Checkbox` サブセクションを追加**

`### Container` の直前に追加する:

Old:
```markdown
### Container

INPUT
```

New:
```markdown
### Checkbox

INPUT
```
- [ ] タスク A
- [x] タスク B
```

OUTPUT
```html
<ul>
  <li><input type="checkbox" disabled> タスク A</li>
  <li><input type="checkbox" disabled checked> タスク B</li>
</ul>
```

### Container

INPUT
```

- [ ] **Step 2: `### Heading IDs` サブセクションを追加**

Sample files の後、`### Checkbox` の直前に追加する:

Old:
```markdown
 * [jpeg](sample/README.jpeg)

### Checkbox
```

New:
```markdown
 * [jpeg](sample/README.jpeg)

### Heading IDs

見出しには GitHub 互換のアンカー ID が自動的に付与されます。例:

| 見出し | 生成される ID |
|---|---|
| `# My Heading` | `#my-heading` |
| `# API リファレンス` | `#api-リファレンス` |
| `# 日本語見出し` | `#日本語見出し` |

詳細は FAQ の [見出しのアンカーが変わったのはなぜ？](#why-did-my-heading-anchors-change) を参照してください。

### Checkbox
```

- [ ] **Step 3: 追加した 2 サブセクションのアンカーを確認**

`README.ja.md` をプレビューで開き、以下のアンカーが正しく生成されることを確認する:
- `#checkbox`
- `#heading-ids`

`#why-did-my-heading-anchors-change` は JA FAQ 内の既存 `<a id="why-did-my-heading-anchors-change"></a>` が受け止めるため正しくリンクする。

- [ ] **Step 4: コミット**

```bash
git add README.ja.md
git commit -m "$(cat <<'EOF'
docs: add Checkbox and Heading IDs subsections to README.ja.md

Mirror the English addition. Heading IDs links to the existing
Japanese FAQ anchor for the slug generation change.
EOF
)"
```

---

### Task 14: 全体のリンク・アンカー検証

**対象:** 両 README の内部リンクがすべて有効であることを確認する。

**Files:**
- Verify: `README.md`
- Verify: `README.ja.md`

- [ ] **Step 1: TOC の全エントリがセクション見出しと一致することを確認**

`README.md` の TOC を開き、各エントリのアンカーが実在するセクション見出しを指していることを目視確認する:
- `#breaking-changes-in-200` → `## Breaking Changes in 2.0.0`
- `#features` → `## Features`
- `#chromium` → `## Chromium`
- `#usage` → `## Usage`
- `#extension-settings` → `## Extension Settings`
- `#options` → `## Options`
- `#faq` → `## FAQ`
- `#known-issues` → `## Known Issues`
- `#release-notes` → `## [Release Notes](CHANGELOG.md)`
- `#license` → `## License`
- `#special-thanks` → `## Special thanks`

`README.ja.md` の TOC についても同様に確認する。

- [ ] **Step 2: `### PlantUML` の導入テキスト内リンクを確認**

`README.md` および `README.ja.md` の `### PlantUML` サブセクションに以下の 2 リンクが存在することを確認する:
- `https://plantuml.com/`
- `https://github.com/gmunguia/markdown-it-plantuml`

- [ ] **Step 3: 旧アンカーが残っていないことを確認**

両 README で以下を grep し、0 件であることを確認する:
- `#install`
- `#specification-changes` (README.md のみ)
- `#chromium-resolution`
- `#markdown-it-container`
- `#markdown-it-include`
- `#markdown-it-plantuml`
- `#mermaid` (ただし `### Mermaid` のアンカー `#mermaid` は正常。リネーム後のアンカーも同じ `#mermaid` になるため、TOC や他セクションからの参照があっても有効。念のため確認のみ)

- [ ] **Step 4: VS Code でプレビューを開き目視確認**

`README.md` と `README.ja.md` を VS Code のマークダウンプレビューで開き、以下を確認する:
- 表が正しくレンダリングされる
- コードブロック内のコードブロック (INPUT/OUTPUT) が崩れない
- Features 表、Options 表、Heading IDs 表がすべて崩れない
- 各見出しのアンカーリンクがクリックで正しくジャンプする

- [ ] **Step 5: 修正が必要な場合は該当箇所を編集しコミット**

Step 1-4 で問題が見つかった場合のみ実施する。問題がなければこの Step はスキップする。

```bash
git add README.md README.ja.md
git commit -m "$(cat <<'EOF'
docs: fix leftover anchor references after README restructure
EOF
)"
```

---

### Task 15: README ダイアグラムの再生成

**対象:** README 内で PlantUML / mermaid ダイアグラムを埋め込んでいる箇所の出力画像 (images/PlantUML.png, images/mermaid.png など) を最新の README 内容で再生成する。

**Files:**
- Potentially modify: `images/PlantUML.png`, `images/mermaid.png`, その他 README ダイアグラム関連の画像ファイル

- [ ] **Step 1: README ダイアグラム生成スクリプトを実行**

```bash
npm run update-readme-diagrams
```

Expected: スクリプトが正常終了する。`images/` 配下の README ダイアグラム画像が更新される可能性がある。

- [ ] **Step 2: 差分を確認**

```bash
git status
git diff --stat
```

ダイアグラム画像に意味のある変更が入っているか確認する。README の `### PlantUML` / `### Mermaid` サブセクション内の INPUT は本タスクでは変更していないので、画像に差分が出ない可能性が高い。差分がなければ Step 3-4 はスキップする。

- [ ] **Step 3: 差分がある場合はコミット**

```bash
git add images/
git commit -m "$(cat <<'EOF'
docs: refresh README diagrams after Features restructure
EOF
)"
```

- [ ] **Step 4: 統合テストを実行**

```bash
npm run test:integration
```

Expected: すべてのテストが PASS する。README ダイアグラム関連のテストが落ちる場合は、Step 1-3 の差分を確認する。

---

### Task 16: サンプル PDF/HTML/PNG/JPEG の再生成

**対象:** `sample/README.pdf`, `sample/README.html`, `sample/README.png`, `sample/README.jpeg` を最新の README 内容で再生成する。

**Files:**
- Modify: `sample/README.pdf`, `sample/README.html`, `sample/README.png`, `sample/README.jpeg`

- [ ] **Step 1: サンプル生成スクリプトを実行**

```bash
npm run sample
```

Expected: スクリプトが正常終了し、`sample/README.*` が新しい README から生成される。

- [ ] **Step 2: 差分を確認**

```bash
git status
git diff --stat sample/
```

サンプル画像・PDF・HTML に意味のある変更が入っていることを確認する。README の構成が大きく変わっているため、差分は確実に発生する。

- [ ] **Step 3: HTML を開いて目視確認**

`sample/README.html` をブラウザで開き、以下を確認する:
- Features 表が正しくレンダリングされる
- `## Chromium` セクションが正しく表示される
- `## Breaking Changes in 2.0.0` (EN) が正しく表示される
- `### Checkbox`, `### Heading IDs`, `### Container`, `### Include`, `### PlantUML`, `### Mermaid` サブセクションが正しく表示される
- TOC のリンクがすべて有効

- [ ] **Step 4: コミット**

```bash
git add sample/
git commit -m "$(cat <<'EOF'
docs: refresh README samples for 2.0.0 review fixes
EOF
)"
```

---

### Task 17: 最終検証

**対象:** feature ブランチ全体の変更内容を確認し、develop へのマージ準備をする。

- [ ] **Step 1: develop からの差分を俯瞰**

```bash
git log develop..HEAD --oneline
```

Expected: Task 1-16 のコミットが順に並んでいる (16 個程度)。

- [ ] **Step 2: 変更ファイルの範囲を確認**

```bash
git diff develop..HEAD --stat
```

Expected: 変更対象が以下に限定されていること:
- `README.md`
- `README.ja.md`
- `docs/superpowers/specs/20260411-04-readme-review-design.md`
- `docs/superpowers/plans/20260411-04-readme-review.md` (このファイル自体)
- `sample/README.pdf`, `sample/README.html`, `sample/README.png`, `sample/README.jpeg`
- (必要に応じて) `images/` 配下の README ダイアグラム画像

想定外のファイルが含まれている場合は原因を調査する。

- [ ] **Step 3: 統合テストを再実行**

```bash
npm run test:integration
```

Expected: すべての統合テストが PASS する。

- [ ] **Step 4: 仕様書との最終照合**

`docs/superpowers/specs/20260411-04-readme-review-design.md` を開き、15 件の Fix がすべて実装されていることを確認する:

- [ ] Fix-2: puppeteer screenshot URL
- [ ] Fix-3: markdown-it-include built-in 表記 (EN)
- [ ] Fix-5: JA ホームディレクトリ `^` → `~`
- [ ] Fix-6: JA markdown-it-checkbox built-in 表記
- [ ] Fix-7: JA 1.6.0 Release Notes Refactor 行追加
- [ ] Fix-8: EN Oppening → Opening
- [ ] Fix-9: JA Visutal → Visual
- [ ] Fix-10: EN the each → each
- [ ] Fix-11: emoji URL webfx.com
- [ ] Fix-12: markdown-pdf.scale Default 大小文字
- [ ] Fix-14: JA 空行 (convertOnSaveExclude 後)
- [ ] Fix-15: JA 空行 (headerTemplate 後)
- [ ] Fix-16: Install → Chromium リネーム
- [ ] Fix-17: EN Specification Changes → Breaking Changes in 2.0.0
- [ ] Fix-18: Features 表化とサブセクションリネーム
- [ ] Fix-19: Heading IDs サブセクション追加 / JA 機能表同期

- [ ] **Step 5: プラン完了メモ**

すべての Fix が実装済みであることを確認したら、本プランの実行は完了である。次の段階 (develop へのマージ / PR 作成) はユーザーの指示を待つ。
