# ソースコードへの最低限コメント追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/*.ts` 6 ファイルに、ファイルヘッダ・`export` 関数の 1 行 JSDoc・非自明ロジックの Why コメントを英語で追加する。既存コメントは変更しない。挙動は一切変更しない。

**Architecture:** 小さいファイルから順に 1 ファイル = 1 コミットで処理する。各タスクは「編集 → `npm run check` で型チェック → コミット」の 3 ステップ。全ファイル完了後に `npm test` とセルフレビューを行い、必要なら修正コミットを追加してマージする。

**Tech Stack:** TypeScript / esbuild / tsc / VS Code Extension API / markdown-it / puppeteer-core

**Spec:** `docs/superpowers/specs/20260410-02-source-comments-design.md`

**Branch:** `feature/source-comments`（作成済み）

---

## 前提事項と書式ルールの再掲

全タスク共通で以下に従うこと。仕様書 `docs/superpowers/specs/20260410-02-source-comments-design.md` と同内容だが、実装時に参照しやすいよう再掲する。

### ルール A: ファイルヘッダ

各 `src/*.ts` の 1 行目（`import` より前）に `//` コメントでファイルの責務を 1〜3 行記述する。`@file` JSDoc タグは使わない。

### ルール B: `export` 関数への JSDoc

すべての `export function` の直前に 1 行 JSDoc を付ける。書式は `/** <三人称単数現在形の動詞>... . */` で、末尾はピリオド。`@param`・`@returns` は原則書かない。例外条件（I/O 副作用、戻り値が多義的、呼び出し順序制約）があるときのみ複数行で補足する。

### ルール C: Why コメント

以下のいずれかに該当する箇所にのみ `// Why: <理由>.` 形式で 1〜2 行付ける。

1. プラットフォーム分岐
2. 意図が非自明な正規表現
3. ワークアラウンド / ハック / CJS-ESM 境界
4. 外部仕様への依存
5. パフォーマンスのための非直感的書き方

### 共通

- すべて英語。絵文字禁止。
- 既存のコメント（`// check active window`、ブロック説明、JSDoc など）は削除も書き換えもしない。
- 既存コメントと新規 JSDoc が隣り合う場合、新規 JSDoc は関数定義の直前に置き、既存コメントは新規 JSDoc の上に残す（既存コメントは移動・削除しない）。
- 本計画の JSDoc 文面は「このままコピーして貼る」ことを前提に確定済み。実装者は独自に書き直さない。

---

## Task 1: markdown-it-named-headers.ts

**Files:**
- Modify: `src/markdown-it-named-headers.ts`

**背景:**
このファイルには既存の JSDoc が 2 箇所（`githubSlugify` と内部の `tokenToPlainText`）、既存の大規模 regex へのコンテキストコメントがある。いずれも触らない。不足しているのは (1) ファイルヘッダ、(2) `markdownItNamedHeaders` export の JSDoc の 2 点のみ。

- [ ] **Step 1: ファイルヘッダと JSDoc を追加する**

`src/markdown-it-named-headers.ts` の 1 行目（`import type MarkdownIt...` の直前）に以下のヘッダコメントを挿入:

```typescript
// markdown-it plugin: assigns GitHub-compatible slug IDs to headings so
// in-document links and tables of contents resolve consistently.
```

さらに、`export function markdownItNamedHeaders(md: MarkdownIt, options?: NamedHeadersOptions): void {` の直前（現在 43 行目あたり）に以下の JSDoc を挿入:

```typescript
/** Installs the named-headers plugin that assigns slug IDs to headings. */
```

既存の `githubSlugify` の JSDoc（現 14-17 行）と内部 `tokenToPlainText` の JSDoc（現 25-28 行）、および大 regex 上のコメント（現 8-11 行）は一切変更しない。

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなく完了すること。

- [ ] **Step 3: コミット**

```bash
git add src/markdown-it-named-headers.ts
git commit -m "docs: add comments to src/markdown-it-named-headers.ts"
```

---

## Task 2: markdown-it-checkbox.ts

**Files:**
- Modify: `src/markdown-it-checkbox.ts`

**背景:**
既存コメントなし。`export` は `markdownItCheckbox` のみ。チェックボックス用正規表現 `CHECKBOX_PATTERN` は自明（`[ ]`/`[x]` 形式）なので Why コメントは不要。

- [ ] **Step 1: ファイルヘッダと JSDoc を追加する**

`src/markdown-it-checkbox.ts` の 1 行目の直前に以下のヘッダを挿入:

