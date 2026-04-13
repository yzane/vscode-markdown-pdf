# 自己閉じタグ正規化 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `<div class="page" />` のような非 void element の自己閉じタグを `<div class="page"></div>` に正規化し、改ページが正しく動作するようにする（GitHub Issue #428）。

**Architecture:** 既存の `transformHtmlBlockImages()` スキャナがタグを1つずつ解析済みなので、非 img タグ出力時に自己閉じ判定 + void element チェックを追加し、該当タグを開閉ペアに変換する。関数名は責務の拡大に合わせて `transformHtmlBlock` にリネームする。

**Tech Stack:** TypeScript, tsx (test runner)

**Branch:** `develop` から `bugfix/428-self-closing-tag-normalization` を作成して作業する。

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| Modify | `src/utils.ts` | `VOID_ELEMENTS` 定数追加、`normalizeSelfClosingTag()` 追加、`transformHtmlBlockImages` → `transformHtmlBlock` リネーム + 正規化呼び出し |
| Modify | `src/extension.ts:199` | 呼び出し元のリネーム反映 |
| Modify | `test/unit/utils.test.ts` | テストケース追加 + describe 名変更 |

---

### Task 1: feature ブランチ作成

**Files:**
- なし (git 操作のみ)

- [ ] **Step 1: feature ブランチを作成してチェックアウト**

```bash
git checkout develop
git checkout -b bugfix/428-self-closing-tag-normalization
```

---

### Task 2: 自己閉じタグ正規化のテストを追加

**Files:**
- Modify: `test/unit/utils.test.ts:1365-1494`

- [ ] **Step 1: テストを追加**

`test/unit/utils.test.ts` の `describe('transformHtmlBlockImages', ...)` ブロック内 (1494行目の `});` の直前) に以下のテストを追加する:

```typescript
    it('should normalize self-closing div to open/close pair', function () {
      const result = utils.transformHtmlBlockImages('<div class="page" />', '/doc/test.md');
      assert.strictEqual(result, '<div class="page"></div>');
    });

    it('should normalize self-closing div without space before slash', function () {
      const result = utils.transformHtmlBlockImages('<div class="page"/>', '/doc/test.md');
      assert.strictEqual(result, '<div class="page"></div>');
    });

    it('should normalize self-closing span', function () {
      const result = utils.transformHtmlBlockImages('<span/>', '/doc/test.md');
      assert.strictEqual(result, '<span></span>');
    });

    it('should normalize self-closing p with attributes', function () {
      const result = utils.transformHtmlBlockImages('<p class="note" />', '/doc/test.md');
      assert.strictEqual(result, '<p class="note"></p>');
    });

    it('should not normalize self-closing void elements', function () {
      assert.strictEqual(utils.transformHtmlBlockImages('<hr class="page"/>', '/doc/test.md'), '<hr class="page"/>');
      assert.strictEqual(utils.transformHtmlBlockImages('<br/>', '/doc/test.md'), '<br/>');
      assert.strictEqual(utils.transformHtmlBlockImages('<input type="text" />', '/doc/test.md'), '<input type="text" />');
    });

    it('should not modify non-self-closing tags', function () {
      const result = utils.transformHtmlBlockImages('<div class="page"></div>', '/doc/test.md');
      assert.strictEqual(result, '<div class="page"></div>');
    });
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx tsx --test test/unit/utils.test.ts
```

Expected: 自己閉じ div/span/p のテストが FAIL (正規化されずそのまま返される)。void element と非自己閉じのテストは PASS。

---

### Task 3: `normalizeSelfClosingTag()` を実装

**Files:**
- Modify: `src/utils.ts:567` (タグ出力行) 及び関数末尾付近

- [ ] **Step 1: `VOID_ELEMENTS` 定数と `normalizeSelfClosingTag()` 関数を追加**

`src/utils.ts` の `isRawTextElement()` 関数 (609行目付近) の直後に以下を追加する:

