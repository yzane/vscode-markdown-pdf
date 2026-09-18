export interface TrackableDocument {
  languageId: string;
  uri: { toString(): string };
}

/** Tracks the most recent Markdown document while preserving active-document priority. */
export class MarkdownDocumentTracker<T extends TrackableDocument> {
  private lastActiveMarkdownDocument: T | undefined;

  remember(document: T | undefined): void {
    if (document?.languageId === 'markdown') {
      this.lastActiveMarkdownDocument = document;
    }
  }

  forget(document: TrackableDocument): void {
    if (this.lastActiveMarkdownDocument?.uri.toString() === document.uri.toString()) {
      this.lastActiveMarkdownDocument = undefined;
    }
  }

  resolve(activeDocument: T | undefined): T | undefined {
    return activeDocument || this.lastActiveMarkdownDocument;
  }
}
