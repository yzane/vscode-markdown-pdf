# ユニットテスト実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `extension.js` から純粋関数を `src/utils.js` に抽出し、ユニットテストを実装する。

**Architecture:** VS Code API非依存の8関数を `src/utils.js` に移動。`extension.js` はこのモジュールをインポートして使用。テストは `test/unit/utils.test.js` に Mocha + Node.js assert で記述。ソースコード内のコメントは英語で記述。

**Tech Stack:** Mocha ^11.0.0, Node.js 組み込み `assert`

**設計ドキュメント:** `docs/superpowers/specs/2026-03-30-unit-tests-design.md`

---

### Task 1: `setBooleanValue` と `isExistsPath` の抽出・テスト

最もシンプルで依存のない関数から着手する。

**ファイル:**
- 新規作成: `src/utils.js`
- 新規作成: `test/unit/utils.test.js`

- [ ] **Step 1: `src/utils.js` を作成し、2つの関数を移動**

```js
'use strict';
var fs = require('fs');

function setBooleanValue(a, b) {
  if (a === false) {
    return false;
  } else {
    return a || b;
  }
}

function isExistsPath(path) {
  if (path.length === 0) {
    return false;
  }
  try {
    fs.accessSync(path);
    return true;
  } catch (error) {
    console.warn(error.message);
    return false;
  }
}

module.exports = {
  setBooleanValue,
  isExistsPath,
};
```

- [ ] **Step 2: `test/unit/utils.test.js` を作成し、テストを記述**

```js
'use strict';
var assert = require('assert');
var utils = require('../../src/utils');

describe('utils', function () {
  describe('setBooleanValue', function () {
    it('should return false when first argument is explicitly false', function () {
      assert.strictEqual(utils.setBooleanValue(false, true), false);
    });

    it('should return second argument when first is undefined', function () {
      assert.strictEqual(utils.setBooleanValue(undefined, true), true);
      assert.strictEqual(utils.setBooleanValue(undefined, false), false);
    });

    it('should return first argument when it is truthy', function () {
      assert.strictEqual(utils.setBooleanValue(true, false), true);
    });

    it('should return second argument when first is null', function () {
      assert.strictEqual(utils.setBooleanValue(null, true), true);
    });

    it('should return false when both are falsy', function () {
      assert.strictEqual(utils.setBooleanValue(undefined, undefined), undefined);
    });
  });

  describe('isExistsPath', function () {
    it('should return false for empty string', function () {
      assert.strictEqual(utils.isExistsPath(''), false);
    });

    it('should return true for a path that exists', function () {
      assert.strictEqual(utils.isExistsPath(__filename), true);
    });

    it('should return false for a path that does not exist', function () {
      assert.strictEqual(utils.isExistsPath('/nonexistent/path/file.txt'), false);
    });
  });
});
```

- [ ] **Step 3: mocha を更新し、`test:unit` スクリプトを追加**

```bash
npm install --save-dev mocha@^11.0.0
```

`package.json` の `scripts` セクションに追加:

```json
"scripts": {
  "vscode:prepublish": "node ./src/compile",
  "test": "node ./test/runTest.js",
  "test:unit": "mocha test/unit/**/*.test.js"
},
```

- [ ] **Step 4: テスト実行・パス確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: 全7テストがパス。

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js package.json package-lock.json
git commit -m "feat: extract setBooleanValue and isExistsPath to src/utils.js with unit tests"
```

---

### Task 2: `isExistsDir` と `Slug` の追加

**ファイル:**
- 変更: `src/utils.js`
- 変更: `test/unit/utils.test.js`

- [ ] **Step 1: `isExistsDir` と `Slug` のテストを追加**

`test/unit/utils.test.js` の `describe('utils', ...)` ブロック内に追加:

```js
  describe('isExistsDir', function () {
    it('should return false for empty string', function () {
      assert.strictEqual(utils.isExistsDir(''), false);
    });

    it('should return true for a directory that exists', function () {
      var path = require('path');
      assert.strictEqual(utils.isExistsDir(path.dirname(__filename)), true);
    });

    it('should return false for a directory that does not exist', function () {
      assert.strictEqual(utils.isExistsDir('/nonexistent/directory'), false);
    });

    it('should return false for a file path (not a directory)', function () {
      assert.strictEqual(utils.isExistsDir(__filename), false);
    });
  });

  describe('Slug', function () {
    it('should convert basic text to slug', function () {
      assert.strictEqual(utils.Slug('Hello World'), 'hello-world');
    });

    it('should handle Japanese/Unicode text', function () {
      var result = utils.Slug('日本語の見出し');
      assert.strictEqual(result, encodeURI('日本語の見出し'));
    });

    it('should remove known punctuation', function () {
      assert.strictEqual(utils.Slug("What's this?!"), 'whats-this');
    });

    it('should remove leading and trailing hyphens', function () {
      assert.strictEqual(utils.Slug(' -hello- '), 'hello');
    });

    it('should preserve underscores', function () {
      assert.strictEqual(utils.Slug('snake_case'), 'snake_case');
    });

    it('should handle empty string', function () {
      assert.strictEqual(utils.Slug(''), '');
    });

    it('should handle whitespace only', function () {
      assert.strictEqual(utils.Slug('   '), '');
    });

    it('should collapse multiple spaces into single hyphen', function () {
      assert.strictEqual(utils.Slug('hello   world'), 'hello-world');
    });

    it('should handle mixed content', function () {
      assert.strictEqual(utils.Slug('Hello World! #1'), 'hello-world-1');
    });
  });
