# 自己閉じタグ正規化 — 設計仕様

## 背景

v2.0.0 で cheerio を除去し `transformHtmlBlockImages()` を手書きスキャナに置き換えた際、
cheerio が副作用的に行っていた HTML 正規化（自己閉じ非 void element の開閉ペア化）が失われた。

これにより、README・FAQ で公式に案内している `<div class="page"/>` による改ページが動作しなくなった（GitHub Issue #428）。

### 原因の詳細

- HTML5 仕様では `<div>` は void element ではないため、`<div class="page"/>` は `<div class="page">` (閉じなし) として解釈される
- Chromium は後続コンテンツをこの div の子要素として扱い、`page-break-after: always` が文書末尾でのみ発火する
- 旧実装では `cheerioLoad(html)` → `$.html()` のパース→再シリアライズで `<div class="page"></div>` に正規化されていた

## 方針

既存の `transformHtmlBlockImages()` スキャナ内で、非 void element の自己閉じタグを開閉ペアに正規化する処理を追加する。

## 変更内容

### 1. `VOID_ELEMENTS` 定数の追加

`src/utils.ts` に HTML5 void element のセットを定義する。

```typescript
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr',
  'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);
```

### 2. `normalizeSelfClosingTag()` 関数の追加

`src/utils.ts` に以下の関数を追加する。

```typescript
function normalizeSelfClosingTag(tag: string): string {
  if (!tag.endsWith('/>')) return tag;

  const tagName = getTagName(tag);
  if (!tagName || VOID_ELEMENTS.has(tagName.toLowerCase())) return tag;

  // <div class="page" /> → <div class="page"></div>
  const withoutSlash = tag.slice(0, -2).trimEnd() + '>';
  return withoutSlash + '</' + tagName + '>';
}
```

### 3. `transformHtmlBlockImages()` の変更

タグ出力箇所で `normalizeSelfClosingTag()` を適用する。

```typescript
// 変更前
result += isRealImgTag(tag) ? transformImgTag(tag, filename) : tag;

// 変更後
result += isRealImgTag(tag) ? transformImgTag(tag, filename) : normalizeSelfClosingTag(tag);
```

### 4. 関数リネーム

`transformHtmlBlockImages` は img src 変換だけでなく HTML 正規化も行うようになるため、
関数名を `transformHtmlBlock` に変更する。呼び出し元（`extension.ts`）も併せて更新する。
JSDoc コメントも正規化の責務を反映するよう更新する。

## 変換例

| 入力 | 出力 |
|------|------|
| `<div class="page" />` | `<div class="page"></div>` |
| `<div class="page"></div>` | 変更なし |
| `<hr class="page"/>` | 変更なし (void element) |
| `<img src="a.png"/>` | img パスで処理 (変更なし) |
| `<span/>` | `<span></span>` |
| `<p class="note" />` | `<p class="note"></p>` |

## 対象ファイル

- `src/utils.ts` — `VOID_ELEMENTS`, `normalizeSelfClosingTag()` 追加、`transformHtmlBlockImages` → `transformHtmlBlock` リネームと変更
- `src/extension.ts` — 呼び出し元のリネーム反映
- `test/utils.test.ts` — 自己閉じタグ正規化のテストケース追加

## テスト方針

### ユニットテスト

`transformHtmlBlock` (旧 `transformHtmlBlockImages`) のテストに以下を追加:

- `<div class="page" />` → `<div class="page"></div>`
- `<div class="page"/>` (スペースなし) → `<div class="page"></div>`
- `<span/>` → `<span></span>`
- `<hr class="page"/>` → 変更なし (void element)
- `<div class="page"></div>` → 変更なし (既に閉じタグあり)
- 既存の img src 変換テストが全て引き続きパスすること

### 手動検証

改ページを含む markdown ファイルを PDF エクスポートし、`<div class="page" />` と `<div class="page"></div>` の両方で改ページが発生することを確認する。
