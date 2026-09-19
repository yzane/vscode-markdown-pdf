import { describe, it } from 'node:test';
import assert from 'assert';
import markdownIt from 'markdown-it';
import markdownItGitHubAlerts from 'markdown-it-github-alerts';

describe('markdown-it-github-alerts', function () {
  function renderWithAlerts(src: string): string {
    const md = markdownIt();
    md.use(markdownItGitHubAlerts);
    return md.render(src);
  }

  function renderWithoutAlerts(src: string): string {
    const md = markdownIt();
    return md.render(src);
  }

  it('should render a [!NOTE] alert with class, title, and SVG icon', function () {
    const src = '> [!NOTE]\n> Highlights information that users should take into account.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<div class="markdown-alert markdown-alert-note">'), 'missing alert container');
    assert.ok(html.includes('<p class="markdown-alert-title">'), 'missing alert title paragraph');
    assert.ok(html.includes('<svg class="octicon octicon-info'), 'missing info octicon svg');
    assert.ok(html.includes('Note</p>'), 'missing Note title');
    assert.ok(html.includes('Highlights information that users should take into account.'), 'missing content');
    assert.ok(!html.includes('<blockquote>'), 'should not contain blockquote tag');
  });

  it('should render a [!TIP] alert with class, title, and SVG icon', function () {
    const src = '> [!TIP]\n> Optional information to help a user be more successful.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<div class="markdown-alert markdown-alert-tip">'));
    assert.ok(html.includes('<svg class="octicon octicon-light-bulb'));
    assert.ok(html.includes('Tip</p>'));
    assert.ok(html.includes('Optional information to help a user be more successful.'));
  });

  it('should render an [!IMPORTANT] alert with class, title, and SVG icon', function () {
    const src = '> [!IMPORTANT]\n> Crucial information necessary for users to succeed.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<div class="markdown-alert markdown-alert-important">'));
    assert.ok(html.includes('<svg class="octicon octicon-report'));
    assert.ok(html.includes('Important</p>'));
    assert.ok(html.includes('Crucial information necessary for users to succeed.'));
  });

  it('should render a [!WARNING] alert with class, title, and SVG icon', function () {
    const src = '> [!WARNING]\n> Critical content demanding immediate user attention.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<div class="markdown-alert markdown-alert-warning">'));
    assert.ok(html.includes('<svg class="octicon octicon-alert'));
    assert.ok(html.includes('Warning</p>'));
    assert.ok(html.includes('Critical content demanding immediate user attention.'));
  });

  it('should render a [!CAUTION] alert with class, title, and SVG icon', function () {
    const src = '> [!CAUTION]\n> Negative potential consequences of an action.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<div class="markdown-alert markdown-alert-caution">'));
    assert.ok(html.includes('<svg class="octicon octicon-stop'));
    assert.ok(html.includes('Caution</p>'));
    assert.ok(html.includes('Negative potential consequences of an action.'));
  });

  it('should leave regular blockquotes unaffected', function () {
    const src = '> This is a standard blockquote with no alert marker.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<blockquote>'));
    assert.ok(!html.includes('markdown-alert'));
    assert.ok(html.includes('This is a standard blockquote with no alert marker.'));
  });

  it('should leave unrecognized bracket markers as standard blockquotes', function () {
    const src = '> [!UNKNOWN]\n> This is not a standard GitHub alert type.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<blockquote>'));
    assert.ok(!html.includes('markdown-alert'));
  });

  it('should render formatted markdown inside the alert content', function () {
    const src = '> [!NOTE]\n> Alert with **bold**, [link](https://example.com), and `code`.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<strong>bold</strong>'));
    assert.ok(html.includes('<a href="https://example.com">link</a>'));
    assert.ok(html.includes('<code>code</code>'));
  });

  it('should support multiple paragraphs inside an alert', function () {
    const src = '> [!NOTE]\n> First paragraph.\n>\n> Second paragraph.';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<div class="markdown-alert markdown-alert-note">'));
    assert.ok(html.includes('<p>First paragraph.</p>'));
    assert.ok(html.includes('<p>Second paragraph.</p>'));
  });

  it('should support lists inside an alert', function () {
    const src = '> [!NOTE]\n> - item 1\n> - item 2';
    const html = renderWithAlerts(src);
    assert.ok(html.includes('<div class="markdown-alert markdown-alert-note">'));
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>item 1</li>'));
    assert.ok(html.includes('<li>item 2</li>'));
  });

  it('should render as a standard blockquote when plugin is disabled', function () {
    const src = '> [!NOTE]\n> This should be a quote when alerts are disabled.';
    const html = renderWithoutAlerts(src);
    assert.ok(html.includes('<blockquote>'));
    assert.ok(!html.includes('markdown-alert'));
    assert.ok(html.includes('[!NOTE]'));
  });
});
