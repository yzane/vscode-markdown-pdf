# サニタイズ除去＋通知 設計

## 背景・目的

issue #437 の核心修正。Markdown 本文中の `<style>` は、現状の `sanitize: "gfm"`（既定）が GFM 仕様どおり禁止タグの先頭 `<` を `&lt;` にエスケープ**するだけで中身を残す**ため、CSS が適用されずリテラルテキストとして PDF に出力される。`<script>` も同様に JS がテキストとして残り、`<iframe>` はエスケープされてタグがテキスト表示される。

本 spec は以下を統合実装する（要素①＋②a。結合度が高い＝通知は「何を除去したか」を①の結果から得るため）:

- **要素①: サニタイズ除去** — **ブロックレベル**の `<style>`/`<script>`/`<iframe>` を「エスケープ」から「中身ごと除去」に変更（inline は安全のためエスケープ維持。理由は後述のトークン化の前提）。
- **要素②a: サニタイズ通知** — 除去・属性除去が起きたとき、ユーザーに通知（手動エクスポート時はトースト＋「Show Output」ボタン、保存時自動変換は OutputChannel のみ）。

前提として完了済み:
- 要素③（OutputChannel ロガー基盤、`logger.ts` / `logInfo|logWarn|logError` / `showLog()`、develop マージ済 `fcc06f9`）
- 要素②b（ログ動線、エラートーストの「Show Output」ボタン＝`SHOW_OUTPUT_ACTION` 定数、develop マージ済 `879db3d`）

ブランチ: `bugfix/sanitize-removal`（`develop` から分岐、`.worktrees/bugfix-sanitize-removal`）。

## スコープ

### やること

1. `sanitizeRawHtml`（`utils.ts`）: **ブロックレベル**の `<style>`/`<script>`/`<iframe>` を中身ごと除去（`removeWithContent` オプションで切替）。戻り値を「除去内容のレポート付き」に変更。
2. レンダラ配線を vscode 非依存の新モジュール `markdown-it-sanitize.ts` に抽出（html_block は除去あり、html_inline は除去なし＝エスケープ）。markdown-it 経由の統合テストを可能にする。
3. 除去・属性除去のレポートを変換単位で集約し、通知（トースト／チャネル）を出す（`extension.ts`）。

### やらないこと（対象外）

- **inline raw HTML（`foo <script>…</script> bar` 等）の中身ごと除去** — markdown-it はインラインの開始タグ・中身・終了タグを**別トークンに分割**するため中身ごと除去できない（後述）。inline は従来どおり `&lt;` エスケープ（安全＝puppeteer で実行されない・テキスト表示。実例は稀）。本対応は**ブロックレベルの raw HTML 要素**に限定。
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

`sanitizeRawHtml(html, mode, options)` の禁止タグ処理は、`options.removeWithContent`（既定 `false`）で分岐する。**ブロック経路は `true`、インライン経路は `false`** で呼ぶ（後述の配線）。

- `removeWithContent === true` で、タグが**禁止**かつ `REMOVE_WITH_CONTENT` に含まれ、**開始タグ**のとき → 同一文字列内で対応する閉じタグ `</tag>`（大文字小文字無視）を探し、**開始〜中身〜終了を丸ごと削除**。閉じタグが無ければ開始タグのみ削除（graceful degrade）。`report.removedElements` に当該タグ名を記録。同 set の**閉じタグ単独**（開始と対にならない異常系）→ 黙って削除（記録しない）。
- `removeWithContent === false`（インライン）で、タグが `REMOVE_WITH_CONTENT` のとき → **エスケープ集合と同様に `&lt;` エスケープ**（中身は別トークンのため触れない。安全だがテキストとして残る）。
- タグが**禁止**だが `REMOVE_WITH_CONTENT` に**含まれない**（エスケープ集合: title/textarea/xmp/noembed/noframes/plaintext）とき → `removeWithContent` に関わらず従来どおり `&lt;` + `tag.slice(1)`。
- タグが**非禁止**のとき → 従来どおり `stripDangerousAttributes`。除去された属性を `report.strippedAttributes` に集約（block/inline 共通）。

`gfm-allow-style` では `style` が禁止集合に無いため、除去もエスケープもされず素通り（既存の回避策の挙動を維持）。`none` は全体無変換・レポート空。

#### トークン化の前提（重要）

