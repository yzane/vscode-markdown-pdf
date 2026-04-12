# convertMarkdownToHtml / makeHtml ロジック抽出・テスト設計

## 概要

`extension.js` の中核関数 `convertMarkdownToHtml()` および `makeHtml()` から、テスト可能な純粋関数を `src/utils.js` に抽出し、ユニットテストを追加する。

既存の `buildPdfOptions` / `buildImageOptions` 抽出パターンを踏襲する（アプローチ A）。

## 背景

- `convertMarkdownToHtml()` は約150行の大関数で、frontmatter解析、markdown-itプラグインチェーン、画像パス変換、highlightロジックを含む
- `makeHtml()` はテンプレートレンダリングとスタイル組み立てを行う
- いずれもユニットテストなし。統合テストで間接的にカバーされるのみ
- バグが入ると全出力フォーマット（PDF, HTML, PNG, JPEG）に影響するため、優先度最高

## 抽出対象

### 1. `buildHighlightCallback(hljs, escapeHtml)`

**元の場所**: `extension.js:151-169`

highlight コールバックを独立関数として抽出する。`hljs` と `escapeHtml` を依存注入で受け取る。

**入力**: `hljs` オブジェクト, `escapeHtml` 関数
**出力**: `function(str, lang)` — HTML文字列を返すコールバック関数

**ロジック分岐**:
- `lang` が mermaid にマッチ → `<div class="mermaid">${str}</div>`
- `lang` が hljs に認識される → `hljs.highlight(lang, str, true).value` を `<pre class="hljs">` で包む
- それ以外 → `escapeHtml(str)` を `<pre class="hljs">` で包む
- hljs.highlight がエラーの場合 → `escapeHtml(str)` にフォールバック

**テストケース** (4-5件):
- mermaid 言語指定時に div.mermaid で返す
- 既知の言語 (javascript等) でハイライト適用
- 未知の言語でエスケープ出力
- lang 空文字列でエスケープ出力
- hljs.highlight が例外を投げた場合のフォールバック

### 2. `buildMarkdownItOptions(config)`

**元の場所**: `extension.js:147-170`

markdown-it 初期化オプションを構築する。

**入力**:
```js
{
  breaks: boolean,    // frontmatter/settings マージ済みの値
  hljs: object,       // highlight.js モジュール
  escapeHtml: function // md.utils.escapeHtml
}
```

**出力**:
```js
{
  html: true,
  breaks: boolean,
  highlight: function(str, lang)  // buildHighlightCallback の戻り値
}
```

**テストケース** (3-4件):
- `html: true` が常にセットされる
- `breaks` 値がそのまま渡される
- `highlight` がコールバック関数である
- breaks が undefined の場合のデフォルト挙動

### 3. `buildPlantumlOptions(config)`

**元の場所**: `extension.js:260-264`

PlantUML プラグインオプションを構築する。frontmatter 優先のフォールバックチェーン。

**入力**:
```js
{
  frontmatterOpenMarker: string | undefined,
  frontmatterCloseMarker: string | undefined,
  settingsOpenMarker: string,
  settingsCloseMarker: string,
  server: string
}
```

**出力**:
```js
{
  openMarker: string,
  closeMarker: string,
  server: string
}
```

**ロジック**: `frontmatter || settings || デフォルト値('@startuml'/'@enduml')`

**テストケース** (4-5件):
- frontmatter 値が優先される
- frontmatter なしで settings にフォールバック
- settings も空でデフォルト値を使用
- server がそのまま渡される
- frontmatter の片方だけ指定されたケース

### 4. `buildHtmlViewData(config)`

**元の場所**: `extension.js:303-315`

mustache テンプレートに渡す view データを組み立てる。

**入力**:
```js
{
  content: string,      // markdown-it rendered HTML
  title: string,        // ファイルのbasename
  style: string,        // buildStyleTags() の出力
  mermaidServer: string  // mermaid CDN URL
}
```

**出力**:
```js
{
  title: string,
  style: string,
  content: string,
  mermaid: string  // '<script src="..."></script>'
}
```

**テストケース** (3-4件):
- mermaidServer から script タグが生成される
- 各フィールドがそのまま渡される
- mermaidServer が空文字列の場合

## 既存関数エッジケーステスト追加

### `buildPdfOptions`
- margin オブジェクトがそのまま渡されることの検証
- headerTemplate / footerTemplate が空文字列の場合

### `buildImageOptions`
- `omitBackground: false` の場合
- clip の全値が null の場合（clip なし fullPage）
- JPEG で quality 0 の境界値

## 実装方針

1. `src/utils.js` に4つの新関数を追加し `module.exports` に登録
2. `extension.js` の該当箇所を新関数の呼び出しに置き換え
3. `test/unit/utils.test.js` に各関数のテストを追加
4. 既存の統合テストが引き続きパスすることを確認

## テスト数見込み

| 関数 | 新規テスト数 |
|------|------------|
| `buildHighlightCallback` | 6件 |
| `buildMarkdownItOptions` | 4件 |
| `buildPlantumlOptions` | 5件 |
| `buildHtmlViewData` | 4件 |
| `buildPdfOptions` (エッジケース追加) | 2件 |
| `buildImageOptions` (エッジケース追加) | 3件 |
| **合計** | **24件** |

## スコープ外

- `convertMarkdownToHtml()` 全体のリファクタリング（依存注入化等）
- 統合テストの追加
- 画像パス変換ルール (`md.renderer.rules.image`, `md.renderer.rules.html_block`) の抽出
- emoji レンダラーの抽出
