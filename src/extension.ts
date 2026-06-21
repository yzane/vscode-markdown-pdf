// VS Code extension entry point: registers markdown-pdf commands and drives
// the markdown-to-HTML/PDF/image conversion workflow via puppeteer-core.
import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import * as utils from './utils';
import * as chromiumResolver from './chromium-resolver';
import * as logger from './logger';
import * as diagnostics from './diagnostics';
import { installSanitizeRules } from './markdown-it-sanitize';
import hljs from 'highlight.js';
import markdownIt from 'markdown-it';
import { markdownItCheckbox } from './markdown-it-checkbox';
import { full as markdownItEmojiFull } from 'markdown-it-emoji';
import { markdownItNamedHeaders } from './markdown-it-named-headers';
import markdownItContainer from 'markdown-it-container';
import markdownItPlantuml from 'markdown-it-plantuml';
import markdownItKatex from '@vscode/markdown-it-katex';
import { mathFencePlugin } from './markdown-it-math-fence';
import { mathBracketsPlugin } from './markdown-it-math-brackets';
import { renderMath } from './math-renderer';
import { markdownItInclude } from './markdown-it-include';
import puppeteer from 'puppeteer-core';

const EXTENSION_ROOT = path.join(__dirname, '..');
let INSTALL_CHECK = false;
let extensionContext: vscode.ExtensionContext | null = null;

function getExtensionCacheDir(): string {
  if (!extensionContext) {
    return '';
  }

  if (extensionContext.globalStorageUri && extensionContext.globalStorageUri.fsPath) {
    return extensionContext.globalStorageUri.fsPath;
  }

  if (extensionContext.globalStoragePath) {
    return extensionContext.globalStoragePath;
  }

  return '';
}

/** Reads markdown-pdf.chromium.autoDownload (default: true). */
function getAutoDownload(): boolean {
  const chromium = vscode.workspace.getConfiguration('markdown-pdf')['chromium'];
  if (chromium && typeof chromium === 'object' && typeof chromium.autoDownload === 'boolean') {
    return chromium.autoDownload;
  }
  return true;
}

/** Collects a host environment snapshot for diagnostics. */
function collectEnvironment(): diagnostics.EnvironmentInfo {
  return {
    extensionVersion: extensionContext?.extension.packageJSON.version ?? 'unknown',
    vscodeVersion: vscode.version,
    platform: process.platform,
    osRelease: os.release(),
    arch: process.arch,
    nodeVersion: process.version,
    puppeteerCoreVersion: chromiumResolver.getPuppeteerCoreVersion(),
    expectedChromeBuildId: chromiumResolver.getExpectedBuildId(),
  };
}

/** Outputs an environment snapshot and current settings to the channel, then reveals it. */
function outputDiagnostics(): void {
  const env = collectEnvironment();
  const homeDir = os.homedir();
  const config = vscode.workspace.getConfiguration('markdown-pdf');
  logger.logInfo(diagnostics.buildEnvironmentBlock(env));
  logger.logInfo([
    '--- Settings ---',
    'type: ' + JSON.stringify(config['type']),
    'sanitize: ' + (config['sanitize'] || 'gfm'),
    'executablePath: ' + diagnostics.orNotSet(diagnostics.maskHomePath(config['executablePath'] || '', homeDir)),
    'chromium.autoDownload: ' + String(getAutoDownload()),
    'outputDirectory: ' + diagnostics.orNotSet(diagnostics.maskHomePath(config['outputDirectory'] || '', homeDir)),
  ].join('\n'));
  logger.showLog();
}

/** Activates the extension: registers markdown-pdf commands and wires the convert-on-save handler. */
export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  logger.initializeLogger(
    context,
    () => vscode.window.createOutputChannel('Markdown PDF', { log: true })
  );
  init();

  const commands = [
    vscode.commands.registerCommand('extension.markdown-pdf.settings', async function () { await markdownPdf('settings'); }),
    vscode.commands.registerCommand('extension.markdown-pdf.pdf', async function () { await markdownPdf('pdf'); }),
    vscode.commands.registerCommand('extension.markdown-pdf.html', async function () { await markdownPdf('html'); }),
    vscode.commands.registerCommand('extension.markdown-pdf.png', async function () { await markdownPdf('png'); }),
    vscode.commands.registerCommand('extension.markdown-pdf.jpeg', async function () { await markdownPdf('jpeg'); }),
    vscode.commands.registerCommand('extension.markdown-pdf.all', async function () { await markdownPdf('all'); }),
    vscode.commands.registerCommand('extension.markdown-pdf.diagnostics', outputDiagnostics),
  ];
  commands.forEach(function (command) {
    context.subscriptions.push(command);
  });

  const isConvertOnSave = vscode.workspace.getConfiguration('markdown-pdf')['convertOnSave'];
  if (isConvertOnSave) {
    const disposable_onsave = vscode.workspace.onDidSaveTextDocument(function () { markdownPdfOnSave(); });
    context.subscriptions.push(disposable_onsave);
  }
}

