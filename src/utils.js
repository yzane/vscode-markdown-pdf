'use strict';

var fs = require('fs');
var path = require('path');
var url = require('url');

function setBooleanValue(a, b) {
  if (a === false) {
    return false;
  } else {
    return a || b;
  }
}

function isExistsPath(path) {
  if (path.length === 0) {
    return false;
  }
  try {
    fs.accessSync(path);
    return true;
  } catch (error) {
    console.warn(error.message);
    return false;
  }
}

function isExistsDir(dirname) {
  if (dirname.length === 0) {
    return false;
  }
  try {
    if (fs.statSync(dirname).isDirectory()) {
      return true;
    } else {
      console.warn('Directory does not exist!');
      return false;
    }
  } catch (error) {
    console.warn(error.message);
    return false;
  }
}

function Slug(string) {
  var stg = encodeURI(
    string.trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[\]\[\!\/\'\"\#\$\%\&\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\{\|\}\~\`。，、；：？！…—·ˉ¨‘’“”々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝]/g, '')
      .replace(/^\-+/, '')
      .replace(/\-+$/, '')
  );
  return stg;
}

function transformTemplate(templateText) {
  if (templateText.indexOf('%%ISO-DATETIME%%') !== -1) {
    templateText = templateText.replace('%%ISO-DATETIME%%', new Date().toISOString().substr(0, 19).replace('T', ' '));
  }
  if (templateText.indexOf('%%ISO-DATE%%') !== -1) {
    templateText = templateText.replace('%%ISO-DATE%%', new Date().toISOString().substr(0, 10));
  }
  if (templateText.indexOf('%%ISO-TIME%%') !== -1) {
    templateText = templateText.replace('%%ISO-TIME%%', new Date().toISOString().substr(11, 8));
  }

  return templateText;
}

function readFile(filename, encode) {
  if (filename.length === 0) {
    return '';
  }
  if (!encode && encode !== null) {
    encode = 'utf-8';
  }
  if (filename.indexOf('file://') === 0) {
    if (process.platform === 'win32') {
      filename = filename.replace(/^file:\/\/\//, '')
        .replace(/^file:\/\//, '');
    } else {
      filename = filename.replace(/^file:\/\//, '');
    }
  }
  if (isExistsPath(filename)) {
    return fs.readFileSync(filename, encode);
  } else {
    return '';
  }
}

function makeCss(filename) {
  var css = readFile(filename);
  if (css) {
    return '\n<style>\n' + css + '\n</style>\n';
  } else {
    return '';
  }
}

function convertImgPath(src, filename) {
  var href = decodeURIComponent(src);
  href = href.replace(/("|')/g, '')
    .replace(/\\/g, '/')
    .replace(/#/g, '%23');
  var protocol = url.parse(href).protocol;
  if (protocol === 'file:' && href.indexOf('file:///') !== 0) {
    return href.replace(/^file:\/\//, 'file:///');
  } else if (protocol === 'file:') {
    return href;
  } else if (!protocol || path.isAbsolute(href)) {
    href = path.resolve(path.dirname(filename), href).replace(/\\/g, '/')
      .replace(/#/g, '%23');
    if (href.indexOf('//') === 0) {
      return 'file:' + href;
    } else if (href.indexOf('/') === 0) {
      return 'file://' + href;
    } else {
      return 'file:///' + href;
    }
  } else {
    return src;
  }
}

module.exports = {
  setBooleanValue,
  isExistsPath,
  isExistsDir,
  Slug,
  transformTemplate,
  readFile,
  makeCss,
  convertImgPath,
};
