# convertMarkdownToHtml / makeHtml ロジック抽出・テスト 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `extension.js` の `convertMarkdownToHtml()` と `makeHtml()` からテスト可能な純粋関数を抽出し、ユニットテストを追加する。

**Architecture:** vscode API 依存のない純粋関数を `src/utils.js` に抽出し、`extension.js` 側は抽出した関数の呼び出しに置き換える。既存の `buildPdfOptions`/`buildImageOptions` パターンを踏襲する。

**Tech Stack:** Node.js, mocha, assert, highlight.js (テスト用)

**Branch:** `feature/extract-convert-html-tests` (from `develop`)

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `src/utils.js` | 修正 | 4つの新関数を追加 (`buildHighlightCallback`, `buildMarkdownItOptions`, `buildPlantumlOptions`, `buildHtmlViewData`) |
| `extension.js` | 修正 | 抽出した関数の呼び出しに置き換え |
| `test/unit/utils.test.js` | 修正 | 新関数のテスト + 既存関数のエッジケーステスト追加 |

---

### Task 1: `buildHighlightCallback` — テストと実装

**Files:**
- Modify: `src/utils.js:310` (新関数追加、exports に登録)
- Modify: `test/unit/utils.test.js:1017` (テスト追加)

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` の `});` (最終行1017) の直前に以下を追加:

```js
  describe('buildHighlightCallback', function () {
    // Use real highlight.js for tests
    var hljs = require('highlight.js');
    var escapeHtml = require('markdown-it')().utils.escapeHtml;

    it('should return mermaid div when lang matches mermaid', function () {
      var highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      var result = highlight('graph TD;', 'mermaid');
      assert.strictEqual(result, '<div class="mermaid">graph TD;</div>');
    });

    it('should return mermaid div for case-insensitive match', function () {
      var highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      var result = highlight('graph TD;', 'Mermaid');
      assert.strictEqual(result, '<div class="mermaid">graph TD;</div>');
    });

    it('should highlight known language with hljs', function () {
      var highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      var result = highlight('var x = 1;', 'javascript');
      assert.ok(result.indexOf('<pre class="hljs"><code><div>') === 0);
      assert.ok(result.indexOf('</div></code></pre>') > 0);
      // hljs should produce span tags for syntax tokens
      assert.ok(result.indexOf('<span') > 0);
    });

    it('should escape and wrap when lang is unknown', function () {
      var highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      var result = highlight('<script>alert("xss")</script>', 'unknownlang999');
      assert.ok(result.indexOf('<pre class="hljs"><code><div>') === 0);
      assert.ok(result.indexOf('<script>') === -1, 'should escape HTML');
      assert.ok(result.indexOf('&lt;script&gt;') > 0);
    });

    it('should escape and wrap when lang is empty string', function () {
      var highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      var result = highlight('plain text', '');
      assert.strictEqual(result, '<pre class="hljs"><code><div>plain text</div></code></pre>');
    });

    it('should fallback to escapeHtml when hljs.highlight throws', function () {
      var badHljs = {
        getLanguage: function () { return true; },
        highlight: function () { throw new Error('hljs error'); }
      };
      var highlight = utils.buildHighlightCallback(badHljs, escapeHtml);
      var result = highlight('<b>code</b>', 'javascript');
      assert.ok(result.indexOf('<pre class="hljs"><code><div>') === 0);
      assert.ok(result.indexOf('&lt;b&gt;') > 0);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: `TypeError: utils.buildHighlightCallback is not a function`

- [ ] **Step 3: 実装を書く**

`src/utils.js` の `buildImageOptions` 関数の後 (310行目の `}` の後) に追加:

```js
function buildHighlightCallback(hljs, escapeHtml) {
  return function (str, lang) {
    if (lang && lang.match(/\bmermaid\b/i)) {
      return '<div class="mermaid">' + str + '</div>';
    }

    if (lang && hljs.getLanguage(lang)) {
      try {
        str = hljs.highlight(lang, str, true).value;
      } catch (error) {
        str = escapeHtml(str);
      }
    } else {
      str = escapeHtml(str);
    }
    return '<pre class="hljs"><code><div>' + str + '</div></code></pre>';
  };
}
```

`module.exports` に `buildHighlightCallback` を追加する。

- [ ] **Step 4: テストがパスすることを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass, including 6 new `buildHighlightCallback` tests

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract buildHighlightCallback from extension.js and add unit tests"
```

---

### Task 2: `buildMarkdownItOptions` — テストと実装

**Files:**
- Modify: `src/utils.js` (新関数追加、exports に登録)
- Modify: `test/unit/utils.test.js` (テスト追加)

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` の `buildHighlightCallback` describe ブロックの後に追加:

```js
  describe('buildMarkdownItOptions', function () {
    it('should always set html to true', function () {
      var result = utils.buildMarkdownItOptions({
        breaks: false,
        hljs: {},
        escapeHtml: function (s) { return s; }
      });
      assert.strictEqual(result.html, true);
    });

    it('should pass through breaks value', function () {
      var result = utils.buildMarkdownItOptions({
        breaks: true,
        hljs: {},
        escapeHtml: function (s) { return s; }
      });
      assert.strictEqual(result.breaks, true);
    });

    it('should set highlight as a function', function () {
      var result = utils.buildMarkdownItOptions({
        breaks: false,
        hljs: {},
        escapeHtml: function (s) { return s; }
      });
      assert.strictEqual(typeof result.highlight, 'function');
    });

    it('should handle undefined breaks', function () {
      var result = utils.buildMarkdownItOptions({
        breaks: undefined,
        hljs: {},
        escapeHtml: function (s) { return s; }
      });
      assert.strictEqual(result.breaks, undefined);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: `TypeError: utils.buildMarkdownItOptions is not a function`

- [ ] **Step 3: 実装を書く**

`src/utils.js` の `buildHighlightCallback` 関数の後に追加:

```js
function buildMarkdownItOptions(config) {
  return {
    html: true,
    breaks: config.breaks,
    highlight: buildHighlightCallback(config.hljs, config.escapeHtml)
  };
}
```

`module.exports` に `buildMarkdownItOptions` を追加する。

- [ ] **Step 4: テストがパスすることを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass, including 4 new `buildMarkdownItOptions` tests

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract buildMarkdownItOptions from extension.js and add unit tests"
```

---

### Task 3: `buildPlantumlOptions` — テストと実装

**Files:**
- Modify: `src/utils.js` (新関数追加、exports に登録)
- Modify: `test/unit/utils.test.js` (テスト追加)

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` の `buildMarkdownItOptions` describe ブロックの後に追加:

```js
  describe('buildPlantumlOptions', function () {
    it('should use frontmatter values when provided', function () {
      var result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: '@startgantt',
        frontmatterCloseMarker: '@endgantt',
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: 'http://plantuml.example.com'
      });
      assert.strictEqual(result.openMarker, '@startgantt');
      assert.strictEqual(result.closeMarker, '@endgantt');
      assert.strictEqual(result.server, 'http://plantuml.example.com');
    });

    it('should fallback to settings when frontmatter is undefined', function () {
      var result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: undefined,
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: 'http://server.example.com'
      });
      assert.strictEqual(result.openMarker, '@startuml');
      assert.strictEqual(result.closeMarker, '@enduml');
    });

    it('should fallback to defaults when both frontmatter and settings are empty', function () {
      var result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: undefined,
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '',
        settingsCloseMarker: '',
        server: ''
      });
      assert.strictEqual(result.openMarker, '@startuml');
      assert.strictEqual(result.closeMarker, '@enduml');
      assert.strictEqual(result.server, '');
    });

    it('should pass server value through', function () {
      var result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: undefined,
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: 'https://custom.plantuml.server/svg'
      });
      assert.strictEqual(result.server, 'https://custom.plantuml.server/svg');
    });

    it('should allow mixed frontmatter and settings overrides', function () {
      var result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: '@startmindmap',
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: ''
      });
      assert.strictEqual(result.openMarker, '@startmindmap');
      assert.strictEqual(result.closeMarker, '@enduml');
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: `TypeError: utils.buildPlantumlOptions is not a function`