// this method is called when your extension is deactivated
/** Deactivates the extension. Currently a no-op; kept for VS Code API compatibility. */
export function deactivate(): void {
}

async function markdownPdf(option_type: string, isOnSave = false): Promise<void> {

  try {

    // check active window
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      logger.logWarn('Export aborted: no active editor.');
      vscode.window.showWarningMessage('No active Editor!');
      return;
    }

    // check markdown mode
    const mode = editor.document.languageId;
    if (mode != 'markdown') {
      logger.logWarn('Export aborted: active document is not markdown (languageId=' + mode + ').');
      vscode.window.showWarningMessage('It is not a markdown mode!');
      return;
    }

    const uri = editor.document.uri;
    const mdfilename = uri.fsPath;
    const ext = path.extname(mdfilename);
    if (!utils.isExistsPath(mdfilename)) {
      if (editor.document.isUntitled) {
        logger.logWarn('Export aborted: document is untitled (unsaved).');
        vscode.window.showWarningMessage('Please save the file!');
        return;
      }
      logger.logWarn('Export aborted: cannot resolve a local file path for ' + uri.scheme + '://' + uri.fsPath);
      vscode.window.showWarningMessage(
        'Cannot determine the file path. Virtual or remote workspaces (e.g. Azure DevOps) are not supported. Save the file to a local folder.'
      );
      return;
    }

    const types_format = ['html', 'pdf', 'png', 'jpeg'];
    let filename = '';
    const types = utils.resolveExportTypes(option_type, vscode.workspace.getConfiguration('markdown-pdf')['type']);
    if (types === null) {
      showErrorMessage('Unsupported output format. Supported: html, pdf, png, jpeg.', undefined, 'markdownPdf() type guard #1 (resolveExportTypes returned null)');
      return;
    }

    // convert and export markdown to pdf, html, png, jpeg
    if (types && Array.isArray(types) && types.length > 0) {
      const sanitizeMode = (vscode.workspace.getConfiguration('markdown-pdf')['sanitize'] || 'gfm') as utils.SanitizeMode;
      let sanitizeReport: utils.SanitizeReport = { removedElements: [], strippedAttributes: [] };
      const env = collectEnvironment();
      const homeDir = os.homedir();
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        if (types_format.indexOf(type) >= 0) {
          filename = mdfilename.replace(ext, '.' + type);
          const text = editor.document.getText();
          const ctx: diagnostics.ConvertContext = {
            sourceFile: mdfilename,
            outputType: type,
            executablePath: vscode.workspace.getConfiguration('markdown-pdf')['executablePath'] || '',
            autoDownload: getAutoDownload(),
            outputDirectory: vscode.workspace.getConfiguration('markdown-pdf')['outputDirectory'] || '',
            sanitize: sanitizeMode,
          };
          logger.logInfo(diagnostics.buildStartDiagnostics(env, ctx, homeDir));
          const converted = convertMarkdownToHtml(mdfilename, type, text, ctx, homeDir);
          if (converted) {
            // Report is identical across export types (same source + mode); keep the latest.
            sanitizeReport = converted.report;
          }
          const html = makeHtml(converted ? converted.html : undefined, uri, ctx, homeDir);
          await exportPdf(html, filename, type, uri, ctx, homeDir);
        } else {
          showErrorMessage('Unsupported output format. Supported: html, pdf, png, jpeg.', undefined, 'markdownPdf() type guard #2 (unexpected type "' + type + '")');
          return;
        }
      }
      // One notification per invocation, after all export types are processed.
      notifySanitize(sanitizeReport, sanitizeMode, isOnSave);
    } else {
      showErrorMessage('Unsupported output format. Supported: html, pdf, png, jpeg.', undefined, 'markdownPdf() type guard #3 (empty types)');
      return;
    }
  } catch (error) {
    showErrorMessage('markdownPdf()', error);
  }
}

