# ログ動線（Show Output ボタン）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エラートーストに「Show Output」アクションボタンを追加し、押下で「Markdown PDF」出力チャネルを開く動線を作る（issue #437 要素②b）。併せて error 引数付き時の冗長な2つ目トーストを廃止する。

**Architecture:** 変更は `src/extension.ts` の `showErrorMessage` 関数のみ。要素③（develop マージ済み）で公開済みの `logger.showLog()` を、`vscode.window.showErrorMessage(msg, action)` のアクション選択結果から呼ぶ。チャネルへのログ（`logError` / `formatError`）は従来どおり維持。自動表示はしない。

**Tech Stack:** TypeScript / VS Code Extension API（`window.showErrorMessage` のアクションボタン、`LogOutputChannel`）/ esbuild バンドル。

**Spec:** [`docs/superpowers/specs/20260614-01-log-discovery-design.md`](../specs/20260614-01-log-discovery-design.md)

**Branch:** `feature/log-discovery`（worktree: `.worktrees/feature-log-discovery`）。全タスクをこのブランチで実施。

---

## 全体の制約

- 変更は `src/extension.ts` の `showErrorMessage` のみ。他関数・他ファイルは触らない（YAGNI）。
- `extension.ts` は `vscode` 依存のため `tsx --test` のユニットテスト対象外。検証は `npm run check`（型）＋ `npm run build`（バンドル）＋手動2ケース。
- コードコメントは英語（リポジトリ規約）。
- コマンドは worktree ルート `.worktrees/feature-log-discovery` で実行。

## ファイル構成

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/extension.ts` | `showErrorMessage` にアクションボタン追加・2つ目トースト廃止 | 修正 |

---

## Task 0: ブランチ / worktree の確認（プリフライト）

**Files:** （変更なし。確認のみ。）

- [ ] **Step 1: 正しいブランチにいることを確認**

Run: `git branch --show-current && git status --short`
Expected: ブランチが `feature/log-discovery`。`git status` は spec/plan 以外の未コミット変更なし。異なる場合は中断して報告。

---

## Task 1: showErrorMessage に Show Output ボタンを追加し2つ目トーストを廃止

**Files:**
- Modify: `src/extension.ts`（`showErrorMessage`、現行 716-723 行）

> ユニットテストは無い（vscode 依存）。検証は型チェック・バンドル・手動。`logger.showLog()` の挙動自体は要素③でユニットテスト済み。

- [ ] **Step 1: showErrorMessage を変更**

`src/extension.ts` の `showErrorMessage`（現行 716-723 行）を置換する。

変更前:
```ts
function showErrorMessage(msg: string, error?: unknown): void {
  vscode.window.showErrorMessage('ERROR: ' + msg);
  logger.logError(msg);
  if (error) {
    vscode.window.showErrorMessage(String(error));
    logger.logError(logger.formatError(error));
  }
}
```

変更後:
```ts
// Action label shown on the error toast; selecting it reveals the output channel.
const SHOW_OUTPUT_ACTION = 'Show Output';

function showErrorMessage(msg: string, error?: unknown): void {
  // Log first so the detail (incl. stack via formatError) is in the channel
  // by the time the user clicks "Show Output".
  logger.logError(msg);
  if (error) {
    logger.logError(logger.formatError(error));
  }
  // Single toast with an action button. The raw error detail lives in the
  // channel, so we no longer show a second toast for String(error).
  vscode.window.showErrorMessage('ERROR: ' + msg, SHOW_OUTPUT_ACTION).then(function (selection) {
    if (selection === SHOW_OUTPUT_ACTION) {
      logger.showLog();
    }
  });
}
```

ポイント:
- アクション付き `showErrorMessage('ERROR: ' + msg, SHOW_OUTPUT_ACTION)`。`.then` は fire-and-forget（呼び出し側は `void` のまま、await 不要）。
- error 引数があってもトーストは1つだけ（生 `String(error)` の2つ目トーストを廃止）。詳細は `logError(formatError(error))` でチャネルに残る。
- `SHOW_OUTPUT_ACTION` 定数は `showErrorMessage` の直前に置く。

- [ ] **Step 2: 型チェック**

Run: `npm run check`
Expected: エラーなし。`showErrorMessage` の戻り値は `void` のまま（`.then` を return しない）。

- [ ] **Step 3: バンドル**

Run: `npm run build`
Expected: `dist/extension.js` がエラーなく生成される。

- [ ] **Step 4: 旧挙動が残っていないことを確認**

Run: `git grep -n "showErrorMessage(String(error))" src/extension.ts`
Expected: 出力なし（2つ目トーストが廃止されている）。

- [ ] **Step 5: コミット**

```bash
git add src/extension.ts
git commit -m "feat: add Show Output action to error toast and drop redundant raw-error toast"
```

- [ ] **Step 6: 手動検証（dev host、2ケース必須）**

dev host を起動（worktree フォルダを開いて F5「Run Extension」）。ビルド済み `dist/extension.js` が使われる。デモ用に任意の `.md`（例: `C:\work\mdpdf-demo\demo.md`）を開く。

**重要（検証の前提）**: 「Show Output」押下で**開く/前面化する**ことを確認するため、各ケースの実行前に**出力パネルを閉じる**（または「ターミナル」「問題」など別パネルへ切り替える／出力ドロップダウンを「Markdown PDF」以外にしておく）。チャネルを開いたまま始めると、押下の効果を検証できない。

- **ケースA（error 引数なし）**: 出力パネルを閉じた状態にする → `markdown-pdf.outputDirectory` に存在しない絶対パス `C:\nope\output` を設定 → コマンドパレット「Markdown PDF: Export (pdf)」。
  - 確認: トーストに **「Show Output」** ボタンが出る／押下で（閉じていた）「Markdown PDF」チャネルが開いて前面に出る。
- **ケースB（error 引数あり）**: 再び出力パネルを閉じる（または別パネルへ）→ `markdown-pdf.outputDirectory` を空に戻し、`markdown-pdf.executablePath` に実在フォルダ `C:\Windows` を設定 → 「Markdown PDF: Export (pdf)」。`puppeteer.launch` 失敗で `exportPdf()` catch → `showErrorMessage('exportPdf()', error)` 経路。
  - 確認: **トーストが1つだけ**（`ERROR: exportPdf()`＋「Show Output」）で、**生エラーの2つ目トーストが出ない**。「Show Output」押下で（閉じていた）チャネルが開いて前面化し、`formatError` 整形済みのエラー詳細＋スタックが記録されている。
- 検証後、`markdown-pdf.outputDirectory` と `markdown-pdf.executablePath` を空に戻す。

> 手動検証は人手で行うステップ。サブエージェント実行時は Step 1〜5 を実施し、Step 6 はチェックリストとして残し、ユーザーに手動確認を促す。

---

## Self-Review チェック結果

- **Spec coverage**: spec「やること」（アクションボタン追加＝Step 1／2つ目トースト廃止＝Step 1・Step 4 で確認）、「やらないこと」（自動表示なし・警告は触らない・汎用ヘルパー作らない・README/CHANGELOG触らない＝本計画は extension.ts の1関数のみ変更で遵守）、テスト戦略（check/build＝Step 2-3、手動2ケース＝Step 6）をすべて網羅。
- **Placeholder scan**: TBD/TODO 等なし。変更コードは exact。
- **Type consistency**: `SHOW_OUTPUT_ACTION` 定数名、`logger.showLog()` / `logger.logError` / `logger.formatError`（要素③で実在）と整合。`showErrorMessage(msg, error?)` のシグネチャは不変。
