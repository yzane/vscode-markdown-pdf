// Installs html_block / html_inline renderer rules that sanitize raw HTML via
// utils.sanitizeRawHtml, accumulating a removal/strip report. Kept free of any
// 'vscode' import so it stays unit-testable with markdown-it under tsx.
import type MarkdownIt from 'markdown-it';
import { sanitizeRawHtml, SanitizeMode, SanitizeReport } from './utils';

export function installSanitizeRules(
  md: MarkdownIt,
  mode: SanitizeMode,
  report: SanitizeReport,
  transformBlock?: (html: string) => string,
): void {
  function collect(content: string, removeWithContent: boolean): string {
    const result = sanitizeRawHtml(content, mode, { removeWithContent: removeWithContent });
    report.removedElements.push(...result.report.removedElements);
    report.strippedAttributes.push(...result.report.strippedAttributes);
    return result.html;
  }

  md.renderer.rules.html_block = function (tokens, idx) {
    // Block context: remove style/script/iframe with their content.
    const html = collect(tokens[idx].content, true);
    return transformBlock ? transformBlock(html) : html;
  };

  md.renderer.rules.html_inline = function (tokens, idx) {
    // Inline context: open/content/close are separate tokens, so only escape.
    return collect(tokens[idx].content, false);
  };
}
