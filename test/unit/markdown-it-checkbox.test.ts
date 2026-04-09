import { describe, it } from 'node:test';
import assert from 'assert';
import markdownIt from 'markdown-it';
import { markdownItCheckbox } from '../../src/markdown-it-checkbox';

describe('markdownItCheckbox', function () {
  function render(src: string): string {
    const md = markdownIt();
    md.use(markdownItCheckbox);
    return md.render(src);
  }

  it('should render an unchecked checkbox', function () {
    const html = render('[ ] unchecked');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(html.includes('<label for="checkbox0">unchecked</label>'));
  });

  it('should render a checked checkbox with lowercase x', function () {
    const html = render('[x] checked');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0" checked="true">'));
    assert.ok(html.includes('<label for="checkbox0">checked</label>'));
  });

  it('should render a checked checkbox with uppercase X', function () {
    const html = render('[X] checked');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0" checked="true">'));
    assert.ok(html.includes('<label for="checkbox0">checked</label>'));
  });

  it('should render an unchecked checkbox with dash', function () {
    const html = render('[-] dashed');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(!html.includes('checked="true"'));
    assert.ok(html.includes('<label for="checkbox0">dashed</label>'));
  });

  it('should render an unchecked checkbox with underscore', function () {
    const html = render('[_] underscored');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(!html.includes('checked="true"'));
    assert.ok(html.includes('<label for="checkbox0">underscored</label>'));
  });

  it('should assign sequential ids across multiple checkboxes', function () {
    const html = render('[ ] first\n[x] second\n[ ] third');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(html.includes('<label for="checkbox0">first</label>'));
    assert.ok(html.includes('<input type="checkbox" id="checkbox1" checked="true">'));
    assert.ok(html.includes('<label for="checkbox1">second</label>'));
    assert.ok(html.includes('<input type="checkbox" id="checkbox2">'));
    assert.ok(html.includes('<label for="checkbox2">third</label>'));
  });

  it('should leave normal text unaffected', function () {
    const html = render('Hello World');
    assert.ok(!html.includes('<input'));
    assert.ok(!html.includes('<label'));
  });

  it('should not rewrite prose when checkbox marker appears mid-sentence', function () {
    const html = render('prefix [ ] item');
    assert.ok(!html.includes('<input'));
    assert.ok(!html.includes('<label'));
    assert.ok(html.includes('<p>prefix [ ] item</p>'));
  });

  it('should keep formatted label content inside the label', function () {
    const html = render('[ ] **bold** [link](https://example.com) `code`');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(html.includes('<label for="checkbox0"><strong>bold</strong> <a href="https://example.com">link</a> <code>code</code></label>'));
  });

  it('should work inside list items', function () {
    const html = render('- [ ] unchecked\n- [x] checked');
    assert.ok(html.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(html.includes('<label for="checkbox0">unchecked</label>'));
    assert.ok(html.includes('<input type="checkbox" id="checkbox1" checked="true">'));
    assert.ok(html.includes('<label for="checkbox1">checked</label>'));
  });

  it('should reset ids for each render on the same markdown-it instance', function () {
    const md = markdownIt();
    md.use(markdownItCheckbox);

    const firstHtml = md.render('[ ] first');
    const secondHtml = md.render('[ ] second');

    assert.ok(firstHtml.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(secondHtml.includes('<input type="checkbox" id="checkbox0">'));
    assert.ok(!secondHtml.includes('checkbox1'));
  });
});
