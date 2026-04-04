# サンプル生成スクリプト設計

## 概要

README.md を PDF, HTML, PNG, JPEG の4形式に変換し、`./sample/` ディレクトリに配置する npm スクリプトを追加する。

## 背景

`./sample/` には README.md を変換したサンプルファイル（README.pdf, README.html, README.png, README.jpeg）が配置されている。現状、これらの生成は手動で行われており、npm スクリプトとして自動化する。

## 設計

### アプローチ

既存の integration test と同じ仕組み（`@vscode/test-cli` + `vscode-test`）を利用する。VS Code をヘッドレス起動し、拡張機能のコマンドで変換を実行する。

### 変更対象ファイル

#### 1. `test/sample/generate-sample.js`（新規）

- Mocha テストの形式で記述（既存の `extension.test.js` と同じパターン）
- `vscode.workspace.openTextDocument` で README.md を開く
- `extension.markdown-pdf.all` コマンドを実行し、4形式を一括生成
- 生成されたファイル（ワークスペースルート直下に出力される）を `./sample/` にコピー
- コピー元（ルート直下）のファイルを削除してクリーンアップ
- `waitForFile` による生成完了の待機を行う（既存テストと同じパターン）

#### 2. `.vscode-test.mjs`（修正）

既存の `integration` ラベルと並列に、`sample` ラベルのエントリを追加:

```js
{
  label: 'sample',
  files: 'test/sample/**/*.js',
  mocha: { ui: 'tdd', timeout: 120000 },
  skipExtensionDependencies: true,
  launchArgs: ['--user-data-dir=' + userDataDir],
  ...installationOption,
}
```

- タイムアウトは PDF 生成を考慮して 120000ms に設定
- VS Code パス検出や userDataDir は既存設定を共有

#### 3. `package.json`（修正）

scripts に追加:

```json
"sample": "vscode-test --config .vscode-test.mjs --label sample"
```

### 出力ファイル

| ファイル | 形式 |
|---------|------|
| `sample/README.pdf` | PDF |
| `sample/README.html` | HTML |
| `sample/README.png` | PNG |
| `sample/README.jpeg` | JPEG |

### エラーハンドリング

- ファイル生成の待機には最大30秒のタイムアウトを設定
- 生成に失敗した場合、Mocha のアサーションエラーとして報告される
