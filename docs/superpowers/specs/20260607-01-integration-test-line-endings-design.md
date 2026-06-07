# 統合テストの改行コード差異対応 — 設計仕様

## 背景

Windows 11 上で `npm run test:integration` を実行すると、`test/integration/extension.test.ts` のスナップショットテスト 17 件が失敗する。
ユニットテストは別ブランチ `bugfix/cross-platform-unit-tests` で対応済みで、本件は統合テスト固有のクロスプラットフォーム（Windows）問題に限定される。

mocha の diff には「見た目が同一の行が削除・再追加される」状態が出る。これは改行コードの差異（`\r\n` vs `\n`）が原因である。

### 原因の詳細

- 期待値フィクスチャ `test/integration/expected/*.html`（17 ファイル）は git のインデックス上すべて **LF** で格納されている（`git ls-files --eol` で `i/lf` を確認）。
- リポジトリに `.gitattributes` が **存在しない**。
- ローカルの `core.autocrlf=true`（Windows の git 既定）により、**新規 clone 時にこれらの LF ファイルがワーキングツリーで CRLF に変換**される。これが報告された障害シナリオ。
  - 現在の作業コピーはたまたま `w/lf` のままのため、マシン・チェックアウト状況によって再現したりしなかったりする。
- 拡張機能は `src/extension.ts` の `exportHtml()` 内で `fs.writeFile(filename, data, 'utf-8')` により HTML 内容をそのまま書き込む。EOL 変換を行わないため、生成 HTML は **LF** になる。
- テストの `normalizeHtml()`（`test/integration/extension.test.ts:9-13`）は `file:///` パス・日付・時刻を正規化するが、**改行コードは正規化していない**。
- そのため `assert.strictEqual(generatedHtml, expectedHtml)`（115 行目）が、生成側 LF と期待側 CRLF の不一致で失敗する。

### 影響範囲の確認

- 影響を受けるのはスナップショット比較（`extension.test.ts:112-114` の `readFileSync` + 115 行目の `strictEqual`）のみ。
- 188 行目は部分文字列 `.includes()`（改行非依存）のため影響なし。
- 133 行目は `.md` を読み込み PDF サイズチェック用に連結するだけで、`strictEqual` 比較に使われないため影響なし。

## 方針

堅牢性と決定性の両方を確保するため、以下 2 つを併用する（ユーザー選択: 両方）。

1. **テスト側の改行正規化（堅牢性）** — git 設定・OS・生成側/期待側どちらの EOL にも依存せず確実に通す。
2. **`.gitattributes` による LF 固定（決定性）** — リポジトリのチェックアウト結果を決定的にし、CRLF 起因の再発を予防する。

`src/` は変更しない（統合テスト限定の問題のため）。

## 変更内容

### 1. テスト比較の改行正規化（`test/integration/extension.test.ts`）

`normalizeHtml()` に改行正規化を追加し、生成側・期待側の両方が同関数を通るようにする。

```typescript
// 変更前
function normalizeHtml(html: string): string {
  return html
    .replace(/file:\/\/\/[^\s"'<>]*/g, 'file:///NORMALIZED_PATH')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS');
}

// 変更後（CRLF/CR を LF に正規化する一行を先頭に追加）
function normalizeHtml(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .replace(/file:\/\/\/[^\s"'<>]*/g, 'file:///NORMALIZED_PATH')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS');
}
```

期待側 `expectedHtml` は現状 `normalizeHtml()` を通っていないため、`readFileSync` 後に `normalizeHtml()` を適用するように変更する。

```typescript
// 変更前
const generatedHtml = normalizeHtml(fs.readFileSync(generatedHtmlPath, 'utf-8'));
const expectedHtml = fs.readFileSync(expectedHtmlPath, 'utf-8')
  .replace(`<title>${expectedName}.md</title>`, `<title>${name}.md</title>`);

// 変更後
const generatedHtml = normalizeHtml(fs.readFileSync(generatedHtmlPath, 'utf-8'));
const expectedHtml = normalizeHtml(
  fs.readFileSync(expectedHtmlPath, 'utf-8')
    .replace(`<title>${expectedName}.md</title>`, `<title>${name}.md</title>`)
);
```

注: `\r\n?` で CRLF と単独 CR の両方を LF に畳む。タイトル置換は改行を含まないため、正規化の前後どちらでも結果は同じだが、置換後に正規化する順序とする。

### 2. `.gitattributes` の追加（リポジトリ直下）

統合テストの期待値フィクスチャを LF に固定する。

```gitattributes
# Integration test fixtures must stay LF so the snapshot comparison
# matches the LF output produced by the extension on all platforms.
test/integration/expected/*.html text eol=lf
```

スコープは障害範囲（期待値フィクスチャ）に限定する。リポジトリ全体（`* text=auto eol=lf`）への拡大は今回の範囲外とする。

### 3. ワーキングツリーの再正規化

`.gitattributes` 追加後、インデックスを正規形に揃える。

```bash
git add --renormalize .
```

本作業コピーのフィクスチャは既に LF のため差分は出ない見込み。効果は次回以降の新規 clone で CRLF にならず LF で展開される点にある。

## 対象ファイル

- `test/integration/extension.test.ts` — `normalizeHtml()` に CRLF→LF 正規化を追加、`expectedHtml` を `normalizeHtml()` 経由に変更
- `.gitattributes` — 新規作成（期待値フィクスチャを `eol=lf` 固定）

## テスト方針

### 統合テスト

- Windows 上で `npm run test:integration` を実行し、17 件のスナップショットテストが **0 failures** になることを確認する。
- 検証の確実性のため、フィクスチャを意図的に CRLF 化した状態でもテストが通ること（テスト側正規化が効いていること）を確認する。

### WSL / Linux

- テスト側で CRLF→LF 正規化を行うため、LF 環境では正規化が no-op となり既存の合格状態は維持される（回帰なし）。実機実行が可能なら `npm run test:integration` で確認、不可なら上記ロジックから回帰しないことを論証する。

## 採用しなかった代替案

- **テスト側正規化のみ** / **`.gitattributes` のみ** の単独採用: それぞれ堅牢性または決定性のいずれかしか満たさないため、両方を併用する。
- **リポジトリ全体の `* text=auto eol=lf`**: 影響範囲が統合テストを超えるため今回は採用しない。
