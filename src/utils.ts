// Shared helpers for the markdown-pdf extension: file I/O, path and URL
// resolution, HTML/CSS assembly, and option builders for markdown-it and
// Puppeteer.
import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import type { HLJSApi } from 'highlight.js';
import plantumlEncoder from 'plantuml-encoder';
import { githubSlugify } from './markdown-it-named-headers';
import { logWarn, formatError } from './logger';

/** Returns `a` when `a` is a defined boolean (including false); otherwise returns `b`. */
export function setBooleanValue(a: boolean | undefined | null, b: boolean | undefined): boolean | undefined {
  if (a === false) {
    return false;
  } else {
    return a || b;
  }
}

/** Checks whether a path exists, logging and returning false on any fs error. */
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

/** Checks whether a path exists and is a directory, logging and returning false otherwise. */
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

/** Generates a GitHub-compatible slug from a heading title. */
export function Slug(string: string): string {
  return githubSlugify(string);
}

/** Substitutes %%ISO-DATETIME%%, %%ISO-DATE%%, and %%ISO-TIME%% placeholders with the current values. */
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

/**
 * Reads a file synchronously, stripping file:// URI prefixes beforehand.
 * Returns '' on any I/O failure; warnings are logged via logWarn (not-found vs read-error) and errors are never re-thrown.
 */
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
  try {
    return fs.readFileSync(filename, encode);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      logWarn(`File not found: ${filename}`);
    } else {
      logWarn(`Failed to read file: ${filename}`, formatError(error));
    }
    return '';
  }
}

/** Reads a CSS file and wraps its contents in a <style> tag, or returns '' when the file is empty. */
export function makeCss(filename: string): string {
  const css = readFile(filename);
  if (css) {
    return '\n<style>\n' + css + '\n</style>\n';
  } else {
    return '';
  }
}

const KATEX_FONT_MIME: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

/**
 * Builds an inline <style> tag for KaTeX CSS with every url(fonts/...)
 * reference rewritten to a base64 data: URI. Produces a fully self-contained
 * stylesheet so the generated HTML stays portable when copied or moved.
 * Returns '' when the KaTeX CSS file is not present at the expected location.
 */
export function buildKatexStyleTag(baseDir: string): string {
  const cssPath = path.join(baseDir, 'styles', 'katex', 'katex.min.css');
  const rawCss = readFile(cssPath);
  if (typeof rawCss !== 'string' || !rawCss) {
    return '';
  }
  const katexDir = path.join(baseDir, 'styles', 'katex');
  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const inlined = rawCss.replace(urlRe, function (match, _quote, href: string) {
    // Skip URLs that are already absolute or data: URIs.
    if (/^(data:|https?:|file:)/i.test(href)) {
      return match;
    }
    const normalized = href.replace(/^\.\//, '').split('?')[0].split('#')[0];
    const fontPath = path.join(katexDir, normalized);
    // Guard against path traversal: only allow files below styles/katex/.
    const relative = path.relative(katexDir, fontPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return match;
    }
    if (!isExistsPath(fontPath)) {
      return match;
    }
    const ext = path.extname(fontPath).toLowerCase();
    const mime = KATEX_FONT_MIME[ext];
    if (!mime) {
      return match;
    }
    const buffer = fs.readFileSync(fontPath);
    const base64 = buffer.toString('base64');
    return 'url(data:' + mime + ';base64,' + base64 + ')';
  });
  return '\n<style>\n' + inlined + '\n</style>\n';
}

/** Resolves an image src to an absolute file:// URL, or returns the original src for remote URLs. */
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

/** Returns true when filename matches any of the given regex pattern strings. */
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

/** Resolves a style href to an absolute file:// URL, leaving http/https/data URLs untouched. */
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

/**
 * Resolves the output directory for a converted file.
 * Returns null when a configured absolute outputDirectory does not exist.
 */
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

/** Builds the concatenated <style> and <link> tags for default, highlight, and user styles. */
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
  outline: boolean;
}

