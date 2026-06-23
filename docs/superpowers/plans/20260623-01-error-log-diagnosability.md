# エラーログ診断性向上（H-1 / M-2）実装プラン

## 対象ブランチ

`feature/error-log-diagnosability`（`develop` から分岐、`.worktrees/feature-error-log-diagnosability`）。完了後 `develop` へローカルマージ（マージ前に確認）。

## 背景

設計は [`20260623-01-error-log-ai-diagnosability-design.md`](../specs/20260623-01-error-log-ai-diagnosability-design.md) の §③ 改善案に基づく。本プランはそのうち優先度の高い 2 件のみを対象とする:

- **H-1**: `formatError`（[`src/logger.ts:55`](../../../src/logger.ts)）を `error.cause` 連鎖 / `AggregateError` 展開に対応させ、真因がネストするエラーを取りこぼさない。
- **M-2**: `classifyError`（[`src/diagnostics.ts:129`](../../../src/diagnostics.ts)）に Linux 共有ライブラリ不足ルールを追加し、依存不足の起動失敗に固有のヒント＋トラブルシュートリンクを返す。

実装順は **H-1 → M-2**。

## スコープ

### やること

1. H-1: `formatError` の cause 連鎖 / `AggregateError` 対応（循環・深さガード付き）＋ ユニットテスト追加。
2. M-2: `classifyError` に共有ライブラリ不足ルールを追加（起動失敗ルールより前）＋ ユニットテスト追加。

### やらないこと（今回対象外）

- H-2（Copy Diagnostics 導線）/ M-1（コンテキスト設定項目拡充）/ L-1（invocation 区切り）。別タスク。
- `README` / `README.ja` / `CHANGELOG` の更新。未リリース要素とまとめてリリース準備時に 1 回行う（既存方針）。
- `reportError` / `extension.ts` 側の変更。H-1 は `formatError` の戻り値が変わるだけで呼び出し側はそのまま恩恵を受ける（`reportError` は既に `formatError(error)` を出力済み）。

## 前提制約（重要）

`tsconfig.json` は `target` / `lib` ともに **ES2020**。したがって型定義上 **`Error.cause`（ES2022）・`AggregateError`（ES2021）は存在しない**。`tsc --noEmit`（strict）を通すため、両者は**ダックタイピングで実行時判定**する（実行時は Node 20 で利用可能）:

- cause: `const cause = (error as { cause?: unknown }).cause;`
- AggregateError: `error.name === 'AggregateError' && Array.isArray((error as { errors?: unknown }).errors)`（グローバル型 `AggregateError` を参照しない）

---

## H-1: `formatError` の cause 連鎖 / AggregateError 対応

### 現状

```ts
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}
```

最上位の `stack` のみ。`error.cause` も `AggregateError.errors` も出力されない。

### 変更後の仕様

- Error → これまで通り `stack`（無ければ `name: message`）。
- `cause` があれば改行して `Caused by: <cause を再帰整形>` を付加（cause が非 Error でも `String()` で出す）。
- `AggregateError`（ダックタイピング判定）なら各 `errors[i]` を `Aggregated error [i]: <再帰整形>` で付加。
- **循環参照**ガード: 既出の Error を `Set` で検出し `[circular error reference]` で打ち切る。
- **深さ**ガード: `MAX_ERROR_DEPTH = 5` を超えたら `[error chain truncated]` で打ち切る。
- 公開シグネチャ `formatError(error: unknown): string` は不変（内部に再帰ヘルパー）。

### 実装方針（イメージ）

```ts
const MAX_ERROR_DEPTH = 5;

export function formatError(error: unknown): string {
  return formatErrorAt(error, 0, new Set<unknown>());
}

// Recursively stringify an error, following Error.cause and AggregateError.errors.
// cause/AggregateError are accessed by duck typing because the tsconfig lib is ES2020
// (their static types are unavailable), while Node 20 provides them at runtime.
function formatErrorAt(error: unknown, depth: number, seen: Set<unknown>): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (seen.has(error)) {
    return '[circular error reference]';
  }
  if (depth >= MAX_ERROR_DEPTH) {
    return '[error chain truncated]';
  }
  seen.add(error);

  let result = error.stack ?? `${error.name}: ${error.message}`;

  const errors = (error as { errors?: unknown }).errors;
  if (error.name === 'AggregateError' && Array.isArray(errors)) {
    errors.forEach((sub, i) => {
      result += `\nAggregated error [${i}]: ${formatErrorAt(sub, depth + 1, seen)}`;
    });
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause !== undefined && cause !== null) {
    result += `\nCaused by: ${formatErrorAt(cause, depth + 1, seen)}`;
  }

  return result;
}
```

### エッジケース