```typescript
// markdown-it plugin: renders GitHub-style task list checkboxes, turning
// lines like `[ ] item` or `[x] item` into <input type="checkbox"> elements.
```

`export function markdownItCheckbox(md: MarkdownIt): void {`（現 118 行目あたり）の直前に以下の JSDoc を挿入:

```typescript
/** Installs the checkbox plugin that renders GitHub-style task list items. */
```

内部関数（`cloneToken`、`replaceTokenRange`、`checkboxReplace`、`createTokens`、`splitLineTokens`）には JSDoc を付けない。

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなく完了すること。

- [ ] **Step 3: コミット**

```bash
git add src/markdown-it-checkbox.ts
git commit -m "docs: add comments to src/markdown-it-checkbox.ts"
```

---

## Task 3: chromium-resolver.ts

**Files:**
- Modify: `src/chromium-resolver.ts`

**背景:**
- 既存コメント: 5-7 行目に `PUPPETEER_REVISIONS` の CJS 問題を説明する既存 `//` コメントがある（CJS/ESM 境界の Why コメントとして既に機能しているため追加不要）。
- 7 つの `export` 関数すべてに 1 行 JSDoc を追加する。
- 2 箇所の「黙って失敗させる」空 catch に Why コメントを追加する（意図が非自明で bug と誤読されやすいため）。
- `getEdgeAndChromiumCandidates` のプラットフォーム分岐は「各 OS で Chrome/Edge の標準インストール先が違う」という自明な理由なので Why コメントは追加しない。

- [ ] **Step 1: ファイルヘッダを追加する**

`src/chromium-resolver.ts` の 1 行目の直前に以下のヘッダを挿入:

```typescript
// Chromium executable resolver: locates a usable Chrome/Edge binary from
// user-configured path, system install locations, or Puppeteer's managed
// browser cache.
```

- [ ] **Step 2: 各 `export` 関数に JSDoc を追加する**

以下 7 箇所に、それぞれ示した JSDoc を対応する `export function` の直前に挿入する。

`export function findChromiumFromUserSetting(executablePath: string): string | null {`（現 10 行目）:

```typescript
/** Resolves the Chromium executable path from a user-configured setting. */
```

`export function findChromiumFromSystem(): string | null {`（現 24 行目）:

```typescript
/** Finds a system-installed Chromium or Edge executable, or null if none is available. */
```

`export function getEdgeAndChromiumCandidates(): string[] {`（現 46 行目）:

```typescript
/** Returns platform-specific candidate paths for Chromium and Edge installs. */
```

`export function getExpectedBuildId(): string {`（現 92 行目）:

```typescript
/** Returns the Chrome build id that the bundled puppeteer-core expects. */
```

`export async function ensureChromiumDownloaded(`（現 96 行目）:

```typescript
/** Ensures a managed Chromium matching the expected build id exists in cacheDir, downloading it if necessary. */
```

`export async function cleanupOldChromium(cacheDir: string, keepBuildId: string): Promise<void> {`（現 131 行目）:

```typescript
/** Removes Chromium builds in cacheDir other than keepBuildId, logging any failures without throwing. */
```

`export async function resolveChromiumPath(`（現 159 行目）:

```typescript
/** Resolves a usable Chromium path by trying user setting, system install, and managed download in order. */
```

- [ ] **Step 3: 空 catch に Why コメントを追加する**

`findChromiumFromSystem` の `PB.computeSystemExecutablePath` への try ブロック（現 25 行目）の直前に以下を挿入:

```typescript
  // Why: if Puppeteer's system detection fails, silently fall through to
  // the manual candidate scan below instead of failing the whole lookup.
```

`ensureChromiumDownloaded` 内で `PB.computeExecutablePath` + `fs.accessSync` を試みる try ブロック（現 104 行目）の直前に以下を挿入:

```typescript
  // Why: if the expected build is missing or inaccessible, fall through to
  // PB.install() below rather than propagating the error.
```

他の空 catch（`findChromiumFromSystem` の候補ループ内 `fs.accessSync` catch、`cleanupOldChromium` 外側の catch）には Why を追加しない。前者はループで次候補に進むのが自明、後者は catch 内に `console.warn` があるため空ではない。

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなく完了すること。

- [ ] **Step 5: コミット**

```bash
git add src/chromium-resolver.ts
git commit -m "docs: add comments to src/chromium-resolver.ts"
```

---

## Task 4: markdown-it-include.ts

**Files:**
- Modify: `src/markdown-it-include.ts`

