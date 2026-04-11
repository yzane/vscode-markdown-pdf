import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';

import { extractReadmeDiagramSources } from '../../src/readme-diagrams';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const README_MD = path.resolve(WORKSPACE_ROOT, 'README.md');
const IMAGES_DIR = path.resolve(WORKSPACE_ROOT, 'images');

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

async function exportDiagramPng(markdownSource: string, outputName: string): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-readme-diagram-'));
  const markdownPath = path.join(tempDir, outputName + '.md');
  const generatedPng = path.join(tempDir, 'sample', outputName + '.png');
  const finalPng = path.join(IMAGES_DIR, outputName + '.png');

  fs.writeFileSync(markdownPath, markdownSource, 'utf-8');

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
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

suite('Update README Diagram Images', () => {
  test('export README PlantUML and Mermaid snippets to images/', async function () {
    this.timeout(180000);

    const markdown = fs.readFileSync(README_MD, 'utf-8');
    const { plantuml, mermaid } = extractReadmeDiagramSources(markdown);

    await exportDiagramPng(plantuml, 'PlantUML');
    await exportDiagramPng('```mermaid\n' + mermaid + '\n```', 'mermaid');
  });
});