- [ ] **Step 3: 実装を書く**

`src/utils.js` の `buildMarkdownItOptions` 関数の後に追加:

```js
function buildPlantumlOptions(config) {
  return {
    openMarker: config.frontmatterOpenMarker || config.settingsOpenMarker || '@startuml',
    closeMarker: config.frontmatterCloseMarker || config.settingsCloseMarker || '@enduml',
    server: config.server
  };
}
```

`module.exports` に `buildPlantumlOptions` を追加する。

- [ ] **Step 4: テストがパスすることを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass, including 5 new `buildPlantumlOptions` tests

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract buildPlantumlOptions from extension.js and add unit tests"
```

---

### Task 4: `buildHtmlViewData` — テストと実装

**Files:**
- Modify: `src/utils.js` (新関数追加、exports に登録)
- Modify: `test/unit/utils.test.js` (テスト追加)

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` の `buildPlantumlOptions` describe ブロックの後に追加:

```js
  describe('buildHtmlViewData', function () {
    it('should build script tag from mermaidServer', function () {
      var result = utils.buildHtmlViewData({
        content: '<h1>Hello</h1>',
        title: 'test.md',
        style: '<style>body{}</style>',
        mermaidServer: 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js'
      });
      assert.strictEqual(result.mermaid, '<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>');
    });

    it('should pass through title, style, and content', function () {
      var result = utils.buildHtmlViewData({
        content: '<p>body</p>',
        title: 'README.md',
        style: '<style>h1{color:red}</style>',
        mermaidServer: ''
      });
      assert.strictEqual(result.title, 'README.md');
      assert.strictEqual(result.style, '<style>h1{color:red}</style>');
      assert.strictEqual(result.content, '<p>body</p>');
    });

    it('should handle empty mermaidServer', function () {
      var result = utils.buildHtmlViewData({
        content: '',
        title: '',
        style: '',
        mermaidServer: ''
      });
      assert.strictEqual(result.mermaid, '<script src=""></script>');
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: `TypeError: utils.buildHtmlViewData is not a function`

- [ ] **Step 3: 実装を書く**

`src/utils.js` の `buildPlantumlOptions` 関数の後に追加:

```js
function buildHtmlViewData(config) {
  return {
    title: config.title,
    style: config.style,
    content: config.content,
    mermaid: '<script src="' + config.mermaidServer + '"></script>'
  };
}
```

`module.exports` に `buildHtmlViewData` を追加する。

- [ ] **Step 4: テストがパスすることを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass, including 3 new `buildHtmlViewData` tests

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract buildHtmlViewData from extension.js and add unit tests"
```

