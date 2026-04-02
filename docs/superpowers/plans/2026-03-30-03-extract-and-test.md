# extension.js ロジック抽出 + ユニットテスト追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `extension.js` の未テスト関数からビジネスロジックを `src/utils.js` に純粋関数として抽出し、ユニットテストを追加する。

**Architecture:** `extension.js` の4関数（`isMarkdownPdfOnSaveExclude`, `getOutputDir`, `fixHref`, `readStyles`）からVS Code API非依存のロジックを抽出。`src/utils.js` に4つの純粋関数を追加し、`extension.js` は設定値取得後にこれらに委譲する形にリファクタリング。テストは既存の `test/unit/utils.test.js` に追加。ソースコード内のコメントは英語で記述。

**Tech Stack:** Mocha ^7.1.1, Node.js 組み込み `assert`

**設計ドキュメント:** `docs/superpowers/specs/2026-03-30-03-extract-and-test-design.md`

---

### Task 1: `isExcludeFile` の抽出・テスト

最もシンプルな関数から着手する。`isMarkdownPdfOnSaveExclude()` (extension.js 行125-145) からパターンマッチロジックを抽出。

**ファイル:**
- 変更: `src/utils.js:138-147`
- 変更: `test/unit/utils.test.js:238`
- 変更: `extension.js:125-145`

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` の最後の `});` の直前に追加:

```js
  describe('isExcludeFile', function () {
    it('should return false for empty patterns array', function () {
      assert.strictEqual(utils.isExcludeFile('README.md', []), false);
    });

    it('should return false for undefined patterns', function () {
      assert.strictEqual(utils.isExcludeFile('README.md', undefined), false);
    });

    it('should return true when filename matches a pattern', function () {
      assert.strictEqual(utils.isExcludeFile('DRAFT-report.md', ['^DRAFT']), true);
    });

    it('should return true when filename matches second pattern', function () {
      assert.strictEqual(utils.isExcludeFile('notes.txt', ['^DRAFT', '\\.txt$']), true);
    });

    it('should return false when filename matches no patterns', function () {
      assert.strictEqual(utils.isExcludeFile('report.md', ['^DRAFT', '\\.txt$']), false);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "isExcludeFile"`
期待: FAIL — `utils.isExcludeFile is not a function`

- [ ] **Step 3: `src/utils.js` に `isExcludeFile` を実装**

`module.exports` の直前に追加:

```js
function isExcludeFile(filename, patterns) {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  for (var i = 0; i < patterns.length; i++) {
    var re = new RegExp(patterns[i]);
    if (re.test(filename)) {
      return true;
    }
  }
  return false;
}
```

`module.exports` に `isExcludeFile` を追加。

- [ ] **Step 4: テストが成功することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "isExcludeFile"`
期待: 5 passing

- [ ] **Step 5: `extension.js` をリファクタリング**

`isMarkdownPdfOnSaveExclude()` (行125-145) を以下に置き換え:

```js
function isMarkdownPdfOnSaveExclude() {
  try{
    var editor = vscode.window.activeTextEditor;
    var filename = path.basename(editor.document.fileName);
    var patterns = vscode.workspace.getConfiguration('markdown-pdf')['convertOnSaveExclude'] || '';
    return utils.isExcludeFile(filename, patterns);
  } catch (error) {
    showErrorMessage('isMarkdownPdfOnSaveExclude()', error);
  }
}
```

- [ ] **Step 6: 全ユニットテストを実行**

実行: `npm run test:unit`
期待: 全テスト passing（既存42件 + 新規5件 = 47件）

- [ ] **Step 7: コミット**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract isExcludeFile to utils.js with unit tests"
```

---

### Task 2: `resolveHref` の抽出・テスト

`fixHref()` (extension.js 行618-652) からパス解決ロジックを抽出。`vscode.Uri` の代わりに Node.js の `url` モジュールを使用。

**ファイル:**
- 変更: `src/utils.js`
- 変更: `test/unit/utils.test.js`
- 変更: `extension.js:618-652`

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` に追加:

```js
  describe('resolveHref', function () {
    var os = require('os');

    it('should return empty string for empty href', function () {
      assert.strictEqual(utils.resolveHref('', '/home/user/doc.md', false, '/workspace'), '');
    });

    it('should return undefined for undefined href', function () {
      assert.strictEqual(utils.resolveHref(undefined, '/home/user/doc.md', false, '/workspace'), undefined);
    });

    it('should return http URL unchanged', function () {
      assert.strictEqual(
        utils.resolveHref('http://example.com/style.css', '/home/user/doc.md', false, '/workspace'),
        'http://example.com/style.css'
      );
    });

    it('should return https URL unchanged', function () {
      assert.strictEqual(
        utils.resolveHref('https://example.com/style.css', '/home/user/doc.md', false, '/workspace'),
        'https://example.com/style.css'
      );
    });

    it('should expand ~ to home directory as file URI', function () {
      var result = utils.resolveHref('~/styles/custom.css', '/home/user/doc.md', false, '/workspace');
      var expected = 'file://' + os.homedir() + '/styles/custom.css';
      assert.strictEqual(result, expected);
    });

    it('should convert absolute path to file URI', function () {
      var result = utils.resolveHref('/etc/styles/custom.css', '/home/user/doc.md', false, '/workspace');
      assert.strictEqual(result, 'file:///etc/styles/custom.css');
    });

    it('should resolve workspace-relative path when stylesRelativePathFile is false', function () {
      var result = utils.resolveHref('assets/style.css', '/home/user/doc.md', false, '/workspace');
      assert.strictEqual(result, 'file:///workspace/assets/style.css');
    });

    it('should resolve file-relative path when stylesRelativePathFile is true', function () {
      var result = utils.resolveHref('assets/style.css', '/home/user/doc.md', true, '/workspace');
      assert.strictEqual(result, 'file:///home/user/assets/style.css');
    });

    it('should resolve file-relative path when no workspace', function () {
      var result = utils.resolveHref('assets/style.css', '/home/user/doc.md', false, undefined);
      assert.strictEqual(result, 'file:///home/user/assets/style.css');
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "resolveHref"`
期待: FAIL — `utils.resolveHref is not a function`

- [ ] **Step 3: `src/utils.js` に `resolveHref` を実装**

```js
var os = require('os');
```

を先頭の require に追加し、`module.exports` の前に以下を追加:

```js
function resolveHref(href, resourceFsPath, stylesRelativePathFile, workspaceFsPath) {
  if (!href) {
    return href;
  }

  // Use href if it is already an URL
  var parsed = url.parse(href);
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return href;
  }

  // Use a home directory relative path if it starts with ~
  if (href.indexOf('~') === 0) {
    return 'file://' + href.replace(/^~/, os.homedir());
  }

  // Use href as file URI if it is absolute
  if (path.isAbsolute(href)) {
    return 'file://' + href;
  }

  // Use a workspace relative path if stylesRelativePathFile is false and workspace exists
  if (stylesRelativePathFile === false && workspaceFsPath) {
    return 'file://' + path.join(workspaceFsPath, href);
  }

  // Otherwise look relative to the markdown file
  return 'file://' + path.join(path.dirname(resourceFsPath), href);
}
```

`module.exports` に `resolveHref` を追加。

- [ ] **Step 4: テストが成功することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "resolveHref"`
期待: 9 passing

- [ ] **Step 5: `extension.js` をリファクタリング**

`fixHref()` (行618-652) を以下に置き換え:

```js
function fixHref(resource, href) {
  try {
    if (!href) {
      return href;
    }

    // Use href if it is already an URL
    const hrefUri = vscode.Uri.parse(href);
    if (['http', 'https'].indexOf(hrefUri.scheme) >= 0) {
      return hrefUri.toString();
    }

    // Delegate path resolution to utils
    var stylesRelativePathFile = vscode.workspace.getConfiguration('markdown-pdf')['stylesRelativePathFile'];
    let root = vscode.workspace.getWorkspaceFolder(resource);
    return utils.resolveHref(href, resource.fsPath, stylesRelativePathFile, root ? root.uri.fsPath : undefined);
  } catch (error) {
    showErrorMessage('fixHref()', error);
  }
}
```

注: http/https の判定は `vscode.Uri.parse` を使い続ける（VS Code 環境での正確性のため）。ローカルパス解決のみ `utils.resolveHref` に委譲。

- [ ] **Step 6: 全ユニットテストを実行**

実行: `npm run test:unit`
期待: 全テスト passing（47件 + 新規9件 = 56件）

- [ ] **Step 7: コミット**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract resolveHref to utils.js with unit tests"
```

---

### Task 3: `resolveOutputDir` の抽出・テスト

`getOutputDir()` (extension.js 行495-539) からパス解決ロジックを抽出。ディレクトリ作成の副作用は `extension.js` 側に残す。

**ファイル:**
- 変更: `src/utils.js`
- 変更: `test/unit/utils.test.js`
- 変更: `extension.js:495-539`

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` に追加:

```js
  describe('resolveOutputDir', function () {
    var path = require('path');
    var fs = require('fs');
    var os = require('os');
    var tmpDir;

    before(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpdf-test-'));
    });

    after(function () {
      fs.rmdirSync(tmpDir, { recursive: true });
    });

    it('should return filename when outputDirectory is empty', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', '', false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, '/home/user/doc.pdf');
    });

    it('should expand ~ to home directory', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', '~/output', false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join(os.homedir(), 'output', 'doc.pdf'));
    });

    it('should use absolute path when directory exists', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', tmpDir, false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join(tmpDir, 'doc.pdf'));
    });

    it('should return null when absolute directory does not exist', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', '/nonexistent/output', false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, null);
    });

    it('should resolve workspace-relative path when outputDirectoryRelativePathFile is false', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', 'build', false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join('/workspace', 'build', 'doc.pdf'));
    });

    it('should resolve file-relative path when outputDirectoryRelativePathFile is true', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', 'build', true, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join('/home/user', 'build', 'doc.pdf'));
    });

    it('should resolve file-relative path when no workspace', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', 'build', false, '/home/user/doc.md', undefined);
      assert.strictEqual(result, path.join('/home/user', 'build', 'doc.pdf'));
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "resolveOutputDir"`
期待: FAIL — `utils.resolveOutputDir is not a function`

- [ ] **Step 3: `src/utils.js` に `resolveOutputDir` を実装**

`module.exports` の前に追加:

```js
function resolveOutputDir(filename, outputDirectory, outputDirectoryRelativePathFile, resourceFsPath, workspaceFsPath) {
  if (!outputDirectory || outputDirectory.length === 0) {
    return filename;
  }

  // Use a home directory relative path if it starts with ~
  if (outputDirectory.indexOf('~') === 0) {
    var outputDir = outputDirectory.replace(/^~/, os.homedir());
    return path.join(outputDir, path.basename(filename));
  }

  // Use path if it is absolute
  if (path.isAbsolute(outputDirectory)) {
    if (!isExistsDir(outputDirectory)) {
      return null;
    }
    return path.join(outputDirectory, path.basename(filename));
  }

  // Use a workspace relative path if outputDirectoryRelativePathFile is false and workspace exists
  if (outputDirectoryRelativePathFile === false && workspaceFsPath) {
    return path.join(workspaceFsPath, outputDirectory, path.basename(filename));
  }

  // Otherwise look relative to the markdown file
  return path.join(path.dirname(resourceFsPath), outputDirectory, path.basename(filename));
}
```

`module.exports` に `resolveOutputDir` を追加。

- [ ] **Step 4: テストが成功することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "resolveOutputDir"`
期待: 7 passing

- [ ] **Step 5: `extension.js` をリファクタリング**

`getOutputDir()` (行495-539) を以下に置き換え:

```js
function getOutputDir(filename, resource) {
  try {
    if (resource === undefined) {
      return filename;
    }
    var outputDirectory = vscode.workspace.getConfiguration('markdown-pdf')['outputDirectory'] || '';
    var outputDirectoryRelativePathFile = vscode.workspace.getConfiguration('markdown-pdf')['outputDirectoryRelativePathFile'];
    let root = vscode.workspace.getWorkspaceFolder(resource);

    var result = utils.resolveOutputDir(
      filename,
      outputDirectory,
      outputDirectoryRelativePathFile,
      resource.fsPath,
      root ? root.uri.fsPath : undefined
    );

    if (result === null) {
      showErrorMessage(`The output directory specified by the markdown-pdf.outputDirectory option does not exist.\
        Check the markdown-pdf.outputDirectory option. ` + outputDirectory);
      return;
    }

    // Create output directory if needed (for non-absolute, non-empty outputDirectory)
    if (outputDirectory.length > 0 && !path.isAbsolute(outputDirectory)) {
      var outputDir = path.dirname(result);
      mkdir(outputDir);
    } else if (outputDirectory.indexOf('~') === 0) {
      var outputDir = outputDirectory.replace(/^~/, os.homedir());
      mkdir(outputDir);
    }

    return result;
  } catch (error) {
    showErrorMessage('getOutputDir()', error);
  }
}
```

- [ ] **Step 6: 全ユニットテストを実行**

実行: `npm run test:unit`
期待: 全テスト passing（55件 + 新規7件 = 62件）

- [ ] **Step 7: コミット**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract resolveOutputDir to utils.js with unit tests"
```

---

### Task 4: `buildStyleTags` の抽出・テスト

`readStyles()` (extension.js 行549-609) からCSS集約ロジックを抽出。

**ファイル:**
- 変更: `src/utils.js`
- 変更: `test/unit/utils.test.js`
- 変更: `extension.js:549-609`

- [ ] **Step 1: テストを書く**

`test/unit/utils.test.js` に追加:

```js
  describe('buildStyleTags', function () {
    var path = require('path');
    var fs = require('fs');
    var tmpCss1, tmpCss2;
    var baseDir;

    before(function () {
      baseDir = path.join(__dirname, '..', '..');
      tmpCss1 = path.join(__dirname, 'test-style1.tmp.css');
      tmpCss2 = path.join(__dirname, 'test-style2.tmp.css');
      fs.writeFileSync(tmpCss1, 'h1 { color: blue; }', 'utf-8');
      fs.writeFileSync(tmpCss2, 'p { margin: 0; }', 'utf-8');
    });

    after(function () {
      [tmpCss1, tmpCss2].forEach(function (f) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    });

    it('should include default styles when includeDefaultStyles is true', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: true,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href) { return href; }
      });
      // Should contain markdown.css and markdown-pdf.css content
      assert.ok(result.indexOf('<style>') !== -1, 'Expected <style> tags in result');
    });

    it('should skip default styles when includeDefaultStyles is false', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href) { return href; }
      });
      // Should not contain markdown.css content (no <style> from defaults)
      assert.strictEqual(result, '');
    });

    it('should include highlight.js style when highlight is true with highlightStyle', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: 'github.css',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href) { return href; }
      });
      assert.ok(result.indexOf('<style>') !== -1, 'Expected highlight style in result');
    });

    it('should use tomorrow.css as default highlight style', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href) { return href; }
      });
      assert.ok(result.indexOf('<style>') !== -1, 'Expected default highlight style in result');
    });

    it('should skip highlight style when highlight is false', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: 'github.css',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href) { return href; }
      });
      assert.strictEqual(result, '');
    });

    it('should add link tags for markdownPdfStyles', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: ['custom.css'],
        baseDir: baseDir,
        resolveHrefFn: function (href) { return 'file:///resolved/' + href; }
      });
      assert.ok(result.indexOf('<link rel="stylesheet"') !== -1, 'Expected <link> tag');
      assert.ok(result.indexOf('file:///resolved/custom.css') !== -1, 'Expected resolved href');
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "buildStyleTags"`
期待: FAIL — `utils.buildStyleTags is not a function`

- [ ] **Step 3: `src/utils.js` に `buildStyleTags` を実装**

`module.exports` の前に追加:

```js
function buildStyleTags(options) {
  var style = '';
  var filename = '';
  var i;

  // 1. read the style of the vscode
  if (options.includeDefaultStyles) {
    filename = path.join(options.baseDir, 'styles', 'markdown.css');
    style += makeCss(filename);
  }

  // 2. read the style of the markdown.styles setting
  if (options.includeDefaultStyles) {
    if (options.markdownStyles && Array.isArray(options.markdownStyles) && options.markdownStyles.length > 0) {
      for (i = 0; i < options.markdownStyles.length; i++) {
        var href = options.resolveHrefFn(options.markdownStyles[i]);
        style += '<link rel="stylesheet" href="' + href + '" type="text/css">';
      }
    }
  }

  // 3. read the style of the highlight.js
  if (options.highlight) {
    if (options.highlightStyle) {
      filename = path.join(options.baseDir, 'node_modules', 'highlight.js', 'styles', options.highlightStyle);
      style += makeCss(filename);
    } else {
      filename = path.join(options.baseDir, 'styles', 'tomorrow.css');
      style += makeCss(filename);
    }
  }

  // 4. read the style of the markdown-pdf
  if (options.includeDefaultStyles) {
    filename = path.join(options.baseDir, 'styles', 'markdown-pdf.css');
    style += makeCss(filename);
  }

  // 5. read the style of the markdown-pdf.styles settings
  if (options.markdownPdfStyles && Array.isArray(options.markdownPdfStyles) && options.markdownPdfStyles.length > 0) {
    for (i = 0; i < options.markdownPdfStyles.length; i++) {
      var href = options.resolveHrefFn(options.markdownPdfStyles[i]);
      style += '<link rel="stylesheet" href="' + href + '" type="text/css">';
    }
  }

  return style;
}
```

`module.exports` に `buildStyleTags` を追加。

- [ ] **Step 4: テストが成功することを確認**

実行: `npx mocha test/unit/utils.test.js --grep "buildStyleTags"`
期待: 6 passing

- [ ] **Step 5: `extension.js` をリファクタリング**

`readStyles()` (行549-609) を以下に置き換え:

```js
function readStyles(uri) {
  try {
    var includeDefaultStyles = vscode.workspace.getConfiguration('markdown-pdf')['includeDefaultStyles'];
    var highlightStyle = vscode.workspace.getConfiguration('markdown-pdf')['highlightStyle'] || '';
    var highlight = vscode.workspace.getConfiguration('markdown-pdf')['highlight'];
    var markdownStyles = vscode.workspace.getConfiguration('markdown')['styles'] || [];
    var markdownPdfStyles = vscode.workspace.getConfiguration('markdown-pdf')['styles'] || '';

    return utils.buildStyleTags({
      includeDefaultStyles: includeDefaultStyles,
      highlight: highlight,
      highlightStyle: highlightStyle,
      markdownStyles: markdownStyles,
      markdownPdfStyles: markdownPdfStyles,
      baseDir: __dirname,
      resolveHrefFn: function (href) { return fixHref(uri, href); }
    });
  } catch (error) {
    showErrorMessage('readStyles()', error);
  }
}
```

- [ ] **Step 6: 全ユニットテストを実行**

実行: `npm run test:unit`
期待: 全テスト passing（62件 + 新規6件 = 68件）

- [ ] **Step 7: コミット**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract buildStyleTags to utils.js with unit tests"
```

---

### Task 5: 全テスト実行・最終確認

全てのリファクタリングが既存の動作を壊していないことを確認する。

**ファイル:** なし（確認のみ）

- [ ] **Step 1: 全ユニットテストを実行**

実行: `npm run test:unit`
期待: 68 passing（既存41件 + 新規27件）

- [ ] **Step 2: インテグレーションテストを実行**

実行: `npm test`
期待: 全テスト passing（ユニット68件 + インテグレーション10件）

- [ ] **Step 3: `utils.js` のエクスポート一覧を確認**

`src/utils.js` の `module.exports` に以下12関数がエクスポートされていることを確認:
- 既存: `setBooleanValue`, `isExistsPath`, `isExistsDir`, `Slug`, `transformTemplate`, `readFile`, `makeCss`, `convertImgPath`
- 新規: `isExcludeFile`, `resolveHref`, `resolveOutputDir`, `buildStyleTags`

- [ ] **Step 4: コミット（必要な場合のみ）**

全テストが通り、修正が不要な場合はスキップ。修正が必要な場合は修正してコミット。
