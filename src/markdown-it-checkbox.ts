import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

const CHECKBOX_PATTERN = /^\[(X|\s|_|-)\]\s?/i;

function cloneToken(token: Token, TokenConstructor: typeof Token): Token {
  const cloned = new TokenConstructor(token.type, token.tag, token.nesting);
  cloned.attrs = token.attrs ? token.attrs.map(attr => [...attr]) : null;
  cloned.map = token.map ? [...token.map] as [number, number] : null;
  cloned.level = token.level;
  cloned.children = token.children ? token.children.map(child => cloneToken(child, TokenConstructor)) : null;
  cloned.content = token.content;
  cloned.markup = token.markup;
  cloned.info = token.info;
  cloned.meta = token.meta;
  cloned.block = token.block;
  cloned.hidden = token.hidden;
  return cloned;
}

function replaceTokenRange(tokens: Token[], start: number, end: number, replacement: Token[]): Token[] {
  return [
    ...tokens.slice(0, start),
    ...replacement,
    ...tokens.slice(end),
  ];
}

function checkboxReplace(
  idState: { value: number },
): (state: { tokens: Token[]; Token: typeof Token }) => void {

  function createTokens(
    checked: boolean,
    labelTokens: Token[],
    TokenConstructor: typeof Token,
  ): Token[] {
    const nodes: Token[] = [];
    const id = 'checkbox' + idState.value;
    idState.value++;

    const inputToken = new TokenConstructor('checkbox_input', 'input', 0);
    inputToken.attrs = [['type', 'checkbox'], ['id', id]];
    if (checked) {
      inputToken.attrs.push(['checked', 'true']);
    }
    nodes.push(inputToken);

    const labelOpen = new TokenConstructor('label_open', 'label', 1);
    labelOpen.attrs = [['for', id]];
    nodes.push(labelOpen);
    nodes.push(...labelTokens);

    nodes.push(new TokenConstructor('label_close', 'label', -1));

    return nodes;
  }

  function splitLineTokens(lineTokens: Token[], TokenConstructor: typeof Token): Token[] | null {
    const firstToken = lineTokens[0];
    if (!firstToken || firstToken.type !== 'text') {
      return null;
    }

    const matches = firstToken.content.match(CHECKBOX_PATTERN);
    if (matches === null) {
      return null;
    }

    const labelTokens: Token[] = [];
    const value = matches[1];
    const checked = value === 'X' || value === 'x';

    const remainingText = firstToken.content.slice(matches[0].length);
    if (remainingText.length > 0) {
      const textToken = cloneToken(firstToken, TokenConstructor);
      textToken.content = remainingText;
      labelTokens.push(textToken);
    }

    for (let i = 1; i < lineTokens.length; i++) {
      labelTokens.push(cloneToken(lineTokens[i], TokenConstructor));
    }

    return createTokens(checked, labelTokens, TokenConstructor);
  }

  return function (state) {
    const blockTokens = state.tokens;
    for (let j = 0; j < blockTokens.length; j++) {
      if (blockTokens[j].type !== 'inline') {
        continue;
      }
      let tokens = blockTokens[j].children;
      if (!tokens) {
        continue;
      }

      let lineStart = 0;
      for (let i = 0; i <= tokens.length; i++) {
        const isBoundary = i === tokens.length || tokens[i].type === 'softbreak' || tokens[i].type === 'hardbreak';
        if (!isBoundary) {
          continue;
        }

        const replacement = splitLineTokens(tokens.slice(lineStart, i), state.Token);
        if (replacement) {
          tokens = replaceTokenRange(tokens, lineStart, i, replacement);
          blockTokens[j].children = tokens;
          i = lineStart + replacement.length;
        }
        lineStart = i + 1;
      }
    }
  };
}

export function markdownItCheckbox(md: MarkdownIt): void {
  const idState = { value: 0 };

  md.core.ruler.push('checkbox_reset', () => {
    idState.value = 0;
  });
  md.core.ruler.push('checkbox', checkboxReplace(idState));
}
