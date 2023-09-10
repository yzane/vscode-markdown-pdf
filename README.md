# Markdown PDF

This extension converts Markdown files to pdf, html, png or jpeg files.

[Japanese README](README.ja.md)

## Table of Contents
<!-- TOC depthFrom:2 depthTo:2 updateOnSave:false -->

- [Specification Changes](#specification-changes)
- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [Extension Settings](#extension-settings)
- [Options](#options)
- [FAQ](#faq)
- [Known Issues](#known-issues)
- [Release Notes](#release-notes)
- [License](#license)
- [Special thanks](#special-thanks)

<!-- /TOC -->

<div class="page"/>

## Specification Changes

- Default Date Format for PDF Headers and Footers Modified
  - Starting from version 1.5.0, the default date format for headers and footers has been changed to the ISO-based format (YYYY-MM-DD).
  - This change aims to improve the consistency of date displays, as the previous format could vary depending on the environment.
  - If you wish to use the previous format, please refer to [markdown-pdf.headerTemplate](#markdown-pdfheadertemplate).

## Features

Supports the following features
* [Syntax highlighting](https://highlightjs.org/static/demo/)
* [emoji](https://www.webfx.com/tools/emoji-cheat-sheet/)
* [markdown-it-checkbox](https://github.com/mcecot/markdown-it-checkbox)
* [markdown-it-container](https://github.com/markdown-it/markdown-it-container)
* [markdown-it-include](https://github.com/camelaissani/markdown-it-include)
* [PlantUML](https://plantuml.com/)
  * [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)
* [mermaid](https://mermaid-js.github.io/mermaid/)

Sample files
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

or

<pre>
::: mermaid
stateDiagram
    [*] --> First
    state First {
        [*] --> second
        second --> [*]
    }
:::
</pre>

OUTPUT

![mermaid](images/mermaid.png)

## Install

Chromium download starts automatically when Markdown PDF is installed and Markdown file is first opened with Visual Studio Code.

However, it is time-consuming depending on the environment because of its large size (~ 170Mb Mac, ~ 282Mb Linux, ~ 280Mb Win).

During downloading, the message `Installing Chromium` is displayed in the status bar.

If you are behind a proxy, set the `http.proxy` option to settings.json and restart Visual Studio Code.

If the download is not successful or you want to avoid downloading every time you upgrade Markdown PDF, please specify the installed [Chrome](https://www.google.co.jp/chrome/) or 'Chromium' with [markdown-pdf.executablePath](#markdown-pdfexecutablepath) option.

<div class="page"/>

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
  - To apply the settings, you need to restart Visual Studio Code

#### `markdown-pdf.convertOnSaveExclude`
  - Excluded file name of convertOnSave option

```javascript
"markdown-pdf.convertOnSaveExclude": [
  "^work",
  "work.md$",
  "work|test",
  "[0-9][0-9][0-9][0-9]-work",
  "work\\test"  // All '\' need to be written as '\\' (Windows)
],
```

#### `markdown-pdf.outputDirectory`
  - Output Directory
  - All `\` need to be written as `\\` (Windows)

```javascript
"markdown-pdf.outputDirectory": "C:\\work\\output",
```

  - Relative path
    - If you open the `Markdown file`, it will be interpreted as a relative path from the file
    - If you open a `folder`, it will be interpreted as a relative path from the root folder
    - If you open the `workspace`, it will be interpreted as a relative path from the each root folder
      - See [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)

```javascript
"markdown-pdf.outputDirectory": "output",
```

  - Relative path (home directory)
    - If path starts with  `~`, it will be interpreted as a relative path from the home directory

```javascript
"markdown-pdf.outputDirectory": "~/output",
```

  - If you set a directory with a `relative path`, it will be created if the directory does not exist
  - If you set a directory with an `absolute path`, an error occurs if the directory does not exist

#### `markdown-pdf.outputDirectoryRelativePathFile`
  - If `markdown-pdf.outputDirectoryRelativePathFile` option is set to `true`, the relative path set with [markdown-pdf.outputDirectory](#markdown-pdfoutputDirectory) is interpreted as relative from the file
  - It can be used to avoid relative paths from folders and workspaces
  - boolean. Default: false

### Styles options

#### `markdown-pdf.styles`
  - A list of local paths to the stylesheets to use from the markdown-pdf
  - If the file does not exist, it will be skipped
  - All `\` need to be written as `\\` (Windows)

```javascript
"markdown-pdf.styles": [
  "C:\\Users\\<USERNAME>\\Documents\\markdown-pdf.css",
  "/home/<USERNAME>/settings/markdown-pdf.css",
],
```

  - Relative path
    - If you open the `Markdown file`, it will be interpreted as a relative path from the file
    - If you open a `folder`, it will be interpreted as a relative path from the root folder
    - If you open the `workspace`, it will be interpreted as a relative path from the each root folder
      - See [Multi-root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)

```javascript
"markdown-pdf.styles": [
  "markdown-pdf.css",
],
```

  - Relative path (home directory)
    - If path starts with `~`, it will be interpreted as a relative path from the home directory

```javascript
"markdown-pdf.styles": [
  "~/.config/Code/User/markdown-pdf.css"
],
```

  - Online CSS (https://xxx/xxx.css) is applied correctly for JPG and PNG, but problems occur with PDF [#67](https://github.com/yzane/vscode-markdown-pdf/issues/67)

```javascript
"markdown-pdf.styles": [
  "https://xxx/markdown-pdf.css"
],
```

#### `markdown-pdf.stylesRelativePathFile`

  - If `markdown-pdf.stylesRelativePathFile` option is set to `true`, the relative path set with [markdown-pdf.styles](#markdown-pdfstyles) is interpreted as relative from the file
  - It can be used to avoid relative paths from folders and workspaces
  - boolean. Default: false

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
  - All `\` need to be written as `\\` (Windows)
  - To apply the settings, you need to restart Visual Studio Code

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

  - pdf only. [puppeteer page.pdf options](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md)

#### `markdown-pdf.displayHeaderFooter`
  - Enables header and footer display
  - boolean. Default: true
  - Activating this option will display both the header and footer
  - If you wish to display only one of them, remove the value for the other
  - To hide the header
    ```javascript
    "markdown-pdf.headerTemplate": "",
    ```
  - To hide the footer
    ```javascript
    "markdown-pdf.footerTemplate": "",
    ```

#### `markdown-pdf.headerTemplate`
  - Specifies the HTML template for outputting the header
  - To use this option, you must set `markdown-pdf.displayHeaderFooter` to `true`
  - `<span class='date'></span>` : formatted print date. The format depends on the environment
  - `<span class='title'></span>` : markdown file name
  - `<span class='url'></span>` : markdown full path name
  - `<span class='pageNumber'></span>` : current page number
  - `<span class='totalPages'></span>` : total pages in the document
  - `%%ISO-DATETIME%%` : current date and time in ISO-based format (`YYYY-MM-DD hh:mm:ss`)
  - `%%ISO-DATE%%` : current date in ISO-based format (`YYYY-MM-DD`)
  - `%%ISO-TIME%%` : current time in ISO-based format (`hh:mm:ss`)
  - Default (version 1.5.0 and later): Displays the Markdown file name and the date using `%%ISO-DATE%%`
    ```javascript
    "markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \">%%ISO-DATE%%</div>",
    ```
  - Default (version 1.4.4 and earlier): Displays the Markdown file name and the date using `<span class='date'></span>`
    ```javascript
    "markdown-pdf.headerTemplate": "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \"> <span class='date'></span></div>",
    ```

#### `markdown-pdf.footerTemplate`
  - Specifies the HTML template for outputting the footer
  - For more details, refer to [markdown-pdf.headerTemplate](#markdown-pdfheadertemplate)
  - Default: Displays the {current page number} / {total pages in the document}
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

#### `markdown-pdf.width`
#### `markdown-pdf.height`
  - Paper width / height, accepts values labeled with units(mm, cm, in, px)
  - If it is set, it overrides the markdown-pdf.format option

```javascript
"markdown-pdf.width": "10cm",
"markdown-pdf.height": "20cm",
```

#### `markdown-pdf.margin.top`
#### `markdown-pdf.margin.bottom`
#### `markdown-pdf.margin.right`
#### `markdown-pdf.margin.left`
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

#### `markdown-pdf.clip.x`
#### `markdown-pdf.clip.y`
#### `markdown-pdf.clip.width`
#### `markdown-pdf.clip.height`
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

### PlantUML options

#### `markdown-pdf.plantumlOpenMarker`
  - Oppening delimiter used for the plantuml parser.
  - Default: @startuml

#### `markdown-pdf.plantumlCloseMarker`
  - Closing delimiter used for the plantuml parser.
  - Default: @enduml

#### `markdown-pdf.plantumlServer`
  - Plantuml server. e.g. http://localhost:8080
  - Default: http://www.plantuml.com/plantuml
  - For example, to run Plantuml Server locally [#139](https://github.com/yzane/vscode-markdown-pdf/issues/139) :
    ```
    docker run -d -p 8080:8080 plantuml/plantuml-server:jetty
    ```
    [plantuml/plantuml-server - Docker Hub](https://hub.docker.com/r/plantuml/plantuml-server/)

### markdown-it-include options

#### `markdown-pdf.markdown-it-include.enable`
  - Enable markdown-it-include.
  - boolean. Default: true

### mermaid options

#### `markdown-pdf.mermaidServer`
  - mermaid server
  - Default: https://unpkg.com/mermaid/dist/mermaid.min.js

<div class="page"/>

## FAQ

### How can I change emoji size ?

1. Add the following to your stylesheet which was specified in the markdown-pdf.styles

```css
.emoji {
  height: 2em;
}
```

### Auto guess encoding of files

Using `files.autoGuessEncoding` option of the Visual Studio Code is useful because it automatically guesses the character code. See [files.autoGuessEncoding](https://code.visualstudio.com/updates/v1_11#_auto-guess-encoding-of-files)

```javascript
"files.autoGuessEncoding": true,
```

### Output directory

If you always want to output to the relative path directory from the Markdown file.

For example, to output to the "output" directory in the same directory as the Markdown file, set it as follows.

```javascript
"markdown-pdf.outputDirectory" : "output",
"markdown-pdf.outputDirectoryRelativePathFile": true,
```

### Page Break

Please use the following to insert a page break.

``` html
<div class="page"/>
```

<div class="page"/>

## Known Issues

### `markdown-pdf.styles` option
* Online CSS (https://xxx/xxx.css) is applied correctly for JPG and PNG, but problems occur with PDF. [#67](https://github.com/yzane/vscode-markdown-pdf/issues/67)


## [Release Notes](CHANGELOG.md)

### 1.5.0 (2023/09/08)
* Improve: The default date format for headers and footers has been changed to the ISO-based format (YYYY-MM-DD).
  * Support different date formats in templates [#197](https://github.com/yzane/vscode-markdown-pdf/pull/197)
* Improve: Avoid TimeoutError: Navigation timeout of 30000 ms exceeded and TimeoutError: waiting for Page.printToPDF failed: timeout 30000ms exceeded [#266](https://github.com/yzane/vscode-markdown-pdf/pull/266)
* Fix: Fix description of outputDirectoryRelativePathFile [#238](https://github.com/yzane/vscode-markdown-pdf/pull/238)
* README
  * Add: Specification Changes
  * Fix: Broken link

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
* [markdown-it/markdown-it-container](https://github.com/markdown-it/markdown-it-container)
* [gmunguia/markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)
* [camelaissani/markdown-it-include](https://github.com/camelaissani/markdown-it-include)
* [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)
* [jonschlinkert/gray-matter](https://github.com/jonschlinkert/gray-matter)

and

* [cakebake/markdown-themeable-pdf](https://github.com/cakebake/markdown-themeable-pdf)