function markdownPdfOnSave(): void {
  try {
    const editor = vscode.window.activeTextEditor;
    const mode = editor!.document.languageId;
    if (mode != 'markdown') {
      return;
    }
    if (!isMarkdownPdfOnSaveExclude()) {
      markdownPdf('settings', true);
    }
  } catch (error) {
    showErrorMessage('markdownPdfOnSave()', error);
  }
}

function isMarkdownPdfOnSaveExclude(): boolean | undefined {
  try {
    const editor = vscode.window.activeTextEditor;
    const filename = path.basename(editor!.document.fileName);
    const patterns = vscode.workspace.getConfiguration('markdown-pdf')['convertOnSaveExclude'] || '';
    return utils.isExcludeFile(filename, patterns);
  } catch (error) {
    showErrorMessage('isMarkdownPdfOnSaveExclude()', error);
  }
}

function getFrontMatterBoolean(data: Record<string, unknown>, key: string): boolean | null | undefined {
  const value = data[key];
  return typeof value === 'boolean' || value === null ? value : undefined;
}

function getFrontMatterString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

function getFrontMatterRecord(data: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = data[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/*
 * convert markdown to html (markdown-it)
 */
// ctx/homeDir are used only in the catch block(s) to add diagnostic context to error logs.
function convertMarkdownToHtml(
  filename: string,
  type: string,
  text: string,
  ctx: diagnostics.ConvertContext,
  homeDir: string
): { html: string; report: utils.SanitizeReport } | undefined {
  const matterParts = utils.parseFrontMatter(text);
  let statusbarmessage: vscode.Disposable | undefined;

  try {
    try {
      statusbarmessage = vscode.window.setStatusBarMessage('$(markdown) Converting (convertMarkdownToHtml) ...');
      const breaks = utils.setBooleanValue(
        getFrontMatterBoolean(matterParts.data, 'breaks'),
        vscode.workspace.getConfiguration('markdown-pdf')['breaks'],
      );
      const md = markdownIt(utils.buildMarkdownItOptions({
        breaks: breaks,
        hljs: hljs,
        escapeHtml: markdownIt().utils.escapeHtml,
      }) as markdownIt.Options);

      // convert the img src of the markdown
      const defaultRender = md.renderer.rules.image;
      md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const href = token.attrs![token.attrIndex('src')][1];
        const transformedHref = utils.transformImageHref(href, type, filename);
        token.attrs![token.attrIndex('src')][1] = transformedHref;
        return defaultRender!(tokens, idx, options, env, self);
      };

      const sanitizeMode = (vscode.workspace.getConfiguration('markdown-pdf')['sanitize'] || 'gfm') as utils.SanitizeMode;
      const sanitizeReport: utils.SanitizeReport = { removedElements: [], strippedAttributes: [] };
      installSanitizeRules(
        md,
        sanitizeMode,
        sanitizeReport,
        type !== 'html' ? function (h: string) { return utils.transformHtmlBlock(h, filename); } : undefined,
      );

      // checkbox
      md.use(markdownItCheckbox);

      // emoji
      const emoji_f = utils.setBooleanValue(
        getFrontMatterBoolean(matterParts.data, 'emoji'),
        vscode.workspace.getConfiguration('markdown-pdf')['emoji'],
      );
      if (emoji_f) {
        const emojies_defs = JSON.parse(utils.readFile(path.join(EXTENSION_ROOT, 'data', 'emoji.json')) as string);
        const emojiOptions = {
          defs: emojies_defs
        };
        md.use(markdownItEmojiFull, emojiOptions);
        md.renderer.rules.emoji = function (token, idx) {
          const emoji = token[idx].markup;
          const emojipath = path.join(EXTENSION_ROOT, 'node_modules', 'emoji-images', 'pngs', emoji + '.png');
          const emojidata = utils.readFile(emojipath, null).toString('base64');
          return utils.buildEmojiTag(emoji, emojidata);
        };
      }

      // toc via the local named-headers plugin
      const tocOptions = {
        slugify: utils.Slug
      };
      md.use(markdownItNamedHeaders, tocOptions);

      // markdown-it-container
      // https://github.com/markdown-it/markdown-it-container
      md.use(markdownItContainer, '', utils.buildContainerRenderer());

      // PlantUML
      // https://github.com/gmunguia/markdown-it-plantuml
      const plantumlOptions = utils.buildPlantumlOptions({
        frontmatterOpenMarker: getFrontMatterString(matterParts.data, 'plantumlOpenMarker'),
        frontmatterCloseMarker: getFrontMatterString(matterParts.data, 'plantumlCloseMarker'),
        settingsOpenMarker: vscode.workspace.getConfiguration('markdown-pdf')['plantumlOpenMarker'] || '',
        settingsCloseMarker: vscode.workspace.getConfiguration('markdown-pdf')['plantumlCloseMarker'] || '',
        server: vscode.workspace.getConfiguration('markdown-pdf')['plantumlServer'] || ''
      });
      md.use(markdownItPlantuml, plantumlOptions);

      // Math rendering via KaTeX
      // https://github.com/microsoft/vscode-markdown-it-katex (same plugin as VS Code's built-in Markdown Math)
      const mathFrontmatter = getFrontMatterRecord(matterParts.data, 'math') || {};
      const mathFrontmatterKatex = getFrontMatterRecord(mathFrontmatter, 'katex') || {};
      const mathSettings = vscode.workspace.getConfiguration('markdown-pdf').get<{ enabled?: boolean; katex?: { macros?: Record<string, string> } }>('math') || {};
      const mathEnabled = utils.setBooleanValue(
        typeof mathFrontmatter['enabled'] === 'boolean' ? (mathFrontmatter['enabled'] as boolean) : undefined,
        mathSettings.enabled,
      ) ?? true;
      const mathMacrosFrontmatter = getFrontMatterRecord(mathFrontmatterKatex, 'macros');
      const mathMacrosSettings = (mathSettings.katex && mathSettings.katex.macros) || {};
      const mathMacros: Record<string, string> = {};
      for (const [k, v] of Object.entries(mathMacrosSettings)) {
        if (typeof v === 'string') { mathMacros[k] = v; }
      }
      if (mathMacrosFrontmatter) {
        for (const [k, v] of Object.entries(mathMacrosFrontmatter)) {
          if (typeof v === 'string') { mathMacros[k] = v; }
        }
      }
      if (mathEnabled) {
        md.use(markdownItKatex, { enableBareBlocks: true, enableMathBlockInHtml: false });
        md.use(mathBracketsPlugin);
        // Route delimiter-path math tokens through renderMath(). Inline \[...\]
        // tokens carry markup '\\[' and must render as display math; all other
        // math_inline tokens render inline.
        md.renderer.rules.math_inline = function (tokens, idx) {
          const token = tokens[idx];
          const displayMode = token.markup === '\\[';
          return renderMath(token.content, displayMode, { macros: mathMacros });
        };
        md.renderer.rules.math_block = function (tokens, idx) {
          return renderMath(tokens[idx].content, true, { macros: mathMacros });
        };
        md.use(mathFencePlugin, { macros: mathMacros });
      }

      // ```plantuml fenced code blocks render as PlantUML diagrams alongside the
      // @startuml/@enduml block syntax handled by markdown-it-plantuml above.
      const defaultFenceRenderer = md.renderer.rules.fence;
      md.renderer.rules.fence = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        if (token.info.trim().toLowerCase() === 'plantuml') {
          return utils.buildPlantumlImgTag(token.content, plantumlOptions.server);
        }
        if (defaultFenceRenderer) {
          return defaultFenceRenderer(tokens, idx, options, env, self);
        }
        return self.renderToken(tokens, idx, options);
      };

      // Include markdown fragment files with :[alt-text](relative-path-to-file.md) syntax
      // https://talk.commonmark.org/t/transclusion-or-including-sub-documents-for-reuse/270/13
      if (vscode.workspace.getConfiguration('markdown-pdf')['markdown-it-include']['enable']) {
        md.use(markdownItInclude, {
          root: path.dirname(filename),
          throwError: false
        });
      }

      statusbarmessage.dispose();
      const html = md.render(matterParts.content);

      // Show warning for missing include files
      const includeErrorRe = /INCLUDE ERROR: (.+?)(?=<\/h1>|<\/p>|\n)/g;
      let match;
      while ((match = includeErrorRe.exec(html)) !== null) {
        vscode.window.showWarningMessage(match[1]);
      }

      return { html: html, report: sanitizeReport };

    } catch (error) {
      if (statusbarmessage) {
        statusbarmessage.dispose();
      }
      showErrorMessage('convertMarkdownToHtml()', error, diagnostics.buildContextSummary(ctx, homeDir));
    }
  } catch (error) {
    if (statusbarmessage) {
      statusbarmessage.dispose();
    }
    showErrorMessage('convertMarkdownToHtml()', error, diagnostics.buildContextSummary(ctx, homeDir));
  }
}

