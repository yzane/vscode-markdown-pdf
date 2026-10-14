import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { execFile } from 'child_process';
import type Token from 'markdown-it/lib/token.mjs';

/** Exports XML using the official Desktop renderer in an isolated temporary profile. */
export async function renderDrawioXml(xml: string, executablePath: string): Promise<string> {
  if (!executablePath.trim()) {
    throw new Error('Set markdown-pdf.drawioExecutablePath to the draw.io Desktop executable to render draw.io XML');
  }
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<(?:mxfile|mxGraphModel)\b/.test(xml.replace(/^\uFEFF/, ''))) {
    throw new Error('Expected draw.io XML with an mxfile or mxGraphModel root');
  }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-pdf-drawio-'));
  try {
    const inputPath = path.join(directory, 'diagram.drawio');
    const outputPath = path.join(directory, 'diagram.svg');
    await fs.writeFile(inputPath, xml, 'utf8');
    await new Promise<void>((resolve, reject) => {
      execFile(executablePath, [
        '--export', '--format', 'svg', '--output', outputPath,
        '--page-index', '1', '--embed-svg-images', '--embed-svg-fonts', 'false',
        '--disable-update', '--user-data-dir=' + path.join(directory, 'profile'), inputPath,
      ], { windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 }, (error, _stdout, stderr) => {
        if (error) {
          reject(new Error('draw.io Desktop export failed: ' + error.message + (stderr ? '\n' + stderr.trim() : '')));
        } else {
          resolve();
        }
      });
    });
    const svg = await fs.readFile(outputPath, 'utf8');
    if (!/<svg\b/.test(svg)) throw new Error('draw.io Desktop did not produce SVG output');
    return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

/** Renders drawio fences before synchronous Markdown rendering. */
export async function renderDrawioBlocks(tokens: Token[], executablePath: string): Promise<void> {
  const cache = new Map<string, string>();
  async function visit(items: Token[]): Promise<void> {
    for (const token of items) {
      if (token.type === 'fence' && token.info.trim().toLowerCase() === 'drawio') {
        const xml = token.content;
        let source = cache.get(xml);
        if (!source) {
          source = await renderDrawioXml(xml, executablePath);
          cache.set(xml, source);
        }
        token.type = 'html_block';
        token.tag = '';
        token.content = '<p><img src="' + source + '" alt="draw.io diagram"></p>\n';
      }
      if (token.children) await visit(token.children);
    }
  }
  await visit(tokens);
}
