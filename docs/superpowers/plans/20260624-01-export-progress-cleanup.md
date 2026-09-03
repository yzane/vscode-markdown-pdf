# Exporting 通知と一時 HTML 後処理の堅牢化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF/PNG/JPEG export 後の `browser.close()` が戻らない場合でも、`Exporting (...) ...` notification と一時 HTML cleanup が無期限に詰まらないようにする。

**Architecture:** `browser.close()` の待ち切りは VS Code / puppeteer 非依存の helper として `src/utils.ts` に置き、unit test で契約を固定する。`src/extension.ts` の `exportPdf()` は生成処理と cleanup を分離し、`finally` で close 待ち切りと一時 HTML 削除を独立して試みる。

**Tech Stack:** TypeScript strict, Node `node:test`, `tsx --test`, VS Code Extension API, `puppeteer-core`, synchronous file cleanup via `fs.rmSync`.

---

## 対象ブランチ

`bugfix/stuck-exporting-popups`（`develop` から分岐、`.worktrees/bugfix-stuck-exporting-popups`）。

この plan は [`20260624-01-export-progress-cleanup-design.md`](../specs/20260624-01-export-progress-cleanup-design.md) に基づく。退避済み stash の実装案は使わず、spec とこの plan から実装する。

## ファイル構成

- Modify: `src/utils.ts`
  - `awaitWithTimeout()` と戻り値型を追加する。
  - VS Code / puppeteer へ依存させない。
  - timeout 後の遅延 reject を観測し、未処理 rejection を出さない。
  - resolve / reject / timeout の全経路で timer を解放する。

- Create: `test/unit/await-with-timeout.test.ts`
  - helper の成功、期限前 reject、timeout、timeout 後の遅延 reject、timer 解放を検証する。

- Modify: `src/extension.ts`
  - `exportPdf()` の `withProgress` callback 内で `tmpfilename` と `browser` を `try` 外に出す。
  - Chromium 解決失敗分岐のインライン削除を消し、`finally` に cleanup を集約する。
  - `browser.close()` を待ち切り付きで呼び、失敗や timeout は OutputChannel warning にする。
  - 一時 HTML 削除は close 待ち切り後に行い、`debug=false` のときだけ実行する。
  - `page.goto(..., waitUntil: 'networkidle0')` の timeout は変更しない。

## Task 1: `awaitWithTimeout()` helper を TDD で追加する

**Files:**
- Create: `test/unit/await-with-timeout.test.ts`
- Modify: `src/utils.ts`

- [ ] **Step 1: 失敗する unit test を追加する**

Create `test/unit/await-with-timeout.test.ts` with this complete content:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as utils from '../../src/utils';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('awaitWithTimeout', () => {
  it('returns the resolved value when the promise settles before timeout', async () => {
    const result = await utils.awaitWithTimeout(Promise.resolve('done'), 100);

    assert.deepEqual(result, { timedOut: false, value: 'done' });
  });

  it('propagates rejection when the promise rejects before timeout', async () => {
    const error = new Error('early failure');

    await assert.rejects(
      utils.awaitWithTimeout(Promise.reject(error), 100),
      error
    );
  });

  it('returns timedOut true when the promise stays pending past timeout', async () => {
    const pending = new Promise<string>(() => undefined);

    const result = await utils.awaitWithTimeout(pending, 5);

    assert.deepEqual(result, { timedOut: true });
  });

  it('does not emit unhandledRejection when the original promise rejects after timeout', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    let rejectLater!: (error: Error) => void;
    const lateRejecting = new Promise<void>((_, reject) => {
      rejectLater = reject;
    });

    try {
      const result = await utils.awaitWithTimeout(lateRejecting, 5);
      assert.deepEqual(result, { timedOut: true });

      rejectLater(new Error('late failure'));
      await delay(0);

      assert.deepEqual(unhandled, []);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('clears the timeout when the original promise resolves before timeout', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const fakeHandle = { kind: 'timeout' } as unknown as ReturnType<typeof setTimeout>;
    let cleared = false;

    try {
      global.setTimeout = ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => {
        return fakeHandle;
      }) as typeof setTimeout;
      global.clearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
        if (handle === fakeHandle) {
          cleared = true;
        }
      }) as typeof clearTimeout;

      const result = await utils.awaitWithTimeout(Promise.resolve('fast'), 1000);

      assert.deepEqual(result, { timedOut: false, value: 'fast' });
      assert.equal(cleared, true);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  it('clears the timeout when the original promise rejects before timeout', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const fakeHandle = { kind: 'timeout' } as unknown as ReturnType<typeof setTimeout>;
    let cleared = false;

    try {
      global.setTimeout = ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => {
        return fakeHandle;
      }) as typeof setTimeout;
      global.clearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
        if (handle === fakeHandle) {
          cleared = true;
        }
      }) as typeof clearTimeout;

      const error = new Error('fast failure');
      await assert.rejects(utils.awaitWithTimeout(Promise.reject(error), 1000), error);

      assert.equal(cleared, true);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });
});
```

- [ ] **Step 2: helper 未実装で test が失敗することを確認する**

Run:

```powershell
npx tsx --test test/unit/await-with-timeout.test.ts
```

Expected: FAIL。代表例は `Property 'awaitWithTimeout' does not exist` または `utils.awaitWithTimeout is not a function`。

- [ ] **Step 3: `src/utils.ts` に helper を追加する**

Append this code near the end of `src/utils.ts`, after existing exported helpers:

```ts
export type AwaitWithTimeoutResult<T> =
  | { timedOut: false; value: T }
  | { timedOut: true };