/*
 * make html
 */
// ctx/homeDir are used only in the catch block(s) to add diagnostic context to error logs.
function makeHtml(
  data: string | undefined,
  uri: vscode.Uri,
  ctx: diagnostics.ConvertContext,
  homeDir: string
): string | undefined {
  try {
    // read styles
    let style = '';
    style += readStyles(uri, data);

    // get title
    const title = path.basename(uri.fsPath);

    // read template
    const filename = path.join(EXTENSION_ROOT, 'template', 'template.html');
    const template = utils.readFile(filename);

    // read mermaid javascripts
    // compile template
    const view = utils.buildHtmlViewData({
      content: data as string,
      title: title,
      style: style,
      mermaidServer: vscode.workspace.getConfiguration('markdown-pdf')['mermaidServer'] || ''
    });
    return utils.renderTemplate(template as string, view);
  } catch (error) {
    showErrorMessage('makeHtml()', error, diagnostics.buildContextSummary(ctx, homeDir));
  }
}

/*
 * export a html to a html file
 */
function exportHtml(data: string, filename: string): void {
  fs.writeFile(filename, data, 'utf-8', function (error) {
    if (error) {
      showErrorMessage('exportHtml()', error);
      return;
    }
  });
}

/*
 * export a html to a pdf file (html-pdf)
 */
