# テスト内容ドキュメント化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `test/README.md` と `test/README.ja.md` を追加し、このリポジトリのユニットテストと統合テストが何を検証しているかを英語と日本語で把握できるようにする。

**Architecture:** 既存のテストコードと `package.json` のスクリプト定義を根拠に、`test/` 配下へ開発者向けの説明文書を 2 ファイル追加する。文書は同一の見出し構成を持たせ、`describe` 単位や fixture 群単位で責務を要約し、利用者向け README には触れない。

**Tech Stack:** Markdown, Node.js, npm scripts, Mocha, VS Code extension test runner

**設計ドキュメント:** `docs/superpowers/specs/2026-03-31-02-test-documentation-design.md`

---

### Task 1: テスト内容の根拠を整理する

**Files:**
- Read: `test/unit/utils.test.js`
- Read: `test/integration/extension.test.js`
- Read: `package.json`

- [ ] **Step 1: ユニットテストの責務を文書化用に整理する**

確認対象:
- `setBooleanValue`, `isExistsPath`, `isExistsDir`
- `Slug`, `transformTemplate`
- `readFile`, `makeCss`
- `convertImgPath`, `isExcludeFile`
- `resolveHref`, `resolveOutputDir`
- `buildStyleTags`

期待: 関数ごとのテスト意図を「基本動作」「パス解決」「境界条件」「Windows 専用ケース」のような観点で説明できる状態になる。

- [ ] **Step 2: 統合テストの責務を文書化用に整理する**

確認対象:
- HTML スナップショット比較の流れ
- `normalizeHtml` が正規化している内容
- `test/integration/fixtures/` と `test/integration/expected/` の役割
- PlantUML の例外抑制
- PDF / PNG / JPEG の生成確認と skip 条件

期待: 統合テストの説明を「HTML 比較」と「バイナリ生成」の 2 系統で書き分けられる状態になる。

- [ ] **Step 3: テスト実行コマンドを確認する**

Run: `node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts, null, 2))"`
Expected: `test`, `test:unit`, `test:integration` の定義が出力される。

- [ ] **Step 4: 作業ツリーを確認する**

```bash
git status --short
```

期待: この時点では未コミット変更の把握だけを行い、文書作成後のコミット対象を明確にする。

### Task 2: 英語版のテスト説明文書を作成する

**Files:**
- Create: `test/README.md`
- Read: `test/unit/utils.test.js`
- Read: `test/integration/extension.test.js`
- Read: `package.json`

- [ ] **Step 1: `test/README.md` の見出し構成を作成する**

```markdown
# Tests

## Overview

## Test Structure

## Unit Tests

## Integration Tests

## How to Run

## Notes and Limitations
```

- [ ] **Step 2: Overview と Test Structure を記述する**

```markdown
## Overview

This directory contains developer-facing documentation for the repository test suite.
The tests are split into unit tests for utility behavior and integration tests for VS Code command-driven export behavior.

## Test Structure

- `test/unit/utils.test.js` covers helper functions in `src/utils.js`.
- `test/integration/extension.test.js` exercises export commands through the VS Code extension test environment.
- `test/integration/fixtures/` contains Markdown inputs used by integration tests.
- `test/integration/expected/` contains normalized HTML snapshots used for comparison.
```

- [ ] **Step 3: Unit Tests と Integration Tests を記述する**

```markdown
## Unit Tests

The unit test suite focuses on `src/utils.js`.
It covers boolean handling, file and directory existence checks, slug generation, template placeholder replacement, file loading, CSS assembly, image path conversion, exclusion matching, href resolution, output directory resolution, and style tag construction.
Path-oriented cases intentionally cover spaces, `#`, `file://`, `~`, parent-directory traversal, and Windows-only behavior where the implementation differs by platform.

## Integration Tests

The integration suite checks the extension from the command layer.
HTML-oriented tests open fixture Markdown files, run the HTML export command, normalize environment-dependent values such as file URIs and timestamps, and compare the generated output with committed snapshots.
Binary-generation tests build a combined Markdown input and verify that generated PDF, PNG, and JPEG files exist, are non-empty, and start with the expected magic bytes.
```

- [ ] **Step 4: How to Run と Notes and Limitations を記述する**

```markdown
## How to Run

- `npm run test:unit`
- `npm run test:integration`
- `npm test`

## Notes and Limitations

