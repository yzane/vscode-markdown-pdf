# 追加テスト実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存テストスイートに29件のテスト（ユニット23件 + 統合6件）を追加し、エッジケースと機能カバレッジを拡充する。

**Architecture:** フェーズ2で`test/unit/utils.test.js`の既存describeブロックにエッジケーステストを追加。フェーズ3で`test/integration/extension.test.js`に新規fixtureとテストを追加。ソースコード変更なし。

**Tech Stack:** Mocha, Node.js assert, VS Code Test CLI

**Branch:** `feature/additional-tests`（`develop`から作成済み）

---

### Task 1: convertImgPath エッジケース（5件）

**Files:**
- Modify: `test/unit/utils.test.js:240-322` (convertImgPath describe block)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js`の`convertImgPath` describeブロック末尾（321行目の`});`の前、320行目の後）に以下を追加:

```javascript
    it('should return https URL with query string unchanged', function () {
      var result = utils.convertImgPath('https://example.com/img.png?v=1', '/home/user/doc.md');
      assert.strictEqual(result, 'https://example.com/img.png?v=1');
    });

    it('should return https URL with fragment unchanged', function () {
      var result = utils.convertImgPath('https://example.com/img.svg#icon', '/home/user/doc.md');
      assert.strictEqual(result, 'https://example.com/img.svg#icon');
    });

    it('should convert Unicode relative path to file URI', function () {
      var result = utils.convertImgPath('画像/テスト.png', '/home/user/doc.md');
      assert.strictEqual(result, 'file:///home/user/画像/テスト.png');
    });

    it('should escape all # characters in path', function () {
      var result = utils.convertImgPath('path/to/C#/image#1.png', '/home/user/doc.md');
      assert.ok(result.indexOf('#') === -1, 'Expected no # in result: ' + result);
      assert.ok(result.indexOf('%23') !== -1, 'Expected %23 in result: ' + result);
    });

    it('should not crash when filename is empty string', function () {
      assert.doesNotThrow(function () {
        utils.convertImgPath('image.png', '');
      });
    });
```

- [ ] **Step 2: テスト実行して全てパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストPASS（convertImgPathが21件になる）

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add convertImgPath edge cases (query string, fragment, unicode, multi-hash, empty filename)"
```

---

### Task 2: resolveHref エッジケース（4件）

**Files:**
- Modify: `test/unit/utils.test.js:356-449` (resolveHref describe block)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js`の`resolveHref` describeブロック末尾（448行目の`});`の前、Windowsテストの後）に以下を追加:

```javascript
    it('should resolve fragment-bearing href as file-relative path', function () {
      var result = utils.resolveHref('style.css#print', resourceFsPath, true, workspaceFsPath);
      assert.strictEqual(result, fileUri(childFsPath(resourceDirFsPath, 'style.css#print')));
    });

    it('should treat protocol-relative URL as absolute path', function () {
      var result = utils.resolveHref('//cdn.example.com/style.css', resourceFsPath, false, workspaceFsPath);
      // path.isAbsolute('//cdn.example.com/style.css') is true on POSIX
      assert.strictEqual(result, fileUri('//cdn.example.com/style.css'));
    });

    it('should treat file:// scheme href as relative path (not http/https)', function () {
      // url.parse('file:///home/user/style.css').protocol === 'file:'
      // which is not http/https, so it falls through to path resolution
      var result = utils.resolveHref('file:///home/user/style.css', resourceFsPath, false, workspaceFsPath);
      // file:/// is not http/https and not ~ and path.isAbsolute depends on platform
      // On POSIX: url.parse parses it, protocol is 'file:', falls through
      // href does not start with ~, path.isAbsolute('file:///home/user/style.css') is false
      // so it resolves relative to workspace
      assert.strictEqual(result, fileUri(childFsPath(workspaceFsPath, 'file:///home/user/style.css')));
    });

    it('should resolve href with trailing slash as file-relative path', function () {
      var result = utils.resolveHref('styles/', resourceFsPath, true, workspaceFsPath);
      assert.strictEqual(result, fileUri(childFsPath(resourceDirFsPath, 'styles/')));
    });
