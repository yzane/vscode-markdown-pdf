# エクスポートオプション構築テスト 設計仕様書

## 概要

`extension.js` の `exportPdf()` 内にあるPDF/PNG/JPEGのオプション構築ロジックを純粋関数として `src/utils.js` に抽出し、ユニットテストを追加する。加えて、統合テストにPlantUMLカスタムマーカーのシナリオを1件追加する。

## 背景

- `src/utils.js` の12関数は121件のユニットテストで100%カバー済み
- 統合テストはHTMLスナップショット13件 + バイナリ生成3件 + エラー2件
- `exportPdf()` のオプション構築ロジック（~80行）は条件分岐が多いが、ユニットテストが存在しない
- 設定ミスがエクスポート結果に直結するため、テスト価値が高い

---

## パート1: ロジック抽出 + ユニットテスト

### 抽出関数1: `buildPdfOptions(config)`

**抽出元**: `exportPdf()` (extension.js 行381-416)

**責務**: PDFエクスポート用のPuppeteerオプションオブジェクトを構築する。

**引数**:

```javascript
config = {
  path: string,              // 出力ファイルパス
  width: string,             // 幅（空文字ならformat使用）
  height: string,            // 高さ（空文字ならformat使用）
  format: string,            // 'A4' etc（デフォルト: 'A4'）
  orientation: string,       // 'landscape' or other
  scale: number,
  displayHeaderFooter: boolean,
  headerTemplate: string,
  footerTemplate: string,
  printBackground: boolean,
  pageRanges: string,
  margin: { top, right, bottom, left }
}
```

**戻り値**: `page.pdf()` に渡すオプションオブジェクト。

**ロジック**:

1. `width` と `height` が両方空 → `format` を使用（config.format、デフォルト `'A4'`）
2. `width` または `height` が指定 → `format` は空文字（widthとheightが優先）
3. `orientation === 'landscape'` → `landscape: true`、それ以外 → `false`
4. `headerTemplate` / `footerTemplate` に `transformTemplate()` を適用
5. `timeout: 0` を固定付与
6. その他のプロパティ（`path`, `scale`, `displayHeaderFooter`, `printBackground`, `pageRanges`, `margin`）はそのまま渡す

**テストケース** (6件):

| # | テストケース | 入力 | 期待結果 |
|---|---|---|---|
| 1 | width/height両方空 | `width: '', height: ''` | `format: 'A4'`、`width: ''`、`height: ''` |
| 2 | width指定あり | `width: '10cm', height: ''` | `format: ''`（width優先） |
| 3 | height指定あり | `width: '', height: '15cm'` | `format: ''`（height優先） |
| 4 | orientation landscape | `orientation: 'landscape'` | `landscape: true` |
| 5 | orientation portrait | `orientation: 'portrait'` | `landscape: false` |
| 6 | テンプレートのプレースホルダー | `headerTemplate: '%%ISO-DATE%%'` | `transformTemplate` 適用済みの日付文字列 |

### 抽出関数2: `buildImageOptions(config)`

**抽出元**: `exportPdf()` (extension.js 行421-458)

**責務**: PNG/JPEGエクスポート用のPuppeteerスクリーンショットオプションを構築する。

**引数**:

```javascript
config = {
  path: string,
  type: 'png' | 'jpeg',
  quality: number,                         // jpeg用（png時は無視）
  clip: { x, y, width, height } | null,   // 4プロパティ全てnon-nullなら使用
  omitBackground: boolean
}
```

**戻り値**: `page.screenshot()` に渡すオプションオブジェクト。

**ロジック**:

1. `type === 'png'` → `quality: undefined`
2. `type === 'jpeg'` → `quality` をそのまま使用
3. `clip` の `x`, `y`, `width`, `height` が全て非null → `fullPage: false` + `clip` 設定
4. いずれかがnull → `fullPage: true`、`clip` なし

**テストケース** (4件):

| # | テストケース | 入力 | 期待結果 |
|---|---|---|---|
| 1 | PNG、clipなし | `type: 'png', clip: null` | `quality: undefined`, `fullPage: true`, clipプロパティなし |
| 2 | JPEG、clipなし | `type: 'jpeg', quality: 100, clip: null` | `quality: 100`, `fullPage: true` |
| 3 | JPEG、clip全指定 | `type: 'jpeg', clip: {x:0,y:0,width:800,height:600}` | `fullPage: false`, `clip` オブジェクトあり |
| 4 | clip一部null | `type: 'png', clip: {x:0,y:null,width:800,height:600}` | `fullPage: true`, clipプロパティなし |

