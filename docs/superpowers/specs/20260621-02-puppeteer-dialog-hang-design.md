# puppeteer ダイアログハング修正 設計

## 背景・目的

`markdown-pdf.sanitize: "none"`（サニタイズ無効）で変換すると、本文中の生スクリプトが描画用 puppeteer（headless Chrome）で実行される。そのスクリプトが `alert()` / `confirm()` / `prompt()` / `beforeunload` などの**ブロッキングダイアログ**を開くと、変換が**無限にハングし、エラーも出ない**。

`bugfix/sanitize-removal`（#437 ①②a）の手動検証中に顕在化したが、これは #437 の回帰ではない。`none` の HTML 無変換 pass-through は従来から同一で、本不具合は以前から存在する。`gfm` / `gfm-allow-style` では該当タグが除去/エスケープされるためダイアログは発生しない。

## 根本原因（systematic-debugging で特定済み）

1. `sanitize: "none"` → `sanitizeRawHtml` が早期 return で HTML を無変換で通す → 生 `<script>` が一時 HTML に残る。
2. `exportPdf`（`src/extension.ts`）の `page.goto(file://tmp, { waitUntil: 'networkidle0' })` でスクリプトが実行され、ブロッキングダイアログが開く。
3. `page.on('dialog', …)` ハンドラが**無い** → ダイアログが閉じられず、ページが `networkidle0` に到達しない。
4. `page.setDefaultTimeout(0)`（大きな文書・画像のため意図的）でタイムアウトせず → 永久待機・エラーなし。

## スコープ

### やること

- `exportPdf` 内の `browser.newPage()` 直後に `page.on('dialog', …)` ハンドラを追加し、発生したダイアログを**自動却下（dismiss）**する。却下した型とメッセージを `logWarn` で「Markdown PDF」OutputChannel に記録する。

### やらないこと（対象外）

- `setDefaultTimeout(0)` の変更（大きな文書のため意図的。タイムアウト導入はしない）。
- `none` モードの挙動変更（サニタイズはしない。`none` は「生 HTML 実行」を意図した上級者向け設定）。
- トースト通知（PDF 変換時のダイアログ抑制は情報ログで十分。割り込みトーストは出さない）。

## アーキテクチャ

### 変更箇所（`src/extension.ts` の `exportPdf`、現行 462 行付近）

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
await page.goto(vscode.Uri.file(tmpfilename).toString(), { waitUntil: 'networkidle0' });
```

- `logger` は要素③で `extension.ts` に import 済み（`import * as logger from './logger';`）。`logWarn` はチャネル未注入時 no-op。
- `dialog.dismiss()` は `alert`/`confirm`/`prompt`/`beforeunload` すべてに有効（puppeteer の Dialog API）。`accept()` ではなく `dismiss()`＝キャンセル/拒否側を選ぶ（confirm→false、prompt→null）。
- **`dismiss()` を `await` し `try/catch` で包む**: `dismiss()` は「ダイアログが既に処理済み」「ページが閉じた」等で reject しうる。catch で握って `logWarn` するため、**未処理 Promise rejection を出さない**（「ハンドラ内は例外を投げない」を厳密に満たす）。ハンドラ自体を `async` にしても puppeteer は listener を await しないので描画の進行に影響はなく、`dismiss()` の送信タイミングも変わらない。
- 全 `sanitize` モード共通の防御。ダイアログが発生しなければハンドラは呼ばれず無害。

### データフロー

```
exportPdf → puppeteer.launch → browser.newPage()
  └ page.on('dialog', async d => { try { await d.dismiss(); logWarn(...); } catch { logWarn(failure) } })   ← 追加
  └ page.goto(file://tmp, networkidle0)
        スクリプトがダイアログを開く → ハンドラが dismiss（拒否側）→ 描画継続
        （logWarn が「Markdown PDF」チャネルへ記録。dismiss 失敗時も logWarn・未処理 rejection なし）
  └ page.pdf() / page.screenshot() → 完走
```

## エラーハンドリング

- ハンドラ内は例外を投げない。`async` ハンドラ内で `await dialog.dismiss()` を `try/catch` で包み、reject（ダイアログ処理済み/ページ終了タイミング等）も catch して `logWarn` する。これにより**未処理 Promise rejection を出さない**。
- `logWarn` はチャネル未注入時も no-op で安全（要素③の設計）。
- 既存の `exportPdf` の try/catch（失敗時 `showErrorMessage('exportPdf()', error)`）はそのまま。

## テスト戦略

`exportPdf` は `vscode` / puppeteer 依存で `tsx --test` のユニットテスト対象外。検証は型チェック・バンドル・手動。

- **自動**: `npm run check`（型エラーなし）/ `npm run build`（バンドル成功）/ `npm run test:unit`（既存テストが回帰なし・0 fail）。
- **手動（dev host）**: `sanitize: "none"` に設定し、`<script>alert('x')</script>` を含む .md（例 `C:\work\mdpdf-demo\sanitize-demo.md`）を Export。
  - (1) **ハングせず完走**し PDF が生成される。
  - (2)「Markdown PDF」チャネルに `Dismissed a blocking dialog during rendering (alert): x` が記録される。
  - 参考: `gfm`（既定）では `<script>` が除去されるためダイアログ自体が発生しないことも確認（回帰なし）。

## 採用済みデフォルト（レビューで異議があれば再検討）

- ダイアログは一律 `dismiss()`（accept ではない）。PDF 変換に対話相手はいないため却下が妥当。
- 却下は `logWarn`（情報的だが「通常出ないものを抑制した」という性質上 warn 相当）。トーストは出さない。
- `README` / `CHANGELOG` はリリース準備時に #437 群と合わせて更新（本ブランチでは触らない）。
