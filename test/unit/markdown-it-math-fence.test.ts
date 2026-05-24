import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import MarkdownIt from 'markdown-it';
import { mathFencePlugin } from '../../src/markdown-it-math-fence';

function makeMd() {
  const md = new MarkdownIt();
  md.use(mathFencePlugin, { macros: {} });
  return md;
}

describe('mathFencePlugin', () => {
  it('should render ```math fences through KaTeX (block mode)', () => {
    const html = makeMd().render('```math\nE = mc^2\n```\n');
    assert.match(html, /<span class="katex-display">/);
    assert.doesNotMatch(html, /<pre><code class="language-math">/);
  });

  it('should fall back to default fence renderer for non-math languages', () => {
    const html = makeMd().render('```js\nconst x = 1;\n```\n');
    assert.match(html, /<pre><code class="language-js">/);
  });

  it('should treat variants like math-foo as non-math and fall back to default fence', () => {
    const html = makeMd().render('```math-foo\nnot math\n```\n');
    assert.match(html, /<pre><code class="language-math-foo">/);
  });

  it('should preserve an upstream custom fence renderer for non-math info strings', () => {
    const md = new MarkdownIt();
    md.renderer.rules.fence = () => '<div class="upstream"></div>';
    md.use(mathFencePlugin, { macros: {} });
    const html = md.render('```plantuml\nBob -> Alice\n```\n');
    assert.match(html, /<div class="upstream"><\/div>/);
  });

  it('should handle empty math fence without throwing', () => {
    const md = makeMd();
    assert.doesNotThrow(() => md.render('```math\n```\n'));
  });
});
