// Side-by-side PDF preview. One Chromium instance stays open for the panel lifetime
// and re-renders page.pdf() when the page options or the markdown document change.
import * as vscode from 'vscode';
import fs from 'fs';
import puppeteer, { type PDFOptions } from 'puppeteer-core';
import type { ChromiumFailureReason, ChromiumResolution } from './chromium-resolver';
import * as logger from './logger';
import * as pdfPageOptions from './pdf-page-options';
import * as utils from './utils';

const PREVIEW_DEBOUNCE_MS = 400;
const CLOSE_BROWSER_TIMEOUT_MS = 5000;

export interface PdfPreviewHost {
  extensionUri: vscode.Uri;
  document: vscode.TextDocument;
  buildHtml(): string | undefined;
  resolveChromium(): Promise<ChromiumResolution>;
  reportChromiumUnavailable(reason: ChromiumFailureReason): string;
  outputPath(): string | undefined;
  initialForm(): pdfPageOptions.PdfPreviewForm;
  saveDefaults(form: pdfPageOptions.PdfPreviewForm): Promise<void>;
  reportFailure(operation: string, error?: unknown): void;
  statusTimeoutMs(): number;
}

interface CachedPdf {
  key: string;
  bytes: Uint8Array;
}

let active: { uri: string; panel: vscode.WebviewPanel } | undefined;

