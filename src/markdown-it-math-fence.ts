import type MarkdownIt from 'markdown-it';
import { renderMath, RenderMathOptions } from './math-renderer';

export interface MathFencePluginOptions extends RenderMathOptions {}

/**
 * markdown-it plugin: overrides md.renderer.rules.fence so that a
 * ```math fenced code block is rendered via KaTeX in display mode.
 * For any other info string the previous fence renderer (or renderToken)
 * is used, so this plugin composes with other fence-handling plugins
 * (e.g. the PlantUML fence renderer already installed in extension.ts).
 */
export function mathFencePlugin(md: MarkdownIt, options: MathFencePluginOptions): void {
  const previousFenceRenderer = md.renderer.rules.fence;

  md.renderer.rules.fence = function (tokens, idx, mdOptions, env, self) {
    const token = tokens[idx];
    if (token.info.trim().toLowerCase() === 'math') {
      return renderMath(token.content, true, options);
    }
    if (previousFenceRenderer) {
      return previousFenceRenderer(tokens, idx, mdOptions, env, self);
    }
    return self.renderToken(tokens, idx, mdOptions);
  };
}
