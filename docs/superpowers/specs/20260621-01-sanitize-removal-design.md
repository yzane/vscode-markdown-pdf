# サニタイズ除去＋通知 設計

## 背景・目的

issue #437 の核心修正。Markdown 本文中の `<style>` は、現状の `sanitize: "gfm"`（既定）が GFM 仕様どおり禁止タグの先頭 `<` を `&lt;` にエスケープ**するだけで中身を残す**ため、CSS が適用されずリテラルテキストとして PDF に出力される。`<script>` も同様に JS がテキストとして残り、`<iframe>` はエスケープされてタグがテキスト表示される。

本 spec は以下を統合実装する（要素①＋②a。結合度が高い＝通知は「何を除去したか」を①の結果から得るため）:

- **要素①: サニタイズ除去** — `<style>`/`<script>`/`<iframe>` を「エスケープ」から「中身ごと完全除去」に変更。
- **要素②a: サニタイズ通知** — 除去・属性除去が起きたとき、ユーザーに通知（手動エクスポート時はトースト＋「Show Output」ボタン、保存時自動変換は OutputChannel のみ）。

前提として完了済み:
- 要素③（OutputChannel ロガー基盤、`logger.ts` / `logInfo|logWarn|logError` / `showLog()`、develop マージ済 `fcc06f9`）
- 要素②b（ログ動線、エラートーストの「Show Output」ボタン＝`SHOW_OUTPUT_ACTION` 定数、develop マージ済 `879db3d`）

ブランチ: `bugfix/sanitize-removal`（`develop` から分岐、`.worktrees/bugfix-sanitize-removal`）。

## スコープ

### やること

1. `sanitizeRawHtml`（`utils.ts`）: `<style>`/`<script>`/`<iframe>` を中身ごと除去。戻り値を「除去内容のレポート付き」に変更。
2. 除去・属性除去のレポートを変換単位で集約し、通知（トースト／チャネル）を出す（`extension.ts`）。

### やらないこと（対象外）

- その他の GFM 禁止タグ（`title`/`textarea`/`xmp`/`noembed`/`noframes`/`plaintext`）の挙動変更 — 従来どおり `&lt;` エスケープ（中身はテキストとして残る）。
- エスケープ(c) を通知対象にすること — 画面に見えるため除外。除去(a)と属性除去(b)のみ通知。
- `README` / `CHANGELOG` の更新 — リリース準備時に要素③②b と合わせて一括（破壊的変更メモを含む）。
- 既存の include エラー通知（レンダー後の `showWarningMessage`）の変更。

## アーキテクチャ

### 除去対象と挙動

GFM 禁止タグ集合（`getDisallowedTags`）は不変（9種: `title, textarea, style, xmp, iframe, noembed, noframes, script, plaintext`、`gfm-allow-style` は `style` を除外、`none` は空）。

新たに「中身ごと除去」集合を定義:

```ts
// Disallowed tags whose entire element (open tag + content + close tag) is removed,
// rather than escaped. These render as noise or are unsafe in a PDF context:
// <style>/<script> dump their text content; <iframe> cannot function and is unsafe.
const REMOVE_WITH_CONTENT = new Set(['style', 'script', 'iframe']);
```

`sanitizeRawHtml` の禁止タグ処理を2分岐:

- タグが**禁止**かつ `REMOVE_WITH_CONTENT` に含まれ、**開始タグ**のとき → 同一トークン内で対応する閉じタグ `</tag>`（大文字小文字無視）を探し、**開始〜中身〜終了を丸ごと削除**。閉じタグが同トークンに無ければ開始タグのみ削除（graceful degrade）。`report.removedElements` に当該タグ名を記録。
- タグが**禁止**かつ `REMOVE_WITH_CONTENT` の**閉じタグ**が単独で現れたとき（開始と対になっていない異常系）→ 黙って削除（記録しない）。
- タグが**禁止**だが `REMOVE_WITH_CONTENT` に**含まれない**（エスケープ集合）とき → 従来どおり `&lt;` + `tag.slice(1)`。
- タグが**非禁止**のとき → 従来どおり `stripDangerousAttributes`。除去された属性を `report.strippedAttributes` に集約。

