import { describe, it } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { getRelativePdfPath, rewriteLocalPdfLinksToRelative } from '../../src/pdf-links';

function createLinkAnnotation(pdfDoc: PDFDocument, uri: string): PDFDict {
  return pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: pdfDoc.context.obj([0, 0, 100, 20]),
    A: pdfDoc.context.obj({
      Type: 'Action',
      S: 'URI',
      URI: PDFHexString.fromText(uri),
    }),
  });
}

async function createPdfWithLink(pdfPath: string, uri: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const annotation = createLinkAnnotation(pdfDoc, uri);
  page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([annotation]));
  fs.writeFileSync(pdfPath, await pdfDoc.save());
}

describe('pdf-links', function () {
  it('preserves bookmarks when rewriting PDF links', async function () {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-relative-links-'));
    try {
      const mainPdf = path.join(tempDirectory, 'main.pdf');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([
        createLinkAnnotation(pdfDoc, pathToFileURL(path.join(tempDirectory, 'target.pdf')).href),
      ]));
      const outlines = pdfDoc.context.obj({ Type: 'Outlines', Count: 1 });
      const outlinesRef = pdfDoc.context.register(outlines);
      const item = pdfDoc.context.obj({
        Title: PDFHexString.fromText('Chapter 1'),
        Parent: outlinesRef,
        Dest: pdfDoc.context.obj([page.ref, PDFName.of('Fit')]),
      });
      const itemRef = pdfDoc.context.register(item);
      outlines.set(PDFName.of('First'), itemRef);
      outlines.set(PDFName.of('Last'), itemRef);
      pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesRef);
      fs.writeFileSync(mainPdf, await pdfDoc.save());

      assert.strictEqual(await rewriteLocalPdfLinksToRelative(mainPdf), 1);
      const rewritten = await PDFDocument.load(fs.readFileSync(mainPdf));
      const savedOutlines = rewritten.catalog.lookup(PDFName.of('Outlines'), PDFDict);
      const savedItem = savedOutlines.lookup(PDFName.of('First'), PDFDict);
      assert.strictEqual(savedItem.lookup(PDFName.of('Title'), PDFHexString).decodeText(), 'Chapter 1');
      assert.strictEqual(savedItem.lookup(PDFName.of('Dest'), PDFArray).get(0).toString(), rewritten.getPages()[0].ref.toString());
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('calculates a portable relative path using forward slashes', function () {
    assert.strictEqual(
      getRelativePdfPath(path.join('output', 'main.pdf'), path.join('output', '比較資料.pdf')),
      '比較資料.pdf',
    );
    assert.strictEqual(
      getRelativePdfPath(path.join('output', 'nested', 'main.pdf'), path.join('output', '比較資料.pdf')),
      '../比較資料.pdf',
    );
  });

  it('rewrites local PDF URI links to relative GoToR links', async function () {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-relative-links-'));
    try {
      const mainPdf = path.join(tempDirectory, 'main.pdf');
      const targetPdf = path.join(tempDirectory, '比較資料.pdf');
      const targetUri = pathToFileURL(targetPdf).href;
      const driveColonIndex = targetUri.indexOf(':', 'file:///'.length);
      const chromiumStyleUri = driveColonIndex >= 0
        ? targetUri.slice(0, driveColonIndex) + '%3A' + targetUri.slice(driveColonIndex + 1)
        : targetUri;
      await createPdfWithLink(mainPdf, chromiumStyleUri);

      assert.strictEqual(await rewriteLocalPdfLinksToRelative(mainPdf), 1);

      const pdfDoc = await PDFDocument.load(fs.readFileSync(mainPdf));
      const annotations = pdfDoc.getPages()[0].node.lookup(PDFName.of('Annots'), PDFArray);
      const annotation = annotations.lookup(0, PDFDict);
      const action = annotation.lookup(PDFName.of('A'), PDFDict);
      assert.strictEqual(action.lookup(PDFName.of('S'), PDFName).decodeText(), 'GoToR');
      const fileSpec = action.lookup(PDFName.of('F'), PDFDict);
      assert.strictEqual(fileSpec.lookup(PDFName.of('F'), PDFHexString).decodeText(), '比較資料.pdf');
      assert.strictEqual(fileSpec.lookup(PDFName.of('UF'), PDFHexString).decodeText(), '比較資料.pdf');
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('leaves external and non-PDF links unchanged', async function () {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-relative-links-'));
    try {
      const externalPdf = path.join(tempDirectory, 'external.pdf');
      await createPdfWithLink(externalPdf, 'https://example.com/comparison.pdf');
      assert.strictEqual(await rewriteLocalPdfLinksToRelative(externalPdf), 0);

      const nonPdf = path.join(tempDirectory, 'non-pdf.pdf');
      await createPdfWithLink(nonPdf, pathToFileURL(path.join(tempDirectory, 'notes.txt')).href);
      assert.strictEqual(await rewriteLocalPdfLinksToRelative(nonPdf), 0);
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
