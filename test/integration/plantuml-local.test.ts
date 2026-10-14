import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

// Set PLANTUML_TEST_JAR to opt into tests requiring Java and a real PlantUML JAR.
const jarPath = process.env.PLANTUML_TEST_JAR;
const outputDirectory = path.resolve(__dirname, '../../tmp/plantuml-local-validation');

async function waitForFile(filename: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (fs.existsSync(filename) && fs.statSync(filename).size > 0) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Export was not created: ' + filename);
}

suite('Local PlantUML JAR', function () {
  const settings = ['plantumlJarPath', 'plantumlServer', 'outputDirectory'] as const;
  const originalSettings = new Map<string, unknown>();

  suiteSetup(async function () {
    if (!jarPath) {
      this.skip();
      return;
    }
    assert.ok(fs.existsSync(jarPath), 'PLANTUML_TEST_JAR must point to an existing JAR');
    fs.mkdirSync(outputDirectory, { recursive: true });
    const configuration = vscode.workspace.getConfiguration('markdown-pdf');
    for (const setting of settings) {
      originalSettings.set(setting, configuration.inspect(setting)?.globalValue);
    }
    await configuration.update('plantumlJarPath', jarPath, vscode.ConfigurationTarget.Global);
    // An unreachable server ensures these exports use the local JAR.
    await configuration.update('plantumlServer', 'http://127.0.0.1:1/plantuml', vscode.ConfigurationTarget.Global);
    await configuration.update('outputDirectory', outputDirectory, vscode.ConfigurationTarget.Global);
  });

  suiteTeardown(async function () {
    const configuration = vscode.workspace.getConfiguration('markdown-pdf');
    for (const [setting, value] of originalSettings) {
      await configuration.update(setting, value, vscode.ConfigurationTarget.Global);
    }
  });

  const body = 'participant "利用者" as User\nparticipant "サーバー" as Server\nUser -> Server: 日本語の要求\nServer --> User: 正常応答';
  const cases = [
    { name: 'markers', source: '@startuml\n' + body + '\n@enduml' },
    { name: 'fence', source: '```plantuml\n@startuml\n' + body + '\n@enduml\n```' },
    {
      name: 'custom-markers',
      source: '---\nplantumlOpenMarker: "@startcustom"\nplantumlCloseMarker: "@endcustom"\n---\n\n@startcustom\n' + body + '\n@endcustom',
    },
  ];

  for (const { name, source } of cases) {
    test(name + ': embeds a locally rendered Japanese SVG', async function () {
      const markdownPath = path.join(outputDirectory, name + '.md');
      const htmlPath = path.join(outputDirectory, name + '.html');
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
      fs.writeFileSync(markdownPath, source + '\n', 'utf8');
      const document = await vscode.workspace.openTextDocument(markdownPath);
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand('extension.markdown-pdf.html');
      await waitForFile(htmlPath);
      const html = fs.readFileSync(htmlPath, 'utf8');
      const match = html.match(/<img[^>]*src="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)"/);
      assert.ok(match, 'PlantUML must be embedded as an SVG data URI');
      const svg = Buffer.from(match[1], 'base64').toString('utf8');
      assert.match(svg, /<svg\b/);
      assert.ok(svg.includes('日本語の要求'), 'Japanese labels must survive Java rendering');
      assert.ok(!html.includes('http://127.0.0.1:1/plantuml/svg/'), 'The server must not be used');
      fs.writeFileSync(path.join(outputDirectory, name + '.svg'), svg);
    });
  }

  for (const format of ['pdf', 'png']) {
    test('exports the local SVG to ' + format.toUpperCase(), async function () {
      const markdownPath = path.join(outputDirectory, 'fence.md');
      const exportedPath = path.join(outputDirectory, 'fence.' + format);
      if (fs.existsSync(exportedPath)) fs.unlinkSync(exportedPath);
      const document = await vscode.workspace.openTextDocument(markdownPath);
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand('extension.markdown-pdf.' + format);
      await waitForFile(exportedPath);
      const bytes = fs.readFileSync(exportedPath);
      if (format === 'pdf') {
        assert.strictEqual(bytes.subarray(0, 5).toString(), '%PDF-');
      } else {
        assert.strictEqual(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      }
    });
  }
});