- cause が文字列・数値など非 Error → `String()` で 1 行表示。
- cause 自身がさらに cause を持つ → 深さ上限まで連鎖。
- 循環（`a.cause = b; b.cause = a` 等）→ `[circular error reference]` で停止、無限ループしない。
- `AggregateError` かつ各 sub がさらに cause を持つ → それぞれ再帰（同一 `seen`/depth 管理）。

### TDD テスト（`test/unit/logger.test.ts` の `describe('formatError')` に追加）

既存 3 テストは cause 無しのため**不変で通過**（`formatError(err) === err.stack` 等）。追加:

1. `cause` を持つ Error → 出力に元 stack と `Caused by:` ＋ cause の message/stack を含む。
2. 多段 cause（outer→mid→inner）→ 3 段すべてを順に含む。
3. 非 Error の cause（文字列）→ `Caused by: <文字列>` を含む。
4. `AggregateError`（**型参照を避けダックタイピングで生成**: `const agg = new Error('agg') as Error & { errors: unknown[] }; agg.name = 'AggregateError'; agg.errors = [e1, e2];`）→ `Aggregated error [0]` / `[1]` と各 message を含む。テスト側も `lib: ES2020` のため `new AggregateError(...)` を型参照しない。
5. 循環 cause → `[circular error reference]` を含み、例外を投げない（`assert.doesNotThrow`）。
6. 深さ上限超過（6 段以上の cause 連鎖）→ `[error chain truncated]` を含む。

### 対象ファイル

- `src/logger.ts`（実装）
- `test/unit/logger.test.ts`（テスト）

---

## M-2: `classifyError` に共有ライブラリ不足ルールを追加

### 現状

`classifyError`（[`src/diagnostics.ts:129`](../../../src/diagnostics.ts)）のルール順:

1. ブラウザ起動失敗（`Failed to launch the browser process` / `Could not find ... Chrome`）→ Chromium ヒント＋executablePath 設定
2. `EBUSY`/`EPERM`/`EACCES` → 出力ファイル書込みヒント
3. `ENOSPC` → ディスク空き
4. `ENOENT`/`EISDIR` → 出力パス不正＋outputDirectory 設定
5. それ以外 → `undefined`

### 変更後の仕様

Linux の動的リンカが出すメッセージを検出する**新ルールを現ルール 1 の前に挿入**する。理由: 共有ライブラリ不足時、puppeteer はしばしば `Failed to launch the browser process!` も同時に含むため、汎用ルール 1 が先だと固有ヒントが出せない。より具体的なルールを先に評価する。

さらに **[P2]** 対応として、真因が `error.cause` にネストするケース（H-1 が対象とするのと同じ状況）でも分類できるよう、`classifyError` は検索メッセージを `error` 単体ではなく **cause 連鎖 / `AggregateError.errors` を浅く辿って収集**したテキストに照合する。共有ライブラリ不足が cause 側にあってもトーストの固有ヒント＋`Troubleshooting` が出る（cause がログに出るだけの H-1 単独では不足）。

- 検出（locale 非依存・安定。ld.so のメッセージ）:
  - `/error while loading shared libraries/i`
  - `/cannot open shared object file/i`
- ヒント: `Chromium is missing required system libraries. Install them (e.g. libnss3, libatk-1.0, libgbm) - see the Puppeteer troubleshooting guide.`
- アクション: `{ kind: 'url', url: 'https://pptr.dev/troubleshooting', label: 'Troubleshooting' }`

関数冒頭のコメント（「browser-launch check runs first ...」）も、共有ライブラリルールが起動失敗ルールより前に走る旨へ更新する。

### 実装方針（イメージ・現ルール1の直前に挿入）

```ts
// 1. Chromium is present but missing system shared libraries (Linux). More specific
// than the generic launch failure below, so it must be checked first: the wrapped
// message often also contains "Failed to launch the browser process".
if (/error while loading shared libraries/i.test(message) ||
    /cannot open shared object file/i.test(message)) {
  return {
    hint: 'Chromium is missing required system libraries. Install them (e.g. libnss3, libatk-1.0, libgbm) - see the Puppeteer troubleshooting guide.',
    action: { kind: 'url', url: 'https://pptr.dev/troubleshooting', label: 'Troubleshooting' },
  };
}
```

（以降の既存ルールはコメント番号を 2〜6 に繰り下げ。ロジックは不変。）

#### 検索メッセージの収集 `collectErrorText`（cause/aggregate 対応・Open Question への回答）

`classifyError` 冒頭を `const message = errorMessageText(error)` → `const message = collectErrorText(error)` に差し替える（top-level の `const code = errorCode(error)` 完全一致チェックは従来どおり残す）。`collectErrorText` は `diagnostics.ts` ローカルの小ヘルパーで、`error` と `error.cause` 連鎖・`AggregateError.errors` を **H-1 と同じ深さ上限 `MAX_CAUSE_DEPTH=5` と循環ガード**で浅く辿り、各段の `errorCode`/`errorMessageText`（既存ヘルパー）を改行連結して返す。cause/AggregateError はダックタイピングで参照（ES2020 制約）。`logger.ts` は import せず別実装（重複は約10行で許容）。

