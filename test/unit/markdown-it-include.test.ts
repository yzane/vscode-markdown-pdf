import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { markdownItInclude } from '../../src/markdown-it-include';

// markdownItInclude only registers a markdown-it core rule; it doesn't need a
// real MarkdownIt instance to exercise, so a minimal stub with the one method
// it calls is enough and keeps these tests fast and dependency-free.
function expand(src: string, root: string): string {
  let coreRule: ((state: { src: string }) => void) | undefined;
  const fakeMd = {
    core: {
      ruler: {
        before: (_anchor: string, _name: string, rule: (state: { src: string }) => void) => {
          coreRule = rule;
        },
      },
    },
  };
  markdownItInclude(fakeMd as any, { root, throwError: false });
  const state = { src };
  coreRule!(state);
  return state.src;
}

describe('markdownItInclude', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-include-'));
    fs.writeFileSync(path.join(tmpDir, 'part.md'), 'Included content.');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('expands a legitimate :[alt](path) directive', () => {
    const out = expand('Before.\n\n:[alt](part.md)\n\nAfter.', tmpDir);
    assert.equal(out, 'Before.\n\nIncluded content.\n\nAfter.');
  });

  it('reports a missing include target instead of throwing', () => {
    const out = expand(':[alt](missing.md)', tmpDir);
    assert.match(out, /INCLUDE ERROR: File .* not found\./);
  });

  it('does not expand include syntax inside inline code', () => {
    const src = 'Text `:[alt](part.md)` more text.';
    assert.equal(expand(src, tmpDir), src);
  });

  it('does not expand include syntax inside a fenced code block', () => {
    const src = 'Text.\n\n```\n:[alt](part.md)\n```\n\nMore text.';
    assert.equal(expand(src, tmpDir), src);
  });

  it('still protects a code span that spans multiple lines within one paragraph', () => {
    const src = 'Some `code\nspanning :[a](part.md) two lines` end.';
    assert.equal(expand(src, tmpDir), src);
  });

  it('does not protect include syntax across a blank line (different paragraph)', () => {
    // A single backtick run can't open a code span that reaches past a blank
    // line, so this is *not* inline code — the include directive on the
    // second paragraph is expected to expand normally.
    const src = 'Stray ` backtick.\n\n:[alt](part.md)';
    const out = expand(src, tmpDir);
    assert.equal(out, 'Stray ` backtick.\n\nIncluded content.');
  });

  it('expands an include after a CRLF paragraph break', () => {
    const src = 'Stray ` backtick.\r\n\r\n:[a](part.md) and `code` here.';
    const out = expand(src, tmpDir);
    assert.equal(out, 'Stray ` backtick.\r\n\r\nIncluded content. and `code` here.');
  });

  it('leaves a tilde fence that interrupts a paragraph unchanged', () => {
    const src = 'Text with stray `backtick.\n~~~txt\nraw\n~~~\nLater `ok` here.';
    assert.equal(expand(src, tmpDir), src);
  });

  // Regression test for a real-world bug: on documents with enough inline
  // code spans, an unmatched/odd backtick run could pair with a backtick
  // several paragraphs later, treating everything in between — including a
  // fenced code block — as "inline code" content. `replaceIncludes` then
  // reconstructed the document with that swallowed region appended a second
  // time as raw text, silently duplicating a chunk of the document in the
  // rendered output. See the fenced block that sits between the stray
  // backtick and the later, unrelated code span below: a correct scanner
  // must fail to find a closer for the stray backtick (it's on the other
  // side of a fence, which a code span can never cross) instead of matching
  // it against `` `ok` ``.
  it('does not let a stray backtick swallow a later fenced block and duplicate content', () => {
    const src = 'Text with a stray `backtick here.\n\n```txt\n```\n\nLater text with `ok`.';
    assert.equal(expand(src, tmpDir), src);
  });
});
