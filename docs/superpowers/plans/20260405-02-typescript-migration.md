# TypeScript移行 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **作業ブランチ**: `feature/typescript-migration`
> **ワークツリー**: `.worktrees/typescript-migration`
> **注意**: このブランチ以外に切り替えないこと

**Goal:** ソースコード3ファイルとテスト5ファイルをJavaScriptからTypeScriptに一括変換し、strict モードで型チェックが通る状態にする

**Architecture:** esbuild によるバンドルは維持し、tsc は `--noEmit` で型チェック専用に使う。ソースは `src/` 配下に統一、テストは `tsx` で直接実行する

**Tech Stack:** TypeScript, esbuild, tsx, @types/vscode, @types/node, @types/markdown-it, @types/mustache

---

## ファイル構成

| 操作 | ファイル |
|------|----------|
| 作成 | `tsconfig.json` |
| 作成 | `src/types/emoji-images.d.ts` |
| 作成 | `src/types/markdown-it-named-headers.d.ts` |
| 作成 | `src/types/markdown-it-include.d.ts` |
| 作成 | `src/types/markdown-it-plantuml.d.ts` |
| 作成 | `src/types/markdown-it-container.d.ts` |
| 作成 | `src/types/markdown-it-checkbox.d.ts` |
| 作成 | `src/types/markdown-it-emoji.d.ts` |
| 変換 | `src/utils.js` → `src/utils.ts` |
| 変換 | `src/chromium-resolver.js` → `src/chromium-resolver.ts` |
| 変換 | `extension.js` → `src/extension.ts` |
| 変換 | `test/unit/utils.test.js` → `test/unit/utils.test.ts` |
| 変換 | `test/unit/chromium-resolver.test.js` → `test/unit/chromium-resolver.test.ts` |
| 変換 | `test/unit/vscodeignore.test.js` → `test/unit/vscodeignore.test.ts` |
| 変換 | `test/integration/extension.test.js` → `test/integration/extension.test.ts` |
| 変換 | `test/sample/generate-sample.js` → `test/sample/generate-sample.ts` |
| 変更 | `package.json` (scripts, devDependencies) |
| 変更 | `.vscode-test.mjs` (ファイルパターン) |
| 変更 | `.vscodeignore` (TypeScript関連の調整) |
| 削除 | `jsconfig.json` |

---

### Task 1: 環境構築 — devDependencies インストールと tsconfig.json 作成

**Files:**
- Create: `tsconfig.json`
- Modify: `package.json`
- Delete: `jsconfig.json`

- [ ] **Step 1: devDependencies をインストール**

```bash
npm install --save-dev typescript @types/vscode @types/node @types/markdown-it @types/mustache tsx
```

