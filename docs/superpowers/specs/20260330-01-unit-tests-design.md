# ユニットテスト設計

## 概要

`extension.js` からVS Code API非依存の純粋関数を `src/utils.js` に抽出し、ユニットテストを実装する。

## アプローチ

**薄い抽出** — 純粋関数のみを別モジュールに切り出し、既存の `extension.js` の構造変更は最小限に留める。

## モジュール抽出

### `src/utils.js`

以下の関数を `extension.js` から `src/utils.js` に移動する。

| 関数 | 役割 | テスト優先度 |
|------|------|-------------|
| `Slug(string)` | 見出しID生成（VSCode互換） | 高 |
| `transformTemplate(text)` | `%%ISO-DATE%%` 等のプレースホルダー置換 | 高 |
| `convertImgPath(src, filename)` | 画像パスの正規化・file URI変換 | 高 |
| `setBooleanValue(a, b)` | frontmatter/設定の真偽値マージ | 中 |
| `readFile(filename, encode)` | ファイル読み込み（fs依存のみ） | 中 |
| `isExistsPath(path)` | パス存在チェック | 低 |
| `isExistsDir(dirname)` | ディレクトリ存在チェック | 低 |
| `makeCss(filename)` | CSSを`<style>`タグでラップ | 低 |

### `extension.js` の変更

- `const utils = require('./src/utils')` で読み込み
- 抽出した関数の呼び出しを `utils.Slug`、`utils.transformTemplate` 等に置き換え
- 関数本体を削除

## テスト構造

### フレームワーク

- **Mocha ^11** — `@vscode/test-cli` が内蔵するバージョンと統一
- **assert** — Node.js 組み込み。追加パッケージ不要

### ファイル構成

```
test/
  unit/
    utils.test.js       ← 新規：ユニットテスト
```

### 実行

- `npm run test:unit` でユニットテストのみ実行（`mocha test/unit/**/*.test.js`）
- VS Code API不要のため、IDEなしで実行可能

## テストケース

### `Slug` (高優先度)

- 基本変換: `"Hello World"` → `"hello-world"`
- 日本語/Unicode: `"日本語の見出し"` → URI エンコードされた文字列
- 句読点除去: `"What's this?!"` → `"whats-this"`
- 先頭/末尾ハイフン除去: `" -hello- "` → `"hello"`
- アンダースコア保持: `"snake_case"` → `"snake_case"` (v1.6.0)
- 空文字列
- 空白のみ
- 複数スペースの収縮
- 混在コンテンツ

### `transformTemplate` (高優先度)

- `%%ISO-DATE%%` → `YYYY-MM-DD` 形式
- `%%ISO-DATETIME%%` → `YYYY-MM-DD hh:mm:ss` 形式
- `%%ISO-TIME%%` → `hh:mm:ss` 形式
- プレースホルダーなし → そのまま返却
- 複数プレースホルダー混在
- 空文字列

### `convertImgPath` (高優先度)

- 相対パス → `file:///` 付き絶対パス
- 絶対パス → `file://` 付き
- `file://` プロトコル付き → `file:///` に正規化
- HTTP(S) URL → そのまま返却
- `#` を含むパス → `%23` エスケープ
- クォートを含むパス → 除去
- `file:///` URL → そのまま返却

### `setBooleanValue` (中優先度)

- `(false, true)` → `false` (frontmatterの明示的false優先)
- `(undefined, true)` → `true` (設定値にフォールバック)
- `(undefined, false)` → `false`
- `(true, false)` → `true`
- `(null, true)` → `true`
- `(undefined, undefined)` → `undefined`

### `readFile` (中優先度)

- 存在するファイル → 内容を返す
- 存在しないファイル → 空文字列
- `file://` プレフィックス付きパス → 正しく読める
- `encode` が `null` → Bufferで返す
- 空文字列パス → 空文字列

### `isExistsPath` / `isExistsDir` (低優先度)

- 存在するパス → `true`
- 存在しないパス → `false`
- 空文字列 → `false`
- ファイルパスに対する `isExistsDir` → `false`

### `makeCss` (低優先度)

- 存在するCSSファイル → `<style>` タグで囲んだ文字列
- 存在しないファイル → 空文字列

## エラーハンドリング方針

- 各関数からは `showErrorMessage` の呼び出しを削除し、エラーは自然に伝播させる
- `extension.js` 側の呼び出し元で `try-catch` し `showErrorMessage` を呼ぶ
- テストではエラーケースを `assert.throws` で検証

## スコープ

- インテグレーションテストは対象外（別設計で対応）
- VS Code API依存の関数（`readStyles`、`fixHref`、`getOutputDir` 等）は今回の対象外
