# 変換失敗時の export スキップ（未定義HTMLガード）実装計画

> **状態:** 本計画はレビュー機会確保のため**実装後に後追い作成**した。全タスクは実施済みで、結果をコミット `326860c`（`bugfix/skip-export-on-html-failure`、`develop` 未マージ）に反映済み。チェックボックスは実施済みを示す。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 変換（`convertMarkdownToHtml`）または HTML 生成（`makeHtml`）が失敗したタイプで `exportPdf` を呼ばず、`undefined`/ゴミ内容のファイル書き出しを止める。

**Architecture:** `markdownPdf`（`src/extension.ts`）のループで、`convertMarkdownToHtml` が `undefined` を返したら `continue`、`makeHtml` が `undefined` を返したら `continue`。加えて `exportPdf` 冒頭に `data === undefined` の早期 return（多層防御）を置き、不要になった `data as string` キャスト 2 箇所を削除。

**Tech Stack:** TypeScript / VS Code Extension API / esbuild / tsx（test:unit）。

**Spec:** [`docs/superpowers/specs/20260621-04-skip-export-on-html-failure-design.md`](../specs/20260621-04-skip-export-on-html-failure-design.md)

**Branch:** `bugfix/skip-export-on-html-failure`（worktree: `.worktrees/bugfix-skip-export-on-html-failure`）。全タスクこのブランチで実施。

---

## 全体の制約

- 変更は `src/extension.ts` の 2 箇所（`markdownPdf` ループ／`exportPdf` 冒頭）のみ。他は触らない（YAGNI）。
- `markdownPdf`/`exportPdf` は `vscode`/puppeteer 依存で `tsx --test` のユニットテスト対象外。検証は `npm run check`（型）＋ `npm run build`（バンドル）＋ `npm run test:unit`（既存回帰）。
- コードコメントは英語。コマンドは worktree ルートで実行。
- 新規 worktree には `node_modules` が無く、`tsconfig.json` の `typeRoots` が `./node_modules/@types` 固定のため、root の `node_modules` へジャンクションを張るか `npm ci` する（張らないと TS2688 で `npm run check` が失敗）。

## ファイル構成

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/extension.ts` | `markdownPdf` ループの失敗時スキップ＋`exportPdf` 冒頭の undefined ガード／キャスト削除 | 修正 |

---

## Task 0: ブランチ / worktree のプリフライト

**Files:** （変更なし）

- [x] **Step 1: ブランチ確認**

Run: `git branch --show-current && git status --short`
Expected: `bugfix/skip-export-on-html-failure`。
（結果: 一致。）

- [x] **Step 2: 依存解決（新規 worktree のため）**

worktree には `node_modules` が無いので root へジャンクションを張る:
Run（PowerShell）: `New-Item -ItemType Junction -Path <worktree>\node_modules -Target <repo-root>\node_modules`
（`npm ci` でも可。）

- [x] **Step 3: ベースライン確認**

Run: `npm run check`
Expected: エラーなし（ジャンクション後 EXIT=0）。
（結果: ベースライン clean を確認。）

---

## Task 1: markdownPdf に失敗時スキップガードを追加

**Files:**
- Modify: `src/extension.ts`（`markdownPdf` ループ内、現行 184-190 行付近）

> `markdownPdf` はユニットテスト対象外。検証は型・バンドル・既存回帰。

- [x] **Step 1: convert/makeHtml の undefined で continue**

`if (converted) { … }` を `if (!converted) { continue; }` に反転し、`sanitizeReport`/`makeHtml` を非 undefined 前提に整理。`makeHtml` の戻り値 `html === undefined` でも `continue`。（spec「アーキテクチャ 変更箇所 1」の変更後コードの通り。）

- [x] **Step 2: 型チェック**

Run: `npm run check`
Expected: エラーなし。`if (!converted) continue;` 後に `converted` が非 undefined へ絞り込まれ、`converted.report`/`converted.html` が三項演算子なしで通る。
（結果: EXIT=0。）

---

## Task 2: exportPdf に多層防御ガードを追加＋キャスト削除

**Files:**
- Modify: `src/extension.ts`（`exportPdf` 冒頭・現行 484 行付近、および `exportHtml(...)` 2 箇所）

- [x] **Step 1: 冒頭に undefined 早期 return**

`): Thenable<void> {` 直後に `if (data === undefined) { return Promise.resolve(); }` を追加（spec「変更箇所 2」の通り）。

- [x] **Step 2: `data as string` キャストを削除**

早期 return で `data` が `string` に絞り込まれるため、`exportHtml(data as string, …)`（2 箇所）を `exportHtml(data, …)` に簡略化。

- [x] **Step 3: 型チェック＋バンドル**

Run: `npm run check` / `npm run build`
Expected: いずれもエラーなし。
（結果: check EXIT=0 / build 成功 8.7mb。）

---

## Task 3: 検証とコミット

**Files:** （変更なし）

- [x] **Step 1: 差分レビュー**

Run: `git --no-pager diff -- src/extension.ts`
Expected: `markdownPdf` ループの 2 ガード＋`exportPdf` の冒頭ガード＋キャスト 2 箇所の削除。1 ファイル +21/-6。
（結果: 一致。）

- [x] **Step 2: 既存テストの回帰確認**

Run: `npm run test:unit`（終了コードでゲート）
Expected: 0 fail。
（結果: 414 pass / 0 fail。）

- [x] **Step 3: コミット**

```bash
git add src/extension.ts
git commit -m "fix: skip export when HTML generation fails to avoid writing garbage files"
```
（結果: コミット `326860c`。）

- [ ] **Step 4: develop へのマージ（承認ゲート）**

AGENTS.md の「マージ前に確認・承認を待つ」規約に従い、ユーザー承認後に `develop` へマージ。マージ後に `node_modules` ジャンクションを外して `git worktree remove`。
（本 spec/plan のコミットもこのブランチに含めてからマージする。）

---

## Self-Review チェック結果

- **Spec coverage**: spec「やること」（markdownPdf の convert/makeHtml スキップ＝Task 1、exportPdf ガード＋キャスト削除＝Task 2）、「やらないこと」（renderTemplate 不変・文言不変・README/CHANGELOG 不変＝本計画は extension.ts 2 箇所のみで遵守）、テスト戦略（check/build/回帰＝各 Step）を網羅。
- **Placeholder scan**: TBD/TODO なし。変更コードは spec に exact 記載。
- **Type consistency**: `if (!converted) continue;` で `converted` 非 undefined 絞り込み、`if (data === undefined) return` で `data: string` 絞り込み。いずれも tsc で確認済み。
- **未完**: Task 3 Step 4（develop マージ）はユーザー承認待ち。