export async function awaitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<AwaitWithTimeoutResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const observedPromise = promise.catch((error) => {
    if (timedOut) {
      return undefined as T;
    }
    throw error;
  });

  try {
    const timeoutPromise = new Promise<AwaitWithTimeoutResult<T>>((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        resolve({ timedOut: true });
      }, timeoutMs);
    });

    const valuePromise = observedPromise.then((value): AwaitWithTimeoutResult<T> => {
      return { timedOut: false, value };
    });

    return await Promise.race([valuePromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
```

Notes:
- 期限前 reject は `timedOut === false` のため呼び出し元へ伝播する。
- timeout 後の遅延 reject は `observedPromise` の catch が観測して握るため、`unhandledRejection` にならない。
- `finally` で timer を解放する。

- [ ] **Step 4: helper test が通ることを確認する**

Run:

```powershell
npx tsx --test test/unit/await-with-timeout.test.ts
```

Expected: PASS。`awaitWithTimeout` の 6 tests が通る。

- [ ] **Step 5: Task 1 を commit する**

Run:

```powershell
git add src/utils.ts test/unit/await-with-timeout.test.ts
git commit -m "test: add await with timeout helper"
```

## Task 2: `exportPdf()` の cleanup を `finally` に集約する

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: close timeout 定数を追加する**

In `src/extension.ts`, add this constant near the other top-level constants after `extensionContext`:

```ts
const CLOSE_BROWSER_TIMEOUT_MS = 5000;
```

- [ ] **Step 2: `withProgress` callback の先頭で cleanup 用変数を宣言する**

Change the beginning of the callback from:

```ts
    }, async () => {
      try {
```

to:

```ts
    }, async () => {
      let tmpfilename: string | undefined;
      let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

      try {
```

- [ ] **Step 3: temporary HTML 作成を外側変数へ代入する**

Change:

```ts
        const tmpfilename = utils.generateTmpHtmlFilename(filename);
        exportHtml(data, tmpfilename);
```

to:

```ts
        tmpfilename = utils.generateTmpHtmlFilename(filename);
        exportHtml(data, tmpfilename);
```

- [ ] **Step 4: Chromium 解決失敗分岐のインライン削除を消す**

Change:

```ts
        if (!resolution.ok) {
          if (utils.isExistsPath(tmpfilename)) {
            deleteFile(tmpfilename);
          }
          switch (resolution.reason) {
```

to:

```ts
        if (!resolution.ok) {
          switch (resolution.reason) {
```

This makes Chromium resolution failure follow the same `debug`-gated cleanup as other PDF/PNG/JPEG paths.

- [ ] **Step 5: browser 変数を cleanup から参照できるようにする**

Change:

```ts
        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
```

to:

```ts
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
```

- [ ] **Step 6: 成功 status bar を生成直後へ移し、既存 close/delete ブロックを削除する**

Replace this block:

```ts
        await browser.close();

        // delete temporary file
        const debug = vscode.workspace.getConfiguration('markdown-pdf')['debug'] || false;
        if (!debug) {
          if (utils.isExistsPath(tmpfilename)) {
            deleteFile(tmpfilename);
          }
        }

        vscode.window.setStatusBarMessage('$(markdown) ' + exportFilename, StatusbarMessageTimeout);
```

with:

```ts
        vscode.window.setStatusBarMessage('$(markdown) ' + exportFilename, StatusbarMessageTimeout);
```

This keeps export success reporting tied to `page.pdf()` / `page.screenshot()` success, not to Chromium close success.

- [ ] **Step 7: `catch` の後に `finally` cleanup を追加する**

Change the end of the `try/catch` from:

```ts
      } catch (error) {
        reportError({ operation: 'Failed to export ' + type + '.', where: 'exportPdf()', error, context: diagnostics.buildContextSummary(ctx, homeDir), classify: true });
      }
```

to:

```ts
      } catch (error) {
        reportError({ operation: 'Failed to export ' + type + '.', where: 'exportPdf()', error, context: diagnostics.buildContextSummary(ctx, homeDir), classify: true });
      } finally {
        if (browser) {
          try {
            const closeResult = await utils.awaitWithTimeout(browser.close(), CLOSE_BROWSER_TIMEOUT_MS);
            if (closeResult.timedOut) {
              logger.logWarn('Timed out while closing Chromium after export; continuing so the progress notification can finish.');
            }
          } catch (error) {
            logger.logWarn('Failed to close Chromium after export: ' + logger.formatError(error));
          }
        }

        const debug = vscode.workspace.getConfiguration('markdown-pdf')['debug'] || false;
        if (!debug && tmpfilename && utils.isExistsPath(tmpfilename)) {
          try {
            deleteFile(tmpfilename);
          } catch (error) {
            logger.logWarn('Failed to delete temporary HTML after export: ' + logger.formatError(error));
          }
        }
      }
```

Notes:
- `browser.close()` と temporary HTML deletion are independent `try/catch` blocks.
- close timeout logs only to OutputChannel and does not call `reportError()`.
- deletion failure logs only to OutputChannel and does not fail an already generated export.
- `debug=true` leaves temporary HTML in every PDF/PNG/JPEG path, including Chromium resolution failure.
- `type === 'html'` returns before `tmpfilename` / `browser` are set; `finally` runs and no-ops.

- [ ] **Step 8: TypeScript check を通す**

Run:

```powershell
npm run check
```

Expected: PASS。`tmpfilename` and `browser` narrowing should not produce `string | undefined` or possibly-undefined errors.

- [ ] **Step 9: unit tests を通す**

Run:

```powershell
npm run test:unit
```

Expected: PASS。既存 unit tests plus `awaitWithTimeout` tests pass.

- [ ] **Step 10: Task 2 を commit する**

Run:

```powershell
git add src/extension.ts
git commit -m "fix: bound browser close during export cleanup"
```

## Task 3: 全体検証と手動確認

**Files:**
- No expected file changes.

- [ ] **Step 1: build を通す**

Run:

```powershell
npm run build
```

Expected: PASS。`dist/extension.js` が生成される。

- [ ] **Step 2: 最終検証コマンドを通す**

Run:

```powershell
npm run test:unit
npm run check
npm run build
```

Expected: all PASS。

- [ ] **Step 3: 開発用 Extension Host で通常 export を手動確認する**

Manual checks:

- PDF export: PDF が生成され、`Exporting (pdf) ...` notification が閉じる。
- PNG export: PNG が生成され、`Exporting (png) ...` notification が閉じる。
- JPEG export: JPEG が生成され、`Exporting (jpeg) ...` notification が閉じる。
- `debug=false`: `*_tmp.html` が残らない。
- `debug=true`: `*_tmp.html` が残る。
- 通常 close 環境: `Timed out while closing Chromium after export...` warning が出ない。

- [ ] **Step 4: Chromium 解決失敗時の debug 挙動を手動確認する**

Use a bad executable path and auto-download disabled:

```json
{
  "markdown-pdf.executablePath": "C:\\\\path\\\\to\\\\missing-chromium.exe",
  "markdown-pdf.chromium.autoDownload": false,
  "markdown-pdf.debug": true
}
```

Expected:

- export は Chromium 解決失敗の既存 error toast / log を出す。
- `debug=true` のため temporary HTML が残る。
- `Exporting (...) ...` notification は callback completion により閉じる。

Then set:

```json
{
  "markdown-pdf.debug": false
}
```

Expected:

- 同じ Chromium 解決失敗でも temporary HTML は削除される。

- [ ] **Step 5: 最終 status と diff を確認する**

Run:

```powershell
git status --short --branch
git diff --check
```

Expected:

- `git diff --check` prints no whitespace errors.
- Working tree only contains intentional generated build output if the repo normally tracks or ignores it. If `dist/extension.js` changes because of `npm run build`, inspect it before deciding whether to include it.

## Plan self-review

- Spec coverage:
  - `browser.close()` の待ち切り: Task 1 helper + Task 2 Step 7。
  - 一時 HTML cleanup の `finally` 集約: Task 2 Steps 2-7。
  - close 後削除の維持: Task 2 Step 7。
  - close timeout / close reject / deletion failure の warning: Task 2 Step 7。
  - `debug=true` の Chromium 解決失敗時 temporary HTML 残留: Task 2 Step 4 and Step 7, Task 3 Step 4。
  - `page.goto(..., waitUntil: 'networkidle0')` 変更なし: Task 2 changes avoid that line.
  - helper の late reject / timer 解放 tests: Task 1 Step 1。timer 解放は resolve 経路と reject 経路を明示的に検証する。

- Placeholder scan:
  - この plan は未確定項目を書かず、各変更ステップに対象ファイル、コード、コマンド、期待結果を含めている。

- Type consistency:
  - helper name is `awaitWithTimeout`.
  - helper result type is `AwaitWithTimeoutResult<T>`.
  - `extension.ts` references `utils.awaitWithTimeout`.
  - close timeout constant is `CLOSE_BROWSER_TIMEOUT_MS`.
