# Chromium 自動ダウンロード機能の最新版追従と無効化オプション 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chromium 自動ダウンロード経路で常に最新の Chrome Stable に追従し、自動ダウンロード自体を無効化できる設定 `markdown-pdf.chromium.autoDownload` を導入する。

**Architecture:** `src/chromium-resolver.ts` に最新版取得（Chrome for Testing API、セッションメモ化）とキャッシュ走査を追加し、`resolveChromiumPath` をオプション引数化する。`src/extension.ts` 側で新設定を読み出し、`installChromium` / `checkPuppeteerBinary` / `exportPdf` の呼び出しを更新する。テストは `node:test` のモンキーパッチ手法を踏襲。

**Tech Stack:** TypeScript / `@puppeteer/browsers` / `puppeteer-core` / VS Code 拡張 API / `node:test` (tsx)

**作業ブランチ:** `feature/chromium-auto-download`

**前提:**

- すべての作業は `.worktrees/chromium-auto-download/` ワークツリー内で実施する。
- 仕様書: `docs/superpowers/specs/20260418-01-chromium-auto-download-design.md`
- コードコメントは英語、ドキュメントとコミットメッセージは日本語可（既存方針に合わせる）。
- 各 commit 前に `npm run check` と `npm run test:unit` を実行し、回帰がないことを確認する（タスク内の Step に明記）。
- パッケージ構成図でいうところの「ダウンロードパス」ロジックのみ変更し、既存の `findChromiumFromUserSetting` / `findChromiumFromSystem` の挙動は変えない。

---

## ファイル構成

| ファイル | 役割 | 本計画での扱い |
|---------|------|----------------|
| `package.json` | 設定スキーマの追加 | 修正（Task 1） |
| `src/chromium-resolver.ts` | Chromium 解決ロジックの中心。最新版取得・キャッシュ走査・解決フローを担当 | 修正（Task 2〜5） |
| `src/extension.ts` | VS Code 拡張のエントリポイント。設定参照と UI を担当 | 修正（Task 6） |
| `test/unit/chromium-resolver.test.ts` | `chromium-resolver.ts` の単体テスト | 修正（Task 2〜5 で追記） |

各タスクは「Red（失敗するテストを書く） → Green（最小実装でパス） → Commit」の TDD サイクルで進める。

---

## Task 1: `package.json` に `markdown-pdf.chromium.autoDownload` 設定を追加

**Files:**

- Modify: `package.json`（`contributes.configuration.properties` セクション、`markdown-pdf.executablePath` の直後）

- [ ] **Step 1: `package.json` の設定スキーマを追加する**

`package.json` の `markdown-pdf.executablePath` プロパティ定義（728-730 行付近）の直後に、以下のプロパティを追加する。

```json
        "markdown-pdf.chromium.autoDownload": {
          "type": "boolean",
          "default": true,
          "description": "Automatically download the latest Chrome Stable when no system Chromium/Edge is found and no executable path is specified. Disable to prevent any Chromium download (system or user-specified Chromium must be available)."
        },
```

- [ ] **Step 2: JSON 構文を検証する**

実行: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf-8')); console.log('ok')"`

期待結果: `ok` が表示される。

- [ ] **Step 3: 既存テストが通ることを確認する**

実行: `npm run check && npm run test:unit`

期待結果: すべて成功（コード変更前の baseline）。

- [ ] **Step 4: コミット**

```bash
git add package.json
git commit -m "feat(settings): add markdown-pdf.chromium.autoDownload"
```

---

## Task 2: `findLatestCachedChromium` を追加

キャッシュディレクトリにある Chrome ビルドのうち、最新 buildId を持つものの実行パスを返す純粋関数を実装する。

**Files:**

- Modify: `src/chromium-resolver.ts`
- Test: `test/unit/chromium-resolver.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/chromium-resolver.test.ts` の `describe('cleanupOldChromium', ...)` ブロックの直後（最後の `});` の前）に以下を追加する。

