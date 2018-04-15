# Markdown PDF

This extension convert Markdown file to pdf, html, png or jpeg file.

[Japanease README](README.ja.md)

## <font color="red"> Important Notices </font>
* Markdown PDF ver1.0.0 replaced PDF converter with [puppeteer](https://github.com/GoogleChrome/puppeteer) instead of [node-html-pdf](https://github.com/marcbachmann/node-html-pdf)
* Some options are obsolete, please change. See [Options](#options)

## Table of Contents
<!-- TOC depthFrom:2 depthTo:2 updateOnSave:false -->

- [Features](#features)
- [Usage](#usage)
- [Extension Settings](#extension-settings)
- [Options](#options)
- [FAQ](#faq)
- [Release Notes](#release-notes)
- [License](#license)
- [Special thanks](#special-thanks)

<!-- /TOC -->

## Features

Supports the following features
* [Syntax highlighting](https://highlightjs.org/static/demo/)
* [emoji](http://www.webpagefx.com/tools/emoji-cheat-sheet/)
* checkbox

Sample files
 * [pdf](sample/README.pdf)
 * [html](sample/README.html)
 * [png](sample/README.png)
 * [jpeg](sample/README.jpeg)

## Usage

### Command Palette

1. Open the Markdown file
1. Press `F1` or `Ctrl+Shift+P`
1. Type `export` and select below
   * `markdown-pdf: Export (settings.json)`
   * `markdown-pdf: Export (pdf)`
   * `markdown-pdf: Export (html)`
   * `markdown-pdf: Export (png)`
   * `markdown-pdf: Export (jpeg)`
   * `markdown-pdf: Export (all: pdf, html, png, jpeg)`

![usage1](images/usage1.gif)

### Menu

1. Open the Markdown file
1. Right click and select below
   * `markdown-pdf: Export (settings.json)`
   * `markdown-pdf: Export (pdf)`
   * `markdown-pdf: Export (html)`
   * `markdown-pdf: Export (png)`
   * `markdown-pdf: Export (jpeg)`
   * `markdown-pdf: Export (all: pdf, html, png, jpeg)`

![usage2](images/usage2.gif)

### Auto convert

1. Add `"markdown-pdf.convertOnSave": true` option to **settings.json**
1. Restart Visual Studio Code
1. Open the Markdown file
1. Auto convert on save

## Extension Settings

[Visual Studio Code User and Workspace Settings](https://code.visualstudio.com/docs/customization/userandworkspace)

1. Select **File > Preferences > UserSettings or Workspace Settings**
1. Find markdown-pdf settings in the **Default Settings**
1. Copy `markdown-pdf.*` settings
1. Paste to the **settings.json**, and change the value

![demo](images/settings.gif)

## Options

* Markdown PDF ver1.0.0 replaced PDF converter with [puppeteer](https://github.com/GoogleChrome/puppeteer) instead of [node-html-pdf](https://github.com/marcbachmann/node-html-pdf).
* Some options are obsolete, please change
* The new option of Markdown PDF ver1.0.0 and the obsolete options are as follows

|ver1.0.0 (new)|ver0.x.x (obsolete)|
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

### Save options

#### `markdown-pdf.type`
  - Output format: pdf, html, png, jpeg
  - Multiple output formats support
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
  - Enable Auto convert on save
  - boolean. Default: false

#### `markdown-pdf.convertOnSaveExclude`
  - Excluded file name of convertOnSave option

```javascript
"markdown-pdf.convertOnSaveExclude": [
  "^work",
  "work.md$",
  "work|test",
  "[0-9][0-9][0-9][0-9]-work",
  "work\\test"  // All '\' need to be written as '\\'
],
```
#### `markdown-pdf.outputDirectory`
  - Output Directory
  - All '\\' need to be written as '\\\\' (Windows)

```javascript
"markdown-pdf.outputDirectory": "C:\\work",
```

### Styles options

#### `markdown-pdf.styles`
  - A list of local paths to the stylesheets to use from the markdown-pdf

```javascript
"markdown-pdf.styles": [
  "C:\\Users\\<USERNAME>\\Documents\\markdown-pdf.css",  // OK (Windows)
  "C:\Users\<USERNAME>\Documents\markdown-pdf.css",      // N/A. All '\' need to be written as '\\'. (Windows)
  "C:/Users/<USERNAME>/Documents/markdown-pdf.css",      // OK (Windows)
  "/home/<USERNAME>/settings/markdown-pdf.css",          // OK
  ".vscode\\markdown-pdf.css",                           // OK. Relative path (Windows)
  ".vscode/markdown-pdf.css",                            // OK. Relative path
  "markdown-pdf.css.css"                                 // OK. Relative path
],
```

#### `markdown-pdf.includeDefaultStyles`
  - Enable the inclusion of default Markdown styles (VSCode, markdown-pdf)
  - boolean. Default: true

### Syntax highlight options

#### `markdown-pdf.highlight`
  - Enable Syntax highlighting
  - boolean. Default: true

#### `markdown-pdf.highlightStyle`
  - Set the style file name. for example: github.css, monokai.css ...
  - [file name list](https://github.com/isagalaev/highlight.js/tree/master/src/styles)
  - demo site : https://highlightjs.org/static/demo/

```javascript
"markdown-pdf.highlightStyle": "github.css",
```

### Markdown options

#### `markdown-pdf.breaks`
  - Enable line breaks
  - boolean. Default: false

### Emoji options

#### `markdown-pdf.emoji`
  - Enable emoji. [EMOJI CHEAT SHEET](https://www.webpagefx.com/tools/emoji-cheat-sheet/)
  - boolean. Default: true

### Configuration options

#### `markdown-pdf.executablePath`
  - Path to a Chromium or Chrome executable to run instead of the bundled Chromium
  - All '\\' need to be written as '\\\\' (Windows)

```javascript
"markdown-pdf.executablePath": "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
```

### Common Options

#### `markdown-pdf.scale`
  - Scale of the page rendering
  - number. default: 1

```javascript
"markdown-pdf.scale": 1
```

### PDF options

  - pdf only. [puppeteer page.pdf options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagepdfoptions)

#### `markdown-pdf.displayHeaderFooter`
  - Enable display header and footer
  - boolean. Default: true

#### `markdown-pdf.headerTemplate`, `markdown-pdf.footerTemplate`
  - HTML template for the print header and footer
  - `<span class='date'></span>` : formatted print date
  - `<span class='title'></span>` : markdown file name
  - `<span class='url'></span>` : markdown full path name
  - `<span class='pageNumber'></span>` : current page number
  - `<span class='totalPages'></span>` : total pages in the document

```javascript
"markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \"> <span class='date'></span></div>",
```
```javascript
"markdown-pdf.footerTemplate": "<div style=\"font-size: 9px; margin: 0 auto;\"> <span class='pageNumber'></span> / <span class='totalPages'></span></div>",
```

#### `markdown-pdf.printBackground`
  - Print background graphics
  - boolean. Default: true

#### `markdown-pdf.orientation`
  - Paper orientation
  - portrait or landscape
  - Default: portrait

#### `markdown-pdf.pageRanges`
  - Paper ranges to print, e.g., '1-5, 8, 11-13'
  - Default: all pages

```javascript
"markdown-pdf.pageRanges": "1,4-",
```

#### `markdown-pdf.format`
  - Paper format
  - Letter, Legal, Tabloid, Ledger, A0, A1, A2, A3, A4, A5, A6
  - Default: A4

```javascript
"markdown-pdf.format": "A4",
```

#### `markdown-pdf.width`, `markdown-pdf.height`
  - Paper width / height, accepts values labeled with units(mm, cm, in, px)
  - If it is set, it overrides the markdown-pdf.format option

```javascript
"markdown-pdf.width": "10cm",
"markdown-pdf.height": "20cm",
```

#### `markdown-pdf.margin.top`, `markdown-pdf.margin.bottom`, `markdown-pdf.margin.right`, `markdown-pdf.margin.left`
  - Paper margins.units(mm, cm, in, px)

```javascript
"markdown-pdf.margin.top": "1.5cm",
"markdown-pdf.margin.bottom": "1cm",
"markdown-pdf.margin.right": "1cm",
"markdown-pdf.margin.left": "1cm",
```

### PNG, JPEG options

  - png and jpeg only. [puppeteer page.screenshot options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagescreenshotoptions)

#### `markdown-pdf.quality`
  - jpeg only. The quality of the image, between 0-100. Not applicable to png images

```javascript
"markdown-pdf.quality": 100,
```

#### `markdown-pdf.clip.x`, `markdown-pdf.clip.y`, `markdown-pdf.clip.width`, `markdown-pdf.clip.height`
  - An object which specifies clipping region of the page
  - number

```javascript
//  x-coordinate of top-left corner of clip area
"markdown-pdf.clip.x": 0,

// y-coordinate of top-left corner of clip area
"markdown-pdf.clip.y": 0,

// width of clipping area
"markdown-pdf.clip.width": 1000,

// height of clipping area
"markdown-pdf.clip.height": 1000,
```

#### `markdown-pdf.omitBackground`
  - Hides default white background and allows capturing screenshots with transparency
  - boolean. Default: false


## FAQ

### How can I change emoji size ?

1. Add the following to your stylesheet which was specified in the markdown-pdf.styles

```css
.emoji {
  height: 2em;
}
```


## [Release Notes](CHANGELOG.md)

### 1.0.0 (2018/04/15)
* Change: Replace pdf converter with puppeteer instead of html-pdf
* Add: Support multiple types in markdown-pdf.type option
    * Add: Define Multiple outputformats [#20](https://github.com/yzane/vscode-markdown-pdf/issues/20)
* Add: Support markdown-it-named-headers
    * Fix: TOC extension not working on Convert Markdown to PDF [#31](https://github.com/yzane/vscode-markdown-pdf/issues/31)
* Add: Increase menu items (pdf, html, png, jpeg)
* Update: dependencies packages


## License

MIT


## Special thanks
* [GoogleChrome/puppeteer](https://github.com/GoogleChrome/puppeteer)
* [markdown-it/markdown-it](https://github.com/markdown-it/markdown-it)
* [mcecot/markdown-it-checkbox](https://github.com/mcecot/markdown-it-checkbox)
* [leff/markdown-it-named-headers](https://github.com/leff/markdown-it-named-headers)
* [markdown-it/markdown-it-emoji](https://github.com/markdown-it/markdown-it-emoji)
* [HenrikJoreteg/emoji-images](https://github.com/HenrikJoreteg/emoji-images)
* [isagalaev/highlight.js](https://github.com/isagalaev/highlight.js)
* [cheeriojs/cheerio](https://github.com/cheeriojs/cheerio)
* [janl/mustache.js](https://github.com/janl/mustache.js)


and


* [marcbachmann/node-html-pdf](https://github.com/marcbachmann/node-html-pdf)
* [cakebake/markdown-themeable-pdf](https://github.com/cakebake/markdown-themeable-pdf)
