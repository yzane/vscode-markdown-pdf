# ソースコードへの最低限コメント追加 設計書

## 目的

`src/` 配下の TypeScript ソースに、保守・オンボーディング時に必要となる最低限の英語コメントを追加する。コメントの責務は「型情報では表現できない意図」の補足に限定する。過剰なボイラープレートは避け、読み手が `export` シンボルとファイル責務を素早く把握できる状態を作る。

## 背景

- 現状、`src/*.ts` には散発的な目印コメント（例: `// check active window`）しか存在せず、`export` されたシンボルの用途やファイル全体の責務を一望できる情報源がない。
- 型情報は TypeScript で表現済みのため、JSDoc による型の再記述は価値が薄い。
- 一方で、プラットフォーム分岐・CJS/ESM 境界・Chromium 解決ロジックなど、「なぜこう書かれているか」が非自明な箇所は複数存在する。

## スコープ

### 対象

- `src/*.ts` の 6 ファイル:
  - `extension.ts`（638 行、エントリポイントと変換ワークフロー）
  - `utils.ts`（687 行、ヘルパー関数群）
  - `chromium-resolver.ts`（180 行、Chromium 検出）
  - `markdown-it-include.ts`（216 行）
  - `markdown-it-checkbox.ts`（125 行）
  - `markdown-it-named-headers.ts`（81 行）
- 各ファイル冒頭のヘッダコメント追加
- すべての `export` 関数への 1 行 JSDoc 追加
- 明確な基準（後述）に該当する箇所への Why コメント追加

### 対象外

- `src/types/*.d.ts`（型宣言ファイル。外部ライブラリ補完用で挙動を持たない）
- `test/` 配下（テスト名で意図が表現されるため）
- 既存の散発的コメント（`// check active window` 等の what コメント）の削除・書き換え。既存の害のないコメントはそのまま残す。
- 内部（非 `export`）関数への JSDoc 追加
- リファクタリング・挙動変更（本作業はコメント追加のみ）
- README・CHANGELOG の更新

## コメントの書式ルール

### ルール A: ファイルヘッダ

各 `src/*.ts` の 1 行目（`import` より前）に、そのファイルの責務を 1〜3 行で記述する `//` コメントを追加する。

**書式**:

```typescript
// <責務の要約（1 行目）>
// <補足があれば 2〜3 行目>
import fs from 'fs';
```

**例**:

```typescript
// Chromium executable resolver: locates a usable Chrome/Edge binary from
// user-configured path, system install locations, or Puppeteer's managed
// browser cache.
import fs from 'fs';
```

**注意点**:

- `@file` JSDoc タグは使わない。この拡張機能は API ドキュメントを公開する用途がないため、プレーンな `//` のほうがノイズが少ない。
- ファイルの責務を書く。実装詳細の列挙にはしない。

### ルール B: `export` 関数への JSDoc

すべての `export function` に対して、概要 1 行の JSDoc を付ける。`@param`・`@returns` は原則書かない（型情報で十分）。現時点で `src/` 配下の export はすべて `export function` であり、関数値の `export const` は存在しない。

**書式**:

```typescript
/** <動詞で始まる 1 行の概要>. */
export function foo(...): ... {
```

**例**:

```typescript
/** Resolves the Chromium executable path from a user-configured setting. */
export function findChromiumFromUserSetting(executablePath: string): string | null {
```

**書き方のコツ**:

- 三人称単数現在形の動詞で始める（`Resolves...`, `Converts...`, `Reads...`）。
- 末尾はピリオドで終わる。
- 関数名や型で自明な内容を繰り返さない。

**例外（複数行 JSDoc を許容する条件）**:

以下のいずれかに該当する場合に限り、本文を複数行にして補足を加えてよい。

1. ファイルシステム副作用や例外を投げる条件が型で表現できない。
2. 戻り値の `null` / 空文字 / `false` 等が複数の意味を持つ。
3. 呼び出し順序に制約がある（初期化順など）。

**例**:

```typescript
/**
 * Reads a file synchronously, returning '' on any I/O failure.
 * Warnings are logged to console; errors are never re-thrown.
 */
export function readFile(filename: string, encode?: BufferEncoding | null): string | Buffer {
```

### ルール C: 非自明ロジックへの Why コメント

以下のいずれかに該当する箇所にのみ、`// Why: ...` 形式の 1〜2 行コメントを付ける。**what ではなく why を書く**。

**対象**:

1. **プラットフォーム分岐** — `process.platform === 'win32'` 等、なぜ分岐が必要かが非自明な場合。
2. **正規表現** — 意図・対象パターンが非自明なもの。
3. **ワークアラウンド / ハック** — ライブラリのバグ回避、CJS / ESM 境界、型定義の欠落への対処など。
4. **外部仕様への依存** — Chromium のバージョン、VS Code API の特殊挙動、Puppeteer の内部構造。
5. **パフォーマンスのための非直感的書き方** — 明示的な理由がある場合のみ。