```typescript
  describe('findLatestCachedChromium', function () {
    it('should return the executable path of the highest-version Chrome build', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalComputeExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeExecutablePath');

      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          return [
            { browser: PB.Browser.CHROME, buildId: '130.0.6723.91', platform: 'linux', executablePath: '/cache/chrome/130' },
            { browser: PB.Browser.CHROME, buildId: '131.0.6778.85', platform: 'linux', executablePath: '/cache/chrome/131' },
            { browser: PB.Browser.FIREFOX, buildId: '999.0.0.0', platform: 'linux', executablePath: '/cache/firefox/999' }
          ];
        }
      });

      try {
        const result = await chromiumResolver.findLatestCachedChromium('/cache');
        assert.strictEqual(result, '/cache/chrome/131');
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        if (originalComputeExecutablePath) {
          Object.defineProperty(PB, 'computeExecutablePath', originalComputeExecutablePath);
        }
      }
    });

    it('should return null when no Chrome builds exist', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');

      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          return [
            { browser: PB.Browser.FIREFOX, buildId: '1.0.0.0', platform: 'linux', executablePath: '/cache/firefox' }
          ];
        }
      });

      try {
        const result = await chromiumResolver.findLatestCachedChromium('/cache');
        assert.strictEqual(result, null);
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
      }
    });

    it('should return null when getInstalledBrowsers throws (missing cache dir)', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');

      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          throw new Error('ENOENT');
        }
      });

      try {
        const result = await chromiumResolver.findLatestCachedChromium('/nonexistent');
        assert.strictEqual(result, null);
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
      }
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認する**

実行: `npm run test:unit`

期待結果: `findLatestCachedChromium is not a function` 相当のエラーで FAIL。

- [ ] **Step 3: `findLatestCachedChromium` を実装する**

`src/chromium-resolver.ts` の末尾（`resolveChromiumPath` の手前）に以下を追加する。

```typescript
/** Compares two version strings of the form "MAJOR.MINOR.BUILD.PATCH"; returns negative/zero/positive like Array.sort. */
function compareBuildIds(a: string, b: string): number {
  const partsA = a.split('.').map(function (s) { return parseInt(s, 10) || 0; });
  const partsB = b.split('.').map(function (s) { return parseInt(s, 10) || 0; });
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Returns the executable path of the newest Chrome build cached under cacheDir, or null if none. */
export async function findLatestCachedChromium(cacheDir: string): Promise<string | null> {
  try {
    const installedBrowsers = await PB.getInstalledBrowsers({ cacheDir: cacheDir });
    const chromeBuilds = installedBrowsers.filter(function (b) {
      return b.browser === PB.Browser.CHROME;
    });

    if (chromeBuilds.length === 0) {
      return null;
    }

    chromeBuilds.sort(function (a, b) {
      return compareBuildIds(b.buildId, a.buildId);
    });

    return chromeBuilds[0].executablePath;
  } catch (error) {
    return null;
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

実行: `npm run test:unit`

期待結果: 追加した 3 つのテストを含めて全 PASS。

- [ ] **Step 5: 型チェックを通す**

実行: `npm run check`

期待結果: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add src/chromium-resolver.ts test/unit/chromium-resolver.test.ts
git commit -m "feat(chromium): add findLatestCachedChromium helper"
```

---

## Task 3: `fetchLatestStableBuildId` とセッションメモ化を追加

Chrome for Testing API から最新 Stable buildId を取得する関数と、テスト時に差し替え可能な JSON フェッチャを実装する。

**Files:**

- Modify: `src/chromium-resolver.ts`
- Test: `test/unit/chromium-resolver.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/chromium-resolver.test.ts` の `describe('findLatestCachedChromium', ...)` ブロックの直後に以下を追加する。

```typescript
  describe('fetchLatestStableBuildId', function () {
    afterEach(function () {
      chromiumResolver.resetLatestBuildIdCache();
    });

    it('should return the version from channels.Stable.version', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      const result = await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(result, '131.0.6778.85');
      assert.strictEqual(calls, 1);
    });

    it('should memoize successful results across calls in the same session', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      const a = await chromiumResolver.fetchLatestStableBuildId();
      const b = await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(a, '131.0.6778.85');
      assert.strictEqual(b, '131.0.6778.85');
      assert.strictEqual(calls, 1);
    });

    it('should return null on network error and not retry within the same session', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        throw new Error('ECONNREFUSED');
      });

      const a = await chromiumResolver.fetchLatestStableBuildId();
      const b = await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(a, null);
      assert.strictEqual(b, null);
      assert.strictEqual(calls, 1);
    });

    it('should return null on schema mismatch', async function () {
      chromiumResolver.setJsonFetcherForTesting(async function () {
        return { unexpected: 'shape' };
      });
      assert.strictEqual(await chromiumResolver.fetchLatestStableBuildId(), null);
    });

    it('should return null on malformed version string', async function () {
      chromiumResolver.setJsonFetcherForTesting(async function () {
        return { channels: { Stable: { version: 'not-a-version' } } };
      });
      assert.strictEqual(await chromiumResolver.fetchLatestStableBuildId(), null);
    });

    it('should fetch again after resetLatestBuildIdCache()', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      await chromiumResolver.fetchLatestStableBuildId();
      chromiumResolver.resetLatestBuildIdCache();
      await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(calls, 2);
    });
  });
