import { describe, it } from 'node:test';
import assert from 'assert';
import {
  buildMermaidRenderHtml,
  buildPlantumlImageUrl,
  extractFirstFencedBlock,
  extractReadmePreviewSources,
  extractReadmeSection,
  resolveReadmePreviewExportPath,
} from '../../src/readme-previews';

describe('readme-previews', function () {
  const README_SNIPPET = [
    '## Intro',
    '',
    '### PlantUML',
    '',
    'INPUT',
    '```',
    '@startuml',
    'Alice -> Bob: hello',
    '@enduml',
    '```',
    '',
    '### Mermaid',
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
    const section = extractReadmeSection(README_SNIPPET, '### PlantUML');
    assert.ok(section.includes('@startuml'));
    assert.ok(!section.includes('### Mermaid'));
  });

  it('extractFirstFencedBlock should return first fenced block content', function () {
    const section = extractReadmeSection(README_SNIPPET, '### PlantUML');
    assert.strictEqual(
      extractFirstFencedBlock(section),
      '@startuml\nAlice -> Bob: hello\n@enduml'
    );
  });

  it('extractFirstFencedBlock should filter by language when specified', function () {
    const section = extractReadmeSection(README_SNIPPET, '### Mermaid');
    assert.strictEqual(extractFirstFencedBlock(section, 'mermaid'), 'graph TD\n  A-->B');
  });

  it('extractReadmePreviewSources should return plantuml and mermaid blocks', function () {
    assert.deepStrictEqual(extractReadmePreviewSources(README_SNIPPET), {
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

  it('resolveReadmePreviewExportPath should use workspace-relative output when workspace exists', function () {
    assert.strictEqual(
      resolveReadmePreviewExportPath(
        '/tmp/PlantUML.png',
        '/tmp/PlantUML.md',
        'sample',
        false,
        '/workspace'
      ),
      '/workspace/sample/PlantUML.png'
    );
  });

  it('resolveReadmePreviewExportPath should fall back to file-relative output without a workspace', function () {
    assert.strictEqual(
      resolveReadmePreviewExportPath(
        '/tmp/PlantUML.png',
        '/tmp/PlantUML.md',
        'sample',
        false,
        undefined
      ),
      '/tmp/sample/PlantUML.png'
    );
  });

  it('resolveReadmePreviewExportPath should keep adjacent output when outputDirectory is empty', function () {
    assert.strictEqual(
      resolveReadmePreviewExportPath(
        '/tmp/PlantUML.png',
        '/tmp/PlantUML.md',
        '',
        false,
        undefined
      ),
      '/tmp/PlantUML.png'
    );
  });
});
