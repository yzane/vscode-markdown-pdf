'use strict';

var fs = require('fs');
var path = require('path');
var PB = require('@puppeteer/browsers');
var puppeteer = require('puppeteer-core');

function findChromiumFromUserSetting(executablePath) {
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

function findChromiumFromSystem() {
  try {
    return PB.computeSystemExecutablePath({
      browser: PB.Browser.CHROME,
      channel: PB.ChromeReleaseChannel.STABLE,
      platform: PB.detectBrowserPlatform()
    });
  } catch (error) {
  }

  var candidates = getEdgeAndChromiumCandidates();
  for (var i = 0; i < candidates.length; i++) {
    try {
      fs.accessSync(candidates[i]);
      return candidates[i];
    } catch (error) {
    }
  }

  return null;
}

function getEdgeAndChromiumCandidates() {
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

function getWindowsCandidates() {
  var prefixes = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ];
  var candidates = [];

  prefixes.forEach(function (prefix) {
    if (!prefix) {
      return;
    }

    candidates.push(path.win32.join(prefix, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    candidates.push(path.win32.join(prefix, 'Chromium', 'Application', 'chrome.exe'));
  });

  return candidates;
}

function getExpectedBuildId() {
  return puppeteer.PUPPETEER_REVISIONS.chrome;
}

async function ensureChromiumDownloaded(cacheDir, onProgress) {
  var buildId = getExpectedBuildId();
  var platform = PB.detectBrowserPlatform();
  var executablePath;

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

  var installedBrowser = await PB.install({
    browser: PB.Browser.CHROME,
    buildId: buildId,
    cacheDir: cacheDir,
    platform: platform,
    downloadProgressCallback: onProgress
  });

  await cleanupOldChromium(cacheDir, buildId);

  return installedBrowser.executablePath;
}

async function cleanupOldChromium(cacheDir, keepBuildId) {
  try {
    var installedBrowsers = await PB.getInstalledBrowsers({ cacheDir: cacheDir });

    for (var i = 0; i < installedBrowsers.length; i++) {
      var installedBrowser = installedBrowsers[i];

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
        console.warn('[Markdown PDF] Failed to remove old Chromium: ' + (error && error.message ? error.message : error));
      }
    }
  } catch (error) {
    console.warn('[Markdown PDF] Failed to cleanup old Chromium: ' + (error && error.message ? error.message : error));
  }
}

async function resolveChromiumPath(userExecutablePath, cacheDir, onProgress) {
  var executablePath = findChromiumFromUserSetting(userExecutablePath);
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
    console.error('[Markdown PDF] Failed to download Chromium: ' + (error && error.message ? error.message : error));
    return null;
  }
}

module.exports = {
  cleanupOldChromium: cleanupOldChromium,
  ensureChromiumDownloaded: ensureChromiumDownloaded,
  findChromiumFromUserSetting: findChromiumFromUserSetting,
  findChromiumFromSystem: findChromiumFromSystem,
  getEdgeAndChromiumCandidates: getEdgeAndChromiumCandidates,
  getExpectedBuildId: getExpectedBuildId,
  resolveChromiumPath: resolveChromiumPath
};
