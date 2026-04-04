'use strict';

var { describe, it } = require('node:test');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

describe('.vscodeignore', function () {
  var vscodeignore;

  it('should load .vscodeignore', function () {
    var vscodeignorePath = path.join(__dirname, '..', '..', '.vscodeignore');
    vscodeignore = fs.readFileSync(vscodeignorePath, 'utf-8');
    assert.ok(vscodeignore.length > 0);
  });

  it('should exclude all node_modules by default', function () {
    assert.match(vscodeignore, /^node_modules\/\*\*$/m);
  });

  it('should exclude source files that are bundled', function () {
    assert.match(vscodeignore, /^extension\.js$/m);
    assert.match(vscodeignore, /^src\/\*\*$/m);
  });

  it('should re-include puppeteer-core and its dependencies', function () {
    assert.match(vscodeignore, /^!node_modules\/puppeteer-core\/\*\*$/m);
    assert.match(vscodeignore, /^!node_modules\/@puppeteer\/browsers\/\*\*$/m);
  });

  it('should re-include runtime asset packages', function () {
    assert.match(vscodeignore, /^!node_modules\/emoji-images\/pngs\/\*\*$/m);
    assert.match(vscodeignore, /^!node_modules\/highlight\.js\/styles\/\*\*$/m);
  });
});
