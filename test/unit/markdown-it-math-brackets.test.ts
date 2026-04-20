import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import MarkdownIt from 'markdown-it';
import { mathBracketsPlugin } from '../../src/markdown-it-math-brackets';

function tokenize(src: string) {
  const md = new MarkdownIt();
  md.use(mathBracketsPlugin);
  return md.parse(src, {});
}

describe('mathBracketsPlugin', () => {
  it('emits math_inline token for \\(...\\) on a single line', () => {
    const tokens = tokenize('Hello \\(E = mc^2\\) world.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.ok(math, 'math_inline token should be emitted');
    assert.strictEqual(math?.content, 'E = mc^2');
    assert.strictEqual(math?.markup, '\\(');
  });

  it('emits math_inline token with display markup for inline \\[...\\]', () => {
    const tokens = tokenize('See \\[\\alpha\\] here.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.ok(math, 'math_inline token should be emitted');
    assert.strictEqual(math?.content, '\\alpha');
    assert.strictEqual(math?.markup, '\\[');
  });

  it('emits math_block token for \\[...\\] on its own block', () => {
    const src = '\\[\n\\gamma^2\n\\]\n';
    const tokens = tokenize(src);
    const block = tokens.find((t) => t.type === 'math_block');
    assert.ok(block, 'math_block token should be emitted');
    assert.strictEqual(block?.content.trim(), '\\gamma^2');
    assert.strictEqual(block?.markup, '\\[');
  });

  it('emits math_block token for single-line \\[...\\]', () => {
    const tokens = tokenize('\\[x + y\\]\n');
    const block = tokens.find((t) => t.type === 'math_block');
    assert.ok(block, 'math_block token should be emitted');
    assert.strictEqual(block?.content, 'x + y');
    assert.strictEqual(block?.markup, '\\[');
  });

  it('does not emit math tokens for escaped delimiters (\\\\( / \\\\[)', () => {
    const tokens = tokenize('Literal: \\\\(x\\\\) and \\\\[y\\\\].');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline' || t.type === 'math_block');
    assert.strictEqual(math, undefined);
  });

  it('does not treat \\(...\\) inside a code span as math', () => {
    const tokens = tokenize('Code: `\\(x\\)` here.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.strictEqual(math, undefined);
  });

  it('does not match an unclosed \\( delimiter', () => {
    const tokens = tokenize('Dangling: \\(x + y.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.strictEqual(math, undefined);
  });
});
