# 変換失敗時の export スキップ（未定義HTMLガード）設計

> **状態:** 本 spec/plan はレビュー機会確保のため**実装後に後追い作成**した。実装は `bugfix/skip-export-on-html-failure` のコミット `326860c`（検証済み・`develop` 未マージ）。

## 背景・目的

変換に失敗（内部で例外を catch）しても `exportPdf` が呼ばれ、`undefined`/ゴミを内容としてファイルに書き出してしまう。ユーザーは既にエラートーストを見ているにもかかわらず、壊れた PDF/PNG/JPEG/HTML が生成される（または既存ファイルが壊れた内容で上書きされる）。

`feature/error-diagnostics` のレビュー中に顕在化したが、これは error-diagnostics の回帰ではなく**以前から存在する不具合**であり、error-diagnostics のスコープ外。

## 根本原因（コード経路で特定済み）

`markdownPdf`（`src/extension.ts`）の出力タイプループ:

1. `convertMarkdownToHtml` がエラー時に `showErrorMessage`（トースト＋診断ログ）を出して `undefined` を返す。
2. それでも `makeHtml(converted ? converted.html : undefined, …)` が呼ばれる。
3. **重要**: `makeHtml(undefined)` は `undefined` を返さない。`renderTemplate`（`utils.ts`）が `{{{content}}}` を `view['content']`（= `undefined`）で置換する際、`'content' in view` が `true` のため、`String.prototype.replace` のコールバック戻り値 `undefined` が文字列 `"undefined"` に強制変換される。結果、テンプレートで包まれた**「正常な（= undefined ではない）ゴミ HTML」**が返る。
4. `exportPdf(html, …)` がそのゴミを書き出す（html 型は `exportHtml`、それ以外は一時HTML→`page.goto`→`page.pdf`/`page.screenshot`）。
5. 別経路として `makeHtml` 自体が失敗した場合は `html === undefined` となり、これも `exportPdf(undefined)` に渡り `data as string` 経由で文字列 `"undefined"` が書き出される。

→ **`exportPdf` 側で `data === undefined` をガードするだけでは経路 3（ゴミ HTML で undefined ではない）を防げない。** 発生源である `markdownPdf` でガードするのが本質的な修正。

## スコープ

### やること

- `markdownPdf` のループで、`convertMarkdownToHtml` が `undefined` を返したらそのタイプを `continue`（スキップ）。
- 同ループで、`makeHtml` が `undefined` を返したらそのタイプを `continue`（スキップ）。
- `exportPdf` 冒頭に `data === undefined` の早期 `return Promise.resolve()`（多層防御）を追加し、不要になった `data as string` キャスト 2 箇所を削除。

### やらないこと（対象外）

- `renderTemplate` の挙動変更（`undefined` → `"undefined"` の文字列化）。他の呼び出し元への影響が読みにくく、本不具合は制御フローで確実に対処できるため触らない。
- エラートースト/ログ文言の変更（`convertMarkdownToHtml`/`makeHtml` が既に `showErrorMessage` で表示・記録済み）。
- 結合テストの追加（後述。必要なら別途）。
- `README`/`CHANGELOG`（リリース準備時に対応）。

## アーキテクチャ

### 変更箇所 1: `markdownPdf` ループ内（現行 184-190 行付近）

変更前:

```ts
const converted = convertMarkdownToHtml(mdfilename, type, text, ctx, homeDir);
if (converted) {
  // Report is identical across export types (same source + mode); keep the latest.
  sanitizeReport = converted.report;
}
const html = makeHtml(converted ? converted.html : undefined, uri, ctx, homeDir);
await exportPdf(html, filename, type, uri, ctx, homeDir);
```

変更後:

```ts
const converted = convertMarkdownToHtml(mdfilename, type, text, ctx, homeDir);
if (!converted) {
  // convertMarkdownToHtml already logged the failure and showed an error toast.
  // Skip this type instead of exporting a file with garbage content: makeHtml()
  // would wrap an undefined body into the template (rendering the literal string
  // "undefined"), which is not undefined and would slip past exportPdf()'s guard.
  continue;
}
// Report is identical across export types (same source + mode); keep the latest.
sanitizeReport = converted.report;
const html = makeHtml(converted.html, uri, ctx, homeDir);
if (html === undefined) {
  // makeHtml already logged the failure and showed an error toast. Skip this type.
  continue;
}
await exportPdf(html, filename, type, uri, ctx, homeDir);
```

