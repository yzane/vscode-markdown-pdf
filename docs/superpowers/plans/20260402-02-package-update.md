# パッケージ最新化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依存パッケージを最新化し、rimraf/mkdirp を Node.js 組込み API に置き換える

**Architecture:** フェーズごとに更新 → テスト → コミットのサイクルで段階的に進める。puppeteer-core はスコープ外。すべてのパッケージは最新版でも CommonJS をサポートしているため、require() での利用に問題なし。

**Tech Stack:** Node.js, VS Code Extension API, markdown-it, highlight.js, cheerio, puppeteer-core (変更なし)

**ブランチ:** `feature/package-update` で作業すること。他のブランチに切り替えないこと。

---

## ファイル構成

- 変更: `package.json` — 依存バージョン更新、highlightStyle enum 更新
- 変更: `extension.js:381-384` — rimraf.sync → fs.rmSync
- 変更: `extension.js:420-426` — mkdirp.sync → fs.mkdirSync
- 変更: `src/compile.js:5,22-27` — rimraf → fs.rm
- 変更: `src/utils.js:289-307` — hljs.highlight API 変更
- 変更: `test/unit/utils.test.js:938-984` — highlight.js テスト更新
- 変更: `package-lock.json` — npm install で自動更新

---

### Task 1: パッチ/マイナー更新（gray-matter, mustache）

**Files:**
- Modify: `package.json`

- [ ] **Step 1: パッケージ更新**

```bash
npm install gray-matter@latest mustache@latest
```

- [ ] **Step 2: テスト実行**

Run: `npm run test:unit`
Expected: すべてのテストがパス

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "deps: update gray-matter and mustache to latest"
```

---

### Task 2: rimraf を Node.js 組込み API に置換

**Files:**
- Modify: `extension.js:381-384`
- Modify: `src/compile.js:1-27`
- Modify: `package.json`

- [ ] **Step 1: extension.js の deleteFile を fs.rmSync に置換**

`extension.js` の `deleteFile` 関数（381-384行目）を変更:

```javascript
// Before:
function deleteFile (path) {
  var rimraf = require('rimraf')
  rimraf.sync(path);
}

// After:
function deleteFile (path) {
  fs.rmSync(path, { recursive: true, force: true });
}
```

NOTE: `fs` は extension.js の先頭で既に `require('fs')` されていることを確認すること。されていなければ追加する。

- [ ] **Step 2: src/compile.js の deleteFile を fs.rm に置換**

`src/compile.js` を変更:

```javascript
// Before:
var rimraf = require('rimraf')
// ...
function deleteFile (dir) {
  rimraf(dir, function(err) {
    if (err) throw err;
    console.log(dir);
  });
}

// After (rimraf の require を削除し、関数を変更):
function deleteFile (dir) {
  fs.rm(dir, { recursive: true, force: true }, function(err) {
    if (err) throw err;
    console.log(dir);
  });
}
```

- [ ] **Step 3: rimraf をアンインストール**

```bash
npm uninstall rimraf
```

- [ ] **Step 4: テスト実行**

Run: `npm run test:unit`
Expected: すべてのテストがパス

- [ ] **Step 5: コミット**

```bash
git add extension.js src/compile.js package.json package-lock.json
git commit -m "refactor: replace rimraf with Node.js built-in fs.rmSync/fs.rm"
```

---

### Task 3: mkdirp を Node.js 組込み API に置換

**Files:**
- Modify: `extension.js:420-426`
- Modify: `package.json`

- [ ] **Step 1: extension.js の mkdir を fs.mkdirSync に置換**

`extension.js` の `mkdir` 関数（420-426行目）を変更:

```javascript
// Before:
function mkdir(path) {
  if (utils.isExistsDir(path)) {
    return;
  }
  var mkdirp = require('mkdirp');
  return mkdirp.sync(path);
}

// After:
function mkdir(path) {
  fs.mkdirSync(path, { recursive: true });
}
```

NOTE: `fs.mkdirSync` with `recursive: true` は既にディレクトリが存在する場合にエラーにならないため、`isExistsDir` チェックは不要。

- [ ] **Step 2: mkdirp をアンインストール**

```bash
npm uninstall mkdirp
```

- [ ] **Step 3: テスト実行**

Run: `npm run test:unit`
Expected: すべてのテストがパス

- [ ] **Step 4: コミット**

```bash
git add extension.js package.json package-lock.json
git commit -m "refactor: replace mkdirp with Node.js built-in fs.mkdirSync"
```

---

### Task 4: markdown-it エコシステムの更新

**Files:**
- Modify: `package.json`

- [ ] **Step 1: markdown-it 関連パッケージを一括更新**

```bash
npm install markdown-it@latest markdown-it-emoji@latest markdown-it-container@latest markdown-it-include@latest
```

- [ ] **Step 2: テスト実行**

Run: `npm run test:unit`
Expected: すべてのテストがパス

markdown-it 14.x は `md.renderer.rules.image`, `md.renderer.rules.html_block`, `md.use()` の API を維持している。`markdownIt().utils.escapeHtml` も利用可能。プラグインの `md.use()` インターフェースも変更なし。

- [ ] **Step 3: 失敗した場合の対応**

テストが失敗した場合、以下を確認:
- `markdown-it` の `utils.escapeHtml` が存在するか（`require('markdown-it')().utils.escapeHtml`）
- プラグインの `md.use()` が正常に動作するか
- `md.render()` の出力形式が変わっていないか

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json
git commit -m "deps: update markdown-it ecosystem to latest"
```

