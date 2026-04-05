import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const SAMPLE_DIR = path.resolve(WORKSPACE_ROOT, 'sample');
const EXPECTED_DIR = path.resolve(__dirname, '..', 'integration', 'expected');
const README_MD = path.resolve(WORKSPACE_ROOT, 'README.md');

function normalizeHtml(html: string): string {
  return html
    .replace(/file:\/\/\/[^\s"'<>]*/g, 'file:///NORMALIZED_PATH')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS');
}

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

suite('Generate Sample Files', () => {
  const FORMATS = ['pdf', 'html', 'png', 'jpeg'];

  test('convert README.md to all formats and copy to sample/', async function () {
    this.timeout(120000);

    const doc = await vscode.workspace.openTextDocument(README_MD);
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('extension.markdown-pdf.all');

    for (const fmt of FORMATS) {
      const generated = path.resolve(WORKSPACE_ROOT, `README.${fmt}`);
      await waitForFile(generated);

      const dest = path.resolve(SAMPLE_DIR, `README.${fmt}`);
      fs.copyFileSync(generated, dest);
      fs.unlinkSync(generated);

      assert.ok(fs.existsSync(dest), `sample/README.${fmt} should exist`);
      const stat = fs.statSync(dest);
      assert.ok(stat.size > 0, `sample/README.${fmt} should not be empty`);
    }

    // Verify HTML snapshot matches expected
    const generatedHtml = normalizeHtml(fs.readFileSync(path.resolve(SAMPLE_DIR, 'README.html'), 'utf-8'));
    const expectedHtml = fs.readFileSync(path.resolve(EXPECTED_DIR, 'README.html'), 'utf-8');
    assert.strictEqual(generatedHtml, expectedHtml, 'README.html should match expected snapshot');
  });
});
