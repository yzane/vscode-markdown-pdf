import { describe, it } from 'node:test';
import assert from 'assert';
import markdownIt from 'markdown-it';
import { markdownItNamedHeaders, githubSlugify } from '../../src/markdown-it-named-headers';

describe('markdownItNamedHeaders', function () {
  function render(src: string): string {
    const md = markdownIt();
    md.use(markdownItNamedHeaders);
    return md.render(src);
  }

  function assertHeadingId(html: string, tag: string, id: string): void {
    assert.match(html, new RegExp(`<${tag}\\b[^>]*\\bid="${id}"[^>]*>`));
  }

  describe('githubSlugify', function () {
    it('should convert basic text to slug', function () {
      assert.strictEqual(githubSlugify('Hello World'), 'hello-world');
    });

    it('should preserve CJK characters', function () {
      assert.strictEqual(githubSlugify('日本語の見出し'), '日本語の見出し');
    });

    it('should remove punctuation', function () {
      assert.strictEqual(githubSlugify("What's this?!"), 'whats-this');
    });

    it('should preserve leading and trailing hyphens', function () {
      assert.strictEqual(githubSlugify(' -hello- '), '-hello-');
    });

    it('should preserve underscores', function () {
      assert.strictEqual(githubSlugify('snake_case'), 'snake_case');
    });

    it('should return empty string for empty input', function () {
      assert.strictEqual(githubSlugify(''), '');
    });

    it('should replace spaces with hyphens', function () {
      assert.strictEqual(githubSlugify('hello   world'), 'hello---world');
    });

    it('should handle mixed CJK and Latin scripts', function () {
      assert.strictEqual(githubSlugify('日本語 English テスト'), '日本語-english-テスト');
    });

    it('should remove emoji', function () {
      assert.strictEqual(githubSlugify('Hello 🎉 World'), 'hello--world');
    });
  });

  describe('heading id assignment', function () {
    it('should add id attribute to headings', function () {
      const html = render('# Hello World');
      assertHeadingId(html, 'h1', 'hello-world');
    });

    it('should handle multiple heading levels', function () {
      const html = render('## Sub Heading');
      assertHeadingId(html, 'h2', 'sub-heading');
    });

    it('should handle CJK headings', function () {
      const html = render('# 日本語の見出し');
      assertHeadingId(html, 'h1', '日本語の見出し');
    });

    it('should handle duplicate headings with incremental suffix', function () {
      const html = render('# Heading\n\n# Heading\n\n# Heading');
      const headingIds = Array.from(html.matchAll(/<h1\b[^>]*\bid="([^"]+)"[^>]*>/g), function (match) {
        return match[1];
      });
      assert.deepStrictEqual(headingIds, ['heading', 'heading-1', 'heading-2']);
    });

    it('should handle heading with inline code', function () {
      const html = render('# The `code` heading');
      assertHeadingId(html, 'h1', 'the-code-heading');
    });

    it('should use custom slugify when provided', function () {
      const md = markdownIt();
      md.use(markdownItNamedHeaders, { slugify: (s: string) => s.toUpperCase().replace(/\s/g, '_') });
      const html = md.render('# Hello World');
      assert.ok(html.includes('id="HELLO_WORLD"'));
    });
  });
});