```

ファイル先頭の `import` の直下に `afterEach` も import する。`describe, it, before, after` の行を以下に置き換える。

```typescript
import { describe, it, before, after, afterEach } from 'node:test';
```

- [ ] **Step 2: テストが失敗することを確認する**

実行: `npm run test:unit`

期待結果: `fetchLatestStableBuildId is not a function` 等で FAIL。

- [ ] **Step 3: `fetchLatestStableBuildId` 関連を実装する**

`src/chromium-resolver.ts` の `getExpectedBuildId` の直後（103 行目あたり）に以下を追加する。

```typescript
const CHROME_FOR_TESTING_LATEST_URL =
  'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json';
const FETCH_TIMEOUT_MS = 10_000;
const BUILD_ID_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

type JsonFetcher = (url: string) => Promise<unknown>;

const defaultJsonFetcher: JsonFetcher = async function (url) {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

let jsonFetcher: JsonFetcher = defaultJsonFetcher;
let cachedLatestBuildId: string | null = null;
let cachedLatestFetchFailed: boolean = false;

/** Replaces the JSON fetcher used by fetchLatestStableBuildId; intended for unit tests. */
export function setJsonFetcherForTesting(fetcher: JsonFetcher): void {
  jsonFetcher = fetcher;
}

/** Clears the in-memory cache of the latest stable build id; intended for unit tests and module reload. */
export function resetLatestBuildIdCache(): void {
  cachedLatestBuildId = null;
  cachedLatestFetchFailed = false;
  jsonFetcher = defaultJsonFetcher;
}

/** Fetches the latest Chrome Stable build id from Chrome for Testing API. Memoizes per session. */
export async function fetchLatestStableBuildId(): Promise<string | null> {
  if (cachedLatestBuildId) {
    return cachedLatestBuildId;
  }
  if (cachedLatestFetchFailed) {
    return null;
  }

  try {
    const json = await jsonFetcher(CHROME_FOR_TESTING_LATEST_URL);
    const version = extractStableVersion(json);
    if (!version || !BUILD_ID_PATTERN.test(version)) {
      cachedLatestFetchFailed = true;
      console.warn('[Markdown PDF] Latest Chromium version response had unexpected shape');
      return null;
    }
    cachedLatestBuildId = version;
    return version;
  } catch (error) {
    cachedLatestFetchFailed = true;
    const msg = error && (error as Error).message ? (error as Error).message : String(error);
    console.warn('[Markdown PDF] Failed to fetch latest Chromium version: ' + msg);
    return null;
  }
}

function extractStableVersion(json: unknown): string | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const channels = (json as { channels?: unknown }).channels;
  if (!channels || typeof channels !== 'object') {
    return null;
  }
  const stable = (channels as { Stable?: unknown }).Stable;
  if (!stable || typeof stable !== 'object') {
    return null;
  }
  const version = (stable as { version?: unknown }).version;
  return typeof version === 'string' ? version : null;
}
```

`setJsonFetcherForTesting` で差し替えたフェッチャは `resetLatestBuildIdCache()` でデフォルトに戻る点に注意（テスト間の独立性を保つため）。

- [ ] **Step 4: テストが通ることを確認する**

実行: `npm run test:unit`

期待結果: 追加した `fetchLatestStableBuildId` 関連 6 ケースを含めて全 PASS。

- [ ] **Step 5: 型チェックを通す**

実行: `npm run check`

期待結果: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add src/chromium-resolver.ts test/unit/chromium-resolver.test.ts
git commit -m "feat(chromium): fetch latest Chrome Stable build id with session memoization"
```

---

## Task 4: `ensureChromiumDownloaded` のシグネチャを `buildId` 引数化

`ensureChromiumDownloaded` を「指定 buildId をダウンロード」に責務を絞り、自動ダウンロード経路で最新 buildId を渡せるようにする。

**Files:**

- Modify: `src/chromium-resolver.ts`
- Test: `test/unit/chromium-resolver.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/chromium-resolver.test.ts` の `describe('fetchLatestStableBuildId', ...)` の直後に以下を追加する。

