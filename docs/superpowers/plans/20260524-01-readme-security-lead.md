# README セキュリティ強化リード追加 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `README.ja.md` / `README.md` の「仕様変更（Breaking Changes）」セクションにある Raw HTML サニタイズ項目の行頭に、短いカテゴリラベル（`セキュリティ強化:` / `Security hardening:`）を差し込む。

**Architecture:** Markdown ファイル 2 件の各 1 行に対するテキスト編集のみ。コード・テストへの影響なし。検証は GitHub / VS Code Marketplace 上での Markdown レンダリングを目視で確認する。

**Tech Stack:** Markdown (CommonMark + GFM)。`README.ja.md` は GitHub 上で表示、`README.md` は VS Code Marketplace と GitHub 上で表示される。

**Spec:** [`docs/superpowers/specs/20260524-01-readme-security-lead-design.md`](../specs/20260524-01-readme-security-lead-design.md)

**Branch / Worktree:** `feature/readme-security-lead` at `.worktrees/readme-security-lead`

---

## File Structure

- Modify: `README.ja.md` (L48 のみ)
- Modify: `README.md` (L50 のみ)

他のファイルには触れない。

---

## Task 1: README.ja.md にリードを追加

**Files:**
- Modify: `README.ja.md:48`

- [ ] **Step 1: 該当行の現状を確認**

`README.ja.md` の 48 行目が以下と完全一致することを確認する。

```
- XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の Raw HTML が既定で [GFM Disallowed Raw HTML 拡張](https://github.github.com/gfm/#disallowed-raw-html-extension-) に準拠してサニタイズされるようになりました。`<script>` / `<iframe>` / `<style>` 等のタグおよび `on*` / `javascript:` 属性が Markdown 本文から除去されます。挙動は新しい [markdown-pdf.sanitize](#markdown-pdfsanitize) 設定で制御できます。
```

完全一致しない場合は、READMEがすでに変更されている可能性があるため、ユーザーに確認してから進む。

- [ ] **Step 2: リード「セキュリティ強化: 」を行頭の `- ` の直後に挿入**

Edit ツールで以下の置換を行う。

old_string:
```
- XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の Raw HTML が既定で
```

new_string:
```
- セキュリティ強化: XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の Raw HTML が既定で
```

挿入位置は `- ` と `XSS` の間。元の文章は一切変更しない。リンク・コード・記号・末尾の句点を含むすべての既存テキストは保持する。

- [ ] **Step 3: 変更後の行を確認**

48 行目が以下になっていることを確認する。

```
- セキュリティ強化: XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の Raw HTML が既定で [GFM Disallowed Raw HTML 拡張](https://github.github.com/gfm/#disallowed-raw-html-extension-) に準拠してサニタイズされるようになりました。`<script>` / `<iframe>` / `<style>` 等のタグおよび `on*` / `javascript:` 属性が Markdown 本文から除去されます。挙動は新しい [markdown-pdf.sanitize](#markdown-pdfsanitize) 設定で制御できます。
```

確認コマンド:

```bash
sed -n '48p' README.ja.md
```

期待値: 上記の行が出力される。

---

## Task 2: README.md にリードを追加

**Files:**
- Modify: `README.md:50`

- [ ] **Step 1: 該当行の現状を確認**

`README.md` の 50 行目が以下と完全一致することを確認する。

```
- To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), raw HTML in Markdown is now sanitized by default following the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). Tags such as `<script>`, `<iframe>`, `<style>`, and `on*` / `javascript:` attributes are stripped from Markdown body content. The behavior is controlled by the new [markdown-pdf.sanitize](#markdown-pdfsanitize) setting.
```

完全一致しない場合は、READMEがすでに変更されている可能性があるため、ユーザーに確認してから進む。

- [ ] **Step 2: リード「Security hardening: 」を行頭の `- ` の直後に挿入**

Edit ツールで以下の置換を行う。

