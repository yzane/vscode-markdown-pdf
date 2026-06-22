# エラー通知の有益化（対処ヒント + Show Details + resolver 理由伝播）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エラー時のトーストを「人間向けの awareness ＋ よくある失敗の対処 hint」に変え、関数名/スタック等の詳細は `Show Details`（ログ）へ。原因が特定可能なのに `null` 化していた resolver の失敗理由（network/proxy 等）も救済する。

**Architecture:** 純粋関数（`classifyError` / `isNetworkError`）を `diagnostics.ts` / `chromium-resolver.ts` に置き（tsx テスト可能）、vscode 依存のアクション実行・トースト表示は `extension.ts` の `reportError`（旧 `showErrorMessage` をリネーム）に閉じる。`resolveChromiumPath` を判別ユニオン化して失敗理由を伝播。

**Tech Stack:** TypeScript / VS Code Extension API / esbuild / tsx（test:unit、`node:test`+`node:assert/strict`）。

**Spec:** [`docs/superpowers/specs/20260622-01-error-message-hints-design.md`](../specs/20260622-01-error-message-hints-design.md)

**Branch:** `feature/error-message-hints`（worktree: `.worktrees/feature-error-message-hints`）。全タスクこのブランチで実施。

---

## 全体の制約

- `diagnostics.ts` / `chromium-resolver.ts` は vscode/os 非依存を維持（`tsx --test` で決定論的にテスト）。`extension.ts` は vscode 依存でユニットテスト対象外 → 検証は `npm run check`（型）＋ `npm run build`（バンドル）＋ 手動 F5。
- **`resolveChromiumPath` のユニオン化は `extension.ts` の 2 caller（`exportPdf`/`installChromium`）を型エラーにする**。したがって `npm run check`（全体 tsc）が緑になるのは Task 3 完了後。Task 2 は `npm run test:unit`（resolver/diagnostics のみ走る）でゲートする。
- コードコメントは英語（リポジトリ方針）。文言は英語統一。コマンドは worktree ルートで実行。
- README / README.ja / CHANGELOG は触らない（リリース準備時に一括）。
- 新規 worktree には `node_modules` が無く `tsconfig` の `typeRoots` が `./node_modules/@types` 固定のため、root の `node_modules` へジャンクション必須（張らないと TS2688）。本 worktree は作成時に張り済み。

