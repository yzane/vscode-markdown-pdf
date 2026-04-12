# パッケージ最新化設計

## 概要

依存パッケージを段階的に最新化する。puppeteer-core は API 変更が大きいため今回のスコープ外とし、それ以外のパッケージを対象とする。`rimraf` と `mkdirp` は Node.js 組込み API に置き換えて削除する。

## 対象パッケージ

### フェーズ1: 安全な更新（パッチ/マイナー）

| パッケージ | 現在 | 更新先 | 種類 |
|---|---|---|---|
| gray-matter | 4.0.2 | 4.0.3 | パッチ |
| mustache | 4.0.1 | 4.2.0 | マイナー |

### フェーズ2: rimraf / mkdirp の削除と組込み API 置換

- `rimraf` → `fs.rm(path, { recursive: true, force: true })`
- `mkdirp` → `fs.mkdirSync(path, { recursive: true })` or `fs.promises.mkdir(path, { recursive: true })`
- 使用箇所をすべて書き換え、package.json から依存を削除

### フェーズ3: markdown-it エコシステムの更新

| パッケージ | 現在 | 更新先 |
|---|---|---|
| markdown-it | 10.0.0 | 14.1.1 |
| markdown-it-emoji | 1.4.0 | 3.0.0 |
| markdown-it-container | 2.0.0 | 4.0.0 |
| markdown-it-include | 1.1.0 | 2.0.0 |

markdown-it 関連は相互に依存するため一括で更新する。API の変更点を確認し、必要に応じてコードを修正する。

### フェーズ4: highlight.js の更新

| パッケージ | 現在 | 更新先 |
|---|---|---|
| highlight.js | 9.18.1 | 11.11.1 |

highlight.js 9.x → 11.x では以下の変更がある:
- `hljs.initHighlightingOnLoad()` 廃止
- CSS クラス名のプレフィックス変更（`hljs-` プレフィックスが必須に）
- スタイルファイル名の変更の可能性
- `highlightStyle` 設定で参照しているCSSファイル名の整合性を確認する必要あり

### フェーズ5: cheerio の更新

| パッケージ | 現在 | 更新先 |
|---|---|---|
| cheerio | 0.20.0 | 1.2.0 |

現在の使用は `cheerio.load(html)` + `$('img')` 操作のみで、1.x でも互換性あり。

### フェーズ6: devDependencies の更新

| パッケージ | 現在 | 更新先 |
|---|---|---|
| @vscode/test-cli | 0.0.12 | 最新 |
| @vscode/test-electron | 2.5.2 | 最新 |
| removeNPMAbsolutePaths | 2.0.0 | 3.0.1 |

## スコープ外

- **puppeteer-core** (2.1.1): API と Chromium ダウンロード機構が大幅に変更されているため、別タスクで対応
- **emoji-images** (0.1.1): 更新なし
- **markdown-it-checkbox** (1.1.0): 更新なし
- **markdown-it-named-headers** (0.0.4): 更新なし
- **markdown-it-plantuml** (1.4.1): 更新なし

## 進め方

- 各フェーズで更新 → テスト実行 → 動作確認のサイクルを回す
- 既存のユニットテスト・インテグレーションテストで回帰を確認する
- フェーズごとにコミットする

## リスク

- **highlight.js のスタイルファイル互換性**: package.json の `highlightStyle` enum に列挙されたCSSファイル名が 11.x で変更・削除されている可能性がある。更新時に確認が必要
- **markdown-it プラグインの互換性**: markdown-it 14.x に対して各プラグインが正しく動作するか確認が必要
- **ESM 移行**: 一部パッケージが ESM のみになっている可能性がある。このプロジェクトは CommonJS なので、ESM only のパッケージは require() で読み込めない場合がある