/** Builds the options object passed to Puppeteer's page.pdf() call. */
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
    outline: config.outline,
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

/** Builds the options object passed to Puppeteer's page.screenshot() call. */
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

/**
 * Replaces heading tags (h1-h6) with div tags if they are outside the specified range
 * or before the specified start marker.
 * This is used to exclude certain heading levels from the PDF outline.
 */
export function filterHeadingLevels(html: string, from: number, to: number, startMarker?: string): string {
  let startIndex = 0;
  if (startMarker) {
    const markerIndex = html.indexOf(startMarker);
    if (markerIndex !== -1) {
      startIndex = markerIndex + startMarker.length;
    }
  }

  const headingRegex = /<h([1-6])(.*?)>([\s\S]*?)<\/h\1>/gi;
  return html.replace(headingRegex, (match, level, attrs, content, offset) => {
    const l = parseInt(level);
    const isOutOfRange = l < from || l > to;
    const isBeforeStart = offset < startIndex;

    if (isOutOfRange || isBeforeStart) {
      return `<div class="h${l}"${attrs}>${content}</div>`;
    }
    return match;
  });
}

/** Returns a markdown-it highlight callback that renders mermaid blocks as <div> and other languages via highlight.js. */
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

/** Builds the options object passed to the markdown-it constructor. */
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

/** Builds the options object passed to the markdown-it-plantuml plugin. */
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

/** Builds the view model passed to the HTML template renderer. */
export function buildHtmlViewData(config: HtmlViewDataConfig): { title: string; style: string; content: string; mermaid: string } {
  return {
    title: config.title,
    style: config.style,
    content: config.content,
    mermaid: '<script src="' + config.mermaidServer + '"></script>',
  };
}

