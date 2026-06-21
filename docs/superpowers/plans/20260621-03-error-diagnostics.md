# エラー診断ログ整備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「変換失敗」の issue 報告から原因を特定できるよう、環境スナップショット・変換コンテキスト・段階別エラーを含む診断ログを整備する。

**Architecture:** vscode/os 非依存の新規 `src/diagnostics.ts` に整形・マスキングの純粋関数を集約（`logger.ts` と同じ DI 方針）。`extension.ts` が実値を収集し、エクスポート開始時に環境＋コンテキストを `logInfo`、各 catch に 1 行 context を付ける。`resolveChromiumPath` は `{ path, source }` を返すよう拡張し、Chromium の出所を診断に載せる。

**Tech Stack:** TypeScript, esbuild（バンドル）, tsx + `node:test`（ユニットテスト）, VS Code Extension API, puppeteer-core。

設計の正は spec [`20260621-03-error-diagnostics-design.md`](../specs/20260621-03-error-diagnostics-design.md)。

---

## File Structure

- **Create** `src/diagnostics.ts` — 型（`EnvironmentInfo` / `ChromiumSource` / `ConvertContext`）と純粋関数（`maskHomePath` / `buildEnvironmentBlock` / `buildContextBlock` / `buildContextSummary` / `buildStartDiagnostics`）。vscode/os を import しない。
- **Create** `test/unit/diagnostics.test.ts` — 上記の純粋関数のユニットテスト。
- **Modify** `src/chromium-resolver.ts` — `ChromiumResolution` 型、`resolveChromiumPath` の戻り値拡張、`getPuppeteerCoreVersion()` 追加。
- **Modify** `test/unit/chromium-resolver.test.ts` — `resolveChromiumPath` テスト6件の戻り値参照を `.path` に直し、`.source` 検証を追加。
- **Modify** `src/extension.ts` — `collectEnvironment()`、変換パイプラインへの `ctx`/`homeDir` 受け渡し、開始診断・補完ログ、`showErrorMessage` 拡張、診断コマンド、文言改善。
- **Modify** `package.json` — 診断コマンドの登録。

依存順: diagnostics.ts（Task 1-2）→ chromium-resolver.ts（Task 3）→ extension.ts/package.json（Task 4-7）→ 検証（Task 8）。

---

### Task 1: diagnostics.ts — 型と maskHomePath

**Files:**
- Create: `src/diagnostics.ts`
- Test: `test/unit/diagnostics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/diagnostics.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as diagnostics from '../../src/diagnostics';

const HOME = 'C:\\Users\\john';

describe('maskHomePath', () => {
  it('replaces a leading home directory with ~', () => {
    assert.equal(diagnostics.maskHomePath('C:\\Users\\john\\docs\\a.md', HOME), '~\\docs\\a.md');
  });
  it('is case-insensitive on the prefix', () => {
    assert.equal(diagnostics.maskHomePath('c:\\users\\john\\a.md', HOME), '~\\a.md');
  });
  it('returns unmatched paths unchanged', () => {
    assert.equal(diagnostics.maskHomePath('D:\\other\\a.md', HOME), 'D:\\other\\a.md');
  });
  it('returns input unchanged when path or homeDir is empty', () => {
    assert.equal(diagnostics.maskHomePath('', HOME), '');
    assert.equal(diagnostics.maskHomePath('C:\\x', ''), 'C:\\x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/unit/diagnostics.test.ts`