---

### Task 5: `extension.js` を新関数の呼び出しに置き換え

**Files:**
- Modify: `extension.js:148-170` (markdown-it 初期化)
- Modify: `extension.js:260-264` (PlantUML オプション)
- Modify: `extension.js:304-315` (makeHtml view データ)

- [ ] **Step 1: `convertMarkdownToHtml` の markdown-it 初期化を置き換え**

`extension.js` の148-170行を以下に置き換え:

```js
      var md = require('markdown-it')(utils.buildMarkdownItOptions({
        breaks: breaks,
        hljs: hljs,
        escapeHtml: require('markdown-it')().utils.escapeHtml
      }));
```

注意: `escapeHtml` は markdown-it の静的ユーティリティ (`require('markdown-it')().utils.escapeHtml`) から取得する。元のコードでは `md.utils.escapeHtml` を使っていたが、この関数はインスタンス非依存なので等価。

元のコードでは hljs.highlight のエラー時に `showErrorMessage` を呼んでいたが、抽出後はエラーログを出さない（純粋関数にするため）。フォールバック動作（escapeHtml）は維持される。

- [ ] **Step 2: PlantUML オプションを置き換え**

`extension.js` の260-264行を以下に置き換え:

```js
  var plantumlOptions = utils.buildPlantumlOptions({
    frontmatterOpenMarker: matterParts.data.plantumlOpenMarker,
    frontmatterCloseMarker: matterParts.data.plantumlCloseMarker,
    settingsOpenMarker: vscode.workspace.getConfiguration('markdown-pdf')['plantumlOpenMarker'] || '',
    settingsCloseMarker: vscode.workspace.getConfiguration('markdown-pdf')['plantumlCloseMarker'] || '',
    server: vscode.workspace.getConfiguration('markdown-pdf')['plantumlServer'] || ''
  });
```

