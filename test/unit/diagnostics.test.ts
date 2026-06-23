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
  it('shows autoDownload=false', () => {
    const block = diagnostics.buildContextBlock(makeContext({ autoDownload: false }), HOME);
    assert.match(block, /chromium\.autoDownload: false/);
  });
  it('treats a whitespace-only config value as not set', () => {
    const block = diagnostics.buildContextBlock(makeContext({ executablePath: '   ' }), HOME);
    assert.match(block, /executablePath: \(not set\)/);
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
  it('joins the two blocks with a single newline', () => {
    const out = diagnostics.buildStartDiagnostics(ENV, makeContext(), HOME);
    assert.ok(out.includes('\n--- Convert ---'));
  });
});

// Build an Error carrying a Node fs error code (e.g. EBUSY) for classifyError tests.
function errWith(message: string, code?: string): Error {
  const e = new Error(message);
  if (code !== undefined) {
    (e as NodeJS.ErrnoException).code = code;
  }
  return e;
}

describe('classifyError', () => {
  it('rule 1: browser launch failure → Chromium hint + executablePath setting', () => {
    const r = diagnostics.classifyError(errWith('Failed to launch the browser process! spawn ENOENT'));
    assert.match(r?.hint ?? '', /Chromium/);
    const a = r?.action;
    assert.ok(a?.kind === 'settings' && /markdown-pdf\.executablePath/.test(a.query));
  });
  it('rule 1: "Could not find" browser message also matches', () => {
    assert.match(diagnostics.classifyError(errWith('Could not find Chrome (ver. 131).'))?.hint ?? '', /Chromium/);
  });
  it('rule 2: EBUSY/EPERM/EACCES code → write-file hint, no action', () => {
    for (const code of ['EBUSY', 'EPERM', 'EACCES']) {
      const r = diagnostics.classifyError(errWith('write failed', code));
      assert.match(r?.hint ?? '', /write the output file/i);
      assert.equal(r?.action, undefined);
    }
  });
  it('rule 2: also matches via message token (wrapped error)', () => {
    assert.match(
      diagnostics.classifyError(errWith('EBUSY: resource busy or locked, open ...'))?.hint ?? '',
      /write the output file/i);
  });
  it('rule 3: ENOSPC → disk-space hint', () => {
    assert.match(diagnostics.classifyError(errWith('no space', 'ENOSPC'))?.hint ?? '', /space/i);
  });
  it('rule 4: ENOENT/EISDIR → output-path hint + outputDirectory setting', () => {
    for (const code of ['ENOENT', 'EISDIR']) {
      const r = diagnostics.classifyError(errWith('bad path', code));
      assert.match(r?.hint ?? '', /output path/i);
      const a = r?.action;
      assert.ok(a?.kind === 'settings' && /markdown-pdf\.outputDirectory/.test(a.query));
    }
  });
  it('order: launch failure wins over an EACCES code', () => {
    const r = diagnostics.classifyError(errWith('Failed to launch the browser process!', 'EACCES'));
    assert.match(r?.hint ?? '', /Chromium/);
  });
  it('returns undefined for an unrecognized error', () => {
    assert.equal(diagnostics.classifyError(errWith('something totally unexpected')), undefined);
  });
  it('classifies from non-Error string values', () => {
    assert.match(diagnostics.classifyError('EACCES: denied')?.hint ?? '', /write the output file/i);
  });

  it('rule 1: missing shared libraries → system-libraries hint + Troubleshooting url', () => {
    const r = diagnostics.classifyError(errWith(
      'error while loading shared libraries: libnss3.so: cannot open shared object file'));
    assert.match(r?.hint ?? '', /system librar/i);
    const a = r?.action;
    assert.ok(a?.kind === 'url' && /pptr\.dev/.test(a.url));
  });
  it('rule 1: matches "cannot open shared object file" alone', () => {
    assert.match(
      diagnostics.classifyError(errWith('libatk-1.0.so.0: cannot open shared object file'))?.hint ?? '',
      /system librar/i);
  });
  it('order: shared-library failure wins over the generic launch failure', () => {
    const r = diagnostics.classifyError(errWith(
      'Failed to launch the browser process!\n... error while loading shared libraries: libgbm.so.1 ...'));
    assert.match(r?.hint ?? '', /system librar/i);
    assert.equal(r?.action?.kind, 'url');
  });
  it('classifies a shared-library failure nested under error.cause', () => {
    const inner = errWith('error while loading shared libraries: libgbm.so.1: cannot open shared object file');
    const outer = new Error('Failed to launch the browser process!') as Error & { cause?: unknown };
    outer.cause = inner;
    const r = diagnostics.classifyError(outer);
    assert.match(r?.hint ?? '', /system librar/i);
    assert.equal(r?.action?.kind, 'url');
  });
  it('classifies a generic code (EBUSY) nested under error.cause', () => {
    const outer = new Error('export wrapper failed') as Error & { cause?: unknown };
    outer.cause = errWith('EBUSY: resource busy or locked', 'EBUSY');
    assert.match(diagnostics.classifyError(outer)?.hint ?? '', /write the output file/i);
  });
});
