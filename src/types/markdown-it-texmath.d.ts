declare module 'markdown-it-texmath' {
  import MarkdownIt from 'markdown-it';

  interface TexmathOptions {
    engine?: unknown;
    delimiters?: string;
    katexOptions?: Record<string, unknown>;
  }

  const markdownItTexmath: MarkdownIt.PluginWithOptions<TexmathOptions>;
  export default markdownItTexmath;
}
