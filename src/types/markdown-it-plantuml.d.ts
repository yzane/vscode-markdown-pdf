declare module 'markdown-it-plantuml' {
  import MarkdownIt from 'markdown-it';

  interface PlantumlOptions {
    openMarker?: string;
    closeMarker?: string;
    server?: string;
  }

  const markdownItPlantuml: MarkdownIt.PluginWithOptions<PlantumlOptions>;
  export default markdownItPlantuml;
}
