// Chromium executable resolver: locates a usable Chrome/Edge binary from
// user-configured path, system install locations, or Puppeteer's managed
// browser cache.
import fs from 'fs';
import path from 'path';
import * as PB from '@puppeteer/browsers';

// PUPPETEER_REVISIONS is a named export on the CJS module but not on the default export type.
// Use require() to access it reliably at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const puppeteerModule: { PUPPETEER_REVISIONS: { chrome: string } } = require('puppeteer-core');

/** Resolves the Chromium executable path from a user-configured setting. */
export function findChromiumFromUserSetting(executablePath: string): string | null {
  if (!executablePath) {
    return null;
  }

  try {
    fs.accessSync(executablePath);
    return executablePath;
  } catch (error) {
    console.warn('[Markdown PDF] Configured executablePath not found: ' + executablePath);
    return null;
  }
}

/** Finds a system-installed Chromium or Edge executable, or null if none is available. */
export function findChromiumFromSystem(): string | null {
  // Why: if Puppeteer's system detection fails, silently fall through to
  // the manual candidate scan below instead of failing the whole lookup.
  try {
    return PB.computeSystemExecutablePath({
      browser: PB.Browser.CHROME,
      channel: PB.ChromeReleaseChannel.STABLE,
      platform: PB.detectBrowserPlatform()
    });
  } catch (error) {
  }

  const candidates = getEdgeAndChromiumCandidates();
  for (let i = 0; i < candidates.length; i++) {
    try {
      fs.accessSync(candidates[i]);
      return candidates[i];
    } catch (error) {
    }
  }

  return null;
}

/** Returns platform-specific candidate paths for Chromium and Edge installs. */
export function getEdgeAndChromiumCandidates(): string[] {
  if (process.platform === 'win32') {
    return getWindowsCandidates();
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
  }

  if (process.platform === 'linux') {
    return [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable'
    ];
  }

  return [];
}

function getWindowsCandidates(): string[] {
  const prefixes = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ];
  const candidates: string[] = [];

  prefixes.forEach(function (prefix) {
    if (!prefix) {
      return;
    }

    candidates.push(path.win32.join(prefix, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    candidates.push(path.win32.join(prefix, 'Chromium', 'Application', 'chrome.exe'));
  });

  return candidates;
}

/** Returns the Chrome build id that the bundled puppeteer-core expects. */
export function getExpectedBuildId(): string {
  return puppeteerModule.PUPPETEER_REVISIONS.chrome;
}

/** Ensures a managed Chromium matching the expected build id exists in cacheDir, downloading it if necessary. */
export async function ensureChromiumDownloaded(
  cacheDir: string,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<string> {
  const buildId = getExpectedBuildId();
  const platform = PB.detectBrowserPlatform();
  let executablePath: string;

  // Why: if the expected build is missing or inaccessible, fall through to
  // PB.install() below rather than propagating the error.
  try {
    executablePath = PB.computeExecutablePath({
      browser: PB.Browser.CHROME,
      buildId: buildId,
      cacheDir: cacheDir,
      platform: platform
    });
    fs.accessSync(executablePath);
    return executablePath;
  } catch (error) {
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const installedBrowser = await PB.install({
    browser: PB.Browser.CHROME,
    buildId: buildId,
    cacheDir: cacheDir,
    platform: platform,
    downloadProgressCallback: onProgress
  });

  await cleanupOldChromium(cacheDir, buildId);

  return installedBrowser.executablePath;
}

/** Removes Chromium builds in cacheDir other than keepBuildId, logging any failures without throwing. */
export async function cleanupOldChromium(cacheDir: string, keepBuildId: string): Promise<void> {
  try {
    const installedBrowsers = await PB.getInstalledBrowsers({ cacheDir: cacheDir });

    for (let i = 0; i < installedBrowsers.length; i++) {
      const installedBrowser = installedBrowsers[i];

      if (installedBrowser.browser !== PB.Browser.CHROME || installedBrowser.buildId === keepBuildId) {
        continue;
      }

      try {
        await PB.uninstall({
          browser: installedBrowser.browser,
          buildId: installedBrowser.buildId,
          cacheDir: cacheDir,
          platform: installedBrowser.platform
        });
        console.log('[Markdown PDF] Removed old Chromium: ' + installedBrowser.buildId);
      } catch (error) {
        console.warn('[Markdown PDF] Failed to remove old Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
      }
    }
  } catch (error) {
    console.warn('[Markdown PDF] Failed to cleanup old Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
  }
}

/** Compares two version strings of the form "MAJOR.MINOR.BUILD.PATCH"; returns negative/zero/positive like Array.sort. */
function compareBuildIds(a: string, b: string): number {
  const partsA = a.split('.').map(function (s) { return parseInt(s, 10) || 0; });
  const partsB = b.split('.').map(function (s) { return parseInt(s, 10) || 0; });
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Returns the executable path of the newest Chrome build cached under cacheDir, or null if none. */
export async function findLatestCachedChromium(cacheDir: string): Promise<string | null> {
  try {
    const installedBrowsers = await PB.getInstalledBrowsers({ cacheDir: cacheDir });
    const chromeBuilds = installedBrowsers.filter(function (b) {
      return b.browser === PB.Browser.CHROME;
    });

    if (chromeBuilds.length === 0) {
      return null;
    }

    chromeBuilds.sort(function (a, b) {
      return compareBuildIds(b.buildId, a.buildId);
    });

    return chromeBuilds[0].executablePath;
  } catch (error) {
    return null;
  }
}

/** Resolves a usable Chromium path by trying user setting, system install, and managed download in order. */
export async function resolveChromiumPath(
  userExecutablePath: string,
  cacheDir: string,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<string | null> {
  let executablePath: string | null = findChromiumFromUserSetting(userExecutablePath);
  if (executablePath) {
    return executablePath;
  }

  executablePath = findChromiumFromSystem();
  if (executablePath) {
    return executablePath;
  }

  try {
    return await ensureChromiumDownloaded(cacheDir, onProgress);
  } catch (error) {
    console.error('[Markdown PDF] Failed to download Chromium: ' + (error && (error as Error).message ? (error as Error).message : error));
    return null;
  }
}
