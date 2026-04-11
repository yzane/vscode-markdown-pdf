import { describe, it } from 'node:test';
import assert from 'assert';
import {
  buildMermaidRenderHtml,
  buildPlantumlImageUrl,
  extractFirstFencedBlock,
  extractReadmeDiagramSources,
  extractReadmeSection,
} from '../../src/readme-diagrams';

describe('readme-diagrams', function () {
  const README_SNIPPET = [
    '## Intro',
    '',
    '### markdown-it-plantuml',
    '',
    'INPUT',
    '```',
    '@startuml',
    'Alice -> Bob: hello',
    '@enduml',
    '```',
    '',
    '### mermaid',
    '',
    'INPUT',
    '```mermaid',
    'graph TD',
    '  A-->B',
    '```',
    '',
    '### next',
    'done',
  ].join('\n');

  it('extractReadmeSection should return heading body until next heading', function () {
    const section = extractReadmeSection(README_SNIPPET, '### markdown-it-plantuml');
    assert.ok(section.includes('@startuml'));
    assert.ok(!section.includes('### mermaid'));
  });

  it('extractFirstFencedBlock should return first fenced block content', function () {
    const section = extractReadmeSection(README_SNIPPET, '### markdown-it-plantuml');
    assert.strictEqual(
      extractFirstFencedBlock(section),
      '@startuml\nAlice -> Bob: hello\n@enduml'
    );
  });

  it('extractFirstFencedBlock should filter by language when specified', function () {
    const section = extractReadmeSection(README_SNIPPET, '### mermaid');
    assert.strictEqual(extractFirstFencedBlock(section, 'mermaid'), 'graph TD\n  A-->B');
  });

  it('extractReadmeDiagramSources should return plantuml and mermaid blocks', function () {
    assert.deepStrictEqual(extractReadmeDiagramSources(README_SNIPPET), {
      plantuml: '@startuml\nAlice -> Bob: hello\n@enduml',
      mermaid: 'graph TD\n  A-->B',
    });
  });

  it('buildPlantumlImageUrl should return plantuml server png url', function () {
    const url = buildPlantumlImageUrl(
      '@startuml\nAlice -> Bob: hello\n@enduml',
      'http://www.plantuml.com/plantuml'
    );
    assert.match(url, /^http:\/\/www\.plantuml\.com\/plantuml\/svg\//);
  });

  it('buildMermaidRenderHtml should embed mermaid source and script url', function () {
    const html = buildMermaidRenderHtml(
      'graph TD\n  A-->B',
      'https://unpkg.com/mermaid/dist/mermaid.min.js'
    );
    assert.ok(html.includes('<script src="https://unpkg.com/mermaid/dist/mermaid.min.js"></script>'));
    assert.ok(html.includes('<div class="mermaid">graph TD\n  A-->B</div>'));
    assert.ok(html.includes('mermaid.initialize({ startOnLoad: true })'));
  });
});
