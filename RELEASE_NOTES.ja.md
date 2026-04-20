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

- タグ: `<script>` / `<iframe>` / `<style>` / `<textarea>` / `<title>` / `<xmp>` / `<noembed>` / `<noframes>` / `<plaintext>`(開きタグの `<` は `&lt;` にエスケープされ、中身は可視テキストとして残ります)
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
