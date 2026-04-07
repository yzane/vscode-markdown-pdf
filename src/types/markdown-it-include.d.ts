declare module 'markdown-it-include' {
  import MarkdownIt from 'markdown-it';

  interface IncludeOptions {
    root?: string;
    includeRe?: RegExp;
    bracesAreOptional?: boolean;
    throwError?: boolean;
  }

  const markdownItInclude: MarkdownIt.PluginWithOptions<IncludeOptions>;
  export default markdownItInclude;
}
