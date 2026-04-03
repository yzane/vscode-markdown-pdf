'use strict';

var fs = require('fs');
var path = require('path');
var PB = require('@puppeteer/browsers');

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

module.exports = {
  findChromiumFromUserSetting: findChromiumFromUserSetting,
  findChromiumFromSystem: findChromiumFromSystem,
  getEdgeAndChromiumCandidates: getEdgeAndChromiumCandidates
};
