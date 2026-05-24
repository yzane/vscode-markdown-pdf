import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

import { extractReadmePreviewSources, resolveReadmePreviewExportPath } from '../../src/readme-previews';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const README_MD = path.resolve(WORKSPACE_ROOT, 'README.md');
const IMAGES_DIR = path.resolve(WORKSPACE_ROOT, 'images');
// Write intermediate files inside the workspace (not /tmp) so snap-confined
// Chromium can read them via file:// URLs.
const TEMP_ROOT = path.resolve(WORKSPACE_ROOT, '.tmp-readme-previews');

function waitForFile(filePath: string, maxWait = 30000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (fs.existsSync(filePath)) {
      resolve();
      return;
    }

    const interval = 500;
    let waited = 0;
    const timer = setInterval(() => {
      waited += interval;
      if (fs.existsSync(filePath)) {
        clearInterval(timer);
        resolve();
      } else if (waited >= maxWait) {
        clearInterval(timer);
        reject(new Error(`File not found after ${maxWait}ms: ${filePath}`));
      }
    }, interval);
  });
}

async function exportDiagramPng(
  markdownSource: string,
  outputName: string,
  extraStylesheets?: string[]
): Promise<void> {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(TEMP_ROOT, 'preview-'));
  const markdownPath = path.join(tempDir, outputName + '.md');
  const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(markdownPath));
  const generatedPng = resolveReadmePreviewExportPath(
    path.join(tempDir, outputName + '.png'),
    markdownPath,
    vscode.workspace.getConfiguration('markdown-pdf').get<string>('outputDirectory'),
    vscode.workspace.getConfiguration('markdown-pdf').get<boolean>('outputDirectoryRelativePathFile'),
    workspace ? workspace.uri.fsPath : undefined
  );
  const finalPng = path.join(IMAGES_DIR, outputName + '.png');

  fs.writeFileSync(markdownPath, markdownSource, 'utf-8');

  const mdpdfConfig = vscode.workspace.getConfiguration('markdown-pdf');
  const originalStyles = mdpdfConfig.get<string[]>('styles');
  const stylesChanged = extraStylesheets !== undefined;
  if (stylesChanged) {
    await mdpdfConfig.update('styles', extraStylesheets, vscode.ConfigurationTarget.Global);
  }

  try {
    const doc = await vscode.workspace.openTextDocument(markdownPath);
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('extension.markdown-pdf.png');
    await waitForFile(generatedPng, 60000);
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    fs.copyFileSync(generatedPng, finalPng);

    assert.ok(fs.existsSync(finalPng), `${outputName}.png should exist in images/`);
    assert.ok(fs.statSync(finalPng).size > 0, `${outputName}.png should not be empty`);
  } finally {
    if (stylesChanged) {
      await mdpdfConfig.update('styles', originalStyles, vscode.ConfigurationTarget.Global);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeContainerStylesheet(): string {
  const cssPath = path.join(TEMP_ROOT, 'container-preview.css');
  const css = [
    '.warning {',
    '  border-left: 4px solid #f0ad4e;',
    '  background: #fff8e1;',
    '  padding: 12px 16px;',
    '  margin: 8px 0;',
    '}',
  ].join('\n');
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  fs.writeFileSync(cssPath, css, 'utf-8');
  return cssPath;
}

suite('Update README Preview Images', () => {
  test('export README preview snippets to images/', async function () {
    this.timeout(300000);

    const markdown = fs.readFileSync(README_MD, 'utf-8');
    const { plantuml, mermaid, checkbox, container, math } = extractReadmePreviewSources(markdown);

    await exportDiagramPng(plantuml, 'PlantUML');
    await exportDiagramPng('```mermaid\n' + mermaid + '\n```', 'mermaid');
    await exportDiagramPng(checkbox, 'checkbox');
    await exportDiagramPng(container, 'container', [writeContainerStylesheet()]);
    await exportDiagramPng(math, 'math');
  });
});