function exportPdf(
  data: string | undefined,
  filename: string,
  type: string,
  uri: vscode.Uri,
  ctx: diagnostics.ConvertContext,
  homeDir: string
): Thenable<void> {
  const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
  vscode.window.setStatusBarMessage('');
  const exportFilename = getOutputDir(filename, uri);

  if (!exportFilename) {
    return Promise.resolve();  // getOutputDir already showed an error toast
  }
  ctx.outputPath = exportFilename;
  logger.logInfo('Output: ' + diagnostics.maskHomePath(exportFilename, homeDir));

  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: '[Markdown PDF]: Exporting (' + type + ') ...'
    }, async () => {
      try {
        // export html
        if (type == 'html') {
          exportHtml(data as string, exportFilename as string);
          vscode.window.setStatusBarMessage('$(markdown) ' + exportFilename, StatusbarMessageTimeout);
          return;
        }

        // create temporary file
        const tmpfilename = utils.generateTmpHtmlFilename(filename);
        exportHtml(data as string, tmpfilename);
        const cacheDir = getExtensionCacheDir();
        const userExecPath = vscode.workspace.getConfiguration('markdown-pdf')['executablePath'] || '';
        const resolution = await chromiumResolver.resolveChromiumPath(userExecPath, cacheDir, {
          autoDownload: getAutoDownload()
        });
        if (!resolution) {
          if (utils.isExistsPath(tmpfilename)) {
            deleteFile(tmpfilename);
          }
          if (!getAutoDownload()) {
            showErrorMessage(
              'Chromium not found. Automatic download is disabled (markdown-pdf.chromium.autoDownload = false). ' +
              'Install Google Chrome / Chromium / Microsoft Edge, set markdown-pdf.executablePath, ' +
              'or enable markdown-pdf.chromium.autoDownload. ' +
              'See https://github.com/yzane/vscode-markdown-pdf#install'
            );
          } else {
            showErrorMessage('Chromium or Chrome does not exist! See https://github.com/yzane/vscode-markdown-pdf#install');
          }
          return;
        }
        const launchOptions = {
          executablePath: resolution.path,
          args: ['--lang=' + vscode.env.language, '--no-sandbox', '--disable-setuid-sandbox']
          // Setting Up Chrome Linux Sandbox
          // https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
        };
        ctx.resolvedChromiumPath = resolution.path;
        ctx.chromiumSource = resolution.source;
        logger.logInfo('Chromium: ' + diagnostics.maskHomePath(resolution.path, homeDir) + ' (source: ' + resolution.source + ')');
        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        // PDF/image rendering is headless with no user to answer JS dialogs; auto-dismiss
        // them so a script calling alert/confirm/prompt/beforeunload cannot hang the export.
        page.on('dialog', async function (dialog) {
          const info = '(' + dialog.type() + '): ' + dialog.message();
          try {
            await dialog.dismiss();
            logger.logWarn('Dismissed a blocking dialog during rendering ' + info);
          } catch (error) {
            // dismiss() can reject if the dialog was already handled or the page closed;
            // swallow it (logged) so the handler never produces an unhandled rejection.
            logger.logWarn('Failed to dismiss a blocking dialog during rendering ' + info + ' - ' + (error instanceof Error ? error.message : String(error)));
          }
        });
        await page.setDefaultTimeout(0);
        await page.goto(vscode.Uri.file(tmpfilename).toString(), { waitUntil: 'networkidle0' });
        // generate pdf
        // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagepdfoptions
        if (type == 'pdf') {
          const pdfConfig = {
            path: exportFilename as string,
            width: vscode.workspace.getConfiguration('markdown-pdf', uri)['width'] || '',
            height: vscode.workspace.getConfiguration('markdown-pdf', uri)['height'] || '',
            format: vscode.workspace.getConfiguration('markdown-pdf', uri)['format'] || 'A4',
            orientation: vscode.workspace.getConfiguration('markdown-pdf', uri)['orientation'] || '',
            scale: vscode.workspace.getConfiguration('markdown-pdf', uri)['scale'],
            displayHeaderFooter: vscode.workspace.getConfiguration('markdown-pdf', uri)['displayHeaderFooter'],
            headerTemplate: vscode.workspace.getConfiguration('markdown-pdf', uri)['headerTemplate'] || '',
            footerTemplate: vscode.workspace.getConfiguration('markdown-pdf', uri)['footerTemplate'] || '',
            printBackground: vscode.workspace.getConfiguration('markdown-pdf', uri)['printBackground'],
            pageRanges: vscode.workspace.getConfiguration('markdown-pdf', uri)['pageRanges'] || '',
            margin: {
              top: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['top'] || '',
              right: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['right'] || '',
              bottom: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['bottom'] || '',
              left: vscode.workspace.getConfiguration('markdown-pdf', uri)['margin']['left'] || ''
            },
          };
          const pdfOptions = utils.buildPdfOptions(pdfConfig);
          await page.pdf(pdfOptions);
        }

        // generate png and jpeg
        // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagescreenshotoptions
        if (type == 'png' || type == 'jpeg') {
          const imageOptions = utils.buildImageOptions({
            path: exportFilename as string,
            type: type,
            quality: vscode.workspace.getConfiguration('markdown-pdf')['quality'] || 100,
            clip: {
              x: vscode.workspace.getConfiguration('markdown-pdf')['clip']['x'] || null,
              y: vscode.workspace.getConfiguration('markdown-pdf')['clip']['y'] || null,
              width: vscode.workspace.getConfiguration('markdown-pdf')['clip']['width'] || null,
              height: vscode.workspace.getConfiguration('markdown-pdf')['clip']['height'] || null,
            },
            omitBackground: vscode.workspace.getConfiguration('markdown-pdf')['omitBackground'],
          });
          await page.screenshot(imageOptions);
        }

        await browser.close();

        // delete temporary file
        const debug = vscode.workspace.getConfiguration('markdown-pdf')['debug'] || false;
        if (!debug) {
          if (utils.isExistsPath(tmpfilename)) {
            deleteFile(tmpfilename);
          }
        }

        vscode.window.setStatusBarMessage('$(markdown) ' + exportFilename, StatusbarMessageTimeout);
      } catch (error) {
        showErrorMessage('exportPdf()', error, diagnostics.buildContextSummary(ctx, homeDir));
      }
    } // async
  ); // vscode.window.withProgress
}

