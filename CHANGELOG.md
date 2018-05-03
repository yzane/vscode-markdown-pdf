# Change Log

## 1.1.0 (2018/05/03)
* Add: Support [markdown-it-container](https://github.com/markdown-it/markdown-it-container) [#72](https://github.com/yzane/vscode-markdown-pdf/issues/72)

## 1.0.5 (2018/05/03)
* Improve: Exception handling
* Improve: Chromium install check
* Add: Page break
    * Is it possible to insert page breaks? [#25](https://github.com/yzane/vscode-markdown-pdf/issues/25)
* Update: README
    * FAQ: Page break
* Update: markdown-pdf.css
    * Add: Meiryo to font-family

## 1.0.4 (2018/05/01)
* Fix: Display error message when downloading Chromium
* Improve: Chromium install. Display download progress on status bar

## 1.0.3 (2018/04/30)
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

* Add: `markdown-pdf.outputDirectoryRelativePathFile` option
* Add: `markdown-pdf.stylesRelativePathFile` option

## 1.0.2 (2018/04/24)
* Improve: puppeteer install [#76](https://github.com/yzane/vscode-markdown-pdf/issues/76), [#77](https://github.com/yzane/vscode-markdown-pdf/issues/77)

## 1.0.1 (2018/04/21)
* Add: Allow online (https) CSS in `markdown-pdf.styles` [#67](https://github.com/yzane/vscode-markdown-pdf/issues/67)

## 1.0.0 (2018/04/15)
* Change: Replace pdf converter with puppeteer instead of html-pdf
* Add: Support multiple types in markdown-pdf.type option
    * Add: Define Multiple outputformats [#20](https://github.com/yzane/vscode-markdown-pdf/issues/20)
* Add: Support markdown-it-named-headers
    * Fix: TOC extension not working on Convert Markdown to PDF [#31](https://github.com/yzane/vscode-markdown-pdf/issues/31)
* Add: Increase menu items (pdf, html, png, jpeg)
* Update: dependencies packages

## 0.1.8 (2018/03/22)
* Add: markdown-pdf.includeDefaultStyles option [#49](https://github.com/yzane/vscode-markdown-pdf/issues/49)
* Fix: Inline code blocks do not use a proportional font [#26](https://github.com/yzane/vscode-markdown-pdf/issues/26)
* Update: dependencies packages

## 0.1.7 (2017/04/05)
* Change: Display completion message on status bar [#19](https://github.com/yzane/vscode-markdown-pdf/issues/19)
* Add: markdown-pdf.convertOnSaveExclude option [#16](https://github.com/yzane/vscode-markdown-pdf/issues/16)
* Fix: broken code-blocks [#18](https://github.com/yzane/vscode-markdown-pdf/pull/18)
* Fix: Image path error [#14](https://github.com/yzane/vscode-markdown-pdf/issues/14)
* Update: [markdown.css](https://github.com/Microsoft/vscode/blob/master/extensions/markdown/media/markdown.css) of the vscode
* Update: dependencies packages

## 0.1.6 (2017/02/05)
* Fix: Relative path error of markdown-pdf.styles [#9](https://github.com/yzane/vscode-markdown-pdf/issues/9)
* Fix: Output file is not created [#10](https://github.com/yzane/vscode-markdown-pdf/issues/10)
* Add: markdown-pdf.outputDirectory option

## 0.1.5 (2017/01/09)

* Add: Support for relative path in markdown-pdf.styles option [#5](https://github.com/yzane/vscode-markdown-pdf/issues/5)
* Fix: ERROR: phantomjs binary does not exist [#2](https://github.com/yzane/vscode-markdown-pdf/issues/2)
* Update: README
* Add: CHANGELOG
* Update: dependencies packages

## 0.1.4 (2016/09/19)

* Add: markdown-pdf.convertOnSave option

## 0.1.3 (2016/08/29)

* Fix: Color of the inline code (`)

## 0.1.2 (2016/08/20)

* Add: Ability to convert markdown file from editor context
* Update: README

## 0.1.1 (2016/08/16)

* Add: Japanese README

## 0.1.0 (2016/08/14)

* Initial release.
