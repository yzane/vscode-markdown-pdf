# クロスプラットフォーム対応ユニットテスト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows 11 で `npm run test:unit` が失敗する 18 件を、実装を変更せずテストのみクロスプラットフォーム対応にして両 OS で全パスさせる。

**Architecture:** 「絶対パス→file URI」の OS 依存部分を Node 標準 `pathToFileURL` に委譲する共有ヘルパ `fileUri()` を新設し、file URI 系テストの期待値を導出する。`resolveHref` 系は `'file://' + path.join(...)`、プレーンパス系は `path.join(...)` で期待値を導出する。入力の POSIX リテラルは変更しない。

**Tech Stack:** TypeScript, `node:test`（`tsx --test`）, `node:path`, `node:url`

**作業ブランチ:** `bugfix/cross-platform-unit-tests`（worktree `.worktrees/cross-platform-unit-tests`）。全タスクはこのブランチ上で実施し、ブランチを離れない。

**設計書:** `docs/superpowers/specs/20260607-01-cross-platform-unit-tests-design.md`

**前提（検証済み）:** 本環境（Windows）で `fileUri(path.resolve(dir, decodeURIComponent(rel)))` が `utils.convertImgPath(rel, filename)` の出力と全ケースで一致すること、`resolveHref` 系が `'file://' + path.join(...)` と一致すること、`resolveReadmePreviewExportPath` が `path.join(...)` と一致することを確認済み。

> **コマンド実行ディレクトリ:** 特記なき限り、すべて worktree ルート `C:\work\github\yzane\vscode-markdown-pdf\.worktrees\cross-platform-unit-tests` で実行する。worktree に `node_modules` が無い場合は、最初に一度だけ `npm install` を実行する（下記 Task 0）。

---

## File Structure

- **Create:** `test/unit/helpers/path-platform.ts` — テスト支援ヘルパ。`fileUri(absPath)` のみを公開（単一責務）。`*.test.ts` ではないため `tsx --test` のテスト対象には含まれない。
- **Modify:** `test/unit/utils.test.ts` — `convertImgPath`（7 件）・`resolveHref`（1 件）・`transformHtmlBlock`（8 件）の期待値修正。先頭に `fileUri` の import を追加。
- **Modify:** `test/unit/readme-previews.test.ts` — `resolveReadmePreviewExportPath`（2 件）の期待値修正。先頭に `import path from 'path';` を追加。

**触らない:** `src/` 配下の実装、`process.platform === 'win32'` ガード済みテスト、integration テスト。

---

## Task 0: 環境準備（git preflight・依存導入・ベースライン）

**Files:** なし（環境確認のみ）

- [ ] **Step 1: worktree で git が動作するか preflight 確認**

Run: `git status`
Expected: 通常の status 出力。
- もし `fatal: detected dubious ownership in repository ...` で失敗する場合（実行ユーザーが worktree 所有者と異なる Codex/CI 等の環境）、次を実行してから再度 `git status`:
  `git config --global --add safe.directory "C:/work/github/yzane/vscode-markdown-pdf/.worktrees/cross-platform-unit-tests"`
  さらに共有元リポジトリ参照のため、必要なら本体パスも追加:
  `git config --global --add safe.directory "C:/work/github/yzane/vscode-markdown-pdf"`
  Expected: 再実行で `git status` が成功する。
- 現在のブランチが `bugfix/cross-platform-unit-tests` であることを `git branch --show-current` で確認（このブランチから離れない）。

- [ ] **Step 2: 設計書・計画書がコミット済みであることを確認（未コミットならコミット）**

Run: `git status --short -- docs/superpowers`
Expected: 出力なし（設計書 `docs/superpowers/specs/20260607-01-cross-platform-unit-tests-design.md` と本計画 `docs/superpowers/plans/20260607-01-cross-platform-unit-tests.md` は既にコミット済み）。
- もし未追跡/未コミットの差分が出る場合は、テスト修正に入る前にコミットする:
  ```bash
  git add docs/superpowers/specs/20260607-01-cross-platform-unit-tests-design.md docs/superpowers/plans/20260607-01-cross-platform-unit-tests.md
  git commit -m "docs(superpowers): クロスプラットフォーム対応ユニットテストの設計書・実装計画"
  ```
- 念のため `git log --oneline develop..HEAD` に設計書・計画のコミットが含まれることを確認。Task 6 の最終ログ期待（docs + ヘルパ + テスト修正が並ぶ）と整合させるため。

- [ ] **Step 3: worktree に依存が入っているか確認**

