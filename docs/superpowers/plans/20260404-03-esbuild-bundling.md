# esbuild バンドル化 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** esbuild で JS 依存をバンドルし、.vsix のパッケージサイズを 21.85 MB から 5-8 MB に削減する。

**Architecture:** esbuild でエントリポイント `extension.js` を `dist/extension.js` にバンドルする。puppeteer-core 系は external 指定で node_modules に残す。`.vscodeignore` を強化して不要ファイルを除外する。

**Tech Stack:** esbuild, vsce

---

### Task 1: esbuild の導入とビルドスクリプト追加

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: esbuild を devDependencies に追加**

Run: `npm install --save-dev esbuild`

- [ ] **Step 2: package.json にビルドスクリプトを追加し、main を変更**

`package.json` の `"scripts"` セクションに `build`, `watch`, `package` を追加し、`"main"` を変更する。

```json
"main": "./dist/extension",
```

```json
"scripts": {
  "build": "esbuild extension.js --bundle --outfile=dist/extension.js --format=cjs --platform=node --external:vscode --external:puppeteer-core --external:@puppeteer/browsers",
  "watch": "npm run build -- --watch",
  "package": "npm run build && vsce package",
  "test": "npm run test:unit && npm run test:integration",
  "test:unit": "node --test test/unit/**/*.test.js",
  "test:integration": "vscode-test --config .vscode-test.mjs"
}
```

- [ ] **Step 3: .gitignore に dist/ を追加**

`.gitignore` の末尾に追加:

```
dist/
```

- [ ] **Step 4: ビルドを実行して成功を確認**

Run: `npm run build`
Expected: `dist/extension.js` が生成される。エラーなし。

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add esbuild and build scripts for bundling"
```

---

### Task 2: extension.js の `__dirname` 参照を修正

**Files:**
- Modify: `extension.js`

バンドル後は `__dirname` が `dist/` を指すため、静的アセットへのパスを `EXTENSION_ROOT` 経由に変更する。

- [ ] **Step 1: `EXTENSION_ROOT` 変数を導入し、4箇所のパス参照を変更**

`extension.js` の冒頭（`var os = require('os');` の次の行）に以下を追加:

```js
var EXTENSION_ROOT = path.join(__dirname, '..');
```

次の4箇所を変更する:

1. emoji.json の読み込み（`convertMarkdownToHtml` 関数内）:

変更前:
```js
    var emojies_defs = require(path.join(__dirname, 'data', 'emoji.json'));
```
変更後:
```js
    var emojies_defs = require(path.join(EXTENSION_ROOT, 'data', 'emoji.json'));
```

2. emoji 画像パス（`convertMarkdownToHtml` 関数内）:

変更前:
```js
      var emojipath = path.join(__dirname, 'node_modules', 'emoji-images', 'pngs', emoji + '.png');
```
変更後:
```js
      var emojipath = path.join(EXTENSION_ROOT, 'node_modules', 'emoji-images', 'pngs', emoji + '.png');
```

3. テンプレート読み込み（`makeHtml` 関数内）:

変更前:
```js
    var filename = path.join(__dirname, 'template', 'template.html');
```
変更後:
```js
    var filename = path.join(EXTENSION_ROOT, 'template', 'template.html');
```

4. スタイル読み込みの baseDir（`readStyles` 関数内）:

変更前:
```js
      baseDir: __dirname,
```
変更後:
```js
      baseDir: EXTENSION_ROOT,