markdown-it は `<style>`/`<script>` を raw-text ブロック（HTML block type 1）として**開始〜中身〜閉じを1トークン**（`html_block`）にまとめる。そのため html_block 経路（`removeWithContent: true`）の1トークン内で要素全体を確実に除去でき、CSS/JS 本文が残らない（#437 解決）。`<iframe>`（type 6）もブロック先頭・空行を挟まない範囲なら同様に1 `html_block` トークン。

一方、**インラインの raw HTML**（例 `foo <script>alert(1)</script> bar`）は `html_inline "<script>"` / `text "alert(1)"` / `html_inline "</script>"` の**別トークンに分割**される。1トークン内には開始タグしか無いため「中身ごと除去」は成立しない。よって html_inline 経路は `removeWithContent: false` とし、**従来どおりエスケープ**（`&lt;script>alert(1)&lt;/script>` 相当＝安全・テキスト表示）。ブロック iframe が空行をまたぐ稀なケースも degrade（タグ除去・内側 markdown は残りうる）。

### レポート返却（戻り値の型変更）

```ts
export interface SanitizeReport {
  removedElements: string[];    // 除去した要素名（出現ごと）例 ['style','script','script']
  strippedAttributes: string[]; // 除去した属性の識別子（出現ごと）例 ['onclick','href(javascript:)']
}

export interface SanitizeOptions {
  removeWithContent?: boolean;  // default false. true = block context (remove style/script/iframe with content)
}

export function sanitizeRawHtml(html: string, mode: SanitizeMode, options?: SanitizeOptions): { html: string; report: SanitizeReport }
```

- 内部関数 `stripDangerousAttributes(tag)` を `{ tag: string; stripped: string[] }` を返す形にリファクタ（`on*` は属性名、`href`/`src` の `javascript:` は `name(javascript:)` 形式で記録）。`sanitizeRawHtml` が集約。
- `mode === 'none'` または空入力時は `{ html, report: { removedElements: [], strippedAttributes: [] } }` を返す。
- `options` 省略時は `removeWithContent: false`。このとき `style`/`script`/`iframe` は（除去ではなく）従来どおり `&lt;` エスケープされる。なお戻り値型は `string` から `{ html, report }` に変わるため API としては破壊的変更で、全呼び出し元（`installSanitizeRules` 内）を更新する。

### レンダラ配線モジュール（`markdown-it-sanitize.ts`、vscode 非依存・新規）

html_block/html_inline のレンダラ規則を1箇所に集約し、ブロックは除去あり・インラインは除去なしで `sanitizeRawHtml` を呼ぶ。レポートは渡された collector に追記。vscode に依存しないため markdown-it 経由でユニットテスト可能。

```ts
import type MarkdownIt from 'markdown-it';
import { sanitizeRawHtml, SanitizeMode, SanitizeReport } from './utils';

export function installSanitizeRules(
  md: MarkdownIt,
  mode: SanitizeMode,
  report: SanitizeReport,                      // mutated collector
  transformBlock?: (html: string) => string,   // optional post-transform for html_block (non-html export types)
): void {
  function collect(content: string, removeWithContent: boolean): string {
    const result = sanitizeRawHtml(content, mode, { removeWithContent });
    report.removedElements.push(...result.report.removedElements);
    report.strippedAttributes.push(...result.report.strippedAttributes);
    return result.html;
  }
  md.renderer.rules.html_block = function (tokens, idx) {
    const html = collect(tokens[idx].content, true);   // block: remove with content
    return transformBlock ? transformBlock(html) : html;
  };
  md.renderer.rules.html_inline = function (tokens, idx) {
    return collect(tokens[idx].content, false);        // inline: escape only
  };
}
```

`convertMarkdownToHtml` は従来インラインに書いていた html_block/html_inline 規則をこの関数呼び出しに置き換える。`transformHtmlBlock`（非 html 型のときの後処理）は `transformBlock` コールバックとして渡す（`type !== 'html' ? (h) => utils.transformHtmlBlock(h, filename) : undefined`）。

### 集約と通知（②a）