old_string:
```
- To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), raw HTML in Markdown is now sanitized by default
```

new_string:
```
- Security hardening: To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), raw HTML in Markdown is now sanitized by default
```

挿入位置は `- ` と `To` の間。元の文章は一切変更しない。

- [ ] **Step 3: 変更後の行を確認**

50 行目が以下になっていることを確認する。

```
- Security hardening: To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), raw HTML in Markdown is now sanitized by default following the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). Tags such as `<script>`, `<iframe>`, `<style>`, and `on*` / `javascript:` attributes are stripped from Markdown body content. The behavior is controlled by the new [markdown-pdf.sanitize](#markdown-pdfsanitize) setting.
```

確認コマンド:

```bash
sed -n '50p' README.md
```

期待値: 上記の行が出力される。

---

## Task 3: 差分の検証とコミット

**Files:**
- 変更済み: `README.ja.md`, `README.md`

- [ ] **Step 1: 差分が 2 ファイル各 1 行のみであることを確認**

```bash
git -C .worktrees/readme-security-lead diff --stat
```

期待値: `README.md | 2 +-` と `README.ja.md | 2 +-` のような、2 ファイル各 1 行の追加・削除のみ。それ以外のファイルが含まれていたら止めてユーザーに確認する。

- [ ] **Step 2: 詳細差分を確認**

```bash
git -C .worktrees/readme-security-lead diff README.ja.md README.md
```

期待値:
- `README.ja.md` 側: 旧行が削除され、`- セキュリティ強化: XSS のリスクに対応するため…` の行が追加されている。
- `README.md` 側: 旧行が削除され、`- Security hardening: To mitigate XSS-like risk…` の行が追加されている。
- それ以外の変更（空白、行末、他の行）が一切ないこと。

- [ ] **Step 3: Markdown レンダリングを目視確認**

GitHub 上で README が壊れていないかを目視で確認する。少なくとも以下を確認:
- リスト構造（`-` で始まる箇条書き）が崩れていない
- 既存のリンク（`[#411]`, `[GFM Disallowed Raw HTML 拡張]`, `[markdown-pdf.sanitize]`）が正しくクリック可能
- コード片（`` `<script>` `` 等）が壊れていない

ローカルで確認する場合は VS Code の Markdown プレビューで `README.ja.md` / `README.md` を開く。

確認コマンドの例（VS Code 起動済みの場合）:

```bash
code -r .worktrees/readme-security-lead/README.ja.md
code -r .worktrees/readme-security-lead/README.md
```

- [ ] **Step 4: コミット**

```bash
cd .worktrees/readme-security-lead
git add README.ja.md README.md
git commit -m "$(cat <<'EOF'
docs(readme): prepend "Security hardening" lead to sanitize entry

README の仕様変更セクションにある XSS サニタイズ項目の行頭にカテゴリラベルを挿入し、一覧で何の対応か一目で分かるようにする。既存の説明文は一切変更しない。

- README.ja.md: 「セキュリティ強化: 」を追加
- README.md: 「Security hardening: 」を追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: コミット結果を確認**

```bash
git -C .worktrees/readme-security-lead log --oneline -2
```

期待値: 直近 2 件のコミットが `docs(readme): prepend "Security hardening" lead to sanitize entry` と `docs(spec): add design for README security-hardening lead`。

---

## 完了条件

- [ ] `README.ja.md` L48 が `セキュリティ強化: ` で始まる
- [ ] `README.md` L50 が `Security hardening: ` で始まる
- [ ] それ以外のファイル・行に変更がない
- [ ] Markdown のレンダリングが壊れていない（リスト、リンク、コード片）
- [ ] `feature/readme-security-lead` ブランチに README 変更のコミットが乗っている

完了後、`superpowers:finishing-a-development-branch` ではなく `AGENTS.md` 規約に従い、ユーザーの承認後に `develop` への `--no-ff` マージを行う。