```typescript
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr',
  'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);

function normalizeSelfClosingTag(tag: string): string {
  if (!tag.endsWith('/>')) {
    return tag;
  }
  const tagName = getTagName(tag);
  if (!tagName || VOID_ELEMENTS.has(tagName)) {
    return tag;
  }
  return tag.slice(0, -2).trimEnd() + '></' + tagName + '>';
}
```

注: `getTagName()` は既に小文字化して返すため、`VOID_ELEMENTS` も小文字で定義すれば `.toLowerCase()` は不要。

- [ ] **Step 2: `transformHtmlBlockImages()` のタグ出力行を変更**

`src/utils.ts` 567行目を変更する:

```typescript
// 変更前
    result += isRealImgTag(tag) ? transformImgTag(tag, filename) : tag;

// 変更後
    result += isRealImgTag(tag) ? transformImgTag(tag, filename) : normalizeSelfClosingTag(tag);
```

- [ ] **Step 3: テストを実行して全て PASS を確認**

```bash
npx tsx --test test/unit/utils.test.ts
```

Expected: 全テスト PASS (新規追加分 + 既存分)。

- [ ] **Step 4: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts
git commit -m "fix: normalize self-closing non-void HTML tags in transformHtmlBlockImages (#428)"
```

---

### Task 4: 関数リネーム (`transformHtmlBlockImages` → `transformHtmlBlock`)

**Files:**
- Modify: `src/utils.ts:521-527` (JSDoc + 関数名)
- Modify: `src/extension.ts:199` (呼び出し元)
- Modify: `test/unit/utils.test.ts:1365` (describe 名)

- [ ] **Step 1: `src/utils.ts` の関数名と JSDoc を変更**

関数名を `transformHtmlBlockImages` → `transformHtmlBlock` にリネームし、JSDoc を更新する:

```typescript
/**
 * Transforms raw HTML blocks for non-html export types:
 * - Rewrites src attributes of <img> tags to absolute file:// URLs
 * - Normalizes self-closing non-void elements to open/close pairs
 *
 * Skips content inside comments, <script>, <style>, and <textarea>.
 * Uses a hand-rolled scanner to avoid pulling in a full HTML parsing dependency.
 */
export function transformHtmlBlock(html: string, filename: string): string {
```

- [ ] **Step 2: `src/extension.ts` の呼び出し元を変更**

199行目を変更する:

```typescript
// 変更前
          return utils.transformHtmlBlockImages(tokens[idx].content, filename);

// 変更後
          return utils.transformHtmlBlock(tokens[idx].content, filename);
```

- [ ] **Step 3: `test/unit/utils.test.ts` の describe 名と全呼び出しを変更**

describe 名を変更する (1365行目):

```typescript
// 変更前
  describe('transformHtmlBlockImages', function () {

// 変更後
  describe('transformHtmlBlock', function () {
```

テスト内の全ての `utils.transformHtmlBlockImages` を `utils.transformHtmlBlock` に一括置換する。

- [ ] **Step 4: 型チェックを実行**

```bash
npm run check
```

Expected: エラーなし。

- [ ] **Step 5: テストを実行して全て PASS を確認**

```bash
npx tsx --test test/unit/utils.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add src/utils.ts src/extension.ts test/unit/utils.test.ts
git commit -m "refactor: rename transformHtmlBlockImages to transformHtmlBlock"
```

---

### Task 5: 手動検証

- [ ] **Step 1: テスト用 markdown ファイルで PDF エクスポートを検証**

以下の内容で改ページが正しく動作することを確認する:

```markdown
# Page 1

Content on page 1.

<div class="page" />

# Page 2

Content on page 2.

<div class="page"></div>

# Page 3

Content on page 3.
```

- 自己閉じ `<div class="page" />` でページ 1→2 に改ページされること
- 通常の `<div class="page"></div>` でページ 2→3 に改ページされること
- 合計 3 ページの PDF が生成されること
