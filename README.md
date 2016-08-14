# Markdown PDF

This extension convert Markdown file to pdf, html, png or jpeg file.

## Features

Supports the following features.
* Syntax highlighting
* emoji
* checkbox

## Usage

1. Open the Markdown file.
1. Press `F1` or `Ctrl+Shift+P`.
1. Type `pdf` and select `Convert Markdown to PDF`

![demo](https://raw.githubusercontent.com/yzane/vscode-markdown-pdf/master/images/usage.gif)

## Extension Settings

[Visual Studio Code User and Workspace Settings](https://code.visualstudio.com/docs/customization/userandworkspace)

1. Select **File > Preferences > UserSettings or Workspace Settings**
1. Find markdown-pdf settings in the **Default Settings**
1. Copy `markdown-pdf.*` settings
1. Paste to the **settings.json**, and change the value

![demo](https://raw.githubusercontent.com/yzane/vscode-markdown-pdf/master/images/settings.gif)

## Options

```javascript
{
	// A list of local paths to the stylesheets to use from the markdown-pdf.
	"markdown-pdf.styles": [
		"C:\\Users\\<USERNAME>\\Documents\\markdown-pdf.css",  // OK
		"C:/Users/<USERNAME>/Documents/markdown-pdf.css",      // OK
		"/home/<USERNAME>/settings/markdown-pdf.css",          // OK
		"C:\Users\<USERNAME>\Documents\markdown-pdf.css"       // NG All '\' need to be written as '\\'.
	],

	// Set the style file name. for example: github.css, monokai.css ...
	// fine name list : https://github.com/isagalaev/highlight.js/tree/master/src/styles
	// demo site : https://highlightjs.org/static/demo/
	"markdown-pdf.highlightStyle": "github.css",

	// Enable Syntax highlighting
	"markdown-pdf.highlight": true,

	// Enable line breaks
	"markdown-pdf.breaks": false,

	// Enable emoji. http://www.webpagefx.com/tools/emoji-cheat-sheet/
	"markdown-pdf.emoji": true,

	// Allowed file types: pdf , html, png, jpeg
	"markdown-pdf.type": "pdf",

	// Only used for types png & jpeg
	"markdown-pdf.quality": 90,

	// Page Option. allowed units: A3, A4, A5, Legal, Letter, Tabloid
	"markdown-pdf.format": "A4",

	// Page Option. portrait or landscape
	"markdown-pdf.orientation": "portrait",

	// Page Option. Border Top. units: mm, cm, in, px
	"markdown-pdf.border.top": "0.1cm",

	// Page Option. Border bottom. units: mm, cm, in, px
	"markdown-pdf.border.bottom": "0.1cm",

	// Page Option. Border right. units: mm, cm, in, px
	"markdown-pdf.border.right": "0.1cm",

	// Page Option. Border left. units: mm, cm, in, px
	"markdown-pdf.border.left": "0.1cm",

	// Header contents
	"markdown-pdf.header.contents": "",

	// Header height. units: mm, cm, in, px
	"markdown-pdf.header.height": "",

	// Footer contents
	"markdown-pdf.footer.contents": "<div style=\"text-align: center;\">{{page}}/{{pages}}</div>",

	// Footer height. units: mm, cm, in, px
	"markdown-pdf.footer.height": ""

}
```


## F.A.Q.

### How can I change emoji size ?

1. Add the following to your stylesheet which was specified in the markdown-pdf.styles.

```css
.emoji {
  width: 2em;
  height: 2em;
}
```


## Release Notes

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
