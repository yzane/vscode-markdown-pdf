import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderMath } from '../../src/math-renderer';
import * as logger from '../../src/logger';

describe('renderMath', () => {
  it('should render inline math as a <span class="katex"> element', () => {
    const html = renderMath('E = mc^2', false, {});
    assert.match(html, /<span class="katex">/);
    assert.doesNotMatch(html, /<span class="katex-display">/);
  });

  it('should render block math as a <span class="katex-display"> element', () => {
    const html = renderMath('E = mc^2', true, {});
    assert.match(html, /<span class="katex-display">/);
  });

  it('should expand user macros when provided', () => {
    const html = renderMath('\\RR', false, { macros: { '\\RR': '\\mathbb{R}' } });
    assert.match(html, /mathbb|mathbb\{R\}|R/);
  });

  it('should render invalid TeX with KaTeX error styling, not a <code> fallback', () => {
    // With throwOnError: false (the renderer default), KaTeX does NOT throw for
    // parse errors like \foo; it renders the unknown command inline with the
    // configured errorColor. The <code> fallback is only for runtime exceptions
    // (tested separately below).
    // If renderMath throws, the following assignment fails the test; no
    // separate doesNotThrow assertion is needed. KaTeX 0.16 emits the
    // offending token as a span styled with errorColor (#cc0000 is what
    // renderMath passes in).
    const html = renderMath('\\foo', false, {});
    assert.match(html, /color\s*:\s*#cc0000/);
    assert.doesNotMatch(html, /^<code>/);
  });

  it('should fall back to a <code> block when katex.renderToString throws', () => {
    // Passing a non-string triggers a runtime TypeError inside KaTeX even with
    // throwOnError: false, exercising the defensive catch block in renderMath.
    const html = renderMath(undefined as unknown as string, false, {});
    assert.match(html, /^<code>/);
  });

  it('should not throw on empty input', () => {
    assert.doesNotThrow(() => renderMath('', false, {}));
    assert.doesNotThrow(() => renderMath('', true, {}));
  });

  it('logs a warning via logger when falling back to <code>', () => {
    const calls: unknown[][] = [];
    logger.setLogSink({ info() {}, warn: (...a: unknown[]) => { calls.push(a); }, error() {}, show() {} });
    try {
      renderMath(undefined as unknown as string, false, {});
      assert.equal(calls.length, 1);
      assert.match(String(calls[0][0]), /KaTeX render failure/);
    } finally {
      logger.setLogSink(undefined);
    }
  });
});