Run: `npm ls tsx`
Expected: tsx のバージョンが表示される。`(empty)` や `npm error` の場合は次のステップで install。

- [ ] **Step 4: 必要なら依存をインストール**

Run: `npm install`
Expected: 正常終了（既に入っていれば up to date）。

- [ ] **Step 5: 現状の失敗を確認（ベースライン）**

Run: `npm run test:unit`
Expected: FAIL。18 件が `✖` で失敗する（`file:///C:/...` 対 `file:///...` 等の差分）。これが修正対象のベースライン。

---

## Task 1: 共有ヘルパ `fileUri` を作成

**Files:**
- Create: `test/unit/helpers/path-platform.ts`

- [ ] **Step 1: ヘルパファイルを作成**

`test/unit/helpers/path-platform.ts`:

```ts
import { pathToFileURL } from 'node:url';

/**
 * Converts an absolute filesystem path to the project's file URI contract,
 * in an OS-independent way.
 *
 * OS-dependent parts (drive letter, slash direction) are delegated to Node's
 * pathToFileURL. The project-specific contract is then applied as a thin layer:
 * spaces and unicode are kept literal (decoded), and '#' is escaped as %23.
 *
 * On POSIX, pathToFileURL still percent-encodes spaces/unicode; decodeURIComponent
 * cancels that encoding (round-trip), so the result equals the original POSIX
 * literal (e.g. '/home/user/x.png' -> 'file:///home/user/x.png').
 */
export function fileUri(absPath: string): string {
  return decodeURIComponent(pathToFileURL(absPath).href).replace(/#/g, '%23');
}
```

- [ ] **Step 2: ヘルパが import できることを確認（一時スクリプト）**

Run（worktree ルートで）:
`node node_modules/tsx/dist/cli.mjs -e "import('./test/unit/helpers/path-platform.ts').then(m => console.log(m.fileUri('/doc/real.png')))"`
Expected: Windows では `file:///C:/doc/real.png`、POSIX では `file:///doc/real.png` が出力される。

> 補足: ヘルパは次タスク以降のテストで実利用するため、専用テストは追加しない（テスト支援コード）。

- [ ] **Step 3: コミット**

```bash
git add test/unit/helpers/path-platform.ts
git commit -m "test: クロスプラットフォーム file URI ヘルパ fileUri を追加"
```

---

## Task 2: `utils.test.ts` に import 追加 & `convertImgPath`（7 件）を修正

**Files:**
- Modify: `test/unit/utils.test.ts`（先頭の import 群、および `convertImgPath` describe ブロック）

- [ ] **Step 1: import を追加**

`test/unit/utils.test.ts` 先頭（`import * as utils from '../../src/utils';` の直後）に追加:

```ts
import { fileUri } from './helpers/path-platform';
```

- [ ] **Step 2: 7 件の期待値を `fileUri(path.resolve(...))` へ置換**

以下を該当行で置換する（左=before / 右=after）。`path` は既に `import path from 'path';` 済み。

`should convert a relative path to a file URI`:
```ts
// before
assert.strictEqual(utils.convertImgPath('image.png', '/home/user/doc.md'), 'file:///home/user/image.png');
// after
assert.strictEqual(utils.convertImgPath('image.png', '/home/user/doc.md'), fileUri(path.resolve('/home/user', 'image.png')));
```

`should convert an absolute path to a file URI`:
```ts
// before
assert.strictEqual(utils.convertImgPath('/images/photo.png', '/home/user/doc.md'), 'file:///images/photo.png');
// after
assert.strictEqual(utils.convertImgPath('/images/photo.png', '/home/user/doc.md'), fileUri(path.resolve('/images/photo.png')));
```

`should handle path with spaces`:
```ts
// before
assert.strictEqual(utils.convertImgPath('my image.png', '/home/user/doc.md'), 'file:///home/user/my image.png');
// after
assert.strictEqual(utils.convertImgPath('my image.png', '/home/user/doc.md'), fileUri(path.resolve('/home/user', 'my image.png')));
```

`should resolve ../ in relative path`:
```ts
// before
assert.strictEqual(utils.convertImgPath('../../assets/img.png', '/home/user/docs/sub/doc.md'), 'file:///home/user/assets/img.png');
// after
assert.strictEqual(utils.convertImgPath('../../assets/img.png', '/home/user/docs/sub/doc.md'), fileUri(path.resolve('/home/user/docs/sub', '../../assets/img.png')));
```