`gfm-allow-style` では `style` が禁止集合に無いため、除去もエスケープもされず素通り（既存の回避策の挙動を維持）。`none` は全体無変換・レポート空。

#### トークン化の前提（重要）

markdown-it は `<style>`/`<script>` を raw-text ブロック（HTML block type 1）として**開始〜中身〜閉じを1トークン**にまとめる。そのため `sanitizeRawHtml` が受け取る1トークン内で要素全体を確実に除去でき、CSS/JS 本文が残らない（#437 解決）。`<iframe>`（type 6）も単一行/空行を挟まない範囲なら同トークン。空行をまたぐ稀なケースは degrade（タグ除去・内側 markdown は残りうる）。

### レポート返却（戻り値の型変更）

```ts
export interface SanitizeReport {
  removedElements: string[];    // 除去した要素名（出現ごと）例 ['style','script','script']
  strippedAttributes: string[]; // 除去した属性の識別子（出現ごと）例 ['onclick','href(javascript:)']
}

export function sanitizeRawHtml(html: string, mode: SanitizeMode): { html: string; report: SanitizeReport }
```

- 内部関数 `stripDangerousAttributes(tag)` を `{ tag: string; stripped: string[] }` を返す形にリファクタ（`on*` は属性名、`href`/`src` の `javascript:` は `name(javascript:)` 形式で記録）。`sanitizeRawHtml` が集約。
- `mode === 'none'` または空入力時は `{ html, report: { removedElements: [], strippedAttributes: [] } }` を返す。

### 集約と通知（②a）

**集約点**: `convertMarkdownToHtml`（`extension.ts`）。html_block/html_inline レンダラ規則の各 `sanitizeRawHtml` 呼び出しのレポートを、クロージャ変数 `report`（`{ removedElements: [], strippedAttributes: [] }`）に蓄積。`md.render()` 後に確定。

**戻り値**: `convertMarkdownToHtml` を `{ html: string; report: SanitizeReport } | undefined` に変更（唯一の呼び出し元 `markdownPdf` を更新）。

**重複回避**: `markdownPdf` は型ごとに `convertMarkdownToHtml` を呼ぶ（`all` で複数回）が、レポートはソース＋mode に依存し型非依存で毎回同一。よって**変換ループ後に1回だけ通知**する。

**通知の出し分け**: `markdownPdf(option_type, isOnSave = false)` に引数追加。`markdownPdfOnSave` は `markdownPdf('settings', true)` で呼ぶ。

```ts
function notifySanitize(report: SanitizeReport, mode: utils.SanitizeMode, isOnSave: boolean): void {
  if (report.removedElements.length === 0 && report.strippedAttributes.length === 0) {
    return;
  }
  // Always record details to the output channel (manual and on-save).
  logger.logWarn(utils.buildSanitizeLogDetail(report, mode));
  // Toast only on explicit/manual export to avoid spamming on convertOnSave.
  if (!isOnSave) {
    vscode.window.showWarningMessage(utils.buildSanitizeSummary(report), SHOW_OUTPUT_ACTION).then(function (selection) {
      if (selection === SHOW_OUTPUT_ACTION) {
        logger.showLog();
      }
    });
  }
}
```

`mode` は `markdownPdf` が `vscode.workspace.getConfiguration('markdown-pdf')['sanitize']`（既定 `'gfm'`）から取得して渡す（`convertMarkdownToHtml` 内の読み取りと同じ設定。設定読み取りは冪等で安価）。

- `SHOW_OUTPUT_ACTION` は要素②b で `extension.ts` に既存の定数を再利用。
- 文字列組み立て `buildSanitizeSummary(report)` / `buildSanitizeLogDetail(report, mode)` は集計の**純粋関数**として `utils.ts` に置き、ユニットテスト可能にする（サマリは mode 不使用、詳細のみ mode を出力）。
  - 詳細（チャネル）例:
    ```
    Sanitized raw HTML (mode: gfm): removed <style>×1, <script>×2; stripped onclick×1, href(javascript:)×1.
    Tip: to keep <style>, set "markdown-pdf.sanitize": "gfm-allow-style".
    ```
    `gfm-allow-style` のヒントは **`removedElements` に `style` を含むときのみ**付与。
  - サマリ（トースト）例: `Markdown PDF: removed potentially unsafe HTML (<style>, <script>). See output for details.`（種類を列挙、件数は詳細側）。

