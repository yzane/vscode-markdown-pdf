'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
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
});
