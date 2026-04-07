declare module 'markdown-it-emoji' {
  import MarkdownIt from 'markdown-it';

  interface EmojiOptions {
    defs?: Record<string, string>;
  }

  const full: MarkdownIt.PluginWithOptions<EmojiOptions>;
  export { full };
}
