# パス変換系エッジケーステスト追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `utils.js` のパス変換系関数に18件のエッジケーステストを追加する

**Architecture:** 既存の `test/unit/utils.test.js` の各 `describe` ブロックにテストケースを追加する。Windows限定テストは `process.platform` 条件付き。テンポラリファイル/ディレクトリは既存の `before`/`after` パターンを踏襲。

**Tech Stack:** Mocha, Node.js assert, fs, path, os

**Branch:** `feature/edge-case-tests` (develop から作成済み)

---

### Task 1: `convertImgPath()` エッジケース (6件)

**Files:**
- Modify: `test/unit/utils.test.js:197-237` (convertImgPath describe ブロック)

- [ ] **Step 1: スペースを含むパスのテストを追加**

`convertImgPath` の describe ブロック末尾（行237の `});` の前）に追加:

```javascript
    it('should handle path with spaces', function () {
      var result = utils.convertImgPath('my image.png', '/home/user/doc.md');
      assert.strictEqual(result, 'file:///home/user/my image.png');
    });
```

- [ ] **Step 2: `../` を含む相対パスのテストを追加**

```javascript
    it('should resolve ../ in relative path', function () {
      var result = utils.convertImgPath('../../assets/img.png', '/home/user/docs/sub/doc.md');
      assert.strictEqual(result, 'file:///home/assets/img.png');
    });
```

- [ ] **Step 3: data: URL パススルーのテストを追加**

```javascript
    it('should return data: URL unchanged', function () {
      var result = utils.convertImgPath('data:image/png;base64,abc', '/home/user/doc.md');
      assert.strictEqual(result, 'data:image/png;base64,abc');
    });
```

- [ ] **Step 4: 空文字入力のテストを追加**

```javascript
    it('should handle empty string src', function () {
      var path = require('path');
      var result = utils.convertImgPath('', '/home/user/doc.md');
      var expected = 'file://' + path.resolve('/home/user', '');
      assert.strictEqual(result, expected);
    });
```

- [ ] **Step 5: Windows絶対パスのテストを追加**

```javascript
    (process.platform === 'win32' ? it : it.skip)('should handle Windows absolute path', function () {
      var result = utils.convertImgPath('C:\\Users\\img.png', 'C:\\docs\\doc.md');
      assert.strictEqual(result, 'file:///C:/Users/img.png');
    });
```

- [ ] **Step 6: `%20` エンコード済みスペースのテストを追加**

```javascript
    it('should decode %20 encoded spaces in path', function () {
      var result = utils.convertImgPath('my%20image.png', '/home/user/doc.md');
      assert.strictEqual(result, 'file:///home/user/my image.png');
    });
```

- [ ] **Step 7: テスト実行して確認**

Run: `npx mocha test/unit/utils.test.js --grep "convertImgPath"`
Expected: 既存8件 + 新規6件 = 14件 PASS (Windows限定テストはLinuxでskip)

- [ ] **Step 8: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add convertImgPath edge case tests for spaces, ../, data: URL, empty string, Windows path, %20 encoding"
```

---

### Task 2: `resolveHref()` エッジケース (5件)

**Files:**
- Modify: `test/unit/utils.test.js:261-311` (resolveHref describe ブロック)

- [ ] **Step 1: `../` 付きワークスペース相対パスのテストを追加**

`resolveHref` の describe ブロック末尾（行311の `});` の前）に追加:

```javascript
    it('should resolve ../ in workspace-relative path', function () {
      var path = require('path');
      var result = utils.resolveHref('../styles/custom.css', '/home/user/doc.md', false, '/workspace');
      assert.strictEqual(result, 'file://' + path.join('/workspace', '../styles/custom.css'));
    });
```

- [ ] **Step 2: `../` 付きファイル相対パスのテストを追加**

```javascript
    it('should resolve ../ in file-relative path', function () {
      var result = utils.resolveHref('../styles/custom.css', '/home/user/doc.md', true, '/workspace');
      assert.strictEqual(result, 'file:///home/styles/custom.css');
    });
```

- [ ] **Step 3: data: URL パススルーのテストを追加**

```javascript
    it('should return data: URL unchanged', function () {
      var result = utils.resolveHref('data:text/css;base64,abc', '/home/user/doc.md', false, '/workspace');
      assert.strictEqual(result, 'data:text/css;base64,abc');
    });
```

- [ ] **Step 4: スペースを含む相対パスのテストを追加**

```javascript
    it('should handle relative path with spaces', function () {
      var result = utils.resolveHref('my styles/custom.css', '/home/user/doc.md', false, '/workspace');
      assert.strictEqual(result, 'file:///workspace/my styles/custom.css');
    });
```

- [ ] **Step 5: Windows絶対パスのテストを追加**

```javascript
    (process.platform === 'win32' ? it : it.skip)('should handle Windows absolute path', function () {
      var result = utils.resolveHref('C:\\styles\\custom.css', 'C:\\docs\\doc.md', false, 'C:\\workspace');
      assert.strictEqual(result, 'file://C:\\styles\\custom.css');
    });
```

- [ ] **Step 6: テスト実行して確認**

Run: `npx mocha test/unit/utils.test.js --grep "resolveHref"`
Expected: 既存8件 + 新規5件 = 13件 PASS (Windows限定テストはLinuxでskip)

- [ ] **Step 7: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add resolveHref edge cases for ../ paths, data: URL, spaces, Windows path"
```

---

### Task 3: `resolveOutputDir()` エッジケース (4件)