function deleteFile(filePath: string): void {
  fs.rmSync(filePath, { recursive: true, force: true });
}

function getOutputDir(filename: string, resource: vscode.Uri | undefined): string | undefined {
  try {
    if (resource === undefined) {
      return filename;
    }
    const outputDirectory = vscode.workspace.getConfiguration('markdown-pdf')['outputDirectory'] || '';
    const outputDirectoryRelativePathFile = vscode.workspace.getConfiguration('markdown-pdf')['outputDirectoryRelativePathFile'];
    const root = vscode.workspace.getWorkspaceFolder(resource);
    const result = utils.resolveOutputDir(
      filename,
      outputDirectory,
      outputDirectoryRelativePathFile,
      resource.fsPath,
      root ? root.uri.fsPath : undefined
    );

    if (result === null) {
      showErrorMessage(`The output directory specified by the markdown-pdf.outputDirectory option does not exist.\
        Check the markdown-pdf.outputDirectory option. ` + outputDirectory);
      return;
    }

    if (outputDirectory.indexOf('~') === 0) {
      mkdir(outputDirectory.replace(/^~/, os.homedir()));
    } else if (outputDirectory.length > 0 && !path.isAbsolute(outputDirectory)) {
      mkdir(path.dirname(result));
    }

    return result;
  } catch (error) {
    showErrorMessage('getOutputDir()', error);
  }
}

