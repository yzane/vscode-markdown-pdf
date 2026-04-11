# Markdown PDF

この拡張機能は Markdown ファイルを pdf、html、png、jpeg ファイルに変換します。

## 目次
<!-- TOC depthFrom:2 depthTo:2 updateOnSave:false -->

- [仕様変更](#仕様変更)
- [機能](#機能)
- [インストール](#インストール)
- [使い方](#使い方)
- [拡張機能 設定](#拡張機能-設定)
- [オプション](#オプション)
- [FAQ](#faq)
- [既知の問題](#既知の問題)
- [Release Notes](#release-notes)
- [License](#license)
- [Special thanks](#special-thanks)

<!-- /TOC -->

<div class="page"/>

## 仕様変更

バージョン 2.0.0 では、既存の動作に影響する可能性がある変更が含まれます。詳細は [FAQ](#faq) セクションを参照してください。

- 見出し ID の生成が GitHub 互換の VS Code slug 生成に変わりました。既存ドキュメント内の内部アンカーが変わる可能性があります。詳細: [Why did my heading anchors change?](#why-did-my-heading-anchors-change)
- highlight.js がバージョン 9 から 11 にアップグレードされました。一部のハイライトスタイル名が変更または削除されています。詳細: [Why did my syntax highlight style stop working?](#why-did-my-syntax-highlight-style-stop-working)
- フロントマターの解析がより厳格になりました。従来受け入れられていた一部の形式が拒否される場合があります。詳細: [Why is my front matter no longer parsed?](#why-is-my-front-matter-no-longer-parsed)
- Chromium はインストール済みの Chrome/Edge を優先して解決され、見つからなければ初回使用時に自動ダウンロードされます。詳細: [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) / [Where is Chromium downloaded?](#where-is-chromium-downloaded)

## 機能

以下の機能をサポートしています。
* [Syntax highlighting](https://highlightjs.org/demo)
* [emoji](https://www.webfx.com/tools/emoji-cheat-sheet/)
* [markdown-it-checkbox](https://github.com/mcecot/markdown-it-checkbox)
* [markdown-it-container](https://github.com/markdown-it/markdown-it-container)
* [markdown-it-include](https://github.com/camelaissani/markdown-it-include)
* [PlantUML](https://plantuml.com/)
  * [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)
* [mermaid](https://mermaid-js.github.io/mermaid/)

サンプルファイル
 * [pdf](sample/README.pdf)
 * [html](sample/README.html)
 * [png](sample/README.png)
 * [jpeg](sample/README.jpeg)

### markdown-it-container

INPUT
```
::: warning
*here be dragons*
:::
```

OUTPUT
``` html
<div class="warning">
<p><em>here be dragons</em></p>
</div>
```

### markdown-it-plantuml

INPUT
```
@startuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
@enduml
```

OUTPUT

![PlantUML](images/PlantUML.png)

### markdown-it-include

Include markdown fragment files: `:[alternate-text](relative-path-to-file.md)`.

```
├── [plugins]
│  └── README.md
├── CHANGELOG.md
└── README.md
```

INPUT
```
README Content

:[Plugins](./plugins/README.md)

:[Changelog](CHANGELOG.md)
```

OUTPUT
```
Content of README.md

Content of plugins/README.md

Content of CHANGELOG.md
```

### mermaid

INPUT
<pre>
```mermaid
stateDiagram
    [*] --> First
    state First {
        [*] --> second
        second --> [*]
    }
```
</pre>

OUTPUT

![mermaid](images/mermaid.png)

## インストール

### Chromium の解決

Markdown PDF は PDF/PNG/JPEG エクスポートに Chromium ベースのブラウザを使用します。以下の順番で解決を試みます:

1. [markdown-pdf.executablePath](#markdown-pdfexecutablepath) で指定されたパス
2. システムにインストール済みの Google Chrome / Microsoft Edge / Chromium
3. 初回使用時に自動ダウンロードされる管理済み Chromium

詳細は FAQ の [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) および [Where is Chromium downloaded?](#where-is-chromium-downloaded) を参照してください。

プロキシ経由で接続している場合は、settings.json に `http.proxy` オプションを設定し、Visual Studio Code を再起動してください。

<div class="page"/>

## 使い方

### コマンド パレット

1. Markdown ファイルを開きます
1. `F1` キーを押すか、`Ctrl+Shift+P` キーを入力します
1. `export` と入力し以下を選択します
   * `markdown-pdf: Export (settings.json)`
   * `markdown-pdf: Export (pdf)`
   * `markdown-pdf: Export (html)`
   * `markdown-pdf: Export (png)`
   * `markdown-pdf: Export (jpeg)`
   * `markdown-pdf: Export (all: pdf, html, png, jpeg)`

![usage1](images/usage1.gif)

### メニュー

1. Markdown ファイルを開きます
1. 右クリックして以下を選択します
   * `markdown-pdf: Export (settings.json)`
   * `markdown-pdf: Export (pdf)`
   * `markdown-pdf: Export (html)`
   * `markdown-pdf: Export (png)`
   * `markdown-pdf: Export (jpeg)`
   * `markdown-pdf: Export (all: pdf, html, png, jpeg)`

![usage2](images/usage2.gif)

### 自動変換

1. **settings.json** に `"markdown-pdf.convertOnSave": true` オプションを追加します
1. Visual Studio Code を再起動します
1. Markdown ファイルを開きます
1. 保存すると自動で変換されます

## 拡張機能 設定

[Visual Studio Code User and Workspace Settings](https://code.visualstudio.com/docs/customization/userandworkspace)

1. メニューから **ファイル > 基本設定 > ユーザー設定 か ワークスペース設定** を選択します
1. **既定の設定** から markdown-pdf の設定を探します
1. `markdown-pdf.*` の設定をコピーします
1. **settings.json** に貼り付け、値を変更します

![demo](images/settings.gif)

## オプション

### List

|Category|Option name|[Configuration scope](https://code.visualstudio.com/api/references/contribution-points#Configuration-property-schema)|
|:---|:---|:---|
|[Save options](#save-options)|[markdown-pdf.type](#markdown-pdftype)| |
||[markdown-pdf.convertOnSave](#markdown-pdfconvertonsave)| |
||[markdown-pdf.convertOnSaveExclude](#markdown-pdfconvertonsaveexclude)| |
||[markdown-pdf.outputDirectory](#markdown-pdfoutputdirectory)| |
||[markdown-pdf.outputDirectoryRelativePathFile](#markdown-pdfoutputdirectoryrelativepathfile)| |
|[Styles options](#styles-options)|[markdown-pdf.styles](#markdown-pdfstyles)| |
||[markdown-pdf.stylesRelativePathFile](#markdown-pdfstylesrelativepathfile)| |
||[markdown-pdf.includeDefaultStyles](#markdown-pdfincludedefaultstyles)| |
|[Syntax highlight options](#syntax-highlight-options)|[markdown-pdf.highlight](#markdown-pdfhighlight)| |
||[markdown-pdf.highlightStyle](#markdown-pdfhighlightstyle)| |
|[Markdown options](#markdown-options)|[markdown-pdf.breaks](#markdown-pdfbreaks)| |
|[Emoji options](#emoji-options)|[markdown-pdf.emoji](#markdown-pdfemoji)| |
|[Configuration options](#configuration-options)|[markdown-pdf.executablePath](#markdown-pdfexecutablepath)| |
|[Common Options](#common-options)|[markdown-pdf.scale](#markdown-pdfscale)| |
|[PDF options](#pdf-options)|[markdown-pdf.displayHeaderFooter](#markdown-pdfdisplayheaderfooter)|resource|
||[markdown-pdf.headerTemplate](#markdown-pdfheadertemplate)|resource|
||[markdown-pdf.footerTemplate](#markdown-pdffootertemplate)|resource|
||[markdown-pdf.printBackground](#markdown-pdfprintbackground)|resource|
||[markdown-pdf.orientation](#markdown-pdforientation)|resource|
||[markdown-pdf.pageRanges](#markdown-pdfpageranges)|resource|
||[markdown-pdf.format](#markdown-pdfformat)|resource|
||[markdown-pdf.width](#markdown-pdfwidth)|resource|
||[markdown-pdf.height](#markdown-pdfheight)|resource|
||[markdown-pdf.margin.top](#markdown-pdfmargintop)|resource|
||[markdown-pdf.margin.bottom](#markdown-pdfmarginbottom)|resource|
||[markdown-pdf.margin.right](#markdown-pdfmarginright)|resource|
||[markdown-pdf.margin.left](#markdown-pdfmarginleft)|resource|
|[PNG JPEG options](#png-jpeg-options)|[markdown-pdf.quality](#markdown-pdfquality)| |
||[markdown-pdf.clip.x](#markdown-pdfclipx)| |
||[markdown-pdf.clip.y](#markdown-pdfclipy)| |
||[markdown-pdf.clip.width](#markdown-pdfclipwidth)| |
||[markdown-pdf.clip.height](#markdown-pdfclipheight)| |
||[markdown-pdf.omitBackground](#markdown-pdfomitbackground)| |
|[PlantUML options](#plantuml-options)|[markdown-pdf.plantumlOpenMarker](#markdown-pdfplantumlopenmarker)| |
||[markdown-pdf.plantumlCloseMarker](#markdown-pdfplantumlclosemarker)| |
||[markdown-pdf.plantumlServer](#markdown-pdfplantumlserver)| |
|[markdown-it-include options](#markdown-it-include-options)|[markdown-pdf.markdown-it-include.enable](#markdown-pdfmarkdown-it-includeenable)| |
|[mermaid options](#mermaid-options)|[markdown-pdf.mermaidServer](#markdown-pdfmermaidserver)| |

### Save options

#### `markdown-pdf.type`
  - 出力フォーマット: pdf, html, png, jpeg
  - 複数の出力フォーマットをサポート
  - Default: pdf

```javascript
"markdown-pdf.type": [
  "pdf",
  "html",
  "png",
  "jpeg"
],
```

#### `markdown-pdf.convertOnSave`
  - 保存時の自動変換を有効にします
  - boolean. Default: false
  - 設定の反映には、Visutal Studio Code の再起動が必要です

#### `markdown-pdf.convertOnSaveExclude`
  - convertOnSave オプションの除外ファイル名を指定します

```javascript
"markdown-pdf.convertOnSaveExclude": [
  "^work",
  "work.md$",
  "work|test",
  "[0-9][0-9][0-9][0-9]-work",
  "work\\test"  // 全ての \ は \\ と記述する必要があります。(Windows)
],
```
#### `markdown-pdf.outputDirectory`
  - 出力ディレクトリを指定します
  - 全ての `\` は `\\` と記述する必要があります (Windows)

```javascript
"markdown-pdf.outputDirectory": "C:\\work\\output",
```

  - 相対パス
    - `Markdownファイル` を開いた場合、ファイルからの相対パスとして解釈されます
    - `フォルダ` を開いた場合、ルートフォルダからの相対パスとして解釈されます
    - `ワークスペース` を開いた場合、それぞれのルートフォルダからの相対パスとして解釈されます
      - [マルチルート ワークスペース](https://code.visualstudio.com/docs/editor/multi-root-workspaces) を参照してください

```javascript
"markdown-pdf.outputDirectory": "output",
```

  - 相対パス (ホームディレクトリ)
    - パスが `^` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます

```javascript
"markdown-pdf.outputDirectory": "~/output",
```

  - `相対パス`でディレクトリを設定した場合、ディレクトリが存在しなければ作成されます
  - `絶対パス`でディレクトリを設定した場合、ディレクトリが存在しなければエラーになります

#### `markdown-pdf.outputDirectoryRelativePathFile`
  - `markdown-pdf.outputDirectoryRelativePathFile` オプションが `true` に設定されている場合、[markdown-pdf.outputDirectory](#markdown-pdfoutputDirectory) で設定した相対パスは、ファイルからの相対パスとして解釈されます
  - フォルダやワークスペースからの相対パスを避けたい場合に使うことが出来ます
  - boolean. Default: false

### Styles options

#### `markdown-pdf.styles`
  - markdown-pdf で使用するスタイルシートのパスを指定します
  - ファイルが存在しない場合、スキップされます
  - 全ての `\` は `\\` と記述する必要があります (Windows)

```javascript
"markdown-pdf.styles": [
  "C:\\Users\\<USERNAME>\\Documents\\markdown-pdf.css",
  "/home/<USERNAME>/settings/markdown-pdf.css",
],
```

  - 相対パス
    - `Markdownファイル` を開いた場合、ファイルからの相対パスとして解釈されます
    - `フォルダ` を開いた場合、ルートフォルダからの相対パスとして解釈されます
    - `ワークスペース` を開いた場合、それぞれのルートフォルダからの相対パスとして解釈されます
      - [マルチルート ワークスペース](https://code.visualstudio.com/docs/editor/multi-root-workspaces) を参照してください

```javascript
"markdown-pdf.styles": [
  "markdown-pdf.css",
],
```

  - 相対パス (ホームディレクトリ)
    - パスが `^` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます

```javascript
"markdown-pdf.styles": [
  "~/.config/Code/User/markdown-pdf.css"
],
```

  - オンラインCSS (https://xxx/xxx.css) は JPG と PNG では正しく適用されますが、PDF では問題が発生します [#67](https://github.com/yzane/vscode-markdown-pdf/issues/67)

```javascript
"markdown-pdf.styles": [
  "https://xxx/markdown-pdf.css"
],
```

#### `markdown-pdf.stylesRelativePathFile`
  - `markdown-pdf.stylesRelativePathFile` オプションが `true` に設定されている場合、[markdown-pdf.styles](#markdown-pdfstyles) で設定した相対パスは、ファイルからの相対パスとして解釈されます
  - フォルダやワークスペースからの相対パスを避けたい場合に使うことが出来ます
  - boolean. Default: false

#### `markdown-pdf.includeDefaultStyles`
  - デフォルトのスタイルシート(VSCode, markdown-pdf)を有効にします
  - boolean. Default: true

### Syntax highlight options

#### `markdown-pdf.highlight`
  - Syntax highlighting を有効にします
  - boolean. Default: true

#### `markdown-pdf.highlightStyle`
  - 現在の `highlight.js` のスタイルファイル名を指定します。例: `github.css`, `monokai.css`, `base16/solarized-dark.css`
  - [ファイル名のリスト](https://github.com/highlightjs/highlight.js/tree/main/src/styles)
  - [highlight.js demo](https://highlightjs.org/demo)

```javascript
"markdown-pdf.highlightStyle": "github.css",
```

### Markdown options

#### `markdown-pdf.breaks`
  - 改行を有効にします
  - boolean. Default: false

### Emoji options

#### `markdown-pdf.emoji`
  - 絵文字を有効にします [EMOJI CHEAT SHEET](https://www.webpagefx.com/tools/emoji-cheat-sheet/)
  - boolean. Default: true

### Configuration options

#### `markdown-pdf.executablePath`
  - バンドルされた Chromium の代わりに実行する Google Chrome / Microsoft Edge / Chromium のパスを指定します
  - この設定がインストール済みブラウザの検出や管理済み Chromium のダウンロードとどう連携するかは、FAQ の [How is the Chromium browser selected?](#how-is-the-chromium-browser-selected) を参照してください
  - 全ての `\` は `\\` と記述する必要があります (Windows)
  - 設定の反映には、Visutal Studio Code の再起動が必要です

```javascript
"markdown-pdf.executablePath": "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
```

### Common Options

#### `markdown-pdf.scale`
  - ページレンダリングのスケール
  - number. default: 1

```javascript
"markdown-pdf.scale": 1
```

### PDF options

  - pdf only. [puppeteer page.pdf options](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md)

#### `markdown-pdf.displayHeaderFooter`
  - ヘッダーとフッター表示を有効にします
  - boolean. Default: true
  - このオプションを有効にすると、ヘッダーとフッターが両方表示されます
  - 片方を表示したくない場合は、もう片方の値を削除します
  - ヘッダー非表示
    ```javascript
    "markdown-pdf.headerTemplate": "",
    ```
  - フッター非表示
    ```javascript
    "markdown-pdf.footerTemplate": "",
    ```

#### `markdown-pdf.headerTemplate`
  - ヘッダーを出力する為のHTMLテンプレートを指定します
  - このオプションを使用するには、`markdown-pdf.displayHeaderFooter` を `true` に設定する必要があります。
  - `<span class='date'></span>` : 日付。フォーマットは環境に依存します
  - `<span class='title'></span>` : Markdown ファイル名
  - `<span class='url'></span>` : Markdown フルパスファイル名
  - `<span class='pageNumber'></span>` : 現在のページ番号
  - `<span class='totalPages'></span>` : ドキュメントの総ページ数
  - `%%ISO-DATETIME%%` : 現在の日付と時刻。ISOベース フォーマット (`YYYY-MM-DD hh:mm:ss`)
  - `%%ISO-DATE%%` : 現在の日付。ISOベース フォーマット (`YYYY-MM-DD`)
  - `%%ISO-TIME%%` : 現在の時刻。ISOベース フォーマット (`hh:mm:ss`)
  - Default (version1.5.0以降): Markdown ファイル名 と 日付を `%%ISO-DATE%%` で表示します
    ```javascript
    "markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \">%%ISO-DATE%%</div>",
    ```
  - Default (version1.4.4以前): Markdown ファイル名 と 日付を `<span class='date'></span>` で表示します
    ```javascript
    "markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \"> <span class='date'></span></div>",
    ```
#### `markdown-pdf.footerTemplate`
  - フッターを出力する為のHTMLテンプレートを指定します
  - 詳細は、[markdown-pdf.headerTemplate](#markdown-pdfheadertemplate) を参照してください
  - Default: {現在のページ番号} / {ドキュメントの総ページ数} を表示します
    ```javascript
    "markdown-pdf.footerTemplate": "<div style=\"font-size: 9px; margin: 0 auto;\"> <span class='pageNumber'></span> / <span class='totalPages'></span></div>",
    ```

#### `markdown-pdf.printBackground`
  - 背景のグラフィックを出力
  - boolean. Default: true

#### `markdown-pdf.orientation`
  - ページの向き
  - portrait(縦向き) or landscape(横向き)
  - Default: portrait

#### `markdown-pdf.pageRanges`
  - 出力するページ範囲 例) '1-5, 8, 11-13'
  - Default: 全ページ

```javascript
"markdown-pdf.pageRanges": "1,4-",
```

#### `markdown-pdf.format`
  - 用紙のフォーマット
  - Letter, Legal, Tabloid, Ledger, A0, A1, A2, A3, A4, A5, A6
  - Default: A4

```javascript
"markdown-pdf.format": "A4",
```

#### `markdown-pdf.width`
#### `markdown-pdf.height`
  - 用紙の幅/高さ、 単位(mm, cm, in, px)
  - このオプションが指定されている場合、markdown-pdf.format オプションより優先されます

```javascript
"markdown-pdf.width": "10cm",
"markdown-pdf.height": "20cm",
```

#### `markdown-pdf.margin.top`
#### `markdown-pdf.margin.bottom`
#### `markdown-pdf.margin.right`
#### `markdown-pdf.margin.left`
  - 用紙の余白、単位(mm, cm, in, px)

```javascript
"markdown-pdf.margin.top": "1.5cm",
"markdown-pdf.margin.bottom": "1cm",
"markdown-pdf.margin.right": "1cm",
"markdown-pdf.margin.left": "1cm",
```

### PNG, JPEG options

  - png and jpeg only. [puppeteer page.screenshot options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagescreenshotoptions)

#### `markdown-pdf.quality`
  - jpeg only. イメージの品質を 0-100 の範囲で指定します。 png では無効です。

```javascript
"markdown-pdf.quality": 100,
```

#### `markdown-pdf.clip.x`
#### `markdown-pdf.clip.y`
#### `markdown-pdf.clip.width`
#### `markdown-pdf.clip.height`
  - ページの切り抜き領域を指定します
  - number

```javascript
// 切り抜き領域のX軸の基点を指定します。ページの左上が原点です。
"markdown-pdf.clip.x": 0,

// 切り抜き領域のY軸の基点を指定します。ページの左上が原点です。
"markdown-pdf.clip.y": 0,

// 切り抜き領域の幅を指定します
"markdown-pdf.clip.width": 1000,

// 切り抜き領域の高さを指定します
"markdown-pdf.clip.height": 1000,
```

#### `markdown-pdf.omitBackground`
  - デフォルトの白い背景ではなく、透過によるスクリーンショットのキャプチャーを有効にします
  - boolean. Default: false

### PlantUML options

#### `markdown-pdf.plantumlOpenMarker`
  - plantuml パーサーの開始区切り文字
  - Default: @startuml

#### `markdown-pdf.plantumlCloseMarker`
  - plantuml パーサーの終了区切り文字
  - Default: @enduml

#### `markdown-pdf.plantumlServer`
  - Plantuml server. e.g. http://localhost:8080
  - Default: http://www.plantuml.com/plantuml
  - 例えば、PlantUMLサーバをローカルで実行するには次のようにします [#139](https://github.com/yzane/vscode-markdown-pdf/issues/139) :
    ```
    docker run -d -p 8080:8080 plantuml/plantuml-server:jetty
    ```
    [plantuml/plantuml-server - Docker Hub](https://hub.docker.com/r/plantuml/plantuml-server/)

### markdown-it-include options

#### `markdown-pdf.markdown-it-include.enable`
  - markdown-it-include を有効にします
  - boolean. Default: true

### mermaid options

#### `markdown-pdf.mermaidServer`
  - mermaid server
  - Default: https://unpkg.com/mermaid/dist/mermaid.min.js

<div class="page"/>

## FAQ

### 絵文字 サイズの変更方法は？

1. 以下の設定を markdown-pdf.styles で指定したスタイルシートに追加します。

```css
.emoji {
  height: 2em;
}
```

### 文字コードの自動判定

Visual Studio Code の `files.autoGuessEncoding` オプションを使うと、文字コードが自動判定されるので便利です。

```javascript
"files.autoGuessEncoding": true,
```

### 出力ディレクトリ

常に Markdown ファイルからの相対パスのディレクトリに出力したい場合。

例えば、Markdown ファイルと同じディレクトリの "output"ディレクトリに出力する場合、次のように設定してください。

```javascript
"markdown-pdf.outputDirectory" : "output",
"markdown-pdf.outputDirectoryRelativePathFile": true,
```

### 改ページ

改ページを挿入するには、以下を使用してください。

``` html
<div class="page"/>
```

<a id="why-did-my-heading-anchors-change"></a>

### 見出しのアンカーが変わったのはなぜ？

バージョン 2.0.0 から、Markdown PDF は GitHub 互換の VS Code slug 生成に準拠したカスタム実装の `markdown-it-named-headers` で見出し ID を生成します。従来の実装と比較して、新しい slug ジェネレータは CJK 文字とアンダースコアを保持する一方でサポートされない記号を除去するため、既存の内部アンカー (例: `#some-heading`) の解決結果が変わる可能性があります。

目次や相互参照など特定のアンカー文字列に依存している Markdown を使っている場合は、エクスポート後にアンカーを確認し、リンクを必要に応じて更新してください。

<a id="why-did-my-syntax-highlight-style-stop-working"></a>

### シンタックスハイライトのスタイルが効かなくなったのはなぜ？

バージョン 2.0.0 から、Markdown PDF は `highlight.js` v11 を使用するようになりました (以前は v9)。v9 のスタイル名の一部は名称変更または削除されています。Markdown PDF は古いスタイル名を可能な範囲で現在の名前にマッピングし、見つからないときは警告メッセージを表示します。マッピング不能な場合は `tomorrow.css` にフォールバックします。

[利用可能なスタイル](https://github.com/highlightjs/highlight.js/tree/main/src/styles)を確認し、[markdown-pdf.highlightStyle](#markdown-pdfhighlightstyle) の設定を現行のスタイル名に更新してください。

<a id="why-is-my-front-matter-no-longer-parsed"></a>

### フロントマターが解析されなくなったのはなぜ？

バージョン 2.0.0 から、Markdown PDF は `gray-matter` ではなくカスタム実装で YAML フロントマターを解析します。新しいパーサーはより厳格で、以前のパーサーが受け入れていた以下のケースを拒否します:

- トップレベルが YAML シーケンス (配列) のフロントマター
- プレーンオブジェクトに解析されないフロントマター
- 不正な YAML 構造

有効なフロントマターはトップレベルが YAML マッピング (オブジェクト) である必要があります。例:

``` yaml
---
title: My Document
"markdown-pdf":
  displayHeaderFooter: true
---
```

BOM 付きファイルは引き続きサポートされます。

<a id="how-is-the-chromium-browser-selected"></a>

### Chromium ブラウザはどのように選択されますか？

Markdown PDF は以下の順番で Chromium ベースのブラウザを解決します:

1. [markdown-pdf.executablePath](#markdown-pdfexecutablepath) で指定されたパス (ファイルが存在する場合)
2. システムにインストール済みのブラウザ。Google Chrome (stable) は `@puppeteer/browsers` 経由で OS 標準のインストール場所から検出されます。Microsoft Edge と Chromium は下記の固定パスを順にスキャンします。
3. Markdown PDF が初回使用時に自動ダウンロードする管理済み Chromium

最初にマッチしたものが使用されます。OS ごとの検出順序は以下のとおりです。

**Windows**

1. Google Chrome (stable インストール、`@puppeteer/browsers` で検出)
2. `%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe`
3. `%LOCALAPPDATA%\Chromium\Application\chrome.exe`
4. `%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe`
5. `%PROGRAMFILES%\Chromium\Application\chrome.exe`
6. `%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe`
7. `%PROGRAMFILES(X86)%\Chromium\Application\chrome.exe`

**macOS**

1. Google Chrome (stable インストール、`@puppeteer/browsers` で検出)
2. `/Applications/Chromium.app/Contents/MacOS/Chromium`
3. `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`

**Linux**

1. Google Chrome (stable インストール、`@puppeteer/browsers` で検出)
2. `/usr/bin/chromium-browser`
3. `/usr/bin/chromium`
4. `/usr/bin/microsoft-edge`
5. `/usr/bin/microsoft-edge-stable`

<a id="where-is-chromium-downloaded"></a>

### Chromium はどこにダウンロードされますか？

インストール済みブラウザが見つからない場合、Markdown PDF は初回使用時に管理済み Chromium をダウンロードします。ダウンロード先は拡張機能の VS Code global storage ディレクトリです:

| OS | ダウンロードパス |
| --- | --- |
| Windows | `%APPDATA%\Code\User\globalStorage\yzane.markdown-pdf\` |
| macOS | `~/Library/Application Support/Code/User/globalStorage/yzane.markdown-pdf/` |
| Linux | `~/.config/Code/User/globalStorage/yzane.markdown-pdf/` |

VS Code Insiders や VSCodium を使用している場合は、ベースパスが `Code - Insiders` や `VSCodium` などに変わります。

ダウンロード中はステータスバーに `Installing Chromium` が表示されます。

<div class="page"/>

## 既知の問題

### `markdown-pdf.styles` option
* オンラインCSS (https://xxx/xxx.css) は JPG と PNG では正しく適用されますが、PDF では問題が発生します [#67](https://github.com/yzane/vscode-markdown-pdf/issues/67)


## [Release Notes](CHANGELOG.md)

### 2.0.0 (2026/04/11)
* Breaking: 見出し ID の slug 生成、フロントマター解析、Chromium 解決ロジックが変更されました。詳細は [FAQ](#faq) を参照してください。
* Change: ソースコードを TypeScript に移行し、esbuild でバンドルするよう変更
* Change: `puppeteer-core` をバンドルし、内製の `chromium-resolver` で Chromium を管理 (インストール済み Chrome/Edge を優先し、見つからなければ自動ダウンロード)
* Change: `markdown-it-include` / `markdown-it-named-headers` / `markdown-it-checkbox` を内製実装に置換
* Change: `cheerio` / `mustache` / `gray-matter` 依存を削除
* Add: ユニットテストと統合テスト (`vscode-test-cli`)

詳細は [Change Log](CHANGELOG.md) を参照してください。

### 1.6.0 (2025/04/15)
* Fix: Allow underscores in section header identifiers [#404](https://github.com/yzane/vscode-markdown-pdf/pull/404)
* Update: align slug generation with [latest VSCode behavior](https://github.com/microsoft/vscode/blob/c07cee3039c8ea6e9bab02645599ec9e7796fd4c/extensions/markdown-language-features/src/slugify.ts#L27)

## License

MIT


## Special thanks
* [puppeteer/puppeteer](https://github.com/puppeteer/puppeteer)
* [markdown-it/markdown-it](https://github.com/markdown-it/markdown-it)
* [markdown-it/markdown-it-emoji](https://github.com/markdown-it/markdown-it-emoji)
* [HenrikJoreteg/emoji-images](https://github.com/HenrikJoreteg/emoji-images)
* [highlightjs/highlight.js](https://github.com/highlightjs/highlight.js)
* [markdown-it/markdown-it-container](https://github.com/markdown-it/markdown-it-container)
* [gmunguia/markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)
* [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)
