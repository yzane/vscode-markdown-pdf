# OutputChannel ロガー基盤 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VS Code の `LogOutputChannel`（チャネル名 `Markdown PDF`）を用いたログ基盤を新規実装し、ユーザー影響のある既存 `console.*` 出力を移行する（issue #437 要素③）。

**Architecture:** `src/logger.ts` を **vscode 非依存**の薄いファサードとして新設する。`LogSink` interface だけに依存し、実体（`LogOutputChannel`）は唯一 vscode を扱う `extension.ts` が `initializeLogger(host, createChannel)` 経由で注入する（依存性逆転）。これにより `utils.ts` / `math-renderer.ts` / `chromium-resolver.ts` は vscode 非依存のまま logger を import でき、`tsx --test` のユニットテストが成立し続ける。

**Tech Stack:** TypeScript / VS Code Extension API（`LogOutputChannel`, engine `^1.110.0`）/ esbuild バンドル / `node:test` + `tsx`（ユニット）/ `@vscode/test-cli`（統合）。

**Spec:** [`docs/superpowers/specs/20260613-01-output-channel-logger-design.md`](../specs/20260613-01-output-channel-logger-design.md)

**Branch:** `feature/output-channel-logger`（worktree: `.worktrees/feature-output-channel-logger`）。全タスクをこのブランチ上で実施する。

---

## 全体の制約（全タスク共通）

- **`src/logger.ts` に `vscode` の import を絶対に入れない**（コメント含めソースに `vscode` の語を出さない）。
- **`utils.ts` / `math-renderer.ts` / `chromium-resolver.ts` からは `./logger` だけを import する**（`vscode` を import しない）。
- コードコメントは英語（リポジトリ規約）。
- 検証コマンド: 型チェック `npm run check`、ユニット `npm run test:unit`、バンドル `npm run build`。
- すべてのコマンドは worktree ルート `.worktrees/feature-output-channel-logger` で実行する。

---

## ファイル構成

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/logger.ts` | ログファサード（`LogSink` / `setLogSink` / `logInfo/Warn/Error` / `showLog` / `formatError` / `initializeLogger`）。vscode 非依存 | 新規 |
| `test/unit/logger.test.ts` | logger 単体テスト | 新規 |
| `src/extension.ts` | `activate()` で実体注入、`showErrorMessage` を logger へ移行 | 修正 |
| `src/utils.ts` | `readFile` を単一 try/catch 化し logger へ移行 | 修正 |
| `test/unit/utils.test.ts` | `readFile` の logger 出力テストを追加 | 修正 |
| `src/math-renderer.ts` | KaTeX fallback の console.warn を logger へ移行 | 修正 |
| `test/unit/math-renderer.test.ts` | fallback 時の logWarn テストを追加 | 修正 |
| `src/chromium-resolver.ts` | console.* 全10箇所を logger へ移行 | 修正 |

---

## Task 0: ブランチ / worktree の確認（プリフライト）

**Files:** （変更なし。確認のみ。）

- [ ] **Step 1: 正しいブランチ・worktree にいることを確認**

Run: `git branch --show-current && git status --short`
Expected: ブランチが `feature/output-channel-logger` であること。`git status` はクリーン（または spec/plan 以外の未コミット変更がないこと）。異なるブランチの場合は worktree `.worktrees/feature-output-channel-logger` で作業しているか確認し、誤っていれば中断して報告する。

---

## Task 1: logger.ts のファサード（転送・no-op・showLog）

**Files:**
- Create: `src/logger.ts`
- Test: `test/unit/logger.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/logger.test.ts` を新規作成:

```ts
import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import * as logger from '../../src/logger';
import type { LogSink } from '../../src/logger';

interface Recorded { method: string; args: unknown[]; }

function makeFakeSink(): { sink: LogSink; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const sink: LogSink = {
    info: (...args: unknown[]) => { calls.push({ method: 'info', args }); },
    warn: (...args: unknown[]) => { calls.push({ method: 'warn', args }); },
    error: (...args: unknown[]) => { calls.push({ method: 'error', args }); },
    show: (...args: unknown[]) => { calls.push({ method: 'show', args }); },
  };
  return { sink, calls };
}