### extension.js 側の変更

`exportPdf()` のオプション構築部分を `utils.buildPdfOptions()` / `utils.buildImageOptions()` への委譲に置換する。VS Code設定の取得は `exportPdf()` 側に残す。

```javascript
// Before (extension.js ~35行のオプション構築)
if (type == 'pdf') {
  var width_option = vscode.workspace.getConfiguration(...)['width'] || '';
  // ... 条件分岐とオプション構築 ...
  await page.pdf(options);
}

// After
if (type == 'pdf') {
  var options = utils.buildPdfOptions({
    path: exportFilename,
    width: vscode.workspace.getConfiguration('markdown-pdf', uri)['width'] || '',
    height: vscode.workspace.getConfiguration('markdown-pdf', uri)['height'] || '',
    format: vscode.workspace.getConfiguration('markdown-pdf', uri)['format'] || 'A4',
    orientation: vscode.workspace.getConfiguration('markdown-pdf', uri)['orientation'] || '',
    scale: vscode.workspace.getConfiguration('markdown-pdf', uri)['scale'],
    displayHeaderFooter: vscode.workspace.getConfiguration('markdown-pdf', uri)['displayHeaderFooter'],
    headerTemplate: vscode.workspace.getConfiguration('markdown-pdf', uri)['headerTemplate'] || '',
    footerTemplate: vscode.workspace.getConfiguration('markdown-pdf', uri)['footerTemplate'] || '',
    printBackground: vscode.workspace.getConfiguration('markdown-pdf', uri)['printBackground'],
    pageRanges: vscode.workspace.getConfiguration('markdown-pdf', uri)['pageRanges'] || '',
    margin: {
      top: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['top'] || '',
      right: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['right'] || '',
      bottom: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['bottom'] || '',
      left: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['left'] || ''
    }
  });
  await page.pdf(options);
}
```

---

## パート2: 統合テスト追加

### PlantUMLカスタムマーカー (1件)

frontmatterで `plantumlOpenMarker` / `plantumlCloseMarker` をカスタム指定した場合のHTMLスナップショットテスト。

**fixture**: `test/integration/fixtures/plantuml-custom-marker.md`

```markdown
---
plantumlOpenMarker: "```plantuml"
plantumlCloseMarker: "```"
---

```plantuml
Bob -> Alice : hello
```
```

**期待結果**: PlantUMLサーバーへの `<img>` タグが生成される（通常の `@startuml` / `@enduml` ではなくカスタムマーカーが認識される）。

**expected**: `test/integration/expected/plantuml-custom-marker.html`

**テスト方法**: 既存のHTMLスナップショットパターンと同一。`FEATURES` 配列に `'plantuml-custom-marker'` を追加するだけ。

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/utils.js` | 変更 | `buildPdfOptions`, `buildImageOptions` を追加・export |
| `extension.js` | 変更 | `exportPdf()` のオプション構築を `utils.*` 呼び出しに置換 |
| `test/unit/utils.test.js` | 変更 | `buildPdfOptions` 6件 + `buildImageOptions` 4件 |
| `test/integration/fixtures/plantuml-custom-marker.md` | 新規 | fixture |
| `test/integration/expected/plantuml-custom-marker.html` | 新規 | 期待HTML |
| `test/integration/extension.test.js` | 変更 | FEATURESに追加 |

## テスト合計

| カテゴリ | 件数 |
|---|---|
| `buildPdfOptions` ユニットテスト | 6件 |
| `buildImageOptions` ユニットテスト | 4件 |
| PlantUMLカスタムマーカー統合テスト | 1件 |
| **合計** | **11件** |

## スコープ外

- `convertMarkdownToHtml()` のリファクタリング（密結合のため対象外維持）
- VS Code設定の動的変更を伴うテスト（状態汚染リスク）
- `src/compile.js` のテスト（ビルドスクリプト）
- 複合機能テスト（個別テストでカバー済み）
