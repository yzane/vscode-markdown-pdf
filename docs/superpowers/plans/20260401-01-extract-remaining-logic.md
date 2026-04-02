# extension.js 残存ロジック抽出 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Branch:** `feature/extract-remaining-logic` (develop から作成済み)

**Goal:** extension.js に残る6つの純粋ロジックを src/utils.js に抽出し、ユニットテストで保護する。

**Architecture:** 各関数を utils.js にエクスポート関数として追加し、extension.js 側は委譲呼び出しに置き換える。既存の抽出パターン（buildPdfOptions 等）を踏襲する。

**Tech Stack:** Node.js, Mocha, assert, cheerio, path

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/utils.js` | 変更: 6関数を追加、module.exports を更新 |
| `extension.js` | 変更: 抽出した関数の呼び出しに置き換え |
| `test/unit/utils.test.js` | 変更: 6関数のテストを追加 |

---

### Task 1: resolveExportTypes

**Files:**
- Modify: `src/utils.js:355-374` (add function + export)
- Modify: `extension.js:67-84` (replace inline logic with function call)
- Modify: `test/unit/utils.test.js` (add describe block)

- [ ] **Step 1: Write failing tests**

Add to `test/unit/utils.test.js`, before the closing `});` of the top-level `describe('utils', ...)`:

```javascript
  describe('resolveExportTypes', function () {
    it('should return single-element array for direct format "pdf"', function () {
      var result = utils.resolveExportTypes('pdf');
      assert.deepStrictEqual(result, ['pdf']);
    });

    it('should return single-element array for direct format "html"', function () {
      var result = utils.resolveExportTypes('html');
      assert.deepStrictEqual(result, ['html']);
    });

    it('should return single-element array for direct format "png"', function () {
      var result = utils.resolveExportTypes('png');
      assert.deepStrictEqual(result, ['png']);
    });

    it('should return single-element array for direct format "jpeg"', function () {
      var result = utils.resolveExportTypes('jpeg');
      assert.deepStrictEqual(result, ['jpeg']);
    });

    it('should return all formats for "all"', function () {
      var result = utils.resolveExportTypes('all');
      assert.deepStrictEqual(result, ['html', 'pdf', 'png', 'jpeg']);
    });

    it('should wrap string configuredType in array for "settings"', function () {
      var result = utils.resolveExportTypes('settings', 'html');
      assert.deepStrictEqual(result, ['html']);
    });

    it('should return array configuredType as-is for "settings"', function () {
      var result = utils.resolveExportTypes('settings', ['pdf', 'html']);
      assert.deepStrictEqual(result, ['pdf', 'html']);
    });

    it('should default to ["pdf"] when configuredType is undefined for "settings"', function () {
      var result = utils.resolveExportTypes('settings', undefined);
      assert.deepStrictEqual(result, ['pdf']);
    });

    it('should default to ["pdf"] when configuredType is empty string for "settings"', function () {
      var result = utils.resolveExportTypes('settings', '');
      assert.deepStrictEqual(result, ['pdf']);
    });

    it('should return null for invalid type "docx"', function () {
      var result = utils.resolveExportTypes('docx');
      assert.strictEqual(result, null);
    });

    it('should return null for empty string', function () {
      var result = utils.resolveExportTypes('');
      assert.strictEqual(result, null);
    });

    it('should return null for undefined', function () {
      var result = utils.resolveExportTypes(undefined);
      assert.strictEqual(result, null);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — `utils.resolveExportTypes is not a function`

- [ ] **Step 3: Implement resolveExportTypes in utils.js**

Add before `module.exports` in `src/utils.js`:

```javascript
function resolveExportTypes(optionType, configuredType) {
  var types_format = ['html', 'pdf', 'png', 'jpeg'];

  if (types_format.indexOf(optionType) >= 0) {
    return [optionType];
  }

  if (optionType === 'settings') {
    var resolved = configuredType || 'pdf';
    if (Array.isArray(resolved)) {
      return resolved;
    }
    return [resolved];
  }

  if (optionType === 'all') {
    return types_format;
  }

  return null;
}
```

Add `resolveExportTypes` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Update extension.js to use the extracted function**

Replace in `extension.js` (lines 67-84) the inline type resolution logic:

```javascript
    var types = utils.resolveExportTypes(option_type, vscode.workspace.getConfiguration('markdown-pdf')['type']);
    if (types === null) {
      showErrorMessage('markdownPdf().1 Supported formats: html, pdf, png, jpeg.');
      return;
    }
```

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `npm run test:unit 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract resolveExportTypes from extension.js and add unit tests"
```

---

### Task 2: transformImageHref

**Files:**
- Modify: `src/utils.js` (add function + export)
- Modify: `extension.js:161-174` (replace inline logic with function call)
- Modify: `test/unit/utils.test.js` (add describe block)

- [ ] **Step 1: Write failing tests**

Add to `test/unit/utils.test.js`:

```javascript
  describe('transformImageHref', function () {
    it('should decode URI and remove quotes for html type', function () {
      var result = utils.transformImageHref('image%20file.png', 'html', '/doc/test.md');
      assert.strictEqual(result, 'image file.png');
    });

    it('should remove single quotes from href for html type', function () {
      var result = utils.transformImageHref("'image.png'", 'html', '/doc/test.md');
      assert.strictEqual(result, 'image.png');
    });

    it('should remove double quotes from href for html type', function () {
      var result = utils.transformImageHref('"image.png"', 'html', '/doc/test.md');
      assert.strictEqual(result, 'image.png');
    });

    it('should return plain path unchanged for html type', function () {
      var result = utils.transformImageHref('image.png', 'html', '/doc/test.md');
      assert.strictEqual(result, 'image.png');
    });

    it('should delegate to convertImgPath for pdf type', function () {
      var result = utils.transformImageHref('image.png', 'pdf', '/doc/test.md');
      // convertImgPath resolves relative paths to file:// URIs
      assert.ok(result.indexOf('file://') === 0 || result === 'image.png');
    });

    it('should delegate to convertImgPath for png type', function () {
      var result = utils.transformImageHref('image.png', 'png', '/doc/test.md');
      assert.ok(result.indexOf('file://') === 0 || result === 'image.png');
    });

    it('should delegate to convertImgPath for jpeg type', function () {
      var result = utils.transformImageHref('image.png', 'jpeg', '/doc/test.md');
      assert.ok(result.indexOf('file://') === 0 || result === 'image.png');
    });

    it('should handle encoded special characters for html type', function () {
      var result = utils.transformImageHref('img%23%26name.png', 'html', '/doc/test.md');
      assert.strictEqual(result, 'img#&name.png');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — `utils.transformImageHref is not a function`

- [ ] **Step 3: Implement transformImageHref in utils.js**

Add before `module.exports` in `src/utils.js`:

```javascript
function transformImageHref(href, type, filename) {
  if (type === 'html') {
    return decodeURIComponent(href).replace(/("|')/g, '');
  }
  return convertImgPath(href, filename);
}
```

Add `transformImageHref` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Update extension.js to use the extracted function**

Replace in `extension.js` the image renderer rule (lines 161-174). Change the body of `md.renderer.rules.image`:

```javascript
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    var token = tokens[idx];
    var href = token.attrs[token.attrIndex('src')][1];
    href = utils.transformImageHref(href, type, filename);
    token.attrs[token.attrIndex('src')][1] = href;
    return defaultRender(tokens, idx, options, env, self);
  };
```

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `npm run test:unit 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract transformImageHref from extension.js and add unit tests"
```

---

### Task 3: transformHtmlBlockImages

**Files:**
- Modify: `src/utils.js` (add function + export)
- Modify: `extension.js:176-188` (replace inline logic with function call)
- Modify: `test/unit/utils.test.js` (add describe block)

- [ ] **Step 1: Write failing tests**

Add to `test/unit/utils.test.js`:

```javascript
  describe('transformHtmlBlockImages', function () {
    it('should transform a single img tag src', function () {
      var html = '<img src="photo.png">';
      var result = utils.transformHtmlBlockImages(html, '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('photo.png') >= 0);
    });

    it('should transform multiple img tags', function () {
      var html = '<img src="a.png"><img src="b.png">';
      var result = utils.transformHtmlBlockImages(html, '/doc/test.md');
      assert.ok(result.indexOf('a.png') >= 0);
      assert.ok(result.indexOf('b.png') >= 0);
      // Both should be file:// URIs
      var matches = result.match(/file:\/\//g);
      assert.strictEqual(matches.length, 2);
    });

    it('should return html unchanged when no img tags', function () {
      var html = '<p>Hello world</p>';
      var result = utils.transformHtmlBlockImages(html, '/doc/test.md');
      assert.ok(result.indexOf('Hello world') >= 0);
    });

    it('should handle empty html string', function () {
      var result = utils.transformHtmlBlockImages('', '/doc/test.md');
      assert.strictEqual(result, '');
    });

    it('should handle relative path images', function () {
      var html = '<img src="images/photo.png">';
      var result = utils.transformHtmlBlockImages(html, '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('photo.png') >= 0);
    });

    it('should handle absolute path images', function () {
      var html = '<img src="/abs/photo.png">';
      var result = utils.transformHtmlBlockImages(html, '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('/abs/photo.png') >= 0);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — `utils.transformHtmlBlockImages is not a function`

- [ ] **Step 3: Implement transformHtmlBlockImages in utils.js**

Add `var cheerio = require('cheerio');` at the top of `src/utils.js` (with the other requires).

Add before `module.exports`:

```javascript
function transformHtmlBlockImages(html, filename) {
  if (!html) {
    return '';
  }
  var $ = cheerio.load(html);
  $('img').each(function () {
    var src = $(this).attr('src');
    var href = convertImgPath(src, filename);
    $(this).attr('src', href);
  });
  return $.html();
}
```

Add `transformHtmlBlockImages` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Update extension.js to use the extracted function**

Replace in `extension.js` the html_block renderer rule (lines 176-188):

```javascript
  if (type !== 'html') {
    md.renderer.rules.html_block = function (tokens, idx) {
      return utils.transformHtmlBlockImages(tokens[idx].content, filename);
    };
  }
```

Remove the `var cheerio = require('cheerio');` line from `convertMarkdownToHtml()` (line 159) since cheerio is now used in utils.js.

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `npm run test:unit 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract transformHtmlBlockImages from extension.js and add unit tests"
```

---

### Task 4: buildEmojiTag

**Files:**
- Modify: `src/utils.js` (add function + export)
- Modify: `extension.js:206-215` (replace inline logic with function call)
- Modify: `test/unit/utils.test.js` (add describe block)

- [ ] **Step 1: Write failing tests**

Add to `test/unit/utils.test.js`:

```javascript
  describe('buildEmojiTag', function () {
    it('should return img tag with base64 data when emojiData is provided', function () {
      var result = utils.buildEmojiTag('smile', 'aGVsbG8=');
      assert.strictEqual(result, '<img class="emoji" alt="smile" src="data:image/png;base64,aGVsbG8=" />');
    });

    it('should return fallback text when emojiData is empty string', function () {
      var result = utils.buildEmojiTag('smile', '');
      assert.strictEqual(result, ':smile:');
    });

    it('should return fallback text when emojiData is null', function () {
      var result = utils.buildEmojiTag('smile', null);
      assert.strictEqual(result, ':smile:');
    });

    it('should return fallback text when emojiData is undefined', function () {
      var result = utils.buildEmojiTag('smile', undefined);
      assert.strictEqual(result, ':smile:');
    });

    it('should handle emoji name with special characters in alt attribute', function () {
      var result = utils.buildEmojiTag('+1', 'aGVsbG8=');
      assert.strictEqual(result, '<img class="emoji" alt="+1" src="data:image/png;base64,aGVsbG8=" />');
    });

    it('should handle emoji name with hyphen', function () {
      var result = utils.buildEmojiTag('heavy-check-mark', 'data123');
      assert.strictEqual(result, '<img class="emoji" alt="heavy-check-mark" src="data:image/png;base64,data123" />');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — `utils.buildEmojiTag is not a function`

- [ ] **Step 3: Implement buildEmojiTag in utils.js**

Add before `module.exports` in `src/utils.js`:

```javascript
function buildEmojiTag(emoji, emojiData) {
  if (emojiData) {
    return '<img class="emoji" alt="' + emoji + '" src="data:image/png;base64,' + emojiData + '" />';
  } else {
    return ':' + emoji + ':';
  }
}
```

Add `buildEmojiTag` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Update extension.js to use the extracted function**

Replace in `extension.js` the emoji renderer (lines 206-215):

```javascript
    md.renderer.rules.emoji = function (token, idx) {
      var emoji = token[idx].markup;
      var emojipath = path.join(__dirname, 'node_modules', 'emoji-images', 'pngs', emoji + '.png');
      var emojidata = utils.readFile(emojipath, null).toString('base64');
      return utils.buildEmojiTag(emoji, emojidata);
    };
```

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `npm run test:unit 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract buildEmojiTag from extension.js and add unit tests"
```

---

### Task 5: buildContainerRenderer

**Files:**
- Modify: `src/utils.js` (add function + export)
- Modify: `extension.js:227-238` (replace inline logic with function call)
- Modify: `test/unit/utils.test.js` (add describe block)

- [ ] **Step 1: Write failing tests**

Add to `test/unit/utils.test.js`:

```javascript
  describe('buildContainerRenderer', function () {
    var renderer;

    before(function () {
      renderer = utils.buildContainerRenderer();
    });

    describe('validate', function () {
      it('should return truthy for non-empty name', function () {
        assert.ok(renderer.validate('warning'));
      });

      it('should return falsy for empty string', function () {
        assert.ok(!renderer.validate(''));
      });

      it('should return falsy for whitespace-only string', function () {
        assert.ok(!renderer.validate('   '));
      });

      it('should return truthy for name with surrounding spaces', function () {
        assert.ok(renderer.validate('  warning  '));
      });
    });

    describe('render', function () {
      it('should return opening div with class when info is non-empty', function () {
        var tokens = [{ info: 'warning' }];
        var result = renderer.render(tokens, 0);
        assert.strictEqual(result, '<div class="warning">\n');
      });

      it('should return closing div when info is empty', function () {
        var tokens = [{ info: '' }];
        var result = renderer.render(tokens, 0);
        assert.strictEqual(result, '</div>\n');
      });

      it('should trim whitespace from class name', function () {
        var tokens = [{ info: '  note  ' }];
        var result = renderer.render(tokens, 0);
        assert.strictEqual(result, '<div class="note">\n');
      });

      it('should return closing div when info is whitespace-only', function () {
        var tokens = [{ info: '   ' }];
        var result = renderer.render(tokens, 0);
        assert.strictEqual(result, '</div>\n');
      });

      it('should handle class name with multiple words', function () {
        var tokens = [{ info: 'alert danger' }];
        var result = renderer.render(tokens, 0);
        assert.strictEqual(result, '<div class="alert danger">\n');
      });
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — `utils.buildContainerRenderer is not a function`

- [ ] **Step 3: Implement buildContainerRenderer in utils.js**

Add before `module.exports` in `src/utils.js`:

```javascript
function buildContainerRenderer() {
  return {
    validate: function (name) {
      return name.trim().length;
    },
    render: function (tokens, idx) {
      if (tokens[idx].info.trim() !== '') {
        return '<div class="' + tokens[idx].info.trim() + '">\n';
      } else {
        return '</div>\n';
      }
    }
  };
}
```

Add `buildContainerRenderer` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Update extension.js to use the extracted function**

Replace in `extension.js` (lines 227-238):

```javascript
  // markdown-it-container
  // https://github.com/markdown-it/markdown-it-container
  md.use(require('markdown-it-container'), '', utils.buildContainerRenderer());
```

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `npm run test:unit 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract buildContainerRenderer from extension.js and add unit tests"
```

---

### Task 6: generateTmpHtmlFilename (低優先)

**Files:**
- Modify: `src/utils.js` (add function + export)
- Modify: `extension.js:348-349` (replace inline logic with function call)
- Modify: `test/unit/utils.test.js` (add describe block)

- [ ] **Step 1: Write failing tests**

Add to `test/unit/utils.test.js`:

```javascript
  describe('generateTmpHtmlFilename', function () {
    it('should replace extension with _tmp.html', function () {
      var result = utils.generateTmpHtmlFilename('/path/to/file.md');
      assert.strictEqual(result, path.join('/path/to', 'file_tmp.html'));
    });

    it('should handle file without extension', function () {
      var result = utils.generateTmpHtmlFilename('/path/to/file');
      assert.strictEqual(result, path.join('/path/to', 'file_tmp.html'));
    });

    it('should handle deeply nested path', function () {
      var result = utils.generateTmpHtmlFilename('/a/b/c/d/document.md');
      assert.strictEqual(result, path.join('/a/b/c/d', 'document_tmp.html'));
    });

    it('should handle filename with dots', function () {
      var result = utils.generateTmpHtmlFilename('/path/to/my.file.name.md');
      assert.strictEqual(result, path.join('/path/to', 'my.file.name_tmp.html'));
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — `utils.generateTmpHtmlFilename is not a function`

- [ ] **Step 3: Implement generateTmpHtmlFilename in utils.js**

Add before `module.exports` in `src/utils.js`:

```javascript
function generateTmpHtmlFilename(filename) {
  var f = path.parse(filename);
  return path.join(f.dir, f.name + '_tmp.html');
}
```

Add `generateTmpHtmlFilename` to the `module.exports` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Update extension.js to use the extracted function**

Replace in `extension.js` (lines 348-349):

```javascript
        var tmpfilename = utils.generateTmpHtmlFilename(filename);
```

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `npm run test:unit 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils.js test/unit/utils.test.js extension.js
git commit -m "feat: extract generateTmpHtmlFilename from extension.js and add unit tests"
```
