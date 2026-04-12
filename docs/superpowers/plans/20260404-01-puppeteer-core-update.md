# puppeteer-core 24.x 更新 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** puppeteer-core を 2.1.1 から 24.x に更新し、Chromium 実行パス解決ロジックを刷新する

**Architecture:** 新しい `src/chromium-resolver.js` モジュールに Chromium パス解決ロジック（ユーザー設定 → OS 検出 → 自動ダウンロード）を集約する。`extension.js` の `checkPuppeteerBinary()`, `installChromium()`, `init()` を新モジュールに置き換える。`@puppeteer/browsers`（puppeteer-core 内部依存）の `computeSystemExecutablePath()` を OS Chrome 検出に活用し、Edge/Chromium は自前フォールバックで検出する。

**Tech Stack:** puppeteer-core 24.x, @puppeteer/browsers (puppeteer-core 内部依存), VS Code Extension API

**重要事項:**
- 現在のブランチは `develop`。作業開始前に `feature/puppeteer-core-update` ブランチを `develop` から作成すること
- ブランチを切り替えてはならない。常に `feature/puppeteer-core-update` 上で作業すること

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---|---|---|
| `src/chromium-resolver.js` | 新規作成 | Chromium 実行パス解決（Step 1/2/3）、ダウンロード管理 |
| `test/unit/chromium-resolver.test.js` | 新規作成 | chromium-resolver のユニットテスト |
| `extension.js` | 変更 | 新モジュールへの切り替え、旧 API 呼び出しの削除 |
| `package.json` | 変更 | puppeteer-core バージョン更新 |
| `package-lock.json` | 変更 | npm install で自動更新 |

---

### Task 1: feature ブランチの作成

**Files:**
- なし（git 操作のみ）

- [ ] **Step 1: feature ブランチを作成してチェックアウト**

```bash
git checkout -b feature/puppeteer-core-update develop
```

- [ ] **Step 2: ブランチ確認**

Run: `git branch --show-current`
Expected: `feature/puppeteer-core-update`

---

### Task 2: puppeteer-core バージョン更新

**Files:**
- Modify: `package.json:930` (`puppeteer-core` のバージョン)
- Modify: `package-lock.json` (npm install で自動更新)

- [ ] **Step 1: package.json の puppeteer-core バージョンを更新**

`package.json` の `dependencies` セクションで:

```json
"puppeteer-core": "^2.1.1"
```

を以下に変更:

```json
"puppeteer-core": "^24.40.0"
```

- [ ] **Step 2: npm install を実行**

Run: `npm install`
Expected: puppeteer-core 24.x がインストールされ、エラーなし

- [ ] **Step 3: CommonJS で require できることを確認**

Run: `node -e "const p = require('puppeteer-core'); console.log('OK:', typeof p.launch)"`
Expected: `OK: function`

- [ ] **Step 4: @puppeteer/browsers が利用可能か確認**

Run: `node -e "const PB = require('@puppeteer/browsers'); console.log('OK:', typeof PB.install, typeof PB.computeSystemExecutablePath)"`
Expected: `OK: function function`

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json
git commit -m "deps: update puppeteer-core to v24"
```

---

### Task 3: chromium-resolver モジュール — OS 検出ロジック（Step 1 + Step 2）

**Files:**
- Create: `src/chromium-resolver.js`
- Create: `test/unit/chromium-resolver.test.js`

- [ ] **Step 1: テストファイルを作成 — ユーザー設定パスの検出（Step 1）**

`test/unit/chromium-resolver.test.js`:

```js
'use strict';

var { describe, it, beforeEach, afterEach } = require('node:test');
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var os = require('os');

// Create a real temp executable for testing
function createTempExecutable() {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcr-test-'));
  var ext = process.platform === 'win32' ? '.exe' : '';
  var execPath = path.join(tmpDir, 'chrome' + ext);
  fs.writeFileSync(execPath, '');
  if (process.platform !== 'win32') {
    fs.chmodSync(execPath, 0o755);
  }
  return { tmpDir, execPath };
}

