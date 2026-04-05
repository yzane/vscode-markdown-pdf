'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var PB = require('@puppeteer/browsers');
var chromiumResolver = require('../../src/chromium-resolver');

describe('chromium-resolver', function () {
  var tmpDir;
  var existingExecutablePath;
  var missingExecutablePath;

  before(function () {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-chromium-resolver-'));
    existingExecutablePath = path.join(tmpDir, 'chromium');
    fs.writeFileSync(existingExecutablePath, '#!/bin/sh\nexit 0\n', 'utf-8');
    missingExecutablePath = path.join(tmpDir, 'missing-chromium');
  });

  after(function () {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('findChromiumFromUserSetting', function () {
    it('should return the path when it exists', function () {
      assert.strictEqual(chromiumResolver.findChromiumFromUserSetting(existingExecutablePath), existingExecutablePath);
    });

    it('should return null when path does not exist', function () {
      assert.strictEqual(chromiumResolver.findChromiumFromUserSetting(missingExecutablePath), null);
    });

    it('should return null for empty string', function () {
      assert.strictEqual(chromiumResolver.findChromiumFromUserSetting(''), null);
    });
  });

  describe('findChromiumFromSystem', function () {
    it('should return a string or null', function () {
      var result = chromiumResolver.findChromiumFromSystem();
      assert.ok(typeof result === 'string' || result === null);
    });
  });

  describe('getExpectedBuildId', function () {
    it('should return a non-empty build id string', function () {
      var buildId = chromiumResolver.getExpectedBuildId();
      assert.strictEqual(typeof buildId, 'string');
      assert.match(buildId, /^\d+\.\d+\.\d+\.\d+$/);
    });
  });

  describe('cleanupOldChromium', function () {
    it('should not reject when the cache directory does not exist', async function () {
      await chromiumResolver.cleanupOldChromium('/nonexistent/cache/dir', 'keep-this-id');
    });

    it('should uninstall only old Chromium entries', async function () {
      var originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      var originalUninstall = Object.getOwnPropertyDescriptor(PB, 'uninstall');
      var uninstallCalls = [];

      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          return [
            { browser: PB.Browser.CHROME, buildId: 'keep-this-id', platform: 'linux' },
            { browser: PB.Browser.CHROME, buildId: 'old-chrome-id', platform: 'linux' },
            { browser: PB.Browser.FIREFOX, buildId: 'old-firefox-id', platform: 'linux' }
          ];
        }
      });

      Object.defineProperty(PB, 'uninstall', {
        configurable: true,
        enumerable: true,
        value: async function (options) {
          uninstallCalls.push(options);
        }
      });

      try {
        await chromiumResolver.cleanupOldChromium('/tmp/chromium-cache', 'keep-this-id');
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers);
        Object.defineProperty(PB, 'uninstall', originalUninstall);
      }

      assert.deepStrictEqual(uninstallCalls, [
        {
          browser: PB.Browser.CHROME,
          buildId: 'old-chrome-id',
          cacheDir: '/tmp/chromium-cache',
          platform: 'linux'
        }
      ]);
    });
  });
});
