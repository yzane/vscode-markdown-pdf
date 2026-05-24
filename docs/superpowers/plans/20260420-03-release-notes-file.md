# Release Notes ファイル分離 実装プラン

> **方針変更 (2026-04-20):** 本プランの途中で RELEASE_NOTES.md 採用を取りやめ、CHANGELOG.md 単一化方針に転換した。設計文書 `docs/superpowers/specs/20260420-03-release-notes-file-design.md` 冒頭の方針変更記録を参照。最終的に採用された変更は (1) README 下部セクションを Change Log にリネーム、(2) What's New を短縮化、(3) PlantUML フェンス記述の修正、(4) Include 機能説明への読み込み失敗挙動追記、のみ。


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザー視点の変更説明を `RELEASE_NOTES.md` / `RELEASE_NOTES.ja.md` に切り出し、`README.md` / `README.ja.md` は最新バージョン分の抜粋と RELEASE_NOTES / CHANGELOG へのリンクに整理する。併せて現 README 内の不正確な PlantUML 記述を修正する。

**Architecture:** 純粋なドキュメント変更。3 層構造 (README → RELEASE_NOTES → CHANGELOG) を導入する。新規ファイル 2 点 (`RELEASE_NOTES.md`, `RELEASE_NOTES.ja.md`) を作成し、既存の `README.md` / `README.ja.md` を編集する。`CHANGELOG.md` は変更しない。

**Tech Stack:** Markdown（GitHub Flavored Markdown）。追加のツールチェーン変更なし。既存の `npm run sample` で README のレンダリング回帰を確認する。

**Branch / Worktree:**
- 作業ブランチ: `feature/release-notes-file`（既に存在）
- 作業ディレクトリ: `.worktrees/release-notes-file/`
- コミットとローカル作業はこの worktree 内で行う。

**関連 spec:** `docs/superpowers/specs/20260420-03-release-notes-file-design.md`

---

## ファイル構成

| 操作 | パス | 責務 |
|---|---|---|
| 新規 | `RELEASE_NOTES.md` | ユーザー視点の変更説明（英語）。2.0.0 / 2.0.1 / X.Y.Z のエントリを保持 |
| 新規 | `RELEASE_NOTES.ja.md` | `RELEASE_NOTES.md` の日本語対訳 |
| 編集 | `README.md` | TOC 更新、上部 `What's New` / `Breaking Changes` の整理、下部 `Release Notes` → `Change Log` 変更、PlantUML 記述修正 |
| 編集 | `README.ja.md` | `README.md` と対称の変更 |
| 変更なし | `CHANGELOG.md` | 従来どおり詳細な開発視点ログ |

## アンカー規約

バージョン見出しのアンカーには明示的な `<a id="...">` を置かず、GitHub（および VS Code プレビュー）の自動スラグ生成に任せる。CHANGELOG.md と同じ運用で、README / RELEASE_NOTES 間のリンクも同じ方式で機能する。

見出し → 自動生成スラグの対応は以下:

| 見出し | スラグ |
|---|---|
| `## X.Y.Z (YYYY/MM/DD)` | `#xyz-yyyymmdd` |
| `## 2.0.1 (2026/04/14)` | `#201-20260414` |
| `## 2.0.0 (2026/04/13)` | `#200-20260413` |

`README.md` 側の各項目末尾から `[RELEASE_NOTES.md#xyz-yyyymmdd](RELEASE_NOTES.md#xyz-yyyymmdd)` 形式でリンクする（同バージョンの全項目は同じスラグを共有）。`README.ja.md` からは `RELEASE_NOTES.ja.md#<slug>` を使う。

本リリースで X.Y.Z を具体的なバージョン・日付に書き換える場合は、RELEASE_NOTES 側の見出しと README 側のスラグ参照を同一 PR 内で揃えて更新する。

---

## Task 1: `RELEASE_NOTES.md` を作成する（英語版）

**Files:**
- Create: `RELEASE_NOTES.md`

**Context:** 現 `README.md` 上部の `What's New` / `Breaking Changes` にあるユーザー視点のテキストを種に、ハイブリッド形式（バージョン見出し + 太字ラベル + プロース）で再構成する。バージョン見出しのアンカーは GitHub の自動スラグに任せる（明示的な `<a id="...">` は置かない）。

- [ ] **Step 1: 新規ファイルを作成**

下記の内容で `RELEASE_NOTES.md` を新規作成する。`.worktrees/release-notes-file/RELEASE_NOTES.md` に配置。

````markdown
# Release Notes

User-facing summary of changes. For the detailed development log, see [CHANGELOG.md](CHANGELOG.md).

## X.Y.Z (YYYY/MM/DD)

**New feature: PlantUML fenced code block support**

` ```plantuml ` fenced code blocks are now rendered as PlantUML diagrams alongside the existing `@startuml` / `@enduml` block-marker form. Both syntaxes produce the same `<img>` tag and share the [markdown-pdf.plantumlServer](README.md#markdown-pdfplantumlserver) setting, so you can mix them in the same document and pick whichever fits the editor you primarily use.

```plantuml
Alice -> Bob: hello
```

**New feature: Math rendering via KaTeX**

LaTeX math is now rendered via [KaTeX](https://katex.org/), matching VS Code's built-in Markdown preview. Inline (`$…$`, `\(…\)`), display (`$$…$$`, `\[…\]`), LaTeX environments, and ` ```math ` fenced code blocks are supported. Rendering runs locally — no network access is required.

To keep `$X$`-style placeholders as plain text, set [markdown-pdf.math.enabled](README.md#markdown-pdfmathenabled) to `false`, or disable math per document via `math.enabled: false` in the front matter.

**Improvement: Chromium auto-download fetches the latest Chrome Stable**

Chromium auto-download now resolves the latest Chrome Stable build id from the [Chrome for Testing API](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json) instead of relying only on the build id pinned by `puppeteer-core`. The new [markdown-pdf.chromium.autoDownload](README.md#markdown-pdfchromiumautodownload) setting (default `true`) lets you opt out and rely on an installed browser or [markdown-pdf.executablePath](README.md#markdown-pdfexecutablepath) instead.

**Breaking change: Markdown HTML is sanitized by default**

To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), HTML in Markdown is now sanitized by default following the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). The following are stripped from the Markdown body:

- Tags: `<script>`, `<iframe>`, `<style>`, `<textarea>`, `<title>`, `<xmp>`, `<noembed>`, `<noframes>`, `<plaintext>` (the opening `<` is escaped to `&lt;`; content is preserved as visible text).
- `on*` event handler attributes (`onclick`, `onload`, ...).
- `href` / `src` values that start with `javascript:`.

