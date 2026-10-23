declare module 'markdown-it-plantuml' {
  import MarkdownIt from 'markdown-it';

  interface PlantumlOptions {
    openMarker?: string;
    closeMarker?: string;
    server?: string;
    generateSource?: (umlCode: string, pluginOptions: { imageFormat?: string; diagramName?: string }) => string;
  }

  const markdownItPlantuml: MarkdownIt.PluginWithOptions<PlantumlOptions>;
  export default markdownItPlantuml;
}
