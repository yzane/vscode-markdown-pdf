import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import type Token from 'markdown-it/lib/token.mjs';

/** Resolves local draw.io image references without fetching remote URLs. */
export function resolveDrawioReference(href: string, markdownPath: string): string | undefined {
  let filename: string;
  if (/^file:/i.test(href)) {
    const uri = new URL(href);
    if (uri.search || uri.hash) throw new Error('draw.io references do not support queries or fragments');
    filename = fileURLToPath(uri);
  } else {
    if (/^[a-z][a-z\d+.-]*:/i.test(href) && !path.isAbsolute(href)) return undefined;
    if (/[?#]/.test(href)) {
      if (/\.(drawio|xml)(?:[?#]|$)/i.test(href)) {
        throw new Error('draw.io references do not support queries or fragments');
      }
      return undefined;
    }
    filename = path.resolve(path.dirname(markdownPath), decodeURIComponent(href));
  }
  return /\.(drawio|xml)$/i.test(filename) ? filename : undefined;
}

/** Exports XML using the official Desktop renderer in an isolated temporary profile. */
export async function renderDrawioXml(xml: string, executablePath: string, sourcePath?: string): Promise<string> {
  if (!executablePath.trim()) {
    throw new Error('Set markdown-pdf.drawioExecutablePath to the draw.io Desktop executable to render draw.io XML');
  }
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<(?:mxfile|mxGraphModel)\b/.test(xml.replace(/^\uFEFF/, ''))) {
    throw new Error('Expected draw.io XML with an mxfile or mxGraphModel root');
  }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-pdf-drawio-'));
  try {
    const inputPath = sourcePath || path.join(directory, 'diagram.drawio');
    const outputPath = path.join(directory, 'diagram.svg');
    if (!sourcePath) await fs.writeFile(inputPath, xml, 'utf8');
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

/** Replaces diagram image sources before synchronous Markdown rendering. */
export async function renderDrawioImages(tokens: Token[], markdownPath: string, executablePath: string): Promise<void> {
  const cache = new Map<string, string>();
  async function visit(items: Token[]): Promise<void> {
    for (const token of items) {
      if (token.type === 'image') {
        const filename = resolveDrawioReference(token.attrGet('src') || '', markdownPath);
        if (filename) {
          let source = cache.get(filename);
          if (!source) {
            source = await renderDrawioXml(await fs.readFile(filename, 'utf8'), executablePath, filename);
            cache.set(filename, source);
          }
          token.attrSet('src', source);
        }
      }
      if (token.children) await visit(token.children);
    }
  }
  await visit(tokens);
}
