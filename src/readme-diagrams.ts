import MarkdownIt from 'markdown-it';
import markdownItPlantuml from 'markdown-it-plantuml';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractReadmeSection(markdown: string, heading: string): string {
  const headingMatch = heading.match(/^(#+)\s+/);
  if (!headingMatch) {
    throw new Error('Invalid heading: ' + heading);
  }

  const headingLevel = headingMatch[1].length;
  const escapedHeading = escapeRegExp(heading);
  const sectionPattern = new RegExp(
    '^' + escapedHeading + '\\r?\\n([\\s\\S]*?)(?=^#{1,' + headingLevel + '}\\s|\\Z)',
    'm'
  );
  const match = markdown.match(sectionPattern);

  if (!match) {
    throw new Error('Section not found: ' + heading);
  }

  return match[1].trim();
}

export function extractFirstFencedBlock(section: string, language?: string): string {
  const blockPattern = language
    ? new RegExp('^```' + escapeRegExp(language) + '[^\\r\\n]*\\r?\\n([\\s\\S]*?)\\r?\\n```', 'm')
    : /^```[^\r\n]*\r?\n([\s\S]*?)\r?\n```/m;
  const match = section.match(blockPattern);

  if (!match) {
    throw new Error('Fenced block not found');
  }

  return match[1];
}

export function extractReadmeDiagramSources(markdown: string): { plantuml: string; mermaid: string } {
  return {
    plantuml: extractFirstFencedBlock(extractReadmeSection(markdown, '### markdown-it-plantuml')),
    mermaid: extractFirstFencedBlock(extractReadmeSection(markdown, '### mermaid'), 'mermaid'),
  };
}

export function buildPlantumlImageUrl(plantumlSource: string, serverBaseUrl: string): string {
  const md = new MarkdownIt();
  md.use(markdownItPlantuml, {
    openMarker: '@startuml',
    closeMarker: '@enduml',
    server: serverBaseUrl,
  });

  const rendered = md.render(plantumlSource);
  const match = rendered.match(/<img\b[^>]*\bsrc="([^"]+)"/i);

  if (!match) {
    throw new Error('PlantUML image URL not found');
  }

  return match[1];
}

export function buildMermaidRenderHtml(mermaidSource: string, mermaidScriptUrl: string): string {
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head><meta charset="utf-8"></head>',
    '<body>',
    '<div class="mermaid">' + mermaidSource + '</div>',
    '<script src="' + mermaidScriptUrl + '"></script>',
    '<script>mermaid.initialize({ startOnLoad: true });</script>',
    '</body>',
    '</html>',
  ].join('');
}
