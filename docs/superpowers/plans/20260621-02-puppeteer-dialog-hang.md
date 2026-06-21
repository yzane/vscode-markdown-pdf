# puppeteer ダイアログハング修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF/画像レンダリング中に JS ダイアログ（alert/confirm/prompt/beforeunload）が開いても変換がハングしないよう、puppeteer のページに自動却下ハンドラを追加する（`sanitize: "none"` で生スクリプトが実行された場合の無限ハングを解消）。

**Architecture:** `exportPdf`（`src/extension.ts`）の `browser.newPage()` 直後に `page.on('dialog', …)` を追加し、ダイアログを `dismiss()` で即時却下、却下事実を `logWarn` で「Markdown PDF」OutputChannel に記録する。`setDefaultTimeout(0)` は据え置き。

**Tech Stack:** TypeScript / puppeteer-core（Dialog API）/ VS Code Extension API（logger）/ esbuild。

**Spec:** [`docs/superpowers/specs/20260621-02-puppeteer-dialog-hang-design.md`](../specs/20260621-02-puppeteer-dialog-hang-design.md)

**Branch:** `bugfix/puppeteer-dialog-hang`（worktree: `.worktrees/bugfix-puppeteer-dialog-hang`）。全タスクこのブランチで実施。

---

## 全体の制約

- 変更は `src/extension.ts` の `exportPdf` 内1箇所のみ。他は触らない（YAGNI）。
- `extension.ts` は `vscode`/puppeteer 依存で `tsx --test` のユニットテスト対象外。検証は `npm run check`（型）＋ `npm run build`（バンドル）＋ `npm run test:unit`（既存回帰）＋手動。
- コードコメントは英語。コマンドは worktree ルートで実行。
- `logger` は `extension.ts` に import 済み（要素③、`import * as logger from './logger';`）。追加 import 不要。

## ファイル構成

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/extension.ts` | `exportPdf` に `page.on('dialog')` 自動却下ハンドラを追加 | 修正 |

---

## Task 0: ブランチ / worktree の確認＋依存インストール（プリフライト）

**Files:** （変更なし）

- [ ] **Step 1: git の dubious ownership を回避（必要時のみ）**

`git` がエラーなく動く環境では不要。worktree 配下の `git` が `detected dubious ownership` で止まる場合のみ:
Run: `git config --global --add safe.directory C:/work/github/yzane/vscode-markdown-pdf/.worktrees/bugfix-puppeteer-dialog-hang`
（冪等で無害。）

- [ ] **Step 2: ブランチ確認**

Run: `git branch --show-current && git status --short`
Expected: `bugfix/puppeteer-dialog-hang`。未コミット変更は spec/plan のみ（または無し）。異なれば中断して報告。

- [ ] **Step 3: 依存インストール（新規 worktree のため）**

Run: `npm ci`
Expected: 完了（`node_modules` 生成）。

- [ ] **Step 4: ベースライン確認**

Run: `npm run test:unit`（`node --test` は失敗時に非0終了するので**終了コード**でゲートする。要約が要る場合のみ、使用シェルの末尾表示を使う — Bash: `npm run test:unit 2>&1 | tail -5` / PowerShell: `npm run test:unit 2>&1 | Select-Object -Last 5`）
Expected: 既存テストが全 pass（0 fail）。

---

## Task 1: exportPdf にダイアログ自動却下ハンドラを追加

**Files:**
- Modify: `src/extension.ts`（`exportPdf` 内、現行 462 行付近の `browser.newPage()` と `setDefaultTimeout(0)` の間）

> `exportPdf` は vscode/puppeteer 依存でユニットテスト対象外。検証は型チェック・バンドル・既存回帰・手動。

- [ ] **Step 1: ハンドラを追加**

`src/extension.ts` の該当箇所を変更する。

変更前（現行 461-463 行付近）:
```ts
        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setDefaultTimeout(0);
