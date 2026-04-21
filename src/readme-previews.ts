import MarkdownIt from 'markdown-it';
import markdownItPlantuml from 'markdown-it-plantuml';
import { resolveOutputDir } from './utils';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractReadmeSection(markdown: string, heading: string): string {
  const headingMatch = heading.match(/^(#+)\s+/);
  if (!headingMatch) {
    throw new Error('Invalid heading: ' + heading);
  }

  const headingLevel = headingMatch[1].length;
  const escapedHeading = escapeRegExp(heading);
  const sectionPattern = new RegExp(
    '^' + escapedHeading + '\\r?\\n([\\s\\S]*?)(?=^#{1,' + headingLevel + '}\\s|\\Z)',
    'm'
  );
  const match = markdown.match(sectionPattern);

  if (!match) {
    throw new Error('Section not found: ' + heading);
  }

  return match[1].trim();
}

// Scans a section line by line, returning the first fenced block that matches the
// caller's intent. Without a language filter, the function returns the first
// simple 3-backtick fence and skips past 4+-backtick wrappers entirely (they are
// used in the README as meta-demos of fenced syntax). With a language filter,
// the function returns the first fence whose info string equals the requested
// language, regardless of fence length.
export function extractFirstFencedBlock(section: string, language?: string): string {
  const lines = section.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const openMatch = /^(`{3,})([^\r\n]*)$/.exec(lines[i]);
    if (!openMatch) {
      i++;
      continue;
    }
    const fenceLen = openMatch[1].length;
    const fenceLang = openMatch[2].trim();
    const closePattern = new RegExp('^`{' + fenceLen + ',}\\s*$');
    let closeIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (closePattern.test(lines[j])) {
        closeIdx = j;
        break;
      }
    }
    if (closeIdx === -1) {
      i++;
      continue;
    }
    const matchesLanguage = language ? fenceLang === language : fenceLen === 3;
    if (matchesLanguage) {
      return lines.slice(i + 1, closeIdx).join('\n');
    }
    i = closeIdx + 1;
  }
  throw new Error('Fenced block not found');
}

export function extractFirstPreBlock(section: string): string {
  const match = section.match(/^<pre>\r?\n([\s\S]*?)\r?\n<\/pre>\s*$/m);
  if (!match) {
    throw new Error('<pre> block not found');
  }
  return match[1];
}

export function extractReadmePreviewSources(markdown: string): {
  plantuml: string;
  mermaid: string;
  checkbox: string;
  container: string;
  math: string;
} {
  return {
    plantuml: extractFirstFencedBlock(extractReadmeSection(markdown, '#### PlantUML')),
    mermaid: extractFirstFencedBlock(extractReadmeSection(markdown, '#### Mermaid'), 'mermaid'),
    checkbox: extractFirstFencedBlock(extractReadmeSection(markdown, '#### Checkbox')),
    container: extractFirstFencedBlock(extractReadmeSection(markdown, '#### Container')),
    math: extractFirstPreBlock(extractReadmeSection(markdown, '#### Math')),
  };
}

export function buildPlantumlImageUrl(plantumlSource: string, serverBaseUrl: string): string {
  const md = new MarkdownIt();
  md.use(markdownItPlantuml, {
    openMarker: '@startuml',
    closeMarker: '@enduml',
    server: serverBaseUrl,
  });

  const rendered = md.render(plantumlSource);
  const match = rendered.match(/<img\b[^>]*\bsrc="([^"]+)"/i);

  if (!match) {
    throw new Error('PlantUML image URL not found');
  }

  return match[1];
}

export function buildMermaidRenderHtml(mermaidSource: string, mermaidScriptUrl: string): string {
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head><meta charset="utf-8"></head>',
    '<body>',
    '<div class="mermaid">' + mermaidSource + '</div>',
    '<script src="' + mermaidScriptUrl + '"></script>',
    '<script>mermaid.initialize({ startOnLoad: true });</script>',
    '</body>',
    '</html>',
  ].join('');
}

export function resolveReadmePreviewExportPath(
  filename: string,
  resourceFsPath: string,
  outputDirectory: string | undefined | null,
  outputDirectoryRelativePathFile: boolean | undefined,
  workspaceFsPath: string | undefined
): string {
  const resolved = resolveOutputDir(
    filename,
    outputDirectory,
    outputDirectoryRelativePathFile,
    resourceFsPath,
    workspaceFsPath
  );

  if (resolved === null) {
    throw new Error('Resolved output directory does not exist');
  }

  return resolved;
}
