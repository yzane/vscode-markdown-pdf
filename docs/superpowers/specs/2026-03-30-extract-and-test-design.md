# extension.js ロジック抽出 + ユニットテスト追加 設計書

## 概要

`extension.js` に残っている未テスト関数のうち、ビジネスロジック部分を純粋関数として `src/utils.js` に抽出し、ユニットテストを追加する。既存の抽出パターン（`setBooleanValue`, `isExistsPath` 等）を踏襲する。

## 背景

- `utils.js` の8関数は41件のユニットテストで100%カバー済み
- インテグレーションテストでHTML生成7種 + バイナリ生成3種をカバー済み
- `extension.js` の18関数中16関数が未テスト（特にパス解決・スタイル構築・除外パターンのロジック）

## 抽出対象

### 1. `resolveOutputDir(filename, outputDirectory, outputDirectoryRelativePathFile, resourceFsPath, workspaceFsPath)`

**抽出元**: `getOutputDir()` (extension.js 行495-539)

**責務**: 出力ファイルパスの解決

**ロジック**:
- `outputDirectory` が空 → `filename` をそのまま返す
- `~` で始まる → `os.homedir()` で展開し、ディレクトリを作成して basename を結合
- 絶対パス → ディレクトリ存在確認、存在すれば basename を結合
- ワークスペース相対 → `outputDirectoryRelativePathFile === false && workspaceFsPath` の場合、ワークスペースルートと結合
- ファイル相対 → `resourceFsPath` のディレクトリと結合

**注意**: ディレクトリ作成（`mkdir`）は副作用のため、抽出関数ではパス解決のみ行う。ディレクトリ作成は `extension.js` の `getOutputDir()` 側に残す。抽出関数は純粋にパスを返すだけの責務とする。

**テストケース** (7件):
1. outputDirectory が空文字 → filename を返す
2. `~` で始まるパス → ホームディレクトリ展開
3. 絶対パスで存在するディレクトリ → 結合
4. 絶対パスで存在しないディレクトリ → null を返す
5. ワークスペース相対（outputDirectoryRelativePathFile=false, workspace あり）
6. ファイル相対（outputDirectoryRelativePathFile=true）
7. ファイル相対（workspace なし）

### 2. `resolveHref(href, resourceFsPath, stylesRelativePathFile, workspaceFsPath)`

**抽出元**: `fixHref()` (extension.js 行618-652)

**責務**: スタイルシートの href を file URI に解決

**ロジック**:
- falsy → そのまま返す
- http/https スキーム → そのまま返す
- `~` で始まる → ホームディレクトリ展開して file URI
- 絶対パス → file URI に変換
- ワークスペース相対 → `stylesRelativePathFile === false && workspaceFsPath` でワークスペースルート基準
- ファイル相対 → `resourceFsPath` のディレクトリ基準

**`vscode.Uri` の代替**: Node.js 標準の `url.pathToFileURL()` または `'file://' + path` で file URI を構築する。

**テストケース** (8件):
1. 空文字 → 空文字を返す
2. undefined → undefined を返す
3. http URL → そのまま返す
4. https URL → そのまま返す
5. `~` で始まる → ホームディレクトリ展開 + file URI
6. 絶対パス → file URI 変換
7. ワークスペース相対パス（stylesRelativePathFile=false, workspace あり）
8. ファイル相対パス

### 3. `buildStyleTags(options)`

**抽出元**: `readStyles()` (extension.js 行549-609)

**責務**: 5つのスタイルソースからHTML style/link タグ文字列を組み立てる

**引数**:
```javascript
options = {
  includeDefaultStyles: boolean,
  highlight: boolean,
  highlightStyle: string,
  markdownStyles: string[],       // markdown.styles 設定
  markdownPdfStyles: string[],    // markdown-pdf.styles 設定
  baseDir: string,                // __dirname 相当
  resolveHrefFn: function         // href 解決関数（resolveHref を渡す）
}
```

**ロジック** (5段階の順序):
1. `includeDefaultStyles` → `styles/markdown.css` を `makeCss()` で読み込み
2. `includeDefaultStyles` → `markdownStyles` を `<link>` タグで追加
3. `highlight` → `highlightStyle` 指定時はそのCSS、未指定時は `styles/tomorrow.css`
4. `includeDefaultStyles` → `styles/markdown-pdf.css` を `makeCss()` で読み込み
5. `markdownPdfStyles` → `<link>` タグで追加（常時）

**テストケース** (6件):
1. `includeDefaultStyles=true, highlight=true` → 5ソース全て含む
2. `includeDefaultStyles=false` → ソース1,2,4 をスキップ
3. `highlight=false` → ソース3 をスキップ
4. `highlightStyle` 指定あり → 指定CSSを使用
5. `highlightStyle` 未指定 → `tomorrow.css` フォールバック
6. 空の styles 配列 → link タグなし

### 4. `isExcludeFile(filename, patterns)`

**抽出元**: `isMarkdownPdfOnSaveExclude()` (extension.js 行125-145)

**責務**: ファイル名が除外パターンにマッチするか判定

**ロジック**:
- `patterns` が空/未定義/空配列 → false
- 各パターンを `new RegExp()` でコンパイルし、`filename` に対して `test()`
- いずれかにマッチ → true、全てマッチしない → false

**テストケース** (5件):
1. パターンなし（空配列）→ false
2. パターンなし（undefined）→ false
3. 単一パターンにマッチ → true
4. 複数パターンの2番目にマッチ → true
5. マッチしない → false

## extension.js 側の変更

各関数は `extension.js` に残し、VS Code API から設定値を取得した後 `utils.*` に委譲する。

```javascript
// Before
function getOutputDir(filename, resource) {
  var outputDirectory = vscode.workspace.getConfiguration(...)['outputDirectory'];
  // ... 40行のロジック
}

// After
function getOutputDir(filename, resource) {
  var outputDirectory = vscode.workspace.getConfiguration(...)['outputDirectory'] || '';
  var outputDirectoryRelativePathFile = vscode.workspace.getConfiguration(...)['outputDirectoryRelativePathFile'];
  var root = vscode.workspace.getWorkspaceFolder(resource);
  return utils.resolveOutputDir(
    filename,
    outputDirectory,
    outputDirectoryRelativePathFile,
    resource ? resource.fsPath : undefined,
    root ? root.uri.fsPath : undefined
  );
}
```

## テスト構成

`test/unit/utils.test.js` に以下のスイートを追加:
- `describe('resolveOutputDir', ...)`
- `describe('resolveHref', ...)`
- `describe('buildStyleTags', ...)`
- `describe('isExcludeFile', ...)`

合計 26 テストケースの追加見込み。

## スコープ外

- VS Code API に強く依存する関数（`activate`, `markdownPdf`, `exportPdf`, `installChromium` 等）はリファクタリング対象外
- インテグレーションテストの追加は本設計のスコープ外
- `convertMarkdownToHtml()` は146行と大きいが、markdown-it プラグイン設定と密結合しているため今回は対象外