```
変更後:
```ts
        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        // PDF/image rendering is headless with no user to answer JS dialogs; auto-dismiss
        // them so a script calling alert/confirm/prompt/beforeunload cannot hang the export.
        page.on('dialog', async function (dialog) {
          const info = '(' + dialog.type() + '): ' + dialog.message();
          try {
            await dialog.dismiss();
            logger.logWarn('Dismissed a blocking dialog during rendering ' + info);
          } catch (error) {
            // dismiss() can reject if the dialog was already handled or the page closed;
            // swallow it (logged) so the handler never produces an unhandled rejection.
            logger.logWarn('Failed to dismiss a blocking dialog during rendering ' + info + ' - ' + (error instanceof Error ? error.message : String(error)));
          }
        });
        await page.setDefaultTimeout(0);
```

ポイント:
- `browser.newPage()` の直後・`setDefaultTimeout(0)` の前に置く（`goto` より前に登録する必要がある）。
- `dialog.dismiss()` は `alert`/`confirm`/`prompt`/`beforeunload` すべてに有効（`accept()` ではなく拒否側）。
- **`async` ハンドラで `await dialog.dismiss()` を `try/catch`**：`dismiss()` が reject しても catch して `logWarn` し、**未処理 Promise rejection を出さない**（「ハンドラ内は例外を投げない」を厳密に満たす）。
- `dialog.type()` と `dialog.message()` を `logWarn` で「Markdown PDF」チャネルへ記録。成功時は dismiss 後に記録、失敗時は catch で記録。
- `setDefaultTimeout(0)` は変更しない。

- [ ] **Step 2: 型チェック**

Run: `npm run check`
Expected: エラーなし。`page.on('dialog', (dialog) => ...)` の `dialog` は puppeteer の `Dialog` 型に推論され、`type()` / `message()` / `dismiss()` が利用可能。

- [ ] **Step 3: バンドル**

Run: `npm run build`
Expected: `dist/extension.js` がエラーなく生成される。

- [ ] **Step 4: 既存テストの回帰確認**

Run: `npm run test:unit`（終了コードでゲート）
Expected: 0 fail（本変更はユニットテスト対象外だが、念のため回帰なしを確認）。

- [ ] **Step 5: コミット**

```bash
git add src/extension.ts
git commit -m "fix: auto-dismiss blocking dialogs during rendering to prevent export hang"
```

- [ ] **Step 6: 手動検証（dev host）**

worktree を開いて F5「Run Extension」。ビルド済み `dist/extension.js` が使われる。「Markdown PDF」出力チャネルを開いておく。

1. 設定 `markdown-pdf.sanitize` を `"none"` にする。
2. `<script>alert('x')</script>` を含む .md（例 `C:\work\mdpdf-demo\sanitize-demo.md`）を開く。
3. コマンドパレット → **Markdown PDF: Export (pdf)**。
4. 確認:
   - **ハングせず完走**し PDF が生成される（修正前は無限ハング）。
   - 「Markdown PDF」チャネルに `Dismissed a blocking dialog during rendering (alert): x` が記録される。
5. 参考: `markdown-pdf.sanitize` を既定（`gfm`）に戻すと `<script>` は除去されダイアログ自体が発生しないことも確認（回帰なし）。
6. 検証後、`markdown-pdf.sanitize` を元の設定に戻す。

> 手動検証は人手。サブエージェント実行時は Step 1〜5 を実施し、Step 6 はチェックリストとして残しユーザーに依頼する。

---

## Self-Review チェック結果

- **Spec coverage**: spec「やること」（`page.on('dialog')` で dismiss＋`logWarn` 記録＝Task 1 Step 1）、「やらないこと」（`setDefaultTimeout(0)` 不変・none 挙動不変・トーストなし＝本計画は1ハンドラ追加のみで遵守）、テスト戦略（check/build/回帰＝Step 2-4、手動＝Step 6）を網羅。
- **Placeholder scan**: TBD/TODO なし。変更コードは exact。
- **Type consistency**: `dialog.type()` / `dialog.message()` / `dialog.dismiss()`（puppeteer Dialog API）、`logger.logWarn`（要素③で実在）を使用。`logger` は import 済みで追加 import 不要。
