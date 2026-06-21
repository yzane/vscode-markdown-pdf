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