function mkdir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readStyles(uri: vscode.Uri, htmlBody: string | undefined): string | undefined {
  try {
    const includeDefaultStyles = vscode.workspace.getConfiguration('markdown-pdf')['includeDefaultStyles'];
    const highlightStyle = vscode.workspace.getConfiguration('markdown-pdf')['highlightStyle'] || '';
    const highlight = vscode.workspace.getConfiguration('markdown-pdf')['highlight'];
    const markdownStyles = vscode.workspace.getConfiguration('markdown')['styles'] || [];
    const markdownPdfStyles = vscode.workspace.getConfiguration('markdown-pdf')['styles'] || '';

    let style = utils.buildStyleTags({
      includeDefaultStyles: includeDefaultStyles,
      highlight: highlight,
      highlightStyle: highlightStyle,
      markdownStyles: markdownStyles,
      markdownPdfStyles: markdownPdfStyles,
      baseDir: EXTENSION_ROOT,
      onMissingHighlightStyle: function (requestedStyle: string, resolvedStyle: string) {
        vscode.window.showWarningMessage(
          'The configured markdown-pdf.highlightStyle "' + requestedStyle +
          '" is no longer supported. Falling back to "' + resolvedStyle +
          '". See https://github.com/yzane/vscode-markdown-pdf#markdown-pdfhighlightstyle for available styles.'
        );
      },
      resolveHrefFn: function (href: string) {
        return fixHref(uri, href) || '';
      },
    }) || '';

    // Inline KaTeX CSS with data: URI fonts only when the body actually
    // contains KaTeX output. This keeps unrelated documents small and avoids
    // regenerating every existing snapshot just because math support shipped.
    if (htmlBody && htmlBody.includes('class="katex')) {
      style += utils.buildKatexStyleTag(EXTENSION_ROOT);
    }

    return style;
  } catch (error) {
    showErrorMessage('readStyles()', error);
  }
}

/*
 * vscode/extensions/markdown-language-features/src/features/previewContentProvider.ts fixHref()
 * https://github.com/Microsoft/vscode/blob/0c47c04e85bc604288a288422f0a7db69302a323/extensions/markdown-language-features/src/features/previewContentProvider.ts#L95
 *
 * Extension Authoring: Adopting Multi Root Workspace APIs - Microsoft/vscode Wiki
 * https://github.com/Microsoft/vscode/wiki/Extension-Authoring:-Adopting-Multi-Root-Workspace-APIs
 */
function fixHref(resource: vscode.Uri, href: string): string | undefined {
  try {
    if (!href) {
      return href;
    }

    // Use href if it is already an URL
    const hrefUri = vscode.Uri.parse(href);
    if (['http', 'https'].indexOf(hrefUri.scheme) >= 0) {
      return hrefUri.toString();
    }

    const stylesRelativePathFile = vscode.workspace.getConfiguration('markdown-pdf')['stylesRelativePathFile'];
    const root = vscode.workspace.getWorkspaceFolder(resource);
    return utils.resolveHref(href, resource.fsPath, stylesRelativePathFile, root ? root.uri.fsPath : undefined) ?? undefined;
  } catch (error) {
    showErrorMessage('fixHref()', error);
  }
}