副次効果として既存の全ルール（EBUSY/ENOSPC/ENOENT 等）も cause ネストに自動対応する。top-level のみのケースは収集結果が同じため**既存テストは不変で通過**する。

### TDD テスト（`test/unit/diagnostics.test.ts` の `describe('classifyError')` に追加）

既存テストは共有ライブラリ語を含まないため**不変で通過**（特に「`Failed to launch the browser process! spawn ENOENT`」は従来どおりルール 1 = executablePath 設定を返す）。追加:

1. `error while loading shared libraries: libnss3.so: cannot open shared object file` → ヒントが `/system librar/i` に一致、`action.kind === 'url'` かつ url が `pptr.dev` を含む。
2. 順序: `Failed to launch the browser process!\n... error while loading shared libraries: libgbm.so ...`（両語を含む）→ 共有ライブラリヒント（`/system librar/i`）が勝ち、`action.kind === 'url'`（executablePath 設定ではない）。
3. `cannot open shared object file` 単独（起動失敗語なし）→ 共有ライブラリヒント。
4. **[P2] cause ネスト**: `outer` = `Failed to launch the browser process!`、`outer.cause` = 共有ライブラリ不足 Error → 共有ライブラリヒント（`/system librar/i`）＋ `action.kind === 'url'`。生成は型参照を避け `const outer = new Error('...') as Error & { cause?: unknown }; outer.cause = inner;`。
5. **[P2] cause ネスト（汎用ルールも cause 対応になることの確認）**: `outer.cause` に `EBUSY` Error → 書込みヒント。

### 対象ファイル

- `src/diagnostics.ts`（実装）
- `test/unit/diagnostics.test.ts`（テスト）

---

## 実装手順（TDD）

1. **H-1 RED**: `logger.test.ts` に上記 6 テストを追加 → `npm run test:unit` で新規が失敗することを確認。
2. **H-1 GREEN**: `logger.ts` の `formatError` を再帰実装に置換 → テスト通過。
3. **H-1 REFACTOR / check**: `npm run check`（tsc strict）通過を確認。
4. **M-2 RED**: `diagnostics.test.ts` に上記 3 テストを追加 → 失敗確認。
5. **M-2 GREEN**: `diagnostics.ts` に `collectErrorText` 追加＋検索メッセージ差し替え＋共有ライブラリルール挿入 → テスト通過。
6. **M-2 REFACTOR / check**: `npm run check` 通過。
7. 全体回帰: `npm run test:unit`（全 unit）通過。

## 検証コマンド

- 型: `npm run check`
- 単体: `npm run test:unit`
- （統合 `test:integration` は VS Code 起動が要るため、本変更は純粋関数のみで影響なし。必要時のみ。）

すべて worktree 内（`.worktrees/feature-error-log-diagnosability`）で実行。`node_modules` は root へのジャンクション済み。

## 完了条件

- `formatError` が cause 連鎖・AggregateError を出力し、循環/深さで停止する（テスト 6 件緑）。
- `classifyError` が共有ライブラリ不足に固有ヒント＋URL アクションを返し、起動失敗より優先され、**cause ネスト時も分類される**（テスト 5 件緑）。
- 既存ユニットテスト全緑、`tsc --noEmit` 緑。
- design doc / plan が本ブランチに含まれる。

## リスク

- ES2020 lib 制約を忘れて `error.cause` / `AggregateError` を型参照すると `tsc` が落ちる → ダックタイピング厳守。手順 3/6 の `npm run check` で担保。
- 既存テスト「launch failure (spawn ENOENT)」が共有ライブラリルールに誤吸着しないこと（語が異なるため問題なし、テスト 2 で順序も担保）。

## 検証結果（2026-06-23）

- 単体: 全 unit **441 件 pass**（H-1: logger 6 件 / M-2: classifyError 5 件を追加）、`tsc --noEmit` clean、`npm run build`（esbuild）成功。
- **M-2 実機 e2e（WSL2 / Linux, VS Code 1.125 / Node 24 / puppeteer-core 24.40.0）**: `executablePath` に ld.so 風 stderr（`error while loading shared libraries: libnss3.so: cannot open shared object file`）を出す偽 chrome を指定して export → 出力チャネルに `Hint: Chromium is missing required system libraries...` が出力され、トーストの `Troubleshooting` から `https://pptr.dev/troubleshooting` が開くことを確認。`reportError` の多段ログ（`operation=Failed to export pdf.` / `exportPdf()` / `context(chromium=user-setting)` / `Hint:` / stack）も実機で確認。
- H-1: cause / AggregateError 展開は単体で網羅。実機の単層エラーでは `Caused by:` は出ない（仕様どおり）。
