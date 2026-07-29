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

  // Fence regions are discovered above in a single left-to-right pass, so they
  // are already sorted by start position at this point.
  const fenceRegions = regions.slice();

  // fenceRegions is sorted by start and non-overlapping because Pass 1 scans
  // left to right. A monotonic cursor cannot be used here because outer `pos`
  // can resume behind positions already visited by inner `searchPos`.
  function fenceRegionAt(index: number): CodeRegion | undefined {
    let low = 0;
    let high = fenceRegions.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const region = fenceRegions[mid];
      if (index < region.start) {
        high = mid - 1;
      } else if (index >= region.end) {
        low = mid + 1;
      } else {
        return region;
      }
    }
    return undefined;
  }

  function nextFenceStartFrom(from: number): number {
    let low = 0;
    let high = fenceRegions.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (fenceRegions[mid].start < from) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low < fenceRegions.length ? fenceRegions[low].start : src.length;
  }

  // A blank line (a `\n`, only whitespace, then another `\n`) always ends a
  // paragraph in Markdown, and an inline code span cannot cross that boundary
  // — same as it cannot cross into a fenced code block. `nextParagraphBreak`
  // finds the earliest such boundary at or after `from`.
  const blankLineRe = /\r?\n[ \t]*\r?\n/g;
  function nextParagraphBreak(from: number): number {
    blankLineRe.lastIndex = from;
    const m = blankLineRe.exec(src);
    return m ? m.index : src.length;
  }

  // Pass 2: find inline code spans outside fenced blocks, following the same
  // "backtick string" rule CommonMark/markdown-it use: a run of N backticks
  // opens a code span, which is closed by the *next* run of exactly N
  // backticks *within the same paragraph*. Runs of a different length
  // encountered while searching for the closer are just content — they are
  // never reinterpreted as a fresh opener mid-search. Crucially, hitting a
  // fenced block or a blank line while searching ends the search as "no
  // closer found" rather than skipping past it: a fence or a blank line is a
  // block-level boundary a code span can never cross, so treating them as
  // something to leapfrog over is what previously let an opener latch onto
  // an unrelated, much later backtick and swallow everything — fenced blocks
  // included — into one bogus region.
  let pos = 0;
  while (pos < src.length) {
    const fenceHere = fenceRegionAt(pos);
    if (fenceHere) {
      pos = fenceHere.end;
      continue;
    }

    const tickIdx = src.indexOf('`', pos);
    if (tickIdx === -1) break;

    const fenceAtTick = fenceRegionAt(tickIdx);
    if (fenceAtTick) {
      pos = fenceAtTick.end;
      continue;
    }

    pos = tickIdx;
    let openEnd = tickIdx;
    while (openEnd < src.length && src[openEnd] === '`') openEnd++;
    const openLen = openEnd - pos;
    // Inline code spans cross neither a paragraph break nor a fenced block.
    const searchLimit = Math.min(nextParagraphBreak(openEnd), nextFenceStartFrom(openEnd));

    let searchPos = openEnd;
    let closeStart = -1;
    while (searchPos < searchLimit) {
      const candidate = src.indexOf('`', searchPos);
      if (candidate === -1 || candidate >= searchLimit) break;

      let candEnd = candidate;
      while (candEnd < src.length && src[candEnd] === '`') candEnd++;
      if (candEnd - candidate === openLen) {
        closeStart = candidate;
        break;
      }
      // Different-length run: not our closer. Per CommonMark this run is
      // ordinary content for the span we're still looking to close, so skip
      // past it and keep searching — do not treat it as a new opener here.
      searchPos = candEnd;
    }

    if (closeStart === -1) {
      // No closer within this paragraph: this backtick run is literal text,
      // not a delimiter. Resume scanning right after it so any later,
      // genuinely-paired span is still found on its own.
      pos = openEnd;
    } else {
      const end = closeStart + openLen;
      regions.push({ start: pos, end });
      pos = end;
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