The behavior is controlled by the new [markdown-pdf.sanitize](README.md#markdown-pdfsanitize) setting:

- `"gfm"` (default) — strip disallowed tags and dangerous attributes. Recommended when opening Markdown written by others.
- `"gfm-allow-style"` — same as `"gfm"` but keeps `<style>`. Useful for self-contained PDFs built from Markdown you trust.
- `"none"` — legacy behavior, no sanitization. Not recommended.

**Migration — keep the previous behavior or embedded `<style>`:**

- Set `"markdown-pdf.sanitize": "none"` to preserve the previous behavior exactly.
- Use `"gfm-allow-style"` if you only need inline `<style>` blocks.
- Move layout CSS into a stylesheet file and reference it via [markdown-pdf.styles](README.md#markdown-pdfstyles) — external stylesheets are not sanitized.

## 2.0.1 (2026/04/14)

**Fix: Self-closing `<div class="page" />` now triggers a page break**

Self-closing `<div class="page" />` now correctly triggers a page break, matching the paired `<div class="page"></div>` form ([#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)).

## 2.0.0 (2026/04/13)

**Improvement: Include errors are reported inline**

Include (`:[label](path.md)`) now reports errors inline at the include site instead of aborting the whole export. A missing or unreadable fragment no longer breaks the rest of the document.

**Improvement: Image `src` rewriting handles more edge cases**

Image `src` rewriting now correctly handles quoted attributes, flexible whitespace, and raw-text contexts.

**Improvement: Front matter supports BOM-prefixed files**

Front matter parsing now accepts YAML front matter even when the file begins with a UTF-8 byte order mark.

**Breaking change: Heading IDs follow GitHub-compatible slug generation**

Heading IDs are now generated using GitHub-compatible VS Code slug generation. Compared to the previous implementation, the new slug generator preserves CJK characters and underscores while removing unsupported punctuation, which can cause existing internal anchors (e.g. `#some-heading`) to resolve differently.

If your Markdown relies on specific anchor strings (table of contents, cross-document links), re-check the generated anchors after exporting and update links as needed. See the FAQ entry [Why did my heading anchors change?](README.md#why-did-my-heading-anchors-change) for details.

**Breaking change: highlight.js upgraded to v11**

`highlight.js` was upgraded from v9 to v11. Some v9 style names were renamed or removed. Markdown PDF maps legacy style names to current names where possible and falls back to `tomorrow.css` when no mapping is available.

Check the [available styles](https://github.com/highlightjs/highlight.js/tree/main/src/styles) and update `markdown-pdf.highlightStyle` to a current style name. See [Why did my syntax highlight style stop working?](README.md#why-did-my-syntax-highlight-style-stop-working) for details.

**Breaking change: Front matter parsing is stricter**

Front matter parsing now uses a custom implementation instead of `gray-matter`. The new parser rejects the following structures that the previous parser may have accepted:

- Top-level YAML sequences (arrays).
- Front matter that does not parse into a plain object.
- Malformed YAML structures.

Valid front matter must be a YAML mapping (object) at the top level. BOM-prefixed files are still supported. See [Why is my front matter no longer parsed?](README.md#why-is-my-front-matter-no-longer-parsed) for details.

**Breaking change: Chromium resolution and cache moved to a built-in resolver**

Chromium download and cache management moved to a built-in `chromium-resolver`. The previous temporary-directory fallback was removed; the managed Chromium is stored under the VS Code global storage directory. An installed Chrome/Edge browser is preferred before falling back to auto-download. See [How is the Chromium browser selected?](README.md#how-is-the-chromium-browser-selected) and [Where is Chromium downloaded?](README.md#where-is-chromium-downloaded) for details.
````

- [ ] **Step 2: 検証**

Run:

```bash
test -f RELEASE_NOTES.md && grep -n '^## X.Y.Z (YYYY/MM/DD)$' RELEASE_NOTES.md && grep -n '^## 2.0.1 (2026/04/14)$' RELEASE_NOTES.md && grep -n '^## 2.0.0 (2026/04/13)$' RELEASE_NOTES.md && ! grep -q '<a id=' RELEASE_NOTES.md && echo OK
```

Expected: ファイルが存在し、3 つのバージョン見出しがヒットし、明示的 `<a id=` が含まれておらず、末尾に `OK`。

- [ ] **Step 3: コミット**

```bash
git add RELEASE_NOTES.md
git commit -m "$(cat <<'EOF'
docs(release-notes): add RELEASE_NOTES.md with user-facing notes

Seed 2.0.0, 2.0.1, and X.Y.Z entries in the hybrid bold-label + prose
format described in docs/superpowers/specs/20260420-03-release-notes-file-design.md.
Version headings rely on GitHub's auto-generated slugs (e.g.
#200-20260413) so README can link to them without explicit anchors.
EOF
)"
```

---

## Task 2: `RELEASE_NOTES.ja.md` を作成する（日本語版）

**Files:**
- Create: `RELEASE_NOTES.ja.md`

**Context:** `README.ja.md` の `What's New` / `仕様変更` の既存日本語テキストを種に、英語版と同じ構造・同じ見出しで日本語版を作成する。バージョン見出しのアンカーは GitHub 自動スラグに任せる（明示的な `<a id="...">` は置かない）。「生 HTML」表現は使わず「Markdown 内の HTML」などの言い回しを使う。

- [ ] **Step 1: 新規ファイルを作成**

下記の内容で `RELEASE_NOTES.ja.md` を新規作成する。

````markdown
# Release Notes

ユーザー向けの変更点まとめです。開発者向けの詳細な変更履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。

## X.Y.Z (YYYY/MM/DD)

**新機能: PlantUML fenced code block サポート**

` ```plantuml ` 形式のコードブロックがそのまま PlantUML として描画されるようになりました。従来の `@startuml` / `@enduml` 形式も互換性のため引き続き動作します。どちらの記法でも同じ `<img>` タグにレンダリングされ、[markdown-pdf.plantumlServer](README.ja.md#markdown-pdfplantumlserver) 設定を共有します。

```plantuml
Alice -> Bob: hello
```

**新機能: KaTeX による数式描画**

[KaTeX](https://katex.org/) で LaTeX 数式を描画できるようになりました（VS Code 標準の Markdown プレビューと同じ動作）。インライン `$…$` / `\(…\)`、ブロック `$$…$$` / `\[…\]`、LaTeX 環境、 ` ```math ` フェンスドコードブロックをサポートします。描画はローカルで完結するためネットワーク接続は不要です。

`$X$` 形式のプレースホルダを数式として解釈させたくない場合は、[markdown-pdf.math.enabled](README.ja.md#markdown-pdfmathenabled) を `false` に設定するか、フロントマターで `math.enabled: false` を指定してください。

**改善: Chromium 自動ダウンロードが最新 Stable を取得**

Chromium の自動ダウンロードが、`puppeteer-core` に固定された build id ではなく、[Chrome for Testing API](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json) から最新の Chrome Stable を取得するようになりました。新設定 [markdown-pdf.chromium.autoDownload](README.ja.md#markdown-pdfchromiumautodownload)（既定 `true`）を `false` にすると自動ダウンロードをオプトアウトし、インストール済みブラウザまたは [markdown-pdf.executablePath](README.ja.md#markdown-pdfexecutablepath) のみを使用します。

**Breaking change: Markdown 内の HTML サニタイズが既定で有効化**

XSS リスク低減のため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 本文内の HTML が既定で [GFM Disallowed Raw HTML 拡張](https://github.github.com/gfm/#disallowed-raw-html-extension-) に準拠してサニタイズされるようになりました。Markdown 本文から以下が除去されます:

- タグ: `<script>` / `<iframe>` / `<style>` / `<textarea>` / `<title>` / `<xmp>` / `<noembed>` / `<noframes>` / `<plaintext>`（開きタグの `<` は `&lt;` にエスケープされ、中身は可視テキストとして残ります）
- `on*` イベントハンドラ属性（`onclick`, `onload` 等）
- `href` / `src` の値が `javascript:` で始まるもの

挙動は新設定 [markdown-pdf.sanitize](README.ja.md#markdown-pdfsanitize) で制御できます:

- `"gfm"`（既定）— 禁止タグと危険な属性を除去。他者が作成した Markdown を開く可能性がある通常利用に推奨。
- `"gfm-allow-style"` — `"gfm"` と同様、ただし `<style>` は残す。自分で書いた Markdown に CSS を同梱して 1 ファイル完結の PDF を作りたい場合に便利。
- `"none"` — 従来互換のサニタイズ無効モード。基本的に非推奨。

**対応が必要なケース:**

- 従来の挙動をそのまま維持したい: `"markdown-pdf.sanitize": "none"` を設定。
- インライン `<style>` だけ残したい: `"gfm-allow-style"` を設定。
- レイアウト用 CSS は別 `.css` ファイルに移し、[markdown-pdf.styles](README.ja.md#markdown-pdfstyles) で読み込む形に移行する（外部スタイルシートはサニタイズ対象外）。

## 2.0.1 (2026/04/14)

**修正: 自己閉じタグの `<div class="page" />` で改ページが動作**

自己閉じタグ形式の `<div class="page" />` が改ページとして正しく認識されるようになりました（対応タグ形式 `<div class="page"></div>` と挙動が揃います）。[#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)

## 2.0.0 (2026/04/13)

**改善: Include のエラーをインライン報告**

Include（`:[label](path.md)`）が読み込み失敗時にエクスポート全体を中断せず、該当箇所にエラーを埋め込むようになりました。一部のフラグメントが欠けていてもドキュメントの残りは出力されます。

**改善: 画像 `src` 書き換えのエッジケース対応**

画像 `src` の書き換えで、引用符付き属性・可変長の空白・raw-text コンテキストの取り扱いが改善されました。

**改善: BOM 付きフロントマターに対応**

UTF-8 BOM で始まるファイルでも YAML フロントマターが正しく解析されるようになりました。

**Breaking change: 見出し ID が GitHub 互換の slug 生成になる**

見出し ID の生成が GitHub 互換の VS Code slug 生成に変わりました。新しい slug ジェネレータは CJK 文字とアンダースコアを保持する一方でサポートされない記号を除去するため、既存の内部アンカー（例: `#some-heading`）の解決結果が変わる可能性があります。

目次や相互参照など特定のアンカー文字列に依存している Markdown を使っている場合は、エクスポート後にアンカーを確認してリンクを更新してください。詳細は FAQ の [見出しのアンカーが変わったのはなぜ？](README.ja.md#why-did-my-heading-anchors-change) を参照してください。

**Breaking change: highlight.js を v11 にアップグレード**

`highlight.js` が v9 から v11 にアップグレードされました。v9 のスタイル名の一部は名称変更または削除されています。Markdown PDF は古いスタイル名を可能な範囲で現在の名前にマッピングし、マッピング不能な場合は `tomorrow.css` にフォールバックします。

[利用可能なスタイル](https://github.com/highlightjs/highlight.js/tree/main/src/styles) を確認し、`markdown-pdf.highlightStyle` を現行のスタイル名に更新してください。詳細は [シンタックスハイライトのスタイルが効かなくなったのはなぜ？](README.ja.md#why-did-my-syntax-highlight-style-stop-working) を参照してください。

**Breaking change: フロントマター解析が厳格化**

フロントマター解析が `gray-matter` ではなくカスタム実装になり、より厳格になりました。以下のようにトップレベルがプレーンオブジェクトでない構造は拒否されます:

- トップレベルが YAML シーケンス（配列）のフロントマター
- プレーンオブジェクトに解析されないフロントマター
- 不正な YAML 構造

有効なフロントマターはトップレベルが YAML マッピング（オブジェクト）である必要があります。BOM 付きファイルは引き続きサポートされます。詳細は [フロントマターが解析されなくなったのはなぜ？](README.ja.md#why-is-my-front-matter-no-longer-parsed) を参照してください。

**Breaking change: Chromium の解決とキャッシュが刷新**

Chromium のダウンロードとキャッシュ管理が組み込みの `chromium-resolver` に移行しました。従来の一時ディレクトリへのフォールバックは廃止され、管理済み Chromium は VS Code の global storage ディレクトリに保存されます。インストール済みの Chrome / Edge を優先し、見つからない場合のみ自動ダウンロードに回ります。詳細は [Chromium ブラウザはどのように選択されますか？](README.ja.md#how-is-the-chromium-browser-selected) および [Chromium はどこにダウンロードされますか？](README.ja.md#where-is-chromium-downloaded) を参照してください。
````

- [ ] **Step 2: 検証**

Run:

```bash
test -f RELEASE_NOTES.ja.md && grep -n '^## X.Y.Z (YYYY/MM/DD)$' RELEASE_NOTES.ja.md && grep -n '^## 2.0.1 (2026/04/14)$' RELEASE_NOTES.ja.md && grep -n '^## 2.0.0 (2026/04/13)$' RELEASE_NOTES.ja.md && ! grep -q '<a id=' RELEASE_NOTES.ja.md && ! grep -q '生 HTML' RELEASE_NOTES.ja.md && echo OK
```

Expected: 3 つのバージョン見出しがヒットし、明示的 `<a id=` が含まれておらず、「生 HTML」表現も含まれていない。末尾に `OK`。

- [ ] **Step 3: コミット**

```bash
git add RELEASE_NOTES.ja.md
git commit -m "$(cat <<'EOF'
docs(release-notes): add RELEASE_NOTES.ja.md (Japanese mirror)

Mirrors RELEASE_NOTES.md entries for 2.0.0, 2.0.1, and X.Y.Z in
Japanese, using the same version headings and relying on GitHub's
auto-generated slugs for anchors. Avoids the "生 HTML" term in favor of
"Markdown 内の HTML" per the spec's terminology guideline.
EOF
)"
```

---

## Task 3: `README.md` の TOC を更新

**Files:**
- Modify: `README.md` (line 26)

**Context:** 目次の項目名を `Release Notes` から `Change Log` に変更し、アンカーも合わせる。

- [ ] **Step 1: 行 26 を書き換え**

`README.md` 行 26 を以下のように書き換える。

Before:

```markdown
- [Release Notes](#release-notes)
```

After:

```markdown
- [Change Log](#change-log)
```

- [ ] **Step 2: 検証**

Run:

```bash
grep -n '^- \[Change Log\](#change-log)$' README.md && ! grep -n '\[Release Notes\](#release-notes)' README.md && echo OK
```

Expected: 新しい TOC 行が 1 箇所にヒットし、古い参照が消えており、末尾に `OK`。

- [ ] **Step 3: コミット**

```bash
git add README.md
git commit -m "docs(readme): rename Release Notes toc entry to Change Log"
```

---

## Task 4: `README.md` 上部 `What's New` セクションを更新

**Files:**
- Modify: `README.md` (lines 34-55)

**Context:** セクション冒頭に `RELEASE_NOTES.md` への誘導を追加し、各項目末尾に `Details:` リンクを追記し、PlantUML の不正確な第三者ツール並列比較を修正する。既存の `Details: [PlantUML](#plantuml)` 等の機能リンクはそのまま残し、RELEASE_NOTES.md への参照を追加する形。

- [ ] **Step 1: セクション冒頭の導入文を差し替え、X.Y.Z 項目を書き換え**

`README.md` の `## What's New` から `### 2.0.1` の直前まで（行 34〜46）を以下のブロックで置き換える。

Before (lines 34-46):

```markdown
## What's New

User-visible additions and improvements. For changes that may require action on your side, see [Breaking Changes](#breaking-changes).

### X.Y.Z

- Added support for ` ```plantuml ` fenced code blocks as a PlantUML syntax, in addition to the existing `@startuml` / `@enduml` block markers. Both are supported on equal footing (the fence form is the same one used by VS Code preview, GitHub, and GitLab).
    - Details: [PlantUML](#plantuml)
- Chromium auto-download now fetches the latest Chrome Stable build from the [Chrome for Testing API](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json), instead of relying only on the build id pinned by `puppeteer-core`. A new [markdown-pdf.chromium.autoDownload](#markdown-pdfchromiumautodownload) setting (default `true`) lets you opt out.
    - Details: [Where is Chromium downloaded?](#where-is-chromium-downloaded)
- Added math rendering support via [KaTeX](https://katex.org/), matching VS Code's built-in Markdown preview. Supports inline `$…$` / `\(…\)`, display `$$…$$` / `\[…\]`, and ` ```math ` fenced code blocks. Opt out via [markdown-pdf.math.enabled](#markdown-pdfmathenabled).
    - Details: [Math](#math)
```

After:

```markdown
## What's New

User-visible additions and improvements. For changes that may require action on your side, see [Breaking Changes](#breaking-changes). For the full user-facing release notes including past versions, see [RELEASE_NOTES.md](RELEASE_NOTES.md).

### X.Y.Z

- Added support for ` ```plantuml ` fenced code blocks as a PlantUML syntax, in addition to the existing `@startuml` / `@enduml` block markers. Both are supported on equal footing.
    - Details: [PlantUML](#plantuml) / [RELEASE_NOTES.md#xyz-yyyymmdd](RELEASE_NOTES.md#xyz-yyyymmdd)
- Chromium auto-download now fetches the latest Chrome Stable build from the [Chrome for Testing API](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json), instead of relying only on the build id pinned by `puppeteer-core`. A new [markdown-pdf.chromium.autoDownload](#markdown-pdfchromiumautodownload) setting (default `true`) lets you opt out.
    - Details: [Where is Chromium downloaded?](#where-is-chromium-downloaded) / [RELEASE_NOTES.md#xyz-yyyymmdd](RELEASE_NOTES.md#xyz-yyyymmdd)
- Added math rendering support via [KaTeX](https://katex.org/), matching VS Code's built-in Markdown preview. Supports inline `$…$` / `\(…\)`, display `$$…$$` / `\[…\]`, and ` ```math ` fenced code blocks. Opt out via [markdown-pdf.math.enabled](#markdown-pdfmathenabled).
    - Details: [Math](#math) / [RELEASE_NOTES.md#xyz-yyyymmdd](RELEASE_NOTES.md#xyz-yyyymmdd)
```

変更点:
- 行 36 の末尾に「For the full user-facing release notes including past versions, see [RELEASE_NOTES.md](RELEASE_NOTES.md).」を追加。
- 行 40 の `(the fence form is the same one used by VS Code preview, GitHub, and GitLab)` 部分を削除し、一文を短くする。
- 各項目の `Details: ...` 行末尾に `/ [RELEASE_NOTES.md#xyz-yyyymmdd](RELEASE_NOTES.md#xyz-yyyymmdd)` を追加。

- [ ] **Step 2: 2.0.1 / 2.0.0 項目の `Details:` を追記**

`### 2.0.1` ブロック（元行 47-49）の項目に `Details:` 行を追加する。

Before:

```markdown
### 2.0.1

- Self-closing `<div class="page" />` now correctly triggers a page break ([#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)).
```

After:

```markdown
### 2.0.1

- Self-closing `<div class="page" />` now correctly triggers a page break ([#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)).
    - Details: [RELEASE_NOTES.md#201-20260414](RELEASE_NOTES.md#201-20260414)
```

続いて `### 2.0.0` ブロック（元行 51-55）を書き換える。

Before:

```markdown
### 2.0.0

- Include (`:[label](path.md)`) now reports errors inline instead of aborting the whole export, so a missing or unreadable fragment no longer breaks the rest of the document.
- Image `src` rewriting now correctly handles quoted attributes, flexible whitespace, and raw-text contexts.
- Front matter parsing now supports BOM-prefixed files.
```

After:

```markdown
### 2.0.0

- Include (`:[label](path.md)`) now reports errors inline instead of aborting the whole export, so a missing or unreadable fragment no longer breaks the rest of the document.
    - Details: [RELEASE_NOTES.md#200-20260413](RELEASE_NOTES.md#200-20260413)
- Image `src` rewriting now correctly handles quoted attributes, flexible whitespace, and raw-text contexts.
    - Details: [RELEASE_NOTES.md#200-20260413](RELEASE_NOTES.md#200-20260413)
- Front matter parsing now supports BOM-prefixed files.
    - Details: [RELEASE_NOTES.md#200-20260413](RELEASE_NOTES.md#200-20260413)
```

- [ ] **Step 3: 検証**

Run:

```bash
! grep -n 'VS Code preview, GitHub, and GitLab' README.md && grep -cn 'RELEASE_NOTES.md#xyz-yyyymmdd' README.md && grep -cn 'RELEASE_NOTES.md#201-20260414' README.md && grep -cn 'RELEASE_NOTES.md#200-20260413' README.md && echo OK
```

Expected: PlantUML 第三者並列比較が消えており、各スラグが数行分ヒット（`xyz-yyyymmdd`: 3、`201-20260414`: 1、`200-20260413`: 3）し、末尾に `OK`。

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): link What's New items to RELEASE_NOTES.md

Add a pointer to RELEASE_NOTES.md in the section intro and append
per-item Details links. Drop the inaccurate "VS Code preview / GitHub /
GitLab" claim from the PlantUML line — GitLab is the only third-party
tool that natively renders the plantuml fence.
EOF
)"
```

---

## Task 5: `README.md` 上部 `Breaking Changes` セクションを更新

**Files:**
- Modify: `README.md` (lines 57-75)

**Context:** 冒頭に `RELEASE_NOTES.md` 誘導を追加し、各項目の `Details:` 行に RELEASE_NOTES アンカーを併記する。

- [ ] **Step 1: 冒頭導入行を差し替え**

`## Breaking Changes` のセクション直下の一行を以下のように変更する。

Before (line 59):

```markdown
Some changes may affect existing behavior. See the [FAQ](#faq) section for details.
```

After:

```markdown
Some changes may affect existing behavior. See the [FAQ](#faq) section for details. For the full user-facing release notes including past versions, see [RELEASE_NOTES.md](RELEASE_NOTES.md).
```

- [ ] **Step 2: X.Y.Z 項目の `Details:` に RELEASE_NOTES リンクを追記**

Before (lines 61-64):

```markdown
### X.Y.Z

- To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), raw HTML in Markdown is now sanitized by default following the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). Tags such as `<script>`, `<iframe>`, `<style>`, and `on*` / `javascript:` attributes are stripped from Markdown body content. The behavior is controlled by the new [markdown-pdf.sanitize](#markdown-pdfsanitize) setting.
    - Details: [Why is my raw HTML being escaped or removed?](#why-is-my-raw-html-being-escaped-or-removed)
```

After:

```markdown
### X.Y.Z

- To mitigate XSS-like risk ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)), raw HTML in Markdown is now sanitized by default following the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). Tags such as `<script>`, `<iframe>`, `<style>`, and `on*` / `javascript:` attributes are stripped from Markdown body content. The behavior is controlled by the new [markdown-pdf.sanitize](#markdown-pdfsanitize) setting.
    - Details: [Why is my raw HTML being escaped or removed?](#why-is-my-raw-html-being-escaped-or-removed) / [RELEASE_NOTES.md#xyz-yyyymmdd](RELEASE_NOTES.md#xyz-yyyymmdd)
```

- [ ] **Step 3: 2.0.0 項目の `Details:` に RELEASE_NOTES リンクを追記**

Before (lines 66-75):

```markdown
### 2.0.0

- Heading IDs now follow GitHub-compatible VS Code slug generation. Existing internal anchors in your documents may change.
    - Details: [Why did my heading anchors change?](#why-did-my-heading-anchors-change)
- Highlight.js upgraded from v9 to v11. Some highlight style names have been renamed or removed.
    - Details: [Why did my syntax highlight style stop working?](#why-did-my-syntax-highlight-style-stop-working)
- Front matter parsing is now stricter. Some previously accepted formats may be rejected.
    - Details: [Why is my front matter no longer parsed?](#why-is-my-front-matter-no-longer-parsed)
- Chromium is resolved from an installed Chrome/Edge browser first, or auto-downloaded on first use.
    - Details: [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) / [Where is Chromium downloaded?](#where-is-chromium-downloaded)
```

After:

```markdown
### 2.0.0

- Heading IDs now follow GitHub-compatible VS Code slug generation. Existing internal anchors in your documents may change.
    - Details: [Why did my heading anchors change?](#why-did-my-heading-anchors-change) / [RELEASE_NOTES.md#200-20260413](RELEASE_NOTES.md#200-20260413)
- Highlight.js upgraded from v9 to v11. Some highlight style names have been renamed or removed.
    - Details: [Why did my syntax highlight style stop working?](#why-did-my-syntax-highlight-style-stop-working) / [RELEASE_NOTES.md#200-20260413](RELEASE_NOTES.md#200-20260413)
- Front matter parsing is now stricter. Some previously accepted formats may be rejected.
    - Details: [Why is my front matter no longer parsed?](#why-is-my-front-matter-no-longer-parsed) / [RELEASE_NOTES.md#200-20260413](RELEASE_NOTES.md#200-20260413)
- Chromium is resolved from an installed Chrome/Edge browser first, or auto-downloaded on first use.
    - Details: [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) / [Where is Chromium downloaded?](#where-is-chromium-downloaded) / [RELEASE_NOTES.md#200-20260413](RELEASE_NOTES.md#200-20260413)
```

- [ ] **Step 4: 検証**

Run:

```bash
grep -c 'RELEASE_NOTES.md#xyz-yyyymmdd' README.md && grep -c 'RELEASE_NOTES.md#200-20260413' README.md && grep -q 'For the full user-facing release notes' README.md && echo OK
```

Expected: `RELEASE_NOTES.md#xyz-yyyymmdd` は 4 件以上、`RELEASE_NOTES.md#200-20260413` は 7 件以上（What's New 3 + Breaking Changes 4）、末尾に `OK`。

- [ ] **Step 5: コミット**

```bash
git add README.md
git commit -m "docs(readme): link Breaking Changes items to RELEASE_NOTES.md"
```

---

## Task 6: `README.md` `### PlantUML` 内 Fenced code block 説明を修正

**Files:**
- Modify: `README.md` (around line 151)

**Context:** `### PlantUML` > `#### Fenced code block` の説明で「VS Code's built-in Markdown preview, GitHub, and GitLab」と並列比較しているが、GitHub はネイティブ描画しない、VS Code ビルトインプレビューも拡張依存である。事実に即した表現に改める。

- [ ] **Step 1: 行 151 を書き換え**

Before (line 151):

```markdown
A ```` ```plantuml ```` fenced code block. This is the same form used by VS Code's built-in Markdown preview, GitHub, and GitLab.
```

After:

```markdown
A ```` ```plantuml ```` fenced code block. This is the common fence convention used across the PlantUML ecosystem (for example, [GitLab renders this form natively](https://docs.gitlab.com/administration/integration/plantuml/) when the PlantUML integration is enabled).
```

- [ ] **Step 2: 検証**

Run:

```bash
! grep -n "VS Code's built-in Markdown preview, GitHub, and GitLab" README.md && grep -n 'common fence convention used across the PlantUML ecosystem' README.md && echo OK
```

Expected: 古い文言が消え、新しい文言がヒットし、末尾に `OK`。

- [ ] **Step 3: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): correct plantuml fence provenance claim

GitHub does not natively render ```plantuml blocks, and VS Code's
built-in Markdown preview needs an extension. Describe the fence form
as the common PlantUML ecosystem convention and cite GitLab as the
concrete example of native rendering.
EOF
)"
```

---

## Task 7: `README.md` 下部 `Release Notes` セクションを `Change Log` に変更

**Files:**
- Modify: `README.md` (lines 956-969)

**Context:** 下部のセクション名を `Release Notes` から `Change Log` にリネームし、箇条書きの抜粋を削除し、RELEASE_NOTES.md と CHANGELOG.md への誘導 1 段落に置き換える。

- [ ] **Step 1: 行 956〜969 を差し替え**

Before (lines 956-969):

```markdown
## [Release Notes](CHANGELOG.md)

### 2.0.1 (2026/04/14)
* Fix: Self-closing `<div class="page" />` now correctly triggers a page break [#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)

### 2.0.0 (2026/04/13)
* Breaking: Heading ID slug generation, front matter parsing, and Chromium resolution have changed. See the [FAQ](#faq) for details.
* Change: Migrate to TypeScript and bundle with esbuild
* Change: Bundle `puppeteer-core` and manage Chromium via the built-in `chromium-resolver` (installed Chrome/Edge preferred, auto-download fallback)
* Change: Replace `markdown-it-include`, `markdown-it-named-headers`, and `markdown-it-checkbox` with in-repo custom implementations
* Change: Remove `cheerio`, `mustache`, and `gray-matter` dependencies
* Add: Unit and integration test suites (`vscode-test-cli`)

For details, see [Change Log](CHANGELOG.md).
```

After:

```markdown
## [Change Log](CHANGELOG.md)

For a user-facing summary of changes, see [RELEASE_NOTES.md](RELEASE_NOTES.md). For the detailed change history including developer-facing notes, see [CHANGELOG.md](CHANGELOG.md).
```

- [ ] **Step 2: 検証**

Run:

```bash
grep -n '^## \[Change Log\](CHANGELOG.md)$' README.md && ! grep -n '^## \[Release Notes\](CHANGELOG.md)$' README.md && ! grep -q 'Migrate to TypeScript and bundle with esbuild' README.md && echo OK
```

Expected: 新しい見出しが 1 箇所にヒットし、古い見出しおよび削除した箇条書きが消えており、末尾に `OK`。

- [ ] **Step 3: `#release-notes` への参照が残っていないことを確認**

Run:

```bash
! grep -n '#release-notes' README.md && echo OK
```

Expected: 末尾に `OK` のみ。`#release-notes` が残っていれば修正する。

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): replace bottom Release Notes section with Change Log link

The top What's New / Breaking Changes sections already surface the
release delta for Marketplace visitors, so the bottom excerpt was
redundant. Rename the section to Change Log and collapse the body to
pointers to RELEASE_NOTES.md and CHANGELOG.md.
EOF
)"
```

---

## Task 8: `README.ja.md` の TOC を更新

**Files:**
- Modify: `README.ja.md` (line 24)

**Context:** 日本語版 TOC の項目名を `Release Notes` から `Change Log` に変更する。

- [ ] **Step 1: 行 24 を書き換え**

Before (line 24):

```markdown
- [Release Notes](#release-notes)
```

After:

```markdown
- [Change Log](#change-log)
```

- [ ] **Step 2: 検証**

Run:

```bash
grep -n '^- \[Change Log\](#change-log)$' README.ja.md && ! grep -n '\[Release Notes\](#release-notes)' README.ja.md && echo OK
```

Expected: 新しい TOC 行がヒットし、古い参照が消えており、末尾に `OK`。

- [ ] **Step 3: コミット**

```bash
git add README.ja.md
git commit -m "docs(readme-ja): rename Release Notes toc entry to Change Log"
```

---

## Task 9: `README.ja.md` 上部 `What's New` セクションを更新

**Files:**
- Modify: `README.ja.md` (lines 32-53)

**Context:** 日本語版の導入文に `RELEASE_NOTES.ja.md` 誘導を追加し、各項目の `詳細:` 行に RELEASE_NOTES.ja.md のアンカーを併記する。X.Y.Z PlantUML 項目の第三者ツール並列記述も削除する。

- [ ] **Step 1: セクション冒頭から X.Y.Z ブロックまでを置換**

Before (lines 32-43):

```markdown
## What's New

ユーザに直接関係する追加・改善点です。ユーザ対応が必要な変更については [仕様変更](#仕様変更) を参照してください。

### X.Y.Z

- 既存の `@startuml` / `@enduml` ブロックマーカー記法に加えて、```` ```plantuml ```` フェンスドコードブロック記法にも対応しました（フェンス記法は VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式）。両者は対等にサポートされます。
    - 詳細: [PlantUML](#plantuml)
- Chromium の自動ダウンロードが [Chrome for Testing API](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json) から最新の Chrome Stable ビルドを取得する挙動に変更されました（従来は `puppeteer-core` に固定された build id のみを使用）。新設定 [markdown-pdf.chromium.autoDownload](#markdown-pdfchromiumautodownload)（デフォルト `true`）で自動ダウンロードを無効化できます。
    - 詳細: [Where is Chromium downloaded?](#where-is-chromium-downloaded)
- [KaTeX](https://katex.org/) による数式描画に対応しました（VS Code 標準の Markdown プレビューと同じ動作）。インライン `$…$` / `\(…\)`、ブロック `$$…$$` / `\[…\]`、および ` ```math ` フェンスドコードブロックをサポートします。[markdown-pdf.math.enabled](#markdown-pdfmathenabled) で無効化できます。
    - 詳細: [Math](#math)
```

After:

```markdown
## What's New

ユーザに直接関係する追加・改善点です。ユーザ対応が必要な変更については [仕様変更](#仕様変更) を参照してください。過去バージョンを含むユーザー向けリリースノート全体は [RELEASE_NOTES.ja.md](RELEASE_NOTES.ja.md) を参照してください。

### X.Y.Z

- 既存の `@startuml` / `@enduml` ブロックマーカー記法に加えて、```` ```plantuml ```` フェンスドコードブロック記法にも対応しました。両者は対等にサポートされます。
    - 詳細: [PlantUML](#plantuml) / [RELEASE_NOTES.ja.md#xyz-yyyymmdd](RELEASE_NOTES.ja.md#xyz-yyyymmdd)
- Chromium の自動ダウンロードが [Chrome for Testing API](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json) から最新の Chrome Stable ビルドを取得する挙動に変更されました（従来は `puppeteer-core` に固定された build id のみを使用）。新設定 [markdown-pdf.chromium.autoDownload](#markdown-pdfchromiumautodownload)（デフォルト `true`）で自動ダウンロードを無効化できます。
    - 詳細: [Where is Chromium downloaded?](#where-is-chromium-downloaded) / [RELEASE_NOTES.ja.md#xyz-yyyymmdd](RELEASE_NOTES.ja.md#xyz-yyyymmdd)
- [KaTeX](https://katex.org/) による数式描画に対応しました（VS Code 標準の Markdown プレビューと同じ動作）。インライン `$…$` / `\(…\)`、ブロック `$$…$$` / `\[…\]`、および ` ```math ` フェンスドコードブロックをサポートします。[markdown-pdf.math.enabled](#markdown-pdfmathenabled) で無効化できます。
    - 詳細: [Math](#math) / [RELEASE_NOTES.ja.md#xyz-yyyymmdd](RELEASE_NOTES.ja.md#xyz-yyyymmdd)
```

変更点:
- 行 34 末尾に「過去バージョンを含むユーザー向けリリースノート全体は [RELEASE_NOTES.ja.md](RELEASE_NOTES.ja.md) を参照してください。」を追加。
- 行 38 の PlantUML 項目から `（フェンス記法は VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式）` を削除。
- 各項目の `詳細: ...` 末尾に `/ [RELEASE_NOTES.ja.md#xyz-yyyymmdd](RELEASE_NOTES.ja.md#xyz-yyyymmdd)` を追加。

- [ ] **Step 2: 2.0.1 / 2.0.0 項目の `詳細:` を追記**

Before (lines 45-53):

```markdown
### 2.0.1

- 自己閉じタグ `<div class="page" />` で改ページが正しく動作するようになりました（[#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)）。

### 2.0.0

- Include 機能（`:[label](path.md)`）で読み込みに失敗した場合にエクスポート全体を中断せず、該当箇所にエラーを表示するようになりました。一部のフラグメントが欠けていてもドキュメントの残りは出力されます。
- 画像 `src` の書き換えで、引用符付き属性・可変長の空白・raw-text コンテキスト等の取り扱いが改善されました。
- フロントマターの解析が BOM 付きファイルに対応しました。
```

After:

```markdown
### 2.0.1

- 自己閉じタグ `<div class="page" />` で改ページが正しく動作するようになりました（[#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)）。
    - 詳細: [RELEASE_NOTES.ja.md#201-20260414](RELEASE_NOTES.ja.md#201-20260414)

### 2.0.0

- Include 機能（`:[label](path.md)`）で読み込みに失敗した場合にエクスポート全体を中断せず、該当箇所にエラーを表示するようになりました。一部のフラグメントが欠けていてもドキュメントの残りは出力されます。
    - 詳細: [RELEASE_NOTES.ja.md#200-20260413](RELEASE_NOTES.ja.md#200-20260413)
- 画像 `src` の書き換えで、引用符付き属性・可変長の空白・raw-text コンテキスト等の取り扱いが改善されました。
    - 詳細: [RELEASE_NOTES.ja.md#200-20260413](RELEASE_NOTES.ja.md#200-20260413)
- フロントマターの解析が BOM 付きファイルに対応しました。
    - 詳細: [RELEASE_NOTES.ja.md#200-20260413](RELEASE_NOTES.ja.md#200-20260413)
```

- [ ] **Step 3: 検証**

Run:

```bash
! grep -n 'VS Code 標準の Markdown プレビュー・GitHub・GitLab' README.ja.md && grep -c 'RELEASE_NOTES.ja.md#xyz-yyyymmdd' README.ja.md && grep -c 'RELEASE_NOTES.ja.md#200-20260413' README.ja.md && echo OK
```

Expected: 古い第三者並列比較が消えており、`xyz-yyyymmdd` は 3 件、`200-20260413` は 3 件以上ヒットし、末尾に `OK`。

- [ ] **Step 4: コミット**

```bash
git add README.ja.md
git commit -m "docs(readme-ja): link What's New items to RELEASE_NOTES.ja.md"
```

---

## Task 10: `README.ja.md` 上部 `仕様変更` セクションを更新

**Files:**
- Modify: `README.ja.md` (lines 55-73)

**Context:** 日本語版の `仕様変更` セクションも同様に導入文と `詳細:` リンクを追加する。

- [ ] **Step 1: 冒頭導入行を差し替え**

Before (line 57):

```markdown
既存の動作に影響する可能性がある変更が含まれます。詳細は [FAQ](#faq) セクションを参照してください。
```

After:

```markdown
既存の動作に影響する可能性がある変更が含まれます。詳細は [FAQ](#faq) セクションを参照してください。過去バージョンを含むユーザー向けリリースノート全体は [RELEASE_NOTES.ja.md](RELEASE_NOTES.ja.md) を参照してください。
```

- [ ] **Step 2: X.Y.Z の `詳細:` に RELEASE_NOTES.ja.md リンクを追記**

Before (lines 59-62):

```markdown
### X.Y.Z

- XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の Raw HTML が既定で [GFM Disallowed Raw HTML 拡張](https://github.github.com/gfm/#disallowed-raw-html-extension-) に準拠してサニタイズされるようになりました。`<script>` / `<iframe>` / `<style>` 等のタグおよび `on*` / `javascript:` 属性が Markdown 本文から除去されます。挙動は新しい [markdown-pdf.sanitize](#markdown-pdfsanitize) 設定で制御できます。
    - 詳細: [Why is my raw HTML being escaped or removed?](#why-is-my-raw-html-being-escaped-or-removed)
```

After:

```markdown
### X.Y.Z

- XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の HTML が既定で [GFM Disallowed Raw HTML 拡張](https://github.github.com/gfm/#disallowed-raw-html-extension-) に準拠してサニタイズされるようになりました。`<script>` / `<iframe>` / `<style>` 等のタグおよび `on*` / `javascript:` 属性が Markdown 本文から除去されます。挙動は新しい [markdown-pdf.sanitize](#markdown-pdfsanitize) 設定で制御できます。
    - 詳細: [Why is my raw HTML being escaped or removed?](#why-is-my-raw-html-being-escaped-or-removed) / [RELEASE_NOTES.ja.md#xyz-yyyymmdd](RELEASE_NOTES.ja.md#xyz-yyyymmdd)
```

注: spec の用語ガイドに合わせ、本項目冒頭の「Markdown 内の Raw HTML」から `Raw` を外して「Markdown 内の HTML」に揃えている（FAQ 本体の `<a id="...">` 付き見出しや詳細説明は別タスクの範囲外として変更しない）。

- [ ] **Step 3: 2.0.0 の `詳細:` に RELEASE_NOTES.ja.md リンクを追記**

Before (lines 64-73):

```markdown
### 2.0.0

- 見出し ID の生成が GitHub 互換の VS Code slug 生成に変わりました。既存ドキュメント内の内部アンカーが変わる可能性があります。
    - 詳細: [Why did my heading anchors change?](#why-did-my-heading-anchors-change)
- highlight.js がバージョン 9 から 11 にアップグレードされました。一部のハイライトスタイル名が変更または削除されています。
    - 詳細: [Why did my syntax highlight style stop working?](#why-did-my-syntax-highlight-style-stop-working)
- フロントマターの解析がより厳格になりました。従来受け入れられていた一部の形式が拒否される場合があります。
    - 詳細: [Why is my front matter no longer parsed?](#why-is-my-front-matter-no-longer-parsed)
- Chromium はインストール済みの Chrome/Edge を優先して解決され、見つからなければ初回使用時に自動ダウンロードされます。
    - 詳細: [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) / [Where is Chromium downloaded?](#where-is-chromium-downloaded)
```

After:

```markdown
### 2.0.0

- 見出し ID の生成が GitHub 互換の VS Code slug 生成に変わりました。既存ドキュメント内の内部アンカーが変わる可能性があります。
    - 詳細: [Why did my heading anchors change?](#why-did-my-heading-anchors-change) / [RELEASE_NOTES.ja.md#200-20260413](RELEASE_NOTES.ja.md#200-20260413)
- highlight.js がバージョン 9 から 11 にアップグレードされました。一部のハイライトスタイル名が変更または削除されています。
    - 詳細: [Why did my syntax highlight style stop working?](#why-did-my-syntax-highlight-style-stop-working) / [RELEASE_NOTES.ja.md#200-20260413](RELEASE_NOTES.ja.md#200-20260413)
- フロントマターの解析がより厳格になりました。従来受け入れられていた一部の形式が拒否される場合があります。
    - 詳細: [Why is my front matter no longer parsed?](#why-is-my-front-matter-no-longer-parsed) / [RELEASE_NOTES.ja.md#200-20260413](RELEASE_NOTES.ja.md#200-20260413)
- Chromium はインストール済みの Chrome/Edge を優先して解決され、見つからなければ初回使用時に自動ダウンロードされます。
    - 詳細: [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) / [Where is Chromium downloaded?](#where-is-chromium-downloaded) / [RELEASE_NOTES.ja.md#200-20260413](RELEASE_NOTES.ja.md#200-20260413)
```

- [ ] **Step 4: 検証**

Run:

```bash
grep -c 'RELEASE_NOTES.ja.md#xyz-yyyymmdd' README.ja.md && grep -c 'RELEASE_NOTES.ja.md#200-20260413' README.ja.md && grep -q '過去バージョンを含むユーザー向けリリースノート全体は' README.ja.md && echo OK
```

Expected: `xyz-yyyymmdd` が 4 件以上（What's New 3 + 仕様変更 1）、`200-20260413` が 7 件以上（What's New 3 + 仕様変更 4）、末尾に `OK`。

- [ ] **Step 5: コミット**

```bash
git add README.ja.md
git commit -m "docs(readme-ja): link 仕様変更 items to RELEASE_NOTES.ja.md"
```

---

## Task 11: `README.ja.md` `### PlantUML` 内 Fenced code block 説明を修正

**Files:**
- Modify: `README.ja.md` (around line 149)

**Context:** 日本語版も同様の PlantUML 記述修正を行う。

- [ ] **Step 1: 行 149 を書き換え**

Before (line 149):

```markdown
```` ```plantuml ```` フェンスドコードブロック記法です。VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式です。
```

After:

```markdown
```` ```plantuml ```` フェンスドコードブロック記法です。PlantUML エコシステムで一般的に使われる記法で、[GitLab では PlantUML 連携を有効化するとネイティブに描画されます](https://docs.gitlab.com/administration/integration/plantuml/)。
```

- [ ] **Step 2: 検証**

Run:

```bash
! grep -n 'VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式' README.ja.md && grep -n 'PlantUML エコシステムで一般的に使われる記法' README.ja.md && echo OK
```

Expected: 古い文言が消え、新しい文言がヒットし、末尾に `OK`。

- [ ] **Step 3: コミット**

```bash
git add README.ja.md
git commit -m "docs(readme-ja): correct plantuml fence provenance claim"
```

---

## Task 12: `README.ja.md` 下部 `Release Notes` セクションを `Change Log` に変更

**Files:**
- Modify: `README.ja.md` (lines 965-978)

**Context:** 日本語版の下部セクションも同様にリネームし、抜粋を削除して誘導のみに置き換える。リンク先は `RELEASE_NOTES.ja.md` と `CHANGELOG.md`（CHANGELOG は単一ファイル）。

- [ ] **Step 1: 行 965〜978 を差し替え**

Before (lines 965-978):

```markdown
## [Release Notes](CHANGELOG.md)

### 2.0.1 (2026/04/14)
* Fix: 自己閉じタグ `<div class="page" />` で改ページが正しく動作するよう修正 [#428](https://github.com/yzane/vscode-markdown-pdf/issues/428)

### 2.0.0 (2026/04/13)
* Breaking: 見出し ID の slug 生成、フロントマター解析、Chromium 解決ロジックが変更されました。詳細は [FAQ](#faq) を参照してください。
* Change: ソースコードを TypeScript に移行し、esbuild でバンドルするよう変更
* Change: `puppeteer-core` をバンドルし、内製の `chromium-resolver` で Chromium を管理 (インストール済み Chrome/Edge を優先し、見つからなければ自動ダウンロード)
* Change: `markdown-it-include` / `markdown-it-named-headers` / `markdown-it-checkbox` を内製実装に置換
* Change: `cheerio` / `mustache` / `gray-matter` 依存を削除
* Add: ユニットテストと統合テスト (`vscode-test-cli`)

詳細は [Change Log](CHANGELOG.md) を参照してください。
```

After:

```markdown
## [Change Log](CHANGELOG.md)

ユーザー向けの変更点まとめは [RELEASE_NOTES.ja.md](RELEASE_NOTES.ja.md) を参照してください。開発者向けの詳細な変更履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。
```

- [ ] **Step 2: 検証**

Run:

```bash
grep -n '^## \[Change Log\](CHANGELOG.md)$' README.ja.md && ! grep -n '^## \[Release Notes\](CHANGELOG.md)$' README.ja.md && ! grep -q 'ソースコードを TypeScript に移行し、esbuild でバンドル' README.ja.md && ! grep -n '#release-notes' README.ja.md && echo OK
```

Expected: 新しい見出しがヒットし、古い見出し、削除済み抜粋、`#release-notes` いずれも残っていないこと。末尾に `OK`。

- [ ] **Step 3: コミット**

```bash
git add README.ja.md
git commit -m "$(cat <<'EOF'
docs(readme-ja): replace bottom Release Notes section with Change Log link

Mirror the English README change: drop the CHANGELOG excerpts and keep
only pointers to RELEASE_NOTES.ja.md (user-facing) and CHANGELOG.md
(developer-facing).
EOF
)"
```

---

## Task 13: 統合検証とサンプル再生成

**Files:**
- Verify: すべての変更ファイル
- Regenerate (optional): `sample/README.pdf`, `sample/README.html`, `sample/README.png`, `sample/README.jpeg`

**Context:** 最終チェックとして、spec の受け入れ基準に対応する grep を一気に走らせ、README のレンダリングが壊れていないことをサンプル生成で確認する。

- [ ] **Step 1: 受け入れ基準相当の grep 検証**

Run:

```bash
set -e
# RELEASE_NOTES 存在と必要バージョン見出し（明示アンカーなし）
test -f RELEASE_NOTES.md
test -f RELEASE_NOTES.ja.md
grep -q '^## X.Y.Z (YYYY/MM/DD)$' RELEASE_NOTES.md
grep -q '^## 2.0.1 (2026/04/14)$' RELEASE_NOTES.md
grep -q '^## 2.0.0 (2026/04/13)$' RELEASE_NOTES.md
grep -q '^## X.Y.Z (YYYY/MM/DD)$' RELEASE_NOTES.ja.md
grep -q '^## 2.0.1 (2026/04/14)$' RELEASE_NOTES.ja.md
grep -q '^## 2.0.0 (2026/04/13)$' RELEASE_NOTES.ja.md
! grep -q '<a id=' RELEASE_NOTES.md
! grep -q '<a id=' RELEASE_NOTES.ja.md

# README 側からのスラグ参照が正しい形式で存在
grep -q 'RELEASE_NOTES.md#xyz-yyyymmdd' README.md
grep -q 'RELEASE_NOTES.md#201-20260414' README.md
grep -q 'RELEASE_NOTES.md#200-20260413' README.md
grep -q 'RELEASE_NOTES.ja.md#xyz-yyyymmdd' README.ja.md
grep -q 'RELEASE_NOTES.ja.md#201-20260414' README.ja.md
grep -q 'RELEASE_NOTES.ja.md#200-20260413' README.ja.md

# TOC リネーム
grep -q '^- \[Change Log\](#change-log)$' README.md
grep -q '^- \[Change Log\](#change-log)$' README.ja.md
! grep -qn '#release-notes' README.md
! grep -qn '#release-notes' README.ja.md

# 下部セクションリネーム
grep -q '^## \[Change Log\](CHANGELOG.md)$' README.md
grep -q '^## \[Change Log\](CHANGELOG.md)$' README.ja.md
! grep -q '^## \[Release Notes\](CHANGELOG.md)$' README.md
! grep -q '^## \[Release Notes\](CHANGELOG.md)$' README.ja.md

# PlantUML 記述修正
! grep -q "VS Code's built-in Markdown preview, GitHub, and GitLab" README.md
! grep -q 'VS Code preview, GitHub, and GitLab' README.md
! grep -q 'VS Code 標準の Markdown プレビュー・GitHub・GitLab' README.ja.md

# CHANGELOG.md は未編集
git diff --quiet CHANGELOG.md

echo ALL OK
```

Expected: 末尾に `ALL OK`。どれか失敗するとその時点で stop し、対応タスクに戻って修正する。

- [ ] **Step 2: 型チェック**

Run:

```bash
npm run check
```

Expected: エラーなし。（今回の変更はドキュメントのみなので影響しないはずだが、念のため確認）

- [ ] **Step 3: サンプル再生成**

Run:

```bash
npm run sample
```

Expected: `sample/README.pdf` / `.html` / `.png` / `.jpeg` が更新される。生成が失敗する場合は README.md の Markdown 構文エラーが疑われるので、該当タスクに戻って修正する。

- [ ] **Step 4: 生成されたサンプルに差分があれば確認・コミット**

Run:

```bash
git status sample/
```

差分がある場合は内容をスポットチェック（`Change Log` セクションが正しく表示されているか、PlantUML 項目の表記に `VS Code preview, GitHub, and GitLab` が残っていないか、など）してからコミット。

```bash
git add sample/
git commit -m "docs(sample): regenerate sample for release notes split"
```

差分がない場合はこのステップをスキップ。

- [ ] **Step 5: 最終的な git log 確認**

Run:

```bash
git --no-pager log --oneline develop..HEAD
```

Expected: `feature/release-notes-file` 上に spec コミット 3 件 + 本プランのタスクコミットが並んでいることを目視確認する。

---

## 受け入れ基準との対応

| spec の受け入れ基準 | カバーするタスク |
|---|---|
| `RELEASE_NOTES.md` が存在し、ハイブリッド形式で 2.0.0 / 2.0.1 / X.Y.Z が書かれている | Task 1 |
| `RELEASE_NOTES.ja.md` が存在し、英語版と同じバージョン範囲・同じ項目 | Task 2 |
| `README.md` の TOC が `Change Log` に更新 | Task 3 |
| `README.md` の上部 `What's New` / `Breaking Changes` に `RELEASE_NOTES.md` への参照リンクが追加 | Task 4, 5 |
| `README.md` 下部が `## [Change Log](CHANGELOG.md)` にリネームされ、本文が抜粋なしのリンクのみ | Task 7 |
| `README.ja.md` に対称の変更（TOC / 上部 / 下部 / リンク先） | Task 8, 9, 10, 12 |
| `CHANGELOG.md` には変更を加えない | Task 13 Step 1 で検証 |
| `#release-notes` 参照が残っていない | Task 13 Step 1 で検証 |
| `README.md` の不正確な PlantUML 記述（行 40 付近 / 行 151 付近）が修正されている | Task 4（行 40）/ Task 6（行 151） |
| `README.ja.md` 側の対応 PlantUML 記述も修正されている | Task 9（行 38）/ Task 11（行 149） |

## オープンな疑問とその解消

spec のオープン疑問に対する本プランでの扱い:

- **RELEASE_NOTES.md へのアンカー文字列**: 明示的な `<a id="...">` は置かず、GitHub 自動スラグに従う（`## X.Y.Z (YYYY/MM/DD)` → `#xyz-yyyymmdd` / `## 2.0.1 (2026/04/14)` → `#201-20260414` / `## 2.0.0 (2026/04/13)` → `#200-20260413`）。CHANGELOG.md と同じ運用で、シンプルさと整合性を優先。
- **`RELEASE_NOTES.ja.md` の見出し**: 英語版と同じく `# Release Notes` のまま（「Release Notes」はプロジェクト内で既に広く使われている固有名詞として扱う）。日本語側の導入文では「ユーザー向けの変更点まとめです」と言及する。
- **`Release Notes` アンカー参照の外部リンク調査**: リポジトリ内で `#release-notes` を参照している箇所は TOC と下部セクション内部リンクのみであることを grep で確認済み（本プラン Task 13 Step 1 で担保）。リポジトリ外の外部リンクが存在する可能性はあるが、本プランの範囲外とする。

## スコープ外

- `CHANGELOG.md` の編集。
- 1.x 以前のバージョンを `RELEASE_NOTES.md` に遡って記載すること。
- リリース公開時のワークフロー変更（spec に記述済み、実施は別途）。
- サンプル PDF の個別目視レビュー（生成が成功し、Change Log セクションが崩れていないことの確認までを本プランで扱う）。
