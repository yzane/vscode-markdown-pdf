# utils.js パス解決系テスト深掘り Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/utils.js` の `resolveHref` と `resolveOutputDir` に対して、解決基準の切り替え規則を読み取れるユニットテストを追加し、回帰を防ぐ。

**Architecture:** 実装本体は変更せず、既存の `test/unit/utils.test.js` にケースを追加して現行挙動を仕様として固定する。テストは入力の種類ごとではなく、workspace 基準、ファイル基準、フォールバック、正規化という解決規則ごとに並べ替え、期待値は `path.join` や `os.homedir()` で組み立てる。

**Tech Stack:** Node.js, Mocha, assert, path, os

---

### Task 1: `resolveHref` の解決規則をテストで固定する

**Files:**
- Modify: `test/unit/utils.test.js`
- Test: `test/unit/utils.test.js`

- [ ] **Step 1: `resolveHref` セクションを規則順に並べ直し、不足ケースを追加する**

```javascript
  describe('resolveHref', function () {
    var os = require('os');

    it('should return empty string for empty href', function () {
      assert.strictEqual(utils.resolveHref('', '/home/user/doc.md', false, '/workspace'), '');
    });

    it('should return undefined for undefined href', function () {
      assert.strictEqual(utils.resolveHref(undefined, '/home/user/doc.md', false, '/workspace'), undefined);
    });

    it('should return null for null href', function () {
      assert.strictEqual(utils.resolveHref(null, '/home/user/doc.md', false, '/workspace'), null);
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
      assert.strictEqual(
        utils.resolveHref('~/styles/custom.css', '/home/user/doc.md', false, '/workspace'),
        'file://' + os.homedir() + '/styles/custom.css'
      );
    });

    it('should convert absolute path to file URI', function () {
      assert.strictEqual(
        utils.resolveHref('/etc/styles/custom.css', '/home/user/doc.md', false, '/workspace'),
        'file:///etc/styles/custom.css'
      );
    });

    it('should resolve workspace-relative path when stylesRelativePathFile is false', function () {
      assert.strictEqual(
        utils.resolveHref('assets/style.css', '/home/user/doc.md', false, '/workspace'),
        'file://' + path.join('/workspace', 'assets/style.css')
      );
    });

    it('should resolve file-relative path when stylesRelativePathFile is true', function () {
      assert.strictEqual(
        utils.resolveHref('assets/style.css', '/home/user/doc.md', true, '/workspace'),
        'file://' + path.join('/home/user', 'assets/style.css')
      );
    });

    it('should resolve file-relative path when no workspace is available', function () {
      assert.strictEqual(
        utils.resolveHref('assets/style.css', '/home/user/doc.md', false, undefined),
        'file://' + path.join('/home/user', 'assets/style.css')
      );
    });

    it('should normalize parent segments when resolving from workspace', function () {
      assert.strictEqual(
        utils.resolveHref('../styles/custom.css', '/home/user/doc.md', false, '/workspace'),
        'file://' + path.join('/workspace', '../styles/custom.css')
      );
    });

    it('should normalize parent segments when resolving from markdown file', function () {
      assert.strictEqual(
        utils.resolveHref('../styles/custom.css', '/home/user/doc.md', true, '/workspace'),
        'file://' + path.join('/home/user', '../styles/custom.css')
      );
    });

    it('should keep current behavior for data URIs and resolve them as workspace-relative paths', function () {
      assert.strictEqual(
        utils.resolveHref('data:text/css;base64,abc', '/home/user/doc.md', false, '/workspace'),
        'file://' + path.join('/workspace', 'data:text/css;base64,abc')
      );
    });

    it('should preserve spaces in workspace-relative paths', function () {
      assert.strictEqual(
        utils.resolveHref('my styles/custom.css', '/home/user/doc.md', false, '/workspace'),
        'file://' + path.join('/workspace', 'my styles/custom.css')
      );
    });
  });
```

- [ ] **Step 2: `resolveHref` のみ実行して追加ケースが失敗することを確認する**

Run: `npx mocha test/unit/utils.test.js --grep "resolveHref"`
Expected: FAIL もしくは、並び替えだけなら既存の期待値差分が見えて未調整ケースが分かる

- [ ] **Step 3: 失敗内容に合わせて期待値とケース配置を最小修正する**

```javascript
    it('should normalize parent segments when resolving from markdown file', function () {
      assert.strictEqual(
        utils.resolveHref('../styles/custom.css', '/home/user/doc.md', true, '/workspace'),
        'file://' + path.join('/home/user', '../styles/custom.css')
      );
    });
```

- [ ] **Step 4: `resolveHref` セクションが通ることを確認する**