**背景:**
既存コメントが豊富（`findCodeRegions` 内部 JSDoc、正規表現の意図説明、fenced/inline code 処理の逐次コメント）。これらは一切変更しない。追加するのはファイルヘッダと `markdownItInclude` export の JSDoc のみ。

- [ ] **Step 1: ファイルヘッダと JSDoc を追加する**

`src/markdown-it-include.ts` の 1 行目の直前に以下のヘッダを挿入:

```typescript
// markdown-it plugin: expands :[alt](path/to/file.md) include directives
// before rendering, while preserving content inside fenced and inline code
// regions.
```

`export function markdownItInclude(md: MarkdownIt, options: string | MarkdownItIncludeOptions): void {`（現 207 行目）の直前に以下の JSDoc を挿入:

```typescript
/** Installs the include plugin that expands :[alt](path) directives at parse time. */
```

内部の `findCodeRegions` / `replaceIncludes` / `processIncludes` には JSDoc を付けない（非 export のため）。

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなく完了すること。

- [ ] **Step 3: コミット**

```bash
git add src/markdown-it-include.ts
git commit -m "docs: add comments to src/markdown-it-include.ts"
```

---

## Task 5: extension.ts

**Files:**
- Modify: `src/extension.ts`

**背景:**
- `export` は `activate`（現 38 行目）と `deactivate`（現 62 行目）の 2 関数のみ。
- `deactivate` の直前（現 61 行目）に既存コメント `// this method is called when your extension is deactivated` がある。これは削除・書き換えしない。新規 JSDoc は既存コメントの**下**（= `export function deactivate` の直前）に置き、両方が関数の上に並ぶ形とする。
- ブロックコメント（`convert markdown to html` 等）やインラインコメント（`// check active window` 等）、Puppeteer の `--no-sandbox` への URL コメントは既に存在しており、追加・変更しない。
- Why コメントの 5 基準に新規該当する箇所は見当たらない（プラットフォーム分岐・非自明 regex・ハック・既存未説明の外部仕様依存なし）。Puppeteer の sandbox 引数と VS Code fixHref 関連の出典は既にコメント済み。したがって Task 5 では Why コメントを新規追加しない。

- [ ] **Step 1: ファイルヘッダを追加する**

`src/extension.ts` の 1 行目の直前に以下のヘッダを挿入:

```typescript
// VS Code extension entry point: registers markdown-pdf commands and drives
// the markdown-to-HTML/PDF/image conversion workflow via puppeteer-core.
```

- [ ] **Step 2: `activate` に JSDoc を追加する**

`export function activate(context: vscode.ExtensionContext): void {`（現 38 行目）の直前に以下の JSDoc を挿入:

```typescript
/** Activates the extension: registers markdown-pdf commands and wires the convert-on-save handler. */
```

- [ ] **Step 3: `deactivate` に JSDoc を追加する**

既存の `// this method is called when your extension is deactivated`（現 61 行目）は**残したまま**、その直下かつ `export function deactivate(): void {` の直前に以下の JSDoc を挿入する。編集後の該当ブロックは以下のようになる:

```typescript
// this method is called when your extension is deactivated
/** Deactivates the extension. Currently a no-op; kept for VS Code API compatibility. */
export function deactivate(): void {
}
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなく完了すること。

- [ ] **Step 5: コミット**

```bash
git add src/extension.ts
git commit -m "docs: add comments to src/extension.ts"
```

---

## Task 6: utils.ts

**Files:**
- Modify: `src/utils.ts`

**背景:**
- 26 個の `export function` すべてに 1 行 JSDoc を付ける。ただし `readFile`、`resolveOutputDir`、`parseFrontMatter`、`transformHtmlBlockImages` の 4 関数は、型で表現できない重要情報があるため複数行 JSDoc を許容する（仕様ルール B の例外条件に該当）。
- 内部関数（`resolveHighlightStyle`、`isPlainRecord`、`findHtmlTagEnd`、`isRealImgTag`、`getTagName`、`isOpeningTag`、`isRawTextElement`、`findRawTextElementEnd`、`escapeRegExp`、`transformImgTag`）には JSDoc を付けない。
- 既存の散発コメント（`// href is not a valid URL` 等、現 109 行・152 行など）は変更しない。
- Why コメント: `transformHtmlBlockImages` のハンドロール HTML スキャナは「なぜ自前実装なのか」が非自明なので、JSDoc 本文に 1 行追記する形で扱う（ルール B の多行 JSDoc と C の Why を統合）。それ以外のファイル範囲では Why コメント新規追加なし。

- [ ] **Step 1: ファイルヘッダを追加する**

