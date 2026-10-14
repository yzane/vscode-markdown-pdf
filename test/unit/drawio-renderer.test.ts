import { describe, it, mock } from 'node:test';
import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import childProcess from 'child_process';
import MarkdownIt from 'markdown-it';
import { renderDrawioBlocks, renderDrawioXml } from '../../src/drawio-renderer';

const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

describe('draw.io rendering', function () {
  it('does not require Desktop for ordinary code blocks or image references', async function () {
    const md = new MarkdownIt();
    const environment = {};
    const source = '```xml\n<mxGraphModel/>\n```\n\n![diagram](example.drawio)';
    const tokens = md.parse(source, environment);
    await renderDrawioBlocks(tokens, '');
    assert.strictEqual(md.renderer.render(tokens, md.options, environment), md.render(source));
  });

  it('requires Desktop configuration and draw.io XML', async function () {
    await assert.rejects(renderDrawioXml(xml, ''), /drawioExecutablePath/);
    await assert.rejects(renderDrawioXml('<other/>', 'drawio'), /mxfile or mxGraphModel/);
  });

  it('renders duplicate fences once and preserves ordinary code and image references', async function () {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-pdf-drawio-test-'));
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
      const tokens = md.parse('```drawio\n' + xml + '\n```\n\n> ~~~DRAWIO\n> ' + xml + '\n> ~~~\n\n```xml\n<other/>\n```\n\n![normal](image.png)\n![diagram](diagram.drawio)', environment);
      await renderDrawioBlocks(tokens, 'path with spaces/drawio');
      const html = md.renderer.render(tokens, md.options, environment);
      assert.strictEqual(processMock.mock.callCount(), 1);
      assert.strictEqual((html.match(/data:image\/svg\+xml;base64,/g) || []).length, 2);
      assert.ok(html.includes('alt="draw.io diagram"'));
      assert.ok(html.includes('src="diagram.drawio"'));
      assert.ok(html.includes('&lt;other/&gt;'));
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
