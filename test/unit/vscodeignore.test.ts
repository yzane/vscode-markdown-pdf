import { describe, it, before } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

describe('.vscodeignore', function () {
  let vscodeignore: string;

  before(function () {
    const vscodeignorePath = path.join(__dirname, '..', '..', '.vscodeignore');
    vscodeignore = fs.readFileSync(vscodeignorePath, 'utf-8');
  });

  it('should exclude all node_modules by default', function () {
    assert.match(vscodeignore, /^node_modules\/\*\*$/m);
  });

  it('should exclude source files that are bundled', function () {
    assert.match(vscodeignore, /^src\/\*\*$/m);
  });

  it('should exclude tsconfig.json', function () {
    assert.match(vscodeignore, /^tsconfig\.json$/m);
  });

  it('should not re-include puppeteer-core (bundled by esbuild)', function () {
    assert.doesNotMatch(vscodeignore, /^!node_modules\/puppeteer-core\//m);
    assert.doesNotMatch(vscodeignore, /^!node_modules\/@puppeteer\//m);
  });

  it('should re-include runtime asset packages', function () {
    assert.match(vscodeignore, /^!node_modules\/emoji-images\/pngs\/\*\*$/m);
    assert.match(vscodeignore, /^!node_modules\/highlight\.js\/styles\/\*\*$/m);
  });
});
