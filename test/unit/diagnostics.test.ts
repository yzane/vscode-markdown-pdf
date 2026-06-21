import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as diagnostics from '../../src/diagnostics';

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
});