```

- [ ] **Step 2: ビルドして成功を確認**

Run: `npm run build`
Expected: `dist/extension.js` が生成される。エラーなし。

- [ ] **Step 3: コミット**

```bash
git add extension.js
git commit -m "fix: use EXTENSION_ROOT for static asset paths in bundled output"
```

---

### Task 3: `.vscodeignore` の強化

**Files:**
- Modify: `.vscodeignore`
- Modify: `test/unit/vscodeignore.test.js`

- [ ] **Step 1: `.vscodeignore` を書き換え**

`.vscodeignore` を以下の内容に書き換える:

```
# Source files (bundled into dist/)
extension.js
src/**
jsconfig.json

# Development and CI
.vscode/**
.github/**
.vscode-test/**
.cocoindex_code/**
.claude/**

# Documentation and samples
docs/**
work/**
sample/**

# Test
test/**

# Config and build artifacts
.eslintrc.json
*.vsix
*.bat
CLAUDE.md

# Node modules - exclude all, then re-include needed packages
node_modules/**

# Runtime asset packages (not bundled, needed at runtime)
!node_modules/emoji-images/
!node_modules/emoji-images/pngs/**
!node_modules/highlight.js/
!node_modules/highlight.js/styles/**

# puppeteer-core and @puppeteer/browsers (external, not bundled)
!node_modules/puppeteer-core/
!node_modules/puppeteer-core/**
!node_modules/@puppeteer/
!node_modules/@puppeteer/browsers/
!node_modules/@puppeteer/browsers/**

# Transitive dependencies of puppeteer-core and @puppeteer/browsers
!node_modules/@tootallnate/
!node_modules/@tootallnate/quickjs-emscripten/
!node_modules/@tootallnate/quickjs-emscripten/**
!node_modules/agent-base/
!node_modules/agent-base/**
!node_modules/ansi-regex/
!node_modules/ansi-regex/**
!node_modules/ansi-styles/
!node_modules/ansi-styles/**
!node_modules/ast-types/
!node_modules/ast-types/**
!node_modules/b4a/
!node_modules/b4a/**
!node_modules/bare-events/
!node_modules/bare-events/**
!node_modules/bare-fs/
!node_modules/bare-fs/**
!node_modules/bare-os/
!node_modules/bare-os/**
!node_modules/bare-path/
!node_modules/bare-path/**
!node_modules/bare-stream/
!node_modules/bare-stream/**
!node_modules/bare-url/
!node_modules/bare-url/**
!node_modules/basic-ftp/
!node_modules/basic-ftp/**
!node_modules/buffer-crc32/
!node_modules/buffer-crc32/**
!node_modules/chromium-bidi/
!node_modules/chromium-bidi/**
!node_modules/cliui/
!node_modules/cliui/**
!node_modules/color-convert/
!node_modules/color-convert/**
!node_modules/color-name/
!node_modules/color-name/**
!node_modules/data-uri-to-buffer/
!node_modules/data-uri-to-buffer/**
!node_modules/debug/
!node_modules/debug/**
!node_modules/degenerator/
!node_modules/degenerator/**
!node_modules/devtools-protocol/
!node_modules/devtools-protocol/**
!node_modules/emoji-regex/
!node_modules/emoji-regex/**
!node_modules/end-of-stream/
!node_modules/end-of-stream/**
!node_modules/escalade/
!node_modules/escalade/**
!node_modules/escodegen/
!node_modules/escodegen/**
!node_modules/esprima/
!node_modules/esprima/**
!node_modules/estraverse/
!node_modules/estraverse/**
!node_modules/esutils/
!node_modules/esutils/**
!node_modules/events-universal/
!node_modules/events-universal/**
!node_modules/extract-zip/
!node_modules/extract-zip/**
!node_modules/fast-fifo/
!node_modules/fast-fifo/**
!node_modules/fd-slicer/
!node_modules/fd-slicer/**
!node_modules/get-caller-file/
!node_modules/get-caller-file/**
!node_modules/get-stream/
!node_modules/get-stream/**
!node_modules/get-uri/
!node_modules/get-uri/**
!node_modules/http-proxy-agent/
!node_modules/http-proxy-agent/**
!node_modules/https-proxy-agent/
!node_modules/https-proxy-agent/**
!node_modules/ip-address/
!node_modules/ip-address/**
!node_modules/is-fullwidth-code-point/
!node_modules/is-fullwidth-code-point/**
!node_modules/lru-cache/
!node_modules/lru-cache/**
!node_modules/mitt/
!node_modules/mitt/**
!node_modules/ms/
!node_modules/ms/**
!node_modules/netmask/
!node_modules/netmask/**
!node_modules/once/
!node_modules/once/**
!node_modules/pac-proxy-agent/
!node_modules/pac-proxy-agent/**
!node_modules/pac-resolver/
!node_modules/pac-resolver/**
!node_modules/pend/
!node_modules/pend/**
!node_modules/progress/
!node_modules/progress/**
!node_modules/proxy-agent/
!node_modules/proxy-agent/**
!node_modules/proxy-from-env/
!node_modules/proxy-from-env/**
!node_modules/pump/
!node_modules/pump/**
!node_modules/require-directory/
!node_modules/require-directory/**
!node_modules/semver/
!node_modules/semver/**
!node_modules/smart-buffer/
!node_modules/smart-buffer/**
!node_modules/socks/
!node_modules/socks/**
!node_modules/socks-proxy-agent/
!node_modules/socks-proxy-agent/**
!node_modules/streamx/
!node_modules/streamx/**
!node_modules/string-width/
!node_modules/string-width/**
!node_modules/strip-ansi/
!node_modules/strip-ansi/**
!node_modules/tar-fs/
!node_modules/tar-fs/**
!node_modules/tar-stream/
!node_modules/tar-stream/**
!node_modules/teex/
!node_modules/teex/**
!node_modules/text-decoder/
!node_modules/text-decoder/**
!node_modules/tslib/
!node_modules/tslib/**
!node_modules/typed-query-selector/
!node_modules/typed-query-selector/**
!node_modules/webdriver-bidi-protocol/
!node_modules/webdriver-bidi-protocol/**
!node_modules/wrap-ansi/
!node_modules/wrap-ansi/**
!node_modules/wrappy/
!node_modules/wrappy/**
!node_modules/ws/
!node_modules/ws/**
!node_modules/y18n/
!node_modules/y18n/**
!node_modules/yargs/
!node_modules/yargs/**
!node_modules/yargs-parser/
!node_modules/yargs-parser/**
!node_modules/yauzl/
!node_modules/yauzl/**
!node_modules/zod/
!node_modules/zod/**
```

- [ ] **Step 2: vscodeignore テストを更新**

`test/unit/vscodeignore.test.js` を以下に書き換える:

```js
'use strict';

var { describe, it } = require('node:test');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

describe('.vscodeignore', function () {
  var vscodeignore;

  it('should load .vscodeignore', function () {
    var vscodeignorePath = path.join(__dirname, '..', '..', '.vscodeignore');
    vscodeignore = fs.readFileSync(vscodeignorePath, 'utf-8');
    assert.ok(vscodeignore.length > 0);
  });

  it('should exclude all node_modules by default', function () {
    assert.match(vscodeignore, /^node_modules\/\*\*$/m);
  });

  it('should exclude source files that are bundled', function () {
    assert.match(vscodeignore, /^extension\.js$/m);
    assert.match(vscodeignore, /^src\/\*\*$/m);
  });

  it('should re-include puppeteer-core and its dependencies', function () {
    assert.match(vscodeignore, /^!node_modules\/puppeteer-core\/\*\*$/m);
    assert.match(vscodeignore, /^!node_modules\/@puppeteer\/browsers\/\*\*$/m);
  });

  it('should re-include runtime asset packages', function () {
    assert.match(vscodeignore, /^!node_modules\/emoji-images\/pngs\/\*\*$/m);
    assert.match(vscodeignore, /^!node_modules\/highlight\.js\/styles\/\*\*$/m);
  });
});
```

- [ ] **Step 3: テストを実行して成功を確認**

Run: `npm run test:unit`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add .vscodeignore test/unit/vscodeignore.test.js
git commit -m "chore: strengthen .vscodeignore for esbuild bundling"
```

---

### Task 4: パッケージ化の検証

**Files:** なし（検証のみ）

- [ ] **Step 1: ビルドを実行**

Run: `npm run build`
Expected: `dist/extension.js` が生成される。エラーなし。

- [ ] **Step 2: vsce package を実行してサイズを確認**

Run: `npx @vscode/vsce package`
Expected:
- .vsix が生成される
- ファイルサイズが 5-8 MB 程度に削減されていること
- `dist/extension.js` が含まれていること
- `extension.js`（ソース）が含まれていないこと
- `src/` が含まれていないこと
- `node_modules/puppeteer-core/` が含まれていること
- `node_modules/emoji-images/pngs/` が含まれていること
- `node_modules/highlight.js/styles/` が含まれていること

- [ ] **Step 3: 含まれるファイルの詳細を確認**

Run: `npx @vscode/vsce ls --tree`
Expected: バンドル済み依存（cheerio, markdown-it 等）が含まれていないこと

- [ ] **Step 4: ユニットテストを実行**

Run: `npm run test:unit`
Expected: 全テスト PASS

- [ ] **Step 5: 生成した .vsix を削除**

Run: `rm -f *.vsix`

- [ ] **Step 6: コミット不要（検証のみ）**

検証結果に問題がなければ完了。問題があれば該当タスクに戻って修正する。