`src/utils.ts` の 1 行目の直前に以下のヘッダを挿入:

```typescript
// Shared helpers for the markdown-pdf extension: file I/O, path and URL
// resolution, HTML/CSS assembly, and option builders for markdown-it and
// Puppeteer.
```

- [ ] **Step 2: 単純 `export` 関数（22 箇所）に 1 行 JSDoc を追加する**

以下の各 `export function` の直前に、対応する 1 行 JSDoc を挿入する。本文はそのままコピーすること。

`export function setBooleanValue(...)`（現 8 行目）:

```typescript
/** Returns a when a is a defined boolean (including false); otherwise returns b. */
```

`export function isExistsPath(filePath: string): boolean {`（現 16 行目）:

```typescript
/** Checks whether a path exists, logging and returning false on any fs error. */
```

`export function isExistsDir(dirname: string): boolean {`（現 29 行目）:

```typescript
/** Checks whether a path exists and is a directory, logging and returning false otherwise. */
```

`export function Slug(string: string): string {`（現 46 行目）:

```typescript
/** Generates a GitHub-compatible slug from a heading title. */
```

`export function transformTemplate(templateText: string): string {`（現 50 行目）:

```typescript
/** Substitutes %%ISO-DATETIME%%, %%ISO-DATE%%, and %%ISO-TIME%% placeholders with the current values. */
```

`export function makeCss(filename: string): string {`（現 91 行目）:

```typescript
/** Reads a CSS file and wraps its contents in a <style> tag, or returns '' when the file is empty. */
```

`export function convertImgPath(src: string, filename: string): string {`（現 100 行目）:

```typescript
/** Resolves an image src to an absolute file:// URL, or returns the original src for remote URLs. */
```

`export function isExcludeFile(filename: string, patterns: string[] | undefined | string): boolean {`（現 130 行目）:

```typescript
/** Returns true when filename matches any of the given regex pattern strings. */
```

`export function resolveHref(...)`（現 143 行目）:

```typescript
/** Resolves a style href to an absolute file:// URL, leaving http/https/data URLs untouched. */
```

`export function buildStyleTags(options: BuildStyleTagsOptions): string {`（現 236 行目）:

```typescript
/** Builds the concatenated <style> and <link> tags for default, highlight, and user styles. */
```

`export function buildPdfOptions(config: PdfConfig): Record<string, unknown> {`（現 298 行目）:

```typescript
/** Builds the options object passed to Puppeteer's page.pdf() call. */
```

`export function buildImageOptions(config: ImageConfig): Record<string, unknown> {`（現 329 行目）:

```typescript
/** Builds the options object passed to Puppeteer's page.screenshot() call. */
```

`export function buildHighlightCallback(...)`（現 356 行目）:

```typescript
/** Returns a markdown-it highlight callback that renders mermaid blocks as <div> and other languages via highlight.js. */
```

`export function buildMarkdownItOptions(config: MarkdownItConfig): Record<string, unknown> {`（現 382 行目）:

```typescript
/** Builds the options object passed to the markdown-it constructor. */
```

`export function buildPlantumlOptions(...)`（現 398 行目）:

```typescript
/** Builds the options object passed to the markdown-it-plantuml plugin. */
```

`export function buildHtmlViewData(...)`（現 413 行目）:

```typescript
/** Builds the view model passed to the HTML template renderer. */
```

`export function renderTemplate(template: string, view: Record<string, string>): string {`（現 422 行目）:

```typescript
/** Substitutes {{{key}}} placeholders in a template with matching values from view. */
```

`export function resolveExportTypes(...)`（現 457 行目）:

```typescript
/** Resolves the requested export types from an option string and the configured default, or null for an unsupported type. */
```

`export function transformImageHref(href: string, type: string, filename: string): string {`（現 479 行目）:

```typescript
/** Transforms an image href for the given export type: decoded for html, absolute file:// for others. */
```

`export function buildEmojiTag(emoji: string, emojiData: string | undefined | null): string {`（現 663 行目）:

```typescript
/** Builds an <img> tag carrying a base64-encoded emoji, or a ':name:' fallback when emoji data is missing. */
```

`export function buildContainerRenderer(): ...`（現 670 行目）:

```typescript
/** Returns validate and render callbacks for the markdown-it-container plugin. */
```

`export function generateTmpHtmlFilename(filename: string): string {`（現 684 行目）:

```typescript
/** Generates a temporary html filename derived from the source markdown filename. */
```

- [ ] **Step 3: 例外条件を持つ `export` 関数（4 箇所）に複数行 JSDoc を追加する**