---

### Task 5: highlight.js の更新 — テスト修正

**Files:**
- Modify: `src/utils.js:289-307`
- Modify: `test/unit/utils.test.js:938-984`
- Modify: `package.json`

- [ ] **Step 1: highlight.js を更新**

```bash
npm install highlight.js@latest
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npm run test:unit`
Expected: `buildHighlightCallback` 関連のテストが失敗する（`hljs.highlight(lang, str, true)` の API が変更されているため）

- [ ] **Step 3: src/utils.js の highlight API 呼び出しを修正**

`src/utils.js` の `buildHighlightCallback` 関数（289-307行目）を変更:

```javascript
// Before (line 297):
        str = hljs.highlight(lang, str, true).value;

// After:
        str = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
```

highlight.js v11 では引数の順序が変わった:
- v9: `hljs.highlight(language, code, ignoreIllegals)`
- v11: `hljs.highlight(code, { language, ignoreIllegals })`

`hljs.getLanguage(lang)` は v11 でも利用可能なので変更不要。

- [ ] **Step 4: テスト実行して成功を確認**

Run: `npm run test:unit`
Expected: すべてのテストがパス

- [ ] **Step 5: package.json の highlightStyle enum を更新**

highlight.js v11 で削除・変更されたスタイルファイルを確認:

```bash
ls node_modules/highlight.js/styles/*.css | xargs -I{} basename {}
```

v9 にあった `darkula.css`（タイポ版）が v11 で削除されている可能性がある。package.json の `highlightStyle` enum から、v11 に存在しないファイルを削除し、新しいファイルを追加する。

具体的には:
1. `ls node_modules/highlight.js/styles/*.css` で v11 のスタイル一覧を取得
2. package.json の enum と突き合わせ
3. 存在しないものを削除、新しいものを追加

- [ ] **Step 6: テスト実行**

Run: `npm run test:unit`
Expected: すべてのテストがパス

- [ ] **Step 7: コミット**

```bash
git add src/utils.js package.json package-lock.json
git commit -m "deps: update highlight.js to v11 and fix API calls"
```

---

### Task 6: cheerio の更新

**Files:**
- Modify: `package.json`

- [ ] **Step 1: cheerio を更新**

```bash
npm install cheerio@latest
```

- [ ] **Step 2: テスト実行**

Run: `npm run test:unit`
Expected: すべてのテストがパス

cheerio 1.x は `cheerio.load(html)` + `$('img')` の API を維持しているため、コード変更は不要なはず。

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "deps: update cheerio to v1"
```

---

### Task 7: devDependencies の更新

**Files:**
- Modify: `package.json`

- [ ] **Step 1: devDependencies を更新**

```bash
npm install --save-dev @vscode/test-cli@latest @vscode/test-electron@latest removeNPMAbsolutePaths@latest
```

- [ ] **Step 2: テスト実行**

Run: `npm run test:unit`
Expected: すべてのテストがパス

- [ ] **Step 3: removeNPMAbsolutePaths の API 確認**

`src/compile.js` で使用している API が v3 でも動作するか確認:

```javascript
removeNPMAbsolutePaths(path, { force: true, fields: ['_where', '_args']})
```

v3 で API が変更されている場合は `src/compile.js` を修正する。

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json src/compile.js
git commit -m "deps: update devDependencies to latest"
```

---

### Task 8: 最終確認

- [ ] **Step 1: 全テスト実行**

```bash
npm test
```

Expected: ユニットテスト・インテグレーションテストすべてパス

- [ ] **Step 2: npm outdated で残りを確認**

```bash
npm outdated
```

Expected: puppeteer-core 以外は最新（またはスコープ外のパッケージのみ表示）

- [ ] **Step 3: 動作確認（手動）**

VS Code でマークダウンファイルを開き、以下のコマンドを実行:
- `Markdown PDF: Export (pdf)` — PDF 出力が正常
- `Markdown PDF: Export (html)` — HTML 出力が正常
- コードブロックのシンタックスハイライトが正常
- emoji が正常に表示される
