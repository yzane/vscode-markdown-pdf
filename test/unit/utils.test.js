'use strict';

var assert = require('assert');
var utils = require('../../src/utils');

describe('utils', function () {
  describe('setBooleanValue', function () {
    it('should return false when first argument is explicitly false', function () {
      assert.strictEqual(utils.setBooleanValue(false, true), false);
    });

    it('should return second argument when first is undefined', function () {
      assert.strictEqual(utils.setBooleanValue(undefined, true), true);
      assert.strictEqual(utils.setBooleanValue(undefined, false), false);
    });

    it('should return first argument when it is truthy', function () {
      assert.strictEqual(utils.setBooleanValue(true, false), true);
    });

    it('should return second argument when first is null', function () {
      assert.strictEqual(utils.setBooleanValue(null, true), true);
    });

    it('should return undefined when both arguments are undefined', function () {
      assert.strictEqual(utils.setBooleanValue(undefined, undefined), undefined);
    });
  });

  describe('isExistsPath', function () {
    it('should return false for empty string', function () {
      assert.strictEqual(utils.isExistsPath(''), false);
    });

    it('should return true for a path that exists', function () {
      assert.strictEqual(utils.isExistsPath(__filename), true);
    });

    it('should return false for a path that does not exist', function () {
      assert.strictEqual(utils.isExistsPath('/nonexistent/path/file.txt'), false);
    });
  });

  describe('isExistsDir', function () {
    it('should return false for empty string', function () {
      assert.strictEqual(utils.isExistsDir(''), false);
    });

    it('should return true for a directory that exists', function () {
      var path = require('path');
      assert.strictEqual(utils.isExistsDir(path.dirname(__filename)), true);
    });

    it('should return false for a directory that does not exist', function () {
      assert.strictEqual(utils.isExistsDir('/nonexistent/directory'), false);
    });

    it('should return false for a file path', function () {
      assert.strictEqual(utils.isExistsDir(__filename), false);
    });
  });

  describe('Slug', function () {
    it('should convert basic text to slug', function () {
      assert.strictEqual(utils.Slug('Hello World'), 'hello-world');
    });

    it('should handle Japanese text', function () {
      assert.strictEqual(utils.Slug('日本語の見出し'), encodeURI('日本語の見出し'));
    });

    it('should remove punctuation', function () {
      assert.strictEqual(utils.Slug('What\'s this?!'), 'whats-this');
    });

    it('should remove leading and trailing hyphens', function () {
      assert.strictEqual(utils.Slug(' -hello- '), 'hello');
    });

    it('should preserve underscores', function () {
      assert.strictEqual(utils.Slug('snake_case'), 'snake_case');
    });

    it('should return empty string for empty input', function () {
      assert.strictEqual(utils.Slug(''), '');
    });

    it('should return empty string for whitespace only', function () {
      assert.strictEqual(utils.Slug('   '), '');
    });

    it('should collapse multiple spaces into a single hyphen', function () {
      assert.strictEqual(utils.Slug('hello   world'), 'hello-world');
    });

    it('should handle mixed content', function () {
      assert.strictEqual(utils.Slug('Hello World! #1'), 'hello-world-1');
    });
  });

  describe('transformTemplate', function () {
    it('should replace %%ISO-DATE%% with YYYY-MM-DD format', function () {
      var result = utils.transformTemplate('Date: %%ISO-DATE%%');
      assert.match(result, /^Date: \d{4}-\d{2}-\d{2}$/);
    });

    it('should replace %%ISO-DATETIME%% with YYYY-MM-DD hh:mm:ss format', function () {
      var result = utils.transformTemplate('DateTime: %%ISO-DATETIME%%');
      assert.match(result, /^DateTime: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should replace %%ISO-TIME%% with hh:mm:ss format', function () {
      var result = utils.transformTemplate('Time: %%ISO-TIME%%');
      assert.match(result, /^Time: \d{2}:\d{2}:\d{2}$/);
    });

    it('should return text unchanged when no placeholders are present', function () {
      assert.strictEqual(utils.transformTemplate('no placeholders here'), 'no placeholders here');
    });

    it('should handle multiple different placeholders', function () {
      var result = utils.transformTemplate('%%ISO-DATE%% at %%ISO-TIME%%');
      assert.match(result, /^\d{4}-\d{2}-\d{2} at \d{2}:\d{2}:\d{2}$/);
    });

    it('should handle empty string', function () {
      assert.strictEqual(utils.transformTemplate(''), '');
    });
  });

  describe('readFile', function () {
    var fs = require('fs');
    var path = require('path');
    var tmpFile;

    before(function () {
      tmpFile = path.join(__dirname, 'test-read-file.tmp');
      fs.writeFileSync(tmpFile, 'hello world', 'utf-8');
    });

    after(function () {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    });

    it('should return file contents for an existing file', function () {
      assert.strictEqual(utils.readFile(tmpFile), 'hello world');
    });

    it('should return empty string for a non-existent file', function () {
      assert.strictEqual(utils.readFile('/nonexistent/file.txt'), '');
    });

    it('should return empty string for an empty path', function () {
      assert.strictEqual(utils.readFile('', 'utf-8'), '');
    });

    it('should return a Buffer when encode is null', function () {
      var result = utils.readFile(tmpFile, null);
      assert.ok(Buffer.isBuffer(result));
      assert.strictEqual(result.toString(), 'hello world');
    });

    it('should handle file:// prefix on non-Windows paths', function () {
      assert.strictEqual(utils.readFile('file://' + tmpFile), 'hello world');
    });
  });

  describe('makeCss', function () {
    var fs = require('fs');
    var path = require('path');
    var tmpCssFile;

    before(function () {
      tmpCssFile = path.join(__dirname, 'test-make-css.tmp.css');
      fs.writeFileSync(tmpCssFile, 'body { color: red; }', 'utf-8');
    });

    after(function () {
      if (fs.existsSync(tmpCssFile)) {
        fs.unlinkSync(tmpCssFile);
      }
    });

    it('should wrap CSS content in style tags', function () {
      var result = utils.makeCss(tmpCssFile);
      assert.strictEqual(result, '\n<style>\nbody { color: red; }\n</style>\n');
    });

    it('should return empty string for a non-existent file', function () {
      assert.strictEqual(utils.makeCss('/nonexistent/file.css'), '');
    });
  });

  describe('convertImgPath', function () {
    it('should convert a relative path to a file URI', function () {
      assert.strictEqual(utils.convertImgPath('image.png', '/home/user/doc.md'), 'file:///home/user/image.png');
    });

    it('should convert an absolute path to a file URI', function () {
      assert.strictEqual(utils.convertImgPath('/images/photo.png', '/home/user/doc.md'), 'file:///images/photo.png');
    });

    it('should return https URLs unchanged', function () {
      assert.strictEqual(utils.convertImgPath('https://example.com/img.png', '/home/user/doc.md'), 'https://example.com/img.png');
    });

    it('should return http URLs unchanged', function () {
      assert.strictEqual(utils.convertImgPath('http://example.com/img.png', '/home/user/doc.md'), 'http://example.com/img.png');
    });

    it('should escape # in the path as %23', function () {
      var result = utils.convertImgPath('image#1.png', '/home/user/doc.md');
      assert.ok(result.indexOf('%23') !== -1, 'Expected %23 in result: ' + result);
    });

    it('should remove quotes from the path', function () {
      var result = utils.convertImgPath('"image.png"', '/home/user/doc.md');
      assert.ok(result.indexOf('"') === -1, 'Expected no quotes in result: ' + result);
    });

    it('should normalize file:// to file:///', function () {
      var result = utils.convertImgPath('file://image.png', '/home/user/doc.md');
      assert.ok(result.indexOf('file:///') === 0, 'Expected file:/// prefix in result: ' + result);
    });

    it('should return file:/// URLs unchanged', function () {
      assert.strictEqual(utils.convertImgPath('file:///home/user/image.png', '/home/user/doc.md'), 'file:///home/user/image.png');
    });
  });
});
