'use strict';

var { describe, it } = require('node:test');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

describe('.vscodeignore', function () {
  it('should exclude the unused emoji-images json payload from packaging', function () {
    var vscodeignorePath = path.join(__dirname, '..', '..', '.vscodeignore');
    var vscodeignore = fs.readFileSync(vscodeignorePath, 'utf-8');

    assert.match(vscodeignore, /^node_modules\/emoji-images\/json\/\*\*$/m);
  });
});
