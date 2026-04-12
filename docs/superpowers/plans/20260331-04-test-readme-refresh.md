# テスト README 最新化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `test/README.md` と `test/README.ja.md` を現在のテスト構成に合わせて更新し、統合テストの 3 系統を英語と日本語で正しく説明できるようにする。

**Architecture:** 既存の README の見出し構成は維持しつつ、`test/integration/extension.test.js` の責務を HTML スナップショット、バイナリ生成、異常系の 3 系統として再整理する。内容は `test/unit/utils.test.js`、`test/integration/extension.test.js`、`package.json` を根拠に記述し、英語版と日本語版の整合性を保つ。

**Tech Stack:** Markdown, Node.js, npm scripts, Mocha, VS Code extension test runner

---

### Task 1: 現行テスト内容と README の差分を整理する

**Files:**
- Read: `test/README.md`
- Read: `test/README.ja.md`
- Read: `test/unit/utils.test.js`
- Read: `test/integration/extension.test.js`
- Read: `package.json`

- [ ] **Step 1: 英語版 README の現状を確認する**

```bash
sed -n '1,240p' test/README.md
```

Expected: `Integration Tests` 節が HTML スナップショットとバイナリ生成中心の説明になっていることを確認できる。

- [ ] **Step 2: 日本語版 README の現状を確認する**

```bash
sed -n '1,240p' test/README.ja.md
```

Expected: 英語版と同じ構成で、異常系テストの説明が不足していることを確認できる。

- [ ] **Step 3: 統合テストの責務を確認する**

```bash
sed -n '1,320p' test/integration/extension.test.js
```

Expected: `Integration HTML Snapshot Tests`、`Integration Binary Generation Tests`、`Error Handling Tests` の 3 系統があることを確認できる。

- [ ] **Step 4: 実行コマンド定義を確認する**

```bash
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts, null, 2))"
```

Expected: `test` と `test:unit` のスクリプト定義が表示される。

### Task 2: 英語版 README を最新のテスト構成に合わせて更新する

**Files:**
- Modify: `test/README.md`
- Read: `test/integration/extension.test.js`
- Read: `package.json`

- [ ] **Step 1: `Test Structure` 節の説明内容を更新する**

更新方針:
- `test/unit/utils.test.js` は `src/utils.js` のユーティリティ検証として維持する
- `test/integration/extension.test.js` は HTML スナップショット、バイナリ生成、異常系の 3 系統を持つと明記する
- `test/integration/fixtures/` と `test/integration/expected/` の役割を簡潔に維持する

- [ ] **Step 2: `Integration Tests` 節を 3 系統の説明に整理する**

記述要件:
- HTML スナップショットは fixture Markdown を開き、HTML を生成し、`normalizeHtml` で file URI と日付・時刻を正規化して expected と比較することを書く
- バイナリ生成は Chromium/Chrome 前提で `_combined.md` を作成し、PDF、PNG、JPEG の存在・サイズ・マジックバイトを確認することを書く
- 異常系テストは非 Markdown ファイルと untitled ドキュメントでコマンド実行時にクラッシュせず、不要な HTML を生成しないことを確認すると書く

- [ ] **Step 3: `How to Run` と `Notes and Limitations` を現状に合わせて整える**

記述要件:
- `npm run test:unit`
- `npm test`
- Chromium/Chrome 依存
- 環境依存値の正規化
- Windows 固有テストのスキップ

### Task 3: 日本語版 README を英語版と整合するように更新する

**Files:**
- Modify: `test/README.ja.md`
- Read: `test/README.md`

- [ ] **Step 1: `テスト構成` 節を英語版と同じ責務分割に更新する**

記述要件:
- `test/integration/extension.test.js` が HTML スナップショット、バイナリ生成、異常系を含むことを明記する
- fixture と expected の役割を日本語で自然に説明する

- [ ] **Step 2: `統合テスト` 節を 3 系統の説明に整理する**

記述要件:
- HTML スナップショットの正規化対象を file URI、日付、時刻として説明する
- バイナリ生成は `_combined.md` を起点に PDF、PNG、JPEG を検証すると説明する
- 異常系テストは非 Markdown ファイルと untitled 文書で安全に終了する挙動を確認すると説明する

- [ ] **Step 3: `実行方法` と `注意点と制約` を英語版に対応させる**

記述要件:
- 実行コマンドを英語版と一致させる
- `xvfb-run`、Chromium/Chrome、環境依存値の正規化、Windows スキップを説明する

### Task 4: 差分と記述整合性を確認する

**Files:**
- Read: `test/README.md`
- Read: `test/README.ja.md`

- [ ] **Step 1: 差分を確認する**

```bash
git diff -- test/README.md test/README.ja.md
```

Expected: README 2 ファイルだけに意図した文言更新が出る。

- [ ] **Step 2: 記述が現行テストコードと整合することを確認する**

確認観点:
- `Error Handling Tests` への言及がある
- HTML スナップショットの正規化内容が `normalizeHtml` と一致する
- バイナリ生成の説明が `_combined.md` とマジックバイト確認に一致する
- 実行コマンドの説明が `package.json` と一致する

- [ ] **Step 3: 変更をコミットする**

```bash
git add test/README.md test/README.ja.md
git commit -m "docs: refresh test readmes"
```