/** Opens the preview beside the editor. Re-running the command reveals the panel for the same file. */
export function openPdfPreviewPanel(host: PdfPreviewHost): void {
  const documentUri = host.document.uri.toString();
  if (active && active.uri === documentUri) {
    active.panel.reveal(vscode.ViewColumn.Beside);
    return;
  }
  if (active) {
    active.panel.dispose();
  }

  const panel = vscode.window.createWebviewPanel(
    'markdownPdf.preview',
    'PDF Preview: ' + host.document.fileName.split(/[/\\]/).pop(),
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(host.extensionUri, 'node_modules', 'pdfjs-dist')],
    }
  );
  active = { uri: documentUri, panel };

  const pdfjsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(
    host.extensionUri, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.mjs'
  ));
  const workerUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(
    host.extensionUri, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'
  ));
  const cMapUri = directoryUri(panel, host, 'cmaps');
  const fontUri = directoryUri(panel, host, 'standard_fonts');
  panel.webview.html = previewHtml(panel.webview, pdfjsUri, workerUri, cMapUri, fontUri, activeColorScheme());

  let currentForm = host.initialForm();
  let htmlDirty = true;
  let htmlRevision = 0;
  let tmpfilename: string | undefined;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>> | undefined;
  let cached: CachedPdf | undefined;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();

  const post = function (message: unknown): void {
    if (!disposed) {
      panel.webview.postMessage(message);
    }
  };

  const enqueue = function (task: () => Promise<void>): Promise<void> {
    const run = chain.then(task, task);
    chain = run.then(function () { return undefined; }, function () { return undefined; });
    return run;
  };

  const producePdf = async function (): Promise<Uint8Array | undefined> {
    if (disposed) {
      return;
    }
    const form = currentForm;
    try {
      if (htmlDirty || !page) {
        const html = host.buildHtml();
        if (!html) {
          post({ type: 'status', state: 'error', message: 'Failed to convert Markdown to HTML.' });
          return;
        }
        tmpfilename = utils.generateTmpHtmlFilename(host.document.uri.fsPath);
        fs.writeFileSync(tmpfilename, html, 'utf-8');
        const ready = await ensureBrowser();
        if (!ready || !page || disposed) {
          return;
        }
        await page.goto(vscode.Uri.file(tmpfilename).toString(), { waitUntil: 'networkidle0' });
        htmlDirty = false;
        htmlRevision += 1;
      }
      if (!page || disposed) {
        return;
      }
      const key = htmlRevision + '\n' + JSON.stringify(pdfPageOptions.formToPdfConfig(form));
      if (cached && cached.key === key) {
        post({ type: 'status', state: 'ready', message: 'Preview is up to date.' });
        return cached.bytes;
      }
      post({ type: 'status', state: 'rendering', message: 'Rendering…' });
      const bytes = await page.pdf(utils.buildPdfOptions(pdfPageOptions.formToPdfConfig(form)) as PDFOptions);
      if (disposed) {
        return;
      }
      cached = { key: key, bytes: bytes };
      post({ type: 'pdf', base64: Buffer.from(bytes).toString('base64') });
      post({ type: 'status', state: 'ready', message: 'Preview is up to date.' });
      return bytes;
    } catch (error) {
      host.reportFailure('Failed to render the PDF preview.', error);
      post({ type: 'status', state: 'error', message: 'Failed to render the PDF preview.' });
      return;
    }
  };

  const ensureBrowser = async function (): Promise<boolean> {
    if (browser && page) {
      return true;
    }
    const resolution = await host.resolveChromium();
    if (!resolution.ok) {
      const message = host.reportChromiumUnavailable(resolution.reason);
      post({ type: 'status', state: 'error', message: message });
      return false;
    }
    browser = await puppeteer.launch({
      executablePath: resolution.path,
      args: ['--lang=' + vscode.env.language, '--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    page.on('dialog', async function (dialog) {
      const info = '(' + dialog.type() + '): ' + dialog.message();
      try {
        await dialog.dismiss();
        logger.logWarn('Dismissed a blocking dialog during rendering ' + info);
      } catch (error) {
        logger.logWarn('Failed to dismiss a blocking dialog during rendering ' + info + ' - ' + (error instanceof Error ? error.message : String(error)));
      }
    });
    await page.setDefaultTimeout(0);
    return true;
  };

  const scheduleRender = function (): void {
    if (timer) {
      clearTimeout(timer);
    }
    post({ type: 'status', state: 'rendering', message: 'Rendering…' });
    timer = setTimeout(function () {
      timer = undefined;
      void enqueue(async function () { await producePdf(); });
    }, PREVIEW_DEBOUNCE_MS);
  };

  const publishForm = function (form: pdfPageOptions.PdfPreviewForm): boolean {
    currentForm = form;
    const errors = pdfPageOptions.validatePreviewForm(form);
    post({ type: 'validation', errors: errors });
    if (pdfPageOptions.hasPreviewFieldErrors(errors)) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      post({ type: 'status', state: 'error', message: 'Fix the highlighted fields before the preview can update.' });
      return false;
    }
    return true;
  };

  const themeListener = vscode.window.onDidChangeActiveColorTheme(function () {
    post({ type: 'theme', colorScheme: activeColorScheme() });
  });

  const documentListener = vscode.workspace.onDidChangeTextDocument(function (event) {
    if (event.document.uri.toString() !== documentUri || event.contentChanges.length === 0) {
      return;
    }
    htmlDirty = true;
    if (!pdfPageOptions.hasPreviewFieldErrors(pdfPageOptions.validatePreviewForm(currentForm))) {
      scheduleRender();
    }
  });

  panel.webview.onDidReceiveMessage(async function (message: { type?: string; form?: unknown }) {
    if (message.type === 'ready') {
      post({
        type: 'init',
        form: currentForm,
        headerPresetHtml: pdfPageOptions.FILENAME_AND_DATE_HEADER,
        footerPresetHtml: pdfPageOptions.PAGE_NUMBER_FOOTER,
        colorScheme: activeColorScheme(),
      });
      if (!publishForm(currentForm)) {
        return;
      }
      post({ type: 'status', state: 'rendering', message: 'Rendering…' });
      void enqueue(async function () { await producePdf(); });
      return;
    }
    if (message.type === 'options') {
      const form = pdfPageOptions.parsePreviewForm(message.form);
      if (!form) {
        return;
      }
      if (!publishForm(form)) {
        return;
      }
      scheduleRender();
      return;
    }
    if (message.type === 'export') {
      if (!publishForm(currentForm)) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      await enqueue(async function () {
        const outputPath = host.outputPath();
        if (!outputPath) {
          return;
        }
        const bytes = await producePdf();
        if (!bytes) {
          return;
        }
        try {
          fs.writeFileSync(outputPath, bytes);
        } catch (error) {
          host.reportFailure('Failed to write the PDF file.', error);
          post({ type: 'status', state: 'error', message: 'Failed to write the PDF file.' });
          return;
        }
        vscode.window.setStatusBarMessage('$(markdown) ' + outputPath, host.statusTimeoutMs());
        post({ type: 'status', state: 'notice', message: 'Exported.' });
      });
      return;
    }
    if (message.type === 'saveDefaults') {
      if (!publishForm(currentForm)) {
        return;
      }
      try {
        await host.saveDefaults(currentForm);
        vscode.window.showInformationMessage('Markdown PDF: saved the preview options as your defaults.');
      } catch (error) {
        host.reportFailure('Failed to save the preview options.', error);
      }
    }
  });

  panel.onDidDispose(function () {
    disposed = true;
    if (active && active.panel === panel) {
      active = undefined;
    }
    if (timer) {
      clearTimeout(timer);
    }
    documentListener.dispose();
    themeListener.dispose();
    void closeBrowser(browser);
    browser = undefined;
    page = undefined;
    const debug = vscode.workspace.getConfiguration('markdown-pdf')['debug'] || false;
    if (!debug && tmpfilename && utils.isExistsPath(tmpfilename)) {
      try {
        fs.rmSync(tmpfilename, { recursive: true, force: true });
      } catch (error) {
        logger.logWarn('Failed to delete temporary HTML after preview: ' + logger.formatError(error));
      }
    }
  });
}

