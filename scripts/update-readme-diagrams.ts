import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import puppeteer from 'puppeteer-core';
import { resolveChromiumPath } from '../src/chromium-resolver';
import {
  buildMermaidRenderHtml,
  buildPlantumlImageUrl,
  extractReadmeDiagramSources,
} from '../src/readme-diagrams';

const ROOT = process.cwd();
const README_PATH = path.resolve(ROOT, 'README.md');
const IMAGES_DIR = path.resolve(ROOT, 'images');
const PLANTUML_PNG_PATH = path.resolve(IMAGES_DIR, 'PlantUML.png');
const MERMAID_PNG_PATH = path.resolve(IMAGES_DIR, 'mermaid.png');
const PLANTUML_SERVER = 'http://www.plantuml.com/plantuml';
const MERMAID_SCRIPT_URL = 'https://unpkg.com/mermaid/dist/mermaid.min.js';
const CHROMIUM_CACHE_DIR = path.resolve(ROOT, '.tmp', 'readme-diagrams', 'chromium');

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const cause = 'cause' in error ? (error as Error & { cause?: unknown }).cause : undefined;
    if (cause instanceof Error && cause.message) {
      return error.message + ': ' + cause.message;
    }

    return error.message;
  }

  return String(error);
}

async function updatePlantumlDiagram(plantumlSource: string): Promise<string> {
  const imageUrl = buildPlantumlImageUrl(plantumlSource, PLANTUML_SERVER).replace('/svg/', '/png/');
  let response: Response;

  try {
    response = await fetch(imageUrl);
  } catch (error) {
    throw new Error('Failed to fetch PlantUML image from ' + imageUrl + ': ' + formatError(error));
  }

  if (!response.ok) {
    throw new Error(
      'Failed to fetch PlantUML image: ' + response.status + ' ' + response.statusText
    );
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(PLANTUML_PNG_PATH, imageBuffer);

  return path.relative(ROOT, PLANTUML_PNG_PATH);
}

async function updateMermaidDiagram(mermaidSource: string): Promise<string> {
  const executablePath = await resolveChromiumPath('', CHROMIUM_CACHE_DIR);

  if (!executablePath) {
    throw new Error('Chromium executable could not be resolved');
  }

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const html = buildMermaidRenderHtml(mermaidSource, MERMAID_SCRIPT_URL);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-readme-diagrams-'));
  const tempHtmlPath = path.join(tempDir, 'mermaid.html');
  fs.writeFileSync(tempHtmlPath, html);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.mermaid svg', { timeout: 30000 });

    const diagram = await page.$('.mermaid');
    if (!diagram) {
      throw new Error('Mermaid container not found');
    }

    await diagram.screenshot({ path: MERMAID_PNG_PATH });
  } finally {
    await browser.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return path.relative(ROOT, MERMAID_PNG_PATH);
}

async function main(): Promise<void> {
  const markdown = fs.readFileSync(README_PATH, 'utf-8');
  const { plantuml, mermaid } = extractReadmeDiagramSources(markdown);
  const updatedFiles = [
    await updatePlantumlDiagram(plantuml),
    await updateMermaidDiagram(mermaid),
  ];

  updatedFiles.forEach(function (updatedFile) {
    console.log('Updated ' + updatedFile);
  });
}

main().catch(function (error: unknown) {
  console.error('[update-readme-diagrams] ' + formatError(error));
  process.exit(1);
});