Expected: FAIL — cannot find module `../../src/diagnostics` (file not created yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/diagnostics.ts`:

```ts
// Diagnostic formatting helpers. Like logger.ts, this module imports neither
// vscode nor os, so it stays unit-testable under tsx without an editor runtime.
// Host-specific values (versions, home directory) are collected by extension.ts
// and passed in as data.

export interface EnvironmentInfo {
  extensionVersion: string;
  vscodeVersion: string;
  platform: string;          // process.platform, e.g. 'win32'
  osRelease: string;         // os.release()
  arch: string;              // process.arch
  nodeVersion: string;       // process.version
  puppeteerCoreVersion: string;
  expectedChromeBuildId: string;
}

// How the Chromium executable was resolved. Single source of truth for the
// union; chromium-resolver.ts imports this type.
export type ChromiumSource =
  | 'user-setting' | 'system' | 'latest' | 'cached' | 'bundled-fallback';

// Context for a single export invocation. Fields known up front are required;
// values resolved later in exportPdf() are optional and filled in as they become
// available, so the start block and error logs never show a stale path.
export interface ConvertContext {
  sourceFile: string;
  outputType: string;        // pdf/html/png/jpeg
  executablePath: string;    // configured value (may be empty)
  autoDownload: boolean;
  outputDirectory: string;   // configured value (may be empty)
  sanitize: string;
  outputPath?: string;             // filled after getOutputDir() in exportPdf
  resolvedChromiumPath?: string;   // filled in after Chromium resolution
  chromiumSource?: ChromiumSource; // filled in after Chromium resolution
}

// Replace a leading home-directory prefix with '~' (case-insensitive so the
// Windows drive-letter casing C:\ vs c:\ is absorbed). Empty/unmatched input is
// returned unchanged.
export function maskHomePath(p: string, homeDir: string): string {
  if (!p || !homeDir) {
    return p;
  }
  if (p.toLowerCase().startsWith(homeDir.toLowerCase())) {
    return '~' + p.slice(homeDir.length);
  }
  return p;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/unit/diagnostics.test.ts`
Expected: PASS (4 tests under `maskHomePath`).

- [ ] **Step 5: Commit**

```bash
git add src/diagnostics.ts test/unit/diagnostics.test.ts
git commit -m "feat: add diagnostics module with home path masking"
```

---

### Task 2: diagnostics.ts — 整形関数

**Files:**
- Modify: `src/diagnostics.ts`
- Test: `test/unit/diagnostics.test.ts`

- [ ] **Step 1: Add the failing tests**

First add this import to the **top** of `test/unit/diagnostics.test.ts` (keep all imports together at the top, to satisfy ESLint `import/first`):

```ts
import type { EnvironmentInfo, ConvertContext } from '../../src/diagnostics';
```

Then append the rest below the existing `maskHomePath` describe block:

```ts
const ENV: EnvironmentInfo = {
  extensionVersion: '2.1.0',
  vscodeVersion: '1.110.0',
  platform: 'win32',
  osRelease: '10.0.26220',
  arch: 'x64',
  nodeVersion: 'v20.18.0',
  puppeteerCoreVersion: '24.40.0',
  expectedChromeBuildId: '131.0.6778.204',
};

function makeContext(overrides: Partial<ConvertContext> = {}): ConvertContext {
  return {
    sourceFile: 'C:\\Users\\john\\docs\\sample.md',
    outputType: 'pdf',
    executablePath: '',
    autoDownload: true,
    outputDirectory: '',
    sanitize: 'gfm',
    ...overrides,
  };
}

describe('buildEnvironmentBlock', () => {
  it('includes all environment fields', () => {
    const block = diagnostics.buildEnvironmentBlock(ENV);
    assert.match(block, /=== Markdown PDF Diagnostics ===/);
    assert.match(block, /Extension: 2\.1\.0/);
    assert.match(block, /VS Code: 1\.110\.0/);
    assert.match(block, /OS: win32 10\.0\.26220 \(x64\)/);
    assert.match(block, /Node: v20\.18\.0/);
    assert.match(block, /puppeteer-core: 24\.40\.0/);
    assert.match(block, /Expected Chrome build: 131\.0\.6778\.204/);
  });
});

describe('buildContextBlock', () => {
  it('masks paths and shows (not set) for empty config', () => {
    const block = diagnostics.buildContextBlock(makeContext(), HOME);
    assert.match(block, /Source: ~\\docs\\sample\.md/);
    assert.match(block, /Type: pdf/);
    assert.match(block, /sanitize: gfm/);
    assert.match(block, /executablePath: \(not set\)/);
    assert.match(block, /chromium\.autoDownload: true/);
    assert.match(block, /outputDirectory: \(not set\)/);
  });
  it('masks a configured executablePath', () => {
    const block = diagnostics.buildContextBlock(
      makeContext({ executablePath: 'C:\\Users\\john\\chrome.exe' }), HOME);
    assert.match(block, /executablePath: ~\\chrome\.exe/);
  });
});

describe('buildContextSummary', () => {
  it('shows (unresolved) before outputPath/chromium are filled', () => {
    assert.equal(
      diagnostics.buildContextSummary(makeContext(), HOME),
      'type=pdf, source=~\\docs\\sample.md, output=(unresolved), chromium=(unresolved)');
  });
  it('includes resolved output and chromium source', () => {
    assert.equal(
      diagnostics.buildContextSummary(
        makeContext({ outputPath: 'C:\\Users\\john\\docs\\sample.pdf', chromiumSource: 'system' }), HOME),
      'type=pdf, source=~\\docs\\sample.md, output=~\\docs\\sample.pdf, chromium=system');
  });
});

describe('buildStartDiagnostics', () => {
  it('concatenates environment then context block', () => {
    const out = diagnostics.buildStartDiagnostics(ENV, makeContext(), HOME);
    assert.match(out, /=== Markdown PDF Diagnostics ===/);
    assert.match(out, /--- Convert ---/);
    assert.ok(out.indexOf('===') < out.indexOf('---'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test test/unit/diagnostics.test.ts`
Expected: FAIL — `buildEnvironmentBlock`/`buildContextBlock`/`buildContextSummary`/`buildStartDiagnostics` are not functions.

- [ ] **Step 3: Append the implementation**

Append to `src/diagnostics.ts`:

```ts
// Render a value for display, substituting a placeholder for empty input.
function orNotSet(value: string): string {
  return value && value.length > 0 ? value : '(not set)';
}

export function buildEnvironmentBlock(env: EnvironmentInfo): string {
  return [
    '=== Markdown PDF Diagnostics ===',
    'Extension: ' + env.extensionVersion,
    'VS Code: ' + env.vscodeVersion,
    'OS: ' + env.platform + ' ' + env.osRelease + ' (' + env.arch + ')',
    'Node: ' + env.nodeVersion,
    'puppeteer-core: ' + env.puppeteerCoreVersion,
    'Expected Chrome build: ' + env.expectedChromeBuildId,
  ].join('\n');
}

export function buildContextBlock(ctx: ConvertContext, homeDir: string): string {
  return [
    '--- Convert ---',
    'Source: ' + maskHomePath(ctx.sourceFile, homeDir),
    'Type: ' + ctx.outputType,
    'sanitize: ' + ctx.sanitize,
    'executablePath: ' + orNotSet(maskHomePath(ctx.executablePath, homeDir)),
    'chromium.autoDownload: ' + String(ctx.autoDownload),
    'outputDirectory: ' + orNotSet(maskHomePath(ctx.outputDirectory, homeDir)),
  ].join('\n');
}

export function buildStartDiagnostics(env: EnvironmentInfo, ctx: ConvertContext, homeDir: string): string {
  return buildEnvironmentBlock(env) + '\n' + buildContextBlock(ctx, homeDir);
}

// One-line context summary for error logs (type / output / source / chromium).
// The full block is already emitted at export start, so this only re-states
// which invocation failed.
export function buildContextSummary(ctx: ConvertContext, homeDir: string): string {
  const output = ctx.outputPath ? maskHomePath(ctx.outputPath, homeDir) : '(unresolved)';
  const chromium = ctx.chromiumSource ?? '(unresolved)';
  return 'type=' + ctx.outputType +
    ', source=' + maskHomePath(ctx.sourceFile, homeDir) +
    ', output=' + output +
    ', chromium=' + chromium;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test test/unit/diagnostics.test.ts`
Expected: PASS (all `diagnostics` tests).

- [ ] **Step 5: Commit**

```bash
git add src/diagnostics.ts test/unit/diagnostics.test.ts
git commit -m "feat: add diagnostics formatting helpers"
```

---

### Task 3: chromium-resolver.ts — 出所(source)を返す

**Files:**
- Modify: `src/chromium-resolver.ts`
- Test: `test/unit/chromium-resolver.test.ts`

- [ ] **Step 1: Update the resolveChromiumPath tests to expect `{ path, source }`**

In `test/unit/chromium-resolver.test.ts`, the `describe('resolveChromiumPath', ...)` block has 6 tests asserting on a bare string/null. Change each `assert.strictEqual(result, X)` as follows (the `null` case is unchanged):

| Test (it title) | Old assertion | New assertions |
|---|---|---|
| returns user setting path immediately | `assert.strictEqual(result, existingExecutablePath)` | `assert.strictEqual(result?.path, existingExecutablePath); assert.strictEqual(result?.source, 'user-setting')` |
| download latest build id | `assert.strictEqual(result, '/cache/chrome/installed-latest')` | `assert.strictEqual(result?.path, '/cache/chrome/installed-latest'); assert.strictEqual(result?.source, 'latest')` |
| return cached path when JSON fetch fails | `assert.strictEqual(result, '/cache/chrome/130')` | `assert.strictEqual(result?.path, '/cache/chrome/130'); assert.strictEqual(result?.source, 'cached')` |
| fall back to bundled puppeteer-core build | `assert.strictEqual(result, '/cache/chrome/bundled')` | `assert.strictEqual(result?.path, '/cache/chrome/bundled'); assert.strictEqual(result?.source, 'bundled-fallback')` |
| return cached path when autoDownload=false | `assert.strictEqual(result, '/cache/chrome/130')` | `assert.strictEqual(result?.path, '/cache/chrome/130'); assert.strictEqual(result?.source, 'cached')` |
| return null when nothing available | `assert.strictEqual(result, null)` | unchanged |

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test test/unit/chromium-resolver.test.ts`
Expected: FAIL — `result?.path` is undefined because `resolveChromiumPath` still returns a string.

- [ ] **Step 3: Add the type and the puppeteer-core version helper**

In `src/chromium-resolver.ts`, add the `ChromiumSource` import and `ChromiumResolution` type near the top (after the existing imports on line 7), and a version accessor next to the existing `require('puppeteer-core')` block (around line 12):

```ts
import type { ChromiumSource } from './diagnostics';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const puppeteerPkg: { version: string } = require('puppeteer-core/package.json');

export interface ChromiumResolution {
  path: string;
  source: ChromiumSource;
}

/** Returns the installed puppeteer-core package version (for diagnostics). */
export function getPuppeteerCoreVersion(): string {
  return puppeteerPkg.version;
}
```

- [ ] **Step 4: Change resolveChromiumPath to return `{ path, source }`**

Replace the body of `resolveChromiumPath` (currently `extension.ts` callers expect a string; this changes it to `ChromiumResolution | null`):

```ts
export async function resolveChromiumPath(
  userExecutablePath: string,
  cacheDir: string,
  options?: ResolveChromiumPathOptions
): Promise<ChromiumResolution | null> {
  const autoDownload = options?.autoDownload !== false;
  const onProgress = options?.onProgress;

  const userPath = findChromiumFromUserSetting(userExecutablePath);
  if (userPath) {
    return { path: userPath, source: 'user-setting' };
  }

  const systemPath = findChromiumFromSystem();
  if (systemPath) {
    return { path: systemPath, source: 'system' };
  }

  if (!autoDownload) {
    const cached = await findLatestCachedChromium(cacheDir);
    return cached ? { path: cached, source: 'cached' } : null;
  }

  const latestBuildId = await fetchLatestStableBuildId();
  if (latestBuildId) {
    try {
      const latestPath = await ensureChromiumDownloaded(cacheDir, latestBuildId, onProgress);
      return { path: latestPath, source: 'latest' };
    } catch (error) {
      logError('Failed to download latest Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
      return null;
    }
  }

  // JSON fetch failed: prefer existing cache, then fall back to bundled build id.
  const cachedPath = await findLatestCachedChromium(cacheDir);
  if (cachedPath) {
    logWarn('Falling back to cached Chromium build');
    return { path: cachedPath, source: 'cached' };
  }

  const fallbackBuildId = getExpectedBuildId();
  logWarn('Falling back to bundled Chromium build: ' + fallbackBuildId);
  try {
    const bundled = await ensureChromiumDownloaded(cacheDir, fallbackBuildId, onProgress);
    return { path: bundled, source: 'bundled-fallback' };
  } catch (error) {
    logError('All Chromium acquisition attempts failed: ' + (error && (error as Error).message ? (error as Error).message : error));
    return null;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test test/unit/chromium-resolver.test.ts`
Expected: PASS (all resolver tests, including the new `.source` assertions).

- [ ] **Step 6: Commit**

```bash
git add src/chromium-resolver.ts test/unit/chromium-resolver.test.ts
git commit -m "feat: return chromium source from resolveChromiumPath"
```

---

### Task 4: extension.ts — 環境収集・resolver 呼び出し元更新・showErrorMessage 拡張

This task is in the vscode-dependent `extension.ts`, so it is verified by `npm run check` (types) and `npm run build` (esbuild), not unit tests.

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Import diagnostics**

After the existing `import * as logger from './logger';` (line 9), add:

```ts
import * as diagnostics from './diagnostics';
```

- [ ] **Step 2: Add collectEnvironment()**

Add after `getAutoDownload()` (around line 52):

```ts
/** Collects a host environment snapshot for diagnostics. */
function collectEnvironment(): diagnostics.EnvironmentInfo {
  return {
    extensionVersion: extensionContext?.extension.packageJSON.version ?? 'unknown',
    vscodeVersion: vscode.version,
    platform: process.platform,
    osRelease: os.release(),
    arch: process.arch,
    nodeVersion: process.version,
    puppeteerCoreVersion: chromiumResolver.getPuppeteerCoreVersion(),
    expectedChromeBuildId: chromiumResolver.getExpectedBuildId(),
  };
}
```

- [ ] **Step 3: Extend showErrorMessage with an optional context argument**

Replace the existing `showErrorMessage` (around line 739):

```ts
function showErrorMessage(msg: string, error?: unknown, context?: string): void {
  // Log first so detail (incl. stack via formatError) is in the channel by the
  // time the user clicks "Show Output".
  logger.logError(msg);
  if (context) {
    logger.logError(context);
  }
  if (error) {
    logger.logError(logger.formatError(error));
  }
  vscode.window.showErrorMessage('ERROR: ' + msg, SHOW_OUTPUT_ACTION).then(function (selection) {
    if (selection === SHOW_OUTPUT_ACTION) {
      logger.showLog();
    }
  });
}
```

- [ ] **Step 4: Update the resolveChromiumPath caller in exportPdf**

Replace the block in `exportPdf` (currently around lines 436-461) that calls `resolveChromiumPath` and builds `launchOptions`:

```ts
        const resolution = await chromiumResolver.resolveChromiumPath(userExecPath, cacheDir, {
          autoDownload: getAutoDownload()
        });
        if (!resolution) {
          if (utils.isExistsPath(tmpfilename)) {
            deleteFile(tmpfilename);
          }
          if (!getAutoDownload()) {
            showErrorMessage(
              'Chromium not found. Automatic download is disabled (markdown-pdf.chromium.autoDownload = false). ' +
              'Install Google Chrome / Chromium / Microsoft Edge, set markdown-pdf.executablePath, ' +
              'or enable markdown-pdf.chromium.autoDownload. ' +
              'See https://github.com/yzane/vscode-markdown-pdf#install'
            );
          } else {
            showErrorMessage('Chromium or Chrome does not exist! See https://github.com/yzane/vscode-markdown-pdf#install');
          }
          return;
        }
        const launchOptions = {
          executablePath: resolution.path,
          args: ['--lang=' + vscode.env.language, '--no-sandbox', '--disable-setuid-sandbox']
          // Setting Up Chrome Linux Sandbox
          // https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
        };
```

> Note: `ctx.resolvedChromiumPath` / `ctx.chromiumSource`補完ログは Task 5 で `ctx` を配線した後に追加する。本ステップでは `resolution.path` を `launchOptions` に渡すところまで。

- [ ] **Step 5: Update the resolveChromiumPath caller in installChromium**

Replace the block in `installChromium` (currently around lines 698-710):

```ts
    const resolution = await chromiumResolver.resolveChromiumPath('', cacheDir, {
      autoDownload: true,
      onProgress: onProgress
    });

    if (resolution) {
      INSTALL_CHECK = true;
      statusbarmessage.dispose();
      vscode.window.setStatusBarMessage('$(markdown) Chromium installation succeeded!', StatusbarMessageTimeout);
      vscode.window.showInformationMessage('[Markdown PDF] Chromium installation succeeded.');
    } else {
      throw new Error('resolveChromiumPath returned null');
    }
```

- [ ] **Step 6: Verify types and build**

Run: `npm run check`
Expected: no type errors.

Run: `npm run build`
Expected: esbuild writes `dist/extension.js` with no errors (confirms `require('puppeteer-core/package.json')` bundles).

- [ ] **Step 7: Commit**

```bash
git add src/extension.ts
git commit -m "feat: collect environment info and consume chromium resolution"
```

---

### Task 5: extension.ts — 変換コンテキストの配線・開始診断・補完ログ・各 catch context

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Build ctx, emit start diagnostics, and pass ctx/homeDir through the pipeline**

In `markdownPdf`, inside the `for` loop over `types` (currently around lines 129-145), the body for a valid format currently is:

```ts
        if (types_format.indexOf(type) >= 0) {
          filename = mdfilename.replace(ext, '.' + type);
          const text = editor.document.getText();
          const converted = convertMarkdownToHtml(mdfilename, type, text);
          if (converted) {
            sanitizeReport = converted.report;
          }
          const html = makeHtml(converted ? converted.html : undefined, uri);
          await exportPdf(html, filename, type, uri);
        } else {
```

Replace it with (collect `env`/`homeDir` once before the loop, build `ctx` per type, emit the start block, thread `ctx`/`homeDir`):

```ts
        if (types_format.indexOf(type) >= 0) {
          filename = mdfilename.replace(ext, '.' + type);
          const text = editor.document.getText();
          const ctx: diagnostics.ConvertContext = {
            sourceFile: mdfilename,
            outputType: type,
            executablePath: vscode.workspace.getConfiguration('markdown-pdf')['executablePath'] || '',
            autoDownload: getAutoDownload(),
            outputDirectory: vscode.workspace.getConfiguration('markdown-pdf')['outputDirectory'] || '',
            sanitize: sanitizeMode,
          };
          logger.logInfo(diagnostics.buildStartDiagnostics(env, ctx, homeDir));
          const converted = convertMarkdownToHtml(mdfilename, type, text, ctx, homeDir);
          if (converted) {
            sanitizeReport = converted.report;
          }
          const html = makeHtml(converted ? converted.html : undefined, uri, ctx, homeDir);
          await exportPdf(html, filename, type, uri, ctx, homeDir);
        } else {
```

Then add `env`/`homeDir` collection just before the `for` loop (immediately after the `sanitizeReport` initialization, around line 128):

```ts
      const env = collectEnvironment();
      const homeDir = os.homedir();
```

- [ ] **Step 2: Update convertMarkdownToHtml signature and its catches**

Change the signature (line 204) and both `catch` blocks (the nested one around line 359 and the outer one around line 365). New signature:

```ts
function convertMarkdownToHtml(
  filename: string,
  type: string,
  text: string,
  ctx: diagnostics.ConvertContext,
  homeDir: string
): { html: string; report: utils.SanitizeReport } | undefined {
```

Both `catch` blocks change from `showErrorMessage('convertMarkdownToHtml()', error);` to:

```ts
      showErrorMessage('convertMarkdownToHtml()', error, diagnostics.buildContextSummary(ctx, homeDir));
```

- [ ] **Step 3: Update makeHtml signature and its catch**

Change the signature (line 372) and the `catch` (around line 395). New signature:

```ts
function makeHtml(
  data: string | undefined,
  uri: vscode.Uri,
  ctx: diagnostics.ConvertContext,
  homeDir: string
): string | undefined {
```

The `catch` changes from `showErrorMessage('makeHtml()', error);` to:

```ts
    showErrorMessage('makeHtml()', error, diagnostics.buildContextSummary(ctx, homeDir));
```

- [ ] **Step 4: Update exportPdf signature, add completion logs, update its catch**

Change the signature (line 414):

```ts
function exportPdf(
  data: string | undefined,
  filename: string,
  type: string,
  uri: vscode.Uri,
  ctx: diagnostics.ConvertContext,
  homeDir: string
): Thenable<void> {
```

After `const exportFilename = getOutputDir(filename, uri);` (line 417), add an early return for the unresolved-output-dir case, then the output-path completion log. The early return fixes a latent bug: currently exportPdf continues with `exportFilename as string` even when `getOutputDir` returned `undefined`.

```ts
  if (!exportFilename) {
    return Promise.resolve();  // getOutputDir already showed an error toast
  }
  ctx.outputPath = exportFilename;
  logger.logInfo('Output: ' + diagnostics.maskHomePath(exportFilename, homeDir));
```

> Note: this `return` sits before `return vscode.window.withProgress(...)`, so it returns `Promise.resolve()` to satisfy the `Thenable<void>` return type. Once this guard is in place, the later `exportFilename as string` casts can stay as-is (the value is now guaranteed defined).

After the `launchOptions` block (i.e. once `resolution` is known, inside the `try`, just before `const browser = await puppeteer.launch(launchOptions);`), add the Chromium completion log:

```ts
        ctx.resolvedChromiumPath = resolution.path;
        ctx.chromiumSource = resolution.source;
        logger.logInfo('Chromium: ' + diagnostics.maskHomePath(resolution.path, homeDir) + ' (source: ' + resolution.source + ')');
```

The `catch` (around line 534) changes from `showErrorMessage('exportPdf()', error);` to:

```ts
        showErrorMessage('exportPdf()', error, diagnostics.buildContextSummary(ctx, homeDir));
```

- [ ] **Step 5: Verify types and build**

Run: `npm run check`
Expected: no type errors (all four call sites now pass `ctx`/`homeDir`).

Run: `npm run build`
Expected: esbuild succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/extension.ts
git commit -m "feat: emit start diagnostics and thread convert context through the pipeline"
```

---

### Task 6: 診断コマンド (Output Diagnostics)

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`

- [ ] **Step 1: Register the command in package.json**

In `contributes.commands`, add an entry (after the existing `extension.markdown-pdf.all` entry):

```json
      {
        "command": "extension.markdown-pdf.diagnostics",
        "title": "Markdown PDF: Output Diagnostics",
        "group": "markdown-pdf"
      }
```

In `activationEvents`, add:

```json
    "onCommand:extension.markdown-pdf.diagnostics",
```

In `contributes.menus.commandPalette`, add an entry **without** a `when` clause so it is runnable even when no markdown file is open:

```json
        {
          "command": "extension.markdown-pdf.diagnostics"
        }
```

> Do not add it to `editor/context` — diagnostics is a rare action and should not clutter the right-click menu.

- [ ] **Step 2: Implement the command handler**

Add this function in `src/extension.ts` (near `collectEnvironment`):

```ts
/** Outputs an environment snapshot and current settings to the channel, then reveals it. */
function outputDiagnostics(): void {
  const env = collectEnvironment();
  const homeDir = os.homedir();
  const config = vscode.workspace.getConfiguration('markdown-pdf');
  logger.logInfo(diagnostics.buildEnvironmentBlock(env));
  logger.logInfo([
    '--- Settings ---',
    'type: ' + JSON.stringify(config['type']),
    'sanitize: ' + (config['sanitize'] || 'gfm'),
    'executablePath: ' + (diagnostics.maskHomePath(config['executablePath'] || '', homeDir) || '(not set)'),
    'chromium.autoDownload: ' + String(getAutoDownload()),
    'outputDirectory: ' + (diagnostics.maskHomePath(config['outputDirectory'] || '', homeDir) || '(not set)'),
  ].join('\n'));
  logger.showLog();
}
```

- [ ] **Step 3: Wire the command in activate()**

In `activate`, add to the `commands` array (after the `extension.markdown-pdf.all` registration, around line 69):

```ts
    vscode.commands.registerCommand('extension.markdown-pdf.diagnostics', function () { outputDiagnostics(); }),
```

- [ ] **Step 4: Verify types and build**

Run: `npm run check`
Expected: no type errors.

Run: `npm run build`
Expected: esbuild succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json src/extension.ts
git commit -m "feat: add Output Diagnostics command"
```

---

### Task 7: 文言改善（エラー文言＋警告ログ化）

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Add logWarn to the early-return guards in markdownPdf**

In `markdownPdf`, update the three guard blocks (lines 92-115). Each keeps its toast but adds a `logWarn` first, and the "file name" guard gets a clearer message:

```ts
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      logger.logWarn('Export aborted: no active editor.');
      vscode.window.showWarningMessage('No active Editor!');
      return;
    }

    const mode = editor.document.languageId;
    if (mode != 'markdown') {
      logger.logWarn('Export aborted: active document is not markdown (languageId=' + mode + ').');
      vscode.window.showWarningMessage('It is not a markdown mode!');
      return;
    }

    const uri = editor.document.uri;
    const mdfilename = uri.fsPath;
    const ext = path.extname(mdfilename);
    if (!utils.isExistsPath(mdfilename)) {
      if (editor.document.isUntitled) {
        logger.logWarn('Export aborted: document is untitled (unsaved).');
        vscode.window.showWarningMessage('Please save the file!');
        return;
      }
      logger.logWarn('Export aborted: cannot resolve a local file path for ' + uri.scheme + '://' + uri.fsPath);
      vscode.window.showWarningMessage(
        'Cannot determine the file path. Virtual or remote workspaces (e.g. Azure DevOps) are not supported. Save the file to a local folder.'
      );
      return;
    }
```

- [ ] **Step 2: Replace the internal markdownPdf().1/2/3 messages**

Replace the three `showErrorMessage('markdownPdf().N Supported formats: ...')` calls. The user-facing text becomes friendly; the internal identifier moves to the context argument.

Line ~121 (`types === null`):

```ts
      showErrorMessage('Unsupported output format. Supported: html, pdf, png, jpeg.', undefined, 'markdownPdf() type guard #1 (resolveExportTypes returned null)');
```

Line ~142 (unknown `type` in the loop):

```ts
          showErrorMessage('Unsupported output format. Supported: html, pdf, png, jpeg.', undefined, 'markdownPdf() type guard #2 (unexpected type "' + type + '")');
```

Line ~149 (empty/invalid `types`):

```ts
      showErrorMessage('Unsupported output format. Supported: html, pdf, png, jpeg.', undefined, 'markdownPdf() type guard #3 (empty types)');
```

> The `Chromium or Chrome does not exist!` message (in exportPdf) already carries the install link and is left as-is.

- [ ] **Step 3: Verify types and build**

Run: `npm run check`
Expected: no type errors.

Run: `npm run build`
Expected: esbuild succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "feat: improve error and warning messages with diagnostic context"
```

---

### Task 8: 最終検証

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all unit tests including `diagnostics.test.ts` and the updated `chromium-resolver.test.ts`.

- [ ] **Step 2: Type-check and build**

Run: `npm run check && npm run build`
Expected: no type errors; `dist/extension.js` written.

- [ ] **Step 3: Manual verification in a dev host (F5)**

Confirm each scenario in the "Markdown PDF" output channel (Output panel):

1. **Normal export** (any `.md`, default settings): the start block (`=== Markdown PDF Diagnostics ===` + `--- Convert ---`) appears at export start, followed by `Output: ...` and `Chromium: ... (source: ...)`. All paths are masked with `~`.
2. **Chromium launch failure**: set `markdown-pdf.executablePath` to an existing folder (e.g. `C:\Windows`), export → one error toast (`ERROR: exportPdf()` + "Show Output"); the channel shows the `type=.. , source=.., output=.., chromium=user-setting` summary line plus the stack.
3. **Output Diagnostics command**: run "Markdown PDF: Output Diagnostics" from the Command Palette with no markdown open → environment + settings printed and the channel revealed.
4. **Virtual/remote workspace guard**: confirm the new `Cannot determine the file path...` message and a corresponding `logWarn` line.
5. Reset `markdown-pdf.executablePath` to empty afterward.

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch` to integrate `feature/error-diagnostics` into `develop` (subject to the AGENTS.md merge-confirmation rule).

---

## Notes for the implementer

- **Branch:** work happens in the `feature/error-diagnostics` worktree (`.worktrees/feature-error-diagnostics`). Stay on this branch; do not commit to `develop`/`master`.
- **Comments in English; spec/plan prose in Japanese** (AGENTS.md).
- **`require('puppeteer-core/package.json')`**: if `npm run build` fails to bundle this, fall back to reading the version from the extension's own `package.json` devDependency string, or hardcode `'unknown'` — but verify the bundle first; esbuild normally inlines JSON imports fine.
- **No README/CHANGELOG changes** in this branch (done at release time per the spec).