- [ ] **Step 3: `makeHtml` の view データ組み立てを置き換え**

`extension.js` の303-315行を以下に置き換え:

```js
    var mermaidServer = vscode.workspace.getConfiguration('markdown-pdf')['mermaidServer'] || '';

    // compile template
    var mustache = require('mustache');

    var view = utils.buildHtmlViewData({
      content: data,
      title: path.basename(uri.fsPath),
      style: style,
      mermaidServer: mermaidServer
    });
    return mustache.render(template, view);
```

- [ ] **Step 4: ユニットテストがパスすることを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: コミット**

```bash
git add extension.js
git commit -m "refactor: delegate convertMarkdownToHtml/makeHtml option building to utils functions"
```

---

### Task 6: 既存関数のエッジケーステスト追加

**Files:**
- Modify: `test/unit/utils.test.js` (既存 describe ブロック内にテスト追加)

- [ ] **Step 1: `buildPdfOptions` のエッジケーステストを追加**

`test/unit/utils.test.js` の `buildPdfOptions` describe ブロック内 (最後の `it` の後) に追加:

```js
    it('should pass through margin object', function () {
      var margin = { top: '10mm', right: '15mm', bottom: '10mm', left: '15mm' };
      var result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: margin
      });
      assert.deepStrictEqual(result.margin, margin);
    });

    it('should handle empty headerTemplate and footerTemplate', function () {
      var result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: true,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' }
      });
      assert.strictEqual(result.headerTemplate, '');
      assert.strictEqual(result.footerTemplate, '');
    });
```

- [ ] **Step 2: `buildImageOptions` のエッジケーステストを追加**

`test/unit/utils.test.js` の `buildImageOptions` describe ブロック内 (最後の `it` の後) に追加:

```js
    it('should set omitBackground false when specified', function () {
      var result = utils.buildImageOptions({
        path: '/out/test.png',
        type: 'png',
        quality: 100,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false
      });
      assert.strictEqual(result.omitBackground, false);
    });

    it('should set fullPage true when all clip values are null', function () {
      var result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 80,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false
      });
      assert.strictEqual(result.fullPage, true);
      assert.strictEqual(result.clip, undefined);
      assert.strictEqual(result.quality, 80);
    });

    it('should accept quality 0 for JPEG as valid boundary', function () {
      var result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 0,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false
      });
      assert.strictEqual(result.quality, 0);
    });
```

- [ ] **Step 3: テストがパスすることを確認**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass, including 5 new edge case tests

- [ ] **Step 4: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add edge case tests for buildPdfOptions and buildImageOptions"
```

---

### Task 7: 最終確認

**Files:** (変更なし — 確認のみ)

- [ ] **Step 1: 全ユニットテスト実行**

Run: `npm run test:unit 2>&1 | tail -30`
Expected: All tests pass (119 既存 + 24 新規 = 143件。非 Windows では別途 pending あり)

- [ ] **Step 2: テスト件数の確認**

Run: `npm run test:unit 2>&1 | grep -E 'passing|failing'`
Expected: `143 passing`, `0 failing`（非 Windows では別途 pending あり）
