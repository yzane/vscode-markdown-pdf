import { describe, it, mock } from 'node:test';
import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import childProcess from 'child_process';
import MarkdownIt from 'markdown-it';
import { renderDrawioImages, renderDrawioXml, resolveDrawioReference } from '../../src/drawio-renderer';

const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

describe('draw.io rendering', function () {
  it('resolves encoded local filenames and file URLs while leaving normal images and remote URLs alone', function () {
    const markdownPath = path.resolve('documents/main.md');
    const expected = path.resolve('documents/図 面.drawio');
    assert.strictEqual(resolveDrawioReference('%E5%9B%B3%20%E9%9D%A2.drawio', markdownPath), expected);
    assert.strictEqual(resolveDrawioReference(pathToFileURL(expected).href, markdownPath), expected);
    assert.strictEqual(resolveDrawioReference('../diagram.XML', markdownPath), path.resolve('diagram.XML'));
    for (const href of ['https://example.com/diagram.drawio', 'data:image/svg+xml;base64,AAA=', 'image.png']) {
      assert.strictEqual(resolveDrawioReference(href, markdownPath), undefined);
    }
    assert.throws(() => resolveDrawioReference('diagram.drawio#page=2', markdownPath), /fragments/);
  });

  it('requires Desktop configuration and draw.io XML', async function () {
    await assert.rejects(renderDrawioXml(xml, ''), /drawioExecutablePath/);
    await assert.rejects(renderDrawioXml('<other/>', 'drawio'), /mxfile or mxGraphModel/);
  });

  it('embeds duplicate references once, preserves alt text, and cleans up export files', async function () {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-pdf-drawio-test-'));
    const diagramPath = path.join(directory, 'diagram.drawio');
    await fs.writeFile(diagramPath, xml);
    let exportDirectory = '';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>日本語</text></svg>';
    const processMock = mock.method(childProcess, 'execFile', (
      executable: string, args: string[], _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      assert.strictEqual(executable, 'path with spaces/drawio');
      const output = args[args.indexOf('--output') + 1];
      exportDirectory = path.dirname(output);
      void fs.writeFile(output, svg).then(() => callback(null, '', ''), error => callback(error, '', ''));
    });
    try {
      const md = new MarkdownIt();
      const environment = {};
      const tokens = md.parse('![図](diagram.drawio)\n\n> ![second](diagram.drawio)\n\n![normal](image.png)', environment);
      await renderDrawioImages(tokens, path.join(directory, 'main.md'), 'path with spaces/drawio');
      const html = md.renderer.render(tokens, md.options, environment);
      assert.strictEqual(processMock.mock.callCount(), 1);
      assert.strictEqual((html.match(/data:image\/svg\+xml;base64,/g) || []).length, 2);
      assert.ok(html.includes('alt="図"'));
      assert.ok(html.includes('src="image.png"'));
      await assert.rejects(fs.stat(exportDirectory), { code: 'ENOENT' });
    } finally {
      processMock.mock.restore();
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('reports Desktop failures and removes the temporary directory', async function () {
    let exportDirectory = '';
    const processMock = mock.method(childProcess, 'execFile', (
      _executable: string, args: string[], _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      exportDirectory = path.dirname(args[args.indexOf('--output') + 1]);
      callback(new Error('process timed out'), '', 'invalid diagram');
    });
    try {
      await assert.rejects(renderDrawioXml(xml, 'drawio'), /process timed out.*\ninvalid diagram/);
      await assert.rejects(fs.stat(exportDirectory), { code: 'ENOENT' });
    } finally {
      processMock.mock.restore();
    }
  });
});
