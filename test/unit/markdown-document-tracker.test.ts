import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MarkdownDocumentTracker } from '../../src/markdown-document-tracker';

interface TestDocument {
  languageId: string;
  uri: { toString(): string };
}

const markdownDocument: TestDocument = {
  languageId: 'markdown',
  uri: { toString: () => 'file:///document.md' },
};
const textDocument: TestDocument = {
  languageId: 'plaintext',
  uri: { toString: () => 'file:///document.txt' },
};

describe('MarkdownDocumentTracker', () => {
  test('uses the last active Markdown document when no document is active', () => {
    const tracker = new MarkdownDocumentTracker<TestDocument>();

    tracker.remember(markdownDocument);

    assert.strictEqual(tracker.resolve(undefined), markdownDocument);
  });

  test('keeps an active non-Markdown document ahead of remembered Markdown', () => {
    const tracker = new MarkdownDocumentTracker<TestDocument>();
    tracker.remember(markdownDocument);

    assert.strictEqual(tracker.resolve(textDocument), textDocument);
  });

  test('forgets the remembered Markdown document when it closes', () => {
    const tracker = new MarkdownDocumentTracker<TestDocument>();
    tracker.remember(markdownDocument);

    tracker.forget(markdownDocument);

    assert.strictEqual(tracker.resolve(undefined), undefined);
  });

  test('keeps the remembered Markdown document when another document closes', () => {
    const tracker = new MarkdownDocumentTracker<TestDocument>();
    tracker.remember(markdownDocument);

    tracker.forget(textDocument);

    assert.strictEqual(tracker.resolve(undefined), markdownDocument);
  });
});
