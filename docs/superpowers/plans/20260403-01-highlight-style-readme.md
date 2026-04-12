# ハイライトスタイル仕様変更 README 通知追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** highlight.js アップグレードに伴うスタイル変更の通知を README.md と README.ja.md の「仕様変更」セクションに追加する。

**Architecture:** 2ファイルへのテキスト挿入のみ。コード変更なし。

**Tech Stack:** Markdown

**Working branch:** `feature/package-update`（このブランチ以外に切り替えないこと）

---

### Task 1: README.md に英語版の通知を追加

**Files:**
- Modify: `README.md:26-28`

- [ ] **Step 1: 通知文を挿入**

`## Specification Changes` の見出し直後（27行目）の空行を以下に置き換える:

```markdown
## Specification Changes

- Syntax Highlight Style Changes
  - Starting from version X.X.X, highlight.js has been updated from version 9 to version 11. As a result, some syntax highlighting style names have been changed or removed.
  - If your configured style is no longer available, the extension will automatically fall back to `tomorrow.css` and display a warning message.
  - Please check the [available styles](https://github.com/highlightjs/highlight.js/tree/main/src/styles) and update your [markdown-pdf.highlightStyle](#markdown-pdfhighlightstyle) setting if needed.

## Features
```

- [ ] **Step 2: 目視確認**

README.md を開き、「Specification Changes」セクションに通知文が正しく表示されていることを確認する。

- [ ] **Step 3: コミット**

```bash
git add README.md
git commit -m "docs: add highlight style breaking changes notice to README"
```

---

### Task 2: README.ja.md に日本語版の通知を追加

**Files:**
- Modify: `README.ja.md:24-26`

- [ ] **Step 1: 通知文を挿入**

`## 仕様変更` の見出し直後（25行目）の空行を以下に置き換える:

```markdown
## 仕様変更

- シンタックスハイライトのスタイル変更
  - バージョンX.X.Xから、highlight.js がバージョン9から11に更新されました。これにより、一部のシンタックスハイライトのスタイル名が変更または削除されています。
  - 設定されたスタイルが利用できなくなった場合、拡張機能は自動的に `tomorrow.css` にフォールバックし、警告メッセージを表示します。
  - [利用可能なスタイル](https://github.com/highlightjs/highlight.js/tree/main/src/styles)を確認し、必要に応じて [markdown-pdf.highlightStyle](#markdown-pdfhighlightstyle) の設定を更新してください。

## 機能
```

- [ ] **Step 2: 目視確認**

README.ja.md を開き、「仕様変更」セクションに通知文が正しく表示されていることを確認する。

- [ ] **Step 3: コミット**

```bash
git add README.ja.md
git commit -m "docs: add highlight style breaking changes notice to README.ja"
```