**Files:**
- Modify: `test/unit/utils.test.js:313-361` (resolveOutputDir describe ブロック)

- [ ] **Step 1: スペースを含む相対パスのテストを追加**

`resolveOutputDir` の describe ブロック末尾（行361の `});` の前）に追加:

```javascript
    it('should handle relative path with spaces', function () {
      var path = require('path');
      var result = utils.resolveOutputDir('/home/user/doc.pdf', 'my output', false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join('/workspace', 'my output', 'doc.pdf'));
    });
```

- [ ] **Step 2: `../` を含む相対パスのテストを追加**

```javascript
    it('should handle relative path with ../', function () {
      var path = require('path');
      var result = utils.resolveOutputDir('/home/user/doc.pdf', '../build', false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join('/workspace', '../build', 'doc.pdf'));
    });
```

- [ ] **Step 3: スペースを含む絶対パスのテストを追加**

既存の `before`/`after` ブロック内に、スペース入りサブディレクトリの作成を追加する。

`before` フック（行319-321）を修正:

```javascript
    before(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpdf-test-'));
      spaceDir = path.join(tmpDir, 'my output');
      fs.mkdirSync(spaceDir);
    });
```

`after` フック（行323-325）はそのまま（`recursive: true` で `spaceDir` も削除される）。

`var tmpDir;` の直後に `var spaceDir;` を追加。

テストケース:

```javascript
    it('should handle absolute path with spaces', function () {
      var result = utils.resolveOutputDir('/home/user/doc.pdf', spaceDir, false, '/home/user/doc.md', '/workspace');
      assert.strictEqual(result, path.join(spaceDir, 'doc.pdf'));
    });
```

- [ ] **Step 4: Windows絶対パスのテストを追加**

```javascript
    (process.platform === 'win32' ? it : it.skip)('should handle Windows absolute path', function () {
      // Note: requires C:\output to exist on Windows
      var result = utils.resolveOutputDir('C:\\docs\\doc.pdf', 'build', false, 'C:\\docs\\doc.md', 'C:\\workspace');
      assert.strictEqual(result, path.join('C:\\workspace', 'build', 'doc.pdf'));
    });
```

- [ ] **Step 5: テスト実行して確認**

Run: `npx mocha test/unit/utils.test.js --grep "resolveOutputDir"`
Expected: 既存7件 + 新規4件 = 11件 PASS (Windows限定テストはLinuxでskip)

- [ ] **Step 6: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add resolveOutputDir edge cases for spaces, ../, Windows path"
```

---

### Task 4: `readFile()` エッジケース (3件)

**Files:**
- Modify: `test/unit/utils.test.js:131-169` (readFile describe ブロック)

- [ ] **Step 1: テンポラリファイルのセットアップを拡張**

既存の `before` フック（行136-139）を修正して、スペース入りファイルも作成:

```javascript
    before(function () {
      tmpFile = path.join(__dirname, 'test-read-file.tmp');
      fs.writeFileSync(tmpFile, 'hello world', 'utf-8');
      tmpFileWithSpace = path.join(__dirname, 'test read file.tmp');
      fs.writeFileSync(tmpFileWithSpace, 'space content', 'utf-8');
    });
```

既存の `after` フック（行141-145）を修正:

```javascript
    after(function () {
      [tmpFile, tmpFileWithSpace].forEach(function (f) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    });
```

`var tmpFile;` の直後に `var tmpFileWithSpace;` を追加。

- [ ] **Step 2: スペースを含むファイルパスのテストを追加**

`readFile` の describe ブロック末尾（行169の `});` の前）に追加:

```javascript
    it('should read file with spaces in path', function () {
      assert.strictEqual(utils.readFile(tmpFileWithSpace), 'space content');
    });
```

- [ ] **Step 3: `file://` + スペースを含むパスのテストを追加**

```javascript
    it('should handle file:// prefix with spaces in path', function () {
      var result = utils.readFile('file://' + tmpFileWithSpace);
      assert.strictEqual(result, 'space content');
    });
```

- [ ] **Step 4: Windows `file:///C:/` 形式のテストを追加**

```javascript
    (process.platform === 'win32' ? it : it.skip)('should handle file:///C:/ prefix on Windows', function () {
      var winTmpFile = path.join(os.tmpdir(), 'mdpdf-test-win.tmp');
      fs.writeFileSync(winTmpFile, 'win content', 'utf-8');
      try {
        var result = utils.readFile('file:///' + winTmpFile.replace(/\\/g, '/'));
        assert.strictEqual(result, 'win content');
      } finally {
        if (fs.existsSync(winTmpFile)) fs.unlinkSync(winTmpFile);
      }
    });
```

- [ ] **Step 5: テスト実行して確認**

Run: `npx mocha test/unit/utils.test.js --grep "readFile"`
Expected: 既存5件 + 新規3件 = 8件 PASS (Windows限定テストはLinuxでskip)

- [ ] **Step 6: コミット**

```bash
git add test/unit/utils.test.js
git commit -m "test: add readFile edge cases for spaces in path, file:// with spaces, Windows file URI"
```

---

### Task 5: 全テスト実行と最終確認

**Files:**
- なし（実行のみ）

- [ ] **Step 1: 全ユニットテスト実行**

Run: `npx mocha test/unit/utils.test.js`
Expected: 既存41件 + 新規18件 = 59件 PASS (Windows限定テスト4件はLinuxでskip → 55 passing, 4 pending)

- [ ] **Step 2: 結果を確認**

- 55 passing
- 4 pending (Windows限定テスト)
- 0 failing
