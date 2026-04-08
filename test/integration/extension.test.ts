import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const EXPECTED_DIR = path.resolve(__dirname, 'expected');

function normalizeHtml(html: string): string {
  return html
    .replace(/file:\/\/\/[^\s"'<>]*/g, 'file:///NORMALIZED_PATH')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS');
}

async function executeMarkdownPdfCommand(mdFileName: string, command: string): Promise<void> {
  const mdPath = path.resolve(FIXTURES_DIR, mdFileName);
  const doc = await vscode.workspace.openTextDocument(mdPath);
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand(command);
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));
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

function safeDelete(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Ignore cleanup failures to avoid masking test failures.
  }
}

interface HtmlFeature {
  name: string;
  expectedName?: string;
}

const HTML_FEATURES: HtmlFeature[] = [
  { name: 'plantuml' },
  { name: 'syntax-highlighting' },
  { name: 'emoji' },
  { name: 'checkbox' },
  { name: 'container' },
  { name: 'include' },
  { name: 'mermaid' },
  { name: 'plantuml-custom-marker' },
  { name: 'frontmatter-breaks' },
  { name: 'frontmatter-no-emoji' },
  { name: 'breaks' },
  { name: 'image' },
  { name: 'include-codeblock' },
];

suite('Integration HTML Snapshot Tests', () => {
  const originalListeners: ((...args: unknown[]) => void)[] = [];

  suiteSetup(function () {
    originalListeners.push(...(process.listeners('uncaughtException') as ((...args: unknown[]) => void)[]));
    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', (error: Error) => {
      if (error.message && error.message.includes('spawn java ENOENT')) {
        return;
      }
      throw error;
    });
  });

  suiteTeardown(function () {
    process.removeAllListeners('uncaughtException');
    originalListeners.forEach((listener) => process.on('uncaughtException', listener as NodeJS.UncaughtExceptionListener));
  });

  HTML_FEATURES.forEach(({ name, expectedName = name }) => {
    test(`${name}: HTML snapshot matches expected`, async function () {
      this.timeout(60000);

      const mdFile = `${name}.md`;
      const generatedHtmlPath = path.resolve(FIXTURES_DIR, `${name}.html`);
      const expectedHtmlPath = path.resolve(EXPECTED_DIR, `${expectedName}.html`);

      try {
        await executeMarkdownPdfCommand(mdFile, 'extension.markdown-pdf.html');
        await waitForFile(generatedHtmlPath);

        const generatedHtml = normalizeHtml(fs.readFileSync(generatedHtmlPath, 'utf-8'));
        const expectedHtml = fs.readFileSync(expectedHtmlPath, 'utf-8')
          .replace(`<title>${expectedName}.md</title>`, `<title>${name}.md</title>`);
        assert.strictEqual(generatedHtml, expectedHtml);
      } finally {
        safeDelete(generatedHtmlPath);
      }
    });
  });
});

suite('Integration Binary Generation Tests', () => {
  const combinedMd = path.resolve(FIXTURES_DIR, '_combined.md');
  const combinedBase = path.resolve(FIXTURES_DIR, '_combined');

  suiteSetup(function () {
    const contents = HTML_FEATURES.map(({ name }) => {
      const filePath = path.resolve(FIXTURES_DIR, `${name}.md`);
      return fs.readFileSync(filePath, 'utf-8');
    });
    fs.writeFileSync(combinedMd, contents.join('\n\n---\n\n'), 'utf-8');
  });

  suiteTeardown(function () {
    safeDelete(combinedMd);
  });

  test('combined fixture renders an emoji signal', async function () {
    this.timeout(60000);

    const outputPath = `${combinedBase}.html`;

    try {
      await executeMarkdownPdfCommand('_combined.md', 'extension.markdown-pdf.html');
      await waitForFile(outputPath);

      const generatedHtml = normalizeHtml(fs.readFileSync(outputPath, 'utf-8'));
      assert.ok(
        generatedHtml.includes('<img class="emoji" alt="smile"'),
        'combined HTML should include rendered emoji output'
      );
    } finally {
      safeDelete(outputPath);
    }
  });

  const binaryFormats = [
    {
      type: 'pdf',
      command: 'extension.markdown-pdf.pdf',
      magicBytes: Buffer.from([0x25, 0x50, 0x44, 0x46]),
    },
    {
      type: 'png',
      command: 'extension.markdown-pdf.png',
      magicBytes: Buffer.from([0x89, 0x50, 0x4E, 0x47]),
    },
    {
      type: 'jpeg',
      command: 'extension.markdown-pdf.jpeg',
      magicBytes: Buffer.from([0xFF, 0xD8, 0xFF]),
    },
  ];

  binaryFormats.forEach(({ type, command, magicBytes }) => {
    test(`${type.toUpperCase()}: generates valid file`, async function () {
      this.timeout(60000);

      const outputPath = `${combinedBase}.${type}`;

      try {
        await executeMarkdownPdfCommand('_combined.md', command);
        await waitForFile(outputPath);

        const stat = fs.statSync(outputPath);
        assert.ok(stat.size > 0, `${type} file should not be empty`);

        const header = Buffer.alloc(magicBytes.length);
        const fd = fs.openSync(outputPath, 'r');
        fs.readSync(fd, header, 0, magicBytes.length, 0);
        fs.closeSync(fd);

        assert.ok(
          header.equals(magicBytes),
          `${type} magic bytes mismatch: expected ${magicBytes.toString('hex')}, got ${header.toString('hex')}`
        );
      } finally {
        safeDelete(outputPath);
      }
    });
  });
});

suite('Error Handling Tests', () => {
  test('should not crash when run on a non-markdown file', async function () {
    this.timeout(30000);

    const txtPath = path.resolve(FIXTURES_DIR, '_error-test.txt');
    fs.writeFileSync(txtPath, 'This is not markdown', 'utf-8');

    try {
      const doc = await vscode.workspace.openTextDocument(txtPath);
      await vscode.window.showTextDocument(doc);

      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand('extension.markdown-pdf.html');
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      assert.ok(!fs.existsSync(txtPath.replace('.txt', '.html')), 'HTML file should not be generated for .txt input');
    } finally {
      safeDelete(txtPath);
    }
  });

  test('should continue conversion when include target is missing', async function () {
    this.timeout(60000);

    const generatedHtmlPath = path.resolve(FIXTURES_DIR, 'include-missing.html');

    try {
      await executeMarkdownPdfCommand('include-missing.md', 'extension.markdown-pdf.html');
      await waitForFile(generatedHtmlPath);

      const generatedHtml = fs.readFileSync(generatedHtmlPath, 'utf-8');
      assert.ok(
        generatedHtml.includes('INCLUDE ERROR'),
        'HTML should contain INCLUDE ERROR for missing file'
      );
      assert.ok(
        generatedHtml.includes('nonexistent.md'),
        'HTML should reference the missing filename'
      );
      assert.ok(
        generatedHtml.includes('<p>After include</p>'),
        'HTML should contain content after the missing include'
      );
    } finally {
      safeDelete(generatedHtmlPath);
    }
  });

  test('should not crash when run on an untitled document', async function () {
    this.timeout(30000);

    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: '# Untitled' });
    await vscode.window.showTextDocument(doc);

    await assert.doesNotReject(async () => {
      await vscode.commands.executeCommand('extension.markdown-pdf.html');
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
  });
});