## データフロー

```
markdownPdf(type, isOnSave)
  └ 型ごとに convertMarkdownToHtml(filename, type, text)
        ├ html_block/html_inline 規則が sanitizeRawHtml(content, mode) を呼ぶ
        │     → { html, report } を返し、クロージャの report に集約
        ├ md.render() 後、{ html, report } を返す
  └ ループ後 notifySanitize(report, mode, isOnSave)
        ├ logWarn(buildSanitizeLogDetail(report, mode))        … 常時チャネルへ
        └ !isOnSave: showWarningMessage(summary, 'Show Output') … 手動時のみトースト
                       └ 押下 → logger.showLog()
```

## エラーハンドリング

- `sanitizeRawHtml` は例外を投げない純粋関数（既存同様）。閉じタグ未検出など異常系は graceful degrade。
- `notifySanitize` はレポート空なら何もしない。`logWarn` はチャネル未注入時 no-op（要素③の設計）。
- `showWarningMessage(...).then(...)` は fire-and-forget（要素②b と同じ）。

## テスト戦略

### ユニット（tsx・vscode 非依存・`utils.ts`）

`test/unit/utils.test.ts`（既存の sanitize 系テストを新シェイプに更新＋追加）:
- `sanitizeRawHtml`:
  - `<style>…css…</style>` が中身ごと消え `html` に残らない／`report.removedElements` に `style`。`<script>`・`<iframe>` も同様。
  - エスケープ集合（例 `<textarea>`）は従来どおり `&lt;textarea>` で中身が残り、`removedElements` に入らない。
  - 非禁止タグの `onclick` / `href="javascript:…"` が除去され `report.strippedAttributes` に記録（`onclick`、`href(javascript:)`）。
  - `gfm-allow-style`: `<style>` 素通り・レポート空。
  - `none`: 無変換・レポート空。
  - 閉じタグが同トークンに無い `<style>` 単独: 開始タグのみ除去（degrade）、`removedElements` に `style`。
  - 複数要素・複数属性の件数集計。
  - 既存の「コメント保持」「属性温存」等のケースが新シェイプ（`.html`）で維持されること。
- `buildSanitizeSummary` / `buildSanitizeLogDetail`（純粋関数）:
  - 件数集計が正しい（`<script>×2` 等）。
  - `gfm-allow-style` ヒントは `style` 除去時のみ。
  - 空レポートは呼ばれない前提（`notifySanitize` 側でガード）だが、念のため空時の出力も定義（空文字でなく安全な既定）。

### 手動（dev host・`extension.ts` は tsx 対象外）

- 手動エクスポート（`<style>`＋`<script>`＋`onclick` を含む .md）: PDF に CSS がリテラル表示されない／トーストに「Show Output」→押下でチャネルに詳細＋`gfm-allow-style` ヒント。
- 同じ .md で convertOnSave: **トーストなし**・チャネルに `logWarn` 記録あり。
- `sanitize: gfm-allow-style`: `<style>` が保持・適用され、style の除去通知は出ない（`<script>` は除去・通知される）。
- `all` エクスポート（複数型）: 通知は**1回だけ**。

## 採用済みデフォルト（レビューで異議があれば再検討）

- 中身ごと除去する集合は `style`/`script`/`iframe` の3つ。他の GFM 禁止タグはエスケープ維持。
- 通知は除去(a)＋属性除去(b)で発火、エスケープ(c)は対象外。
- 手動エクスポートのみトースト、convertOnSave はチャネルのみ。
- `gfm-allow-style` ヒントは詳細ログで `style` 除去時のみ。
- README/CHANGELOG はリリース時一括更新。
