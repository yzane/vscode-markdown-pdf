#!/usr/bin/env node

var fs  = require('fs');
var path = require('path');
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
  removePath(dir, function(err) {
    if (err) throw err;
    console.log(dir);
  });
}

function isIgnorableRemoveError(error) {
  return error && error.code === 'ENOENT';
}

function removePath(targetPath, callback) {
  if (typeof fs.rm === 'function') {
    fs.rm(targetPath, { recursive: true, force: true }, function(err) {
      if (isIgnorableRemoveError(err)) {
        callback(null);
        return;
      }
      callback(err || null);
    });
    return;
  }

  removePathFallback(targetPath, callback);
}

function removePathFallback(targetPath, callback) {
  fs.lstat(targetPath, function(statError, stats) {
    if (isIgnorableRemoveError(statError)) {
      callback(null);
      return;
    }
    if (statError) {
      callback(statError);
      return;
    }

    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      fs.readdir(targetPath, function(readError, entries) {
        if (isIgnorableRemoveError(readError)) {
          callback(null);
          return;
        }
        if (readError) {
          callback(readError);
          return;
        }

        removePathEntries(targetPath, entries, function(entryError) {
          if (entryError) {
            callback(entryError);
            return;
          }

          fs.rmdir(targetPath, function(rmdirError) {
            if (isIgnorableRemoveError(rmdirError)) {
              callback(null);
              return;
            }
            callback(rmdirError || null);
          });
        });
      });
      return;
    }

    fs.unlink(targetPath, function(unlinkError) {
      if (isIgnorableRemoveError(unlinkError)) {
        callback(null);
        return;
      }
      callback(unlinkError || null);
    });
  });
}

function removePathEntries(targetPath, entries, callback) {
  var index = 0;

  function next(error) {
    if (error) {
      callback(error);
      return;
    }

    if (index >= entries.length) {
      callback(null);
      return;
    }

    var entryPath = path.join(targetPath, entries[index]);
    index += 1;
    removePathFallback(entryPath, next);
  }

  next(null);
}
