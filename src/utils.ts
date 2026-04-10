import fs from 'fs';
import os from 'os';
import path from 'path';
import type { HLJSApi } from 'highlight.js';
import { githubSlugify } from './markdown-it-named-headers';

export function setBooleanValue(a: boolean | undefined | null, b: boolean | undefined): boolean | undefined {
  if (a === false) {
    return false;
  } else {
    return a || b;
  }
}

export function isExistsPath(filePath: string): boolean {
  if (filePath.length === 0) {
    return false;
  }
  try {
    fs.accessSync(filePath);
    return true;
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return false;
  }
}

export function isExistsDir(dirname: string): boolean {
  if (dirname.length === 0) {
    return false;
  }
  try {
    if (fs.statSync(dirname).isDirectory()) {
      return true;
    } else {
      console.warn('Directory does not exist!');
      return false;
    }
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return false;
  }
}

export function Slug(string: string): string {
  return githubSlugify(string);
}

export function transformTemplate(templateText: string): string {
  if (templateText.indexOf('%%ISO-DATETIME%%') !== -1) {
    templateText = templateText.replace('%%ISO-DATETIME%%', new Date().toISOString().substr(0, 19).replace('T', ' '));
  }
  if (templateText.indexOf('%%ISO-DATE%%') !== -1) {
    templateText = templateText.replace('%%ISO-DATE%%', new Date().toISOString().substr(0, 10));
  }
  if (templateText.indexOf('%%ISO-TIME%%') !== -1) {
    templateText = templateText.replace('%%ISO-TIME%%', new Date().toISOString().substr(11, 8));
  }

  return templateText;
}

