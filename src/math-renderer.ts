import katex, { KatexOptions } from 'katex';
import { logWarn } from './logger';

export interface RenderMathOptions extends Pick<KatexOptions, 'macros'> {}

/**
 * Thin wrapper around katex.renderToString that normalizes options and
 * captures any runtime error so an invalid TeX snippet does not break the
 * whole document. On error, returns the original source wrapped in <code>
 * so the user can still see what they wrote.
 */
export function renderMath(tex: string, displayMode: boolean, options: RenderMathOptions): string {
  const katexOptions: KatexOptions = {
    displayMode,
    throwOnError: false,
    errorColor: '#cc0000',
    strict: 'warn',
    trust: false,
    macros: options.macros,
  };
  try {
    return katex.renderToString(tex, katexOptions);
  } catch (error) {
    // Coerce to string defensively: tex may be undefined when called with invalid
    // types (e.g. undefined as unknown as string), so String() avoids a secondary throw.
    const escaped = escapeHtml(String(tex ?? ''));
    logWarn('KaTeX render failure, falling back to <code>: ' + (error as Error).message);
    return '<code>' + escaped + '</code>';
  }
}

function escapeHtml(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