```typescript
  describe('ensureChromiumDownloaded', function () {
    it('should call PB.install with the given buildId', async function () {
      const originalComputeExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeExecutablePath');
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const installCalls: unknown[] = [];

      Object.defineProperty(PB, 'computeExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () {
          return '/cache/chrome/missing';
        }
      });
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function (opts: unknown) {
          installCalls.push(opts);
          return { executablePath: '/cache/chrome/installed' };
        }
      });
      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () { return []; }
      });

      try {
        const result = await chromiumResolver.ensureChromiumDownloaded('/cache', '131.0.6778.85');
        assert.strictEqual(result, '/cache/chrome/installed');
        assert.strictEqual(installCalls.length, 1);
        assert.strictEqual((installCalls[0] as { buildId: string }).buildId, '131.0.6778.85');
      } finally {
        Object.defineProperty(PB, 'computeExecutablePath', originalComputeExecutablePath!);
        Object.defineProperty(PB, 'install', originalInstall!);
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
      }
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認する**

実行: `npm run test:unit`

期待結果: 型エラーまたは `ensureChromiumDownloaded` の引数不一致で FAIL。

- [ ] **Step 3: `ensureChromiumDownloaded` のシグネチャを変更する**

`src/chromium-resolver.ts` の `ensureChromiumDownloaded` を以下に置き換える。

```typescript
/** Downloads the specified Chrome build into cacheDir if not already present, and returns its executable path. */
export async function ensureChromiumDownloaded(
  cacheDir: string,
  buildId: string,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<string> {
  const platform = PB.detectBrowserPlatform();
  let executablePath: string;

  // Why: if the expected build is missing or inaccessible, fall through to
  // PB.install() below rather than propagating the error.
  try {
    executablePath = PB.computeExecutablePath({
      browser: PB.Browser.CHROME,
      buildId: buildId,
      cacheDir: cacheDir,
      platform: platform
    });
    fs.accessSync(executablePath);
    return executablePath;
  } catch (error) {
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const installedBrowser = await PB.install({
    browser: PB.Browser.CHROME,
    buildId: buildId,
    cacheDir: cacheDir,
    platform: platform,
    downloadProgressCallback: onProgress
  });

  await cleanupOldChromium(cacheDir, buildId);

  return installedBrowser.executablePath;
}
```

- [ ] **Step 4: テストが通ることを確認する**

実行: `npm run test:unit`

期待結果: 追加した `ensureChromiumDownloaded` ケースを含めて全 PASS。

- [ ] **Step 5: 型チェックを通す**

実行: `npm run check`

期待結果: エラーなし。なお、`src/extension.ts:582` の旧呼び出し（引数不足）が型エラーになる可能性がある。発生したら、Task 6 で修正する前提でこの時点では呼び出し側を `chromiumResolver.ensureChromiumDownloaded(cacheDir, chromiumResolver.getExpectedBuildId(), onProgress)` の暫定形に書き換えてから commit する。

> **Note:** `src/extension.ts:582` を一時的に `ensureChromiumDownloaded(cacheDir, chromiumResolver.getExpectedBuildId(), onProgress)` に変更し、最終的な `autoDownload` 連携は Task 6 で本実装する。

- [ ] **Step 6: コミット**

```bash
git add src/chromium-resolver.ts src/extension.ts test/unit/chromium-resolver.test.ts
git commit -m "refactor(chromium): make ensureChromiumDownloaded take buildId argument"
```

---

## Task 5: `resolveChromiumPath` のシグネチャ変更と新解決フロー

`resolveChromiumPath` を `(userExecutablePath, cacheDir, options)` のシグネチャに変更し、`autoDownload` フラグに応じた解決フローを実装する。

**Files:**

- Modify: `src/chromium-resolver.ts`
- Test: `test/unit/chromium-resolver.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/chromium-resolver.test.ts` の `describe('ensureChromiumDownloaded', ...)` の直後に以下を追加する。

```typescript
  describe('resolveChromiumPath', function () {
    let originalPlatform: PropertyDescriptor | undefined;

    before(function () {
      // Force getEdgeAndChromiumCandidates() to return [] so the system-detection
      // fallback never accidentally hits a real binary on the dev machine.
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { configurable: true, value: 'aix' });
    });

    after(function () {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    afterEach(function () {
      chromiumResolver.resetLatestBuildIdCache();
    });

    it('should return user setting path immediately when valid', async function () {
      let installCalled = false;
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function () { installCalled = true; return { executablePath: 'x' }; }
      });

      try {
        const result = await chromiumResolver.resolveChromiumPath(existingExecutablePath, '/cache', { autoDownload: true });
        assert.strictEqual(result, existingExecutablePath);
        assert.strictEqual(installCalled, false);
      } finally {
        Object.defineProperty(PB, 'install', originalInstall!);
      }
    });

    it('should download latest build id when autoDownload=true and cache misses', async function () {
      const installCalls: unknown[] = [];
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      const originalComputeExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeExecutablePath');
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalComputeSystemExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeSystemExecutablePath');

      Object.defineProperty(PB, 'computeSystemExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () { throw new Error('not found'); }
      });
      Object.defineProperty(PB, 'computeExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () { return '/cache/chrome/missing'; }
      });
      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () { return []; }
      });
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function (opts: unknown) {
          installCalls.push(opts);
          return { executablePath: '/cache/chrome/installed-latest' };
        }
      });
      chromiumResolver.setJsonFetcherForTesting(async function () {
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      try {
        const result = await chromiumResolver.resolveChromiumPath('', '/cache', { autoDownload: true });
        assert.strictEqual(result, '/cache/chrome/installed-latest');
        assert.strictEqual(installCalls.length, 1);
        assert.strictEqual((installCalls[0] as { buildId: string }).buildId, '131.0.6778.85');
      } finally {
        Object.defineProperty(PB, 'install', originalInstall!);
        Object.defineProperty(PB, 'computeExecutablePath', originalComputeExecutablePath!);
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        if (originalComputeSystemExecutablePath) {
          Object.defineProperty(PB, 'computeSystemExecutablePath', originalComputeSystemExecutablePath);
        }
      }
    });

    it('should return cached path when autoDownload=true and JSON fetch fails but cache has builds', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      const originalComputeSystemExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeSystemExecutablePath');
      let installCalled = false;

      Object.defineProperty(PB, 'computeSystemExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () { throw new Error('not found'); }
      });
      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          return [
            { browser: PB.Browser.CHROME, buildId: '130.0.6723.91', platform: 'linux', executablePath: '/cache/chrome/130' }
          ];
        }
      });
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function () { installCalled = true; return { executablePath: 'x' }; }
      });
      chromiumResolver.setJsonFetcherForTesting(async function () {
        throw new Error('ECONNREFUSED');
      });

      try {
        const result = await chromiumResolver.resolveChromiumPath('', '/cache', { autoDownload: true });
        assert.strictEqual(result, '/cache/chrome/130');
        assert.strictEqual(installCalled, false);
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        Object.defineProperty(PB, 'install', originalInstall!);
        if (originalComputeSystemExecutablePath) {
          Object.defineProperty(PB, 'computeSystemExecutablePath', originalComputeSystemExecutablePath);
        }
      }
    });

    it('should fall back to bundled puppeteer-core build when JSON fetch fails and cache is empty', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      const originalComputeExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeExecutablePath');
      const originalComputeSystemExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeSystemExecutablePath');
      const installCalls: unknown[] = [];

      Object.defineProperty(PB, 'computeSystemExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () { throw new Error('not found'); }
      });
      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () { return []; }
      });
      Object.defineProperty(PB, 'computeExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () { return '/cache/chrome/missing'; }
      });
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function (opts: unknown) {
          installCalls.push(opts);
          return { executablePath: '/cache/chrome/bundled' };
        }
      });
      chromiumResolver.setJsonFetcherForTesting(async function () {
        throw new Error('ECONNREFUSED');
      });

      try {
        const result = await chromiumResolver.resolveChromiumPath('', '/cache', { autoDownload: true });
        assert.strictEqual(result, '/cache/chrome/bundled');
        assert.strictEqual(installCalls.length, 1);
        assert.strictEqual((installCalls[0] as { buildId: string }).buildId, chromiumResolver.getExpectedBuildId());
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        Object.defineProperty(PB, 'install', originalInstall!);
        Object.defineProperty(PB, 'computeExecutablePath', originalComputeExecutablePath!);
        if (originalComputeSystemExecutablePath) {
          Object.defineProperty(PB, 'computeSystemExecutablePath', originalComputeSystemExecutablePath);
        }
      }
    });

    it('should return cached path when autoDownload=false and cache has builds', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      const originalComputeSystemExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeSystemExecutablePath');
      let installCalled = false;
      let fetchCalled = false;

      Object.defineProperty(PB, 'computeSystemExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () { throw new Error('not found'); }
      });
      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          return [
            { browser: PB.Browser.CHROME, buildId: '130.0.6723.91', platform: 'linux', executablePath: '/cache/chrome/130' }
          ];
        }
      });
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function () { installCalled = true; return { executablePath: 'x' }; }
      });
      chromiumResolver.setJsonFetcherForTesting(async function () {
        fetchCalled = true;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      try {
        const result = await chromiumResolver.resolveChromiumPath('', '/cache', { autoDownload: false });
        assert.strictEqual(result, '/cache/chrome/130');
        assert.strictEqual(installCalled, false);
        assert.strictEqual(fetchCalled, false);
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        Object.defineProperty(PB, 'install', originalInstall!);
        if (originalComputeSystemExecutablePath) {
          Object.defineProperty(PB, 'computeSystemExecutablePath', originalComputeSystemExecutablePath);
        }
      }
    });

    it('should return null when autoDownload=false and nothing is available', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      const originalComputeSystemExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeSystemExecutablePath');
      let installCalled = false;

      Object.defineProperty(PB, 'computeSystemExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () { throw new Error('not found'); }
      });
      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () { return []; }
      });
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function () { installCalled = true; return { executablePath: 'x' }; }
      });

      try {
        const result = await chromiumResolver.resolveChromiumPath('', '/cache', { autoDownload: false });
        assert.strictEqual(result, null);
        assert.strictEqual(installCalled, false);
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        Object.defineProperty(PB, 'install', originalInstall!);
        if (originalComputeSystemExecutablePath) {
          Object.defineProperty(PB, 'computeSystemExecutablePath', originalComputeSystemExecutablePath);
        }
      }
    });
  });