```

- [ ] **Step 2: テスト実行して全てパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストPASS（resolveHrefが18件になる）

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add resolveHref edge cases (fragment, protocol-relative, file scheme, trailing slash)"
```

---

### Task 3: Slug エッジケース（4件）

**Files:**
- Modify: `test/unit/utils.test.js:71-108` (Slug describe block)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js`の`Slug` describeブロック末尾（107行目の`});`の前）に以下を追加:

```javascript
    it('should return empty string for punctuation-only input', function () {
      assert.strictEqual(utils.Slug('!@#$%^&*()'), '');
    });

    it('should be idempotent for already-slugified input', function () {
      assert.strictEqual(utils.Slug('hello-world'), 'hello-world');
    });

    it('should handle mixed CJK and Latin scripts', function () {
      var result = utils.Slug('日本語 English テスト');
      assert.strictEqual(result, encodeURI('日本語') + '-english-' + encodeURI('テスト'));
    });

    it('should handle emoji in text', function () {
      var result = utils.Slug('Hello 🎉 World');
      assert.strictEqual(result, 'hello-' + encodeURI('🎉') + '-world');
    });
```

- [ ] **Step 2: テスト実行して全てパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストPASS（Slugが13件になる）

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add Slug edge cases (punctuation-only, idempotent, mixed CJK/Latin, emoji)"
```

---

### Task 4: readFile エッジケース（2件）

**Files:**
- Modify: `test/unit/utils.test.js:146-208` (readFile describe block)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js`の`readFile` describeブロック内で、`before`ブロックの一時ファイル作成にBOMファイルを追加し、テストケースを追加する。

まず`before`ブロック内（157行目の後）に一時ファイル追加:

```javascript
      tmpFileWithBom = path.join(__dirname, 'test-read-file-bom.tmp');
      fs.writeFileSync(tmpFileWithBom, '\uFEFFhello BOM', 'utf-8');
```

`var tmpFileWithSpace;`宣言の後に変数宣言追加:

```javascript
    var tmpFileWithBom;
```

`after`ブロック内の削除リスト（161行目）を更新:

```javascript
      [tmpFile, tmpFileWithSpace, tmpFileWithBom].forEach(function (f) {
```

Windowsテストの後（207行目の後）にテストケース追加:

```javascript
    it('should return empty string when path is a directory', function () {
      // isExistsPath returns true for directories, but readFileSync throws EISDIR
      // readFile should handle this gracefully
      var result = utils.readFile(__dirname);
      assert.strictEqual(result, '');
    });

    it('should preserve BOM in UTF-8 file', function () {
      var result = utils.readFile(tmpFileWithBom);
      assert.strictEqual(result.charCodeAt(0), 0xFEFF, 'Expected BOM at start of file');
      assert.ok(result.indexOf('hello BOM') !== -1, 'Expected content after BOM');
    });
```

- [ ] **Step 2: テスト実行して確認**

Run: `npm run test:unit`
Expected: 全テストPASS（readFileが9件になる）

注意: `readFile`にディレクトリを渡すと、`isExistsPath`はtrueを返すが`fs.readFileSync`がEISDIRエラーを投げる。現在の実装にはこのケースのcatchがないため、テストが失敗する可能性がある。失敗した場合、実際の挙動をテストの期待値に合わせる（例: `assert.throws`に変更）。

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add readFile edge cases (directory input, BOM preservation)"
```

---

### Task 5: isExcludeFile エッジケース（3件）

**Files:**
- Modify: `test/unit/utils.test.js:324-354` (isExcludeFile describe block)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js`の`isExcludeFile` describeブロック末尾（353行目の`});`の前）に以下を追加:

```javascript
    it('should match filename with regex special characters when pattern escapes them', function () {
      assert.strictEqual(utils.isExcludeFile('test[1].md', ['test\\[1\\]']), true);
    });

    it('should be case-sensitive by default', function () {
      assert.strictEqual(utils.isExcludeFile('README.md', ['^readme']), false);
    });

    it('should match empty filename against .* pattern', function () {
      assert.strictEqual(utils.isExcludeFile('', ['.*']), true);
    });