```

- [ ] **Step 2: テスト実行・失敗確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: FAIL — `utils.isExistsDir is not a function` および `utils.Slug is not a function`

- [ ] **Step 3: `src/utils.js` に `isExistsDir` と `Slug` を追加**

`module.exports` の前に追加:

```js
function isExistsDir(dirname) {
  if (dirname.length === 0) {
    return false;
  }
  try {
    if (fs.statSync(dirname).isDirectory()) {
      return true;
    } else {
      console.warn('Directory does not exist!');
      return false;
    }
  } catch (error) {
    console.warn(error.message);
    return false;
  }
}

/*
 * https://github.com/microsoft/vscode/blob/c07cee3039c8ea6e9bab02645599ec9e7796fd4c/extensions/markdown-language-features/src/slugify.ts#L27
 */
function Slug(string) {
  var stg = encodeURI(
    string.trim()
          .toLowerCase()
          .replace(/\s+/g, '-') // Replace whitespace with -
          // allow-any-unicode-next-line
          .replace(/[\]\[\!\/\'\"\#\$\%\&\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\{\|\}\~\`。，、；：？！…—·ˉ¨''""々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝]/g, '') // Remove known punctuators
          .replace(/^\-+/, '') // Remove leading -
          .replace(/\-+$/, '') // Remove trailing -
  );
  return stg;
}
```

`module.exports` を更新:

```js
module.exports = {
  setBooleanValue,
  isExistsPath,
  isExistsDir,
  Slug,
};
```

- [ ] **Step 4: テスト実行・パス確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: 全20テストがパス。

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract isExistsDir and Slug to src/utils.js with unit tests"
```

---

### Task 3: `transformTemplate` の追加

**ファイル:**
- 変更: `src/utils.js`
- 変更: `test/unit/utils.test.js`

- [ ] **Step 1: `transformTemplate` のテストを追加**

`test/unit/utils.test.js` の `describe('utils', ...)` ブロック内に追加:

```js
  describe('transformTemplate', function () {
    it('should replace %%ISO-DATE%% with YYYY-MM-DD format', function () {
      var result = utils.transformTemplate('Date: %%ISO-DATE%%');
      assert.match(result, /^Date: \d{4}-\d{2}-\d{2}$/);
    });

    it('should replace %%ISO-DATETIME%% with YYYY-MM-DD hh:mm:ss format', function () {
      var result = utils.transformTemplate('DateTime: %%ISO-DATETIME%%');
      assert.match(result, /^DateTime: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should replace %%ISO-TIME%% with hh:mm:ss format', function () {
      var result = utils.transformTemplate('Time: %%ISO-TIME%%');
      assert.match(result, /^Time: \d{2}:\d{2}:\d{2}$/);
    });

    it('should return text unchanged when no placeholders present', function () {
      assert.strictEqual(utils.transformTemplate('no placeholders here'), 'no placeholders here');
    });

    it('should handle multiple different placeholders', function () {
      var result = utils.transformTemplate('%%ISO-DATE%% at %%ISO-TIME%%');
      assert.match(result, /^\d{4}-\d{2}-\d{2} at \d{2}:\d{2}:\d{2}$/);
    });

    it('should handle empty string', function () {
      assert.strictEqual(utils.transformTemplate(''), '');
    });
  });
```

- [ ] **Step 2: テスト実行・失敗確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: FAIL — `utils.transformTemplate is not a function`

- [ ] **Step 3: `src/utils.js` に `transformTemplate` を追加**

`module.exports` の前に追加:

```js
/**
 * Replace date/time placeholders in header/footer template text.
 *
 * Supported placeholders:
 * - %%ISO-DATETIME%% -> YYYY-MM-DD hh:mm:ss
 * - %%ISO-DATE%%     -> YYYY-MM-DD
 * - %%ISO-TIME%%     -> hh:mm:ss
 */
function transformTemplate(templateText) {
  if (templateText.indexOf('%%ISO-DATETIME%%') !== -1) {
    templateText = templateText.replace('%%ISO-DATETIME%%', new Date().toISOString().substr(0, 19).replace('T', ' '));
  }
  if (templateText.indexOf('%%ISO-DATE%%') !== -1) {
    templateText = templateText.replace('%%ISO-DATE%%', new Date().toISOString().substr(0, 10));
  }
  if (templateText.indexOf('%%ISO-TIME%%') !== -1) {
    templateText = templateText.replace('%%ISO-TIME%%', new Date().toISOString().substr(11, 8));
  }

  return templateText;
}
```

`module.exports` を更新:

```js
module.exports = {
  setBooleanValue,
  isExistsPath,
  isExistsDir,
  Slug,
  transformTemplate,
};
```

- [ ] **Step 4: テスト実行・パス確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: 全26テストがパス。

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract transformTemplate to src/utils.js with unit tests"
```

---

### Task 4: `readFile` と `makeCss` の追加

`makeCss` は `readFile` に依存しているため、一緒に抽出する。

**ファイル:**
- 変更: `src/utils.js`
- 変更: `test/unit/utils.test.js`

- [ ] **Step 1: `readFile` と `makeCss` のテストを追加**

`test/unit/utils.test.js` の `describe('utils', ...)` ブロック内に追加:

```js
  describe('readFile', function () {
    var path = require('path');
    var fs = require('fs');
    var tmpFile;

    before(function () {
      tmpFile = path.join(__dirname, 'test-read-file.tmp');
      fs.writeFileSync(tmpFile, 'hello world', 'utf-8');
    });

    after(function () {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    });

    it('should return file contents for an existing file', function () {
      assert.strictEqual(utils.readFile(tmpFile), 'hello world');
    });

    it('should return empty string for a non-existent file', function () {
      assert.strictEqual(utils.readFile('/nonexistent/file.txt'), '');
    });

    it('should return empty string for empty path', function () {
      assert.strictEqual(utils.readFile('', 'utf-8'), '');
    });

    it('should return Buffer when encode is null', function () {
      var result = utils.readFile(tmpFile, null);
      assert.ok(Buffer.isBuffer(result));
      assert.strictEqual(result.toString(), 'hello world');
    });

    it('should handle file:// prefix on Linux/macOS', function () {
      var result = utils.readFile('file://' + tmpFile);
      assert.strictEqual(result, 'hello world');
    });
  });

  describe('makeCss', function () {
    var path = require('path');
    var fs = require('fs');
    var tmpCssFile;

    before(function () {
      tmpCssFile = path.join(__dirname, 'test-make-css.tmp.css');
      fs.writeFileSync(tmpCssFile, 'body { color: red; }', 'utf-8');
    });

    after(function () {
      if (fs.existsSync(tmpCssFile)) {
        fs.unlinkSync(tmpCssFile);
      }
    });

    it('should wrap CSS content in style tags', function () {
      var result = utils.makeCss(tmpCssFile);
      assert.strictEqual(result, '\n<style>\nbody { color: red; }\n</style>\n');
    });

    it('should return empty string for non-existent file', function () {
      assert.strictEqual(utils.makeCss('/nonexistent/file.css'), '');
    });
  });
```

- [ ] **Step 2: テスト実行・失敗確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: FAIL — `utils.readFile is not a function` および `utils.makeCss is not a function`

- [ ] **Step 3: `src/utils.js` に `readFile` と `makeCss` を追加**

`module.exports` の前に追加:

```js
function readFile(filename, encode) {
  if (filename.length === 0) {
    return '';
  }
  if (!encode && encode !== null) {
    encode = 'utf-8';
  }
  if (filename.indexOf('file://') === 0) {
    if (process.platform === 'win32') {
      filename = filename.replace(/^file:\/\/\//, '')
                 .replace(/^file:\/\//, '');
    } else {
      filename = filename.replace(/^file:\/\//, '');
    }
  }
  if (isExistsPath(filename)) {
    return fs.readFileSync(filename, encode);
  } else {
    return '';
  }
}

function makeCss(filename) {
  var css = readFile(filename);
  if (css) {
    return '\n<style>\n' + css + '\n</style>\n';
  } else {
    return '';
  }
}
```

`module.exports` を更新:

```js
module.exports = {
  setBooleanValue,
  isExistsPath,
  isExistsDir,
  Slug,
  transformTemplate,
  readFile,
  makeCss,
};
```

- [ ] **Step 4: テスト実行・パス確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: 全33テストがパス。

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract readFile and makeCss to src/utils.js with unit tests"
```

---

### Task 5: `convertImgPath` の追加

**ファイル:**
- 変更: `src/utils.js`
- 変更: `test/unit/utils.test.js`

- [ ] **Step 1: `convertImgPath` のテストを追加**

`test/unit/utils.test.js` の `describe('utils', ...)` ブロック内に追加:

```js
  describe('convertImgPath', function () {
    it('should convert relative path to file URI', function () {
      var result = utils.convertImgPath('image.png', '/home/user/doc.md');
      assert.strictEqual(result, 'file:///home/user/image.png');
    });

    it('should convert absolute path to file URI', function () {
      var result = utils.convertImgPath('/images/photo.png', '/home/user/doc.md');
      assert.strictEqual(result, 'file:///images/photo.png');
    });

    it('should return http URLs unchanged', function () {
      var result = utils.convertImgPath('https://example.com/img.png', '/home/user/doc.md');
      assert.strictEqual(result, 'https://example.com/img.png');
    });

    it('should return http URLs unchanged (http)', function () {
      var result = utils.convertImgPath('http://example.com/img.png', '/home/user/doc.md');
      assert.strictEqual(result, 'http://example.com/img.png');
    });

    it('should escape # in path as %23', function () {
      var result = utils.convertImgPath('image#1.png', '/home/user/doc.md');
      assert.ok(result.indexOf('%23') !== -1, 'Expected %23 in result: ' + result);
    });

    it('should remove quotes from path', function () {
      var result = utils.convertImgPath('"image.png"', '/home/user/doc.md');
      assert.ok(result.indexOf('"') === -1, 'Expected no quotes in result: ' + result);
    });

    it('should normalize file:// to file:///', function () {
      var result = utils.convertImgPath('file://image.png', '/home/user/doc.md');
      assert.ok(result.indexOf('file:///') === 0, 'Expected file:/// prefix in result: ' + result);
    });

    it('should return file:/// URLs unchanged', function () {
      var result = utils.convertImgPath('file:///home/user/image.png', '/home/user/doc.md');
      assert.strictEqual(result, 'file:///home/user/image.png');
    });
  });
```

- [ ] **Step 2: テスト実行・失敗確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: FAIL — `utils.convertImgPath is not a function`

- [ ] **Step 3: `src/utils.js` に `convertImgPath` を追加**

ファイル先頭に `var url = require('url');` と `var path = require('path');` を追加（既存の `var fs = require('fs');` の後）。

`module.exports` の前に追加:

```js
function convertImgPath(src, filename) {
  var href = decodeURIComponent(src);
  href = href.replace(/("|')/g, '')
        .replace(/\\/g, '/')
        .replace(/#/g, '%23');
  var protocol = url.parse(href).protocol;
  if (protocol === 'file:' && href.indexOf('file:///') !== 0) {
    return href.replace(/^file:\/\//, 'file:///');
  } else if (protocol === 'file:') {
    return href;
  } else if (!protocol || path.isAbsolute(href)) {
    href = path.resolve(path.dirname(filename), href).replace(/\\/g, '/')
                                                    .replace(/#/g, '%23');
    if (href.indexOf('//') === 0) {
      return 'file:' + href;
    } else if (href.indexOf('/') === 0) {
      return 'file://' + href;
    } else {
      return 'file:///' + href;
    }
  } else {
    return src;
  }
}
```

`module.exports` を更新:

```js
module.exports = {
  setBooleanValue,
  isExistsPath,
  isExistsDir,
  Slug,
  transformTemplate,
  readFile,
  makeCss,
  convertImgPath,
};
```

- [ ] **Step 4: テスト実行・パス確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: 全41テストがパス。

- [ ] **Step 5: コミット**

```bash
git add src/utils.js test/unit/utils.test.js
git commit -m "feat: extract convertImgPath to src/utils.js with unit tests"
```

---

### Task 6: `extension.js` を `src/utils.js` を使うように更新

抽出した関数のすべての呼び出し箇所を `utils.*` に置き換え、元の関数定義を削除する。

**ファイル:**
- 変更: `extension.js`

- [ ] **Step 1: `extension.js` に require を追加**

`var os = require('os');` (6行目) の後に追加:

```js
var utils = require('./src/utils');
```

- [ ] **Step 2: 関数呼び出しを `utils.*` に置き換え**

以下のすべての呼び出し箇所を置換する（関数定義はまだ削除しない）:

| 行 | 変更前 | 変更後 |
|---|---|---|
| 58 | `isExistsPath(mdfilename)` | `utils.isExistsPath(mdfilename)` |
| 158 | `setBooleanValue(matterParts.data.breaks, ...)` | `utils.setBooleanValue(matterParts.data.breaks, ...)` |
| 197 | `convertImgPath(href, filename)` | `utils.convertImgPath(href, filename)` |
| 212 | `convertImgPath(src, filename)` | `utils.convertImgPath(src, filename)` |
| 223 | `setBooleanValue(matterParts.data.emoji, ...)` | `utils.setBooleanValue(matterParts.data.emoji, ...)` |
| 238 | `readFile(emojipath, null)` | `utils.readFile(emojipath, null)` |
| 250 | `slugify: Slug` | `slugify: utils.Slug` |
| 332 | `readFile(filename)` | `utils.readFile(filename)` |
| 431 | `transformTemplate(...)` | `utils.transformTemplate(...)` |
| 432 | `transformTemplate(...)` | `utils.transformTemplate(...)` |
| 497 | `isExistsPath(tmpfilename)` | `utils.isExistsPath(tmpfilename)` |
| 586 | `isExistsDir(outputDirectory)` | `utils.isExistsDir(outputDirectory)` |
| 613 | `isExistsDir(path)` | `utils.isExistsDir(path)` |
| 635 | `isExistsPath(filename)` | `utils.isExistsPath(filename)` |
| 673 | `readFile(filename)` | `utils.readFile(filename)` |
| 697 | `makeCss(filename)` | `utils.makeCss(filename)` |
| 718 | `makeCss(filename)` | `utils.makeCss(filename)` |
| 721 | `makeCss(filename)` | `utils.makeCss(filename)` |
| 728 | `makeCss(filename)` | `utils.makeCss(filename)` |
| 793 | `isExistsPath(executablePath)` | `utils.isExistsPath(executablePath)` |
| 801 | `isExistsPath(executablePath)` | `utils.isExistsPath(executablePath)` |

- [ ] **Step 3: 抽出済み関数の定義を `extension.js` から削除**

以下の関数定義を削除する:

- `setBooleanValue` (884〜890行目)
- `isExistsPath` (531〜542行目)
- `isExistsDir` (544〜559行目)
- `Slug` (298〜316行目、コメントブロック含む)
- `transformTemplate` (510〜529行目、JSDoc含む)
- `readFile` (620〜640行目)
- `makeCss` (671〜682行目)
- `convertImgPath` (642〜669行目)

- [ ] **Step 4: ユニットテスト実行・パス確認**

```bash
npx mocha test/unit/**/*.test.js
```

期待: 全41テストがパス。

- [ ] **Step 5: コミット**

```bash
git add extension.js
git commit -m "refactor: use src/utils.js for extracted functions in extension.js"
```

---

### Task 7: 最終検証

**ファイル:** なし（検証のみ）

- [ ] **Step 1: ユニットテスト最終実行**

```bash
npm run test:unit
```

期待: 全41テストがパス。

- [ ] **Step 2: `extension.js` に抽出済み関数の定義が残っていないことを確認**

```bash
grep -n 'function Slug\|function transformTemplate\|function convertImgPath\|function setBooleanValue\|function readFile\|function isExistsPath\|function isExistsDir\|function makeCss' extension.js
```

期待: 出力なし（すべての関数定義が削除済み）。

- [ ] **Step 3: `src/utils.js` から全関数がエクスポートされていることを確認**

```bash
node -e "var u = require('./src/utils'); console.log(Object.keys(u).sort().join(', '))"
```

期待: `Slug, convertImgPath, isExistsDir, isExistsPath, makeCss, readFile, setBooleanValue, transformTemplate`

- [ ] **Step 4: `extension.js` の未使用 `require` を確認・整理**

`convertImgPath` が `src/utils.js` に移動したため、`extension.js` の `var url = require('url');` が不要になっている可能性がある。確認:

```bash
grep -n '\burl\b' extension.js | grep -v require | grep -v '//'
```

結果が require 行以外にない場合、`var url = require('url');` を `extension.js` から削除する。

- [ ] **Step 5: クリーンアップがあればコミット**

```bash
git add extension.js
git commit -m "chore: remove unused url require from extension.js"
```

（前のステップで変更があった場合のみコミットする。）
