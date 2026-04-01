# extension.js 残存ロジック抽出・テスト設計

## 概要

`extension.js` に残る未抽出の純粋ロジックを `src/utils.js` に抽出し、ユニットテストを追加する。

既存の抽出パターン（`buildPdfOptions`, `buildImageOptions`, `buildHighlightCallback` 等）を踏襲し、1機能ずつ抽出 → テスト → コミットで進める。

## 背景

- `src/utils.js` の18個の全エクスポート関数には130+のユニットテストが存在
- `extension.js` の `getOutputDir`, `readStyles`, `fixHref` は既にutils.jsに委譲済み
- しかし `markdownPdf()`, `convertMarkdownToHtml()`, `exportPdf()` にはまだ抽出可能な純粋ロジックが残っている
- これらはエクスポート処理の中核であり、バグが全出力フォーマットに影響するため優先度が高い

## 抽出対象

### Step 1: `resolveExportTypes(optionType, configuredType)`

**元の場所**: `extension.js` `markdownPdf()` 内の型解決ロジック

`option_type` パラメータ（`'pdf'`, `'html'`, `'settings'`, `'all'` 等）と VS Code 設定値から、実際にエクスポートする形式の配列を返す。

**入力**: `optionType` (string), `configuredType` (string | string[] | undefined)
**出力**: string[] | null（null は無効な型を示す）

**ロジック分岐**:
- `optionType` が `'html'`, `'pdf'`, `'png'`, `'jpeg'` のいずれか → `[optionType]`
- `optionType` が `'settings'` かつ `configuredType` が文字列 → `[configuredType]`
- `optionType` が `'settings'` かつ `configuredType` が配列 → そのまま返す
- `optionType` が `'settings'` かつ `configuredType` が未定義 → `['pdf']`（デフォルト）
- `optionType` が `'all'` → `['html', 'pdf', 'png', 'jpeg']`
- それ以外 → `null`

**テストケース**:
- 直接指定: `'pdf'` → `['pdf']`
- 直接指定: `'jpeg'` → `['jpeg']`
- settings + 文字列: `'settings', 'html'` → `['html']`
- settings + 配列: `'settings', ['pdf', 'html']` → `['pdf', 'html']`
- settings + 未定義: `'settings', undefined` → `['pdf']`
- all: `'all'` → `['html', 'pdf', 'png', 'jpeg']`
- 無効: `'docx'` → `null`
- 無効: `''` → `null`
- 無効: `undefined` → `null`

---

### Step 2: `transformImageHref(href, type, filename)`

**元の場所**: `extension.js` `convertMarkdownToHtml()` 内の画像パス変換ロジック

エクスポート形式に応じて画像の href を変換する。

**入力**: `href` (string), `type` (string), `filename` (string)
**出力**: string — 変換後の href

**ロジック分岐**:
- `type` が `'html'` → `decodeURIComponent(href).replace(/("|')/g, '')`
- それ以外 → `convertImgPath(href, filename)` に委譲

**テストケース**:
- html形式 + エンコード済みパス → デコードされたパス
- html形式 + クォート含むパス → クォート除去
- html形式 + 通常パス → そのまま返す
- pdf形式 → `convertImgPath` の結果
- png形式 → `convertImgPath` の結果
- 空の href

---

### Step 3: `transformHtmlBlockImages(html, filename)`

**元の場所**: `extension.js` `convertMarkdownToHtml()` 内のHTMLブロック画像変換

HTMLブロック内の `<img>` タグの src 属性を file URI に変換する。cheerio を使用。

**入力**: `html` (string), `filename` (string)
**出力**: string — 変換後のHTML

**ロジック**:
- cheerio で HTML をパース
- 全 `<img>` タグの `src` を `convertImgPath()` で変換
- 変換後の HTML を返す

**テストケース**:
- 単一の img タグ → src が変換される
- 複数の img タグ → 全ての src が変換される
- img タグなしの HTML → そのまま返す
- 空の HTML 文字列
- 相対パスの画像
- 絶対パスの画像

---

### Step 4: `buildEmojiTag(emoji, emojiData)`

**元の場所**: `extension.js` `convertMarkdownToHtml()` 内の絵文字レンダリング

絵文字名と base64 データから img タグを生成する。

**入力**: `emoji` (string), `emojiData` (string | falsy)
**出力**: string — HTML img タグまたはフォールバックテキスト

**ロジック分岐**:
- `emojiData` が truthy → `<img class="emoji" alt="emoji" src="data:image/png;base64,..." />`
- `emojiData` が falsy → `:emoji:`

**テストケース**:
- 正常な base64 データ → img タグ生成
- 空文字列 → `:emoji:` フォールバック
- null / undefined → `:emoji:` フォールバック
- 特殊文字を含む絵文字名（alt属性の安全性）

---

### Step 5: `buildContainerRenderer()`

**元の場所**: `extension.js` `convertMarkdownToHtml()` 内の markdown-it-container 設定

markdown-it-container プラグインの `validate` と `render` コールバックを返す。

**入力**: なし
**出力**: `{ validate: Function, render: Function }`

**ロジック**:
- `validate(name)`: `name.trim().length > 0` を返す
- `render(tokens, idx)`: info が空でなければ `<div class="name">`、空なら `</div>`

**テストケース**:
- validate: 名前あり → true
- validate: 空文字列 → false
- validate: スペースのみ → false
- render: info あり → `<div class="classname">\n`
- render: info 空 → `</div>\n`
- render: info に前後スペース → trim される

---

### Step 6 (低優先): `generateTmpHtmlFilename(filename)`

**元の場所**: `extension.js` `exportPdf()` 内の一時ファイル名生成

元のファイルパスから一時 HTML ファイル名を生成する。

**入力**: `filename` (string)
**出力**: string — `_tmp.html` サフィックスのパス

**ロジック**: `path.parse(filename)` → `path.join(dir, name + '_tmp.html')`

**テストケース**:
- `/path/to/file.md` → `/path/to/file_tmp.html`
- 拡張子なしファイル
- 深いディレクトリパス

## スコープ外

以下は今回の対象外とする：

- `checkPuppeteerBinary()` — puppeteer-core への外部依存が重く、モックが必要
- `setProxy()` — ロジックが単純すぎる（3行の条件分岐）
- `installChromium()` — 純粋な API 呼び出しのみ
- `markdownPdfOnSave()` / `isMarkdownPdfOnSaveExclude()` — 別途計画する

## 実装方針

- 既存パターン踏襲: `src/utils.js` にエクスポート関数として追加
- テストは `test/unit/utils.test.js` に追加
- 1機能ずつ抽出 → テスト追加 → extension.js 側を委譲に変更 → コミット
- extension.js 側の変更は最小限に留め、抽出した関数の呼び出しに置き換えるのみ