```

- [ ] **Step 2: テスト実行して全てパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストPASS（isExcludeFileが10件になる）

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add isExcludeFile edge cases (regex special chars, case sensitivity, empty filename)"
```

---

### Task 6: buildStyleTags エッジケース（3件）

**Files:**
- Modify: `test/unit/utils.test.js:540-697` (buildStyleTags describe block)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js`の`buildStyleTags` describeブロック末尾（696行目の`});`の前）に以下を追加:

```javascript
    it('should skip markdownStyles when value is a string instead of array', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: true,
        highlight: false,
        highlightStyle: '',
        markdownStyles: 'style.css',
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href) { return 'file:///resolved/' + href; }
      });
      // markdownStyles is checked with Array.isArray, string should be skipped
      assert.ok(result.indexOf('style.css') === -1, 'Expected no link tag for string markdownStyles');
    });

    it('should skip markdownPdfStyles when value is a string instead of array', function () {
      var result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: 'custom.css',
        baseDir: baseDir,
        resolveHrefFn: function (href) { return 'file:///resolved/' + href; }
      });
      // markdownPdfStyles is checked with Array.isArray, string should be skipped
      assert.strictEqual(result, '');
    });

    it('should propagate exception from resolveHrefFn', function () {
      assert.throws(function () {
        utils.buildStyleTags({
          includeDefaultStyles: false,
          highlight: false,
          highlightStyle: '',
          markdownStyles: [],
          markdownPdfStyles: ['will-throw.css'],
          baseDir: baseDir,
          resolveHrefFn: function () { throw new Error('resolve failed'); }
        });
      }, /resolve failed/);
    });
```

- [ ] **Step 2: テスト実行して全てパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストPASS（buildStyleTagsが13件になる）

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add buildStyleTags edge cases (non-array styles, resolveHrefFn exception)"
```

---

### Task 7: resolveOutputDir エッジケース（2件）

**Files:**
- Modify: `test/unit/utils.test.js:451-538` (resolveOutputDir describe block)

- [ ] **Step 1: テストコードを追加**

`test/unit/utils.test.js`の`resolveOutputDir` describeブロック内、Windowsテストの前（527行目の前）に以下を追加:

```javascript
    it('should handle trailing slash in absolute directory path', function () {
      var dirWithSlash = tmpDir + '/';
      var result = utils.resolveOutputDir('/home/user/doc.pdf', dirWithSlash, false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join(tmpDir, 'doc.pdf'));
    });

    it('should not expand ~ in the middle of path', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', 'foo/~/bar', false, '/home/user/doc.md', '/workspace');
      // ~ only expands when at index 0; 'foo/~/bar' is a relative path
      assert.strictEqual(result, path.join('/workspace', 'foo/~/bar', 'doc.pdf'));
    });
```

- [ ] **Step 2: テスト実行して全てパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストPASS（resolveOutputDirが15件になる）

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add resolveOutputDir edge cases (trailing slash, tilde in middle)"
```

---

### Task 8: 統合テスト — frontmatter fixtures作成

**Files:**
- Create: `test/integration/fixtures/frontmatter-breaks.md`
- Create: `test/integration/fixtures/frontmatter-no-emoji.md`
- Create: `test/integration/fixtures/breaks.md`

- [ ] **Step 1: frontmatter-breaks.md を作成**

```markdown
---
breaks: true
---
line one
line two
```

- [ ] **Step 2: frontmatter-no-emoji.md を作成**

```markdown
---
emoji: false
---
# No Emoji

:smile: should stay as text
```

- [ ] **Step 3: breaks.md を作成**

```markdown
line one
line two