- [ ] **Step 2: `tsconfig.json` を作成**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "rootDir": ".",
    "typeRoots": ["./src/types", "./node_modules/@types"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: `jsconfig.json` を削除**

```bash
rm jsconfig.json
```

- [ ] **Step 4: コミット**

```bash
git add tsconfig.json package.json package-lock.json
git rm jsconfig.json
git commit -m "chore: add TypeScript tooling and tsconfig.json"
```

---

### Task 2: 型宣言ファイルの作成

**Files:**
- Create: `src/types/emoji-images.d.ts`
- Create: `src/types/markdown-it-named-headers.d.ts`
- Create: `src/types/markdown-it-include.d.ts`
- Create: `src/types/markdown-it-plantuml.d.ts`
- Create: `src/types/markdown-it-container.d.ts`
- Create: `src/types/markdown-it-checkbox.d.ts`
- Create: `src/types/markdown-it-emoji.d.ts`

markdown-it プラグインはすべて `MarkdownIt` の `.use()` メソッドに渡す形で使われている。各プラグインの使い方は `extension.js` を参照。

- [ ] **Step 1: `src/types/markdown-it-checkbox.d.ts` を作成**

```typescript
declare module 'markdown-it-checkbox' {
  import MarkdownIt from 'markdown-it';
  const markdownItCheckbox: MarkdownIt.PluginSimple;
  export default markdownItCheckbox;
}
```

- [ ] **Step 2: `src/types/markdown-it-emoji.d.ts` を作成**

`extension.js` での使い方: `require('markdown-it-emoji').full` をプラグインとして使い、`{ defs: ... }` をオプションに渡す。

```typescript
declare module 'markdown-it-emoji' {
  import MarkdownIt from 'markdown-it';

  interface EmojiOptions {
    defs?: Record<string, string>;
  }

  const full: MarkdownIt.PluginWithOptions<EmojiOptions>;
  export { full };
}
```

- [ ] **Step 3: `src/types/markdown-it-named-headers.d.ts` を作成**

`extension.js` での使い方: `md.use(require('markdown-it-named-headers'), { slugify: utils.Slug })`

```typescript
declare module 'markdown-it-named-headers' {
  import MarkdownIt from 'markdown-it';

  interface NamedHeadersOptions {
    slugify?: (str: string) => string;
  }

  const markdownItNamedHeaders: MarkdownIt.PluginWithOptions<NamedHeadersOptions>;
  export default markdownItNamedHeaders;
}
```

- [ ] **Step 4: `src/types/markdown-it-container.d.ts` を作成**

`extension.js` での使い方: `md.use(require('markdown-it-container'), '', { validate, render })`

```typescript
declare module 'markdown-it-container' {
  import MarkdownIt from 'markdown-it';
  import Token from 'markdown-it/lib/token.mjs';

  interface ContainerOptions {
    validate?: (name: string) => boolean | number;
    render?: (tokens: Token[], idx: number) => string;
  }

  const markdownItContainer: (md: MarkdownIt, name: string, options: ContainerOptions) => void;
  export default markdownItContainer;
}
```

- [ ] **Step 5: `src/types/markdown-it-plantuml.d.ts` を作成**

`extension.js` での使い方: `md.use(require('markdown-it-plantuml'), { openMarker, closeMarker, server })`

```typescript
declare module 'markdown-it-plantuml' {
  import MarkdownIt from 'markdown-it';

  interface PlantumlOptions {
    openMarker?: string;
    closeMarker?: string;
    server?: string;
  }

  const markdownItPlantuml: MarkdownIt.PluginWithOptions<PlantumlOptions>;
  export default markdownItPlantuml;
}
```

- [ ] **Step 6: `src/types/markdown-it-include.d.ts` を作成**

`extension.js` での使い方: `md.use(require("markdown-it-include"), { root, includeRe, bracesAreOptional, throwError })`

```typescript
declare module 'markdown-it-include' {
  import MarkdownIt from 'markdown-it';

  interface IncludeOptions {
    root?: string;
    includeRe?: RegExp;
    bracesAreOptional?: boolean;
    throwError?: boolean;
  }

  const markdownItInclude: MarkdownIt.PluginWithOptions<IncludeOptions>;
  export default markdownItInclude;
}
```

- [ ] **Step 7: `src/types/emoji-images.d.ts` を作成**

`extension.js` での使い方: `emoji-images` パッケージ自体は `require` されていない。`node_modules/emoji-images/pngs/` ディレクトリから PNG ファイルを `readFile` で読み取っているだけなので、型宣言は不要。ただし将来の安全のため最小限の宣言を用意する。

```typescript
declare module 'emoji-images' {
  // This package is used only for its bundled PNG assets (pngs/*.png).
  // No API is called directly.
}
```

- [ ] **Step 8: コミット**

```bash
git add src/types/
git commit -m "chore: add type declarations for untyped markdown-it plugins"
```

---

### Task 3: `src/utils.js` → `src/utils.ts` に変換

**Files:**
- Modify: `src/utils.js` → `src/utils.ts`

`src/utils.js` はプロジェクト内の他モジュールに依存しない純粋なユーティリティファイルなので最初に変換する。

- [ ] **Step 1: ファイルをリネーム**

```bash
git mv src/utils.js src/utils.ts
```

- [ ] **Step 2: TypeScript に書き換え**

以下の変換を適用する:

1. `'use strict';` を削除（TypeScript では不要）
2. `var ... = require(...)` → `import ... from '...'` に変更
3. すべての関数に引数型と戻り値型を付与
4. `module.exports = { ... }` → 名前付き `export` に変更
5. `url.parse()` の使用は `URL` クラスに置き換える

import 部分:

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';
import { load as cheerioLoad } from 'cheerio';
```

各関数のシグネチャ（主要なもの）:

```typescript
export function setBooleanValue(a: boolean | undefined | null, b: boolean | undefined): boolean | undefined {
export function isExistsPath(filePath: string): boolean {
export function isExistsDir(dirname: string): boolean {
export function Slug(string: string): string {
export function transformTemplate(templateText: string): string {
export function readFile(filename: string, encode?: BufferEncoding | null): string | Buffer {
export function makeCss(filename: string): string {
export function convertImgPath(src: string, filename: string): string {
export function isExcludeFile(filename: string, patterns: string[] | undefined | string): boolean {
export function resolveHref(href: string | undefined | null, resourceFsPath: string, stylesRelativePathFile: boolean | undefined, workspaceFsPath: string | undefined): string | undefined | null {
export function resolveOutputDir(filename: string, outputDirectory: string | undefined | null, outputDirectoryRelativePathFile: boolean | undefined, resourceFsPath: string, workspaceFsPath: string | undefined): string | null {
```

`buildStyleTags` のオプション型:

```typescript
interface BuildStyleTagsOptions {
  includeDefaultStyles: boolean;
  highlight: boolean;
  highlightStyle: string;
  markdownStyles: string[] | string;
  markdownPdfStyles: string[] | string;
  baseDir: string;
  onMissingHighlightStyle?: (requestedStyle: string, resolvedStyle: string) => void;
  resolveHrefFn: (href: string) => string;
}

export function buildStyleTags(options: BuildStyleTagsOptions): string {
```

`buildPdfOptions` / `buildImageOptions` の型:

```typescript
interface PdfConfig {
  path: string;
  width: string;
  height: string;
  format: string;
  orientation: string;
  scale: number;
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  printBackground: boolean;
  pageRanges: string;
  margin: { top: string; right: string; bottom: string; left: string };
}

interface ImageConfig {
  path: string;
  type: string;
  quality: number;
  clip: { x: number | null; y: number | null; width: number | null; height: number | null };
  omitBackground: boolean;
}

export function buildPdfOptions(config: PdfConfig): Record<string, unknown> {
export function buildImageOptions(config: ImageConfig): Record<string, unknown> {
```

その他の関数:

```typescript
export function buildHighlightCallback(hljs: typeof import('highlight.js'), escapeHtml: (str: string) => string): (str: string, lang: string) => string {

interface MarkdownItConfig {
  breaks: boolean | undefined;
  hljs: typeof import('highlight.js');
  escapeHtml: (str: string) => string;
}
export function buildMarkdownItOptions(config: MarkdownItConfig): Record<string, unknown> {

interface PlantumlConfig {
  frontmatterOpenMarker: string | undefined;
  frontmatterCloseMarker: string | undefined;
  settingsOpenMarker: string;
  settingsCloseMarker: string;
  server: string;
}
export function buildPlantumlOptions(config: PlantumlConfig): { openMarker: string; closeMarker: string; server: string } {

interface HtmlViewDataConfig {
  title: string;
  style: string;
  content: string;
  mermaidServer: string;
}
export function buildHtmlViewData(config: HtmlViewDataConfig): { title: string; style: string; content: string; mermaid: string } {

export function resolveExportTypes(optionType: string | undefined, configuredType: string[] | string | undefined): string[] | null {
export function transformImageHref(href: string, type: string, filename: string): string {
export function transformHtmlBlockImages(html: string, filename: string): string {
export function buildEmojiTag(emoji: string, emojiData: string | undefined | null): string {
export function buildContainerRenderer(): { validate: (name: string) => number; render: (tokens: Array<{ info: string }>, idx: number) => string } {
export function generateTmpHtmlFilename(filename: string): string {
```

`url.parse()` の置き換え（`convertImgPath` と `resolveHref` 内）:

```typescript
// Before:
var protocol = url.parse(href).protocol;

// After:
let protocol: string | null = null;
try {
  protocol = new URL(href).protocol;
} catch {
  // href is not a valid URL (relative path, etc.)
}
```

注意: `convertImgPath` では `file:` プロトコルや相対パスの扱いがあるため、`url.parse()` と `new URL()` の挙動の違いに注意する。`url.parse()` は相対パスでもパースできるが `new URL()` はエラーになる。`protocol === null` は「プロトコルなし（相対パス）」として扱う。

`resolveHref` でも同様の変換を行う:

```typescript
// Before:
var parsed = url.parse(href);
if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'data:') {

// After:
let protocol: string | null = null;
try {
  protocol = new URL(href).protocol;
} catch {
  // Not a valid absolute URL
}
if (protocol === 'http:' || protocol === 'https:' || protocol === 'data:') {
```

最後に `module.exports` ブロックを削除する（各関数に `export` が付いているため不要）。

- [ ] **Step 3: 型チェック実行**

```bash
npx tsc --noEmit 2>&1 | head -30
```

`src/utils.ts` に関するエラーが残っていないことを確認する。`src/extension.ts` や `src/chromium-resolver.ts` がまだ JS なのでそれらのエラーは無視する（`include` にマッチしないので出ない）。

- [ ] **Step 4: コミット**

```bash
git add src/utils.ts
git commit -m "feat: convert src/utils.js to TypeScript"
```

---

### Task 4: `src/chromium-resolver.js` → `src/chromium-resolver.ts` に変換

**Files:**
- Modify: `src/chromium-resolver.js` → `src/chromium-resolver.ts`

- [ ] **Step 1: ファイルをリネーム**

```bash
git mv src/chromium-resolver.js src/chromium-resolver.ts
```

- [ ] **Step 2: TypeScript に書き換え**

import 部分:

```typescript
import fs from 'fs';
import path from 'path';
import * as PB from '@puppeteer/browsers';
import puppeteer from 'puppeteer-core';
```

各関数のシグネチャ:

```typescript
export function findChromiumFromUserSetting(executablePath: string): string | null {
export function findChromiumFromSystem(): string | null {
function getEdgeAndChromiumCandidates(): string[] {
function getWindowsCandidates(): string[] {
export function getExpectedBuildId(): string {
export async function ensureChromiumDownloaded(cacheDir: string, onProgress?: (downloadedBytes: number, totalBytes: number) => void): Promise<string> {
export async function cleanupOldChromium(cacheDir: string, keepBuildId: string): Promise<void> {
export async function resolveChromiumPath(userExecutablePath: string, cacheDir: string, onProgress?: (downloadedBytes: number, totalBytes: number) => void): Promise<string | null> {
export function getEdgeAndChromiumCandidates(): string[] {
```

`module.exports` ブロックを削除し、各関数に `export` を付ける。`getWindowsCandidates` は外部に公開されていないのでそのまま。

- [ ] **Step 3: 型チェック実行**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: コミット**

```bash
git add src/chromium-resolver.ts
git commit -m "feat: convert src/chromium-resolver.js to TypeScript"
```

---

### Task 5: `extension.js` → `src/extension.ts` に変換

**Files:**
- Delete: `extension.js`
- Create: `src/extension.ts`

`extension.js` はルート直下にあり `src/` に移動する。`utils` と `chromium-resolver` への import パスが変わる。

- [ ] **Step 1: ファイルを移動**

```bash
git mv extension.js src/extension.ts
```

- [ ] **Step 2: TypeScript に書き換え**

import 部分:

```typescript
import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import * as utils from './utils';
import * as chromiumResolver from './chromium-resolver';
```

`EXTENSION_ROOT` の調整 — esbuild でバンドルされ `dist/extension.js` として出力されるので、`__dirname` は `dist/` を指す。`path.join(__dirname, '..')` で引き続きプロジェクトルートを指すので変更不要:

```typescript
const EXTENSION_ROOT = path.join(__dirname, '..');
```

モジュールスコープの変数:

```typescript
let INSTALL_CHECK = false;
let extensionContext: vscode.ExtensionContext | null = null;
```

各関数のシグネチャ（主要なもの）:

```typescript
function getExtensionCacheDir(): string {
export function activate(context: vscode.ExtensionContext): void {
export function deactivate(): void {
async function markdownPdf(option_type: string): Promise<void> {
function markdownPdfOnSave(): void {
function isMarkdownPdfOnSaveExclude(): boolean | undefined {
function convertMarkdownToHtml(filename: string, type: string, text: string): string | undefined {
function makeHtml(data: string, uri: vscode.Uri): string | undefined {
function exportHtml(data: string, filename: string): void {
function exportPdf(data: string, filename: string, type: string, uri: vscode.Uri): Thenable<void> {
function deleteFile(filePath: string): void {
function getOutputDir(filename: string, resource: vscode.Uri | undefined): string | undefined {
function mkdir(dirPath: string): void {
function readStyles(uri: vscode.Uri): string | undefined {
function fixHref(resource: vscode.Uri, href: string): string | undefined {
function checkPuppeteerBinary(): boolean | undefined {
async function installChromium(): Promise<void> {
function showErrorMessage(msg: string, error?: unknown): void {
function setProxy(): void {
async function init(): Promise<void> {
```

`exports.activate = activate` / `exports.deactivate = deactivate` を削除し、関数宣言に `export` を付ける。

`convertMarkdownToHtml` 内の `require()` 呼び出しはファイル先頭の `import` に移動する:

```typescript
import grayMatter from 'gray-matter';
import hljs from 'highlight.js';
import markdownIt from 'markdown-it';
import markdownItCheckbox from 'markdown-it-checkbox';
import { full as markdownItEmojiFull } from 'markdown-it-emoji';
import markdownItNamedHeaders from 'markdown-it-named-headers';
import markdownItContainer from 'markdown-it-container';
import markdownItPlantuml from 'markdown-it-plantuml';
import markdownItInclude from 'markdown-it-include';
import mustache from 'mustache';
```

emoji JSON データの import:

```typescript
import emojiesDefs from '../data/emoji.json';
```

ただし `emoji.json` の読み込みは `resolveJsonModule` で対応できるか確認する必要がある。esbuild でバンドルされるが、`emoji.json` がバンドルに含まれるか検証し、含まれない場合は `readFile` で読み込む既存の方法を維持する。安全のため `EXTENSION_ROOT` ベースの `readFile` を維持する:

```typescript
// Keep runtime file read for emoji data since it's loaded from the extension's
// installed location, not from the bundle
const emojiesDefs = JSON.parse(utils.readFile(path.join(EXTENSION_ROOT, 'data', 'emoji.json')) as string);
```

`require('puppeteer-core')` は `exportPdf` 内でのみ使われている。ファイル先頭で import する:

```typescript
import puppeteer from 'puppeteer-core';
```

`vscode.workspace.getConfiguration()` の戻り値は `WorkspaceConfiguration` で、`[]` アクセスは `any` を返す。既存のコードをそのまま維持しつつ、必要に応じて型アサーションを付ける。

- [ ] **Step 3: 型チェック実行**

```bash
npx tsc --noEmit 2>&1 | head -50
```

エラーがあればすべて修正する。

- [ ] **Step 4: esbuild でビルドが通ることを確認**

まだ `package.json` の scripts は更新していないので直接実行:

```bash
npx esbuild src/extension.ts --bundle --outfile=dist/extension.js --format=cjs --platform=node --external:vscode
```

- [ ] **Step 5: コミット**

```bash
git add src/extension.ts
git rm --cached extension.js 2>/dev/null || true
git commit -m "feat: convert extension.js to TypeScript and move to src/"
```

---

### Task 6: ユニットテストを TypeScript に変換

**Files:**
- Modify: `test/unit/utils.test.js` → `test/unit/utils.test.ts`
- Modify: `test/unit/chromium-resolver.test.js` → `test/unit/chromium-resolver.test.ts`
- Modify: `test/unit/vscodeignore.test.js` → `test/unit/vscodeignore.test.ts`

- [ ] **Step 1: ファイルをリネーム**

```bash
git mv test/unit/utils.test.js test/unit/utils.test.ts
git mv test/unit/chromium-resolver.test.js test/unit/chromium-resolver.test.ts
git mv test/unit/vscodeignore.test.js test/unit/vscodeignore.test.ts
```

- [ ] **Step 2: `test/unit/utils.test.ts` を書き換え**

import 部分:

```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import * as utils from '../../src/utils';
```

テスト本体のコードは変更不要（assert 呼び出しは型推論で通る）。ただし `utils` の関数シグネチャが変わった場合、テスト内の引数に型エラーが出る可能性がある。例えば `setBooleanValue` に `null` を渡しているテストケースは、引数型 `boolean | undefined | null` を受け入れるようにしているので問題ない。

- [ ] **Step 3: `test/unit/chromium-resolver.test.ts` を書き換え**

import 部分:

```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as PB from '@puppeteer/browsers';
import * as chromiumResolver from '../../src/chromium-resolver';
```

`Object.defineProperty` でのモック部分は `as unknown` キャストが必要になる可能性がある。`PB.getInstalledBrowsers` の上書きで型が合わない場合:

```typescript
Object.defineProperty(PB, 'getInstalledBrowsers', {
  configurable: true,
  enumerable: true,
  value: async function (): Promise<Array<{ browser: string; buildId: string; platform: string }>> {
    return [
      { browser: PB.Browser.CHROME, buildId: 'keep-this-id', platform: 'linux' },
      { browser: PB.Browser.CHROME, buildId: 'old-chrome-id', platform: 'linux' },
      { browser: PB.Browser.FIREFOX, buildId: 'old-firefox-id', platform: 'linux' }
    ];
  }
});
```

- [ ] **Step 4: `test/unit/vscodeignore.test.ts` を書き換え**

import 部分:

```typescript
import { describe, it, before } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
```

テスト内で `extension.js` の存在を `.vscodeignore` でチェックしている行に注意:

```typescript
it('should exclude source files that are bundled', function () {
  assert.match(vscodeignore, /^extension\.js$/m);
  assert.match(vscodeignore, /^src\/\*\*$/m);
});
```

`.vscodeignore` は Task 8 で更新するが、ここでは既存テストの変換のみ行い、`.vscodeignore` テストの内容は Task 8 で合わせて修正する。

- [ ] **Step 5: tsx でユニットテストを実行**

```bash
npx tsx --test test/unit/utils.test.ts test/unit/chromium-resolver.test.ts test/unit/vscodeignore.test.ts
```

すべてパスすることを確認する。`vscodeignore.test.ts` の `extension.js` チェックは、この時点ではまだ `.vscodeignore` を更新していないので失敗する可能性がある。その場合は Task 8 で修正する。

- [ ] **Step 6: コミット**

```bash
git add test/unit/utils.test.ts test/unit/chromium-resolver.test.ts test/unit/vscodeignore.test.ts
git commit -m "feat: convert unit tests to TypeScript"
```

---

### Task 7: インテグレーションテストとサンプル生成を TypeScript に変換

**Files:**
- Modify: `test/integration/extension.test.js` → `test/integration/extension.test.ts`
- Modify: `test/sample/generate-sample.js` → `test/sample/generate-sample.ts`

インテグレーションテストは `@vscode/test-cli` + Mocha（tdd UI）で実行される。`vscode` モジュールは VS Code テストランナーが提供する。

- [ ] **Step 1: ファイルをリネーム**

```bash
git mv test/integration/extension.test.js test/integration/extension.test.ts
git mv test/sample/generate-sample.js test/sample/generate-sample.ts
```

- [ ] **Step 2: `test/integration/extension.test.ts` を書き換え**

import 部分:

```typescript
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
```

Mocha の `suite`, `suiteSetup`, `suiteTeardown`, `test` はグローバルに宣言されている（tdd UI）。TypeScript で認識させるため `@types/mocha` をインストールする必要がある:

```bash
npm install --save-dev @types/mocha
```

`this.timeout()` は Mocha のテストコンテキストなので、アロー関数ではなく function 宣言のままにする。

`process.listeners` や `process.removeAllListeners` の型は `@types/node` で提供される。

- [ ] **Step 3: `test/sample/generate-sample.ts` を書き換え**

import 部分:

```typescript
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
```

同じく Mocha tdd UI のグローバルを使う。

- [ ] **Step 4: コミット**

```bash
git add test/integration/extension.test.ts test/sample/generate-sample.ts package.json package-lock.json
git commit -m "feat: convert integration tests and sample generation to TypeScript"
```

---

### Task 8: ビルド設定の更新とクリーンアップ

**Files:**
- Modify: `package.json` (scripts)
- Modify: `.vscode-test.mjs` (ファイルパターン)
- Modify: `.vscodeignore`

- [ ] **Step 1: `package.json` の scripts を更新**

```json
{
  "build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --format=cjs --platform=node --external:vscode",
  "check": "tsc --noEmit",
  "watch": "npm run build -- --watch",
  "package": "npm run build && vsce package",
  "test": "npm run test:unit && npm run test:integration",
  "test:unit": "tsx --test test/unit/**/*.test.ts",
  "pretest:integration": "npm run build",
  "test:integration": "vscode-test --config .vscode-test.mjs",
  "presample": "npm run build",
  "sample": "vscode-test --config .vscode-test.mjs --label sample"
}
```

- [ ] **Step 2: `.vscode-test.mjs` のファイルパターンを更新**

```javascript
// Before:
files: 'test/integration/**/*.test.js',
// After:
files: 'test/integration/**/*.test.ts',

// Before:
files: 'test/sample/**/*.js',
// After:
files: 'test/sample/**/*.ts',
```

注意: `.vscode-test.mjs` の `files` に `.ts` ファイルを指定した場合、`@vscode/test-cli` がそのまま実行できるか確認する必要がある。`@vscode/test-cli` は Mocha を内部で使っており、`.ts` ファイルを直接ロードするには `--require tsx` 等の設定が必要になる可能性がある。`.vscode-test.mjs` に `mocha.require` を追加:

```javascript
{
  label: 'integration',
  files: 'test/integration/**/*.test.ts',
  mocha: { ui: 'tdd', timeout: 60000, require: ['tsx'] },
  // ...
},
{
  label: 'sample',
  files: 'test/sample/**/*.ts',
  mocha: { ui: 'tdd', timeout: 120000, require: ['tsx'] },
  // ...
},
```

- [ ] **Step 3: `.vscodeignore` を更新**

`extension.js` はもう存在しないので `.vscodeignore` から削除。`src/**` は引き続き除外（TS ソースはバンドルされるため不要）:

```
# Source files (bundled into dist/)
src/**
jsconfig.json
tsconfig.json
```

`extension.js` の行を削除し、`tsconfig.json` を追加する。

- [ ] **Step 4: `.vscodeignore` テストを更新**

`test/unit/vscodeignore.test.ts` の `extension.js` を確認するテストケースを修正:

```typescript
it('should exclude source files that are bundled', function () {
  assert.match(vscodeignore, /^src\/\*\*$/m);
});
```

`extension.js` のチェックを削除する。

- [ ] **Step 5: 全体のビルドとテスト確認**

```bash
npm run check
npm run build
npm run test:unit
```

型チェック、ビルド、ユニットテストがすべてパスすることを確認する。

- [ ] **Step 6: コミット**

```bash
git add package.json .vscode-test.mjs .vscodeignore test/unit/vscodeignore.test.ts
git commit -m "chore: update build config and cleanup for TypeScript migration"
```

---

### Task 9: 最終検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 型チェック**

```bash
npm run check
```

エラーゼロであること。

- [ ] **Step 2: ビルド**

```bash
npm run build
```

`dist/extension.js` が生成されること。

- [ ] **Step 3: ユニットテスト**

```bash
npm run test:unit
```

205 pass / 0 fail であること（skip 3 は Windows 限定テスト）。

- [ ] **Step 4: 旧 JS ファイルが残っていないか確認**

```bash
ls extension.js src/*.js 2>/dev/null
ls test/unit/*.js test/integration/*.js test/sample/*.js 2>/dev/null
ls jsconfig.json 2>/dev/null
```

すべて「ファイルなし」であること。

- [ ] **Step 5: esbuild バンドルが正常にロードできるか確認**

```bash
node -e "const ext = require('./dist/extension'); console.log(typeof ext.activate, typeof ext.deactivate)"
```

`function function` と出力されること。