Run: `npx mocha test/unit/utils.test.js --grep "resolveHref"`
Expected: PASS with all `resolveHref` tests green

- [ ] **Step 5: コミットする**

```bash
git add test/unit/utils.test.js
git commit -m "test: deepen resolveHref path coverage"
```

### Task 2: `resolveOutputDir` の解決規則をテストで固定する

**Files:**
- Modify: `test/unit/utils.test.js`
- Test: `test/unit/utils.test.js`

- [ ] **Step 1: `resolveOutputDir` セクションを規則順に並べ直し、不足ケースを追加する**

```javascript
  describe('resolveOutputDir', function () {
    var path = require('path');
    var fs = require('fs');
    var os = require('os');
    var tmpDir;
    var spaceDir;

    before(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpdf-test-'));
      spaceDir = path.join(tmpDir, 'my output');
      fs.mkdirSync(spaceDir);
    });

    after(function () {
      fs.rmSync(tmpDir, { recursive: true });
    });

    it('should return filename when outputDirectory is empty', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '', false, '/home/user/doc.md', '/workspace'),
        '/home/user/doc.pdf'
      );
    });

    it('should return filename when outputDirectory is null', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', null, false, '/home/user/doc.md', '/workspace'),
        '/home/user/doc.pdf'
      );
    });

    it('should return filename when outputDirectory is undefined', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', undefined, false, '/home/user/doc.md', '/workspace'),
        '/home/user/doc.pdf'
      );
    });

    it('should expand ~ to home directory', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '~/output', false, '/home/user/doc.md', '/workspace'),
        path.join(os.homedir(), 'output', 'doc.pdf')
      );
    });

    it('should use absolute path when directory exists', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', tmpDir, false, '/home/user/doc.md', '/workspace'),
        path.join(tmpDir, 'doc.pdf')
      );
    });

    it('should return null when absolute directory does not exist', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '/nonexistent/output', false, '/home/user/doc.md', '/workspace'),
        null
      );
    });

    it('should resolve workspace-relative output paths when outputDirectoryRelativePathFile is false', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'build', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', 'build', 'doc.pdf')
      );
    });

    it('should resolve file-relative output paths when outputDirectoryRelativePathFile is true', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'build', true, '/home/user/doc.md', '/workspace'),
        path.join('/home/user', 'build', 'doc.pdf')
      );
    });

    it('should resolve file-relative output paths when no workspace is available', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'build', false, '/home/user/doc.md', undefined),
        path.join('/home/user', 'build', 'doc.pdf')
      );
    });

    it('should preserve spaces in workspace-relative output paths', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'my output', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', 'my output', 'doc.pdf')
      );
    });

    it('should normalize parent segments in workspace-relative output paths', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '../build', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', '../build', 'doc.pdf')
      );
    });

    it('should use existing absolute paths even when they contain spaces', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', spaceDir, false, '/home/user/doc.md', '/workspace'),
        path.join(spaceDir, 'doc.pdf')
      );
    });
  });
```

- [ ] **Step 2: `resolveOutputDir` のみ実行して追加ケースが失敗することを確認する**

Run: `npx mocha test/unit/utils.test.js --grep "resolveOutputDir"`
Expected: FAIL もしくは、既存ケースとの差分が出て調整箇所が分かる

- [ ] **Step 3: 失敗内容に合わせて期待値とケース配置を最小修正する**

```javascript
    it('should normalize parent segments in workspace-relative output paths', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '../build', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', '../build', 'doc.pdf')
      );
    });
```

- [ ] **Step 4: `resolveOutputDir` セクションが通ることを確認する**

Run: `npx mocha test/unit/utils.test.js --grep "resolveOutputDir"`
Expected: PASS with all `resolveOutputDir` tests green

- [ ] **Step 5: コミットする**

```bash
git add test/unit/utils.test.js
git commit -m "test: deepen resolveOutputDir path coverage"
```

### Task 3: 単体テスト全体で回帰がないことを確認する

**Files:**
- Modify: `test/unit/utils.test.js`
- Test: `test/unit/utils.test.js`

- [ ] **Step 1: 単体テスト全体を実行する**

Run: `npm run test:unit`
Expected: PASS with `test/unit/**/*.test.js`

- [ ] **Step 2: 必要なら失敗箇所だけを再実行して調整する**

Run: `npx mocha test/unit/utils.test.js`
Expected: PASS after resolving any assertion mismatches introduced by reordering or new cases

- [ ] **Step 3: 最終コミットを作る**

```bash
git add test/unit/utils.test.js
git commit -m "test: deepen utils path resolution coverage"
```