## ファイル構成

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/diagnostics.ts` | `ErrorActionSpec`/`ErrorHint` 型 + `classifyError`（4 ルール）追加 | 修正 |
| `src/chromium-resolver.ts` | `isNetworkError` + `ChromiumResolution` ユニオン + `ChromiumFailureReason` + reason 伝播（fetch 段 network フラグ含む） | 修正 |
| `src/extension.ts` | `showErrorMessage`→`reportError` リネーム/options 化、全 catch 移行、reason switch、`Show Details` 改名、`notifySanitize` 追随、`runAction` | 修正 |
| `test/unit/diagnostics.test.ts` | `classifyError` テスト追加 | 修正 |
| `test/unit/chromium-resolver.test.ts` | `isNetworkError` + 新ユニオン戻り値テスト追加、既存 6 箇所更新 | 修正 |

---

## Task 0: ブランチ / worktree のプリフライト

**Files:** docs（spec/plan）を本タスクでコミット

- [ ] **Step 1: safe.directory 設定（dubious ownership 回避・防御的）**

環境によっては worktree 内で `git` が `dubious ownership` で失敗する（実行を最初の git 操作で止める）。先に信頼登録しておく（冪等・不要な環境では実害なし）:
Run: `git config --global --add safe.directory C:/work/github/yzane/vscode-markdown-pdf/.worktrees/feature-error-message-hints`
（main 側の git 操作も詰まる場合は `C:/work/github/yzane/vscode-markdown-pdf` も追加。）

- [ ] **Step 2: ブランチ確認**

Run: `git branch --show-current && git status --short`
Expected: `feature/error-message-hints`。作業ツリーは spec/plan の 2 ファイルのみ未コミット。

- [ ] **Step 3: 依存とベースライン**

Run: `npm run check && npm run test:unit`
Expected: 型エラーなし。既存ユニットテスト全 pass（ベースライン緑）。node_modules ジャンクションが無ければ先に張る。

- [ ] **Step 4: spec/plan を先にコミット（実装 diff を汚さないため）**

承認済みの spec/plan を実装前にコミットしておく（Task 4 の diff を実装 5 ファイルだけに保つ）:
```
git add docs/superpowers/specs/20260622-01-error-message-hints-design.md docs/superpowers/plans/20260622-01-error-message-hints.md
git commit -m "docs: add design spec and plan for error-message-hints"
```

---

## Task 1: `diagnostics.ts` に `classifyError` を追加（TDD）

**Files:**
- Modify: `test/unit/diagnostics.test.ts`（テスト追加）
- Modify: `src/diagnostics.ts`（`ErrorActionSpec` / `ErrorHint` / `classifyError`）

- [ ] **Step 1（RED）: テストを先に書く**

`diagnostics.test.ts` に `describe('classifyError')` を追加（spec「テスト戦略」の通り）:
- ルール 1（起動失敗 msg）→ hint に `/Chromium/`、action `kind:'settings', query:'@id:markdown-pdf.executablePath'`。
- ルール 2（`{code:'EBUSY'}` 擬似エラー / `EPERM` / `EACCES`、および msg ベース）→ hint に `/write the output file/`、action なし。
- ルール 3（`code:'ENOSPC'` / msg）→ hint に `/space/`。
- ルール 4（`code:'ENOENT'` / `EISDIR` / msg）→ hint に `/output path/`、action `@id:markdown-pdf.outputDirectory`。
- **順序**: `new Error('Failed to launch the browser process')` に `code:'EACCES'` を付与 → ルール 1 に分類（2 に落ちない）。
- 未該当 `new Error('totally unexpected')` → `undefined`。非 Error 値（文字列 `'EACCES: denied'`）でも分類可。

Run: `npm run test:unit`
Expected: 新規テストが **FAIL**（`classifyError` 未実装）。

- [ ] **Step 2（GREEN）: 実装**

`src/diagnostics.ts` に追加（vscode/os 非 import を維持）:
```ts
export type ErrorActionSpec =
  | { kind: 'settings'; query: string; label: string }
  | { kind: 'url'; url: string; label: string };
export interface ErrorHint { hint: string; action?: ErrorActionSpec; }
export function classifyError(error: unknown): ErrorHint | undefined { /* 4 rules, code-first */ }
```
`code` 取得は `(error as NodeJS.ErrnoException)?.code`、message は `error instanceof Error ? error.message : String(error)`。判定順は 1→2→3→4、未該当 `undefined`。

Run: `npm run test:unit`
Expected: classifyError テスト含め全 pass。

- [ ] **Step 3: 型チェック**

Run: `npm run check`
Expected: エラーなし（`diagnostics.ts` は独立、caller 未変更でも緑）。

---

## Task 2: `chromium-resolver.ts` に `isNetworkError` + ユニオン + reason 伝播（TDD）

**Files:**
- Modify: `test/unit/chromium-resolver.test.ts`（追加 + 既存 6 更新）
- Modify: `src/chromium-resolver.ts`

- [ ] **Step 1（RED）: テスト**

`chromium-resolver.test.ts` に追加:
- `describe('isNetworkError')`: `{code:'ETIMEDOUT'}`/`ECONNREFUSED`/`ENOTFOUND`/`EAI_AGAIN`/`ECONNRESET` で `true`、`{code:'ENOSPC'}` や無関係 Error で `false`、非 Error で `false`。
- 既存 6 箇所（359/403/448/496/543/580）の参照を新ユニオンへ更新（`result.ok === true && result.path === …` / 失敗は `result.ok === false && result.reason === …`）。
- 失敗経路: autoDownload off + cache 無し → `reason:'autodownload-disabled'`、latest download を network エラーで失敗 → `'network'`、非 network 失敗 → `'download-failed'`。
- **P2**: `setJsonFetcherForTesting` で JSON fetch を network 例外にし、cache 無し・bundled download も失敗（`fs`/`PB.install` をスタブ）→ 最終 `reason:'network'`。

Run: `npm run test:unit`
Expected: 新規が **FAIL**（`isNetworkError` 未実装・ユニオン未対応）。

- [ ] **Step 2（GREEN）: 実装**

`src/chromium-resolver.ts`:
```ts
export type ChromiumResolution =
  | { ok: true; path: string; source: ChromiumSource }
  | { ok: false; reason: ChromiumFailureReason };