- Binary generation depends on a Chromium or Chrome executable being available.
- Some integration assertions normalize environment-dependent content before comparison.
- Windows-specific unit tests are skipped on non-Windows platforms.
- These tests do not guarantee pixel-perfect visual quality or full end-to-end UI interaction coverage.
```

- [ ] **Step 5: 文面を調整してコミットする**

```bash
git add test/README.md
git commit -m "docs: add English test documentation"
```

### Task 3: 日本語版のテスト説明文書を作成する

**Files:**
- Create: `test/README.ja.md`
- Read: `test/README.md`

- [ ] **Step 1: 英語版と同じ見出し構成で `test/README.ja.md` を作成する**

```markdown
# テスト

## 概要

## テスト構成

## ユニットテスト

## 統合テスト

## 実行方法

## 注意点と制約
```

- [ ] **Step 2: 英語版に対応する日本語説明を記述する**

```markdown
## 概要

このディレクトリには、このリポジトリのテスト構成を説明する開発者向けドキュメントを置きます。
テストは `src/utils.js` を対象にしたユニットテストと、VS Code コマンド経由の出力を確認する統合テストに分かれています。

## テスト構成

- `test/unit/utils.test.js` は `src/utils.js` の補助関数群を対象にします。
- `test/integration/extension.test.js` は VS Code 拡張テスト環境でエクスポートコマンドを実行します。
- `test/integration/fixtures/` には統合テスト用の Markdown 入力を置きます。
- `test/integration/expected/` には比較用の HTML スナップショットを置きます。
```

- [ ] **Step 3: ユニットテストと統合テストの説明を記述する**

```markdown
## ユニットテスト

ユニットテストは `src/utils.js` の振る舞いを対象にします。
真偽値処理、ファイルとディレクトリの存在確認、slug 生成、テンプレート置換、ファイル読み込み、CSS 組み立て、画像パス変換、除外判定、`href` 解決、出力先ディレクトリ解決、スタイルタグ構築を検証します。
特にパスまわりは、スペース、`#`、`file://`、`~`、`../`、Windows 専用ケースなど、環境差が出やすい境界条件を明示的に押さえています。

## 統合テスト

統合テストは拡張機能をコマンド層から確認します。
HTML の検証では、fixture の Markdown を開いて HTML 出力コマンドを実行し、ファイル URI や日時のような環境依存値を正規化したうえで expected スナップショットと比較します。
バイナリ生成の検証では、複数の fixture を結合した Markdown から PDF、PNG、JPEG を生成し、ファイルの存在、サイズ、マジックバイトを確認します。
```

- [ ] **Step 4: 実行方法と制約を記述する**

```markdown
## 実行方法

- `npm run test:unit`
- `npm run test:integration`
- `npm test`

## 注意点と制約

- バイナリ生成テストの実行には Chromium または Chrome が必要です。
- 一部の統合テストは比較前に環境依存の出力を正規化します。
- Windows 専用のユニットテストは非 Windows 環境ではスキップされます。
- これらのテストは見た目の完全一致や UI 操作の完全 end-to-end までは保証しません。
```

- [ ] **Step 5: 日本語版を追加してコミットする**

```bash
git add test/README.ja.md
git commit -m "docs: add Japanese test documentation"
```

### Task 4: 英日整合性と参照先を検証する

**Files:**
- Read: `test/README.md`
- Read: `test/README.ja.md`
- Read: `package.json`

- [ ] **Step 1: 英日ドキュメントの見出しと説明対象を見比べる**

Run: `diff -u <(rg '^#|^##|^- ' test/README.md) <(rg '^#|^##|^- ' test/README.ja.md)`
Expected: 言語差はあっても、見出し構成と箇条書きの対応関係を確認できる。

- [ ] **Step 2: テスト実行コマンドとファイル参照を確認する**

Run: `rg -n "test:unit|test:integration|npm test|test/unit/utils.test.js|test/integration/extension.test.js" test/README.md test/README.ja.md`
Expected: 両ファイルに正しいコマンドとファイルパスが含まれる。

- [ ] **Step 3: 体裁確認として Markdown を読み直す**

Run: `sed -n '1,220p' test/README.md && sed -n '1,220p' test/README.ja.md`
Expected: 見出し順、文体、説明粒度に不自然な点がない。

- [ ] **Step 4: 最終確認用のテストを実行する**

Run: `npm run test:unit`
Expected: PASS。今回の変更は文書のみだが、既存のユニットテスト実行手順が文書と矛盾しないことを確認できる。

- [ ] **Step 5: 変更全体をコミットする**

```bash
git add test/README.md test/README.ja.md
git commit -m "docs: add test suite documentation"
```