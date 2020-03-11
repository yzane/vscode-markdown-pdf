#!/usr/bin/env node

var fs  = require('fs');
var path = require('path');
var rimraf = require('rimraf')
var removeNPMAbsolutePaths = require('removeNPMAbsolutePaths');

// Delete the unnecessary files in order to reduce the size of the package
console.log('delete file...');
deleteFile(path.join(__dirname, '..', 'node_modules', 'emoji-images', 'json'));
deleteFile(path.join(__dirname, '..', 'node_modules', 'puppeteer-core', '.local-chromium'));

removeNPMAbsolutePaths(path.join(__dirname, '..', 'node_modules'), { force: true, fields: ['_where', '_args']})
  .then(results => results.forEach(result => {
    // Print only information about files that couldn't be processed
    if (!result.success) {
      console.log(result.err.message);
    }
  }))
  .catch(err => console.log(err.message));

function deleteFile (dir) {
  rimraf(dir, function(err) {
    if (err) throw err;
    console.log(dir);
  });
}