**集約点**: `convertMarkdownToHtml`（`extension.ts`）。ローカルの collector `report`（`{ removedElements: [], strippedAttributes: [] }`）を生成し、`installSanitizeRules(md, sanitizeMode, report, transformBlock)` を呼ぶ。`md.render()` 中に各 html_block/html_inline トークンのサニタイズ結果が `report` に追記され、`md.render()` 後に確定。

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
        ├ installSanitizeRules(md, mode, report, transformBlock)
        │     html_block → sanitizeRawHtml(content, mode, {removeWithContent:true})  … ブロックは中身ごと除去
        │     html_inline → sanitizeRawHtml(content, mode, {removeWithContent:false}) … インラインはエスケープ
        │     各結果を collector report に追記
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
- `sanitizeRawHtml`（`removeWithContent: true` ＝ブロック経路相当）:
  - `<style>…css…</style>` が中身ごと消え `html` に残らない／`report.removedElements` に `style`。`<script>`・`<iframe>` も同様。
  - エスケープ集合（例 `<textarea>`）は従来どおり `&lt;textarea>` で中身が残り、`removedElements` に入らない。
  - 閉じタグが無い `<style>` 単独: 開始タグのみ除去（degrade）、`removedElements` に `style`。
  - 複数要素・複数属性の件数集計。
- `sanitizeRawHtml`（`removeWithContent: false` ＝インライン経路相当 / 既定）:
  - `<style>` / `<script>` / `<iframe>` 単独タグが `&lt;` エスケープされ、`removedElements` は空（インラインは除去しない）。
- `sanitizeRawHtml`（共通）:
  - 非禁止タグの `onclick` / `href="javascript:…"` が除去され `report.strippedAttributes` に記録（`onclick`、`href(javascript:)`）。
  - `gfm-allow-style`: `<style>` 素通り・レポート空。`none`: 無変換・レポート空。
  - 既存の「コメント保持」「属性温存」等のケースが新シェイプ（`.html`）で維持されること。
- `buildSanitizeSummary` / `buildSanitizeLogDetail`（純粋関数）:
  - 件数集計が正しい（`<script>×2` 等）。
  - `gfm-allow-style` ヒントは `style` 除去時のみ。
  - 空レポートは呼ばれない前提（`notifySanitize` 側でガード）だが、念のため空時の出力も定義（空文字でなく安全な既定）。

### 統合（tsx・vscode 非依存・`markdown-it-sanitize.ts` ＋ markdown-it 実体）

`test/unit/markdown-it-sanitize.test.ts`（新規）。`markdownIt({ html: true })` に `installSanitizeRules(md, 'gfm', report)` を適用して `md.render(...)` し、トークン化を含めて検証（レビュアー指摘の inline ケースを実体で担保）:
- **ブロック**: 行頭 `<style>body{color:red}</style>` → 出力に `body{color:red}` も `<style>` も残らない／`report.removedElements` に `style`。行頭 `<script>alert(1)</script>`・`<iframe src="x"></iframe>`（単一行）も同様に除去・記録。
- **インライン（除去されずエスケープ）**:
  - `foo <script>alert(1)</script> bar` → 出力に実行可能な `<script>` が無く、`alert(1)` はテキストとして残り、`&lt;script` を含む。`report.removedElements` は空。
  - `foo <style>body{}</style> bar` → 同様にエスケープ（`body{}` はテキスト）。
  - `foo <iframe>fallback</iframe> bar` → 同様にエスケープ（`fallback` はテキスト）。
- `gfm-allow-style` で行頭 `<style>` がそのまま出力に残る（除去されない）。

### 手動（dev host・`extension.ts` は tsx 対象外）

- 手動エクスポート（行頭 `<style>`＋`<script>`＋`onclick` を含む .md）: PDF に CSS がリテラル表示されない／トーストに「Show Output」→押下でチャネルに詳細＋`gfm-allow-style` ヒント。
- 同じ .md で convertOnSave: **トーストなし**・チャネルに `logWarn` 記録あり。
- `sanitize: gfm-allow-style`: `<style>` が保持・適用され、style の除去通知は出ない（`<script>` は除去・通知される）。
- `all` エクスポート（複数型）: 通知は**1回だけ**。

## 採用済みデフォルト（レビューで異議があれば再検討）

- 中身ごと除去するのは**ブロックレベル**の `style`/`script`/`iframe` のみ。inline raw HTML はエスケープ維持（安全・稀）。他の GFM 禁止タグもエスケープ維持。
- 通知は除去(a)＋属性除去(b)で発火、エスケープ(c)は対象外。
- 手動エクスポートのみトースト、convertOnSave はチャネルのみ。
- `gfm-allow-style` ヒントは詳細ログで `style` 除去時のみ。
- README/CHANGELOG はリリース時一括更新。
