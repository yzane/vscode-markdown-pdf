# インテグレーションテスト設計

## 概要

テスト実行基盤を `@vscode/test-cli` に移行し、VS Code 拡張ホスト内で動作するインテグレーションテストを `test/integration/` に実装する。WSL2・ネイティブLinux・Mac の全環境で動作すること。

## テスト実行基盤

### 移行の背景

現在のテストインフラは以下の問題を抱えている：

- `vscode-test` v1.3.0 は非推奨（`@vscode/test-electron` に置き換え済み）
- `test/runTest.js` と `test/suite/index.js` のボイラープレートが必要
- Mocha v7.1.1 は古い
- カバレッジやウォッチモードが未対応

### `@vscode/test-cli` への移行

Microsoft が現在推奨する `@vscode/test-cli` に移行することで、ボイラープレートの削減、Mocha v11 への自動アップグレード、`--coverage`（c8）や `--watch` の無料利用が可能になる。

### ファイル変更

#### 削除

- `test/runTest.js` — `@vscode/test-cli` が代替
- `test/suite/index.js` — `@vscode/test-cli` が代替
- `test/suite/extension.test.js` — 旧テスト
- `test/suite/mermaid.md` — 旧フィクスチャ
- `test/suite/` — ディレクトリ自体を削除

#### 新規作成

- `.vscode-test.mjs` — テスト設定ファイル（VS Code検出 + WSL2ロジック含む）
- `test/integration/extension.test.js` — インテグレーションテスト本体
- `test/integration/fixtures/*.md` — 機能ごとのフィクスチャ
- `test/integration/expected/*.html` — HTML スナップショット

#### 変更

- `package.json` — devDependencies と scripts の更新

### `package.json` 変更

#### devDependencies

| 操作 | パッケージ | バージョン |
|------|-----------|-----------|
| 削除 | `glob` | ^7.1.6 |
| 削除 | `vscode-test` | ^1.3.0 |
| 追加 | `@vscode/test-cli` | ^0.0.12 |
| 追加 | `@vscode/test-electron` | ^2.4.0 |

注: `mocha` はユニットテスト計画で ^11 に更新済みの前提。

#### scripts

| スクリプト | 変更前 | 変更後 |
|-----------|--------|--------|
| `test` | `node ./test/runTest.js` | `vscode-test` |

### `.vscode-test.mjs` 設計

#### VS Code実行ファイルの検出

全プラットフォームで既にインストールされているVS Codeを優先的に使用し、見つからない場合は `@vscode/test-cli` の自動ダウンロードにフォールバックする。

検出対象パス（プラットフォーム別）：

| 環境 | 候補パス |
|------|---------|
| WSL2 | `/mnt/c/Program Files/Microsoft VS Code/Code.exe` |
| Windows | `%LOCALAPPDATA%/Programs/Microsoft VS Code/Code.exe`, `C:\Program Files\Microsoft VS Code\Code.exe` |
| Mac | `/Applications/Visual Studio Code.app/Contents/MacOS/Electron` |
| Linux | `/usr/share/code/code`, `/usr/bin/code` |

検出ロジック：
1. プラットフォームを判定（WSL2は `/mnt/c/...` の存在で判定）
2. 候補パスを順にチェック
3. 見つかれば `useInstallation: { fromPath }` を設定
4. 見つからなければ省略（自動ダウンロード）

#### WSL2固有ロジック

WSL2環境ではWindows側VS Codeを使用するため、追加の設定が必要：

1. **UNCパス変換** — `wslpath -w` でWSLパスをWindowsパスに変換
2. **extensionDevelopmentPath** — UNCパスに変換して渡す
3. **一時ユーザーデータディレクトリ** — 以下の設定を含む `settings.json` を生成：
   - `security.allowedUNCHosts: ["wsl.localhost"]`
   - `security.workspace.trust.enabled: false`
   - `markdown-pdf.executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"`
4. **launchArgs** — `--user-data-dir=<UNCパス>` を渡す

