// PDF page options shared by one-click export and the preview panel.
// This module does not import VS Code or Chromium so unit tests can exercise it directly.
import type { PdfConfig } from './utils';

export const PAPER_FORMATS = [
  'Letter',
  'Legal',
  'Tabloid',
  'Ledger',
  'A0',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
] as const;

// Keep these identical to the package.json defaults so preset detection matches Settings.
export const FILENAME_AND_DATE_HEADER =
  "<div style=\"font-size: 9px; margin-left: 1cm;\"> <span class='title'></span></div> <div style=\"font-size: 9px; margin-left: auto; margin-right: 1cm; \">%%ISO-DATE%%</div>";

export const PAGE_NUMBER_FOOTER =
  "<div style=\"font-size: 9px; margin: 0 auto;\"> <span class='pageNumber'></span> / <span class='totalPages'></span></div>";

export type HeaderChoice = 'none' | 'filename-date' | 'custom';
export type FooterChoice = 'none' | 'page-numbers' | 'custom';

export interface PdfPageSettings {
  width?: string;
  height?: string;
  format?: string;
  orientation?: string;
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  pageRanges?: string;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export interface PdfPreviewForm {
  format: string;
  width: string;
  height: string;
  orientation: 'portrait' | 'landscape';
  scale: number;
  displayHeaderFooter: boolean;
  headerChoice: HeaderChoice;
  headerCustom: string;
  footerChoice: FooterChoice;
  footerCustom: string;
  printBackground: boolean;
  pageRanges: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
}

function marginValue(margin: PdfPageSettings['margin'], side: 'top' | 'right' | 'bottom' | 'left'): string {
  const value = margin ? margin[side] : '';
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: boolean | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asScale(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
}

/** Maps the markdown-pdf page settings into the config consumed by buildPdfOptions. */
export function readPdfPageOptions(settings: PdfPageSettings): Omit<PdfConfig, 'path'> {
  return {
    width: settings.width || '',
    height: settings.height || '',
    format: settings.format || 'A4',
    orientation: settings.orientation || '',
    scale: asScale(settings.scale),
    displayHeaderFooter: asBoolean(settings.displayHeaderFooter, true),
    headerTemplate: settings.headerTemplate || '',
    footerTemplate: settings.footerTemplate || '',
    printBackground: asBoolean(settings.printBackground, true),
    pageRanges: settings.pageRanges || '',
    margin: {
      top: marginValue(settings.margin, 'top'),
      right: marginValue(settings.margin, 'right'),
      bottom: marginValue(settings.margin, 'bottom'),
      left: marginValue(settings.margin, 'left'),
    },
  };
}

function classifyHeader(template: string): { choice: HeaderChoice; custom: string } {
  const trimmed = template.trim();
  if (trimmed === '') {
    return { choice: 'none', custom: '' };
  }
  if (trimmed === FILENAME_AND_DATE_HEADER.trim()) {
    return { choice: 'filename-date', custom: '' };
  }
  return { choice: 'custom', custom: template };
}

function classifyFooter(template: string): { choice: FooterChoice; custom: string } {
  const trimmed = template.trim();
  if (trimmed === '') {
    return { choice: 'none', custom: '' };
  }
  if (trimmed === PAGE_NUMBER_FOOTER.trim()) {
    return { choice: 'page-numbers', custom: '' };
  }
  return { choice: 'custom', custom: template };
}

/** Builds the preview form from current settings. Unknown templates stay on Custom. */
export function settingsToForm(settings: PdfPageSettings): PdfPreviewForm {
  const options = readPdfPageOptions(settings);
  const header = classifyHeader(options.headerTemplate);
  const footer = classifyFooter(options.footerTemplate);
  return {
    format: options.format,
    width: options.width,
    height: options.height,
    orientation: options.orientation === 'landscape' ? 'landscape' : 'portrait',
    scale: options.scale,
    displayHeaderFooter: options.displayHeaderFooter,
    headerChoice: header.choice,
    headerCustom: header.custom,
    footerChoice: footer.choice,
    footerCustom: footer.custom,
    printBackground: options.printBackground,
    pageRanges: options.pageRanges,
    marginTop: options.margin.top,
    marginRight: options.margin.right,
    marginBottom: options.margin.bottom,
    marginLeft: options.margin.left,
  };
}

export function resolveHeaderTemplate(form: PdfPreviewForm): string {
  if (form.headerChoice === 'none') {
    return '';
  }
  if (form.headerChoice === 'filename-date') {
    return FILENAME_AND_DATE_HEADER;
  }
  return form.headerCustom || '';
}

export function resolveFooterTemplate(form: PdfPreviewForm): string {
  if (form.footerChoice === 'none') {
    return '';
  }
  if (form.footerChoice === 'page-numbers') {
    return PAGE_NUMBER_FOOTER;
  }
  return form.footerCustom || '';
}

/** Turns the preview form into PDF options. A header preset does not change the footer, and the reverse. */
export function formToPdfConfig(form: PdfPreviewForm): Omit<PdfConfig, 'path'> {
  return {
    width: form.width.trim(),
    height: form.height.trim(),
    format: form.format || 'A4',
    orientation: form.orientation === 'landscape' ? 'landscape' : 'portrait',
    scale: asScale(form.scale),
    displayHeaderFooter: form.displayHeaderFooter === true,
    headerTemplate: resolveHeaderTemplate(form),
    footerTemplate: resolveFooterTemplate(form),
    printBackground: form.printBackground === true,
    pageRanges: form.pageRanges.trim(),
    margin: {
      top: form.marginTop.trim(),
      right: form.marginRight.trim(),
      bottom: form.marginBottom.trim(),
      left: form.marginLeft.trim(),
    },
  };
}

function isHeaderChoice(value: unknown): value is HeaderChoice {
  return value === 'none' || value === 'filename-date' || value === 'custom';
}

function isFooterChoice(value: unknown): value is FooterChoice {
  return value === 'none' || value === 'page-numbers' || value === 'custom';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

const LENGTH_PATTERN = /^(\d+(\.\d+)?)(mm|cm|in|px)$/i;
const LENGTH_HINT = 'Use a number and a unit: mm, cm, in, or px.';

export interface PreviewFieldErrors {
  width?: string;
  height?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  scale?: string;
  pageRanges?: string;
  headerCustom?: string;
  footerCustom?: string;
}

function isValidPageRanges(value: string): boolean {
  const pieces = value.split(',');
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i].trim();
    const match = /^(\d+)(?:-(\d+)?)?$/.exec(piece);
    if (!match) {
      return false;
    }
    const start = Number(match[1]);
    if (start < 1) {
      return false;
    }
    if (match[2]) {
      const end = Number(match[2]);
      if (end < start) {
        return false;
      }
    }
  }
  return pieces.length > 0;
}

/** Field errors for the preview form. An empty object means the form can be rendered. */
export function validatePreviewForm(form: PdfPreviewForm): PreviewFieldErrors {
  const errors: PreviewFieldErrors = {};
  const width = form.width.trim();
  const height = form.height.trim();
  if (width !== '' && !LENGTH_PATTERN.test(width)) {
    errors.width = LENGTH_HINT;
  }
  if (height !== '' && !LENGTH_PATTERN.test(height)) {
    errors.height = LENGTH_HINT;
  }
  if ((width === '') !== (height === '')) {
    const pairHint = 'Set both width and height, or leave both empty to use the paper size.';
    if (width === '') {
      errors.width = pairHint;
    }
    if (height === '') {
      errors.height = pairHint;
    }
  }

  const margins: Array<keyof Pick<PreviewFieldErrors, 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft'>> = [
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  ];
  for (let i = 0; i < margins.length; i++) {
    const key = margins[i];
    if (!LENGTH_PATTERN.test(form[key].trim())) {
      errors[key] = LENGTH_HINT;
    }
  }