function checkPuppeteerBinary(): boolean | undefined {
  try {
    const executablePath = vscode.workspace.getConfiguration('markdown-pdf')['executablePath'] || '';
    if (chromiumResolver.findChromiumFromUserSetting(executablePath)) {
      INSTALL_CHECK = true;
      return true;
    }

    if (chromiumResolver.findChromiumFromSystem()) {
      return true;
    }

    if (extensionContext) {
      const cacheDir = getExtensionCacheDir();
      if (!cacheDir) {
        return false;
      }
      return chromiumResolver.hasAnyCachedChromiumSync(cacheDir);
    }

    return false;
  } catch (error) {
    showErrorMessage('checkPuppeteerBinary()', error);
  }
}

/*
 * puppeteer install.js
 * https://github.com/GoogleChrome/puppeteer/blob/master/install.js
 */
async function installChromium(): Promise<void> {
  let statusbarmessage: vscode.Disposable | undefined;
  try {
    if (!getAutoDownload()) {
      // autoDownload disabled: defer error to actual export attempt.
      return;
    }

    vscode.window.showInformationMessage('[Markdown PDF] Installing Chromium ...');
    statusbarmessage = vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ...');

    setProxy();

    const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
    const cacheDir = getExtensionCacheDir();
    if (!cacheDir) {
      throw new Error('Extension storage path is unavailable.');
    }

    const resolution = await chromiumResolver.resolveChromiumPath('', cacheDir, {
      autoDownload: true,
      onProgress: onProgress
    });

    if (resolution) {
      INSTALL_CHECK = true;
      statusbarmessage.dispose();
      vscode.window.setStatusBarMessage('$(markdown) Chromium installation succeeded!', StatusbarMessageTimeout);
      vscode.window.showInformationMessage('[Markdown PDF] Chromium installation succeeded.');
    } else {
      throw new Error('resolveChromiumPath returned null');
    }
  } catch (error) {
    try {
      if (statusbarmessage) {
        statusbarmessage.dispose();
      }
    } catch (disposeError) {
    }
    const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
    vscode.window.setStatusBarMessage('$(markdown) ERROR: Failed to download Chromium!', StatusbarMessageTimeout);
    showErrorMessage('Failed to download Chromium! \
        If you are behind a proxy, set the http.proxy option to settings.json and restart Visual Studio Code. \
        See https://github.com/yzane/vscode-markdown-pdf#install', error);
  }

  function onProgress(downloadedBytes: number, totalBytes: number): void {
    const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdown-pdf')['StatusbarMessageTimeout'];
    if (totalBytes > 0) {
      const progress = Math.floor(downloadedBytes / totalBytes * 100);
      vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ' + progress + '%', StatusbarMessageTimeout);
      return;
    }
    vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ...', StatusbarMessageTimeout);
  }
}

// Action label shown on the error toast; selecting it reveals the output channel.
const SHOW_OUTPUT_ACTION = 'Show Output';

function showErrorMessage(msg: string, error?: unknown, context?: string): void {
  // Log first so detail (incl. stack via formatError) is in the channel by the
  // time the user clicks "Show Output".
  logger.logError(msg);
  if (context) {
    logger.logError(context);
  }
  if (error) {
    logger.logError(logger.formatError(error));
  }
  vscode.window.showErrorMessage('ERROR: ' + msg, SHOW_OUTPUT_ACTION).then(function (selection) {
    if (selection === SHOW_OUTPUT_ACTION) {
      logger.showLog();
    }
  });
}

function notifySanitize(report: utils.SanitizeReport, mode: utils.SanitizeMode, isOnSave: boolean): void {
  if (report.removedElements.length === 0 && report.strippedAttributes.length === 0) {
    return;
  }
  // Always record details to the output channel (manual and on-save).
  logger.logWarn(utils.buildSanitizeLogDetail(report, mode));
  // Toast only on explicit/manual export to avoid spamming on convertOnSave.
  if (!isOnSave) {
    vscode.window.showWarningMessage(utils.buildSanitizeSummary(report), SHOW_OUTPUT_ACTION).then(function (selection) {
      if (selection === SHOW_OUTPUT_ACTION) {
        logger.showLog();
      }
    });
  }
}

function setProxy(): void {
  const https_proxy = vscode.workspace.getConfiguration('http')['proxy'] || '';
  if (https_proxy) {
    process.env.HTTPS_PROXY = https_proxy;
    process.env.HTTP_PROXY = https_proxy;
  }
}

async function init(): Promise<void> {
  try {
    if (checkPuppeteerBinary()) {
      INSTALL_CHECK = true;
    } else {
      await installChromium();
    }
  } catch (error) {
    showErrorMessage('init()', error);
  }
}