#### テスト設定

```javascript
export default defineConfig([
  {
    label: 'integration',
    files: 'test/integration/**/*.test.js',
    mocha: { ui: 'tdd', timeout: 60000 },
  },
]);
```

## テスト対象の機能

README.md に記載された全 7 機能:

| # | 機能 | フィクスチャファイル | 主な検証内容 |
|---|------|---------------------|-------------|
| 1 | Syntax highlighting | `syntax-highlighting.md` | `hljs` クラス付きの `<code>` 要素 |
| 2 | Emoji | `emoji.md` | Emoji 文字または画像の出力 |
| 3 | markdown-it-checkbox | `checkbox.md` | `<input type="checkbox">` 要素 |
| 4 | markdown-it-container | `container.md` | `<div class="warning">` ラッパー |
| 5 | markdown-it-include | `include.md` | `include-target.md` の内容が含まれること |
| 6 | PlantUML | `plantuml.md` | PlantUML サーバー URL を持つ `<img>` 要素 |
| 7 | Mermaid | `mermaid.md` | Mermaid 図を含む `<div class="mermaid">` |

## テストディレクトリ構成

```
test/
  integration/
    fixtures/                ← 機能ごとの Markdown ファイル
      syntax-highlighting.md
      emoji.md
      checkbox.md
      container.md
      include.md
      include-target.md      ← include.md から参照されるファイル
      plantuml.md
      mermaid.md
    expected/                ← HTML スナップショット（正規化済み）
      syntax-highlighting.html
      emoji.html
      checkbox.html
      container.html
      include.html
      plantuml.html
      mermaid.html
    extension.test.js        ← インテグレーションテスト本体
```

## テストケース

### HTML スナップショットテスト（7 テスト、各 60 秒タイムアウト）

各テストの実行フロー:

1. `vscode.workspace.openTextDocument` で `fixtures/<feature>.md` を開く
2. `vscode.window.showTextDocument` でドキュメントを表示
3. `extension.markdown-pdf.html` コマンドを実行
4. 生成された HTML ファイルを読み込む
5. 環境依存の内容（ファイルパス、日付）を正規化
6. `expected/<feature>.html` と文字列比較
7. 生成ファイルをクリーンアップ

**PlantUML の注意事項:** markdown-it-plantuml プラグインが java を非同期に spawn し、ENOENT エラーが uncaught exception として発生する。PlantUML テストを先頭に配置し、`uncaughtException` ハンドラで抑制する。

### バイナリ生成テスト（3 テスト、各 60 秒タイムアウト）

1. `suiteSetup` フックで全機能の `.md` を結合した一時ファイルを生成
2. 各テスト（PDF, PNG, JPEG）:
   - 結合ファイルを開く
   - 対応するコマンドを実行
   - ファイルが存在し、サイズ > 0 であることを確認
   - マジックバイトが期待する形式と一致することを検証
3. `suiteTeardown` フックで生成ファイルと結合 `.md` をクリーンアップ

## HTML 正規化

スナップショット比較の前に、環境依存の内容を正規化する:

- **ファイルパス**: `file:///...` URI を `file:///NORMALIZED_PATH` に置換
- **日付**: `YYYY-MM-DD` パターンを固定値に置換
- **時刻**: `HH:MM:SS` パターンを固定値に置換

## テスト実行フロー

### インテグレーションテスト (`npm test`)

```
vscode-test CLI
  → .vscode-test.mjs を読み込み
  → VS Code検出（インストール済み or 自動ダウンロード）
  → WSL2の場合: UNCパス変換、設定ファイル生成
  → VS Code拡張ホスト起動
  → Mocha v11 (TDD UI) でテスト実行
  → test/integration/**/*.test.js
```

## ネットワーク依存

- **PlantUML**: `https://www.plantuml.com/plantuml` へのネットワークアクセスが必要
- **Mermaid**: バンドル済み JS によりクライアント側でレンダリング。ネットワーク依存なし
