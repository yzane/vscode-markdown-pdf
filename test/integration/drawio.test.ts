import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

// Set DRAWIO_TEST_EXECUTABLE to run tests with an installed draw.io Desktop.
const executablePath = process.env.DRAWIO_TEST_EXECUTABLE;
const outputDirectory = path.resolve(__dirname, '../../tmp/drawio-validation');
const fixturesDirectory = path.resolve(__dirname, 'fixtures');

async function waitForFile(filename: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (fs.existsSync(filename) && fs.statSync(filename).size > 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Export was not created: ' + filename);
}

suite('Local draw.io XML', function () {
  const originalSettings = new Map<string, unknown>();
  suiteSetup(async function () {
    if (!executablePath) {
      this.skip();
      return;
    }
    fs.mkdirSync(outputDirectory, { recursive: true });
    const configuration = vscode.workspace.getConfiguration('markdown-pdf');
    for (const setting of ['drawioExecutablePath', 'outputDirectory']) {
      originalSettings.set(setting, configuration.inspect(setting)?.globalValue);
    }
    await configuration.update('drawioExecutablePath', executablePath, vscode.ConfigurationTarget.Global);
    await configuration.update('outputDirectory', outputDirectory, vscode.ConfigurationTarget.Global);
  });
  suiteTeardown(async function () {
    const configuration = vscode.workspace.getConfiguration('markdown-pdf');
    for (const [setting, value] of originalSettings) {
      await configuration.update(setting, value, vscode.ConfigurationTarget.Global);
    }
  });

  for (const fixture of ['drawio.drawio', 'drawio-compressed.drawio', 'drawio-model.xml']) {
    test(fixture + ': embeds Japanese SVG from XML', async function () {
      const name = path.parse(fixture).name;
      const markdownPath = path.join(outputDirectory, name + '.md');
      const htmlPath = path.join(outputDirectory, name + '.html');
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
      const xml = fs.readFileSync(path.join(fixturesDirectory, fixture), 'utf8');
      fs.writeFileSync(markdownPath, '# draw.io XML\n\n```drawio\n' + xml + '\n```\n');
      const document = await vscode.workspace.openTextDocument(markdownPath);
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand('extension.markdown-pdf.html');
      await waitForFile(htmlPath);
      const html = fs.readFileSync(htmlPath, 'utf8');
      const match = html.match(/<img[^>]*src="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)"/);
      assert.ok(match, 'The XML diagram must be embedded as SVG');
      const svg = Buffer.from(match[1], 'base64').toString('utf8');
      assert.match(svg, /<svg\b/);
      assert.ok(svg.includes('日本語の要求'), 'The Japanese diagram labels must be preserved');
      fs.writeFileSync(path.join(outputDirectory, name + '.svg'), svg);
    });
  }

  for (const format of ['pdf', 'png', 'jpeg']) {
    test('exports the XML diagram to ' + format.toUpperCase(), async function () {
      const markdownPath = path.join(outputDirectory, 'drawio.md');
      const exportedPath = path.join(outputDirectory, 'drawio.' + format);
      if (fs.existsSync(exportedPath)) fs.unlinkSync(exportedPath);
      const document = await vscode.workspace.openTextDocument(markdownPath);
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand('extension.markdown-pdf.' + format);
      await waitForFile(exportedPath);
      const bytes = fs.readFileSync(exportedPath);
      if (format === 'pdf') assert.strictEqual(bytes.subarray(0, 5).toString(), '%PDF-');
      if (format === 'png') assert.strictEqual(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      if (format === 'jpeg') assert.strictEqual(bytes.subarray(0, 2).toString('hex'), 'ffd8');
    });
  }
});
