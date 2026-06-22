# エラー通知の有益化（対処ヒント + Show Details + resolver 理由伝播）設計

## 背景・目的

[error-diagnostics（20260621-03）](20260621-03-error-diagnostics-design.md) で診断ログ基盤（OutputChannel・開始診断ブロック・`buildContextSummary`）は整った。本 spec はその上で、**エラー時のトースト通知の中身**を改善する。

現状、全ての `catch` は `showErrorMessage('関数名()', error[, context])` を呼ぶ統一構造で、トーストには `ERROR: exportPdf()` のように**内部関数名がそのまま出る**。これには 2 つの問題がある:

1. ユーザーにとって `exportPdf()` は無意味で、「何が失敗したか」「どう直すか」が分からない。`error.message` すらトーストに出ない。
2. 一方で「原因が特定可能なのに握り潰している」箇所がある。`resolveChromiumPath` は network/proxy・no-browser・autoDownload 無効をすべて裸の `null` に潰し、区別を捨てている（[#436](https://github.com/yzane/vscode-markdown-pdf/issues/436) browser 起動失敗、proxy 環境の取得失敗が「Chromium does not exist」一辺倒になる）。

### ゴール

トーストとログで役割を分離する:

- **トースト** = 人間向けの「何が起きたか（awareness）」＋ よくある失敗には「どう直すか（hint）」。失敗時に無言でファイルが生成されない事態を防ぐ。
- **Show Details ボタン → ログ** = 関数名 + context + hint + 生メッセージ + スタック。issue 発行者がそのまま貼り付けられる詳細。

加えて、resolver が握り潰している失敗理由を伝播させ、proxy 等の特定可能な原因を救う。

ブランチ: `feature/error-message-hints`（`develop` から分岐、`.worktrees/feature-error-message-hints`）。

## スコープ

### やること

1. **既存の `showErrorMessage` を `reportError` にリネームし、options 形に再設計**。トースト = `operation`(+hint)、ログ = `where`(関数名) + `context` + hint + message + stack。リネームにより vscode API（`vscode.window.showErrorMessage`）との名前衝突を解消し、~20 箇所の移行を greppable にする。
2. **`classifyError`（`diagnostics.ts`・純粋関数）を追加**。スローされたエラーを 4 ルールで分類し `{ hint, action? }` を返す。未該当は `undefined`。
3. **`resolveChromiumPath` の戻り値を判別ユニオン化**（`{ ok: true, path, source } | { ok: false, reason }`）。失敗理由を resolver 内（raw エラーのある場所）で分類。network 判定 `isNetworkError` を `chromium-resolver.ts` に追加。
4. **`exportPdf` の null 分岐を reason スイッチに置換**（network → proxy ヒント + Open Settings、autodownload-disabled → 既存文言 + Open Settings、download-failed → Learn More）。
5. **ボタン整備**: 定数 `Show Output` → **`Show Details`** に改名（`reportError` と `notifySanitize` の両方）。`Open Settings`（`@id:` 設定ディープリンク）・`Learn More`（README.md#chromium、英語のみ）を action 経由で出す。
6. **全 catch（~20 箇所）を 3 層で移行**（後述「呼び出し箇所マッピング」）。
7. `installChromium` の null チェックを `.ok` に追随。
8. **ユニットテスト**: `diagnostics.test.ts` に `classifyError`、`chromium-resolver.test.ts` に `isNetworkError`・新ユニオンの戻り値検証を追加／既存 6 箇所を更新。

### やらないこと（対象外）

- **Tier B（周辺 catch）の個別文言**。awareness 目的は共有文言（export 用 / extension 用の 2 本）で満たすため、各箇所に固有メッセージを書かない（YAGNI）。
- **`classifyError` の network ルール**。network/proxy 失敗は `resolveChromiumPath` 内で潰され export の `catch` に届かない。よって network は resolver の `reason` で扱い、`classifyError` には入れない。
- **TimeoutError ルール**。`exportPdf` は `page.setDefaultTimeout(0)`（[現 555 行付近](../../../src/extension.ts)）で無効化済みのため、レンダリングのタイムアウトは発生しない。
- **README / README.ja / CHANGELOG の更新**。リリース準備時に他の未リリース要素とまとめて 1 回更新する（[20260621-03](20260621-03-error-diagnostics-design.md) と同方針）。
- **`logger.ts` 基盤の変更**。利用側のみ。
- **i18n**。文言は英語に統一（リポジトリ方針）。

## アーキテクチャ

### 設計原則: vscode 依存を `extension.ts` に閉じ込める（既存方針の踏襲）

`classifyError` は「ヒント文 + アクションの**記述**（kind/query/url/label）」だけを返す純粋関数とし、`diagnostics.ts`（vscode/os 非依存）に置く。アクションの**実行**（`vscode.env.openExternal` / `workbench.action.openSettings` / `logger.showLog`）は vscode 依存なので `reportError`（`extension.ts`）側に閉じる。これにより `classifyError` は `tsx --test`（実 VS Code 不要）で決定論的にテストできる。

### `reportError` 再設計（旧 `showErrorMessage` をリネーム・`extension.ts`）

```ts
// Defined in diagnostics.ts (vscode-free) so classifyError can return it.
export type ErrorActionSpec =
  | { kind: 'settings'; query: string; label: string }  // workbench.action.openSettings(query)
  | { kind: 'url'; url: string; label: string };         // vscode.env.openExternal(url)

interface ErrorReport {
  operation: string;        // toast text (human-readable "what failed")
  where?: string;           // internal function name, log only (e.g. 'exportPdf()')
  error?: unknown;          // log only: message + stack via formatError
  context?: string;         // log only: buildContextSummary(ctx, homeDir)
  classify?: boolean;       // Tier A: run classifyError(error) → append hint + action
  action?: ErrorActionSpec; // explicit action (resolver reasons); takes precedence over classified
}

function reportError(r: ErrorReport): void;
```

処理（擬似コード。**トースト表示自体は vscode API `vscode.window.showErrorMessage` を呼ぶ**——helper 名は `reportError` で衝突しない）:

```
classified = (r.classify && r.error !== undefined) ? classifyError(r.error) : undefined
hint   = classified?.hint
action = r.action ?? classified?.action

// --- log first (so Show Details has full detail ready) ---
logError(r.operation)                       // human summary — logged too, so a Show Details paste is meaningful even without an error
if (r.where)   logError(r.where)
if (r.context) logError(r.context)
if (hint)      logError('Hint: ' + hint)
if (r.error !== undefined) logError(formatError(r.error))

// --- toast: operation (+ hint), buttons = [action?, Show Details] ---
toast = 'ERROR: ' + r.operation + (hint ? ' — ' + hint : '')
buttons = [action?.label, SHOW_DETAILS_ACTION].filter(Boolean)
vscode.window.showErrorMessage(toast, ...buttons).then(sel => {
  if (sel === action?.label) runAction(action)   // openSettings / openExternal
  else if (sel === SHOW_DETAILS_ACTION) showLog()
})
```

ポイント:

- **生メッセージ（`error.message`）はトーストに出さない**。トーストは `operation`(+hint) のみ。生メッセージとスタックは `formatError` でログへ（issue 貼付用）。
- VS Code 通知は改行を反映しない（スペース化）ため、トーストは 1 行構成（`operation — hint`）。hint は `classifyError` が返す短い 1 文に限定。
- ボタンはアクション（任意）＋ `Show Details` の最大 2 個に抑える。

### `classifyError`（`diagnostics.ts`・新規）

```ts
export interface ErrorHint {
  hint: string;
  action?: ErrorActionSpec;
}
export function classifyError(error: unknown): ErrorHint | undefined;
```

検出は「`error.code`（OS/Node が付ける安定識別子）→ メッセージ文字列（定番フレーズ）」の優先順。`page.pdf({path})` は raw fs エラーを素通しで伝播する（`code`/`errno`/`syscall` 健在）ことを実機確認済み（後述「検証で確定した前提」）。`code` を主・message を予備にしてラップ耐性を持たせる。

| 順 | 検出シグナル | hint（英語） | action |
|---|---|---|---|
| 1 | msg `/Failed to launch the browser process/` または `/Could not find .*(Chrome\|Chromium\|browser)/i` | Chromium could not be started. Set a valid Chromium path or enable auto-download. | settings `@id:markdown-pdf.executablePath` |
| 2 | `code ∈ {EBUSY, EPERM, EACCES}` または msg `/EBUSY\|EPERM\|EACCES\|being used by another process/i` | Cannot write the output file. Close it if it is open in another app, then check write permission. | （なし） |
| 3 | `code === 'ENOSPC'` または msg `/ENOSPC\|no space left/i` | No space left on the device. Free up disk space and retry. | （なし） |
| 4 | `code ∈ {ENOENT, EISDIR}` または msg `/ENOENT\|EISDIR/i` | The output path is invalid. Check the markdown-pdf.outputDirectory setting. | settings `@id:markdown-pdf.outputDirectory` |

- **順序が重要**: ルール 1（起動失敗）を 2〜4 より先に評価する。起動失敗が `EACCES` 等を伴っても「ファイル権限」と誤分類しないため。
- ルール 4 は起動成功後の `catch`（`exportPdf`）でのみ意味を持つ（`page.pdf`/`page.screenshot`/`exportHtml` の書き込み経路）。起動前の spawn-ENOENT とは混ざらない（起動は既に成功している）。
- 未該当は `undefined`（hint 無し）。**誤ヒントは無ヒントより害**なので保守的に倒す。

### resolver の理由伝播（`chromium-resolver.ts`）

```ts
export type ChromiumResolution =
  | { ok: true; path: string; source: ChromiumSource }
  | { ok: false; reason: ChromiumFailureReason };

export type ChromiumFailureReason =
  | 'autodownload-disabled'  // autoDownload off and no user/system/cached browser
  | 'network'                // download/fetch failed due to network/proxy
  | 'download-failed';       // download failed for other reasons

// New pure helper (testable). code-first, message-fallback.
export function isNetworkError(error: unknown): boolean;
//   code ∈ {ETIMEDOUT, ECONNREFUSED, ENOTFOUND, EAI_AGAIN, ECONNRESET}
//   or msg /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|socket hang up/i
```

`resolveChromiumPath` の各 `return null` を理由付き失敗に置換する:

| 現在地（行は 85d80e5 時点） | 旧 | 新 |
|---|---|---|
| autoDownload off かつ cache 無し（現 350 付近） | `return null` | `{ ok: false, reason: 'autodownload-disabled' }` |
| latest ダウンロード失敗の catch（現 358-360） | `logError + return null` | `(isNetworkError(error) ‖ networkSeenAtFetch) ? 'network' : 'download-failed'` |
| bundled fallback 失敗の catch（現 376-378） | `logError + return null` | 同上 |
| 各成功経路 | `{ path, source }` | `{ ok: true, path, source }` |

**fetch 段の network 失敗も拾う（P2 対応）**: `fetchLatestStableBuildId()` は JSON 取得の network/proxy 失敗を内部で `logWarn` し `null` を返す（現 175 付近）。ここで `isNetworkError(error)` をモジュール状態 `cachedLatestFetchNetworkError` に記録する（戻り値は従来どおり `null` のまま）。`resolveChromiumPath` の最終失敗 reason は「fetch 段または download 段のどちらかで network を観測したら `'network'`」とする（proxy 救済を優先）。`resetLatestBuildIdCache()`（テスト用）はこの新フラグも初期化する。

理由分類は「raw エラーが手元にある catch / fetch の中」で行う（握り潰さない）。`logError`/`logWarn` は維持（ログには従来どおり生エラーを残す）。

### `exportPdf` の null 分岐 → reason スイッチ（現 515-530 / 535・542）

```ts
if (!resolution.ok) {
  // delete tmp file (existing cleanup)
  switch (resolution.reason) {
    case 'autodownload-disabled':
      reportError({ operation: AUTO_DOWNLOAD_DISABLED_MSG, where: 'exportPdf()',
        action: { kind: 'settings', query: '@id:markdown-pdf.chromium.autoDownload', label: 'Open Settings' } });
      break;
    case 'network':
      reportError({ operation: 'Could not download Chromium (network error). '
        + 'If you are behind a proxy, set http.proxy and restart VS Code.', where: 'exportPdf()',
        action: { kind: 'settings', query: '@id:http.proxy', label: 'Open Settings' } });
      break;
    case 'download-failed':
      reportError({ operation: 'Could not obtain Chromium. See the setup guide.', where: 'exportPdf()',
        action: { kind: 'url', url: 'https://github.com/yzane/vscode-markdown-pdf#chromium', label: 'Learn More' } });
      break;
  }
  return;
}
```

`AUTO_DOWNLOAD_DISABLED_MSG` は現 520-525 の文言を流用するが、**含まれる `#install` を `#chromium` に修正**する（後述「README アンカー」）。

## 呼び出し箇所マッピング（~20 箇所、行は 85d80e5 時点・実装時にずれ得る）

各 catch は `reportError({...})` を呼ぶ形に統一する。

| 層 | 箇所 | 移行後 |
|---|---|---|
| **A 中核**（具体 operation + `classify: true`） | 425・431 convertMarkdownToHtml / 467 makeHtml / 477 exportHtml / 628 exportPdf | `{ operation: '<具体文言>', where: '<関数名>()', error, context?, classify: true }`。例 exportPdf → `'Failed to export ' + type + '.'` |
| **resolver-reason**（A の一部） | 535・542 | 上記 reason スイッチに置換 |
| **B-export**（共有 `EXPORT_FAILED_MSG`・hint 無し） | 212 markdownPdf / 227 markdownPdfOnSave / 668 getOutputDir catch / 712 readStyles / 739 fixHref | `{ operation: EXPORT_FAILED_MSG, where: '<関数名>()', error }` |
| **B-generic**（共有 `GENERIC_ERROR_MSG`・hint 無し） | 238 isMarkdownPdfOnSaveExclude / 765 checkPuppeteerBinary / 882 init | `{ operation: GENERIC_ERROR_MSG, where: '<関数名>()', error }` |
| **C 用意文言**（既存文言を operation に） | 160・201・208 型ガード / 655 outputDirectory 無し / 814 installChromium DL 失敗 | `{ operation: '<既存文言>', where: '<関数名>()', error?, context? }` |

- **共有文言を 2 本に分ける（P2 対応）**。export 経路と extension/config 経路で状況が違うため:
  - `EXPORT_FAILED_MSG`（例 `'Markdown PDF: export failed. The file was not generated.'`）= 変換・出力の最中に起きた失敗。「ファイルが生成されない」が正しい awareness。
  - `GENERIC_ERROR_MSG`（例 `'Markdown PDF: an unexpected error occurred.'`）= 起動時（`init`/`checkPuppeteerBinary`）や on-save 除外判定（`isMarkdownPdfOnSaveExclude`）など、export 中とは限らない経路。「ファイルが生成されない」とは書かない。
  - 文言は実装時に最終化。詳細は Show Details へ誘導。
- C の 814（installChromium）は `setProxy()` 後のダウンロード失敗。既存文言が proxy/インストールに言及済みのため operation に流用するが、**含まれる `#install` を `#chromium` に修正**。`installChromium` の `if (resolution)` → `if (resolution.ok)`、`else throw` の文言（現 803）は内部用なので維持。
- C の 655（`getOutputDir` 事前チェック）は出力先の不在を Chromium 起動前に検出する経路。文言を簡潔化（`'The output directory does not exist: ' + outputDirectory`）し、**Open Settings(`@id:markdown-pdf.outputDirectory`) を付与**する（rule 4 と同じ救済を早期経路でも提供。手動検証で判明）。実際の「出力先不在」はこの事前チェックで止まり、rule 4 は書き込み経路の ENOENT/EISDIR の backstop として残す。
- **全層共通**: 関数名はトーストに出さずログ（`where`）へ。`Show Details` ボタンを必ず付与。

## README アンカー（P1 対応）

現 `README.md` に `#install` 見出しは**存在しない**（既存コード `extension.ts` の 539/542/816 のリンクは壊れている）。Chromium 関連の実在見出しは:

- `## Chromium` → `#chromium`（トップ節・最も網羅的で安定）
- `### How is the Chromium browser selected?` → `#how-is-the-chromium-browser-selected`
- `### Where is Chromium downloaded?` → `#where-is-chromium-downloaded`

本 spec が触れる全メッセージ・action の Learn More 先は **`#chromium`** に統一する（汎用の「Chromium 取得/設定の案内」）。これにより、移行する文言（autodownload-disabled / download-failed / installChromium）に残っていた壊れた `#install` も同時に修正される。

## データフロー（トースト vs ログ）

```
catch (error) → reportError({ operation, where, error, context?, classify? , action? })
  ├ ログ②（Show Details で前面化）:
  │    operation（人間向け要約）/ where（関数名）/ context（1行サマリ）/ Hint: …（あれば）/ formatError(error)（message+stack）
  └ トースト:
       ERROR: <operation>（classify で hint があれば " — <hint>"）
       ボタン: [<action.label>?] [Show Details]
         action.label 押下 → openSettings(@id:…) / openExternal(README#chromium)
         Show Details 押下 → logger.showLog()
```

## エラーハンドリング

- `classifyError` / `isNetworkError` は純粋関数で、空入力・非 Error 値でも例外を投げない（`undefined`/`false` を返す）。
- `reportError` は `error` 未指定でも成立（Tier C / resolver-reason は error 無し）。`classify` が false または error 無しなら hint 計算をスキップ。
- resolver の `reason` 付き失敗は「握り潰し」ではない。生エラーは従来どおり `logError`/`logWarn` でログに残し、`reason` は UI 提示のための要約。
- Tier B は hint を付けない（読み取り系エラー等を書き込みヒントで誤誘導しないため）。

## テスト戦略

### ユニットテスト（tsx、実 VS Code 不要）

- `test/unit/diagnostics.test.ts`（追加）— `classifyError`:
  - ルール 1〜4 各々が期待 hint（部分一致）と action（kind/query）を返す。
  - 順序: 「`Failed to launch the browser process`」かつ `code: 'EACCES'` を持つエラーで**ルール 1**（起動失敗）に分類されること。
  - `code` ベース（`{ code: 'EBUSY' }` 等の擬似エラー）と message ベース両方で発火すること。
  - 未該当 → `undefined`。非 Error 値（文字列）でも安全。
- `test/unit/chromium-resolver.test.ts`（更新）— `isNetworkError`: network code 群で `true`、無関係エラーで `false`、非 Error で `false`。
  - 既存 6 箇所（359/403/448/496/543/580）の戻り値参照を新ユニオンに更新（`result.ok` / `result.path` / `result.reason`）。
  - 失敗経路: autoDownload off+cache 無し → `reason: 'autodownload-disabled'`、ダウンロード失敗（network 注入）→ `'network'`、その他失敗 → `'download-failed'`。
  - **P2**: JSON fetch を network エラーで失敗させ（`setJsonFetcherForTesting` で network 例外を投げる）、cache 無し・bundled download も失敗 → 最終 `reason` が `'network'` になること（fetch 段の network が伝播する）。

### 手動検証（dev host F5）

- **起動失敗**: `markdown-pdf.executablePath` に無効パス → トースト「Chromium could not be started…」+ `[Open Settings][Show Details]`。Open Settings で executablePath にジャンプ。
- **書き込みロック（EBUSY）**: 出力 PDF を別アプリで開いたまま再エクスポート → 「Cannot write the output file…」hint（ボタンは Show Details のみ）。
- **出力先不正（ENOENT/EISDIR）**: `outputDirectory` に存在しないフォルダ → 「The output path is invalid…」+ Open Settings(outputDirectory)。
- **resolver-reason**: autoDownload off かつブラウザ無し → autodownload-disabled 文言 + Open Settings。
- **Show Details**: 押下でログに 関数名 + context + Hint + message + stack が出て前面化。
- **Learn More**: download-failed 等で押下 → ブラウザで README の `#chromium` が開く。
- **sanitize トースト**: ボタンが `Show Details` に変わっていること。

### 自動検証

- `npm run check`（tsc クリーン）/ `npm run build`（esbuild 成功）/ `npm run test:unit`（既存 + 追加が全 pass、回帰なし）。

## 検証で確定した前提（再現実験）

`puppeteer-core@24.40.0` の `page.pdf({ path })` は、書き込み失敗時に **raw fs エラーをそのまま伝播**する（ラップせず `code`/`errno`/`syscall` 健在、message にも code トークンを含む）。実機で確認:

- 親ディレクトリ無し → `code: 'ENOENT'`
- 出力先がディレクトリ → `code: 'EISDIR'`
- 別プロセスが共有拒否ロック（実際に PDF を開いた状態相当）→ `code: 'EBUSY'`

→ `classifyError` の code ベース検出は信頼できる。二段マッチ（code 主・message 予備）はラップ耐性の保険。

## 採用済みデフォルト（レビューで異議があれば再検討）

- 文言は英語統一。トーストは 1 行（VS Code 通知は改行非対応）。
- リンクは README.md（英語）の `#chromium`。アクションはボタン（通知メッセージ内の markdown リンクは描画されないため）。
- 設定ジャンプは `workbench.action.openSettings('@id:…')`（GUI 設定エディタ。ユーザーの `workbench.settings.editor` 設定を尊重）。
- `Show Output` → `Show Details` 改名（error/sanitize 両トースト）。
- helper はリネーム（`showErrorMessage` → `reportError`）して vscode API との衝突を解消。
- Tier B は共有文言 2 本（export 用 / generic 用）。個別文言は書かない。hint は Tier A のみ。
- README / CHANGELOG はリリース準備時に一括更新（本ブランチでは触らない）。
- 本 spec は 1 フェーズで A/B/C を一括実装する（Tier B を別 PR に分割しない）。
