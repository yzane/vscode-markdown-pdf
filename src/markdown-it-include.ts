// markdown-it plugin: expands :[alt](path/to/file.md) include directives
// before rendering, while preserving content inside fenced and inline code
// regions.
import type MarkdownIt from 'markdown-it';
import fs from 'fs';
import path from 'path';

interface MarkdownItIncludeOptions {
  root: string;
  throwError?: boolean;
}

const INCLUDE_RE = /:\[.+?\]\(\s*(.+?\..+?)\s*\)/;

interface CodeRegion {
  start: number;
  end: number;
}

/**
 * Find all protected code regions (fenced code blocks and inline code) in the
 * source string.  Returns sorted, non-overlapping regions.
 */
function findCodeRegions(src: string): CodeRegion[] {
  const regions: CodeRegion[] = [];

  // Pass 1: find fenced code blocks (``` or ~~~ at line start)
  const fenceOpenRe = /^(`{3,}|~{3,})/gm;
  let openMatch: RegExpExecArray | null;
  while ((openMatch = fenceOpenRe.exec(src)) !== null) {
    const fenceChar = openMatch[1][0];
    const fenceLen = openMatch[1].length;
    const openEnd = openMatch.index + openMatch[0].length;

    // Find closing fence: same char, at least same length, at line start
    const closingRe = new RegExp(
      `^${fenceChar === '`' ? '`' : '~'}{${fenceLen},}\\s*$`,
      'gm',
    );
    // Start searching after the opening fence line
    const nextLine = src.indexOf('\n', openEnd);
    if (nextLine === -1) {
      // No newline after opening fence — rest of source is protected
      regions.push({ start: openMatch.index, end: src.length });
      break;
    }
    closingRe.lastIndex = nextLine + 1;
    const closeMatch = closingRe.exec(src);
    if (closeMatch) {
      const regionEnd = closeMatch.index + closeMatch[0].length;
      regions.push({ start: openMatch.index, end: regionEnd });
      // Advance the outer regex past this fenced block
      fenceOpenRe.lastIndex = regionEnd;
    } else {
      // No closing fence — rest of source is protected
      regions.push({ start: openMatch.index, end: src.length });
      break;
    }
  }

  // Pass 2: find inline code (backtick sequences) outside fenced blocks
  let pos = 0;
  while (pos < src.length) {
    const tickIdx = src.indexOf('`', pos);
    if (tickIdx === -1) break;

    // Skip if inside a fenced code block
    if (regions.some((r) => tickIdx >= r.start && tickIdx < r.end)) {
      pos = regions.find((r) => tickIdx >= r.start && tickIdx < r.end)!.end;
      continue;
    }

    // Count consecutive backticks
    let tickCount = 0;
    let tickEnd = tickIdx;
    while (tickEnd < src.length && src[tickEnd] === '`') {
      tickCount++;
      tickEnd++;
    }

    // If this is 3+ backticks at line start, it was already handled as fenced block
    if (tickCount >= 3 && (tickIdx === 0 || src[tickIdx - 1] === '\n')) {
      pos = tickEnd;
      continue;
    }

    // Find matching closing backtick sequence (exact count)
    const closingTicks = '`'.repeat(tickCount);
    let searchFrom = tickEnd;
    let closingIdx = -1;
    while (searchFrom < src.length) {
      const candidate = src.indexOf(closingTicks, searchFrom);
      if (candidate === -1) break;

      // Verify exact match: not followed by another backtick
      if (candidate + tickCount < src.length && src[candidate + tickCount] === '`') {
        searchFrom = candidate + 1;
        continue;
      }
      // Not preceded by a backtick (beyond our opening sequence)
      if (candidate > tickEnd && candidate > 0 && src[candidate - 1] === '`') {
        searchFrom = candidate + 1;
        continue;
      }

      // Skip if inside a fenced code block
      if (regions.some((r) => candidate >= r.start && candidate < r.end)) {
        searchFrom = regions.find((r) => candidate >= r.start && candidate < r.end)!.end;
        continue;
      }

      closingIdx = candidate;
      break;
    }

    if (closingIdx !== -1) {
      const end = closingIdx + tickCount;
      regions.push({ start: tickIdx, end });
      pos = end;
    } else {
      pos = tickEnd;
    }
  }

  // Sort by start position
  regions.sort((a, b) => a.start - b.start);
  return regions;
}

function replaceIncludes(
  src: string,
  rootDir: string,
  throwError: boolean,
  parentFilePath: string | null,
  filesProcessed: string[],
): string {
  const regions = findCodeRegions(src);

  // Process include directives only in text outside code regions
  let result = '';
  let pos = 0;

  for (const region of regions) {
    // Process the gap before this code region
    if (region.start > pos) {
      result += processIncludes(src.slice(pos, region.start), rootDir, throwError, parentFilePath, filesProcessed);
    }
    // Copy code region verbatim
    result += src.slice(region.start, region.end);
    pos = region.end;
  }

  // Process remaining text after the last code region
  if (pos < src.length) {
    result += processIncludes(src.slice(pos), rootDir, throwError, parentFilePath, filesProcessed);
  }

  return result;
}

function processIncludes(
  text: string,
  rootDir: string,
  throwError: boolean,
  parentFilePath: string | null,
  filesProcessed: string[],
): string {
  let cap: RegExpExecArray | null;

  while ((cap = INCLUDE_RE.exec(text))) {
    const includePath = cap[1].trim();
    const filePath = path.resolve(rootDir, includePath);
    let replacement: string;
    let errorMessage: string | undefined;

    if (!fs.existsSync(filePath)) {
      errorMessage = `File '${filePath}' not found.`;
    } else if (filesProcessed.includes(filePath)) {
      errorMessage = `Circular reference between '${filePath}' and '${parentFilePath}'.`;
    }

    if (errorMessage) {
      if (throwError) {
        throw new Error(errorMessage);
      }
      replacement = `\n\n# INCLUDE ERROR: ${errorMessage}\n\n`;
    } else {
      let content = fs.readFileSync(filePath, 'utf8');
      // Recursively process includes in the included file
      const newProcessed = [...filesProcessed];
      if (parentFilePath) {
        newProcessed.push(parentFilePath);
      }
      newProcessed.push(filePath);
      content = replaceIncludes(content, path.dirname(filePath), throwError, filePath, newProcessed);

      // Remove one trailing newline to avoid unintended paragraph breaks
      if (content.endsWith('\n')) {
        content = content.slice(0, -1);
      }
      replacement = content;
    }

    text = text.slice(0, cap.index) + replacement + text.slice(cap.index + cap[0].length);
  }

  return text;
}

/** Installs the include plugin that expands :[alt](path) directives at parse time. */
export function markdownItInclude(md: MarkdownIt, options: string | MarkdownItIncludeOptions): void {
  const opts: MarkdownItIncludeOptions =
    typeof options === 'string' ? { root: options } : options;
  const root = opts.root || '.';
  const throwError = opts.throwError ?? true;

  md.core.ruler.before('normalize', 'include', (state) => {
    state.src = replaceIncludes(state.src, root, throwError, null, []);
  });
}
