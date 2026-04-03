# ハイライトスタイル仕様変更の README 通知文書 設計

## 概要

highlight.js 9.x → 11.x へのアップグレードに伴うスタイル名の変更・削除について、README の「仕様変更」(Specification Changes) セクションにユーザー向け通知を追加する。

## 背景

`feature/package-update` ブランチで highlight.js を 9.x から 11.x に更新した。これにより以下の変更が発生している：

- 一部スタイル名のリネーム（例: `kimbie.dark.css` → `kimbie-dark.css`）
- 旧スタイルの削除（atelier 系、solarized 系など）
- `base16/` サブディレクトリへの移動
- 新スタイルの追加

拡張機能側では、利用できないスタイルが設定された場合に `tomorrow.css` へフォールバックし警告メッセージを表示する仕組みが実装済み。

## 設計方針

- 既存エントリ（日付書式変更）と同じ「何が変わった → 影響 → 対処法」の 3 行構造を採用
- README.md（英語版）と README.ja.md（日本語版）の両方に追加
- バージョン番号はプレースホルダ `X.X.X` とし、リリース時に確定する

## 追加内容

### README.md（英語版）

```markdown
- Syntax Highlight Style Changes
  - Starting from version X.X.X, highlight.js has been updated from version 9 to version 11. As a result, some syntax highlighting style names have been changed or removed.
  - If your configured style is no longer available, the extension will automatically fall back to `tomorrow.css` and display a warning message.
  - Please check the [available styles](https://github.com/highlightjs/highlight.js/tree/main/src/styles) and update your [markdown-pdf.highlightStyle](#markdown-pdfhighlightstyle) setting if needed.
```

### README.ja.md（日本語版）

```markdown
- シンタックスハイライトのスタイル変更
  - バージョンX.X.Xから、highlight.js がバージョン9から11に更新されました。これにより、一部のシンタックスハイライトのスタイル名が変更または削除されています。
  - 設定されたスタイルが利用できなくなった場合、拡張機能は自動的に `tomorrow.css` にフォールバックし、警告メッセージを表示します。
  - [利用可能なスタイル](https://github.com/highlightjs/highlight.js/tree/main/src/styles)を確認し、必要に応じて [markdown-pdf.highlightStyle](#markdown-pdfhighlightstyle) の設定を更新してください。
```

## 挿入位置

各 README の「仕様変更」/「Specification Changes」セクションの既存エントリ（日付書式変更）の前に追加する。新しい変更が上に来る時系列順。

## スコープ

- README.md と README.ja.md への通知文追加のみ
- コード変更なし