describe('logger', () => {
  afterEach(() => {
    logger.setLogSink(undefined);
  });

  it('forwards logInfo/logWarn/logError to the sink with all arguments', () => {
    const { sink, calls } = makeFakeSink();
    logger.setLogSink(sink);

    logger.logInfo('hello', 1, 'a');
    logger.logWarn('careful', { x: 1 });
    logger.logError('boom');

    assert.deepEqual(calls, [
      { method: 'info', args: ['hello', 1, 'a'] },
      { method: 'warn', args: ['careful', { x: 1 }] },
      { method: 'error', args: ['boom'] },
    ]);
  });

  it('showLog calls sink.show(true)', () => {
    const { sink, calls } = makeFakeSink();
    logger.setLogSink(sink);

    logger.showLog();

    assert.deepEqual(calls, [{ method: 'show', args: [true] }]);
  });

  it('is a no-op when no sink is set', () => {
    logger.setLogSink(undefined);
    assert.doesNotThrow(() => {
      logger.logInfo('x');
      logger.logWarn('y');
      logger.logError('z');
      logger.showLog();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: FAIL（`src/logger.ts` が存在せず import 解決に失敗）。

- [ ] **Step 3: logger.ts を実装**

`src/logger.ts` を新規作成:

```ts
// Lightweight logging facade. Stays free of any editor API import so that modules
// importing it (utils, math-renderer, chromium-resolver) remain unit-testable
// under tsx without a real editor runtime. The concrete sink is injected by
// extension.ts (the only host-aware module) at activation time.

export interface LogSink {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  show(preserveFocus?: boolean): void;
}

let sink: LogSink | undefined;

export function setLogSink(s: LogSink | undefined): void {
  sink = s;
}

export function logInfo(message: string, ...args: unknown[]): void {
  sink?.info(message, ...args);
}

export function logWarn(message: string, ...args: unknown[]): void {
  sink?.warn(message, ...args);
}

export function logError(message: string, ...args: unknown[]): void {
  sink?.error(message, ...args);
}

export function showLog(): void {
  sink?.show(true);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:unit`
Expected: PASS（logger の3テストが通る。既存テストも全通過）。

- [ ] **Step 5: 型チェック**

Run: `npm run check`
Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add src/logger.ts test/unit/logger.test.ts
git commit -m "feat: add vscode-free logger facade (LogSink, log*, showLog)"
```

---

## Task 2: formatError（Error の決定論的文字列化）

**Files:**
- Modify: `src/logger.ts`
- Test: `test/unit/logger.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/logger.test.ts` の `describe('logger', ...)` ブロック内末尾（`'is a no-op ...'` の `it` の後）に追加:

```ts
  describe('formatError', () => {
    it('returns the stack for an Error that has one', () => {
      const err = new Error('boom');
      assert.equal(logger.formatError(err), err.stack);
    });

    it('falls back to "name: message" when stack is absent', () => {
      const err = new Error('boom');
      err.stack = undefined;
      assert.equal(logger.formatError(err), 'Error: boom');
    });

    it('stringifies non-Error values', () => {
      assert.equal(logger.formatError('plain'), 'plain');
      assert.equal(logger.formatError(42), '42');
      assert.equal(logger.formatError(null), 'null');
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: FAIL（`logger.formatError is not a function`）。

- [ ] **Step 3: formatError を実装**

`src/logger.ts` の末尾に追加:

```ts
// Deterministically stringify an unknown error for logging. Prefer the stack
// (richest debug info); fall back to "name: message"; non-Error values via String().
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:unit`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/logger.ts test/unit/logger.test.ts
git commit -m "feat: add formatError for deterministic error stringification"
```

---

## Task 3: initializeLogger（実体生成・登録・注入）

**Files:**
- Modify: `src/logger.ts`
- Test: `test/unit/logger.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/logger.test.ts` の `describe('logger', ...)` ブロック内に追加（`formatError` の describe の後）:

```ts
  describe('initializeLogger', () => {
    it('creates the channel once, registers it, and routes logs to it', () => {
      const pushed: { dispose(): void }[] = [];
      const host = { subscriptions: { push: (d: { dispose(): void }) => { pushed.push(d); } } };
      const warnCalls: unknown[][] = [];
      let created = 0;
      const channel = {
        info() {},
        warn(...a: unknown[]) { warnCalls.push(a); },
        error() {},
        show() {},
        dispose() {},
      };
      const factory = () => { created++; return channel; };

      logger.initializeLogger(host, factory);

      assert.equal(created, 1);
      assert.equal(pushed.length, 1);
      assert.equal(pushed[0], channel);

      logger.logWarn('routed');
      assert.deepEqual(warnCalls, [['routed']]);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: FAIL（`logger.initializeLogger is not a function`）。

- [ ] **Step 3: LoggerHost と initializeLogger を実装**

`src/logger.ts` の `LogSink` interface 直後（`let sink ...` の前）に `LoggerHost` を追加:

```ts
// Minimal host shape needed for initialization. The editor's ExtensionContext
// satisfies this structurally (no editor API import required here).
export interface LoggerHost {
  subscriptions: { push(disposable: { dispose(): void }): void };
}
```

`setLogSink` の直後に `initializeLogger` を追加:

```ts
// Build the concrete channel via the injected factory, register it for disposal
// on the host lifecycle, and wire it as the active sink. Injecting the
// factory keeps this unit-testable with a fake host and fake factory.
export function initializeLogger(
  host: LoggerHost,
  createChannel: () => LogSink & { dispose(): void }
): void {
  const channel = createChannel();
  host.subscriptions.push(channel);
  setLogSink(channel);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:unit`
Expected: PASS。

- [ ] **Step 5: 型チェック**

Run: `npm run check`
Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add src/logger.ts test/unit/logger.test.ts
git commit -m "feat: add initializeLogger for factory-injected channel wiring"
```

---

## Task 4: extension.ts へ配線 + showErrorMessage 移行

**Files:**
- Modify: `src/extension.ts`（import 追加、`activate` 内 `initializeLogger` 呼び出し、`showErrorMessage` の console.log 置換）

> 注: `extension.ts` は `vscode` を import するためユニットテスト（tsx）対象外。検証は `npm run check`（型）と `npm run build`（バンドル成功）で行う。logger の挙動自体は Task 1〜3 のユニットテストで担保済み。

- [ ] **Step 1: logger を import**

`src/extension.ts:8` の `import * as chromiumResolver from './chromium-resolver';` の直後に追加:

```ts
import * as logger from './logger';
```

- [ ] **Step 2: activate() で実体を注入**

`src/extension.ts` の `activate`（現行 53-55 行）を次のように変更。

変更前:
```ts
export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  init();
```

変更後:
```ts
export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  logger.initializeLogger(
    context,
    () => vscode.window.createOutputChannel('Markdown PDF', { log: true })
  );
  init();
```

- [ ] **Step 3: showErrorMessage を logger へ移行**

`src/extension.ts` の `showErrorMessage`（現行 711-718 行）を変更。

変更前:
```ts
function showErrorMessage(msg: string, error?: unknown): void {
  vscode.window.showErrorMessage('ERROR: ' + msg);
  console.log('ERROR: ' + msg);
  if (error) {
    vscode.window.showErrorMessage(String(error));
    console.log(error);
  }
}
```

変更後:
```ts
function showErrorMessage(msg: string, error?: unknown): void {
  vscode.window.showErrorMessage('ERROR: ' + msg);
  logger.logError(msg);
  if (error) {
    vscode.window.showErrorMessage(String(error));
    logger.logError(logger.formatError(error));
  }
}
```

- [ ] **Step 4: 型チェックとバンドル**

Run: `npm run check && npm run build`
Expected: 双方ともエラーなしで完了（`dist/extension.js` 生成）。`createOutputChannel(..., {log:true})` は `LogOutputChannel` を返し、`LogSink & {dispose}` を構造的に満たす。

- [ ] **Step 5: showErrorMessage に console が残っていないことを確認**

Run: `git grep -n "console\." src/extension.ts`
Expected: 出力なし（extension.ts には移行対象以外の console は元々存在しない）。

- [ ] **Step 6: コミット**

```bash
git add src/extension.ts
git commit -m "feat: wire LogOutputChannel in activate and route showErrorMessage to logger"
```

---

## Task 5: utils.ts readFile を単一 try/catch 化し logger へ移行

**Files:**
- Modify: `src/utils.ts`（import 追加、`readFile` のロジック変更）
- Test: `test/unit/utils.test.ts`（logger import、新規テスト追加）

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/utils.test.ts:4`（`import * as utils from '../../src/utils';` の直後）に logger import を追加:

```ts
import * as logger from '../../src/logger';
```

`test/unit/utils.test.ts` の `describe('readFile', ...)` ブロック内（現行 224 行の閉じ `});` の直前、最後の `it` の後）に追加:

```ts
    it('logs "File not found" via logWarn for a non-existent file', function () {
      const calls: unknown[][] = [];
      logger.setLogSink({ info() {}, warn: (...a: unknown[]) => { calls.push(a); }, error() {}, show() {} });
      try {
        const result = utils.readFile('/nonexistent/file.txt');
        assert.strictEqual(result, '');
        assert.strictEqual(calls.length, 1);
        assert.match(String(calls[0][0]), /^File not found:/);
      } finally {
        logger.setLogSink(undefined);
      }
    });

    it('logs "Failed to read file" via logWarn when given a directory', function () {
      const calls: unknown[][] = [];
      logger.setLogSink({ info() {}, warn: (...a: unknown[]) => { calls.push(a); }, error() {}, show() {} });
      try {
        const result = utils.readFile(__dirname);
        assert.strictEqual(result, '');
        assert.strictEqual(calls.length, 1);
        assert.match(String(calls[0][0]), /^Failed to read file:/);
      } finally {
        logger.setLogSink(undefined);
      }
    });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: FAIL（現行 `readFile` は logger を呼ばないため `calls.length` が 0 になり assertion 失敗）。

- [ ] **Step 3: utils.ts に logger を import**

`src/utils.ts:10` の `import { githubSlugify } from './markdown-it-named-headers';` の直後に追加:

```ts
import { logWarn, formatError } from './logger';
```

- [ ] **Step 4: readFile のロジックを変更**

`src/utils.ts` の `readFile` 内、ファイル存在判定ブロック（現行）を置換。

変更前:
```ts
  if (isExistsPath(filename)) {
    try {
      return fs.readFileSync(filename, encode);
    } catch (error: unknown) {
      console.warn((error as Error).message);
      return '';
    }
  } else {
    return '';
  }
```

変更後:
```ts
  try {
    return fs.readFileSync(filename, encode);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      logWarn(`File not found: ${filename}`);
    } else {
      logWarn(`Failed to read file: ${filename}`, formatError(error));
    }
    return '';
  }
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm run test:unit`
Expected: PASS（新規2テスト + 既存 readFile テスト（非存在→''、`__dirname`→''、empty path→'' 等）が全通過）。

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: エラーなし（`isExistsPath` は `buildKatexStyleTag` 等で引き続き使用されるため未使用警告は出ない）。

- [ ] **Step 7: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts
git commit -m "feat: route readFile failures to logger with not-found vs read-error context"
```

---

## Task 6: math-renderer.ts の KaTeX fallback を logger へ移行

**Files:**
- Modify: `src/math-renderer.ts`（import 追加、console.warn 置換）
- Test: `test/unit/math-renderer.test.ts`（logger import、fallback 時の logWarn テスト追加）

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/math-renderer.test.ts:3`（`import { renderMath } from '../../src/math-renderer';` の直後）に追加:

```ts
import * as logger from '../../src/logger';
```

`test/unit/math-renderer.test.ts` の `describe('renderMath', ...)` ブロック内末尾（最後の `it` の後、ブロックの閉じ `});` の直前）に追加:

```ts
  it('logs a warning via logger when falling back to <code>', () => {
    const calls: unknown[][] = [];
    logger.setLogSink({ info() {}, warn: (...a: unknown[]) => { calls.push(a); }, error() {}, show() {} });
    try {
      renderMath(undefined as unknown as string, false, {});
      assert.equal(calls.length, 1);
      assert.match(String(calls[0][0]), /KaTeX render failure/);
    } finally {
      logger.setLogSink(undefined);
    }
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: FAIL（現行は `console.warn` を使うため `calls.length` が 0）。

- [ ] **Step 3: math-renderer.ts に logger を import**

`src/math-renderer.ts:1` の `import katex, { KatexOptions } from 'katex';` の直後に追加:

```ts
import { logWarn } from './logger';
```

- [ ] **Step 4: console.warn を logWarn に置換**

`src/math-renderer.ts` の catch 内（現行 26-27 行）を置換。

変更前:
```ts
    // eslint-disable-next-line no-console
    console.warn('[markdown-pdf] KaTeX render failure, falling back to <code>:', (error as Error).message);
```

変更後:
```ts
    logWarn('KaTeX render failure, falling back to <code>: ' + (error as Error).message);
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm run test:unit`
Expected: PASS（新規テスト + 既存 renderMath テストが全通過）。

- [ ] **Step 6: 型チェック**

Run: `npm run check`
Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add src/math-renderer.ts test/unit/math-renderer.test.ts
git commit -m "feat: route KaTeX fallback warning to logger"
```

---

## Task 7: chromium-resolver.ts の console.* 全10箇所を移行

**Files:**
- Modify: `src/chromium-resolver.ts`（import 追加、console.* 10箇所を logger 呼び出しに置換、`[Markdown PDF]` プレフィックス除去）

> 注: `chromium-resolver.ts` のユニットテスト（`test/unit/chromium-resolver.test.ts`）は戻り値を検証しており console 出力には依存しない。移行後も logger 未注入で no-op となるため既存テストはそのまま通過する。

- [ ] **Step 1: logger を import**

`src/chromium-resolver.ts:6` の `import * as PB from '@puppeteer/browsers';` の直後に追加:

```ts
import { logInfo, logWarn, logError } from './logger';
```

- [ ] **Step 2: console.* を logger に置換（10箇所）**

以下の各文字列をそのまま置換する（`[Markdown PDF] ` プレフィックスを除去し、レベルを spec の対応表に合わせる）。

(1) Configured executablePath not found:
変更前:
```ts
    console.warn('[Markdown PDF] Configured executablePath not found: ' + executablePath);
```
変更後:
```ts
    logWarn('Configured executablePath not found: ' + executablePath);
```

(2) Latest version response shape:
変更前:
```ts
      console.warn('[Markdown PDF] Latest Chromium version response had unexpected shape');
```
変更後:
```ts
      logWarn('Latest Chromium version response had unexpected shape');
```

(3) Failed to fetch latest version:
変更前:
```ts
    console.warn('[Markdown PDF] Failed to fetch latest Chromium version: ' + msg);
```
変更後:
```ts
    logWarn('Failed to fetch latest Chromium version: ' + msg);
```

(4) Removed old Chromium（info）:
変更前:
```ts
        console.log('[Markdown PDF] Removed old Chromium: ' + installedBrowser.buildId);
```
変更後:
```ts
        logInfo('Removed old Chromium: ' + installedBrowser.buildId);
```

(5) Failed to remove old Chromium:
変更前:
```ts
        console.warn('[Markdown PDF] Failed to remove old Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
```
変更後:
```ts
        logWarn('Failed to remove old Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
```

(6) Failed to cleanup old Chromium:
変更前:
```ts
    console.warn('[Markdown PDF] Failed to cleanup old Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
```
変更後:
```ts
    logWarn('Failed to cleanup old Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
```

(7) Failed to download latest Chromium（error）:
変更前:
```ts
      console.error('[Markdown PDF] Failed to download latest Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
```
変更後:
```ts
      logError('Failed to download latest Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
```

(8) Falling back to cached build:
変更前:
```ts
    console.warn('[Markdown PDF] Falling back to cached Chromium build');
```
変更後:
```ts
    logWarn('Falling back to cached Chromium build');
```

(9) Falling back to bundled build:
変更前:
```ts
  console.warn('[Markdown PDF] Falling back to bundled Chromium build: ' + fallbackBuildId);
```
変更後:
```ts
  logWarn('Falling back to bundled Chromium build: ' + fallbackBuildId);
```

(10) All acquisition attempts failed（error）:
変更前:
```ts
    console.error('[Markdown PDF] All Chromium acquisition attempts failed: ' + (error && (error as Error).message ? (error as Error).message : error));
```
変更後:
```ts
    logError('All Chromium acquisition attempts failed: ' + (error && (error as Error).message ? (error as Error).message : error));
```

- [ ] **Step 3: console が残っていないことを確認**

Run: `git grep -n "console\." src/chromium-resolver.ts`
Expected: 出力なし。

- [ ] **Step 4: ユニットテストと型チェック**

Run: `npm run test:unit && npm run check`
Expected: 双方エラーなし（chromium-resolver の既存テストは戻り値検証のため影響なし）。

- [ ] **Step 5: コミット**

```bash
git add src/chromium-resolver.ts
git commit -m "feat: route chromium-resolver diagnostics to logger"
```

---

## Task 8: 最終検証（全テスト + バンドル + 残存 console 確認）

**Files:** （コード変更なし。検証のみ。）

- [ ] **Step 1: ユニットテスト全実行**

Run: `npm run test:unit`
Expected: 全 PASS（logger / utils / math-renderer / chromium-resolver 等）。

- [ ] **Step 2: 型チェック**

Run: `npm run check`
Expected: エラーなし。

- [ ] **Step 3: バンドル**

Run: `npm run build`
Expected: `dist/extension.js` がエラーなく生成される。

- [ ] **Step 4: 移行対象の console が残っていないこと / 据え置き分が残っていることを確認**

Run: `git grep -n "console\." src/`
Expected: `src/utils.ts` の `isExistsPath` / `isExistsDir` 内の `console.warn`（計3箇所）のみが残る。`extension.ts` / `math-renderer.ts` / `chromium-resolver.ts` / `readFile` には残っていない。

- [ ] **Step 5: logger.ts に vscode が混入していないことを確認**

Run: `git grep -n "vscode" src/logger.ts`
Expected: 出力なし。

> 統合テスト（`npm run test:integration`）は実 VS Code を起動するため任意。実行する場合は activation 時にエラーが出ないことの回帰確認となる（OutputChannel 生成自体の検証は Task 3 のユニットテストで担保済み、spec のテスト戦略参照）。CHANGELOG / README の追記は、要素①②（bugfix）と合流させてリリース時にまとめて行うため本計画には含めない。

---

## Self-Review チェック結果

- **Spec coverage**: logger.ts 全 API（LogSink/setLogSink/logInfo/logWarn/logError/showLog → Task1、formatError → Task2、LoggerHost/initializeLogger → Task3）、extension 配線 + showErrorMessage 移行（Task4）、readFile P1/P3 ロジック変更（Task5）、math-renderer 移行（Task6）、chromium-resolver 全10箇所（Task7）、テスト戦略（各 Task のテスト + Task8 検証）を網羅。据え置き対象（isExistsPath/isExistsDir）は Task8 Step4 で明示確認。
- **Placeholder scan**: TBD/TODO 等なし。各コードステップに実コードを記載。
- **Type consistency**: `LogSink` / `LoggerHost` / `initializeLogger(host, createChannel)` / `formatError` / `logInfo/logWarn/logError` / `showLog` の名称・シグネチャを全タスクで統一。`logWarn(message, ...args)` の可変長を utils/math-renderer の呼び出しと整合。