`should handle empty string src`（ローカルの `const path = require('path');` を削除し、トップレベル `path` を使う）:
```ts
// before
it('should handle empty string src', function () {
  const path = require('path');
  const expected = 'file://' + path.resolve('/home/user', '');
  assert.strictEqual(utils.convertImgPath('', '/home/user/doc.md'), expected);
});
// after
it('should handle empty string src', function () {
  assert.strictEqual(utils.convertImgPath('', '/home/user/doc.md'), fileUri(path.resolve('/home/user', '')));
});
```

`should decode %20 encoded spaces in path`:
```ts
// before
assert.strictEqual(utils.convertImgPath('my%20image.png', '/home/user/doc.md'), 'file:///home/user/my image.png');
// after
assert.strictEqual(utils.convertImgPath('my%20image.png', '/home/user/doc.md'), fileUri(path.resolve('/home/user', 'my image.png')));
```

`should convert Unicode relative path to file URI`:
```ts
// before
assert.strictEqual(utils.convertImgPath('画像/テスト.png', '/home/user/doc.md'), 'file:///home/user/画像/テスト.png');
// after
assert.strictEqual(utils.convertImgPath('画像/テスト.png', '/home/user/doc.md'), fileUri(path.resolve('/home/user', '画像/テスト.png')));
```

- [ ] **Step 3: convertImgPath のテストを実行してパスを確認**

Run: `node node_modules/tsx/dist/cli.mjs --test --test-name-pattern="convertImgPath" test/unit/utils.test.ts`
Expected: PASS。`convertImgPath` 配下が全て `✔`、失敗 0。

- [ ] **Step 4: コミット**

```bash
git add test/unit/utils.test.ts
git commit -m "test: convertImgPath の期待値を fileUri で導出しクロスプラットフォーム化"
```

---

## Task 3: `resolveHref`（1 件）を修正

**Files:**
- Modify: `test/unit/utils.test.ts`（`resolveHref` describe ブロックの `should handle relative path with spaces`）

- [ ] **Step 1: 期待値を `'file://' + path.join(...)` へ置換**

`resolveHref` ブロックの `should handle relative path with spaces`（隣接テストと同形に揃える。`fileUri` は使わない）:
```ts
// before
it('should handle relative path with spaces', function () {
  assert.strictEqual(
    utils.resolveHref('my styles/custom.css', '/home/user/doc.md', false, '/workspace'),
    'file:///workspace/my styles/custom.css'
  );
});
// after
it('should handle relative path with spaces', function () {
  assert.strictEqual(
    utils.resolveHref('my styles/custom.css', '/home/user/doc.md', false, '/workspace'),
    'file://' + path.join('/workspace', 'my styles/custom.css')
  );
});
```

- [ ] **Step 2: resolveHref のテストを実行してパスを確認**