paragraph two
```

- [ ] **Step 4: コミット**

```bash
git add test/integration/fixtures/frontmatter-breaks.md test/integration/fixtures/frontmatter-no-emoji.md test/integration/fixtures/breaks.md
git commit -m "test: add frontmatter and breaks fixture files"
```

---

### Task 9: 統合テスト — 画像参照fixture作成

**Files:**
- Create: `test/integration/fixtures/test.png`
- Create: `test/integration/fixtures/image.md`

- [ ] **Step 1: 1x1テスト用PNGを作成**

最小限の1x1ピクセルPNGファイルをbase64デコードして作成:

```bash
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 -d > test/integration/fixtures/test.png
```

- [ ] **Step 2: image.md を作成**

```markdown
# Image References

![relative](./test.png)

![url](https://example.com/image.png)

![data](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)
```

- [ ] **Step 3: コミット**

```bash
git add test/integration/fixtures/test.png test/integration/fixtures/image.md
git commit -m "test: add image reference fixture files"
```

---

### Task 10: 統合テスト — expected HTMLスナップショット生成

**Files:**
- Create: `test/integration/expected/frontmatter-breaks.html`
- Create: `test/integration/expected/frontmatter-no-emoji.html`
- Create: `test/integration/expected/breaks.html`
- Create: `test/integration/expected/image.html`

- [ ] **Step 1: 各fixtureのHTMLを手動生成して正規化**

統合テスト環境で各fixtureに対してHTMLコマンドを実行し、生成されたHTMLを正規化してexpectedファイルとして保存する。

以下のヘルパースクリプトを使用してexpectedファイルを生成する（一時的に使用、コミット不要）:

```bash
# 統合テスト環境内で実行する必要がある。
# まずテストを「expected作成モード」で走らせ、生成されたHTMLを正規化して保存する。
# 詳細はStep 2参照。
```

このタスクの具体的な手順: 統合テストのコードにexpectedファイル生成用の一時ロジックを入れるのではなく、**Task 11でテストを追加する際に、最初のテスト実行で生成されたHTMLを正規化してexpectedに保存する**方式をとる。つまり:

1. Task 11でテストコードを追加（assert比較部分は一旦スキップ）
2. テスト実行してHTMLを生成
3. 生成されたHTMLを正規化してexpectedに保存
4. assert比較を有効化してテスト再実行

- [ ] **Step 2: この手順をTask 11と統合して実施する（このタスク自体はスキップ）**

このタスクの実作業はTask 11の中で行う。

---

### Task 11: 統合テスト — HTMLスナップショットテスト追加（4件）

**Files:**
- Modify: `test/integration/extension.test.js:72-80` (HTML_FEATURES array)
- Create: `test/integration/expected/frontmatter-breaks.html`
- Create: `test/integration/expected/frontmatter-no-emoji.html`
- Create: `test/integration/expected/breaks.html`
- Create: `test/integration/expected/image.html`

- [ ] **Step 1: HTML_FEATURES配列にfixture名を追加**

`test/integration/extension.test.js`の`HTML_FEATURES`配列（72-80行目）を修正:

```javascript
const HTML_FEATURES = [
  'plantuml',
  'syntax-highlighting',
  'emoji',
  'checkbox',
  'container',
  'include',
  'mermaid',
  'frontmatter-breaks',
  'frontmatter-no-emoji',
  'breaks',
  'image',
];
```

- [ ] **Step 2: 統合テストを実行してHTMLを生成（初回は失敗する）**

Run: `npm run test:integration`
Expected: 新規4件がexpectedファイル不在でFAIL。ただしfixturesディレクトリにHTMLファイルが生成される。

- [ ] **Step 3: 生成されたHTMLを正規化してexpectedに保存**

テスト内の`normalizeHtml`と同じ正規化をかけてexpectedファイルを作成する:

```bash
node -e "
const fs = require('fs');
const path = require('path');
function normalizeHtml(html) {
  return html
    .replace(/file:\/\/\/[^\s\"'<>]*/g, 'file:///NORMALIZED_PATH')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS');
}
['frontmatter-breaks', 'frontmatter-no-emoji', 'breaks', 'image'].forEach(name => {
  const src = path.join('test/integration/fixtures', name + '.html');
  const dst = path.join('test/integration/expected', name + '.html');
  if (fs.existsSync(src)) {
    fs.writeFileSync(dst, normalizeHtml(fs.readFileSync(src, 'utf-8')));
    fs.unlinkSync(src);
    console.log('Created: ' + dst);
  } else {
    console.log('NOT FOUND: ' + src);
  }
});
"
```

- [ ] **Step 4: 統合テストを再実行して全てパスすることを確認**

Run: `npm run test:integration`
Expected: 全テストPASS（HTML snapshot tests 11件 + Binary 3件）

- [ ] **Step 5: expectedファイルの内容を確認**

各expectedファイルを確認:
- `frontmatter-breaks.html`: `<br>`タグが含まれていること
- `frontmatter-no-emoji.html`: `:smile:`がテキストのまま残っていること（`<img class="emoji"`が含まれていないこと）
- `breaks.html`: `<br>`タグが含まれていないこと
- `image.html`: `<img`タグが3つ含まれていること

- [ ] **Step 6: コミット**

```bash
git add test/integration/extension.test.js test/integration/expected/frontmatter-breaks.html test/integration/expected/frontmatter-no-emoji.html test/integration/expected/breaks.html test/integration/expected/image.html
git commit -m "test: add integration snapshot tests for frontmatter, breaks, and image references"
```

---

### Task 12: 統合テスト — エラーハンドリングテスト追加（2件）

**Files:**
- Modify: `test/integration/extension.test.js` (new suite block at end of file)

- [ ] **Step 1: エラーハンドリングテストスイートを追加**

`test/integration/extension.test.js`の末尾（211行目の`});`の後）に以下を追加:

```javascript
suite('Error Handling Tests', () => {
  test('should not crash when run on a non-markdown file', async function () {
    this.timeout(30000);

    // Create a temporary .txt file
    const txtPath = path.resolve(FIXTURES_DIR, '_error-test.txt');
    fs.writeFileSync(txtPath, 'This is not markdown', 'utf-8');

    try {
      const doc = await vscode.workspace.openTextDocument(txtPath);
      await vscode.window.showTextDocument(doc);

      // Should not throw — the extension shows a warning and returns
      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand('extension.markdown-pdf.html');
      });

      // Wait briefly, then verify no HTML file was generated
      await new Promise(resolve => setTimeout(resolve, 2000));
      const htmlPath = txtPath.replace('.txt', '.html');
      assert.ok(!fs.existsSync(htmlPath), 'HTML file should not be generated for .txt input');
    } finally {
      safeDelete(txtPath);
    }
  });

  test('should not crash when run on an untitled document', async function () {
    this.timeout(30000);

    // Create a new untitled document
    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: '# Untitled' });
    await vscode.window.showTextDocument(doc);

    // Should not throw — the extension shows a warning and returns
    await assert.doesNotReject(async () => {
      await vscode.commands.executeCommand('extension.markdown-pdf.html');
    });

    // Wait briefly — no file should be generated (untitled has no fsPath)
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
});
```

- [ ] **Step 2: 統合テストを実行して全てパスすることを確認**

Run: `npm run test:integration`
Expected: 全テストPASS（Error Handling Tests 2件が追加）

- [ ] **Step 3: コミット**

```bash
git add test/integration/extension.test.js
git commit -m "test: add error handling integration tests (non-markdown file, untitled document)"
```

---

### Task 13: 最終確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全テスト実行**

Run: `npm test`
Expected: ユニットテスト全PASS、統合テスト全PASS

- [ ] **Step 2: テスト件数の確認**

ユニットテスト追加件数の確認:
- convertImgPath: +5件
- resolveHref: +4件
- Slug: +4件
- readFile: +2件
- isExcludeFile: +3件
- buildStyleTags: +3件
- resolveOutputDir: +2件
- 合計: +23件

統合テスト追加件数の確認:
- HTMLスナップショット: +4件
- エラーハンドリング: +2件
- 合計: +6件
