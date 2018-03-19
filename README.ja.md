# Markdown PDF

この拡張機能は Markdown ファイルを PDF、html、png、jpeg ファイルに変換します。

## 機能

以下の機能をサポートしています。
* [Syntax highlighting](https://highlightjs.org/static/demo/)
* [emoji](http://www.webpagefx.com/tools/emoji-cheat-sheet/)
* checkbox

## 使い方

### コマンド パレット

1. Markdown ファイルを開きます
1. `F1`キーを押すか、`Ctrl+Shift+P`キーを入力します
1. `pdf`と入力し、`Convert Markdown to PDF` を選択します

![demo](https://raw.githubusercontent.com/yzane/vscode-markdown-pdf/master/images/usage1.gif)

### メニュー

1. Markdown ファイルを開きます
1. 右クリックして `Convert Markdown to PDF` を選択します

![demo](https://raw.githubusercontent.com/yzane/vscode-markdown-pdf/master/images/usage2.gif)

### 自動変換

1. **settings.json** に `"markdown-pdf.convertOnSave": true` オプションを追加します
1. Visual Studio Code を再起動します
1. Markdown ファイルを開きます
1. 保存時に自動変換します

## 拡張機能 設定方法

[Visual Studio Code User and Workspace Settings](https://code.visualstudio.com/docs/customization/userandworkspace)

1. メニューから **ファイル > 基本設定 > ユーザー設定 か ワークスペース設定** を選択します
1. **既定の設定** から markdown-pdf の設定を探します
1. `markdown-pdf.*` の設定をコピーします
1. **settings.json** に貼り付け、値を変更します

![demo](https://raw.githubusercontent.com/yzane/vscode-markdown-pdf/master/images/settings.gif)

## オプション

```javascript
{
	// 保存時に自動変換します
	"markdown-pdf.convertOnSave": false,

	// convertOnSave オプションの除外ファイル名
	"markdown-pdf.convertOnSaveExclude": [
		"^work",
		"work.md$",
		"work|test",
		"[0-9][0-9][0-9][0-9]-work",
		"work\\d"  // \d -> \\d。 \ は \\ と記述する必要があります。
	],

	// 出力ディレクトリ
	"markdown-pdf.outputDirectory": "C:\\work",

	// markdown-pdf で使用するスタイルシートのパスを指定します
	"markdown-pdf.styles": [
		"C:\\Users\\<USERNAME>\\Documents\\markdown-pdf.css",  // OK (Windows)
		"C:\Users\<USERNAME>\Documents\markdown-pdf.css",      // NG : \ は \\ と記述する必要があります。(Windows)
		"C:/Users/<USERNAME>/Documents/markdown-pdf.css",      // OK (Windows)
		"/home/<USERNAME>/settings/markdown-pdf.css",          // OK
		".vscode\\markdown-pdf.css",                           // OK. 相対パス (Windows)
		".vscode/markdown-pdf.css",                            // OK. 相対パス 
		"markdown-pdf.css.css"                                 // OK. 相対パス
	],

	// デフォルトのスタイルシート(VSCode, markdown-pdf)を有効にします
	"markdown-pdf.includeDefaultStyles": true,

	// スタイルシートのファイル名を指定します。例: github.css, monokai.css ...
	// ファイル名のリスト : https://github.com/isagalaev/highlight.js/tree/master/src/styles
	// デモサイト : https://highlightjs.org/static/demo/
	"markdown-pdf.highlightStyle": "github.css",

	// Syntax highlighting を有効にします
	"markdown-pdf.highlight": true,

	// 改行を有効にします
	"markdown-pdf.breaks": false,

	// 絵文字を有効にします http://www.webpagefx.com/tools/emoji-cheat-sheet/
	"markdown-pdf.emoji": true,

	// 出力フォーマット: pdf , html, png, jpeg
	"markdown-pdf.type": "pdf",

	// png と jpeg の場合のみ有効です
	"markdown-pdf.quality": 90,

	// ページオプション。 ページサイズ : A3, A4, A5, Legal, Letter, Tabloid
	"markdown-pdf.format": "A4",

	// ページオプション。 portrait（縦向き）、landscape（横向き）
	"markdown-pdf.orientation": "portrait",

	// ページオプション。 上ボーダー. 単位: mm, cm, in, px
	"markdown-pdf.border.top": "1.5cm",

	// ページオプション。下ボーター. 単位: mm, cm, in, px
	"markdown-pdf.border.bottom": "1cm",

	// ページオプション。 右ボーダー. 単位: mm, cm, in, px
	"markdown-pdf.border.right": "1cm",

	// ページオプション。 左ボーダー. 単位: mm, cm, in, px
	"markdown-pdf.border.left": "1cm",

	// ヘッダー コンテンツ
	"markdown-pdf.header.contents": "",

	// ヘッダーの高さ. 単位: mm, cm, in, px
	"markdown-pdf.header.height": "",

	// フッター コンテンツ
	"markdown-pdf.footer.contents": "<div style=\"text-align: center;\">{{page}}/{{pages}}</div>",

	// フッターの高さ. 単位: mm, cm, in, px
	"markdown-pdf.footer.height": "0.8cm"

}
```


## F.A.Q.

### 絵文字 サイズの変更方法は？

1. 以下の設定を markdown-pdf.styles で指定したスタイルシートに追加します。

```css
.emoji {
  height: 2em;
}
```


## [Release Notes](https://github.com/yzane/vscode-markdown-pdf/blob/master/CHANGELOG.md)

### 0.1.7 (2017/04/05)
* Change: Display completion message on status bar [#19](https://github.com/yzane/vscode-markdown-pdf/issues/19)
* Add: markdown-pdf.convertOnSaveExclude option [#16](https://github.com/yzane/vscode-markdown-pdf/issues/16)
* Fix: broken code-blocks [#18](https://github.com/yzane/vscode-markdown-pdf/pull/18)
* Fix: Image path error [#14](https://github.com/yzane/vscode-markdown-pdf/issues/14)
* Update: [markdown.css](https://github.com/Microsoft/vscode/blob/master/extensions/markdown/media/markdown.css) of the vscode
* Update: dependencies packages


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
