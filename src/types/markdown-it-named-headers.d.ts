declare module 'markdown-it-named-headers' {
  import MarkdownIt from 'markdown-it';

  interface NamedHeadersOptions {
    slugify?: (str: string) => string;
  }

  const markdownItNamedHeaders: MarkdownIt.PluginWithOptions<NamedHeadersOptions>;
  export default markdownItNamedHeaders;
}
