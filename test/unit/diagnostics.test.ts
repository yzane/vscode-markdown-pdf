import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as diagnostics from '../../src/diagnostics';
import type { EnvironmentInfo, ConvertContext } from '../../src/diagnostics';

const HOME = 'C:\\Users\\john';

describe('maskHomePath', () => {
  it('replaces a leading home directory with ~', () => {
    assert.equal(diagnostics.maskHomePath('C:\\Users\\john\\docs\\a.md', HOME), '~\\docs\\a.md');
  });
  it('is case-insensitive on the prefix', () => {
    assert.equal(diagnostics.maskHomePath('c:\\users\\john\\a.md', HOME), '~\\a.md');
  });
  it('returns unmatched paths unchanged', () => {
    assert.equal(diagnostics.maskHomePath('D:\\other\\a.md', HOME), 'D:\\other\\a.md');
  });
  it('returns input unchanged when path or homeDir is empty', () => {
    assert.equal(diagnostics.maskHomePath('', HOME), '');
    assert.equal(diagnostics.maskHomePath('C:\\x', ''), 'C:\\x');
  });
  it('does not mask a partial path-component match', () => {
    assert.equal(diagnostics.maskHomePath('C:\\Users\\johnny\\a.md', 'C:\\Users\\john'), 'C:\\Users\\johnny\\a.md');
  });
  it('masks POSIX home paths', () => {
    assert.equal(diagnostics.maskHomePath('/home/john/a.md', '/home/john'), '~/a.md');
  });
  it('masks when the path equals the home directory exactly', () => {
    assert.equal(diagnostics.maskHomePath('C:\\Users\\john', 'C:\\Users\\john'), '~');
  });
});

const ENV: EnvironmentInfo = {
  extensionVersion: '2.1.0',
  vscodeVersion: '1.110.0',
  platform: 'win32',
  osRelease: '10.0.26220',
  arch: 'x64',
  nodeVersion: 'v20.18.0',
  puppeteerCoreVersion: '24.40.0',
  expectedChromeBuildId: '131.0.6778.204',
};

function makeContext(overrides: Partial<ConvertContext> = {}): ConvertContext {
  return {
    sourceFile: 'C:\\Users\\john\\docs\\sample.md',
    outputType: 'pdf',
    executablePath: '',
    autoDownload: true,
    outputDirectory: '',
    sanitize: 'gfm',
    ...overrides,
  };
}

describe('buildEnvironmentBlock', () => {
  it('includes all environment fields', () => {
    const block = diagnostics.buildEnvironmentBlock(ENV);
    assert.match(block, /=== Markdown PDF Diagnostics ===/);
    assert.match(block, /Extension: 2\.1\.0/);
    assert.match(block, /VS Code: 1\.110\.0/);
    assert.match(block, /OS: win32 10\.0\.26220 \(x64\)/);
    assert.match(block, /Node: v20\.18\.0/);
    assert.match(block, /puppeteer-core: 24\.40\.0/);
    assert.match(block, /Expected Chrome build: 131\.0\.6778\.204/);
  });
});

describe('buildContextBlock', () => {
  it('masks paths and shows (not set) for empty config', () => {
    const block = diagnostics.buildContextBlock(makeContext(), HOME);
    assert.match(block, /Source: ~\\docs\\sample\.md/);
    assert.match(block, /Type: pdf/);
    assert.match(block, /sanitize: gfm/);
    assert.match(block, /executablePath: \(not set\)/);
    assert.match(block, /chromium\.autoDownload: true/);
    assert.match(block, /outputDirectory: \(not set\)/);
  });
  it('masks a configured executablePath', () => {
    const block = diagnostics.buildContextBlock(
      makeContext({ executablePath: 'C:\\Users\\john\\chrome.exe' }), HOME);
    assert.match(block, /executablePath: ~\\chrome\.exe/);
  });
});

describe('buildContextSummary', () => {
  it('shows (unresolved) before outputPath/chromium are filled', () => {
    assert.equal(
      diagnostics.buildContextSummary(makeContext(), HOME),
      'type=pdf, source=~\\docs\\sample.md, output=(unresolved), chromium=(unresolved)');
  });
  it('includes resolved output and chromium source', () => {
    assert.equal(
      diagnostics.buildContextSummary(
        makeContext({ outputPath: 'C:\\Users\\john\\docs\\sample.pdf', chromiumSource: 'system' }), HOME),
      'type=pdf, source=~\\docs\\sample.md, output=~\\docs\\sample.pdf, chromium=system');
  });
});

describe('buildStartDiagnostics', () => {
  it('concatenates environment then context block', () => {
    const out = diagnostics.buildStartDiagnostics(ENV, makeContext(), HOME);
    assert.match(out, /=== Markdown PDF Diagnostics ===/);
    assert.match(out, /--- Convert ---/);
    assert.ok(out.indexOf('===') < out.indexOf('---'));
  });
});
