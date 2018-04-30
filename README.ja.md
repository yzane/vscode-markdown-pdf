# Markdown PDF

この拡張機能は Markdown ファイルを pdf、html、png、jpeg ファイルに変換します。

## <font color="red"> 重要なお知らせ </font>
* Markdown PDF ver1.0.0 では PDF変換を [node-html-pdf](https://github.com/marcbachmann/node-html-pdf)   (PhantomJS) から [puppeteer](https://github.com/GoogleChrome/puppeteer) (Chromium) に変更しました
* 一部のオプションは廃止された為、変更してください。 [オプション](#options)を参照してください

## 目次
<!-- TOC depthFrom:2 depthTo:2 updateOnSave:false -->

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

## 機能

以下の機能をサポートしています。
* [Syntax highlighting](https://highlightjs.org/static/demo/)
* [emoji](http://www.webpagefx.com/tools/emoji-cheat-sheet/)
* checkbox

サンプルファイル
 * [pdf](sample/README.pdf)
 * [html](sample/README.html)
 * [png](sample/README.png)
 * [jpeg](sample/README.jpeg)


## インストール

Markdown PDF をインストールして、Visutal Studio Code で Markdownファイルを最初に開いた時、Chromium のダウンロードが自動で始まります。
しかしサイズが大きい為 (~170Mb Mac, ~282Mb Linux, ~280Mb Win) 、環境によっては時間がかかります。
ダウンロード中は、ステータスバーに `Installing Puppeteer ...` が表示されます。

ダウンロードが上手くいかない場合や、Markdown PDF のバージョンアップの度にダウンロードするのを避けたい場合、[markdown-pdf.executablePath](#markdown-pdfexecutablepath) オプションでインストール済みの Chromium か Chrome を指定してください。

 
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

* Markdown PDF ver1.0.0 では PDF変換を [node-html-pdf](https://github.com/marcbachmann/node-html-pdf) から [puppeteer](https://github.com/GoogleChrome/puppeteer) に変更しました
* 一部のオプションは廃止された為、変更してください。 [Options](#options)
* Markdown PDF ver1.0.0 の新オプションと、廃止されたオプションは以下になります

|ver1.0.0 (新)|ver0.x.x (廃止)|
|:---|:---|
|`markdown-pdf.executablePath`||
|`markdown-pdf.scale`||
|`markdown-pdf.displayHeaderFooter`||
|`markdown-pdf.headerTemplate`|`markdown-pdf.header.contents`|
|`markdown-pdf.footerTemplate`|`markdown-pdf.footer.contents`|
|`markdown-pdf.printBackground`||
|`markdown-pdf.pageRanges`||
|`markdown-pdf.width`||
|`markdown-pdf.height`||
|`markdown-pdf.margin.top`|`markdown-pdf.border.top`|
||`markdown-pdf.header.height`|
|`markdown-pdf.margin.bottom`|`markdown-pdf.border.bottom`|
||`markdown-pdf.footer.height`|
|`markdown-pdf.margin.right`|`markdown-pdf.border.right`|
|`markdown-pdf.margin.left`|`markdown-pdf.border.left`|
|`markdown-pdf.quality`||
|`markdown-pdf.clip.x`||
|`markdown-pdf.clip.y`||
|`markdown-pdf.clip.width`||
|`markdown-pdf.clip.height`||
|`markdown-pdf.omitBackground`||

### Option list

|Category| Option name|
|:---|:---|
|[Save options](#save-options)|[markdown-pdf.type](#markdown-pdftype)|
||[markdown-pdf.convertOnSave](#markdown-pdfconvertonsave)|
||[markdown-pdf.convertOnSaveExclude](#markdown-pdfconvertonsaveexclude)|
||[markdown-pdf.outputDirectory](#markdown-pdfoutputdirectory)|
||[markdown-pdf.outputDirectoryRelativePathFile](#markdown-pdfoutputdirectoryrelativepathfile)|
|[Styles options](#styles-options)|[markdown-pdf.styles](#markdown-pdfstyles)|
||[markdown-pdf.stylesRelativePathFile](#markdown-pdfstylesrelativepathfile)|
||[markdown-pdf.includeDefaultStyles](#markdown-pdfincludedefaultstyles)|
|[Syntax highlight options](#syntax-highlight-options)|[markdown-pdf.highlight](#markdown-pdfhighlight)|
||[markdown-pdf.highlightStyle](#markdown-pdfhighlightstyle)|
|[Markdown options](#markdown-options)|[markdown-pdf.breaks](#markdown-pdfbreaks)|
|[Emoji options](#emoji-options)|[markdown-pdf.emoji](#markdown-pdfemoji)|
|[Configuration options](#configuration-options)|[markdown-pdf.executablePath](#markdown-pdfexecutablepath)|
|[Common Options](#common-options)|[markdown-pdf.scale](#markdown-pdfscale)|
|[PDF options](#pdf-options)|[markdown-pdf.displayHeaderFooter](#markdown-pdfdisplayheaderfooter)|
||[markdown-pdf.headerTemplate](#markdown-pdfheadertemplate)|
||[markdown-pdf.footerTemplate](#markdown-pdffootertemplate)|
||[markdown-pdf.printBackground](#markdown-pdfprintbackground)|
||[markdown-pdf.orientation](#markdown-pdforientation)|
||[markdown-pdf.pageRanges](#markdown-pdfpageranges)|
||[markdown-pdf.format](#markdown-pdfformat)|
||[markdown-pdf.width](#markdown-pdfwidth)|
||[markdown-pdf.height](#markdown-pdfheight)|
||[markdown-pdf.margin.top](#markdown-pdfmargintop)|
||[markdown-pdf.margin.bottom](#markdown-pdfmarginbottom)|
||[markdown-pdf.margin.right](#markdown-pdfmarginright)|
||[markdown-pdf.margin.left](#markdown-pdfmarginleft)|
|[PNG JPEG options](#png-jpeg-options)|[markdown-pdf.quality](#markdown-pdfquality)|
||[markdown-pdf.clip.x](#markdown-pdfclipx)|
||[markdown-pdf.clip.y](#markdown-pdfclipy)|
||[markdown-pdf.clip.width](#markdown-pdfclipwidth)|
||[markdown-pdf.clip.height](#markdown-pdfclipheight)|
||[markdown-pdf.omitBackground](#markdown-pdfomitbackground)|

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
  - スタイルシートのファイル名を指定します。例: github.css, monokai.css ...
  - [ファイル名のリスト](https://github.com/isagalaev/highlight.js/tree/master/src/styles)
  - [highlight.js demo](https://highlightjs.org/static/demo/)

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
  - バンドルされた Chromium の代わりに実行する Chromium または Chrome のパスを指定します
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

  - pdf only. [puppeteer page.pdf options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagepdfoptions)

#### `markdown-pdf.displayHeaderFooter`
  - ヘッダーとフッター表示を有効にします
  - boolean. Default: true

#### `markdown-pdf.headerTemplate`, `markdown-pdf.footerTemplate`
  - ヘッダーとフッターを出力する為のHTMLテンプレートを指定します
  - `<span class='date'></span>` : 日付
  - `<span class='title'></span>` : Markdown ファイル名
  - `<span class='url'></span>` : Markdown フルパスファイル名
  - `<span class='pageNumber'></span>` : 現在のページ番号
  - `<span class='totalPages'></span>` : ドキュメントの総ページ数

```javascript
"markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \"> <span class='date'></span></div>",
```
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


## FAQ

### 絵文字 サイズの変更方法は？

1. 以下の設定を markdown-pdf.styles で指定したスタイルシートに追加します。

```css
.emoji {
  height: 2em;
}
```

### Tip: 文字コードの自動判定

Visual Studio Code の `files.autoGuessEncoding` オプションを使うと、文字コードが自動判定されるので便利です。

```javascript
"files.autoGuessEncoding": true,
```

### Tip: 出力ディレクトリ

常に Markdown ファイルからの相対パスのディレクトリに出力したい。

例えば、Markdown ファイルと同じディレクトリの "output"ディレクトリに出力する場合、次のように設定してください。

```javascript
"markdown-pdf.outputDirectory" : "output",
"markdown-pdf.outputDirectoryRelativePathFile": true,
```

## 既知の問題

### `markdown-pdf.styles` option
* オンラインCSS (https://xxx/xxx.css) は JPG と PNG では正しく適用されますが、PDF では問題が発生します [#67](https://github.com/yzane/vscode-markdown-pdf/issues/67)


## [Release Notes](CHANGELOG.md)

### 1.0.3 (2018/04/30)
* Fix: Support [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces) with `markdown-pdf.styles` option
    * Japanese font is not good [#79](https://github.com/yzane/vscode-markdown-pdf/issues/79)
    * relative stylesheet paths are not working when multiple folders in workspace [#68](https://github.com/yzane/vscode-markdown-pdf/issues/68)
* Fix: `markdown-pdf.styles` option
    * [BUG] Custom PDF style not being used [#35](https://github.com/yzane/vscode-markdown-pdf/issues/35)
    * How to change font size of generated pdf [#40](https://github.com/yzane/vscode-markdown-pdf/issues/40)
    * How do you change font-family? [#64](https://github.com/yzane/vscode-markdown-pdf/issues/64)

* Improve: Support [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces) with `markdown-pdf.outputDirectory` option
    * How do I specify a relative output directory? [#29](https://github.com/yzane/vscode-markdown-pdf/issues/29)

* Fix: File encoding
    * Not correctly rendering Windows 1252 encoding [#39](https://github.com/yzane/vscode-markdown-pdf/issues/39)
    * First H1 header not recognized if file starts with UTF-8 BOM [#44](https://github.com/yzane/vscode-markdown-pdf/issues/44)

* Fix: Can not convert pdf [#76](https://github.com/yzane/vscode-markdown-pdf/issues/76)


## License

MIT


## Special thanks
* [marcbachmann/node-html-pdf](https://github.com/marcbachmann/node-html-pdf)
* [markdown-it/markdown-it](https://github.com/markdown-it/markdown-it)
* [mcecot/markdown-it-checkbox](https://github.com/mcecot/markdown-it-checkbox)
* [markdown-it/markdown-it-emoji](https://github.com/markdown-it/markdown-it-emoji)
* [HenrikJoreteg/emoji-images](https://github.com/HenrikJoreteg/emoji-images)
* [isagalaev/highlight.js](https://github.com/isagalaev/highlight.js)
* [cheeriojs/cheerio](https://github.com/cheeriojs/cheerio)
* [janl/mustache.js](https://github.com/janl/mustache.js)


and


* [cakebake/markdown-themeable-pdf](https://github.com/cakebake/markdown-themeable-pdf)