describe('chromium-resolver', function () {
  describe('findChromiumFromUserSetting', function () {
    it('should return the path when it exists', function () {
      var resolver = require('../../src/chromium-resolver');
      var { tmpDir, execPath } = createTempExecutable();
      try {
        var result = resolver.findChromiumFromUserSetting(execPath);
        assert.strictEqual(result, execPath);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('should return null when path does not exist', function () {
      var resolver = require('../../src/chromium-resolver');
      var result = resolver.findChromiumFromUserSetting('/nonexistent/chrome');
      assert.strictEqual(result, null);
    });

    it('should return null for empty string', function () {
      var resolver = require('../../src/chromium-resolver');
      var result = resolver.findChromiumFromUserSetting('');
      assert.strictEqual(result, null);
    });
  });

  describe('findChromiumFromSystem', function () {
    it('should return a string or null', function () {
      var resolver = require('../../src/chromium-resolver');
      var result = resolver.findChromiumFromSystem();
      assert.ok(result === null || typeof result === 'string');
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test test/unit/chromium-resolver.test.js`
Expected: FAIL — `Cannot find module '../../src/chromium-resolver'`

- [ ] **Step 3: chromium-resolver.js を実装 — findChromiumFromUserSetting と findChromiumFromSystem**

`src/chromium-resolver.js`:

```js
'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');

/**
 * Step 1: Check user-configured executable path.
 * Returns the path if it exists and is accessible, null otherwise.
 */
function findChromiumFromUserSetting(executablePath) {
  if (!executablePath) {
    return null;
  }
  try {
    fs.accessSync(executablePath);
    return executablePath;
  } catch (error) {
    console.warn('[Markdown PDF] Configured executablePath not found: ' + executablePath);
    return null;
  }
}

/**
 * Step 2: Detect OS-installed Chrome/Chromium/Edge.
 * Uses @puppeteer/browsers computeSystemExecutablePath for Chrome,
 * then falls back to known Edge/Chromium paths.
 */
function findChromiumFromSystem() {
  // Try Chrome via @puppeteer/browsers
  try {
    var PB = require('@puppeteer/browsers');
    var chromePath = PB.computeSystemExecutablePath({
      browser: PB.Browser.CHROME,
      channel: PB.ChromeReleaseChannel.STABLE,
      platform: PB.detectBrowserPlatform()
    });
    if (chromePath) {
      return chromePath;
    }
  } catch (error) {
    // Chrome not found, continue to fallback
  }

  // Fallback: check known Edge and Chromium paths
  var candidates = getEdgeAndChromiumCandidates();
  for (var candidate of candidates) {
    try {
      fs.accessSync(candidate);
      return candidate;
    } catch (error) {
      // not found, try next
    }
  }

  return null;
}

/**
 * Returns platform-specific candidate paths for Edge and Chromium.
 */
function getEdgeAndChromiumCandidates() {
  var platform = process.platform;

  if (platform === 'win32') {
    var prefixes = [
      process.env.LOCALAPPDATA,
      process.env['PROGRAMFILES'],
      process.env['PROGRAMFILES(X86)'],
      'C:\\Program Files',
      'C:\\Program Files (x86)'
    ].filter(Boolean);

    var candidates = [];
    for (var prefix of prefixes) {
      candidates.push(path.join(prefix, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      candidates.push(path.join(prefix, 'Chromium', 'Application', 'chrome.exe'));
    }
    return candidates;
  }

  if (platform === 'darwin') {
    return [
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
  }

  // Linux
  return [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable'
  ];
}

module.exports = {
  findChromiumFromUserSetting,
  findChromiumFromSystem,
  getEdgeAndChromiumCandidates
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test test/unit/chromium-resolver.test.js`
Expected: すべてのテストが PASS

- [ ] **Step 5: コミット**

```bash
git add src/chromium-resolver.js test/unit/chromium-resolver.test.js
git commit -m "feat: add chromium-resolver module with user setting and OS detection"
```

---

### Task 4: chromium-resolver モジュール — 自動ダウンロード（Step 3）

**Files:**
- Modify: `src/chromium-resolver.js`
- Modify: `test/unit/chromium-resolver.test.js`

- [ ] **Step 1: テストを追加 — ensureChromiumDownloaded**

`test/unit/chromium-resolver.test.js` に以下の describe ブロックを追加:

```js
  describe('getExpectedBuildId', function () {
    it('should return the chrome revision string from puppeteer-core', function () {
      var resolver = require('../../src/chromium-resolver');
      var buildId = resolver.getExpectedBuildId();
      assert.ok(typeof buildId === 'string');
      assert.ok(buildId.length > 0);
      // Should look like a Chrome version (e.g., '146.0.7680.153')
      assert.match(buildId, /^\d+\.\d+\.\d+\.\d+$/);
    });
  });

  describe('cleanupOldChromium', function () {
    it('should not throw when cache dir does not exist', async function () {
      var resolver = require('../../src/chromium-resolver');
      await assert.doesNotReject(
        resolver.cleanupOldChromium('/nonexistent/cache/dir', 'keep-this-id')
      );
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test test/unit/chromium-resolver.test.js`
Expected: FAIL — `resolver.getExpectedBuildId is not a function`

- [ ] **Step 3: chromium-resolver.js にダウンロード関連の関数を追加**

`src/chromium-resolver.js` の末尾の `module.exports` の前に以下を追加:

```js
/**
 * Returns the Chrome buildId that the current puppeteer-core expects.
 */
function getExpectedBuildId() {
  var revisions = require('puppeteer-core/lib/cjs/puppeteer/revisions.js');
  return revisions.PUPPETEER_REVISIONS.chrome;
}

/**
 * Step 3: Download Chromium to the cache directory if not already present.
 * Returns the executable path of the downloaded Chromium.
 *
 * @param {string} cacheDir - The directory to store downloaded Chromium (globalStorageUri)
 * @param {function} [onProgress] - Optional callback(downloadedBytes, totalBytes)
 * @returns {Promise<string>} The executable path
 */
async function ensureChromiumDownloaded(cacheDir, onProgress) {
  var PB = require('@puppeteer/browsers');
  var buildId = getExpectedBuildId();
  var platform = PB.detectBrowserPlatform();

  // Check if already cached
  try {
    var executablePath = PB.computeExecutablePath({
      browser: PB.Browser.CHROME,
      buildId: buildId,
      cacheDir: cacheDir,
      platform: platform
    });
    fs.accessSync(executablePath);
    return executablePath;
  } catch (error) {
    // Not cached, need to download
  }

  // Create cache directory if it doesn't exist
  fs.mkdirSync(cacheDir, { recursive: true });

  // Download
  var installedBrowser = await PB.install({
    browser: PB.Browser.CHROME,
    buildId: buildId,
    cacheDir: cacheDir,
    platform: platform,
    downloadProgressCallback: onProgress || undefined
  });

  // Clean up old versions
  await cleanupOldChromium(cacheDir, buildId);

  return installedBrowser.executablePath;
}

/**
 * Remove old Chromium versions from the cache directory, keeping only the specified buildId.
 *
 * @param {string} cacheDir - The cache directory
 * @param {string} keepBuildId - The buildId to keep
 */
async function cleanupOldChromium(cacheDir, keepBuildId) {
  try {
    var PB = require('@puppeteer/browsers');
    var installed = await PB.getInstalledBrowsers({ cacheDir: cacheDir });
    for (var browser of installed) {
      if (browser.browser === PB.Browser.CHROME && browser.buildId !== keepBuildId) {
        await PB.uninstall({
          browser: browser.browser,
          buildId: browser.buildId,
          cacheDir: cacheDir,
          platform: browser.platform
        });
        console.log('[Markdown PDF] Removed old Chromium: ' + browser.buildId);
      }
    }
  } catch (error) {
    // Non-critical: if cleanup fails, just log and continue
    console.warn('[Markdown PDF] Failed to cleanup old Chromium: ' + error.message);
  }
}

/**
 * Resolve Chromium executable path with the full priority chain.
 * Step 1: User setting → Step 2: OS detection → Step 3: Download
 *
 * @param {string} userExecutablePath - Value of markdown-pdf.executablePath setting
 * @param {string} cacheDir - Cache directory for downloaded Chromium (globalStorageUri)
 * @param {function} [onProgress] - Optional download progress callback
 * @returns {Promise<string|null>} The executable path, or null if all steps fail
 */
async function resolveChromiumPath(userExecutablePath, cacheDir, onProgress) {
  // Step 1: User setting
  var result = findChromiumFromUserSetting(userExecutablePath);
  if (result) {
    return result;
  }

  // Step 2: OS detection
  result = findChromiumFromSystem();
  if (result) {
    return result;
  }

  // Step 3: Download
  try {
    return await ensureChromiumDownloaded(cacheDir, onProgress);
  } catch (error) {
    console.error('[Markdown PDF] Failed to download Chromium: ' + error.message);
    return null;
  }
}
```

`module.exports` を更新:

```js
module.exports = {
  findChromiumFromUserSetting,
  findChromiumFromSystem,
  getEdgeAndChromiumCandidates,
  getExpectedBuildId,
  ensureChromiumDownloaded,
  cleanupOldChromium,
  resolveChromiumPath
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test test/unit/chromium-resolver.test.js`
Expected: すべてのテストが PASS

- [ ] **Step 5: コミット**

```bash
git add src/chromium-resolver.js test/unit/chromium-resolver.test.js
git commit -m "feat: add Chromium download and cache management to chromium-resolver"
```

---

### Task 5: extension.js の書き換え — 新モジュールへの切り替え

**Files:**
- Modify: `extension.js:1-10` (require 追加)
- Modify: `extension.js:280-315` (exportPdf 内の executablePath 解決)
- Modify: `extension.js:482-558` (checkPuppeteerBinary, installChromium の置き換え)
- Modify: `extension.js:577-587` (init の更新)

- [ ] **Step 1: extension.js の冒頭に chromium-resolver の require を追加**

`extension.js` の先頭の require ブロック（6行目付近）に追加:

```js
var chromiumResolver = require('./src/chromium-resolver');
```

- [ ] **Step 2: activate 関数に context を保存する処理を追加**

`extension.js` の `activate` 関数内、`init()` 呼び出しの前に `context` を保存する。`globalStorageUri` を利用するために必要:

```js
function activate(context) {
  extensionContext = context;
  init();
```

ファイル先頭の `var INSTALL_CHECK = false;` の後に追加:

```js
var extensionContext = null;
```

- [ ] **Step 3: checkPuppeteerBinary を書き換え**

既存の `checkPuppeteerBinary()` 関数（482〜502行目）を以下に置き換え:

```js
function checkPuppeteerBinary() {
  try {
    var executablePath = vscode.workspace.getConfiguration('markdown-pdf')['executablePath'] || '';

    // Step 1: User setting
    var result = chromiumResolver.findChromiumFromUserSetting(executablePath);
    if (result) {
      INSTALL_CHECK = true;
      return true;
    }

    // Step 2: OS detection
    result = chromiumResolver.findChromiumFromSystem();
    if (result) {
      INSTALL_CHECK = true;
      return true;
    }

    // Step 3: Check downloaded Chromium cache
    if (extensionContext) {
      var cacheDir = extensionContext.globalStorageUri.fsPath;
      var PB = require('@puppeteer/browsers');
      var buildId = chromiumResolver.getExpectedBuildId();
      try {
        var cachedPath = PB.computeExecutablePath({
          browser: PB.Browser.CHROME,
          buildId: buildId,
          cacheDir: cacheDir,
          platform: PB.detectBrowserPlatform()
        });
        var fs = require('fs');
        fs.accessSync(cachedPath);
        return true;
      } catch (error) {
        // not cached
      }
    }

    return false;
  } catch (error) {
    showErrorMessage('checkPuppeteerBinary()', error);
    return false;
  }
}
```

- [ ] **Step 4: installChromium を書き換え**

既存の `installChromium()` 関数（508〜558行目）を以下に置き換え:

```js
async function installChromium() {
  try {
    vscode.window.showInformationMessage('[Markdown PDF] Installing Chromium ...');
    var statusbarmessage = vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ...');

    // proxy setting
    setProxy();

    var StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
    var cacheDir = extensionContext.globalStorageUri.fsPath;

    function onProgress(downloadedBytes, totalBytes) {
      var progress = parseInt(downloadedBytes / totalBytes * 100);
      vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ' + progress + '%', StatusbarMessageTimeout);
    }

    var executablePath = await chromiumResolver.ensureChromiumDownloaded(cacheDir, onProgress);

    if (executablePath && checkPuppeteerBinary()) {
      INSTALL_CHECK = true;
      statusbarmessage.dispose();
      vscode.window.setStatusBarMessage('$(markdown) Chromium installation succeeded!', StatusbarMessageTimeout);
      vscode.window.showInformationMessage('[Markdown PDF] Chromium installation succeeded.');
    } else {
      statusbarmessage.dispose();
      vscode.window.setStatusBarMessage('$(markdown) ERROR: Chromium installation failed!', StatusbarMessageTimeout);
      showErrorMessage('Chromium installation failed.');
    }
  } catch (error) {
    showErrorMessage('Failed to download Chromium! \
      If you are behind a proxy, set the http.proxy option to settings.json and restart Visual Studio Code. \
      See https://github.com/yzane/vscode-markdown-pdf#install', error);
  }
}
```

- [ ] **Step 5: init を async に変更**

既存の `init()` 関数（577〜587行目）を以下に置き換え:

```js
async function init() {
  try {
    if (checkPuppeteerBinary()) {
      INSTALL_CHECK = true;
    } else {
      await installChromium();
    }
  } catch (error) {
    showErrorMessage('init()', error);
  }
}
```

- [ ] **Step 6: exportPdf 内の executablePath 解決を更新**

`extension.js` 305〜314行目付近の以下のコード:

```js
        const puppeteer = require('puppeteer-core');
        // create temporary file
        var tmpfilename = utils.generateTmpHtmlFilename(filename);
        exportHtml(data, tmpfilename);
        var options = {
          executablePath: vscode.workspace.getConfiguration('markdown-pdf')['executablePath'] || puppeteer.executablePath(),
          args: ['--lang='+vscode.env.language, '--no-sandbox', '--disable-setuid-sandbox']
          // Setting Up Chrome Linux Sandbox
          // https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
      };
```

を以下に置き換え:

```js
        const puppeteer = require('puppeteer-core');
        // create temporary file
        var tmpfilename = utils.generateTmpHtmlFilename(filename);
        exportHtml(data, tmpfilename);
        var cacheDir = extensionContext ? extensionContext.globalStorageUri.fsPath : '';
        var userExecPath = vscode.workspace.getConfiguration('markdown-pdf')['executablePath'] || '';
        var resolvedExecPath = await chromiumResolver.resolveChromiumPath(userExecPath, cacheDir);
        if (!resolvedExecPath) {
          showErrorMessage('Chromium or Chrome does not exist! \
            See https://github.com/yzane/vscode-markdown-pdf#install');
          return;
        }
        var options = {
          executablePath: resolvedExecPath,
          args: ['--lang='+vscode.env.language, '--no-sandbox', '--disable-setuid-sandbox']
        };
```

- [ ] **Step 7: ユニットテストが通ることを確認**

Run: `npm run test:unit`
Expected: すべてのテストが PASS

- [ ] **Step 8: コミット**

```bash
git add extension.js
git commit -m "feat: integrate chromium-resolver into extension for puppeteer-core 24.x"
```

---

### Task 6: 回帰テスト・動作確認

**Files:**
- なし（テスト実行のみ）

- [ ] **Step 1: ユニットテスト全体を実行**

Run: `npm run test:unit`
Expected: すべてのテストが PASS

- [ ] **Step 2: インテグレーションテストを実行**

Run: `npm run test:integration`
Expected: すべてのテストが PASS（Chromium が利用可能な環境の場合）

- [ ] **Step 3: puppeteer-core 24.x の page.pdf() オプション互換性を確認**

以下のオプションが 24.x でも受け入れられることをコードレビューで確認:
- `path`, `format`, `width`, `height`, `scale`
- `displayHeaderFooter`, `headerTemplate`, `footerTemplate`
- `printBackground`, `pageRanges`, `margin`
- `orientation` (注: puppeteer 24.x では `landscape: true` の形式。現在のコードで `orientation` がどう使われているか `utils.buildPdfOptions()` を確認すること)

以下のスクリーンショットオプションも確認:
- `path`, `type`, `quality`, `clip`, `omitBackground`

- [ ] **Step 4: 問題があれば修正してコミット**

---

### Task 7: 最終確認とクリーンアップ

**Files:**
- なし（確認のみ）

- [ ] **Step 1: 不要な旧コードが残っていないか確認**

以下のパターンが extension.js に残っていないことを確認:
- `puppeteer.executablePath()`
- `puppeteer.createBrowserFetcher()`
- `chromium_revision`

Run: `grep -n "executablePath\(\)\|createBrowserFetcher\|chromium_revision" extension.js`
Expected: 該当なし

- [ ] **Step 2: npm run test を実行**

Run: `npm run test`
Expected: ユニットテスト・インテグレーションテストが PASS

- [ ] **Step 3: コミット（修正があれば）**

```bash
git add -A
git commit -m "chore: cleanup old puppeteer 2.x API references"
```