export function readFile(filename: string, encode?: BufferEncoding | null): string | Buffer {
  if (filename.length === 0) {
    return '';
  }
  if (!encode && encode !== null) {
    encode = 'utf-8';
  }
  if (filename.indexOf('file://') === 0) {
    if (process.platform === 'win32') {
      filename = filename.replace(/^file:\/\/\//, '')
        .replace(/^file:\/\//, '');
    } else {
      filename = filename.replace(/^file:\/\//, '');
    }
  }
  if (isExistsPath(filename)) {
    try {
      return fs.readFileSync(filename, encode);
    } catch (error: unknown) {
      console.warn((error as Error).message);
      return '';
    }
  } else {
    return '';
  }
}

export function makeCss(filename: string): string {
  const css = readFile(filename);
  if (css) {
    return '\n<style>\n' + css + '\n</style>\n';
  } else {
    return '';
  }
}

export function convertImgPath(src: string, filename: string): string {
  let href = decodeURIComponent(src);
  href = href.replace(/("|')/g, '')
    .replace(/\\/g, '/')
    .replace(/#/g, '%23');
  let protocol: string | null = null;
  try {
    protocol = new URL(href).protocol;
  } catch {
    // href is not a valid URL (relative path, etc.)
  }
  if (protocol === 'file:' && href.indexOf('file:///') !== 0) {
    return href.replace(/^file:\/\//, 'file:///');
  } else if (protocol === 'file:') {
    return href;
  } else if (!protocol || path.isAbsolute(href)) {
    href = path.resolve(path.dirname(filename), href).replace(/\\/g, '/')
      .replace(/#/g, '%23');
    if (href.indexOf('//') === 0) {
      return 'file:' + href;
    } else if (href.indexOf('/') === 0) {
      return 'file://' + href;
    } else {
      return 'file:///' + href;
    }
  } else {
    return src;
  }
}

export function isExcludeFile(filename: string, patterns: string[] | undefined | string): boolean {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  for (let i = 0; i < patterns.length; i++) {
    const re = new RegExp(patterns[i]);
    if (re.test(filename)) {
      return true;
    }
  }
  return false;
}

export function resolveHref(href: string | undefined | null, resourceFsPath: string, stylesRelativePathFile: boolean | undefined, workspaceFsPath: string | undefined): string | undefined | null {
  if (!href) {
    return href;
  }

  let protocol: string | null = null;
  try {
    protocol = new URL(href).protocol;
  } catch {
    // Not a valid absolute URL
  }
  if (protocol === 'http:' || protocol === 'https:' || protocol === 'data:') {
    return href;
  }

  if (href.indexOf('~') === 0) {
    return 'file://' + href.replace(/^~/, os.homedir());
  }

  if (path.isAbsolute(href) || path.win32.isAbsolute(href)) {
    return 'file://' + href;
  }

  if (stylesRelativePathFile === false && workspaceFsPath) {
    return 'file://' + path.join(workspaceFsPath, href);
  }

  return 'file://' + path.join(path.dirname(resourceFsPath), href);
}

export function resolveOutputDir(filename: string, outputDirectory: string | undefined | null, outputDirectoryRelativePathFile: boolean | undefined, resourceFsPath: string, workspaceFsPath: string | undefined): string | null {
  if (!outputDirectory || outputDirectory.length === 0) {
    return filename;
  }

  if (outputDirectory.indexOf('~') === 0) {
    return path.join(outputDirectory.replace(/^~/, os.homedir()), path.basename(filename));
  }

  if (path.isAbsolute(outputDirectory)) {
    if (!isExistsDir(outputDirectory)) {
      return null;
    }
    return path.join(outputDirectory, path.basename(filename));
  }

  if (outputDirectoryRelativePathFile === false && workspaceFsPath) {
    return path.join(workspaceFsPath, outputDirectory, path.basename(filename));
  }

  return path.join(path.dirname(resourceFsPath), outputDirectory, path.basename(filename));
}

const LEGACY_HIGHLIGHT_STYLE_ALIASES: Record<string, string> = {
  'github-gist.css': 'github.css',
  'kimbie.dark.css': 'kimbie-dark.css',
  'kimbie.light.css': 'kimbie-light.css',
  'qtcreator_dark.css': 'qtcreator-dark.css',
  'qtcreator_light.css': 'qtcreator-light.css',
};

function resolveHighlightStyle(baseDir: string, highlightStyle: string): { filename: string; requestedStyle: string; resolvedStyle: string; usedFallback: boolean } {
  const resolvedStyle = LEGACY_HIGHLIGHT_STYLE_ALIASES[highlightStyle] || highlightStyle;
  const stylePath = path.join(baseDir, 'node_modules', 'highlight.js', 'styles', resolvedStyle);

  if (fs.existsSync(stylePath)) {
    return {
      filename: stylePath,
      requestedStyle: highlightStyle,
      resolvedStyle: resolvedStyle,
      usedFallback: resolvedStyle !== highlightStyle,
    };
  }

  return {
    filename: path.join(baseDir, 'styles', 'tomorrow.css'),
    requestedStyle: highlightStyle,
    resolvedStyle: 'tomorrow.css',
    usedFallback: true,
  };
}

interface BuildStyleTagsOptions {
  includeDefaultStyles: boolean;
  highlight: boolean;
  highlightStyle: string;
  markdownStyles: string[] | string;
  markdownPdfStyles: string[] | string;
  baseDir: string;
  onMissingHighlightStyle?: (requestedStyle: string, resolvedStyle: string) => void;
  resolveHrefFn: (href: string) => string;
}

export function buildStyleTags(options: BuildStyleTagsOptions): string {
  let style = '';
  let filename = '';

  if (options.includeDefaultStyles) {
    filename = path.join(options.baseDir, 'styles', 'markdown.css');
    style += makeCss(filename);
  }

  if (options.includeDefaultStyles) {
    if (options.markdownStyles && Array.isArray(options.markdownStyles) && options.markdownStyles.length > 0) {
      for (let i = 0; i < options.markdownStyles.length; i++) {
        const markdownHref = options.resolveHrefFn(options.markdownStyles[i]);
        style += '<link rel="stylesheet" href="' + markdownHref + '" type="text/css">';
      }
    }
  }

  if (options.highlight) {
    if (options.highlightStyle) {
      const resolvedHighlight = resolveHighlightStyle(options.baseDir, options.highlightStyle);
      filename = resolvedHighlight.filename;
      if (options.onMissingHighlightStyle && resolvedHighlight.usedFallback) {
        options.onMissingHighlightStyle(resolvedHighlight.requestedStyle, resolvedHighlight.resolvedStyle);
      }
      style += makeCss(filename);
    } else {
      filename = path.join(options.baseDir, 'styles', 'tomorrow.css');
      style += makeCss(filename);
    }
  }

  if (options.includeDefaultStyles) {
    filename = path.join(options.baseDir, 'styles', 'markdown-pdf.css');
    style += makeCss(filename);
  }

  if (options.markdownPdfStyles && Array.isArray(options.markdownPdfStyles) && options.markdownPdfStyles.length > 0) {
    for (let i = 0; i < options.markdownPdfStyles.length; i++) {
      const markdownPdfHref = options.resolveHrefFn(options.markdownPdfStyles[i]);
      style += '<link rel="stylesheet" href="' + markdownPdfHref + '" type="text/css">';
    }
  }

  return style;
}

interface PdfConfig {
  path: string;
  width: string;
  height: string;
  format: string;
  orientation: string;
  scale: number;
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  printBackground: boolean;
  pageRanges: string;
  margin: { top: string; right: string; bottom: string; left: string };
}

export function buildPdfOptions(config: PdfConfig): Record<string, unknown> {
  let formatOption: string = '';
  if (!config.width && !config.height) {
    formatOption = config.format || 'A4';
  }

  return {
    path: config.path,
    scale: config.scale,
    displayHeaderFooter: config.displayHeaderFooter,
    headerTemplate: transformTemplate(config.headerTemplate || ''),
    footerTemplate: transformTemplate(config.footerTemplate || ''),
    printBackground: config.printBackground,
    landscape: config.orientation === 'landscape',
    pageRanges: config.pageRanges,
    format: formatOption,
    width: config.width,
    height: config.height,
    margin: config.margin,
    timeout: 0,
  };
}

interface ImageConfig {
  path: string;
  type: string;
  quality: number;
  clip: { x: number | null; y: number | null; width: number | null; height: number | null };
  omitBackground: boolean;
}

export function buildImageOptions(config: ImageConfig): Record<string, unknown> {
  const qualityOption = config.type === 'png' ? undefined : config.quality;
  const clip = config.clip;

  if (clip && clip.x !== null && clip.y !== null && clip.width !== null && clip.height !== null) {
    return {
      path: config.path,
      quality: qualityOption,
      fullPage: false,
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
      },
      omitBackground: config.omitBackground,
    };
  }

  return {
    path: config.path,
    quality: qualityOption,
    fullPage: true,
    omitBackground: config.omitBackground,
  };
}

export function buildHighlightCallback(hljs: HLJSApi, escapeHtml: (str: string) => string): (str: string, lang: string) => string {
  return function (str: string, lang: string): string {
    if (lang && lang.match(/\bmermaid\b/i)) {
      return '<div class="mermaid">' + str + '</div>';
    }

    if (lang && hljs.getLanguage(lang)) {
      try {
        str = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch (error) {
        str = escapeHtml(str);
      }
    } else {
      str = escapeHtml(str);
    }

    return '<pre class="hljs"><code><div>' + str + '</div></code></pre>';
  };
}

interface MarkdownItConfig {
  breaks: boolean | undefined;
  hljs: HLJSApi;
  escapeHtml: (str: string) => string;
}

export function buildMarkdownItOptions(config: MarkdownItConfig): Record<string, unknown> {
  return {
    html: true,
    breaks: config.breaks,
    highlight: buildHighlightCallback(config.hljs, config.escapeHtml),
  };
}

interface PlantumlConfig {
  frontmatterOpenMarker: string | undefined;
  frontmatterCloseMarker: string | undefined;
  settingsOpenMarker: string;
  settingsCloseMarker: string;
  server: string;
}

export function buildPlantumlOptions(config: PlantumlConfig): { openMarker: string; closeMarker: string; server: string } {
  return {
    openMarker: config.frontmatterOpenMarker || config.settingsOpenMarker || '@startuml',
    closeMarker: config.frontmatterCloseMarker || config.settingsCloseMarker || '@enduml',
    server: config.server,
  };
}

interface HtmlViewDataConfig {
  title: string;
  style: string;
  content: string;
  mermaidServer: string;
}

export function buildHtmlViewData(config: HtmlViewDataConfig): { title: string; style: string; content: string; mermaid: string } {
  return {
    title: config.title,
    style: config.style,
    content: config.content,
    mermaid: '<script src="' + config.mermaidServer + '"></script>',
  };
}

export function renderTemplate(template: string, view: Record<string, string>): string {
  return template.replace(/\{\{\{(\w+)\}\}\}/g, function (match: string, key: string): string {
    return key in view ? view[key] : match;
  });
}

export function resolveExportTypes(optionType: string | undefined, configuredType: string[] | string | undefined): string[] | null {
  const typesFormat = ['html', 'pdf', 'png', 'jpeg'];

  if (typesFormat.indexOf(optionType as string) >= 0) {
    return [optionType as string];
  }

  if (optionType === 'settings') {
    const resolved = configuredType || 'pdf';
    if (Array.isArray(resolved)) {
      return resolved;
    }
    return [resolved];
  }

  if (optionType === 'all') {
    return typesFormat;
  }

  return null;
}

export function transformImageHref(href: string, type: string, filename: string): string {
  if (type === 'html') {
    return decodeURIComponent(href).replace(/("|')/g, '');
  }
  return convertImgPath(href, filename);
}

export function transformHtmlBlockImages(html: string, filename: string): string {
  if (!html) {
    return '';
  }
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    return tag.replace(/(\s)src\s*=\s*(["'])(.*?)\2/i, (match, whitespace, quote, src) => {
      const href = convertImgPath(src, filename);
      return `${whitespace}src=${quote}${href}${quote}`;
    });
  });
}

export function buildEmojiTag(emoji: string, emojiData: string | undefined | null): string {
  if (emojiData) {
    return '<img class="emoji" alt="' + emoji + '" src="data:image/png;base64,' + emojiData + '" />';
  }
  return ':' + emoji + ':';
}

export function buildContainerRenderer(): { validate: (name: string) => number; render: (tokens: Array<{ info: string }>, idx: number) => string } {
  return {
    validate: function (name: string): number {
      return name.trim().length;
    },
    render: function (tokens: Array<{ info: string }>, idx: number): string {
      if (tokens[idx].info.trim() !== '') {
        return '<div class="' + tokens[idx].info.trim() + '">\n';
      }
      return '</div>\n';
    },
  };
}

export function generateTmpHtmlFilename(filename: string): string {
  const f = path.parse(filename);
  return path.join(f.dir, f.name + '_tmp.html');
}