```

> **Why `process.platform = 'aix'`:** `findChromiumFromSystem` は `computeSystemExecutablePath` が失敗するとプラットフォーム別の候補リスト (`getEdgeAndChromiumCandidates`) にフォールバックし、`fs.accessSync` で実在チェックする。Linux 開発機では `/usr/bin/chromium-browser` 等が偶然存在しテストが flake する。`process.platform` を `'aix'` に偽装すると候補が空配列になり、フォールバックも null を返すので、autoDownload 経路に必ず到達する。

- [ ] **Step 2: テストが失敗することを確認する**

実行: `npm run test:unit`

期待結果: シグネチャ不一致または分岐未実装で FAIL。

- [ ] **Step 3: `resolveChromiumPath` を新シグネチャ・新フローに書き換える**

`src/chromium-resolver.ts` の末尾の `resolveChromiumPath` を以下に置き換える。

```typescript
export interface ResolveChromiumPathOptions {
  autoDownload?: boolean;
  onProgress?: (downloadedBytes: number, totalBytes: number) => void;
}

/** Resolves a usable Chromium path: user setting → system → (auto)download or cached. */
export async function resolveChromiumPath(
  userExecutablePath: string,
  cacheDir: string,
  options?: ResolveChromiumPathOptions
): Promise<string | null> {
  const autoDownload = options?.autoDownload !== false;
  const onProgress = options?.onProgress;

  let executablePath: string | null = findChromiumFromUserSetting(userExecutablePath);
  if (executablePath) {
    return executablePath;
  }

  executablePath = findChromiumFromSystem();
  if (executablePath) {
    return executablePath;
  }

  if (!autoDownload) {
    return await findLatestCachedChromium(cacheDir);
  }

  const latestBuildId = await fetchLatestStableBuildId();
  if (latestBuildId) {
    try {
      return await ensureChromiumDownloaded(cacheDir, latestBuildId, onProgress);
    } catch (error) {
      console.error('[Markdown PDF] Failed to download latest Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
      return null;
    }
  }

  // JSON fetch failed: prefer existing cache, then fall back to bundled puppeteer-core build id.
  const cachedPath = await findLatestCachedChromium(cacheDir);
  if (cachedPath) {
    console.warn('[Markdown PDF] Falling back to cached Chromium build');
    return cachedPath;
  }

  const fallbackBuildId = getExpectedBuildId();
  console.warn('[Markdown PDF] Falling back to bundled Chromium build: ' + fallbackBuildId);
  try {
    return await ensureChromiumDownloaded(cacheDir, fallbackBuildId, onProgress);
  } catch (error) {
    console.error('[Markdown PDF] All Chromium acquisition attempts failed: ' + (error && (error as Error).message ? (error as Error).message : error));
    return null;
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

実行: `npm run test:unit`

期待結果: 追加した `resolveChromiumPath` 6 ケースを含めて全 PASS。

- [ ] **Step 5: 型チェックを通す**

実行: `npm run check`

期待結果: エラーなし。`src/extension.ts:348` の `resolveChromiumPath` 呼び出し（旧シグネチャ）は引数互換のため破綻しないが、Task 6 で options 形式へ更新する。

- [ ] **Step 6: コミット**

```bash
git add src/chromium-resolver.ts test/unit/chromium-resolver.test.ts
git commit -m "feat(chromium): add autoDownload-aware resolution flow with fallback chain"
```

---

## Task 6: `src/extension.ts` 連携と UI 文言追加

`autoDownload` 設定の参照、`installChromium` / `checkPuppeteerBinary` の整合、`resolveChromiumPath` の呼び出し更新を行う。

**Files:**

- Modify: `src/extension.ts`

> **Note:** `extension.ts` は `vscode` API に依存するため `node:test` ベースの単体テストでは扱わない。動作確認は手動検証（仕様書 7.3）に委ねる。

- [ ] **Step 1: 設定読み出しヘルパーを追加する**

`src/extension.ts` の `getExtensionCacheDir` 関数（24-38 行目）の直後に以下を追加する。

```typescript
/** Reads markdown-pdf.chromium.autoDownload (default: true). */
function getAutoDownload(): boolean {
  const chromium = vscode.workspace.getConfiguration('markdown-pdf')['chromium'];
  if (chromium && typeof chromium === 'object' && typeof chromium.autoDownload === 'boolean') {
    return chromium.autoDownload;
  }
  return true;
}
```

- [ ] **Step 2: `exportPdf` 内の `resolveChromiumPath` 呼び出しを options 形式に更新する**

`src/extension.ts:348` の以下の行：

```typescript
const resolvedExecPath = await chromiumResolver.resolveChromiumPath(userExecPath, cacheDir);
```

を次のように置き換える。

```typescript
const resolvedExecPath = await chromiumResolver.resolveChromiumPath(userExecPath, cacheDir, {
  autoDownload: getAutoDownload()
});
```

- [ ] **Step 3: `exportPdf` 内のエラーメッセージを `autoDownload=false` ケース向けに分岐する**

`src/extension.ts:353-354` の以下のブロック：

```typescript
showErrorMessage('Chromium or Chrome does not exist! \
      See https://github.com/yzane/vscode-markdown-pdf#install');
```

を次のように置き換える。

```typescript
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
```

- [ ] **Step 4: `checkPuppeteerBinary` の固定 buildId 参照を `findLatestCachedChromium` ベースに整理する**

`src/extension.ts:541-557` の `if (extensionContext) { ... }` ブロックを以下に置き換える。

```typescript
    if (extensionContext) {
      const cacheDir = getExtensionCacheDir();
      if (!cacheDir) {
        return false;
      }
      // Defer the actual cache scan to checkCachedChromiumSync(): this method
      // is sync because it is also used as a quick guard in installChromium().
      return hasAnyCachedChromiumSync(cacheDir);
    }
```

そして `checkPuppeteerBinary` の直後に同期的なキャッシュ存在判定ヘルパーを追加する。

```typescript
/** Sync best-effort check: does the cache directory contain any Chrome build? */
function hasAnyCachedChromiumSync(cacheDir: string): boolean {
  try {
    const chromeDir = path.join(cacheDir, 'chrome');
    if (!fs.existsSync(chromeDir)) {
      return false;
    }
    const entries = fs.readdirSync(chromeDir);
    return entries.length > 0;
  } catch (error) {
    return false;
  }
}
```

> **Why:** `findLatestCachedChromium` は `async` だが、`checkPuppeteerBinary` は同期 API を期待する既存の呼び出し元を持つため、同期版の軽量チェックを別途用意する。`@puppeteer/browsers` の cache layout（`<cacheDir>/chrome/<platform>-<buildId>/`）を踏まえた最小限の判定。

- [ ] **Step 5: `installChromium` の中身を `resolveChromiumPath` に統一する**

`src/extension.ts` の `installChromium` 関数（569-613 行目）を以下に置き換える。

```typescript
async function installChromium(): Promise<void> {
  let statusbarmessage: vscode.Disposable | undefined;
  try {
    if (!getAutoDownload()) {
      // autoDownload disabled: defer error to actual export attempt.
      return;
    }

    vscode.window.showInformationMessage('[Markdown PDF] Installing Chromium ...');
    statusbarmessage = vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ...');

    setProxy();

    const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
    const cacheDir = getExtensionCacheDir();
    if (!cacheDir) {
      throw new Error('Extension storage path is unavailable.');
    }

    const executablePath = await chromiumResolver.resolveChromiumPath('', cacheDir, {
      autoDownload: true,
      onProgress: onProgress
    });

    if (executablePath) {
      INSTALL_CHECK = true;
      statusbarmessage.dispose();
      vscode.window.setStatusBarMessage('$(markdown) Chromium installation succeeded!', StatusbarMessageTimeout);
      vscode.window.showInformationMessage('[Markdown PDF] Chromium installation succeeded.');
    } else {
      throw new Error('resolveChromiumPath returned null');
    }
  } catch (error) {
    try {
      if (statusbarmessage) {
        statusbarmessage.dispose();
      }
    } catch (disposeError) {
    }
    const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
    vscode.window.setStatusBarMessage('$(markdown) ERROR: Failed to download Chromium!', StatusbarMessageTimeout);
    showErrorMessage('Failed to download Chromium! \
        If you are behind a proxy, set the http.proxy option to settings.json and restart Visual Studio Code. \
        See https://github.com/yzane/vscode-markdown-pdf#install', error);
  }

  function onProgress(downloadedBytes: number, totalBytes: number): void {
    const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
    if (totalBytes > 0) {
      const progress = Math.floor(downloadedBytes / totalBytes * 100);
      vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ' + progress + '%', StatusbarMessageTimeout);
      return;
    }
    vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ...', StatusbarMessageTimeout);
  }
}
```

> **Why:** `resolveChromiumPath` が「ユーザー指定 → システム → 最新 DL → フォールバック」を一手に担うようになったため、`installChromium` から第 1 引数に空文字を渡すことで「ダウンロードパスのみ実行」する経路を流用する。`checkPuppeteerBinary` の二重呼び出しを廃止し、`resolveChromiumPath` の戻り値で直接判定する。

- [ ] **Step 6: 不要 import を整理する**

`installChromium` から `PB.computeExecutablePath` の直接呼び出しが消えたが、`checkPuppeteerBinary` の旧コードを置き換えたのでこちらでも `PB.computeExecutablePath` 呼び出しが消える。`PB.detectBrowserPlatform` も `extension.ts` 内で参照されなくなる場合は `import * as PB from '@puppeteer/browsers';` 行が不要になる。`grep -n "\\bPB\\." src/extension.ts` で残存を確認し、もし参照ゼロなら以下の行を削除する。

```typescript
import * as PB from '@puppeteer/browsers';
```

- [ ] **Step 7: 型チェックを通す**

実行: `npm run check`

期待結果: エラーなし。

- [ ] **Step 8: 既存単体テストが通ることを確認する**

実行: `npm run test:unit`

期待結果: 全テスト PASS（Task 2〜5 で追加したものを含む）。

- [ ] **Step 9: ビルドが通ることを確認する**

実行: `npm run build`

期待結果: `dist/extension.js` が生成され、エラーなし。

- [ ] **Step 10: コミット**

```bash
git add src/extension.ts
git commit -m "feat(extension): wire up markdown-pdf.chromium.autoDownload setting"
```

---

## Task 7: 手動検証チェックリスト

仕様書 7.3 の 5 シナリオを実環境で確認する。CI には組み込まないが、リリース前の最終チェックとして実施する。

具体手順は以下の 2 文書を参照する（本プラン記述時の macOS/Linux 前提と実際の Remote-WSL 環境で経路が異なったため、手順本体は別ファイルに切り出した）:

- **再利用可能な手順書:** `docs/chromium-auto-download-manual-verification.md` — 将来のリリースでも使える 5 シナリオのランブック
- **本リリースの実施記録:** `docs/superpowers/plans/20260418-01-chromium-auto-download-task7-record.md` — 2026-04-19 Remote-WSL 環境での実測ログと判定

- [x] **Step 1: 手順書に従い 5 シナリオを実施**
- [x] **Step 2: 実施記録を作成し本プランからリンク**

すべて成功していれば本 Task を完了とする。失敗があれば該当 Task に戻って修正後、再実施する。

> **Note:** 本タスクは実環境依存のため、CI 自動化対象外。手動検証完了後、`develop` へ `--no-ff` マージする。

---

## 完了基準

- [ ] Task 1〜6 のすべての Step が `[x]` になっている
- [ ] `npm run check` が成功
- [ ] `npm run test:unit` が成功（既存 + 新規含む）
- [ ] `npm run build` が成功
- [ ] Task 7 の手動検証 5 シナリオがすべて成功
- [ ] commit ログが Task 単位で 6 件並んでいる（feat / refactor / feat の構成）

完了後、`feature/chromium-auto-download` から `develop` への PR またはローカルマージを行う（マージ前は AGENTS.md に従い必ずユーザーへ確認する）。