`export function readFile(filename: string, encode?: BufferEncoding | null): string | Buffer {`（現 64 行目）:

```typescript
/**
 * Reads a file synchronously, stripping file:// URI prefixes beforehand.
 * Returns '' on any I/O failure; warnings are logged to console and errors are never re-thrown.
 */
```

`export function resolveOutputDir(...)`（現 173 行目）:

```typescript
/**
 * Resolves the output directory for a converted file.
 * Returns null when a configured absolute outputDirectory does not exist.
 */
```

`export function parseFrontMatter(text: string): { data: Record<string, unknown>; content: string } {`（現 436 行目）:

```typescript
/**
 * Parses YAML front matter from a markdown string, tolerating a leading BOM
 * and an empty front matter block. Returns an empty data object when YAML is
 * missing, empty, or not a plain object.
 */
```

`export function transformHtmlBlockImages(html: string, filename: string): string {`（現 486 行目）:

```typescript
/**
 * Rewrites src attributes of <img> tags inside raw HTML blocks to absolute
 * file:// URLs, skipping content inside comments, <script>, <style>, and
 * <textarea>. Uses a hand-rolled scanner to avoid pulling in a full HTML
 * parsing dependency.
 */
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなく完了すること。

- [ ] **Step 5: コミット**

```bash
git add src/utils.ts
git commit -m "docs: add comments to src/utils.ts"
```

---

## Task 7: 全体検証とセルフレビュー

**Files:**
- Read: すべての `src/*.ts`

全 6 ファイルの変更が完了したあとに実施する。問題があれば修正し、追加コミットを作成する。

- [ ] **Step 1: 機械的チェック #1 — 全ファイルのヘッダ存在**

Run: `head -n 1 src/chromium-resolver.ts src/extension.ts src/markdown-it-checkbox.ts src/markdown-it-include.ts src/markdown-it-named-headers.ts src/utils.ts`
Expected: いずれも `//` から始まる行であること。

- [ ] **Step 2: 機械的チェック #2 — 全 export の直前に JSDoc があるか**

Run:
```bash
for f in src/chromium-resolver.ts src/extension.ts src/markdown-it-checkbox.ts src/markdown-it-include.ts src/markdown-it-named-headers.ts src/utils.ts; do
  echo "== $f =="
  awk '/^export function|^export async function/ { if (prev !~ /\*\//) print NR": missing JSDoc: "$0; } { prev=$0 }' "$f"
done
```
Expected: どのファイルでも "missing JSDoc" の行が出ないこと。出力がすべて `== ファイル名 ==` の見出し行のみなら OK。

- [ ] **Step 3: 機械的チェック #3 — 型チェックとビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく完了すること。

- [ ] **Step 4: 機械的チェック #4 — 既存テスト**

Run: `npm test`
Expected: 従来通り全テストがパスすること。新規失敗がないこと。

- [ ] **Step 5: 質的セルフレビュー**

各ファイルを通しで読み返し、以下のチェックリストに照らして問題がある箇所だけ修正する:

- JSDoc が型情報と重複しただけの無意味なものになっていないか（例: `Returns a string.` のみ）。
- JSDoc が三人称単数現在形の動詞で始まり、末尾がピリオドで終わっているか。
- Why コメントが what になっていないか（「何をしているか」の書き換えになっていたら NG）。
- ファイルヘッダが「このファイルの責務」を表しているか（実装詳細の列挙でないこと）。
- 英語の文法・スペルミスがないか。
- 絵文字が混入していないか。
- 既存コメントを誤って変更・削除していないか（`git diff develop -- src/` で既存コメント行に変更がないことを目視確認）。

- [ ] **Step 6: 修正が入った場合のみ追加コミット**

Step 5 で修正した場合のみ、まとめて 1 コミットする:

```bash
git add src/
git commit -m "docs: tighten source comments after self-review"
```

修正が無ければこのステップはスキップする。

- [ ] **Step 7: ブランチ状態の確認**

Run: `git log develop..HEAD --oneline`
Expected: Task 1〜6 の 6 コミット（+ Task 7 Step 6 の修正コミットが必要だった場合は 7 コミット）が並んでいること。

- [ ] **Step 8: 完了を報告する**

ユーザに以下を報告して完了判断を仰ぐ:

- 追加されたファイル・関数の概要
- 機械的チェック結果
- セルフレビューで修正が入ったかどうか
- 次のアクション候補（`develop` へのマージ実行可否の確認）

マージは本計画の対象外。ユーザ承認後に別手順で実施すること。
