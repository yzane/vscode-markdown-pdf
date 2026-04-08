# markdown-it-include 自前実装 実装計画

**設計書**: `docs/superpowers/specs/20260409-01-custom-markdown-it-include-design.md`
**ブランチ**: `feature/custom-markdown-it-include`
**Worktree**: `.worktrees/custom-include`

## ステップ

### Step 1: プラグイン本体の実装

**ファイル**: `src/markdown-it-include.ts`（新規作成）

実装内容:
1. `MarkdownItIncludeOptions` インターフェースの定義
2. コード領域スキップのためのソース分割関数
   - Fenced code block（`` ``` ``、`~~~`）の検出
   - Inline code（バッククォート）の検出
   - 保護領域と通常テキストへの分割
3. include 置換関数
   - 正規表現 `/:\[.+?\]\(\s*(.+?\..+?)\s*\)/` によるマッチ
   - ファイル読み込みと再帰処理
   - 循環参照検出
   - エラーメッセージ埋め込み（throwError=false 時）
4. markdown-it プラグインとしてのエクスポート
   - `md.core.ruler.before('normalize', 'include', ...)` で登録

**検証**: ビルドが通ること（`npm run build`）

### Step 2: extension.ts の変更

**ファイル**: `src/extension.ts`（変更）

変更内容:
1. import を `'markdown-it-include'` から `'./markdown-it-include'` に変更
2. `md.use()` のオプションを新 API に合わせる
   - `includeRe`、`bracesAreOptional` を削除
   - `root` と `throwError` のみ渡す

**検証**: ビルドが通ること（`npm run build`）

### Step 3: 外部依存の削除

**ファイル**:
- `package.json`: `dependencies` から `markdown-it-include` を削除
- `src/types/markdown-it-include.d.ts`: ファイルを削除

**作業**:
1. `package.json` の編集
2. 型定義ファイルの削除
3. `npm install` で lockfile を更新

**検証**: `npm run build` が通ること

### Step 4: テストの追加・更新

**ファイル**:
- `test/integration/fixtures/include-codeblock.md`（新規）
- `test/integration/expected/include-codeblock.html`（新規）

テスト内容:
1. Fenced code block 内の `:[alt](path.md)` がスキップされること
2. Inline code 内の `:[alt](path.md)` がスキップされること
3. コードブロック外の `:[alt](path.md)` は通常通り展開されること

**作業**:
1. fixture ファイルを作成
2. テストを実行して期待出力HTMLを確認・作成
3. 既存の include テスト（`include.md`、`include-missing.md`）が引き続きパスすることを確認

**検証**: `npm test` で全テストがパスすること

### Step 5: sample 実行で README.md の変換を確認

**作業**:
1. `npm run sample` を実行
2. `sample/README.html` に `INCLUDE ERROR` が含まれないことを確認
3. README.md のコードブロック・インラインコード内の include 構文がそのまま表示されることを確認

**検証**: `npm run sample` が成功し、出力に INCLUDE ERROR がないこと
