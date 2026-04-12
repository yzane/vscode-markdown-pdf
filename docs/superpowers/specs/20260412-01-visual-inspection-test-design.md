# 目視確認用 PDF 生成テスト設計

## コンテキスト

`Integration Binary Generation Tests` スイート内のテスト（emoji HTML チェック、バイナリ形式生成）は HTML Snapshot Tests で既にカバーされており不要。
一方、全フィクスチャを結合した PDF を生成し、描画結果を目視確認できる仕組みが必要。

## 変更内容

### 1. `Integration Binary Generation Tests` スイート削除

`test/integration/extension.test.ts` の 119〜199 行目を削除する。

### 2. `Visual Inspection Tests` スイート追加

同じ位置に新スイートを追加する。

- **suiteSetup**: `HTML_FEATURES` の各 `.md` を読み込み `---` 区切りで結合し `tmp/_all-features.md` を生成。`tmp/` ディレクトリがなければ `fs.mkdirSync` で作成する。
- **テスト**: `tmp/_all-features.md` を PDF コマンドで変換し `tmp/_all-features.pdf` として出力。ファイルが生成されサイズ > 0 であることを assert する。
- **suiteTeardown なし**: 生成ファイルは削除しない（目視確認用）。

出力先:
- `tmp/_all-features.md` — 結合した Markdown
- `tmp/_all-features.pdf` — 変換された PDF

### 3. 除外設定

- `.gitignore` に `tmp/` を追加
- `.vscodeignore` に `tmp/` を追加

## 対象ファイル

- `test/integration/extension.test.ts`
- `.gitignore`
- `.vscodeignore`
