# vscode-markdown-pdf テスティングフレームワーク評価
 
## Context
 
vscode-markdown-pdf は現在 Mocha v7.1.1 でテストが1件のみ存在する。テストを全面的に書き直す前提で、最適なフレームワークを評価する。
 
## プロジェクト特性
 
- **言語:** Plain JavaScript (CommonJS, TypeScriptなし)
- **構造:** モノリシック単一ファイル (`extension.js`, 901行)
- **ビルドツール:** なし（bundlerなし、直接 require）
- **依存:** puppeteer-core, markdown-it, cheerio, mustache 等
- **現在のテストライブラリ:** vscode-test v1.3.0 + Mocha v7.1.1
 
## テスト対象コードの性質
 
| カテゴリ | 割合 | 例 |
|---------|------|---|
| VS Code API依存 | 35-40% | コマンドハンドラ、設定読取、ワークスペース操作 |
| Puppeteer/ブラウザ自動化 | 30-35% | PDF/PNG/JPEG生成 |
| 純粋ロジック | 25-30% | Markdown→HTML変換、パス処理、テンプレート |
 
## フレームワーク比較
 
### 1. Mocha + Chai + Sinon
 
| 項目 | 評価 |
|------|------|
| VS Code拡張テスト互換性 | **最良** - `@vscode/test-electron` の公式サンプルすべてが Mocha |
| モック機能 | 良好（Sinon併用） |
| async対応 | 良好 |
| セットアップ複雑度 | **最低** - 既存インフラがそのまま使える |
| VS Code拡張コミュニティ | **支配的** - ほぼすべてのチュートリアルが Mocha |
 
### 2. Jest
 
| 項目 | 評価 |
|------|------|
| VS Code拡張テスト互換性 | **不良** - `require('vscode')` がJestのモジュール解決と衝突 |
| モック機能 | 優秀（`jest.mock()` は最高水準） |
| async対応 | 優秀 |
| セットアップ複雑度 | 高（moduleNameMapper等の設定が必要） |
| VS Code拡張コミュニティ | 弱い（`jest-environment-vscode` は保守不十分） |
 
**致命的問題:** VS Code拡張ホスト内で動作させるための公式サポートがない。ユニットテストとインテグレーションテストで別フレームワークを併用する必要が生じる。
 
### 3. Vitest
 
| 項目 | 評価 |
|------|------|
| VS Code拡張テスト互換性 | **不良** - ESM/Vite前提のアーキテクチャがCommonJSと不一致 |
| モック機能 | 優秀（Jest互換API） |
| async対応 | 優秀 |
| セットアップ複雑度 | **最高** - Vite導入が必要、アーキテクチャ変更を伴う |
| VS Code拡張コミュニティ | ほぼ皆無 |
 
**致命的問題:** このプロジェクトにはbundlerがなく、Vite依存を追加するのは過剰。`vscode` 仮想モジュールの解決問題はJestと同様。
 
### 4. Node.js組み込みテストランナー (node:test)
 
| 項目 | 評価 |
|------|------|
| VS Code拡張テスト互換性 | 不確実（カスタム統合が必要） |
| モック機能 | 基本的（`mock.method()` のみ、Sinon相当の機能なし） |
| async対応 | 良好 |
| セットアップ複雑度 | 低いが統合作業が非自明 |
| VS Code拡張コミュニティ | なし |
 
**問題:** `@vscode/test-electron` との統合パターンが確立されていない。モック機能が不十分。
 
## 結論: Mocha + Chai + Sinon を推奨（@vscode/test-cli 経由）
 
**決定的な理由: `@vscode/test-electron` との互換性**
 
VS Code拡張のインテグレーションテストは拡張ホストプロセス内で実行される必要があり、Mocha以外のフレームワークには公式サポートがない。Jest/Vitest は `require('vscode')` の仮想モジュール解決で根本的な問題を抱える。
 
### @vscode/test-cli について
 
`@vscode/test-cli` は Microsoft が現在推奨する VS Code 拡張テストの CLI ツール。`@vscode/test-electron` + Mocha v11 を内包し、ボイラープレートを大幅に削減する。
 
| | 旧アプローチ (現在のプロジェクト) | @vscode/test-cli |
|---|---|---|
| 依存 | `vscode-test` + `mocha` を個別管理 | `@vscode/test-cli` 1つ（内部にMocha v11同梱） |
| 起動スクリプト | `test/runTest.js` を手書き | 不要 |
| テストランナー設定 | `test/suite/index.js` でMochaを手動構成 | 不要 |
| 設定ファイル | なし（コードで設定） | `.vscode-test.mjs` で宣言的に設定 |
| カバレッジ | 自前で設定 | c8 組み込み (`--coverage`) |
| ファイルウォッチ | なし | `--watch` フラグ |
 
**重要:** テストフレームワーク自体はMochaのまま変わらない。テストファイルの書き方は同一（`describe`/`it`）。変わるのはインフラ部分のみ。Mocha以外のフレームワークに差し替えるオプションはない。
 
**推奨スタック:**
- **@vscode/test-cli** - テスト実行CLI（Mocha v11 + @vscode/test-electron を内包）
- **Chai v4** - アサーション
- **Sinon v17+** - スタブ/スパイ/モック
 
**削除できるもの:**
- `vscode-test` v1.3.0（@vscode/test-cli が内包）
- `mocha` v7.1.1（@vscode/test-cli が内包）
- `test/runTest.js`（不要）
- `test/suite/index.js`（不要）
 
**新規作成:**
- `.vscode-test.mjs` - テスト設定ファイル
 
**推奨テスト構成:**
- `test/unit/` - 純粋Node.jsテスト（VS Codeインスタンス不要）。`extension.js` から純粋関数を別モジュールに抽出して個別テスト。Mocha で直接実行。
- `test/integration/` - VS Codeホスト内テスト。`@vscode/test-cli` 経由で実行。コマンド実行、設定連携、E2Eエクスポートフロー。
 
**最大の改善ポイントはフレームワーク選択ではなく、テスタビリティのためのリファクタリング。** 純粋関数（`convertImgPath`, `transformTemplate`, `Slug`, `getOutputDir` 等）を別モジュールに抽出することで、VS Code起動なしで高速なユニットテストが可能になる。
 
## 対象ファイル
 
- `/home/user/vscode-markdown-pdf/extension.js`
- `/home/user/vscode-markdown-pdf/package.json`
- `/home/user/vscode-markdown-pdf/test/runTest.js`（削除対象）
- `/home/user/vscode-markdown-pdf/test/suite/index.js`（削除対象）
- `/home/user/vscode-markdown-pdf/test/suite/extension.test.js`（書き直し対象）
- `.vscode-test.mjs`（新規作成）
