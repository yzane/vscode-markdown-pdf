import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

const CHECKBOX_PATTERN = /\[(X|\s|_|-)\]\s(.*)/i;

function checkboxReplace(md: MarkdownIt): (state: { tokens: Token[]; Token: typeof Token }) => void {
  const arrayReplaceAt = md.utils.arrayReplaceAt;
  let lastId = 0;

  function createTokens(
    checked: boolean,
    label: string,
    TokenConstructor: typeof Token,
  ): Token[] {
    const nodes: Token[] = [];
    const id = 'checkbox' + lastId;
    lastId++;

    const inputToken = new TokenConstructor('checkbox_input', 'input', 0);
    inputToken.attrs = [['type', 'checkbox'], ['id', id]];
    if (checked) {
      inputToken.attrs.push(['checked', 'true']);
    }
    nodes.push(inputToken);

    const labelOpen = new TokenConstructor('label_open', 'label', 1);
    labelOpen.attrs = [['for', id]];
    nodes.push(labelOpen);

    const text = new TokenConstructor('text', '', 0);
    text.content = label;
    nodes.push(text);

    nodes.push(new TokenConstructor('label_close', 'label', -1));

    return nodes;
  }

  function splitTextToken(original: Token, TokenConstructor: typeof Token): Token | Token[] {
    const text = original.content;
    const matches = text.match(CHECKBOX_PATTERN);
    if (matches === null) {
      return original;
    }

    const value = matches[1];
    const label = matches[2];
    const checked = value === 'X' || value === 'x';

    return createTokens(checked, label, TokenConstructor);
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

      for (let i = 0; i < tokens.length; i++) {
        const result = splitTextToken(tokens[i], state.Token);
        if (Array.isArray(result)) {
          tokens = arrayReplaceAt(tokens, i, result);
          blockTokens[j].children = tokens;
          i += result.length - 1;
        }
      }
    }
  };
}

export function markdownItCheckbox(md: MarkdownIt): void {
  md.core.ruler.push('checkbox', checkboxReplace(md));
}
