'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var url = require('url');
var cheerio = require('cheerio');

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
    try {
      return fs.readFileSync(filename, encode);
    } catch (error) {
      console.warn(error.message);
      return '';
    }
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

function isExcludeFile(filename, patterns) {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  for (var i = 0; i < patterns.length; i++) {
    var re = new RegExp(patterns[i]);
    if (re.test(filename)) {
      return true;
    }
  }
  return false;
}

function resolveHref(href, resourceFsPath, stylesRelativePathFile, workspaceFsPath) {
  if (!href) {
    return href;
  }

  var parsed = url.parse(href);
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'data:') {
    return href;
  }

  if (href.indexOf('~') === 0) {
    return 'file://' + href.replace(/^~/, os.homedir());
  }

  if (path.isAbsolute(href)) {
    return 'file://' + href;
  }

  if (stylesRelativePathFile === false && workspaceFsPath) {
    return 'file://' + path.join(workspaceFsPath, href);
  }

  return 'file://' + path.join(path.dirname(resourceFsPath), href);
}

function resolveOutputDir(filename, outputDirectory, outputDirectoryRelativePathFile, resourceFsPath, workspaceFsPath) {
  if (!outputDirectory || outputDirectory.length === 0) {
    return filename;
  }

  if (outputDirectory.indexOf('~') === 0) {
    return path.join(outputDirectory.replace(/^~/, os.homedir()), path.basename(filename));
  }

  if (path.isAbsolute(outputDirectory)) {
    if (!isExistsDir(outputDirectory)) {
      return null;
    }
    return path.join(outputDirectory, path.basename(filename));
  }

  if (outputDirectoryRelativePathFile === false && workspaceFsPath) {
    return path.join(workspaceFsPath, outputDirectory, path.basename(filename));
  }

  return path.join(path.dirname(resourceFsPath), outputDirectory, path.basename(filename));
}

function buildStyleTags(options) {
  var style = '';
  var filename = '';
  var i;

  if (options.includeDefaultStyles) {
    filename = path.join(options.baseDir, 'styles', 'markdown.css');
    style += makeCss(filename);
  }

  if (options.includeDefaultStyles) {
    if (options.markdownStyles && Array.isArray(options.markdownStyles) && options.markdownStyles.length > 0) {
      for (i = 0; i < options.markdownStyles.length; i++) {
        var markdownHref = options.resolveHrefFn(options.markdownStyles[i]);
        style += '<link rel="stylesheet" href="' + markdownHref + '" type="text/css">';
      }
    }
  }

  if (options.highlight) {
    if (options.highlightStyle) {
      filename = path.join(options.baseDir, 'node_modules', 'highlight.js', 'styles', options.highlightStyle);
      style += makeCss(filename);
    } else {
      filename = path.join(options.baseDir, 'styles', 'tomorrow.css');
      style += makeCss(filename);
    }
  }

  if (options.includeDefaultStyles) {
    filename = path.join(options.baseDir, 'styles', 'markdown-pdf.css');
    style += makeCss(filename);
  }

  if (options.markdownPdfStyles && Array.isArray(options.markdownPdfStyles) && options.markdownPdfStyles.length > 0) {
    for (i = 0; i < options.markdownPdfStyles.length; i++) {
      var markdownPdfHref = options.resolveHrefFn(options.markdownPdfStyles[i]);
      style += '<link rel="stylesheet" href="' + markdownPdfHref + '" type="text/css">';
    }
  }

  return style;
}

function buildPdfOptions(config) {
  var formatOption = '';
  if (!config.width && !config.height) {
    formatOption = config.format || 'A4';
  }

  return {
    path: config.path,
    scale: config.scale,
    displayHeaderFooter: config.displayHeaderFooter,
    headerTemplate: transformTemplate(config.headerTemplate || ''),
    footerTemplate: transformTemplate(config.footerTemplate || ''),
    printBackground: config.printBackground,
    landscape: config.orientation === 'landscape',
    pageRanges: config.pageRanges,
    format: formatOption,
    width: config.width,
    height: config.height,
    margin: config.margin,
    timeout: 0,
  };
}