**書式**:

```typescript
// Why: <理由>.
<該当コード>
```

**例**:

```typescript
// Why: PUPPETEER_REVISIONS is a named export on the CJS module but not on
// the default export type, so require() is the only reliable runtime path.
const puppeteerModule = require('puppeteer-core');
```

**注意点**:

- what ではなく why を書く。`// Why: checks if path exists` は NG（理由になっていない）。
- 対象 1〜5 のどれにも当てはまらないなら、コメントは付けない。

### 共通ルール

- すべて英語で記述（プロジェクトのコーディング規約）。
- 絵文字は使わない。
- 型・関数名で自明な what は書かない。
- 既存のコメントは触らない（`// check active window` などはそのまま）。

## 実装順序と単位

### ファイル処理順

小さく単純なファイルから順に進める。最小ファイルで書式テンプレートを確立し、以降その完成形を参照しながら大きなファイルへ展開する。

| 順 | ファイル | 行数 | 狙い |
|---|---|---:|---|
| 1 | `markdown-it-named-headers.ts` | 81 | 最小ファイルで書式テンプレート確立 |
| 2 | `markdown-it-checkbox.ts` | 125 | プラグイン系の書き方確立 |
| 3 | `chromium-resolver.ts` | 180 | Why コメント基準の確立（プラットフォーム分岐・CJS/ESM） |
| 4 | `markdown-it-include.ts` | 216 | プラグイン系の 2 本目、書式ブレ検証 |
| 5 | `extension.ts` | 638 | エントリポイント、VS Code API 依存の Why が多い |
| 6 | `utils.ts` | 687 | 最大ファイル、JSDoc 例外ルールの適用が集中 |

### 作業単位内の手順（各ファイル共通）

1. ファイルを読み、`export` 関数の一覧を把握する。
2. ファイル冒頭にヘッダコメント（ルール A）を追加する。
3. `export` 関数に 1 行 JSDoc（ルール B）を追加する。
4. Why コメント対象箇所（ルール C）を走査して追加する。
5. `npm run build` で型チェックとバンドルが成功することを確認する。
6. コミットする。

### コミット粒度

- 1 ファイル = 1 コミットを基本とする（計 6 コミット）。
- セルフレビュー修正が発生した場合はさらに +1 コミット。
- コミットメッセージ書式: `docs: add comments to src/<filename>`
  - 例: `docs: add comments to src/chromium-resolver.ts`

### ブランチ戦略

- `feature/source-comments` ブランチを `develop` から切って作業する（既に作成済み）。
- マージ戦略は既存ポリシーに従い `--no-ff`。
- 作業完了後は `develop` へマージする。

## 検証と成功基準

### 機械的チェック（必須）

全ファイル完了後、以下をすべて満たすこと。

1. **ファイルヘッダ存在チェック**
   - `src/*.ts` 6 ファイルすべての 1 行目が `//` で始まるコメント。
   - `src/types/*.d.ts` は対象外。
2. **`export` JSDoc 存在チェック**
   - 各ファイルの `export function` のすぐ上に `/** ... */` ブロックが存在する。
3. **ビルド成功**
   - `npm run build` が成功（TypeScript 型チェック + esbuild バンドル）。
   - 新規の警告が出ていないこと。
4. **既存テスト成功**
   - `npm test` が従来通りパス（挙動変更がないことの確認）。

### 質的セルフレビュー（必須、1 回）

全ファイル完了後に通しで読み返し、以下をチェックして該当箇所を修正する。

- JSDoc が型情報と重複していないか（例: `/** Returns a string. */` のような無意味なもの）。
- JSDoc が三人称単数現在形の動詞で始まり、ピリオドで終わっているか。
- Why コメントが what になっていないか。
- ファイルヘッダが「このファイルの責務」を表しているか（実装詳細の列挙になっていないか）。
- 英語の文法・スペルミス。
- 絵文字が混入していないか。

### 完了判定

- 機械的チェック 1〜4 がすべて成功。
- セルフレビューのチェックリストがすべて済み、必要な修正が入っている。
- `feature/source-comments` ブランチに 6 件（+ セルフレビュー修正があれば +1 件）のコミットが積まれている。
- `develop` へのマージ準備が整っている。

## 非スコープの再確認

以下は本作業に含めない（実装中に「ついで」で触らないこと）。

- 既存の what コメント（`// check active window` 等）の削除・書き換え。
- 内部（非 `export`）関数への JSDoc 追加。
- 型定義の追加・変更。
- 関数の分割・整理などのリファクタリング。
- 挙動を変えるあらゆる修正。
- README・CHANGELOG の更新。