/** Substitutes {{{key}}} placeholders in a template with matching values from view. */
export function renderTemplate(template: string, view: Record<string, string>): string {
  return template.replace(/\{\{\{(\w+)\}\}\}/g, function (match: string, key: string): string {
    return key in view ? view[key] : match;
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Parses YAML front matter from a markdown string, tolerating a leading BOM
 * and an empty front matter block. Returns an empty data object when YAML is
 * missing, empty, or not a plain object.
 */
export function parseFrontMatter(text: string): { data: Record<string, unknown>; content: string } {
  const match = text.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    const emptyMatch = text.match(/^(?:\uFEFF)?---\r?\n---(?:\r?\n|$)([\s\S]*)$/);
    if (emptyMatch) {
      return { data: {}, content: emptyMatch[1] };
    }
    return { data: {}, content: text };
  }
  const yamlStr = match[1];
  const content = match[2];
  if (!yamlStr.trim()) {
    return { data: {}, content: content };
  }
  const data = yaml.load(yamlStr);
  return {
    data: isPlainRecord(data) ? data : {},
    content: content,
  };
}

/** Resolves the requested export types from an option string and the configured default, or null for an unsupported type. */
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

/** Transforms an image href for the given export type: decoded for html, absolute file:// for others. */
export function transformImageHref(href: string, type: string, filename: string): string {
  if (type === 'html') {
    return decodeURIComponent(href).replace(/("|')/g, '');
  }
  return convertImgPath(href, filename);
}

/**
 * Transforms raw HTML blocks for non-html export types:
 * - Rewrites src attributes of <img> tags to absolute file:// URLs
 * - Normalizes self-closing non-void elements to open/close pairs
 *
 * Skips content inside comments, <script>, <style>, and <textarea>.
 * Uses a hand-rolled scanner to avoid pulling in a full HTML parsing dependency.
 */
export function transformHtmlBlock(html: string, filename: string): string {
  if (!html) {
    return '';
  }
  let result = '';
  let index = 0;
  while (index < html.length) {
    if (html.startsWith('<!--', index)) {
      const commentEnd = html.indexOf('-->', index + 4);
      if (commentEnd === -1) {
        return result + html.slice(index);
      }
      result += html.slice(index, commentEnd + 3);
      index = commentEnd + 3;
      continue;
    }

    if (html[index] !== '<') {
      result += html[index];
      index++;
      continue;
    }

    const tagEnd = findHtmlTagEnd(html, index + 1);
    if (tagEnd === -1) {
      return result + html.slice(index);
    }

    const tag = html.slice(index, tagEnd + 1);
    const tagName = getTagName(tag);
    if (tagName && isOpeningTag(tag) && isRawTextElement(tagName)) {
      const rawTextEnd = findRawTextElementEnd(html, tagEnd + 1, tagName);
      if (rawTextEnd === -1) {
        return result + html.slice(index);
      }
      result += html.slice(index, rawTextEnd);
      index = rawTextEnd;
      continue;
    }

    result += isRealImgTag(tag) ? transformImgTag(tag, filename) : normalizeSelfClosingTag(tag);
    index = tagEnd + 1;
  }
  return result;
}

function findHtmlTagEnd(html: string, startIndex: number): number {
  let quote: string | null = null;
  for (let i = startIndex; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return i;
    }
  }
  return -1;
}

function isRealImgTag(tag: string): boolean {
  return /^<img(?=[\s/>])/i.test(tag);
}

function getTagName(tag: string): string | null {
  const match = /^<\/?\s*([a-z0-9-]+)/i.exec(tag);
  return match ? match[1].toLowerCase() : null;
}

function isOpeningTag(tag: string): boolean {
  return /^<\s*[a-z0-9-]/i.test(tag);
}

function isRawTextElement(tagName: string | null): boolean {
  return tagName === 'script' || tagName === 'style' || tagName === 'textarea';
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr',
  'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);

function normalizeSelfClosingTag(tag: string): string {
  if (!tag.endsWith('/>')) {
    return tag;
  }
  const tagName = getTagName(tag);
  if (!tagName || VOID_ELEMENTS.has(tagName)) {
    return tag;
  }
  return tag.slice(0, -2).trimEnd() + '></' + tagName + '>';
}

function findRawTextElementEnd(html: string, startIndex: number, tagName: string): number {
  const closingPattern = new RegExp(`</${escapeRegExp(tagName)}\\s*>`, 'i');
  const match = closingPattern.exec(html.slice(startIndex));
  if (!match) {
    return -1;
  }
  return startIndex + match.index + match[0].length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function transformImgTag(tag: string, filename: string): string {
  let result = '';
  let i = 0;
  while (i < tag.length) {
    const char = tag[i];
    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      i++;
      while (i < tag.length && tag[i] !== quote) {
        i++;
      }
      if (i < tag.length) {
        i++;
      }
      result += tag.slice(start, i);
      continue;
    }

    if (/\s/.test(char) || char === '/' || char === '>') {
      result += char;
      i++;
      continue;
    }

    const attributeStart = i;
    while (i < tag.length && !/\s|=|\/|>/.test(tag[i])) {
      i++;
    }
    const name = tag.slice(attributeStart, i);
    const lowerName = name.toLowerCase();

    let whitespaceBeforeEquals = '';
    while (i < tag.length && /\s/.test(tag[i])) {
      whitespaceBeforeEquals += tag[i];
      i++;
    }

    if (i >= tag.length || tag[i] !== '=') {
      result += tag.slice(attributeStart, i);
      continue;
    }

    i++;
    let whitespaceAfterEquals = '';
    while (i < tag.length && /\s/.test(tag[i])) {
      whitespaceAfterEquals += tag[i];
      i++;
    }

    const valueStart = i;
    let value = '';
    if (i < tag.length && (tag[i] === '"' || tag[i] === "'")) {
      const quote = tag[i];
      i++;
      const quotedValueStart = i;
      while (i < tag.length && tag[i] !== quote) {
        i++;
      }
      value = tag.slice(quotedValueStart, i);
      if (i < tag.length) {
        i++;
      }
    } else {
      while (i < tag.length && !/\s|>/.test(tag[i])) {
        i++;
      }
      value = tag.slice(valueStart, i);
    }

    if (lowerName === 'src') {
      const href = convertImgPath(value, filename);
      result += `${name}${whitespaceBeforeEquals}=${whitespaceAfterEquals}"${href}"`;
    } else {
      result += tag.slice(attributeStart, i);
    }
  }
  return result;
}

/** Builds an <img> tag carrying a base64-encoded emoji, or a ':name:' fallback when emoji data is missing. */
export function buildEmojiTag(emoji: string, emojiData: string | undefined | null): string {
  if (emojiData) {
    return '<img class="emoji" alt="' + emoji + '" src="data:image/png;base64,' + emojiData + '" />';
  }
  return ':' + emoji + ':';
}

/** Returns validate and render callbacks for the markdown-it-container plugin. */
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

/** Generates a temporary html filename derived from the source markdown filename. */
export function generateTmpHtmlFilename(filename: string): string {
  const f = path.parse(filename);
  return path.join(f.dir, f.name + '_tmp.html');
}

/**
 * Builds an <img> tag for a PlantUML source string. Produces the same
 * structural <img> format as markdown-it-plantuml (same server, /svg/
 * endpoint, alt="uml diagram") so that both the @startuml/@enduml path
 * and the ```plantuml fence path render equivalent diagrams.
 */
export function buildPlantumlImgTag(source: string, server: string): string {
  const encoded = plantumlEncoder.encode(source);
  return '<img src="' + server + '/svg/' + encoded + '" alt="uml diagram">';
}

// Sanitize mode for raw HTML in Markdown. 'gfm' removes dangerous tags per
// GitHub Flavored Markdown; 'gfm-allow-style' keeps <style>; 'none' disables.
export type SanitizeMode = 'gfm' | 'gfm-allow-style' | 'none';

export interface SanitizeReport {
  // Tag names of block-level elements removed with their content (one entry per occurrence).
  removedElements: string[];
  // Identifiers of attributes stripped (e.g. 'onclick', 'href(javascript:)'), one per occurrence.
  strippedAttributes: string[];
}

export interface SanitizeOptions {
  // true = block context: remove style/script/iframe with their content.
  // false/omitted = inline context: escape them like the other disallowed tags.
  removeWithContent?: boolean;
}

// Disallowed tags removed with their content (block context only). They render as
// noise or are unsafe in a PDF: <style>/<script> dump text; <iframe> cannot function.
const REMOVE_WITH_CONTENT = new Set(['style', 'script', 'iframe']);

function stripDangerousAttributes(tag: string): { tag: string; stripped: string[] } {
  const stripped: string[] = [];
  // Skip closing tags and bail out cheaply on malformed input.
  if (tag.length < 2 || tag[1] === '/') {
    return { tag, stripped };
  }

  let nameEnd = 1;
  while (nameEnd < tag.length && /[a-z0-9-]/i.test(tag[nameEnd])) {
    nameEnd++;
  }

  let result = tag.slice(0, nameEnd);
  let i = nameEnd;
  while (i < tag.length) {
    const wsStart = i;
    while (i < tag.length && /\s/.test(tag[i])) {
      i++;
    }
    const ws = tag.slice(wsStart, i);

    if (i >= tag.length) {
      result += ws;
      break;
    }

    if (tag[i] === '/' || tag[i] === '>') {
      result += ws;
      result += tag[i];
      i++;
      continue;
    }

    const attrStart = i;
    while (i < tag.length && !/[\s=/>]/.test(tag[i])) {
      i++;
    }
    const attrName = tag.slice(attrStart, i);

    let afterName = i;
    while (afterName < tag.length && /\s/.test(tag[afterName])) {
      afterName++;
    }

    let attrEnd = afterName;
    let attrValue: string | null = null;
    if (afterName < tag.length && tag[afterName] === '=') {
      let valueStart = afterName + 1;
      while (valueStart < tag.length && /\s/.test(tag[valueStart])) {
        valueStart++;
      }
      if (valueStart < tag.length && (tag[valueStart] === '"' || tag[valueStart] === "'")) {
        const quote = tag[valueStart];
        const close = tag.indexOf(quote, valueStart + 1);
        if (close === -1) {
          attrValue = tag.slice(valueStart + 1);
          attrEnd = tag.length;
        } else {
          attrValue = tag.slice(valueStart + 1, close);
          attrEnd = close + 1;
        }
      } else {
        let valueEnd = valueStart;
        while (valueEnd < tag.length && !/[\s/>]/.test(tag[valueEnd])) {
          valueEnd++;
        }
        attrValue = tag.slice(valueStart, valueEnd);
        attrEnd = valueEnd;
      }
    }

    const lowerName = attrName.toLowerCase();
    const isEventHandler = /^on[a-z]{3}/i.test(lowerName);
    const isJavascriptUrl =
      (lowerName === 'href' || lowerName === 'src') &&
      attrValue !== null &&
      /^\s*javascript:/i.test(attrValue);

    if (!isEventHandler && !isJavascriptUrl) {
      result += ws;
      result += attrName;
      if (attrEnd > afterName) {
        result += tag.slice(i, attrEnd);
      }
    } else {
      // Record what was stripped for the sanitize report.
      stripped.push(isEventHandler ? lowerName : lowerName + '(javascript:)');
    }
    i = attrEnd;
  }
  return { tag: result, stripped };
}

/**
 * Returns the set of lowercase tag names to strip for the given sanitize mode.
 * See GFM 6.11 Disallowed Raw HTML extension:
 * https://github.github.com/gfm/#disallowed-raw-html-extension-
 */
export function getDisallowedTags(mode: SanitizeMode): Set<string> {
  if (mode === 'none') {
    return new Set();
  }
  const tags = new Set(['title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'script', 'plaintext']);
  if (mode === 'gfm-allow-style') {
    tags.delete('style');
  }
  return tags;
}

/**
 * Sanitizes raw HTML per GFM's disallowed raw HTML extension, returning the
 * sanitized string and a report of what was neutralized.
 * - With `options.removeWithContent` (block context): <style>/<script>/<iframe>
 *   are removed together with their content; other disallowed tags are escaped.
 * - Without it (inline context, default): all disallowed tags have their leading
 *   '<' escaped to '&lt;' (content preserved as text).
 * - on* event handlers and href/src="javascript:..." attributes are stripped from
 *   non-disallowed tags. HTML comments are preserved verbatim.
 * Returns the input unchanged with an empty report when mode is 'none' or input is empty.
 */
export function sanitizeRawHtml(
  html: string,
  mode: SanitizeMode,
  options?: SanitizeOptions,
): { html: string; report: SanitizeReport } {
  const report: SanitizeReport = { removedElements: [], strippedAttributes: [] };
  if (mode === 'none' || !html) {
    return { html, report };
  }
  const removeWithContent = options?.removeWithContent === true;
  const disallowed = getDisallowedTags(mode);
  let result = '';
  let index = 0;
  while (index < html.length) {
    // Preserve HTML comments verbatim.
    if (html.startsWith('<!--', index)) {
      const commentEnd = html.indexOf('-->', index + 4);
      if (commentEnd === -1) {
        result += html.slice(index);
        break;
      }
      result += html.slice(index, commentEnd + 3);
      index = commentEnd + 3;
      continue;
    }

    if (html[index] !== '<') {
      result += html[index];
      index++;
      continue;
    }

    const tagEnd = findHtmlTagEnd(html, index + 1);
    if (tagEnd === -1) {
      result += html.slice(index);
      break;
    }

    const tag = html.slice(index, tagEnd + 1);
    const tagName = getTagName(tag);

    if (tagName && disallowed.has(tagName)) {
      if (removeWithContent && REMOVE_WITH_CONTENT.has(tagName)) {
        if (tag[1] === '/') {
          // Stray closing tag of a remove-set element: drop silently.
          index = tagEnd + 1;
          continue;
        }
        // Opening tag: remove through the matching closing tag (inclusive).
        // tagName comes from REMOVE_WITH_CONTENT (style/script/iframe) — no regex
        // metacharacters, so interpolating it directly is safe.
        const closeRe = new RegExp('</' + tagName + '\\s*>', 'i');
        const match = closeRe.exec(html.slice(tagEnd + 1));
        if (match) {
          index = tagEnd + 1 + match.index + match[0].length;
        } else {
          // No closing tag in this token: drop just the opening tag (graceful degrade).
          index = tagEnd + 1;
        }
        report.removedElements.push(tagName);
        continue;
      }
      // Escape set, or remove-set in inline context: GFM escape of leading '<'.
      result += '&lt;' + tag.slice(1);
      index = tagEnd + 1;
      continue;
    }

    const stripResult = stripDangerousAttributes(tag);
    result += stripResult.tag;
    report.strippedAttributes.push(...stripResult.stripped);
    index = tagEnd + 1;
  }
  return { html: result, report };
}

// Counts occurrences of each string, preserving first-seen order.
function tallyOccurrences(items: string[]): Array<{ name: string; count: number }> {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!counts.has(item)) {
      order.push(item);
    }
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return order.map(function (name) {
    // name is always present in counts here (it was added to `order` on first sight).
    return { name: name, count: counts.get(name)! };
  });
}

// Short, human-facing summary for the warning toast (no counts; kinds only).
export function buildSanitizeSummary(report: SanitizeReport): string {
  const parts: string[] = [];
  const removedKinds = tallyOccurrences(report.removedElements).map(function (e) {
    return '<' + e.name + '>';
  });
  if (removedKinds.length > 0) {
    parts.push('removed ' + removedKinds.join(', '));
  }
  if (report.strippedAttributes.length > 0) {
    parts.push('stripped unsafe attribute(s)');
  }
  // Fall back to a generic phrase for an empty report so the sentence stays well-formed
  // (the only caller guards against empty, but keep the function safe in isolation).
  const body = parts.length > 0 ? parts.join('; ') : 'sanitized raw HTML';
  return 'Markdown PDF: ' + body + ' for security. See output for details.';
}

// Detailed line(s) for the output channel, including mode and per-kind counts.
export function buildSanitizeLogDetail(report: SanitizeReport, mode: SanitizeMode): string {
  const segments: string[] = [];
  const removed = tallyOccurrences(report.removedElements).map(function (e) {
    return '<' + e.name + '>×' + e.count;
  });
  const stripped = tallyOccurrences(report.strippedAttributes).map(function (e) {
    return e.name + '×' + e.count;
  });
  if (removed.length > 0) {
    segments.push('removed ' + removed.join(', '));
  }
  if (stripped.length > 0) {
    segments.push('stripped ' + stripped.join(', '));
  }
  const head = 'Sanitized raw HTML (mode: ' + mode + ')';
  const lines: string[] = [segments.length > 0 ? head + ': ' + segments.join('; ') + '.' : head + '.'];
  if (report.removedElements.indexOf('style') !== -1) {
    lines.push('Tip: to keep <style>, set "markdown-pdf.sanitize": "gfm-allow-style".');
  }
  return lines.join('\n');
}

export type AwaitWithTimeoutResult<T> =
  | { timedOut: false; value: T }
  | { timedOut: true };

export async function awaitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<AwaitWithTimeoutResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const observedPromise = promise.catch((error) => {
    if (timedOut) {
      return undefined as T;
    }
    throw error;
  });

  try {
    const timeoutPromise = new Promise<AwaitWithTimeoutResult<T>>((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        resolve({ timedOut: true });
      }, timeoutMs);
    });

    const valuePromise = observedPromise.then((value): AwaitWithTimeoutResult<T> => {
      return { timedOut: false, value };
    });

    return await Promise.race([valuePromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