export type ChromiumFailureReason = 'autodownload-disabled' | 'network' | 'download-failed';
export function isNetworkError(error: unknown): boolean { /* code-first, msg-fallback */ }
```
- `resolveChromiumPath` の成功 return を `{ ok:true, path, source }` に、各 `return null` を理由付き失敗に置換（spec の表）。
- `fetchLatestStableBuildId()` の catch で `cachedLatestFetchNetworkError = isNetworkError(error)` を記録。最終失敗 reason は `(isNetworkError(error) || cachedLatestFetchNetworkError) ? 'network' : 'download-failed'`。
- `resetLatestBuildIdCache()` で `cachedLatestFetchNetworkError = false` も初期化。

Run: `npm run test:unit`
Expected: resolver/diagnostics 全 pass。

> 注: この時点で `npm run check`（全体 tsc）は `extension.ts` の 2 caller が旧 `null` 形のままのため **赤**。Task 3 で解消する。

---

## Task 3: `extension.ts` — `reportError` 化 + 全 catch 移行 + reason switch

**Files:**
- Modify: `src/extension.ts`

> ユニットテスト対象外。検証は型・バンドル・手動。

- [ ] **Step 1: `reportError` 本体**

`showErrorMessage` を `reportError(r: ErrorReport)` にリネームし options 化（spec「`reportError` 再設計」の擬似コードの通り）。`classifyError` 連携、`action` 優先、ログ順（where→context→Hint→formatError）、トースト＝`operation`(+hint)、ボタン＝`[action?.label, SHOW_DETAILS_ACTION]`。`runAction(action)` で `vscode.env.openExternal(vscode.Uri.parse(action.url))` / `vscode.commands.executeCommand('workbench.action.openSettings', action.query)` を実行。トースト表示は `vscode.window.showErrorMessage(...)`。

- [ ] **Step 2: 定数 `Show Details` 改名 + `notifySanitize` 追随**

`SHOW_OUTPUT_ACTION = 'Show Output'` → `SHOW_DETAILS_ACTION = 'Show Details'`。`notifySanitize` の `showWarningMessage` ボタンも新定数へ。

- [ ] **Step 3: 共有文言定数を定義**

`EXPORT_FAILED_MSG`（例 `'Markdown PDF: export failed. The file was not generated.'`）、`GENERIC_ERROR_MSG`（例 `'Markdown PDF: an unexpected error occurred.'`）、`AUTO_DOWNLOAD_DISABLED_MSG`（現 520-525 文言・`#install`→`#chromium`）。

- [ ] **Step 4: Tier A 移行（classify:true）**

425/431 convertMarkdownToHtml、467 makeHtml、477 exportHtml、628 exportPdf を `reportError({ operation:'<具体>', where:'<関数名>()', error, context?, classify:true })` に。exportPdf は `'Failed to export ' + type + '.'`。convert/makeHtml は既存の `buildContextSummary(ctx, homeDir)` を `context` に維持。

- [ ] **Step 5: exportPdf の null 分岐 → reason switch**