Run: `node node_modules/tsx/dist/cli.mjs --test --test-name-pattern="resolveHref" test/unit/utils.test.ts`
Expected: PASS。`resolveHref` 配下が全て `✔`、失敗 0。

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.ts
git commit -m "test: resolveHref の空白パス期待値を path.join 導出に修正"
```

---

## Task 4: `transformHtmlBlock`（8 件）を修正

**Files:**
- Modify: `test/unit/utils.test.ts`（`transformHtmlBlock` describe ブロック）

> すべて filename は `/doc/test.md`（dir = `/doc`）。`fileUri(path.resolve('/doc', '<name>'))` で URI を生成する。

- [ ] **Step 1: 8 件の期待値を置換**

`should rewrite the real src attribute and preserve data-src`:
```ts
// before
it('should rewrite the real src attribute and preserve data-src', function () {
  const result = utils.transformHtmlBlock('<img data-src="lazy.png" src="real.png">', '/doc/test.md');
  assert.ok(result.indexOf('data-src="lazy.png"') >= 0);
  assert.ok(result.indexOf('src="file:///doc/real.png"') >= 0);
  assert.ok(result.indexOf('data-src="lazy.png" src="file:///doc/real.png"') >= 0);
});
// after
it('should rewrite the real src attribute and preserve data-src', function () {
  const result = utils.transformHtmlBlock('<img data-src="lazy.png" src="real.png">', '/doc/test.md');
  const realUri = fileUri(path.resolve('/doc', 'real.png'));
  assert.ok(result.indexOf('data-src="lazy.png"') >= 0);
  assert.ok(result.indexOf('src="' + realUri + '"') >= 0);
  assert.ok(result.indexOf('data-src="lazy.png" src="' + realUri + '"') >= 0);
});
```

`should handle spacing around src equals`:
```ts
// before
const result = utils.transformHtmlBlock('<img src = "photo.png">', '/doc/test.md');
assert.strictEqual(result, '<img src = "file:///doc/photo.png">');
// after
const result = utils.transformHtmlBlock('<img src = "photo.png">', '/doc/test.md');
assert.strictEqual(result, '<img src = "' + fileUri(path.resolve('/doc', 'photo.png')) + '">');
```

`should handle unquoted src attributes`:
```ts
// before
const result = utils.transformHtmlBlock('<img src=photo.png>', '/doc/test.md');
assert.ok(result.indexOf('src="file:///doc/photo.png"') >= 0);
// after
const result = utils.transformHtmlBlock('<img src=photo.png>', '/doc/test.md');
assert.ok(result.indexOf('src="' + fileUri(path.resolve('/doc', 'photo.png')) + '"') >= 0);
```

`should handle multiple images with mixed attribute ordering`:
```ts
// before
const result = utils.transformHtmlBlock(
  '<img data-src="lazy.png" src="real.png"><img alt="desc" src = "photo.png">',
  '/doc/test.md',
);
assert.strictEqual(
  result,
  '<img data-src="lazy.png" src="file:///doc/real.png"><img alt="desc" src = "file:///doc/photo.png">',
);
// after
const result = utils.transformHtmlBlock(
  '<img data-src="lazy.png" src="real.png"><img alt="desc" src = "photo.png">',
  '/doc/test.md',
);
const realUri = fileUri(path.resolve('/doc', 'real.png'));
const photoUri = fileUri(path.resolve('/doc', 'photo.png'));
assert.strictEqual(
  result,
  '<img data-src="lazy.png" src="' + realUri + '"><img alt="desc" src = "' + photoUri + '">',
);
```

`should handle img tags with other attributes`:
```ts
// before
const result = utils.transformHtmlBlock('<img alt="desc" src="photo.png" width="100">', '/doc/test.md');
assert.ok(result.indexOf('alt="desc"') >= 0);
assert.ok(result.indexOf('width="100"') >= 0);
assert.ok(result.indexOf('src="file:///doc/photo.png"') >= 0);
// after
const result = utils.transformHtmlBlock('<img alt="desc" src="photo.png" width="100">', '/doc/test.md');
assert.ok(result.indexOf('alt="desc"') >= 0);
assert.ok(result.indexOf('width="100"') >= 0);
assert.ok(result.indexOf('src="' + fileUri(path.resolve('/doc', 'photo.png')) + '"') >= 0);
```

`should handle quotes that contain a greater-than sign`:
```ts
// before
const result = utils.transformHtmlBlock('<img alt="a > b" src="photo.png">', '/doc/test.md');
assert.ok(result.indexOf('alt="a > b"') >= 0);
assert.ok(result.indexOf('src="file:///doc/photo.png"') >= 0);
// after
const result = utils.transformHtmlBlock('<img alt="a > b" src="photo.png">', '/doc/test.md');
assert.ok(result.indexOf('alt="a > b"') >= 0);
assert.ok(result.indexOf('src="' + fileUri(path.resolve('/doc', 'photo.png')) + '"') >= 0);
```

`should preserve quoted non-src attributes that contain src text`:
```ts
// before
const result = utils.transformHtmlBlock('<img alt="look src=bad.png" src="real.png">', '/doc/test.md');
assert.strictEqual(result, '<img alt="look src=bad.png" src="file:///doc/real.png">');
// after
const result = utils.transformHtmlBlock('<img alt="look src=bad.png" src="real.png">', '/doc/test.md');
assert.strictEqual(result, '<img alt="look src=bad.png" src="' + fileUri(path.resolve('/doc', 'real.png')) + '">');
```

`should handle whitespace before the closing raw-text tag`:
```ts
// before
const result = utils.transformHtmlBlock('<script>const html = "<img src=x.png>";</script ><img src=real.png>', '/doc/test.md');
assert.strictEqual(result, '<script>const html = "<img src=x.png>";</script ><img src="file:///doc/real.png">');
// after
const result = utils.transformHtmlBlock('<script>const html = "<img src=x.png>";</script ><img src=real.png>', '/doc/test.md');
assert.strictEqual(result, '<script>const html = "<img src=x.png>";</script ><img src="' + fileUri(path.resolve('/doc', 'real.png')) + '">');
```

- [ ] **Step 2: transformHtmlBlock のテストを実行してパスを確認**

Run: `node node_modules/tsx/dist/cli.mjs --test --test-name-pattern="transformHtmlBlock" test/unit/utils.test.ts`
Expected: PASS。`transformHtmlBlock` 配下が全て `✔`、失敗 0。

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.ts
git commit -m "test: transformHtmlBlock の期待値を fileUri で導出しクロスプラットフォーム化"
```

