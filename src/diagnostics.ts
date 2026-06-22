// Diagnostic formatting helpers. Like logger.ts, this module imports neither
// vscode nor os, so it stays unit-testable under tsx without an editor runtime.
// Host-specific values (versions, home directory) are collected by extension.ts
// and passed in as data.

export interface EnvironmentInfo {
  extensionVersion: string;
  vscodeVersion: string;
  platform: string;          // process.platform, e.g. 'win32'
  osRelease: string;         // os.release()
  arch: string;              // process.arch
  nodeVersion: string;       // process.version
  puppeteerCoreVersion: string;
  expectedChromeBuildId: string;
}

// How the Chromium executable was resolved. Single source of truth for the
// union; chromium-resolver.ts imports this type.
export type ChromiumSource =
  | 'user-setting' | 'system' | 'latest' | 'cached' | 'bundled-fallback';

// Context for a single export invocation. Fields known up front are required;
// values resolved later in exportPdf() are optional and filled in as they become
// available, so the start block and error logs never show a stale path.
export interface ConvertContext {
  sourceFile: string;
  outputType: string;        // pdf/html/png/jpeg
  executablePath: string;    // configured value (may be empty)
  autoDownload: boolean;
  outputDirectory: string;   // configured value (may be empty)
  sanitize: string;
  outputPath?: string;             // filled after getOutputDir() in exportPdf
  resolvedChromiumPath?: string;   // filled in after Chromium resolution
  chromiumSource?: ChromiumSource; // filled in after Chromium resolution
}

// Replace a leading home-directory prefix with '~' (case-insensitive so the
// Windows drive-letter casing C:\ vs c:\ is absorbed). Empty/unmatched input is
// returned unchanged.
export function maskHomePath(p: string, homeDir: string): string {
  if (!p || !homeDir) {
    return p;
  }
  if (p.toLowerCase().startsWith(homeDir.toLowerCase())) {
    const rest = p.slice(homeDir.length);
    // Only mask when the matched prefix ends on a path boundary, so that
    // homeDir "C:\Users\jo" does not mask "C:\Users\john\...".
    if (rest === '' || rest[0] === '/' || rest[0] === '\\') {
      return '~' + rest;
    }
  }
  return p;
}

// Render a value for display, substituting a placeholder for empty/blank input.
export function orNotSet(value: string): string {
  return value && value.trim().length > 0 ? value : '(not set)';
}

export function buildEnvironmentBlock(env: EnvironmentInfo): string {
  return [
    '=== Markdown PDF Diagnostics ===',
    'Extension: ' + env.extensionVersion,
    'VS Code: ' + env.vscodeVersion,
    'OS: ' + env.platform + ' ' + env.osRelease + ' (' + env.arch + ')',
    'Node: ' + env.nodeVersion,
    'puppeteer-core: ' + env.puppeteerCoreVersion,
    'Expected Chrome build: ' + env.expectedChromeBuildId,
  ].join('\n');
}

export function buildContextBlock(ctx: ConvertContext, homeDir: string): string {
  return [
    '--- Convert ---',
    'Source: ' + maskHomePath(ctx.sourceFile, homeDir),
    'Type: ' + ctx.outputType,
    'sanitize: ' + ctx.sanitize,
    'executablePath: ' + orNotSet(maskHomePath(ctx.executablePath, homeDir)),
    'chromium.autoDownload: ' + String(ctx.autoDownload),
    'outputDirectory: ' + orNotSet(maskHomePath(ctx.outputDirectory, homeDir)),
  ].join('\n');
}

export function buildStartDiagnostics(env: EnvironmentInfo, ctx: ConvertContext, homeDir: string): string {
  return buildEnvironmentBlock(env) + '\n' + buildContextBlock(ctx, homeDir);
}

// One-line context summary for error logs (type / output / source / chromium).
// The full block is already emitted at export start, so this only re-states
// which invocation failed.
export function buildContextSummary(ctx: ConvertContext, homeDir: string): string {
  const output = ctx.outputPath ? maskHomePath(ctx.outputPath, homeDir) : '(unresolved)';
  const chromium = ctx.chromiumSource ?? '(unresolved)';
  return 'type=' + ctx.outputType +
    ', source=' + maskHomePath(ctx.sourceFile, homeDir) +
    ', output=' + output +
    ', chromium=' + chromium;
}

// Action a user can take from an error toast. `label` is the button text; `kind`
// selects how extension.ts performs it (open settings / open a URL). Defined here
// (vscode-free) so classifyError can return it without importing the editor API.
export type ErrorActionSpec =
  | { kind: 'settings'; query: string; label: string }
  | { kind: 'url'; url: string; label: string };

export interface ErrorHint {
  hint: string;
  action?: ErrorActionSpec;
}

// Read a Node fs/network error code (e.g. EBUSY) if present; '' otherwise. Null-safe.
function errorCode(error: unknown): string {
  const c = (error as { code?: unknown } | null | undefined)?.code;
  return c != null ? String(c) : '';
}

// Read a message for substring matching. Never throws.
function errorMessageText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Map a thrown export error to a one-line, user-actionable hint (+ optional action
// button). Detection is code-first (stable, locale-independent) with a
// message-substring fallback for wrapped errors. Returns undefined when the error
// is not recognized -- a wrong hint is worse than none. Rule order matters: the
// browser-launch check runs first so a launch failure carrying EACCES is not
// misread as an output-file permission problem.
export function classifyError(error: unknown): ErrorHint | undefined {
  const code = errorCode(error);
  const message = errorMessageText(error);

  // 1. Chromium failed to launch (resolved path exists but the process won't start).
  if (/Failed to launch the browser process/i.test(message) ||
      /Could not find .*(Chrome|Chromium|browser)/i.test(message)) {
    return {
      hint: 'Chromium could not be started. Set a valid Chromium path or enable auto-download.',
      action: { kind: 'settings', query: '@id:markdown-pdf.executablePath', label: 'Open Settings' },
    };
  }

  // 2. Output file locked (open in another app) or no write permission.
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES' ||
      /\bEBUSY\b|\bEPERM\b|\bEACCES\b|being used by another process/i.test(message)) {
    return {
      hint: 'Cannot write the output file. Close it if it is open in another app, then check write permission.',
    };
  }

  // 3. Disk full.
  if (code === 'ENOSPC' || /\bENOSPC\b|no space left/i.test(message)) {
    return {
      hint: 'No space left on the device. Free up disk space and retry.',
    };
  }

  // 4. Output path invalid (missing parent directory, or the path is a directory).
  if (code === 'ENOENT' || code === 'EISDIR' || /\bENOENT\b|\bEISDIR\b/i.test(message)) {
    return {
      hint: 'The output path is invalid. Check the markdown-pdf.outputDirectory setting.',
      action: { kind: 'settings', query: '@id:markdown-pdf.outputDirectory', label: 'Open Settings' },
    };
  }

  return undefined;
}
