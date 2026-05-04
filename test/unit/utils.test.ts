import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import * as utils from '../../src/utils';

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
      const path = require('path');
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
      assert.strictEqual(utils.Slug('日本語の見出し'), '日本語の見出し');
    });

    it('should remove punctuation', function () {
      assert.strictEqual(utils.Slug('What\'s this?!'), 'whats-this');
    });

    it('should preserve leading and trailing hyphens', function () {
      assert.strictEqual(utils.Slug(' -hello- '), '-hello-');
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

    it('should replace each space with a hyphen', function () {
      assert.strictEqual(utils.Slug('hello   world'), 'hello---world');
    });

    it('should handle mixed content', function () {
      assert.strictEqual(utils.Slug('Hello World! #1'), 'hello-world-1');
    });

    it('should return empty string for punctuation-only input', function () {
      assert.strictEqual(utils.Slug('!@#$%^&*()'), '');
    });

    it('should be idempotent for already-slugified input', function () {
      assert.strictEqual(utils.Slug('hello-world'), 'hello-world');
    });

    it('should handle mixed CJK and Latin scripts', function () {
      assert.strictEqual(utils.Slug('日本語 English テスト'), '日本語-english-テスト');
    });

    it('should handle emoji in text', function () {
      assert.strictEqual(utils.Slug('Hello 🎉 World'), 'hello--world');
    });
  });

  describe('transformTemplate', function () {
    it('should replace %%ISO-DATE%% with YYYY-MM-DD format', function () {
      const result = utils.transformTemplate('Date: %%ISO-DATE%%');
      assert.match(result, /^Date: \d{4}-\d{2}-\d{2}$/);
    });

    it('should replace %%ISO-DATETIME%% with YYYY-MM-DD hh:mm:ss format', function () {
      const result = utils.transformTemplate('DateTime: %%ISO-DATETIME%%');
      assert.match(result, /^DateTime: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should replace %%ISO-TIME%% with hh:mm:ss format', function () {
      const result = utils.transformTemplate('Time: %%ISO-TIME%%');
      assert.match(result, /^Time: \d{2}:\d{2}:\d{2}$/);
    });

    it('should return text unchanged when no placeholders are present', function () {
      assert.strictEqual(utils.transformTemplate('no placeholders here'), 'no placeholders here');
    });

    it('should handle multiple different placeholders', function () {
      const result = utils.transformTemplate('%%ISO-DATE%% at %%ISO-TIME%%');
      assert.match(result, /^\d{4}-\d{2}-\d{2} at \d{2}:\d{2}:\d{2}$/);
    });

    it('should handle empty string', function () {
      assert.strictEqual(utils.transformTemplate(''), '');
    });
  });

  describe('readFile', function () {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    let tmpFile: string;
    let tmpFileWithSpace: string;
    let tmpFileWithBom: string;

    before(function () {
      tmpFile = path.join(__dirname, 'test-read-file.tmp');
      fs.writeFileSync(tmpFile, 'hello world', 'utf-8');
      tmpFileWithSpace = path.join(__dirname, 'test read file.tmp');
      fs.writeFileSync(tmpFileWithSpace, 'space content', 'utf-8');
      tmpFileWithBom = path.join(__dirname, 'test-read-file-bom.tmp');
      fs.writeFileSync(tmpFileWithBom, '\uFEFFhello BOM', 'utf-8');
    });

    after(function () {
      [tmpFile, tmpFileWithSpace, tmpFileWithBom].forEach(function (filename) {
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      });
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
      const result = utils.readFile(tmpFile, null);
      assert.ok(Buffer.isBuffer(result));
      assert.strictEqual(result.toString(), 'hello world');
    });

    it('should handle file:// prefix on non-Windows paths', function () {
      assert.strictEqual(utils.readFile('file://' + tmpFile), 'hello world');
    });

    it('should read file with spaces in path', function () {
      assert.strictEqual(utils.readFile(tmpFileWithSpace), 'space content');
    });

    it('should handle file:// prefix with spaces in path', function () {
      assert.strictEqual(utils.readFile('file://' + tmpFileWithSpace), 'space content');
    });

    (process.platform === 'win32' ? it : it.skip)('should handle file:///C:/ prefix on Windows', function () {
      const winTmpFile = path.join(os.tmpdir(), 'mdpdf-test-win.tmp');
      fs.writeFileSync(winTmpFile, 'win content', 'utf-8');
      try {
        const result = utils.readFile('file:///' + winTmpFile.replace(/\\/g, '/'));
        assert.strictEqual(result, 'win content');
      } finally {
        if (fs.existsSync(winTmpFile)) {
          fs.unlinkSync(winTmpFile);
        }
      }
    });

    it('should return empty string when path is a directory', function () {
      assert.strictEqual(utils.readFile(__dirname), '');
    });

    it('should preserve BOM in UTF-8 file', function () {
      const result = utils.readFile(tmpFileWithBom) as string;
      assert.strictEqual(result.charCodeAt(0), 0xFEFF, 'Expected BOM at start of file');
      assert.ok(result.indexOf('hello BOM') !== -1, 'Expected content after BOM');
    });
  });

  describe('makeCss', function () {
    const fs = require('fs');
    const path = require('path');
    let tmpCssFile: string;

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
      const result = utils.makeCss(tmpCssFile);
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
      const result = utils.convertImgPath('image#1.png', '/home/user/doc.md');
      assert.ok(result.indexOf('%23') !== -1, 'Expected %23 in result: ' + result);
    });

    it('should remove quotes from the path', function () {
      const result = utils.convertImgPath('"image.png"', '/home/user/doc.md');
      assert.ok(result.indexOf('"') === -1, 'Expected no quotes in result: ' + result);
    });

    it('should normalize file:// to file:///', function () {
      const result = utils.convertImgPath('file://image.png', '/home/user/doc.md');
      assert.ok(result.indexOf('file:///') === 0, 'Expected file:/// prefix in result: ' + result);
    });

    it('should return file:/// URLs unchanged', function () {
      assert.strictEqual(utils.convertImgPath('file:///home/user/image.png', '/home/user/doc.md'), 'file:///home/user/image.png');
    });

    it('should handle path with spaces', function () {
      assert.strictEqual(utils.convertImgPath('my image.png', '/home/user/doc.md'), 'file:///home/user/my image.png');
    });

    it('should resolve ../ in relative path', function () {
      assert.strictEqual(utils.convertImgPath('../../assets/img.png', '/home/user/docs/sub/doc.md'), 'file:///home/user/assets/img.png');
    });

    it('should return data: URL unchanged', function () {
      assert.strictEqual(utils.convertImgPath('data:image/png;base64,abc', '/home/user/doc.md'), 'data:image/png;base64,abc');
    });

    it('should handle empty string src', function () {
      const path = require('path');
      const expected = 'file://' + path.resolve('/home/user', '');
      assert.strictEqual(utils.convertImgPath('', '/home/user/doc.md'), expected);
    });

    (process.platform === 'win32' ? it : it.skip)('should handle Windows absolute path', function () {
      assert.strictEqual(utils.convertImgPath('C:\\Users\\img.png', 'C:\\docs\\doc.md'), 'file:///C:/Users/img.png');
    });

    it('should decode %20 encoded spaces in path', function () {
      assert.strictEqual(utils.convertImgPath('my%20image.png', '/home/user/doc.md'), 'file:///home/user/my image.png');
    });

    it('should return https URL with query string unchanged', function () {
      assert.strictEqual(utils.convertImgPath('https://example.com/img.png?v=1', '/home/user/doc.md'), 'https://example.com/img.png?v=1');
    });

    it('should return https URL with fragment unchanged', function () {
      assert.strictEqual(utils.convertImgPath('https://example.com/img.svg#icon', '/home/user/doc.md'), 'https://example.com/img.svg#icon');
    });

    it('should convert Unicode relative path to file URI', function () {
      assert.strictEqual(utils.convertImgPath('画像/テスト.png', '/home/user/doc.md'), 'file:///home/user/画像/テスト.png');
    });

    it('should escape all # characters in path', function () {
      const result = utils.convertImgPath('path/to/C#/image#1.png', '/home/user/doc.md');
      assert.ok(result.indexOf('#') === -1, 'Expected no # in result: ' + result);
      assert.ok(result.indexOf('%23') !== -1, 'Expected %23 in result: ' + result);
    });

    it('should not crash when filename is empty string', function () {
      assert.doesNotThrow(function () {
        utils.convertImgPath('image.png', '');
      });
    });
  });

  describe('isExcludeFile', function () {
    it('should return false for an empty patterns array', function () {
      assert.strictEqual(utils.isExcludeFile('README.md', []), false);
    });

    it('should return false for undefined patterns', function () {
      assert.strictEqual(utils.isExcludeFile('README.md', undefined), false);
    });

    it('should return true when filename matches a pattern', function () {
      assert.strictEqual(utils.isExcludeFile('DRAFT-report.md', ['^DRAFT']), true);
    });

    it('should return true when filename matches the second pattern', function () {
      assert.strictEqual(utils.isExcludeFile('notes.txt', ['^DRAFT', '\\.txt$']), true);
    });

    it('should return false when filename matches no patterns', function () {
      assert.strictEqual(utils.isExcludeFile('report.md', ['^DRAFT', '\\.txt$']), false);
    });

    it('should match filename with regex special characters when pattern escapes them', function () {
      assert.strictEqual(utils.isExcludeFile('test[1].md', ['test\\[1\\]']), true);
    });

    it('should be case-sensitive by default', function () {
      assert.strictEqual(utils.isExcludeFile('README.md', ['^readme']), false);
    });

    it('should match empty filename against .* pattern', function () {
      assert.strictEqual(utils.isExcludeFile('', ['.*']), true);
    });
  });

  describe('resolveHref', function () {
    const path = require('path');
    const os = require('os');

    it('should return empty string for empty href', function () {
      assert.strictEqual(utils.resolveHref('', '/home/user/doc.md', false, '/workspace'), '');
    });

    it('should return undefined for undefined href', function () {
      assert.strictEqual(utils.resolveHref(undefined, '/home/user/doc.md', false, '/workspace'), undefined);
    });

    it('should return null for null href', function () {
      assert.strictEqual(utils.resolveHref(null, '/home/user/doc.md', false, '/workspace'), null);
    });

    it('should return http URL unchanged', function () {
      assert.strictEqual(
        utils.resolveHref('http://example.com/style.css', '/home/user/doc.md', false, '/workspace'),
        'http://example.com/style.css'
      );
    });

    it('should return https URL unchanged', function () {
      assert.strictEqual(
        utils.resolveHref('https://example.com/style.css', '/home/user/doc.md', false, '/workspace'),
        'https://example.com/style.css'
      );
    });

    it('should return data URL unchanged', function () {
      assert.strictEqual(
        utils.resolveHref('data:text/css;base64,abc', '/home/user/doc.md', false, '/workspace'),
        'data:text/css;base64,abc'
      );
    });

    it('should expand ~ to the home directory as a file URI', function () {
      const expected = 'file://' + os.homedir() + '/styles/custom.css';
      assert.strictEqual(utils.resolveHref('~/styles/custom.css', '/home/user/doc.md', false, '/workspace'), expected);
    });

    it('should convert an absolute path to a file URI', function () {
      assert.strictEqual(utils.resolveHref('/etc/styles/custom.css', '/home/user/doc.md', false, '/workspace'), 'file:///etc/styles/custom.css');
    });

    it('should resolve a workspace-relative path when stylesRelativePathFile is false', function () {
      assert.strictEqual(utils.resolveHref('assets/style.css', '/home/user/doc.md', false, '/workspace'), 'file://' + path.join('/workspace', 'assets/style.css'));
    });

    it('should resolve a file-relative path when stylesRelativePathFile is true', function () {
      assert.strictEqual(utils.resolveHref('assets/style.css', '/home/user/doc.md', true, '/workspace'), 'file://' + path.join('/home/user', 'assets/style.css'));
    });

    it('should resolve a file-relative path when there is no workspace', function () {
      assert.strictEqual(utils.resolveHref('assets/style.css', '/home/user/doc.md', false, undefined), 'file://' + path.join('/home/user', 'assets/style.css'));
    });

    it('should resolve ../ in workspace-relative path', function () {
      const expected = 'file://' + path.join('/workspace', '../styles/custom.css');
      assert.strictEqual(utils.resolveHref('../styles/custom.css', '/home/user/doc.md', false, '/workspace'), expected);
    });

    it('should resolve ../ in file-relative path', function () {
      assert.strictEqual(
        utils.resolveHref('../styles/custom.css', '/home/user/doc.md', true, '/workspace'),
        'file://' + path.join('/home/user', '../styles/custom.css')
      );
    });

    it('should handle relative path with spaces', function () {
      assert.strictEqual(
        utils.resolveHref('my styles/custom.css', '/home/user/doc.md', false, '/workspace'),
        'file:///workspace/my styles/custom.css'
      );
    });

    it('should resolve fragment-bearing href as file-relative path', function () {
      assert.strictEqual(
        utils.resolveHref('style.css#print', '/home/user/doc.md', true, '/workspace'),
        'file://' + path.join('/home/user', 'style.css#print')
      );
    });

    it('should treat protocol-relative URL as absolute path', function () {
      assert.strictEqual(
        utils.resolveHref('//cdn.example.com/style.css', '/home/user/doc.md', false, '/workspace'),
        'file:////cdn.example.com/style.css'
      );
    });

    it('should treat file:// scheme href as relative path', function () {
      assert.strictEqual(
        utils.resolveHref('file:///home/user/style.css', '/home/user/doc.md', false, '/workspace'),
        'file://' + path.join('/workspace', 'file:/home/user/style.css')
      );
    });

    it('should resolve href with trailing slash as file-relative path', function () {
      assert.strictEqual(
        utils.resolveHref('styles/', '/home/user/doc.md', true, '/workspace'),
        'file://' + path.join('/home/user', 'styles/')
      );
    });

    it('should handle Windows absolute path', function () {
      assert.strictEqual(
        utils.resolveHref('C:\\styles\\custom.css', 'C:\\docs\\doc.md', false, 'C:\\workspace'),
        'file://C:\\styles\\custom.css'
      );
    });

    it('should handle UNC absolute path', function () {
      assert.strictEqual(
        utils.resolveHref('\\\\server\\share\\styles\\custom.css', 'C:\\docs\\doc.md', false, 'C:\\workspace'),
        'file://\\\\server\\share\\styles\\custom.css'
      );
    });
  });

  describe('resolveOutputDir', function () {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    let tmpDir: string;
    let spaceDir: string;

    before(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpdf-test-'));
      spaceDir = path.join(tmpDir, 'my output');
      fs.mkdirSync(spaceDir);
    });

    after(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return filename when outputDirectory is empty', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '', false, '/home/user/doc.md', '/workspace'),
        '/home/user/doc.pdf'
      );
    });

    it('should return filename when outputDirectory is null', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', null, false, '/home/user/doc.md', '/workspace'),
        '/home/user/doc.pdf'
      );
    });

    it('should return filename when outputDirectory is undefined', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', undefined, false, '/home/user/doc.md', '/workspace'),
        '/home/user/doc.pdf'
      );
    });

    it('should expand ~ to the home directory', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '~/output', false, '/home/user/doc.md', '/workspace'),
        path.join(os.homedir(), 'output', 'doc.pdf')
      );
    });

    it('should use an absolute path when the directory exists', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', tmpDir, false, '/home/user/doc.md', '/workspace'),
        path.join(tmpDir, 'doc.pdf')
      );
    });

    it('should return null when the absolute directory does not exist', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '/nonexistent/output', false, '/home/user/doc.md', '/workspace'),
        null
      );
    });

    it('should resolve a workspace-relative path when outputDirectoryRelativePathFile is false', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'build', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', 'build', 'doc.pdf')
      );
    });

    it('should resolve a file-relative path when outputDirectoryRelativePathFile is true', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'build', true, '/home/user/doc.md', '/workspace'),
        path.join('/home/user', 'build', 'doc.pdf')
      );
    });

    it('should resolve a file-relative path when there is no workspace', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'build', false, '/home/user/doc.md', undefined),
        path.join('/home/user', 'build', 'doc.pdf')
      );
    });

    it('should handle relative path with spaces', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'my output', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', 'my output', 'doc.pdf')
      );
    });

    it('should handle relative path with ../', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', '../build', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', '../build', 'doc.pdf')
      );
    });

    it('should handle absolute path with spaces', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', spaceDir, false, '/home/user/doc.md', '/workspace'),
        path.join(spaceDir, 'doc.pdf')
      );
    });

    it('should handle trailing slash in absolute directory path', function () {
      const dirWithSlash = tmpDir + '/';
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', dirWithSlash, false, '/home/user/doc.md', '/workspace'),
        path.join(tmpDir, 'doc.pdf')
      );
    });

    it('should not expand ~ in the middle of path', function () {
      assert.strictEqual(
        utils.resolveOutputDir('/home/user/doc.pdf', 'foo/~/bar', false, '/home/user/doc.md', '/workspace'),
        path.join('/workspace', 'foo/~/bar', 'doc.pdf')
      );
    });

    (process.platform === 'win32' ? it : it.skip)('should handle Windows absolute path', function () {
      assert.strictEqual(
        utils.resolveOutputDir('C:\\docs\\doc.pdf', 'build', false, 'C:\\docs\\doc.md', 'C:\\workspace'),
        path.join('C:\\workspace', 'build', 'doc.pdf')
      );
    });
  });

  describe('buildStyleTags', function () {
    const baseDir = require('path').join(__dirname, '..', '..');

    it('should include default styles when includeDefaultStyles is true', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: true,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return href; },
      });
      assert.ok(result.indexOf('<style>') !== -1, 'Expected <style> tags in result');
    });

    it('should skip default styles when includeDefaultStyles is false', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return href; },
      });
      assert.strictEqual(result, '');
    });

    it('should include highlight style when highlight is true with highlightStyle', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: 'github.css',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return href; },
      });
      assert.ok(result.indexOf('<style>') !== -1, 'Expected highlight style in result');
    });

    it('should use tomorrow.css as the default highlight style', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return href; },
      });
      assert.ok(result.indexOf('<style>') !== -1, 'Expected default highlight style in result');
    });

    it('should map legacy highlight style aliases to supported v11 style names', function () {
      const fallbacks: string[][] = [];
      const legacyResult = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: 'github-gist.css',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        onMissingHighlightStyle: function (requestedStyle: string, resolvedStyle: string) {
          fallbacks.push([requestedStyle, resolvedStyle]);
        },
        resolveHrefFn: function (href: string) { return href; },
      });
      const currentResult = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: 'github.css',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return href; },
      });

      assert.strictEqual(legacyResult, currentResult);
      assert.deepStrictEqual(fallbacks, [['github-gist.css', 'github.css']]);
    });

    it('should fallback to the default highlight style when the configured style does not exist', function () {
      const fallbacks: string[][] = [];
      const missingResult = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: 'darcula.css',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        onMissingHighlightStyle: function (requestedStyle: string, resolvedStyle: string) {
          fallbacks.push([requestedStyle, resolvedStyle]);
        },
        resolveHrefFn: function (href: string) { return href; },
      });
      const defaultResult = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: true,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return href; },
      });

      assert.strictEqual(missingResult, defaultResult);
      assert.deepStrictEqual(fallbacks, [['darcula.css', 'tomorrow.css']]);
    });

    it('should not warn before falling back when the configured highlight style does not exist', function () {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = function (message: string) {
        warnings.push(message);
      };

      try {
        const missingResult = utils.buildStyleTags({
          includeDefaultStyles: false,
          highlight: true,
          highlightStyle: 'darcula.css',
          markdownStyles: [],
          markdownPdfStyles: [],
          baseDir: baseDir,
          resolveHrefFn: function (href: string) { return href; },
        });
        const defaultResult = utils.buildStyleTags({
          includeDefaultStyles: false,
          highlight: true,
          highlightStyle: '',
          markdownStyles: [],
          markdownPdfStyles: [],
          baseDir: baseDir,
          resolveHrefFn: function (href: string) { return href; },
        });

        assert.strictEqual(missingResult, defaultResult);
        assert.deepStrictEqual(warnings, []);
      } finally {
        console.warn = originalWarn;
      }
    });

    it('should skip highlight style when highlight is false', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: 'github.css',
        markdownStyles: [],
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return href; },
      });
      assert.strictEqual(result, '');
    });

    it('should add link tags for markdownPdfStyles', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: ['custom.css'],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return 'file:///resolved/' + href; },
      });
      assert.ok(result.indexOf('<link rel="stylesheet"') !== -1, 'Expected <link> tag');
      assert.ok(result.indexOf('file:///resolved/custom.css') !== -1, 'Expected resolved href');
    });

    it('should skip markdownStyles when value is a string instead of array', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: true,
        highlight: false,
        highlightStyle: '',
        markdownStyles: 'style.css' as any,
        markdownPdfStyles: [],
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return 'file:///resolved/' + href; },
      });
      assert.ok(result.indexOf('file:///resolved/style.css') === -1, 'Expected no link tag for string markdownStyles');
    });

    it('should skip markdownPdfStyles when value is a string instead of array', function () {
      const result = utils.buildStyleTags({
        includeDefaultStyles: false,
        highlight: false,
        highlightStyle: '',
        markdownStyles: [],
        markdownPdfStyles: 'custom.css' as any,
        baseDir: baseDir,
        resolveHrefFn: function (href: string) { return 'file:///resolved/' + href; },
      });
      assert.strictEqual(result, '');
    });

    it('should propagate exception from resolveHrefFn', function () {
      assert.throws(function () {
        utils.buildStyleTags({
          includeDefaultStyles: false,
          highlight: false,
          highlightStyle: '',
          markdownStyles: [],
          markdownPdfStyles: ['will-throw.css'],
          baseDir: baseDir,
          resolveHrefFn: function () { throw new Error('resolve failed'); },
        });
      }, /resolve failed/);
    });
  });

  describe('buildPdfOptions', function () {
    it('should use format when width and height are both empty', function () {
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' },
        outline: true,
      });
      assert.strictEqual(result.format, 'A4');
      assert.strictEqual(result.width, '');
      assert.strictEqual(result.height, '');
      assert.strictEqual(result.outline, true);
    });

    it('should clear format when width is specified', function () {
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '10cm',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' },
        outline: false,
      });
      assert.strictEqual(result.format, '');
      assert.strictEqual(result.width, '10cm');
      assert.strictEqual(result.outline, false);
    });

    it('should clear format when height is specified', function () {
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '15cm',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' },
        outline: false,
      });
      assert.strictEqual(result.format, '');
      assert.strictEqual(result.height, '15cm');
    });

    it('should set landscape true when orientation is landscape', function () {
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: 'landscape',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' },
        outline: false,
      });
      assert.strictEqual(result.landscape, true);
    });

    it('should set landscape false when orientation is not landscape', function () {
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: 'portrait',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' },
        outline: false,
      });
      assert.strictEqual(result.landscape, false);
    });

    it('should apply transformTemplate to headerTemplate and footerTemplate', function () {
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: true,
        headerTemplate: '%%ISO-DATE%%',
        footerTemplate: '%%ISO-TIME%%',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' },
        outline: false,
      });
      assert.ok((result.headerTemplate as string).match(/^\d{4}-\d{2}-\d{2}$/), 'headerTemplate should be a date: ' + result.headerTemplate);
      assert.ok((result.footerTemplate as string).match(/^\d{2}:\d{2}:\d{2}$/), 'footerTemplate should be a time: ' + result.footerTemplate);
    });
  });

  describe('buildImageOptions', function () {
    it('should set quality to undefined for PNG', function () {
      const result = utils.buildImageOptions({
        path: '/out/test.png',
        type: 'png',
        quality: 100,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false,
      });
      assert.strictEqual(result.quality, undefined);
      assert.strictEqual(result.fullPage, true);
      assert.strictEqual(result.clip, undefined);
    });

    it('should use quality value for JPEG', function () {
      const result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 85,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false,
      });
      assert.strictEqual(result.quality, 85);
      assert.strictEqual(result.fullPage, true);
    });

    it('should use clip and set fullPage false when all clip values are non-null', function () {
      const result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 100,
        clip: { x: 0, y: 0, width: 800, height: 600 },
        omitBackground: false,
      });
      assert.strictEqual(result.fullPage, false);
      assert.deepStrictEqual(result.clip, { x: 0, y: 0, width: 800, height: 600 });
    });

    it('should ignore clip and set fullPage true when any clip value is null', function () {
      const result = utils.buildImageOptions({
        path: '/out/test.png',
        type: 'png',
        quality: 100,
        clip: { x: 0, y: null, width: 800, height: 600 },
        omitBackground: true,
      });
      assert.strictEqual(result.fullPage, true);
      assert.strictEqual(result.clip, undefined);
      assert.strictEqual(result.omitBackground, true);
    });

    it('should set omitBackground false when specified', function () {
      const result = utils.buildImageOptions({
        path: '/out/test.png',
        type: 'png',
        quality: 100,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false,
      });
      assert.strictEqual(result.omitBackground, false);
    });

    it('should set fullPage true when all clip values are null', function () {
      const result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 80,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false,
      });
      assert.strictEqual(result.fullPage, true);
      assert.strictEqual(result.clip, undefined);
      assert.strictEqual(result.quality, 80);
    });

    it('should accept quality 0 for JPEG as valid boundary', function () {
      const result = utils.buildImageOptions({
        path: '/out/test.jpeg',
        type: 'jpeg',
        quality: 0,
        clip: { x: null, y: null, width: null, height: null },
        omitBackground: false,
      });
      assert.strictEqual(result.quality, 0);
    });
  });

  describe('buildHighlightCallback', function () {
    const hljs = require('highlight.js');
    const escapeHtml = require('markdown-it')().utils.escapeHtml;

    it('should return mermaid div when lang matches mermaid', function () {
      const highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      const result = highlight('graph TD;', 'mermaid');
      assert.strictEqual(result, '<div class="mermaid">graph TD;</div>');
    });

    it('should return mermaid div for case-insensitive match', function () {
      const highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      const result = highlight('graph TD;', 'Mermaid');
      assert.strictEqual(result, '<div class="mermaid">graph TD;</div>');
    });

    it('should highlight known language with hljs', function () {
      const highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      const result = highlight('var x = 1;', 'javascript');
      assert.ok(result.indexOf('<pre class="hljs"><code><div>') === 0);
      assert.ok(result.indexOf('</div></code></pre>') > 0);
      assert.ok(result.indexOf('<span') > 0);
    });

    it('should call hljs.highlight with v11 options object', function () {
      const stubHljs = {
        getLanguage: function () { return true; },
        highlight: function (str: string, options: any) {
          assert.strictEqual(str, 'var x = 1;');
          assert.deepStrictEqual(options, { language: 'javascript', ignoreIllegals: true });
          return { value: '<span class="hljs-keyword">var</span> x = 1;' };
        },
      };
      const highlight = utils.buildHighlightCallback(stubHljs as any, escapeHtml);
      const result = highlight('var x = 1;', 'javascript');
      assert.strictEqual(result, '<pre class="hljs"><code><div><span class="hljs-keyword">var</span> x = 1;</div></code></pre>');
    });

    it('should escape and wrap when lang is unknown', function () {
      const highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      const result = highlight('<script>alert("xss")</script>', 'unknownlang999');
      assert.ok(result.indexOf('<pre class="hljs"><code><div>') === 0);
      assert.ok(result.indexOf('<script>') === -1, 'should escape HTML');
      assert.ok(result.indexOf('&lt;script&gt;') > 0);
    });

    it('should escape and wrap when lang is empty string', function () {
      const highlight = utils.buildHighlightCallback(hljs, escapeHtml);
      const result = highlight('plain text', '');
      assert.strictEqual(result, '<pre class="hljs"><code><div>plain text</div></code></pre>');
    });

    it('should fallback to escapeHtml when hljs.highlight throws', function () {
      const badHljs = {
        getLanguage: function () { return true; },
        highlight: function () { throw new Error('hljs error'); },
      };
      const highlight = utils.buildHighlightCallback(badHljs as any, escapeHtml);
      const result = highlight('<b>code</b>', 'javascript');
      assert.ok(result.indexOf('<pre class="hljs"><code><div>') === 0);
      assert.ok(result.indexOf('&lt;b&gt;') > 0);
    });
  });

  describe('buildMarkdownItOptions', function () {
    it('should always set html to true', function () {
      const result = utils.buildMarkdownItOptions({
        breaks: false,
        hljs: {} as any,
        escapeHtml: function (s: string) { return s; },
      });
      assert.strictEqual(result.html, true);
    });

    it('should pass through breaks value', function () {
      const result = utils.buildMarkdownItOptions({
        breaks: true,
        hljs: {} as any,
        escapeHtml: function (s: string) { return s; },
      });
      assert.strictEqual(result.breaks, true);
    });

    it('should set highlight as a function', function () {
      const result = utils.buildMarkdownItOptions({
        breaks: false,
        hljs: { getLanguage: function () { return false; } } as any,
        escapeHtml: function (s: string) { return s; },
      });
      assert.strictEqual(typeof result.highlight, 'function');
    });

    it('should handle undefined breaks', function () {
      const result = utils.buildMarkdownItOptions({
        breaks: undefined,
        hljs: {} as any,
        escapeHtml: function (s: string) { return s; },
      });
      assert.strictEqual(result.breaks, undefined);
    });
  });

  describe('buildPlantumlOptions', function () {
    it('should use frontmatter values when provided', function () {
      const result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: '@startgantt',
        frontmatterCloseMarker: '@endgantt',
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: 'http://plantuml.example.com',
      });
      assert.strictEqual(result.openMarker, '@startgantt');
      assert.strictEqual(result.closeMarker, '@endgantt');
      assert.strictEqual(result.server, 'http://plantuml.example.com');
    });

    it('should fallback to settings when frontmatter is undefined', function () {
      const result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: undefined,
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: 'http://server.example.com',
      });
      assert.strictEqual(result.openMarker, '@startuml');
      assert.strictEqual(result.closeMarker, '@enduml');
    });

    it('should fallback to defaults when both frontmatter and settings are empty', function () {
      const result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: undefined,
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '',
        settingsCloseMarker: '',
        server: '',
      });
      assert.strictEqual(result.openMarker, '@startuml');
      assert.strictEqual(result.closeMarker, '@enduml');
      assert.strictEqual(result.server, '');
    });

    it('should pass server value through', function () {
      const result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: undefined,
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: 'https://custom.plantuml.server/svg',
      });
      assert.strictEqual(result.server, 'https://custom.plantuml.server/svg');
    });

    it('should allow mixed frontmatter and settings overrides', function () {
      const result = utils.buildPlantumlOptions({
        frontmatterOpenMarker: '@startmindmap',
        frontmatterCloseMarker: undefined,
        settingsOpenMarker: '@startuml',
        settingsCloseMarker: '@enduml',
        server: '',
      });
      assert.strictEqual(result.openMarker, '@startmindmap');
      assert.strictEqual(result.closeMarker, '@enduml');
    });
  });

  describe('buildHtmlViewData', function () {
    it('should build script tag from mermaidServer', function () {
      const result = utils.buildHtmlViewData({
        content: '<h1>Hello</h1>',
        title: 'test.md',
        style: '<style>body{}</style>',
        mermaidServer: 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js',
      });
      assert.strictEqual(result.mermaid, '<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>');
    });

    it('should pass through title, style, and content', function () {
      const result = utils.buildHtmlViewData({
        content: '<p>body</p>',
        title: 'README.md',
        style: '<style>h1{color:red}</style>',
        mermaidServer: '',
      });
      assert.strictEqual(result.title, 'README.md');
      assert.strictEqual(result.style, '<style>h1{color:red}</style>');
      assert.strictEqual(result.content, '<p>body</p>');
    });

    it('should handle empty mermaidServer', function () {
      const result = utils.buildHtmlViewData({
        content: '',
        title: '',
        style: '',
        mermaidServer: '',
      });
      assert.strictEqual(result.mermaid, '<script src=""></script>');
    });

    it('should pass through empty content fields unchanged', function () {
      const result = utils.buildHtmlViewData({
        content: '',
        title: 'empty.md',
        style: '',
        mermaidServer: 'https://example.com/mermaid.js',
      });
      assert.strictEqual(result.title, 'empty.md');
      assert.strictEqual(result.content, '');
    });
  });

  describe('buildPdfOptions edge cases', function () {
    it('should pass through margin object', function () {
      const margin = { top: '10mm', right: '15mm', bottom: '10mm', left: '15mm' };
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: margin,
        outline: false,
      });
      assert.deepStrictEqual(result.margin, margin);
    });

    it('should handle empty headerTemplate and footerTemplate', function () {
      const result = utils.buildPdfOptions({
        path: '/out/test.pdf',
        width: '',
        height: '',
        format: 'A4',
        orientation: '',
        scale: 1,
        displayHeaderFooter: true,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        pageRanges: '',
        margin: { top: '', right: '', bottom: '', left: '' },
        outline: false,
      });
      assert.strictEqual(result.headerTemplate, '');
      assert.strictEqual(result.footerTemplate, '');
    });
  });

  describe('resolveExportTypes', function () {
    it('should return single-element array for direct format "pdf"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('pdf', undefined), ['pdf']);
    });

    it('should return single-element array for direct format "html"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('html', undefined), ['html']);
    });

    it('should return single-element array for direct format "png"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('png', undefined), ['png']);
    });

    it('should return single-element array for direct format "jpeg"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('jpeg', undefined), ['jpeg']);
    });

    it('should return all formats for "all"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('all', undefined), ['html', 'pdf', 'png', 'jpeg']);
    });

    it('should wrap string configuredType in array for "settings"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('settings', 'html'), ['html']);
    });

    it('should return array configuredType as-is for "settings"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('settings', ['pdf', 'html']), ['pdf', 'html']);
    });

    it('should default to ["pdf"] when configuredType is undefined for "settings"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('settings', undefined), ['pdf']);
    });

    it('should default to ["pdf"] when configuredType is empty string for "settings"', function () {
      assert.deepStrictEqual(utils.resolveExportTypes('settings', ''), ['pdf']);
    });

    it('should return null for invalid type "docx"', function () {
      assert.strictEqual(utils.resolveExportTypes('docx', undefined), null);
    });

    it('should return null for empty string', function () {
      assert.strictEqual(utils.resolveExportTypes('', undefined), null);
    });

    it('should return null for undefined', function () {
      assert.strictEqual(utils.resolveExportTypes(undefined, undefined), null);
    });
  });

  describe('transformImageHref', function () {
    it('should decode URI and remove quotes for html type', function () {
      assert.strictEqual(utils.transformImageHref('image%20file.png', 'html', '/doc/test.md'), 'image file.png');
    });

    it('should remove single quotes from href for html type', function () {
      assert.strictEqual(utils.transformImageHref('\'image.png\'', 'html', '/doc/test.md'), 'image.png');
    });

    it('should remove double quotes from href for html type', function () {
      assert.strictEqual(utils.transformImageHref('"image.png"', 'html', '/doc/test.md'), 'image.png');
    });

    it('should return plain path unchanged for html type', function () {
      assert.strictEqual(utils.transformImageHref('image.png', 'html', '/doc/test.md'), 'image.png');
    });

    it('should delegate to convertImgPath for pdf type', function () {
      assert.strictEqual(utils.transformImageHref('image.png', 'pdf', '/doc/test.md'), utils.convertImgPath('image.png', '/doc/test.md'));
    });

    it('should delegate to convertImgPath for png type', function () {
      assert.strictEqual(utils.transformImageHref('image.png', 'png', '/doc/test.md'), utils.convertImgPath('image.png', '/doc/test.md'));
    });

    it('should delegate to convertImgPath for jpeg type', function () {
      assert.strictEqual(utils.transformImageHref('image.png', 'jpeg', '/doc/test.md'), utils.convertImgPath('image.png', '/doc/test.md'));
    });

    it('should handle encoded special characters for html type', function () {
      assert.strictEqual(utils.transformImageHref('img%23%26name.png', 'html', '/doc/test.md'), 'img#&name.png');
    });
  });

  describe('transformHtmlBlock', function () {
    it('should transform a single img tag src', function () {
      const result = utils.transformHtmlBlock('<img src="photo.png">', '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('photo.png') >= 0);
    });

    it('should transform multiple img tags', function () {
      const result = utils.transformHtmlBlock('<img src="a.png"><img src="b.png">', '/doc/test.md');
      assert.ok(result.indexOf('a.png') >= 0);
      assert.ok(result.indexOf('b.png') >= 0);
      const matches = result.match(/file:\/\//g);
      assert.strictEqual(matches!.length, 2);
    });

    it('should return html unchanged when no img tags', function () {
      const result = utils.transformHtmlBlock('<p>Hello world</p>', '/doc/test.md');
      assert.ok(result.indexOf('Hello world') >= 0);
    });

    it('should handle empty html string', function () {
      assert.strictEqual(utils.transformHtmlBlock('', '/doc/test.md'), '');
    });

    it('should handle relative path images', function () {
      const result = utils.transformHtmlBlock('<img src="images/photo.png">', '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('photo.png') >= 0);
    });

    it('should handle absolute path images', function () {
      const result = utils.transformHtmlBlock('<img src="/abs/photo.png">', '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('/abs/photo.png') >= 0);
    });

    it('should rewrite the real src attribute and preserve data-src', function () {
      const result = utils.transformHtmlBlock('<img data-src="lazy.png" src="real.png">', '/doc/test.md');
      assert.ok(result.indexOf('data-src="lazy.png"') >= 0);
      assert.ok(result.indexOf('src="file:///doc/real.png"') >= 0);
      assert.ok(result.indexOf('data-src="lazy.png" src="file:///doc/real.png"') >= 0);
    });

    it('should handle spacing around src equals', function () {
      const result = utils.transformHtmlBlock('<img src = "photo.png">', '/doc/test.md');
      assert.strictEqual(result, '<img src = "file:///doc/photo.png">');
    });

    it('should handle unquoted src attributes', function () {
      const result = utils.transformHtmlBlock('<img src=photo.png>', '/doc/test.md');
      assert.ok(result.indexOf('src="file:///doc/photo.png"') >= 0);
    });

    it('should handle multiple images with mixed attribute ordering', function () {
      const result = utils.transformHtmlBlock(
        '<img data-src="lazy.png" src="real.png"><img alt="desc" src = "photo.png">',
        '/doc/test.md',
      );
      assert.strictEqual(
        result,
        '<img data-src="lazy.png" src="file:///doc/real.png"><img alt="desc" src = "file:///doc/photo.png">',
      );
    });

    it('should handle self-closing img tags', function () {
      const result = utils.transformHtmlBlock('<img src="photo.png" />', '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('photo.png') >= 0);
    });

    it('should handle img tags with other attributes', function () {
      const result = utils.transformHtmlBlock('<img alt="desc" src="photo.png" width="100">', '/doc/test.md');
      assert.ok(result.indexOf('alt="desc"') >= 0);
      assert.ok(result.indexOf('width="100"') >= 0);
      assert.ok(result.indexOf('src="file:///doc/photo.png"') >= 0);
    });

    it('should handle quotes that contain a greater-than sign', function () {
      const result = utils.transformHtmlBlock('<img alt="a > b" src="photo.png">', '/doc/test.md');
      assert.ok(result.indexOf('alt="a > b"') >= 0);
      assert.ok(result.indexOf('src="file:///doc/photo.png"') >= 0);
    });

    it('should preserve quoted non-src attributes that contain src text', function () {
      const result = utils.transformHtmlBlock('<img alt="look src=bad.png" src="real.png">', '/doc/test.md');
      assert.strictEqual(result, '<img alt="look src=bad.png" src="file:///doc/real.png">');
    });

    it('should ignore img text inside comments', function () {
      const result = utils.transformHtmlBlock('<!-- <img src="x.png"> -->', '/doc/test.md');
      assert.strictEqual(result, '<!-- <img src="x.png"> -->');
    });

    it('should ignore img text inside quoted attributes on other tags', function () {
      const result = utils.transformHtmlBlock('<p title="<img src=x.png>">x</p>', '/doc/test.md');
      assert.strictEqual(result, '<p title="<img src=x.png>">x</p>');
    });

    it('should ignore custom element names that start with img', function () {
      const result = utils.transformHtmlBlock('<img-card src="x.png"></img-card>', '/doc/test.md');
      assert.strictEqual(result, '<img-card src="x.png"></img-card>');
    });

    it('should ignore img text inside script content', function () {
      const result = utils.transformHtmlBlock('<script>const html = "<img src=x.png>";</script>', '/doc/test.md');
      assert.strictEqual(result, '<script>const html = "<img src=x.png>";</script>');
    });

    it('should ignore img text inside style content', function () {
      const result = utils.transformHtmlBlock('<style>.icon { background: url("<img src=x.png>"); }</style>', '/doc/test.md');
      assert.strictEqual(result, '<style>.icon { background: url("<img src=x.png>"); }</style>');
    });

    it('should ignore img text inside textarea content', function () {
      const result = utils.transformHtmlBlock('<textarea><img src=x.png></textarea>', '/doc/test.md');
      assert.strictEqual(result, '<textarea><img src=x.png></textarea>');
    });

    it('should handle whitespace before the closing raw-text tag', function () {
      const result = utils.transformHtmlBlock('<script>const html = "<img src=x.png>";</script ><img src=real.png>', '/doc/test.md');
      assert.strictEqual(result, '<script>const html = "<img src=x.png>";</script ><img src="file:///doc/real.png">');
    });

    it('should preserve surrounding html', function () {
      const result = utils.transformHtmlBlock('<p>before</p><img src="photo.png"><p>after</p>', '/doc/test.md');
      assert.ok(result.indexOf('<p>before</p>') >= 0);
      assert.ok(result.indexOf('<p>after</p>') >= 0);
      assert.ok(result.indexOf('file://') >= 0);
    });

    it('should normalize self-closing div to open/close pair', function () {
      const result = utils.transformHtmlBlock('<div class="page" />', '/doc/test.md');
      assert.strictEqual(result, '<div class="page"></div>');
    });

    it('should normalize self-closing div without space before slash', function () {
      const result = utils.transformHtmlBlock('<div class="page"/>', '/doc/test.md');
      assert.strictEqual(result, '<div class="page"></div>');
    });

    it('should normalize self-closing span', function () {
      const result = utils.transformHtmlBlock('<span/>', '/doc/test.md');
      assert.strictEqual(result, '<span></span>');
    });

    it('should normalize self-closing p with attributes', function () {
      const result = utils.transformHtmlBlock('<p class="note" />', '/doc/test.md');
      assert.strictEqual(result, '<p class="note"></p>');
    });

    it('should not normalize self-closing void elements', function () {
      assert.strictEqual(utils.transformHtmlBlock('<hr class="page"/>', '/doc/test.md'), '<hr class="page"/>');
      assert.strictEqual(utils.transformHtmlBlock('<br/>', '/doc/test.md'), '<br/>');
      assert.strictEqual(utils.transformHtmlBlock('<input type="text" />', '/doc/test.md'), '<input type="text" />');
    });

    it('should not modify non-self-closing tags', function () {
      const result = utils.transformHtmlBlock('<div class="page"></div>', '/doc/test.md');
      assert.strictEqual(result, '<div class="page"></div>');
    });
  });

  describe('buildEmojiTag', function () {
    it('should return img tag with base64 data when emojiData is provided', function () {
      assert.strictEqual(utils.buildEmojiTag('smile', 'aGVsbG8='), '<img class="emoji" alt="smile" src="data:image/png;base64,aGVsbG8=" />');
    });

    it('should return fallback text when emojiData is empty string', function () {
      assert.strictEqual(utils.buildEmojiTag('smile', ''), ':smile:');
    });

    it('should return fallback text when emojiData is null', function () {
      assert.strictEqual(utils.buildEmojiTag('smile', null), ':smile:');
    });

    it('should return fallback text when emojiData is undefined', function () {
      assert.strictEqual(utils.buildEmojiTag('smile', undefined), ':smile:');
    });

    it('should handle emoji name with special characters in alt attribute', function () {
      assert.strictEqual(utils.buildEmojiTag('+1', 'aGVsbG8='), '<img class="emoji" alt="+1" src="data:image/png;base64,aGVsbG8=" />');
    });

    it('should handle emoji name with hyphen', function () {
      assert.strictEqual(utils.buildEmojiTag('heavy-check-mark', 'data123'), '<img class="emoji" alt="heavy-check-mark" src="data:image/png;base64,data123" />');
    });
  });

  describe('buildContainerRenderer', function () {
    let renderer: any;

    before(function () {
      renderer = utils.buildContainerRenderer();
    });

    describe('validate', function () {
      it('should return truthy for non-empty name', function () {
        assert.ok(renderer.validate('warning'));
      });

      it('should return falsy for empty string', function () {
        assert.ok(!renderer.validate(''));
      });

      it('should return falsy for whitespace-only string', function () {
        assert.ok(!renderer.validate('   '));
      });

      it('should return truthy for name with surrounding spaces', function () {
        assert.ok(renderer.validate('  warning  '));
      });
    });

    describe('render', function () {
      it('should return opening div with class when info is non-empty', function () {
        const tokens = [{ info: 'warning' }];
        assert.strictEqual(renderer.render(tokens, 0), '<div class="warning">\n');
      });

      it('should return closing div when info is empty', function () {
        const tokens = [{ info: '' }];
        assert.strictEqual(renderer.render(tokens, 0), '</div>\n');
      });

      it('should trim whitespace from class name', function () {
        const tokens = [{ info: '  note  ' }];
        assert.strictEqual(renderer.render(tokens, 0), '<div class="note">\n');
      });

      it('should return closing div when info is whitespace-only', function () {
        const tokens = [{ info: '   ' }];
        assert.strictEqual(renderer.render(tokens, 0), '</div>\n');
      });

      it('should handle class name with multiple words', function () {
        const tokens = [{ info: 'alert danger' }];
        assert.strictEqual(renderer.render(tokens, 0), '<div class="alert danger">\n');
      });
    });
  });

  describe('generateTmpHtmlFilename', function () {
    const path = require('path');

    it('should replace extension with _tmp.html', function () {
      assert.strictEqual(utils.generateTmpHtmlFilename('/path/to/file.md'), path.join('/path/to', 'file_tmp.html'));
    });

    it('should handle file without extension', function () {
      assert.strictEqual(utils.generateTmpHtmlFilename('/path/to/file'), path.join('/path/to', 'file_tmp.html'));
    });

    it('should handle deeply nested path', function () {
      assert.strictEqual(utils.generateTmpHtmlFilename('/a/b/c/d/document.md'), path.join('/a/b/c/d', 'document_tmp.html'));
    });

    it('should handle filename with dots', function () {
      assert.strictEqual(utils.generateTmpHtmlFilename('/path/to/my.file.name.md'), path.join('/path/to', 'my.file.name_tmp.html'));
    });
  });
  describe('renderTemplate', function () {
    it('should replace triple-brace variables with view values', function () {
      const template = '<title>{{{title}}}</title><style>{{{style}}}</style>';
      const view = { title: 'My Doc', style: '.body { color: red; }' };
      assert.strictEqual(utils.renderTemplate(template, view), '<title>My Doc</title><style>.body { color: red; }</style>');
    });

    it('should leave unmatched variables as-is', function () {
      const template = '{{{title}}} {{{unknown}}}';
      const view = { title: 'Hello' };
      assert.strictEqual(utils.renderTemplate(template, view), 'Hello {{{unknown}}}');
    });

    it('should handle template with no variables', function () {
      const template = '<p>No variables here</p>';
      const view = { title: 'Hello' };
      assert.strictEqual(utils.renderTemplate(template, view), '<p>No variables here</p>');
    });

    it('should not escape HTML in values', function () {
      const template = '{{{content}}}';
      const view = { content: '<h1>Title</h1>' };
      assert.strictEqual(utils.renderTemplate(template, view), '<h1>Title</h1>');
    });

    it('should replace multiple occurrences of the same variable', function () {
      const template = '{{{x}}} and {{{x}}}';
      const view = { x: 'val' };
      assert.strictEqual(utils.renderTemplate(template, view), 'val and val');
    });
  });

  describe('parseFrontMatter', function () {
    it('should parse YAML front matter and return data and content', function () {
      const text = '---\nbreaks: true\nemoji: false\n---\n# Hello';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true, emoji: false });
      assert.strictEqual(result.content, '# Hello');
    });

    it('should parse front matter after a UTF-8 BOM', function () {
      const text = '\uFEFF---\nbreaks: true\n---\nbody';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true });
      assert.strictEqual(result.content, 'body');
    });

    it('should return empty data when no front matter exists', function () {
      const text = '# Hello\nWorld';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '# Hello\nWorld');
    });

    it('should handle front matter with string values', function () {
      const text = '---\nplantumlOpenMarker: "@startuml"\n---\nContent';
      const result = utils.parseFrontMatter(text);
      assert.strictEqual(result.data.plantumlOpenMarker, '@startuml');
      assert.strictEqual(result.content, 'Content');
    });

    it('should return empty data when front matter is a YAML sequence', function () {
      const text = '---\n- a\n---\nbody';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, 'body');
    });

    it('should parse front matter at EOF without a trailing newline', function () {
      const text = '---\nbreaks: true\n---';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true });
      assert.strictEqual(result.content, '');
    });

    it('should return empty data when front matter is a scalar value', function () {
      const text = '---\n42\n---\nbody';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, 'body');
    });

    it('should return empty data when front matter is a timestamp scalar', function () {
      const text = '---\n2020-01-01\n---\nbody';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, 'body');
    });

    it('should handle empty front matter block', function () {
      const text = '---\n---\n# Hello';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '# Hello');
    });

    it('should handle front matter with trailing newline', function () {
      const text = '---\nbreaks: true\n---\n\n# Hello\n';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true });
      assert.strictEqual(result.content, '\n# Hello\n');
    });

    it('should not treat --- in body as front matter delimiter', function () {
      const text = '# Hello\n---\nbreaks: true\n---\n';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '# Hello\n---\nbreaks: true\n---\n');
    });

    it('should handle empty string', function () {
      const text = '';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '');
    });

    it('should handle front matter only (no content after)', function () {
      const text = '---\nbreaks: true\n---\n';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true });
      assert.strictEqual(result.content, '');
    });
  });

  describe('filterHeadingLevels', function () {
    it('should replace headings outside the range with div tags', function () {
      const html = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4>';
      const result = utils.filterHeadingLevels(html, 2, 3);
      assert.strictEqual(result, '<div class="h1">H1</div><h2>H2</h2><h3>H3</h3><div class="h4">H4</div>');
    });

    it('should preserve attributes on headings', function () {
      const html = '<h1 id="top" class="main">Title</h1>';
      const result = utils.filterHeadingLevels(html, 2, 3);
      assert.strictEqual(result, '<div class="h1" id="top" class="main">Title</div>');
    });

    it('should handle multiline headings', function () {
      const html = '<h1>\nLine 1\nLine 2\n</h1>';
      const result = utils.filterHeadingLevels(html, 2, 3);
      assert.strictEqual(result, '<div class="h1">\nLine 1\nLine 2\n</div>');
    });

    it('should not change headings within the range', function () {
      const html = '<h2>H2</h2>';
      const result = utils.filterHeadingLevels(html, 2, 3);
      assert.strictEqual(result, '<h2>H2</h2>');
    });

    it('should handle all headings being filtered out', function () {
      const html = '<h1>H1</h1>';
      const result = utils.filterHeadingLevels(html, 2, 2);
      assert.strictEqual(result, '<div class="h1">H1</div>');
    });

    it('should handle none being filtered out', function () {
      const html = '<h1>H1</h1>';
      const result = utils.filterHeadingLevels(html, 1, 6);
      assert.strictEqual(result, '<h1>H1</h1>');
    });

    it('should replace headings before the start marker with div tags', function () {
      const html = '<h1>Before</h1><!-- /TOC --><h1>After</h1>';
      const result = utils.filterHeadingLevels(html, 1, 6, '<!-- /TOC -->');
      assert.strictEqual(result, '<div class="h1">Before</div><!-- /TOC --><h1>After</h1>');
    });
  });
});
