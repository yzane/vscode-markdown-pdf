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
	// markdown-pdf で使用するスタイルシートのパスを指定します
	"markdown-pdf.styles": [
		"C:\\Users\\<USERNAME>\\Documents\\markdown-pdf.css",  // OK
		"C:/Users/<USERNAME>/Documents/markdown-pdf.css",      // OK
		"/home/<USERNAME>/settings/markdown-pdf.css",          // OK
		"C:\Users\<USERNAME>\Documents\markdown-pdf.css"       // NG : \ は \\ と記述する必要があります。
	],

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
	"markdown-pdf.border.top": "0.1cm",

	// ページオプション。下ボーター. 単位: mm, cm, in, px
	"markdown-pdf.border.bottom": "0.1cm",

	// ページオプション。 右ボーダー. 単位: mm, cm, in, px
	"markdown-pdf.border.right": "0.1cm",

	// ページオプション。 左ボーダー. 単位: mm, cm, in, px
	"markdown-pdf.border.left": "0.1cm",

	// ヘッダー コンテンツ
	"markdown-pdf.header.contents": "",

	// ヘッダーの高さ. 単位: mm, cm, in, px
	"markdown-pdf.header.height": "",

	// フッター コンテンツ
	"markdown-pdf.footer.contents": "<div style=\"text-align: center;\">{{page}}/{{pages}}</div>",

	// フッターの高さ. 単位: mm, cm, in, px
	"markdown-pdf.footer.height": ""

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


## Release Notes

### 0.1.2 (2016/08/20)

* Add: Ability to convert markdown file from editor context
* Update: README

### 0.1.1 (2016/08/16)

* Add: Japanese README

### 0.1.0 (2016/08/14)

* Initial release.


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