  if (!Number.isFinite(form.scale) || form.scale < 0.1 || form.scale > 2) {
    errors.scale = 'Scale must be between 0.1 and 2.';
  }

  const pageRanges = form.pageRanges.trim();
  if (pageRanges !== '' && !isValidPageRanges(pageRanges)) {
    errors.pageRanges = 'Use pages like 1-5, 8, 11-13.';
  }

  if (form.displayHeaderFooter) {
    if (form.headerChoice === 'custom' && form.headerCustom.trim() === '') {
      errors.headerCustom = 'Enter header HTML, or choose another header.';
    }
    if (form.footerChoice === 'custom' && form.footerCustom.trim() === '') {
      errors.footerCustom = 'Enter footer HTML, or choose another page-number style.';
    }
  }

  return errors;
}

export function hasPreviewFieldErrors(errors: PreviewFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Accepts a webview message payload, or returns undefined when the shape is not a form. */
export function parsePreviewForm(value: unknown): PdfPreviewForm | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const form = value as Record<string, unknown>;
  const format = form.format;
  const width = form.width;
  const height = form.height;
  const orientation = form.orientation;
  const rawScale = form.scale;
  const displayHeaderFooter = form.displayHeaderFooter;
  const headerChoice = form.headerChoice;
  const headerCustom = form.headerCustom;
  const footerChoice = form.footerChoice;
  const footerCustom = form.footerCustom;
  const printBackground = form.printBackground;
  const pageRanges = form.pageRanges;
  const marginTop = form.marginTop;
  const marginRight = form.marginRight;
  const marginBottom = form.marginBottom;
  const marginLeft = form.marginLeft;
  if (!isString(format) || !isString(width) || !isString(height) || !isString(headerCustom) || !isString(footerCustom)) {
    return undefined;
  }
  if (!isString(pageRanges) || !isString(marginTop) || !isString(marginRight) || !isString(marginBottom) || !isString(marginLeft)) {
    return undefined;
  }
  if (orientation !== 'portrait' && orientation !== 'landscape') {
    return undefined;
  }
  if (!isHeaderChoice(headerChoice) || !isFooterChoice(footerChoice)) {
    return undefined;
  }
  if (typeof displayHeaderFooter !== 'boolean' || typeof printBackground !== 'boolean') {
    return undefined;
  }
  let scale: number;
  if (rawScale === null || (typeof rawScale === 'number' && Number.isNaN(rawScale))) {
    scale = Number.NaN;
  } else if (typeof rawScale === 'number' && Number.isFinite(rawScale)) {
    scale = rawScale;
  } else {
    return undefined;
  }
  return {
    format: format,
    width: width,
    height: height,
    orientation: orientation,
    scale: scale,
    displayHeaderFooter: displayHeaderFooter,
    headerChoice: headerChoice,
    headerCustom: headerCustom,
    footerChoice: footerChoice,
    footerCustom: footerCustom,
    printBackground: printBackground,
    pageRanges: pageRanges,
    marginTop: marginTop,
    marginRight: marginRight,
    marginBottom: marginBottom,
    marginLeft: marginLeft,
  };
}