535/542 を spec の `switch (resolution.reason)` に置換（autodownload-disabled / network / download-failed、各 action 付き、URL は `#chromium`）。`if (!resolution.ok)` でガード。

- [ ] **Step 6: Tier B / C 移行 + installChromium**

- B-export（212/227/668/712/739）→ `{ operation:EXPORT_FAILED_MSG, where, error }`。
- B-generic（238/765/882）→ `{ operation:GENERIC_ERROR_MSG, where, error }`。
- C（160/201/208/655/814）→ `{ operation:'<既存文言>', where, error?, context? }`。814 の `#install`→`#chromium`。
- `installChromium`（792）の `if (resolution)` → `if (resolution.ok)`。

- [ ] **Step 7: 型チェック + バンドル**

Run: `npm run check && npm run build`
Expected: いずれもエラーなし（caller 更新で resolver ユニオンが解決、全 20 箇所が新 `reportError` 署名に適合）。

---

## Task 4: 検証

**Files:** （変更なし）

- [ ] **Step 1: 自動検証**

Run: `npm run check && npm run build && npm run test:unit`
Expected: 型クリーン / バンドル成功 / 全 pass（既存 + 追加、回帰なし）。

- [ ] **Step 2: 手動 F5（dev host）**

- 起動失敗（`executablePath` 無効）→「Chromium could not be started…」+ `[Open Settings][Show Details]`、Open Settings が executablePath にジャンプ。
- 書込ロック（出力 PDF を開いたまま再 export）→「Cannot write the output file…」（ボタン Show Details のみ）。
- 出力先不正（`outputDirectory` に存在しないフォルダ）→「The output path is invalid…」+ Open Settings(outputDirectory)。
- autoDownload off + ブラウザ無し → autodownload-disabled 文言 + Open Settings。
- Show Details → ログに 関数名 + context + Hint + message + stack、チャネル前面化。
- Learn More（download-failed 等）→ README `#chromium` がブラウザで開く。
- sanitize トーストのボタンが `Show Details`。

- [ ] **Step 3: 差分レビュー**

Run: `git --no-pager diff --stat`
Expected: `diagnostics.ts` / `chromium-resolver.ts` / `extension.ts` / 両テストの 5 ファイル。

---

## Task 5: コミット

**Files:** （変更なし）

- [ ] **Step 1: 実装をコミット**

（spec/plan は Task 0 Step 4 でコミット済み。）
```
git add src/ test/
git commit -m "feat: human-readable error toasts with actionable hints and Show Details"
```
（必要なら resolver/diagnostics と extension を分割コミットしても良い。）

- [ ] **Step 2: develop へのマージ（承認ゲート）**

AGENTS.md「マージ前に確認・承認を待つ」に従い、ユーザー承認後に `develop` へローカルマージ。マージ後に `node_modules` ジャンクションを外して `git worktree remove`。

---

## Self-Review チェック結果

- **Spec coverage**: spec「やること」1（reportError 化＝Task 3）/2（classifyError＝Task 1）/3（resolver ユニオン+isNetworkError＝Task 2）/4（reason switch＝Task3 Step5）/5（Show Details+Open Settings/Learn More＝Task3 Step1-2）/6（~20 箇所移行＝Task3 Step4-6）/7（installChromium .ok＝Task3 Step6）/8（ユニットテスト＝Task1/2）を網羅。
- **TDD**: 純粋関数（classifyError / isNetworkError + resolver reason）はテスト先行（Task1/2 の RED→GREEN）。extension.ts は vscode 依存で対象外のため型/バンドル/手動で担保（既存方針）。
- **check が緑になる順序**: diagnostics（Task1）→ resolver（Task2、check は一時的に赤）→ extension caller 更新（Task3）で緑回復。本文「全体の制約」に明記。
- **Placeholder scan**: 文言（EXPORT_FAILED_MSG 等）は spec の例示を最終化する旨明記。TODO/TBD は残さない。
- **未完**: Task 5 Step 2（develop マージ）はユーザー承認ゲート。
