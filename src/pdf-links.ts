import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';

function getFilePath(uri: string): string | undefined {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'file:' || parsed.hash || parsed.search) {
      return undefined;
    }
    return fileURLToPath(parsed);
  } catch {
    return undefined;
  }
}

export function getRelativePdfPath(sourcePdfPath: string, targetPath: string): string | undefined {
  const relativePath = path.relative(path.dirname(sourcePdfPath), targetPath);
  if (!relativePath || path.isAbsolute(relativePath)) {
    return undefined;
  }
  return relativePath.split(path.sep).join('/');
}

function createRemotePdfAction(pdfDoc: PDFDocument, relativePath: string): PDFDict {
  const fileSpec = pdfDoc.context.obj({
    Type: 'Filespec',
    F: PDFHexString.fromText(relativePath),
    UF: PDFHexString.fromText(relativePath),
  });

  return pdfDoc.context.obj({
    Type: 'Action',
    S: 'GoToR',
    F: fileSpec,
    D: pdfDoc.context.obj([0, PDFName.of('Fit')]),
    NewWindow: true,
  });
}

export async function rewriteLocalPdfLinksToRelative(pdfPath: string): Promise<number> {
  const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath));
  let rewrittenCount = 0;

  for (const page of pdfDoc.getPages()) {
    const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annotations) {
      continue;
    }

    for (let index = 0; index < annotations.size(); index += 1) {
      const annotation = annotations.lookupMaybe(index, PDFDict);
      if (!annotation) {
        continue;
      }

      const subtype = annotation.lookupMaybe(PDFName.of('Subtype'), PDFName);
      if (!subtype || subtype.decodeText() !== 'Link') {
        continue;
      }

      const action = annotation.lookupMaybe(PDFName.of('A'), PDFDict);
      if (!action) {
        continue;
      }

      const actionType = action.lookupMaybe(PDFName.of('S'), PDFName);
      if (!actionType || actionType.decodeText() !== 'URI') {
        continue;
      }

      const uriObject = action.lookupMaybe(PDFName.of('URI'), PDFString, PDFHexString);
      if (!uriObject) {
        continue;
      }

      const targetPath = getFilePath(uriObject.decodeText());
      if (!targetPath || path.extname(targetPath).toLowerCase() !== '.pdf') {
        continue;
      }

      const relativePath = getRelativePdfPath(pdfPath, targetPath);
      if (!relativePath) {
        continue;
      }

      annotation.set(PDFName.of('A'), createRemotePdfAction(pdfDoc, relativePath));
      annotation.delete(PDFName.of('Dest'));
      rewrittenCount += 1;
    }
  }

  if (rewrittenCount > 0) {
    fs.writeFileSync(pdfPath, await pdfDoc.save());
  }

  return rewrittenCount;
}
