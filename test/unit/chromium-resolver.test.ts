import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
// Use require() to get a mutable CJS object for monkey-patching in tests
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PB: typeof import('@puppeteer/browsers') = require('@puppeteer/browsers');
import * as chromiumResolver from '../../src/chromium-resolver';

describe('chromium-resolver', function () {
  let tmpDir: string;
  let existingExecutablePath: string;
  let missingExecutablePath: string;

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
      const result = chromiumResolver.findChromiumFromSystem();
      assert.ok(typeof result === 'string' || result === null);
    });
  });

  describe('getExpectedBuildId', function () {
    it('should return a non-empty build id string', function () {
      const buildId = chromiumResolver.getExpectedBuildId();
      assert.strictEqual(typeof buildId, 'string');
      assert.match(buildId, /^\d+\.\d+\.\d+\.\d+$/);
    });
  });

  describe('cleanupOldChromium', function () {
    it('should not reject when the cache directory does not exist', async function () {
      await chromiumResolver.cleanupOldChromium('/nonexistent/cache/dir', 'keep-this-id');
    });

    it('should uninstall only old Chromium entries', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalUninstall = Object.getOwnPropertyDescriptor(PB, 'uninstall');
      const uninstallCalls: unknown[] = [];

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
        value: async function (options: unknown) {
          uninstallCalls.push(options);
        }
      });

      try {
        await chromiumResolver.cleanupOldChromium('/tmp/chromium-cache', 'keep-this-id');
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        Object.defineProperty(PB, 'uninstall', originalUninstall!);
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

  describe('findLatestCachedChromium', function () {
    it('should return the executable path of the highest-version Chrome build', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const originalComputeExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeExecutablePath');

      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          return [
            { browser: PB.Browser.CHROME, buildId: '130.0.6723.91', platform: 'linux', executablePath: '/cache/chrome/130' },
            { browser: PB.Browser.CHROME, buildId: '131.0.6778.85', platform: 'linux', executablePath: '/cache/chrome/131' },
            { browser: PB.Browser.FIREFOX, buildId: '999.0.0.0', platform: 'linux', executablePath: '/cache/firefox/999' }
          ];
        }
      });

      try {
        const result = await chromiumResolver.findLatestCachedChromium('/cache');
        assert.strictEqual(result, '/cache/chrome/131');
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
        if (originalComputeExecutablePath) {
          Object.defineProperty(PB, 'computeExecutablePath', originalComputeExecutablePath);
        }
      }
    });

    it('should return null when no Chrome builds exist', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');

      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          return [
            { browser: PB.Browser.FIREFOX, buildId: '1.0.0.0', platform: 'linux', executablePath: '/cache/firefox' }
          ];
        }
      });

      try {
        const result = await chromiumResolver.findLatestCachedChromium('/cache');
        assert.strictEqual(result, null);
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
      }
    });

    it('should return null when getInstalledBrowsers throws (missing cache dir)', async function () {
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');

      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () {
          throw new Error('ENOENT');
        }
      });

      try {
        const result = await chromiumResolver.findLatestCachedChromium('/nonexistent');
        assert.strictEqual(result, null);
      } finally {
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
      }
    });
  });

  describe('fetchLatestStableBuildId', function () {
    afterEach(function () {
      chromiumResolver.resetLatestBuildIdCache();
    });

    it('should return the version from channels.Stable.version', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      const result = await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(result, '131.0.6778.85');
      assert.strictEqual(calls, 1);
    });

    it('should memoize successful results across calls in the same session', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      const a = await chromiumResolver.fetchLatestStableBuildId();
      const b = await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(a, '131.0.6778.85');
      assert.strictEqual(b, '131.0.6778.85');
      assert.strictEqual(calls, 1);
    });

    it('should return null on network error and not retry within the same session', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        throw new Error('ECONNREFUSED');
      });

      const a = await chromiumResolver.fetchLatestStableBuildId();
      const b = await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(a, null);
      assert.strictEqual(b, null);
      assert.strictEqual(calls, 1);
    });

    it('should return null on schema mismatch', async function () {
      chromiumResolver.setJsonFetcherForTesting(async function () {
        return { unexpected: 'shape' };
      });
      assert.strictEqual(await chromiumResolver.fetchLatestStableBuildId(), null);
    });

    it('should return null on malformed version string', async function () {
      chromiumResolver.setJsonFetcherForTesting(async function () {
        return { channels: { Stable: { version: 'not-a-version' } } };
      });
      assert.strictEqual(await chromiumResolver.fetchLatestStableBuildId(), null);
    });

    it('should fetch again after resetLatestBuildIdCache()', async function () {
      let calls = 0;
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });

      await chromiumResolver.fetchLatestStableBuildId();
      chromiumResolver.resetLatestBuildIdCache();
      // After reset, fetcher returns to default, so re-install our test fetcher
      chromiumResolver.setJsonFetcherForTesting(async function () {
        calls++;
        return { channels: { Stable: { version: '131.0.6778.85' } } };
      });
      await chromiumResolver.fetchLatestStableBuildId();
      assert.strictEqual(calls, 2);
    });
  });

  describe('ensureChromiumDownloaded', function () {
    it('should call PB.install with the given buildId', async function () {
      const originalComputeExecutablePath = Object.getOwnPropertyDescriptor(PB, 'computeExecutablePath');
      const originalInstall = Object.getOwnPropertyDescriptor(PB, 'install');
      const originalGetInstalledBrowsers = Object.getOwnPropertyDescriptor(PB, 'getInstalledBrowsers');
      const installCalls: unknown[] = [];

      Object.defineProperty(PB, 'computeExecutablePath', {
        configurable: true,
        enumerable: true,
        value: function () {
          // Return a path that does not exist so accessSync throws and we fall through to install
          return path.join(tmpDir, 'chrome-missing');
        }
      });
      Object.defineProperty(PB, 'install', {
        configurable: true,
        enumerable: true,
        value: async function (opts: unknown) {
          installCalls.push(opts);
          return { executablePath: path.join(tmpDir, 'chrome-installed') };
        }
      });
      Object.defineProperty(PB, 'getInstalledBrowsers', {
        configurable: true,
        enumerable: true,
        value: async function () { return []; }
      });

      try {
        const result = await chromiumResolver.ensureChromiumDownloaded(tmpDir, '131.0.6778.85');
        assert.strictEqual(result, path.join(tmpDir, 'chrome-installed'));
        assert.strictEqual(installCalls.length, 1);
        assert.strictEqual((installCalls[0] as { buildId: string }).buildId, '131.0.6778.85');
      } finally {
        Object.defineProperty(PB, 'computeExecutablePath', originalComputeExecutablePath!);
        Object.defineProperty(PB, 'install', originalInstall!);
        Object.defineProperty(PB, 'getInstalledBrowsers', originalGetInstalledBrowsers!);
      }
    });
  });
});
