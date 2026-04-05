declare module 'markdown-it-container' {
  import MarkdownIt from 'markdown-it';
  import Token from 'markdown-it/lib/token.mjs';

  interface ContainerOptions {
    validate?: (name: string) => boolean | number;
    render?: (tokens: Token[], idx: number) => string;
  }

  const markdownItContainer: (md: MarkdownIt, name: string, options: ContainerOptions) => void;
  export default markdownItContainer;
}
