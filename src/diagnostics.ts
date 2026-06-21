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
    return '~' + p.slice(homeDir.length);
  }
  return p;
}