- `if (!converted) continue;` 後は TypeScript が `converted` を非 `undefined` に絞り込むため、`converted.report` / `converted.html` を三項演算子なしで安全に参照できる。
- `continue` は `for (let i = 0; i < types.length; i++)` ループに対するもので、**失敗したタイプのみスキップ**し他タイプ（`all` = pdf/html/png/jpeg）の試行は継続する。

### 変更箇所 2: `exportPdf` 冒頭ガード＋キャスト削除（現行 484 行付近）

変更前:

```ts
): Thenable<void> {
  const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
```

変更後:

```ts
): Thenable<void> {
  if (data === undefined) {
    // The HTML pipeline failed upstream (already logged + toasted). Callers skip on
    // undefined too; this is a defensive backstop so exportPdf can never write a file
    // with undefined/garbage content.
    return Promise.resolve();
  }
  const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
```

- 早期 return 後、TypeScript が `data` を `string` に絞り込むため、`exportHtml(data as string, …)` の 2 箇所を `exportHtml(data, …)` に簡略化（キャスト不要）。
- 既存の `if (!exportFilename) return Promise.resolve();` と同じ防御パターンに揃える。

### データフロー

```
markdownPdf ループ（各 type）
  └ convertMarkdownToHtml → undefined?  ── yes → continue（トースト済み・export しない）  ← 追加
        │ no
        └ sanitizeReport = converted.report
        └ makeHtml(converted.html) → undefined?  ── yes → continue（トースト済み）       ← 追加
              │ no（= 有効な HTML）
              └ exportPdf(html)
                    └ data === undefined?  ── yes → return（多層防御の最終バックストップ） ← 追加
                          │ no
                          └ exportHtml / page.pdf / page.screenshot（正常出力）
  ループ後: notifySanitize(sanitizeReport, …)  // 成功タイプの最新 report のみ反映
```

## エラーハンドリング

- `convertMarkdownToHtml`/`makeHtml` は各自の catch 内で `showErrorMessage`（トースト＋診断ログ）済み。`markdownPdf` の `continue` は**黙殺ではなく「通知済みのタイプを export せず飛ばす」**意味。エラーは握りつぶさない。
- `notifySanitize` はループ後に成功タイプの最新 `report` を使う。失敗タイプは `report` を更新する前に `continue` するため、失敗タイプのサニタイズ通知は出ない（正しい挙動）。
- `exportPdf` の早期 return は `markdownPdf` のガードと冗長だが、将来の呼び出し元に対する防御として残す（`exportPdf` 単体で「ゴミを書き出さない」不変条件を保証）。

## テスト戦略

`markdownPdf`/`exportPdf` はモジュール内プライベートかつ `vscode`/puppeteer 依存で、`tsx --test` のユニットテストハーネス（純粋モジュール対象）からは到達できない。検証は型・バンドル・既存回帰を中心とし、制御フローの正しさはコードレビューで担保する。

- **自動**（実施済み・全 green）:
  - `npm run check`（tsc クリーン）
  - `npm run build`（esbuild 成功）
  - `npm run test:unit`（414 pass / 0 fail = 回帰なし）
- **手動（任意・限定的）**: `convertMarkdownToHtml`/`makeHtml` の失敗は内部例外でしか起きず（テンプレート欠落・プラグイン例外など）、ユーザー入力から決定的に再現するのは難しい。可能であれば失敗を注入して、エラートースト後に出力ファイルが生成/上書きされないことを確認する。

## 採用済みデフォルト（レビューで異議があれば再検討）

- 失敗タイプは `continue`（`return` ではない）＝他タイプの試行を続行（既存ループのタイプ独立性を維持）。
- 多層防御として `markdownPdf` ガード＋`exportPdf` ガードの**両方**を実装。`exportPdf` ガード単体では経路 3 を防げず、`markdownPdf` ガードは発生源対処として必須。
- `README`/`CHANGELOG` はリリース準備時に対応（本ブランチでは触らない）。