function buildImageOptions(config) {
  var qualityOption = config.type === 'png' ? undefined : config.quality;
  var clip = config.clip;

  if (clip && clip.x !== null && clip.y !== null && clip.width !== null && clip.height !== null) {
    return {
      path: config.path,
      quality: qualityOption,
      fullPage: false,
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
      },
      omitBackground: config.omitBackground,
    };
  }

  return {
    path: config.path,
    quality: qualityOption,
    fullPage: true,
    omitBackground: config.omitBackground,
  };
}

function buildHighlightCallback(hljs, escapeHtml) {
  return function (str, lang) {
    if (lang && lang.match(/\bmermaid\b/i)) {
      return '<div class="mermaid">' + str + '</div>';
    }

    if (lang && hljs.getLanguage(lang)) {
      try {
        str = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch (error) {
        str = escapeHtml(str);
      }
    } else {
      str = escapeHtml(str);
    }

    return '<pre class="hljs"><code><div>' + str + '</div></code></pre>';
  };
}

function buildMarkdownItOptions(config) {
  return {
    html: true,
    breaks: config.breaks,
    highlight: buildHighlightCallback(config.hljs, config.escapeHtml),
  };
}

function buildPlantumlOptions(config) {
  return {
    openMarker: config.frontmatterOpenMarker || config.settingsOpenMarker || '@startuml',
    closeMarker: config.frontmatterCloseMarker || config.settingsCloseMarker || '@enduml',
    server: config.server,
  };
}

function buildHtmlViewData(config) {
  return {
    title: config.title,
    style: config.style,
    content: config.content,
    mermaid: '<script src="' + config.mermaidServer + '"></script>',
  };
}

function resolveExportTypes(optionType, configuredType) {
  var typesFormat = ['html', 'pdf', 'png', 'jpeg'];

  if (typesFormat.indexOf(optionType) >= 0) {
    return [optionType];
  }

  if (optionType === 'settings') {
    var resolved = configuredType || 'pdf';
    if (Array.isArray(resolved)) {
      return resolved;
    }
    return [resolved];
  }

  if (optionType === 'all') {
    return typesFormat;
  }

  return null;
}

function transformImageHref(href, type, filename) {
  if (type === 'html') {
    return decodeURIComponent(href).replace(/("|')/g, '');
  }
  return convertImgPath(href, filename);
}

function transformHtmlBlockImages(html, filename) {
  if (!html) {
    return '';
  }
  var $ = cheerio.load(html);
  $('img').each(function () {
    var src = $(this).attr('src');
    var href = convertImgPath(src, filename);
    $(this).attr('src', href);
  });
  return $.html();
}

function buildEmojiTag(emoji, emojiData) {
  if (emojiData) {
    return '<img class="emoji" alt="' + emoji + '" src="data:image/png;base64,' + emojiData + '" />';
  }
  return ':' + emoji + ':';
}

function buildContainerRenderer() {
  return {
    validate: function (name) {
      return name.trim().length;
    },
    render: function (tokens, idx) {
      if (tokens[idx].info.trim() !== '') {
        return '<div class="' + tokens[idx].info.trim() + '">\n';
      }
      return '</div>\n';
    },
  };
}

function generateTmpHtmlFilename(filename) {
  var f = path.parse(filename);
  return path.join(f.dir, f.name + '_tmp.html');
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
  isExcludeFile,
  resolveHref,
  resolveOutputDir,
  buildStyleTags,
  buildPdfOptions,
  buildImageOptions,
  buildHighlightCallback,
  buildMarkdownItOptions,
  buildPlantumlOptions,
  buildHtmlViewData,
  resolveExportTypes,
  transformImageHref,
  transformHtmlBlockImages,
  buildEmojiTag,
  buildContainerRenderer,
  generateTmpHtmlFilename,
};
