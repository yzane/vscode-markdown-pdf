'use strict';

var after = require('node:test').after;
var describe = require('node:test').describe;
var it = require('node:test').it;
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var vm = require('vm');

var tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpdf-delete-file-'));

after(function () {
  if (fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

function loadScript(filename, options) {
  var source = fs.readFileSync(filename, 'utf-8').replace(/^#!.*\n/, '');
  var module = { exports: {} };
  var context = {
    __dirname: options.dirname || path.dirname(filename),
    __filename: filename,
    console: options.console || console,
    exports: module.exports,
    module: module,
    process: process,
    Buffer: Buffer,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    require: function (request) {
      if (Object.prototype.hasOwnProperty.call(options.requires, request)) {
        return options.requires[request];
      }
      throw new Error('Unexpected require: ' + request);
    }
  };

  vm.runInNewContext(source, context, { filename: filename });
  return context;
}

function createFsWithoutRm() {
  return {
    existsSync: fs.existsSync.bind(fs),
    lstat: fs.lstat.bind(fs),
    lstatSync: fs.lstatSync.bind(fs),
    readdir: fs.readdir.bind(fs),
    readdirSync: fs.readdirSync.bind(fs),
    rmdir: fs.rmdir.bind(fs),
    rmdirSync: fs.rmdirSync.bind(fs),
    unlink: fs.unlink.bind(fs),
    unlinkSync: fs.unlinkSync.bind(fs),
    writeFileSync: fs.writeFileSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs)
  };
}

function createNestedDir(rootDir, dirname) {
  var dir = path.join(rootDir, dirname);
  fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'nested', 'file.txt'), 'content', 'utf-8');
  return dir;
}

function waitFor(check) {
  return new Promise(function (resolve, reject) {
    var deadline = Date.now() + 2000;

    function poll() {
      if (check()) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error('Timed out waiting for condition'));
        return;
      }
      setTimeout(poll, 10);
    }

    poll();
  });
}

describe('delete file compatibility', function () {
  it('falls back to built-in recursive delete in extension.js when fs.rmSync is unavailable', function () {
    var targetDir = createNestedDir(tmpRoot, 'extension-delete');
    var extension = loadScript(path.join(__dirname, '..', '..', 'extension.js'), {
      requires: {
        fs: createFsWithoutRm(),
        os: require('os'),
        path: path,
        vscode: {},
        './src/utils': {}
      }
    });

    extension.deleteFile(targetDir);

    assert.strictEqual(fs.existsSync(targetDir), false);
  });

  it('ignores ENOENT in extension.js fallback delete to preserve force-like behavior', function () {
    var extension = loadScript(path.join(__dirname, '..', '..', 'extension.js'), {
      requires: {
        fs: createFsWithoutRm(),
        os: require('os'),
        path: path,
        vscode: {},
        './src/utils': {}
      }
    });

    assert.doesNotThrow(function () {
      extension.deleteFile(path.join(tmpRoot, 'missing-extension-path'));
    });
  });

  it('falls back to built-in recursive delete in src/compile.js when fs.rm is unavailable', async function () {
    var scriptRoot = path.join(tmpRoot, 'compile-script');
    var scriptDir = path.join(scriptRoot, 'src');
    var removedPaths = [
      createNestedDir(path.join(scriptRoot, 'node_modules'), 'emoji-images/json'),
      createNestedDir(path.join(scriptRoot, 'node_modules'), 'puppeteer-core/.local-chromium')
    ];
    var logs = [];

    loadScript(path.join(__dirname, '..', '..', 'src', 'compile.js'), {
      dirname: scriptDir,
      console: {
        log: function (message) {
          logs.push(message);
        }
      },
      requires: {
        fs: createFsWithoutRm(),
        path: path,
        removeNPMAbsolutePaths: function () {
          return Promise.resolve([]);
        }
      }
    });

    await waitFor(function () {
      return removedPaths.every(function (targetDir) {
        return !fs.existsSync(targetDir);
      });
    });

    removedPaths.forEach(function (targetDir) {
      assert.strictEqual(fs.existsSync(targetDir), false);
      assert.ok(logs.includes(targetDir));
    });
  });

  it('ignores ENOENT in src/compile.js fallback delete to preserve force-like behavior', async function () {
    var scriptRoot = path.join(tmpRoot, 'compile-missing');
    var scriptDir = path.join(scriptRoot, 'src');
    var logs = [];

    fs.mkdirSync(scriptDir, { recursive: true });

    loadScript(path.join(__dirname, '..', '..', 'src', 'compile.js'), {
      dirname: scriptDir,
      console: {
        log: function (message) {
          logs.push(message);
        }
      },
      requires: {
        fs: createFsWithoutRm(),
        path: path,
        removeNPMAbsolutePaths: function () {
          return Promise.resolve([]);
        }
      }
    });

    await waitFor(function () {
      return logs.some(function (message) {
        return message.indexOf(path.join(scriptRoot, 'node_modules', 'emoji-images', 'json')) !== -1;
      });
    });
  });
});
