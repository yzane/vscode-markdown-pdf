# エクスポートオプション構築テスト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `exportPdf()` のオプション構築ロジックを純粋関数として抽出しユニットテストを追加、PlantUMLカスタムマーカーの統合テストを追加する。

**Architecture:** `extension.js` の `exportPdf()` 内にあるPDF/画像のオプション構築ロジック（~80行）を `src/utils.js` に `buildPdfOptions` と `buildImageOptions` として抽出。VS Code設定の取得は `extension.js` に残し、取得した値を純粋関数に渡す委譲パターン（既存の `resolveOutputDir`, `resolveHref`, `buildStyleTags` と同一）。

**Tech Stack:** Node.js, Mocha, assert, VS Code Extension Test Runner

**ブランチ:** `feature/export-options-tests`（`develop` から作成済み）

---

### Task 1: `buildPdfOptions` の失敗テストを書く

**Files:**
- Modify: `test/unit/utils.test.js:849` (末尾の `});` の前に追加)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js` の末尾 (`});` の直前) に以下を追加:

```javascript
  describe('buildPdfOptions', function () {
    it('should use format when width and height are both empty', function () {
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
        margin: { top: '', right: '', bottom: '', left: '' }
      });
      assert.strictEqual(result.format, 'A4');
      assert.strictEqual(result.width, '');
      assert.strictEqual(result.height, '');
    });

    it('should clear format when width is specified', function () {
      var result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '10cm',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' }
      });
      assert.strictEqual(result.format, '');
      assert.strictEqual(result.width, '10cm');
    });

    it('should clear format when height is specified', function () {
      var result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '15cm',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' }
      });
      assert.strictEqual(result.format, '');
      assert.strictEqual(result.height, '15cm');
    });

    it('should set landscape true when orientation is landscape', function () {
      var result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: 'landscape',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' }
      });
      assert.strictEqual(result.landscape, true);
    });

    it('should set landscape false when orientation is not landscape', function () {
      var result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: 'portrait',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' }
      });
      assert.strictEqual(result.landscape, false);
    });

    it('should apply transformTemplate to headerTemplate and footerTemplate', function () {
      var result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: true,
        headerTemplate: '%%ISO-DATE%%',
        footerTemplate: '%%ISO-TIME%%',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' }
      });
      // transformTemplate replaces %%ISO-DATE%% with YYYY-MM-DD pattern
      assert.ok(result.headerTemplate.match(/^\d{4}-\d{2}-\d{2}$/), 'headerTemplate should be a date: ' + result.headerTemplate);
      // transformTemplate replaces %%ISO-TIME%% with HH:MM:SS pattern
      assert.ok(result.footerTemplate.match(/^\d{2}:\d{2}:\d{2}$/), 'footerTemplate should be a time: ' + result.footerTemplate);
    });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd /home/z/devlop/github/vscode-markdown-pdf && npm run test:unit`

Expected: 6件が `utils.buildPdfOptions is not a function` で FAIL

---

### Task 2: `buildPdfOptions` を実装する

**Files:**
- Modify: `src/utils.js:258` (`module.exports` の前に追加)
- Modify: `src/utils.js:259` (`module.exports` に追加)

- [ ] **Step 1: `src/utils.js` に `buildPdfOptions` 関数を追加**

`module.exports = {` の直前に以下を追加:

```javascript
function buildPdfOptions(config) {
  var format_option = '';
  if (!config.width && !config.height) {
    format_option = config.format || 'A4';
  }

  var landscape_option = config.orientation === 'landscape';

  return {
    path: config.path,
    scale: config.scale,
    displayHeaderFooter: config.displayHeaderFooter,
    headerTemplate: transformTemplate(config.headerTemplate || ''),
    footerTemplate: transformTemplate(config.footerTemplate || ''),
    printBackground: config.printBackground,
    landscape: landscape_option,
    pageRanges: config.pageRanges,
    format: format_option,
    width: config.width,
    height: config.height,
    margin: config.margin,
    timeout: 0
  };
}
```

`module.exports` に `buildPdfOptions` を追加:

```javascript
module.exports = {
  setBooleanValue,
  isExistsPath,
  isExistsDir,
  Slug,
  transformTemplate,
  readFile,
  makeCss,
  convertImgPath,
  isExcludeFile,
  resolveHref,
  resolveOutputDir,
  buildStyleTags,
  buildPdfOptions,
};
```

- [ ] **Step 2: テストを実行してパスを確認**

Run: `cd /home/z/devlop/github/vscode-markdown-pdf && npm run test:unit`

Expected: `buildPdfOptions` の6件全てPASS

- [ ] **Step 3: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract buildPdfOptions from exportPdf and add unit tests"
```

---

### Task 3: `buildImageOptions` の失敗テストを書く

**Files:**
- Modify: `test/unit/utils.test.js` (`buildPdfOptions` の `describe` ブロックの後に追加)

- [ ] **Step 1: テストコードを追加**

`buildPdfOptions` の `describe` ブロックの後に以下を追加:

```javascript
  describe('buildImageOptions', function () {
    it('should set quality to undefined for PNG', function () {
      var result = utils.buildImageOptions({
        path: '/out/test.png',
        type: 'png',
        quality: 100,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false
      });
      assert.strictEqual(result.quality, undefined);
      assert.strictEqual(result.fullPage, true);
      assert.strictEqual(result.clip, undefined);
    });

    it('should use quality value for JPEG', function () {
      var result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 85,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false
      });
      assert.strictEqual(result.quality, 85);
      assert.strictEqual(result.fullPage, true);
    });

    it('should use clip and set fullPage false when all clip values are non-null', function () {
      var result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 100,
        clip: { x: 0, y: 0, width: 800, height: 600 },
        omitBackground: false
      });
      assert.strictEqual(result.fullPage, false);
      assert.deepStrictEqual(result.clip, { x: 0, y: 0, width: 800, height: 600 });
    });

    it('should ignore clip and set fullPage true when any clip value is null', function () {
      var result = utils.buildImageOptions({
        path: '/out/test.png',
        type: 'png',
        quality: 100,
        clip: { x: 0, y: null, width: 800, height: 600 },
        omitBackground: true
      });
      assert.strictEqual(result.fullPage, true);
      assert.strictEqual(result.clip, undefined);
      assert.strictEqual(result.omitBackground, true);
    });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd /home/z/devlop/github/vscode-markdown-pdf && npm run test:unit`

Expected: 4件が `utils.buildImageOptions is not a function` で FAIL

---

### Task 4: `buildImageOptions` を実装する

**Files:**
- Modify: `src/utils.js` (`buildPdfOptions` 関数の後、`module.exports` の前に追加)
- Modify: `src/utils.js` (`module.exports` に追加)

- [ ] **Step 1: `src/utils.js` に `buildImageOptions` 関数を追加**

`buildPdfOptions` 関数の後、`module.exports` の前に以下を追加:

```javascript
function buildImageOptions(config) {
  var quality_option = config.type === 'png' ? undefined : config.quality;

  var clip = config.clip;
  if (clip && clip.x !== null && clip.y !== null && clip.width !== null && clip.height !== null) {
    return {
      path: config.path,
      quality: quality_option,
      fullPage: false,
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
      },
      omitBackground: config.omitBackground,
    };
  }

  return {
    path: config.path,
    quality: quality_option,
    fullPage: true,
    omitBackground: config.omitBackground,
  };
}
```

`module.exports` に `buildImageOptions` を追加:

```javascript
module.exports = {
  setBooleanValue,
  isExistsPath,
  isExistsDir,
  Slug,
  transformTemplate,
  readFile,
  makeCss,
  convertImgPath,
  isExcludeFile,
  resolveHref,
  resolveOutputDir,
  buildStyleTags,
  buildPdfOptions,
  buildImageOptions,
};
```

- [ ] **Step 2: テストを実行してパスを確認**

Run: `cd /home/z/devlop/github/vscode-markdown-pdf && npm run test:unit`

Expected: `buildImageOptions` の4件全てPASS、全ユニットテストPASS

- [ ] **Step 3: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract buildImageOptions from exportPdf and add unit tests"
```

---

### Task 5: `extension.js` の `exportPdf` を新関数に委譲する

**Files:**
- Modify: `extension.js:381-458` (`exportPdf` 内のPDF/画像オプション構築部分)

- [ ] **Step 1: PDF オプション構築を `utils.buildPdfOptions` に置換**

`extension.js` 行381-416を以下に置換する。置換対象は `if (type == 'pdf') {` から `await page.pdf(options);` と閉じ `}` まで:

```javascript
        if (type == 'pdf') {
          var options = utils.buildPdfOptions({
            path: exportFilename,
            width: vscode.workspace.getConfiguration('markdown-pdf', uri)['width'] || '',
            height: vscode.workspace.getConfiguration('markdown-pdf', uri)['height'] || '',
            format: vscode.workspace.getConfiguration('markdown-pdf', uri)['format'] || 'A4',
            orientation: vscode.workspace.getConfiguration('markdown-pdf', uri)['orientation'] || '',
            scale: vscode.workspace.getConfiguration('markdown-pdf', uri)['scale'],
            displayHeaderFooter: vscode.workspace.getConfiguration('markdown-pdf', uri)['displayHeaderFooter'],
            headerTemplate: vscode.workspace.getConfiguration('markdown-pdf', uri)['headerTemplate'] || '',
            footerTemplate: vscode.workspace.getConfiguration('markdown-pdf', uri)['footerTemplate'] || '',
            printBackground: vscode.workspace.getConfiguration('markdown-pdf', uri)['printBackground'],
            pageRanges: vscode.workspace.getConfiguration('markdown-pdf', uri)['pageRanges'] || '',
            margin: {
              top: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['top'] || '',
              right: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['right'] || '',
              bottom: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['bottom'] || '',
              left: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['left'] || ''
            }
          });
          await page.pdf(options);
        }
```

- [ ] **Step 2: 画像オプション構築を `utils.buildImageOptions` に置換**

`extension.js` 行419-458（`if (type == 'png' || type == 'jpeg') {` ブロック全体）を以下に置換:

```javascript
        if (type == 'png' || type == 'jpeg') {
          var options = utils.buildImageOptions({
            path: exportFilename,
            type: type,
            quality: vscode.workspace.getConfiguration('markdown-pdf')['quality'] || 100,
            clip: {
              x: vscode.workspace.getConfiguration('markdown-pdf')['clip']['x'] || null,
              y: vscode.workspace.getConfiguration('markdown-pdf')['clip']['y'] || null,
              width: vscode.workspace.getConfiguration('markdown-pdf')['clip']['width'] || null,
              height: vscode.workspace.getConfiguration('markdown-pdf')['clip']['height'] || null
            },
            omitBackground: vscode.workspace.getConfiguration('markdown-pdf')['omitBackground']
          });
          await page.screenshot(options);
        }
```

- [ ] **Step 3: ユニットテストが引き続きパスすることを確認**

Run: `cd /home/z/devlop/github/vscode-markdown-pdf && npm run test:unit`

Expected: 全ユニットテストPASS

- [ ] **Step 4: コミット**

```bash
git add extension.js
git commit -m "refactor: delegate exportPdf option building to utils functions"
```

---

### Task 6: PlantUMLカスタムマーカー統合テストを追加する

**Files:**
- Create: `test/integration/fixtures/plantuml-custom-marker.md`
- Create: `test/integration/expected/plantuml-custom-marker.html` (初回生成後に作成)
- Modify: `test/integration/extension.test.js:72-84` (`HTML_FEATURES` 配列に追加)

- [ ] **Step 1: fixtureファイルを作成**

`test/integration/fixtures/plantuml-custom-marker.md` を以下の内容で作成:

````markdown
---
plantumlOpenMarker: "```plantuml"
plantumlCloseMarker: "```"
---

```plantuml
Bob -> Alice : hello
```
````

- [ ] **Step 2: `HTML_FEATURES` 配列に追加**

`test/integration/extension.test.js` の `HTML_FEATURES` 配列で、`'plantuml'` の直後に `'plantuml-custom-marker'` を追加:

```javascript
const HTML_FEATURES = [
  'plantuml',
  'plantuml-custom-marker',
  'syntax-highlighting',
  // ... (以下変更なし)
```

PlantUMLの直後に配置する理由: PlantUMLが最初に来るのはjavaスポーンのエラー抑制のため。カスタムマーカーも同じ事情があるので近くに配置する。

- [ ] **Step 3: 期待HTMLを生成**

期待HTMLファイルの作成手順:

1. 統合テストを一度実行して `test/integration/fixtures/plantuml-custom-marker.html` を生成させる（テストは expected がないので失敗する）
2. 生成されたHTMLを `normalizeHtml()` 相当の正規化をかけてから `test/integration/expected/plantuml-custom-marker.html` にコピー
3. 具体的には以下のコマンドで正規化コピー:

```bash
cd /home/z/devlop/github/vscode-markdown-pdf
node -e "
var fs = require('fs');
var html = fs.readFileSync('test/integration/fixtures/plantuml-custom-marker.html', 'utf-8');
html = html.replace(/file:\/\/\/[^\s\"'<>]*/g, 'file:///NORMALIZED_PATH')
           .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD')
           .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS');
fs.writeFileSync('test/integration/expected/plantuml-custom-marker.html', html, 'utf-8');
"
```

注意: 統合テストはVS Code環境でのみ実行可能。CI環境では `npm run test:integration` で実行する。ローカルでは `xvfb-run` が必要な場合がある。

- [ ] **Step 4: 統合テストを実行してパスを確認**

Run: `cd /home/z/devlop/github/vscode-markdown-pdf && npm run test:integration`

Expected: `plantuml-custom-marker: HTML snapshot matches expected` がPASS

- [ ] **Step 5: コミット**

```bash
git add test/integration/fixtures/plantuml-custom-marker.md test/integration/expected/plantuml-custom-marker.html test/integration/extension.test.js
git commit -m "test: add integration test for PlantUML custom markers via frontmatter"
```

---

### Task 7: 全テスト実行と最終確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全テスト実行**

Run: `cd /home/z/devlop/github/vscode-markdown-pdf && npm test`

Expected: ユニットテスト全件PASS（既存121 + 新規10 = 131件）、統合テスト全件PASS

- [ ] **Step 2: 差分を確認**

Run: `git diff develop --stat`

変更ファイルが以下のみであることを確認:
- `src/utils.js` (2関数追加 + export追加)
- `extension.js` (オプション構築をutils委譲に置換)
- `test/unit/utils.test.js` (テスト10件追加)
- `test/integration/extension.test.js` (FEATURES配列に1件追加)
- `test/integration/fixtures/plantuml-custom-marker.md` (新規)
- `test/integration/expected/plantuml-custom-marker.html` (新規)
- `docs/superpowers/specs/2026-03-31-05-export-options-tests-design.md` (新規)
- `docs/superpowers/plans/2026-03-31-06-export-options-tests.md` (新規)
