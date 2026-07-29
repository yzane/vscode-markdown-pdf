import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import markdownIt from 'markdown-it';
import { installSanitizeRules } from '../../src/markdown-it-sanitize';
import type { SanitizeReport } from '../../src/utils';

function render(source: string, mode: 'gfm' | 'gfm-allow-style' | 'none' = 'gfm'): { html: string; report: SanitizeReport } {
  const md = markdownIt({ html: true });
  const report: SanitizeReport = { removedElements: [], strippedAttributes: [] };
  installSanitizeRules(md, mode, report);
  const html = md.render(source);
  return { html, report };
}

describe('installSanitizeRules', function () {
  describe('block-level removal', function () {
    it('removes a block <style> with its content', function () {
      const { html, report } = render('<style>body{color:red}</style>\n');
      assert.doesNotMatch(html, /body\{color:red\}/);
      assert.doesNotMatch(html, /<style/);
      assert.deepEqual(report.removedElements, ['style']);
    });

    it('removes a block <script> with its content', function () {
      const { html, report } = render('<script>alert(1)</script>\n');
      assert.doesNotMatch(html, /alert\(1\)/);
      assert.deepEqual(report.removedElements, ['script']);
    });

    it('removes a block <iframe>', function () {
      const { html, report } = render('<iframe src="x"></iframe>\n');
      assert.doesNotMatch(html, /<iframe/);
      assert.deepEqual(report.removedElements, ['iframe']);
    });
  });

  describe('inline raw HTML stays escaped (not removed)', function () {
    it('escapes inline <script> and keeps its text content', function () {
      const { html, report } = render('foo <script>alert(1)</script> bar');
      // No executable script tag in the output.
      assert.doesNotMatch(html, /<script>/);
      // The text content survives as visible text, and the tag is escaped.
      assert.match(html, /alert\(1\)/);
      assert.match(html, /&lt;script/);
      assert.deepEqual(report.removedElements, []);
    });

    it('escapes inline <style>', function () {
      const { html, report } = render('foo <style>body{}</style> bar');
      assert.match(html, /&lt;style/);
      assert.match(html, /body\{\}/);
      assert.deepEqual(report.removedElements, []);
    });

    it('escapes inline <iframe>', function () {
      const { html, report } = render('foo <iframe>fallback</iframe> bar');
      assert.match(html, /&lt;iframe/);
      assert.match(html, /fallback/);
      assert.deepEqual(report.removedElements, []);
    });
  });

  describe('mode interactions', function () {
    it('keeps block <style> in gfm-allow-style mode', function () {
      const { html, report } = render('<style>body{}</style>\n', 'gfm-allow-style');
      assert.match(html, /<style>body\{\}<\/style>/);
      assert.deepEqual(report.removedElements, []);
    });
  });
});