---

## Task 5: `readme-previews.test.ts`（2 件）を修正

**Files:**
- Modify: `test/unit/readme-previews.test.ts`（先頭の import、`resolveReadmePreviewExportPath` の 2 テスト）

- [ ] **Step 1: `path` の import を追加**

`test/unit/readme-previews.test.ts` 先頭の `import assert from 'assert';` の直後に追加:

```ts
import path from 'path';
```

- [ ] **Step 2: 2 件の期待値を `path.join(...)` へ置換**

`resolveReadmePreviewExportPath should use workspace-relative output when workspace exists`:
```ts
// before
assert.strictEqual(
  resolveReadmePreviewExportPath('/tmp/PlantUML.png', '/tmp/PlantUML.md', 'sample', false, '/workspace'),
  '/workspace/sample/PlantUML.png'
);
// after
assert.strictEqual(
  resolveReadmePreviewExportPath('/tmp/PlantUML.png', '/tmp/PlantUML.md', 'sample', false, '/workspace'),
  path.join('/workspace', 'sample', 'PlantUML.png')
);
```

`resolveReadmePreviewExportPath should fall back to file-relative output without a workspace`:
```ts
// before
assert.strictEqual(
  resolveReadmePreviewExportPath('/tmp/PlantUML.png', '/tmp/PlantUML.md', 'sample', false, undefined),
  '/tmp/sample/PlantUML.png'
);
// after
assert.strictEqual(
  resolveReadmePreviewExportPath('/tmp/PlantUML.png', '/tmp/PlantUML.md', 'sample', false, undefined),
  path.join('/tmp', 'sample', 'PlantUML.png')
);
```

- [ ] **Step 3: readme-previews のテストを実行してパスを確認**

Run: `node node_modules/tsx/dist/cli.mjs --test --test-name-pattern="resolveReadmePreviewExportPath" test/unit/readme-previews.test.ts`
Expected: PASS。該当 2 件が `✔`、失敗 0。

- [ ] **Step 4: コミット**

```bash
git add test/unit/readme-previews.test.ts
git commit -m "test: resolveReadmePreviewExportPath の期待値を path.join 導出に修正"
```

---

## Task 6: 全体検証と最終確認

**Files:** なし（検証のみ）

- [ ] **Step 1: ユニットテスト全体を実行（主要成功条件）**

Run: `npm run test:unit`
Expected: PASS。失敗 0（ベースラインの 18 件失敗が解消）。

- [ ] **Step 2: `src/` が未変更であることを確認**

Run: `git diff develop --stat -- src`
Expected: 出力なし（`src/` に差分なし。変更はテストとヘルパとドキュメントのみ）。

- [ ] **Step 3: `npm run test` 全体を実行（副次確認）**

Run: `npm run test`
Expected: `test:unit` が PASS。続く `test:integration`（`vscode-test`）は VS Code バイナリ取得・Electron 実行を伴うため、環境によっては起動・完走しないことがある。
- 完走した場合: integration も PASS することを確認。
- 環境要因で走らない/失敗する場合: 「ユニットは全パス、integration は環境要因で未検証」と記録し、設計書のスコープ通り integration テスト自体は変更しない。

- [ ] **Step 4: 最終状態の確認**

Run: `git log --oneline develop..HEAD`
Expected: 設計書・本計画・ヘルパ追加・各テスト修正のコミットが並ぶ。作業ブランチは `bugfix/cross-platform-unit-tests` のまま。

---

## Self-Review 結果（計画作成者による確認）

- **Spec coverage:** 設計書の失敗内訳（convertImgPath 7 / resolveHref 1 / transformHtmlBlock 8 / readme-previews 2 = 18）すべてに対応タスクあり（Task 2/3/4/5）。ヘルパ（設計 §1）は Task 1。検証計画（設計 §検証計画）は Task 6。スコープ外項目（src 変更・integration 修正）は本計画でも除外。ギャップなし。
- **Placeholder scan:** TBD/TODO/「適宜」等なし。全ステップに実コードまたは実コマンドと期待出力を記載。
- **Type consistency:** 公開 API は `fileUri(absPath: string): string` のみで全タスク一貫。`path.resolve` / `path.join` の使い分けは契約ファミリーに対応（file URI=fileUri、resolveHref='file://'+path.join、プレーン=path.join）。
