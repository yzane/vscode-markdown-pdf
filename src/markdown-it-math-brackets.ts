import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';

/**
 * Inline rule: matches \(...\) and \[...\] on a single line.
 * - \(...\)  -> math_inline with markup '\\(' (displayMode: false)
 * - \[...\]  -> math_inline with markup '\\[' (displayMode: true)
 * Skips when the opening backslash was itself escaped at the markdown level:
 * markdown-it's \\ escape handling runs before inline rules in this configuration,
 * so a literal "\\\\(" in source is consumed as "\\" + "(" before this rule fires.
 */
function inlineBracketMath(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x5c /* \\ */) {
    return false;
  }
  const next = src.charCodeAt(pos + 1);
  const isParen = next === 0x28; /* ( */
  const isBracket = next === 0x5b; /* [ */
  if (!isParen && !isBracket) {
    return false;
  }
  const closeSeq = isParen ? '\\)' : '\\]';
  const end = src.indexOf(closeSeq, pos + 2);
  if (end < 0) {
    return false;
  }
  const content = src.slice(pos + 2, end);
  if (content.indexOf('\n') >= 0) {
    return false;
  }
  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.content = content;
    token.markup = isParen ? '\\(' : '\\[';
  }
  state.pos = end + 2;
  return true;
}

/**
 * Block rule: matches a block that starts with \[ and continues until \]
 * (possibly across multiple lines). Emits math_block with markup '\\['.
 */
function blockBracketMath(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const startMax = state.eMarks[startLine];
  const firstLine = state.src.slice(startPos, startMax);
  if (!/^\\\[/.test(firstLine)) {
    return false;
  }
  if (silent) {
    return true;
  }
  let found = false;
  let nextLine = startLine;
  let lastLine = '';
  for (; nextLine < endLine; nextLine++) {
    const pos = state.bMarks[nextLine] + state.tShift[nextLine];
    const max = state.eMarks[nextLine];
    const line = state.src.slice(pos, max);
    const closeIdx = line.indexOf('\\]');
    if (closeIdx >= 0) {
      lastLine = line.slice(0, closeIdx);
      found = true;
      break;
    }
  }
  if (!found) {
    return false;
  }
  const rawFirst = state.src.slice(startPos, startMax).replace(/^\\\[/, '');
  const middleLines: string[] = [];
  for (let i = startLine + 1; i < nextLine; i++) {
    const p = state.bMarks[i] + state.tShift[i];
    const m = state.eMarks[i];
    middleLines.push(state.src.slice(p, m));
  }
  const content = [rawFirst, ...middleLines, lastLine].join('\n').trim();
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = content;
  token.markup = '\\[';
  token.map = [startLine, nextLine + 1];
  state.line = nextLine + 1;
  return true;
}

export function mathBracketsPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('escape', 'math_brackets_inline', inlineBracketMath);
  md.block.ruler.before('fence', 'math_brackets_block', blockBracketMath, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
}