function directoryUri(panel: vscode.WebviewPanel, host: PdfPreviewHost, folder: string): string {
  const uri = panel.webview.asWebviewUri(vscode.Uri.joinPath(
    host.extensionUri, 'node_modules', 'pdfjs-dist', folder
  )).toString();
  return uri.endsWith('/') ? uri : uri + '/';
}

async function closeBrowser(browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined): Promise<void> {
  if (!browser) {
    return;
  }
  try {
    const closeResult = await utils.awaitWithTimeout(browser.close(), CLOSE_BROWSER_TIMEOUT_MS);
    if (closeResult.timedOut) {
      logger.logWarn('Timed out while closing Chromium after preview; continuing.');
    }
  } catch (error) {
    logger.logWarn('Failed to close Chromium after preview: ' + logger.formatError(error));
  }
}

function activeColorScheme(): 'light' | 'dark' {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight) {
    return 'light';
  }
  return 'dark';
}

function previewHtml(
  webview: vscode.Webview,
  pdfjsUri: vscode.Uri,
  workerUri: vscode.Uri,
  cMapUri: string,
  fontUri: string,
  colorScheme: 'light' | 'dark'
): string {
  const nonce = createNonce();
  const csp = [
    "default-src 'none'",
    "img-src " + webview.cspSource + " data: blob:",
    "style-src 'unsafe-inline'",
    "script-src 'nonce-" + nonce + "' 'wasm-unsafe-eval' " + webview.cspSource,
    "worker-src " + webview.cspSource,
    "connect-src " + webview.cspSource,
    "font-src " + webview.cspSource + " data:",
  ].join('; ');
  const config = JSON.stringify({
    pdfjs: pdfjsUri.toString(),
    worker: workerUri.toString(),
    cMapUrl: cMapUri,
    standardFontDataUrl: fontUri,
  });
  const formats = pdfPageOptions.PAPER_FORMATS.map(function (format) {
    return '<option value="' + format + '">' + format + '</option>';
  }).join('');

  return `<!DOCTYPE html>
<html lang="en" style="color-scheme: ${colorScheme}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PDF Preview</title>
<style>
  body { margin: 0; height: 100vh; display: flex; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
  #controls { width: 320px; flex: 0 0 320px; overflow: auto; padding: 12px; box-sizing: border-box; border-right: 1px solid var(--vscode-panel-border); }
  #preview { flex: 1; overflow: auto; padding: 16px; box-sizing: border-box; background: var(--vscode-editor-inactiveSelectionBackground, rgba(128,128,128,0.08)); }
  h2 { margin: 0 0 8px; font-size: 1.05em; font-weight: 600; }
  p.note { margin: 0 0 12px; opacity: 0.85; font-size: 0.92em; }
  label { display: block; margin: 8px 0 4px; }
  input[type="text"], input[type="number"], textarea { width: 100%; box-sizing: border-box; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); padding: 4px 6px; font: inherit; }
  select, select option { width: 100%; box-sizing: border-box; color: var(--vscode-dropdown-foreground); background-color: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border, transparent); padding: 4px 6px; font: inherit; }
  input.invalid, textarea.invalid, select.invalid { border-color: var(--vscode-inputValidation-errorBorder); background-color: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground, var(--vscode-input-foreground)); }
  .field-error { color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground)); font-size: 0.85em; margin: 2px 0 0; }
  input:disabled, textarea:disabled, select:disabled { opacity: 0.55; }
  textarea { min-height: 72px; resize: vertical; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .check { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
  .check input { width: auto; }
  .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
  button { font: inherit; padding: 6px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: none; cursor: pointer; }
  button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  #status { margin-bottom: 12px; }
  canvas { display: block; margin: 0 auto 16px; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.35); max-width: 100%; height: auto; }
</style>
</head>
<body>
  <form id="controls">
    <h2>PDF options</h2>
    <p class="note">These are the PDF settings for this export. A custom width or height overrides the paper size. Nothing is written to Settings unless you choose Save as my defaults.</p>
    <label for="format">Paper size</label>
    <select id="format">${formats}</select>
    <div class="row">
      <div>
        <label for="width">Width</label>
        <input id="width" type="text" placeholder="e.g. 210mm" spellcheck="false">
      </div>
      <div>
        <label for="height">Height</label>
        <input id="height" type="text" placeholder="e.g. 297mm" spellcheck="false">
      </div>
    </div>
    <label for="orientation">Orientation</label>
    <select id="orientation">
      <option value="portrait">Portrait</option>
      <option value="landscape">Landscape</option>
    </select>
    <div class="row">
      <div>
        <label for="marginTop">Margin top</label>
        <input id="marginTop" type="text" spellcheck="false">
      </div>
      <div>
        <label for="marginBottom">Margin bottom</label>
        <input id="marginBottom" type="text" spellcheck="false">
      </div>
    </div>
    <div class="row">
      <div>
        <label for="marginLeft">Margin left</label>
        <input id="marginLeft" type="text" spellcheck="false">
      </div>
      <div>
        <label for="marginRight">Margin right</label>
        <input id="marginRight" type="text" spellcheck="false">
      </div>
    </div>
    <label for="scale">Scale</label>
    <input id="scale" type="number" min="0.1" max="2" step="0.1">
    <label class="check"><input id="printBackground" type="checkbox"> Print background graphics</label>
    <p class="note">Includes background colors and images from the Markdown. Turn this off to print the text on a plain white page.</p>
    <label for="pageRanges">Page ranges</label>
    <input id="pageRanges" type="text" placeholder="e.g. 1-5, 8" spellcheck="false">
    <label class="check"><input id="displayHeaderFooter" type="checkbox"> Show header and footer</label>
    <p class="note">Turn this off to hide both, and to lock the choices below. None hides only the header or only the page numbers. Page numbers use pageNumber and totalPages. Header and footer HTML can also use title, url, and date.</p>
    <label for="footerChoice">Page numbers</label>
    <select id="footerChoice">
      <option value="none">None</option>
      <option value="page-numbers">1 / N</option>
      <option value="custom">Custom HTML</option>
    </select>
    <textarea id="footerCustom" hidden spellcheck="false"></textarea>
    <label for="headerChoice">Header</label>
    <select id="headerChoice">
      <option value="none">None</option>
      <option value="filename-date">Filename and date</option>
      <option value="custom">Custom HTML</option>
    </select>
    <textarea id="headerCustom" hidden spellcheck="false"></textarea>
    <div class="actions">
      <button id="export" type="button">Export PDF</button>
      <button id="saveDefaults" class="secondary" type="button">Save as my defaults</button>
    </div>
  </form>
  <div id="preview">
    <div id="status">Opening preview…</div>
    <div id="pages"></div>
  </div>
  <script type="module" nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const config = ${config};
    document.getElementById('controls').addEventListener('submit', (event) => event.preventDefault());
    let pdfjs;
    try {
      pdfjs = await import(config.pdfjs);
    } catch (error) {
      document.getElementById('status').textContent = 'Failed to load the PDF viewer. ' + (error && error.message ? error.message : String(error));
      throw error;
    }
    pdfjs.GlobalWorkerOptions.workerSrc = config.worker;

    const ids = ['format','width','height','orientation','marginTop','marginBottom','marginLeft','marginRight','scale','pageRanges','footerChoice','footerCustom','headerChoice','headerCustom'];
    let headerPresetHtml = '';
    let footerPresetHtml = '';
    let applying = false;
    let loadingTask;

    function field(id) { return document.getElementById(id); }

    function updateCustomVisibility() {
      field('footerCustom').hidden = field('footerChoice').value !== 'custom';
      field('headerCustom').hidden = field('headerChoice').value !== 'custom';
    }

    function readForm() {
      const scaleText = field('scale').value.trim();
      const scale = Number(scaleText);
      return {
        format: field('format').value,
        width: field('width').value,
        height: field('height').value,
        orientation: field('orientation').value,
        scale: scaleText !== '' && Number.isFinite(scale) ? scale : null,
        displayHeaderFooter: field('displayHeaderFooter').checked,
        headerChoice: field('headerChoice').value,
        headerCustom: field('headerCustom').value,
        footerChoice: field('footerChoice').value,
        footerCustom: field('footerCustom').value,
        printBackground: field('printBackground').checked,
        pageRanges: field('pageRanges').value,
        marginTop: field('marginTop').value,
        marginRight: field('marginRight').value,
        marginBottom: field('marginBottom').value,
        marginLeft: field('marginLeft').value,
      };
    }

    function applyForm(form) {
      applying = true;
      field('format').value = form.format;
      if (field('format').value !== form.format) {
        const option = document.createElement('option');
        option.value = form.format;
        option.textContent = form.format;
        field('format').appendChild(option);
        field('format').value = form.format;
      }
      for (const id of ids) {
        if (field(id) && id !== 'format' && id !== 'scale') {
          field(id).value = form[id] ?? '';
        }
      }
      field('scale').value = String(form.scale);
      field('displayHeaderFooter').checked = form.displayHeaderFooter === true;
      field('printBackground').checked = form.printBackground === true;
      updateCustomVisibility();
      updateHeaderFooterEnabled();
      applying = false;
    }

    function updateHeaderFooterEnabled() {
      const enabled = field('displayHeaderFooter').checked;
      field('headerChoice').disabled = !enabled;
      field('footerChoice').disabled = !enabled;
      field('headerCustom').disabled = !enabled;
      field('footerCustom').disabled = !enabled;
    }

    const validatedFields = ['width','height','marginTop','marginBottom','marginLeft','marginRight','scale','pageRanges','headerCustom','footerCustom'];
    for (const id of validatedFields) {
      const note = document.createElement('p');
      note.id = id + '-error';
      note.className = 'field-error';
      note.hidden = true;
      field(id).insertAdjacentElement('afterend', note);
    }

    function showErrors(errors) {
      for (const id of validatedFields) {
        const message = errors && errors[id] ? errors[id] : '';
        field(id).classList.toggle('invalid', Boolean(message));
        field(id).setAttribute('aria-invalid', message ? 'true' : 'false');
        const note = document.getElementById(id + '-error');
        note.textContent = message;
        note.hidden = !message;
      }
    }

    function postOptions() {
      if (applying) return;
      vscode.postMessage({ type: 'options', form: readForm() });
    }

    function setStatus(text) {
      document.getElementById('status').textContent = text;
    }

    field('headerChoice').addEventListener('change', () => {
      if (field('headerChoice').value === 'custom' && field('headerCustom').value.trim() === '') {
        field('headerCustom').value = headerPresetHtml;
      }
      updateCustomVisibility();
      postOptions();
    });
    field('footerChoice').addEventListener('change', () => {
      if (field('footerChoice').value === 'custom' && field('footerCustom').value.trim() === '') {
        field('footerCustom').value = footerPresetHtml;
      }
      updateCustomVisibility();
      postOptions();
    });
    for (const id of ids) {
      if (id === 'headerChoice' || id === 'footerChoice') continue;
      field(id).addEventListener('input', postOptions);
      field(id).addEventListener('change', postOptions);
    }
    field('displayHeaderFooter').addEventListener('change', () => {
      updateHeaderFooterEnabled();
      postOptions();
    });
    field('printBackground').addEventListener('change', postOptions);
    document.getElementById('export').addEventListener('click', () => vscode.postMessage({ type: 'export' }));
    document.getElementById('saveDefaults').addEventListener('click', () => vscode.postMessage({ type: 'saveDefaults' }));

    async function showPdf(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (loadingTask) {
        try { await loadingTask.destroy(); } catch (error) { /* a replaced render can already be destroyed */ }
      }
      const task = pdfjs.getDocument({
        data: bytes,
        cMapUrl: config.cMapUrl,
        cMapPacked: true,
        standardFontDataUrl: config.standardFontDataUrl,
      });
      loadingTask = task;
      const pdf = await task.promise;
      const pages = document.getElementById('pages');
      pages.replaceChildren();
      for (let i = 1; i <= pdf.numPages; i++) {
        const pdfPage = await pdf.getPage(i);
        const viewport = pdfPage.getViewport({ scale: 1.25 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        pages.appendChild(canvas);
        await pdfPage.render({ canvasContext: context, viewport }).promise;
      }
      setStatus(pdf.numPages === 1 ? '1 page' : pdf.numPages + ' pages');
    }

    window.addEventListener('message', async (event) => {
      const message = event.data;
      if (message.type === 'init') {
        headerPresetHtml = message.headerPresetHtml || '';
        footerPresetHtml = message.footerPresetHtml || '';
        if (message.colorScheme) document.documentElement.style.colorScheme = message.colorScheme;
        applyForm(message.form);
        return;
      }
      if (message.type === 'theme' && message.colorScheme) {
        document.documentElement.style.colorScheme = message.colorScheme;
        return;
      }
      if (message.type === 'validation') {
        showErrors(message.errors || {});
        return;
      }
      if (message.type === 'status') {
        if (message.state === 'ready') return;
        setStatus(message.message || '');
        return;
      }
      if (message.type === 'pdf') {
        try {
          await showPdf(message.base64);
        } catch (error) {
          setStatus('Failed to draw the PDF preview.');
        }
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
