# README 図更新コマンド 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `README.md` から PlantUML / Mermaid の図ブロックを抽出し、`images/PlantUML.png` と `images/mermaid.png` を手動コマンドで再生成できるようにする。

**Architecture:** 純粋関数に切り出せる部分 (README からの抽出、PlantUML URL 生成、Mermaid 描画用 HTML 生成) は `src/readme-diagrams.ts` に集約し、ユニットテストで先に固める。実行系は `scripts/update-readme-diagrams.ts` から既存の `chromium-resolver` と `puppeteer-core` を利用して PNG を生成し、`package.json` の script から呼び出す。

**Tech Stack:** TypeScript, tsx, Node.js built-ins, markdown-it, markdown-it-plantuml, puppeteer-core

**Reference:** 設計書 `docs/superpowers/specs/20260411-02-readme-diagram-refresh-design.md`

**Working branch:** `feature/readme-diagram-refresh`

---

## 事前確認

- [ ] **Step 0: 作業ブランチ確認**

  Run: `git branch --show-current`
  Expected: `feature/readme-diagram-refresh`

  もし異なる場合は `git checkout feature/readme-diagram-refresh` で切り替える。

---

## Task 1: README 図抽出ロジックを純粋関数として追加し、ユニットテストで固定する

**Files:**
- Create: `src/readme-diagrams.ts`
- Create: `test/unit/readme-diagrams.test.ts`

### 実装方針

- `src/readme-diagrams.ts` に以下の純粋関数を追加する
  - `extractReadmeSection(markdown: string, heading: string): string`
  - `extractFirstFencedBlock(section: string, language?: string): string`
  - `extractReadmeDiagramSources(markdown: string): { plantuml: string; mermaid: string }`
  - `buildPlantumlImageUrl(plantumlSource: string, serverBaseUrl: string): string`
  - `buildMermaidRenderHtml(mermaidSource: string, mermaidScriptUrl: string): string`
- PlantUML URL 生成は既存依存の `markdown-it` + `markdown-it-plantuml` を使い、生成された `<img src="...">` から URL を取り出す
- Mermaid HTML 生成は、`<div class="mermaid">...</div>` と `mermaid.initialize({ startOnLoad: true })` を含む最小 HTML を返す

- [ ] **Step 1-1: 失敗するユニットテストを追加**

  Create `test/unit/readme-diagrams.test.ts`:

  ```ts
  import assert from 'assert';
  import {
    buildMermaidRenderHtml,
    buildPlantumlImageUrl,
    extractFirstFencedBlock,
    extractReadmeDiagramSources,
    extractReadmeSection
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
      'done'
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
        mermaid: 'graph TD\n  A-->B'
      });
    });

    it('buildPlantumlImageUrl should return plantuml server png url', function () {
      const url = buildPlantumlImageUrl('@startuml\nAlice -> Bob: hello\n@enduml', 'http://www.plantuml.com/plantuml');
      assert.match(url, /^http:\/\/www\.plantuml\.com\/plantuml\/svg\//);
    });

    it('buildMermaidRenderHtml should embed mermaid source and script url', function () {
      const html = buildMermaidRenderHtml('graph TD\n  A-->B', 'https://unpkg.com/mermaid/dist/mermaid.min.js');
      assert.ok(html.includes('<script src="https://unpkg.com/mermaid/dist/mermaid.min.js"></script>'));
      assert.ok(html.includes('<div class="mermaid">graph TD\n  A-->B</div>'));
    });
  });
  ```

- [ ] **Step 1-2: テストを実行して失敗を確認**

  Run: `npm run test:unit -- test/unit/readme-diagrams.test.ts`
  Expected: `Cannot find module '../../src/readme-diagrams'` などで FAIL

- [ ] **Step 1-3: 最小実装を追加**

  Create `src/readme-diagrams.ts`:

  ```ts
  import MarkdownIt from 'markdown-it';
  import markdownItPlantuml from 'markdown-it-plantuml';

  export function extractReadmeSection(markdown: string, heading: string): string {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('^' + escapedHeading + '\\n([\\s\\S]*?)(?=^### |^## |\\Z)', 'm');
    const match = markdown.match(pattern);
    if (!match) {
      throw new Error('Section not found: ' + heading);
    }

    return match[1].trim();
  }

  export function extractFirstFencedBlock(section: string, language?: string): string {
    const fence = language ? '```' + language : '```';
    const pattern = language
      ? new RegExp('^```' + language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n([\\s\\S]*?)\\n```', 'm')
      : /^```[^\n]*\n([\s\S]*?)\n```/m;
    const match = section.match(pattern);
    if (!match) {
      throw new Error('Fenced block not found');
    }

    return match[1];
  }

  export function extractReadmeDiagramSources(markdown: string): { plantuml: string; mermaid: string } {
    return {
      plantuml: extractFirstFencedBlock(extractReadmeSection(markdown, '### markdown-it-plantuml')),
      mermaid: extractFirstFencedBlock(extractReadmeSection(markdown, '### mermaid'), 'mermaid')
    };
  }

  export function buildPlantumlImageUrl(plantumlSource: string, serverBaseUrl: string): string {
    const md = new MarkdownIt();
    md.use(markdownItPlantuml, {
      server: serverBaseUrl,
      openMarker: '@startuml',
      closeMarker: '@enduml'
    });
    const rendered = md.render(plantumlSource);
    const match = rendered.match(/<img src="([^"]+)"/);
    if (!match) {
      throw new Error('PlantUML image URL not found');
    }

    return match[1];
  }

  export function buildMermaidRenderHtml(mermaidSource: string, mermaidScriptUrl: string): string {
    return [
      '<!DOCTYPE html>',
      '<html>',
      '<head><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#fff;} .mermaid{display:inline-block;}</style></head>',
      '<body>',
      '<div class="mermaid">' + mermaidSource + '</div>',
      '<script src="' + mermaidScriptUrl + '"></script>',
      '<script>mermaid.initialize({ startOnLoad: true });</script>',
      '</body>',
      '</html>'
    ].join('');
  }
  ```

- [ ] **Step 1-4: ユニットテストを実行して通す**

  Run: `npm run test:unit -- test/unit/readme-diagrams.test.ts`
  Expected: `6 tests` が PASS

- [ ] **Step 1-5: コミット**

  ```bash
  git add src/readme-diagrams.ts test/unit/readme-diagrams.test.ts
  git commit -m "test: add README diagram helper coverage"
  ```

---

## Task 2: README 図更新コマンドを追加する

**Files:**
- Create: `scripts/update-readme-diagrams.ts`
- Modify: `package.json`
- Modify: `README.md` (必要ならコマンド追記。追記しない場合は変更しない)
- Modify: `README.ja.md` (必要ならコマンド追記。追記しない場合は変更しない)

### 実装方針

- `scripts/update-readme-diagrams.ts` は `README.md` から図ソースを抽出し、2 画像を順に更新する
- PlantUML は `fetch()` で PNG を取得する
- Mermaid は既存の `resolveChromiumPath()` と `puppeteer-core` を使って PNG を生成する
- ブラウザ cache dir は script 専用に `path.resolve(process.cwd(), '.tmp', 'readme-diagrams', 'chromium')` を使う
- CLI は成功時に更新ファイル名を表示し、失敗時に非 0 終了する

- [ ] **Step 2-1: script 実行コマンドのテストを先に追加**

  Modify `package.json` `scripts`:

  ```json
  {
    "update-readme-diagrams": "tsx scripts/update-readme-diagrams.ts"
  }
  ```

  Run: `npm run update-readme-diagrams`
  Expected: `scripts/update-readme-diagrams.ts` が存在しないため FAIL

- [ ] **Step 2-2: 更新 script を追加**

  Create `scripts/update-readme-diagrams.ts`:

  ```ts
  import fs from 'fs';
  import os from 'os';
  import path from 'path';
  import { pathToFileURL } from 'url';
  import puppeteer from 'puppeteer-core';
  import { resolveChromiumPath } from '../src/chromium-resolver';
  import {
    buildMermaidRenderHtml,
    buildPlantumlImageUrl,
    extractReadmeDiagramSources
  } from '../src/readme-diagrams';

  const ROOT = process.cwd();
  const README = path.resolve(ROOT, 'README.md');
  const IMAGES = path.resolve(ROOT, 'images');
  const PLANTUML_PNG = path.resolve(IMAGES, 'PlantUML.png');
  const MERMAID_PNG = path.resolve(IMAGES, 'mermaid.png');
  const PLANTUML_SERVER = 'http://www.plantuml.com/plantuml';
  const MERMAID_SCRIPT = 'https://unpkg.com/mermaid/dist/mermaid.min.js';
  const CHROMIUM_CACHE = path.resolve(ROOT, '.tmp', 'readme-diagrams', 'chromium');

  async function updatePlantuml(plantumlSource: string): Promise<void> {
    const imageUrl = buildPlantumlImageUrl(plantumlSource, PLANTUML_SERVER).replace('/svg/', '/png/');
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch PlantUML image: ' + response.status + ' ' + response.statusText);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(PLANTUML_PNG, buffer);
  }

  async function updateMermaid(mermaidSource: string): Promise<void> {
    const executablePath = await resolveChromiumPath('', CHROMIUM_CACHE);
    if (!executablePath) {
      throw new Error('Chromium executable could not be resolved');
    }

    const html = buildMermaidRenderHtml(mermaidSource, MERMAID_SCRIPT);
    const tempHtml = path.join(os.tmpdir(), 'markdown-pdf-readme-mermaid.html');
    fs.writeFileSync(tempHtml, html);

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(tempHtml).href, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.mermaid svg', { timeout: 30000 });
      const element = await page.$('.mermaid');
      if (!element) {
        throw new Error('Mermaid container not found');
      }
      await element.screenshot({ path: MERMAID_PNG });
    } finally {
      await browser.close();
      fs.rmSync(tempHtml, { force: true });
    }
  }

  async function main(): Promise<void> {
    const readme = fs.readFileSync(README, 'utf-8');
    const { plantuml, mermaid } = extractReadmeDiagramSources(readme);

    await updatePlantuml(plantuml);
    console.log('Updated ' + path.relative(ROOT, PLANTUML_PNG));

    await updateMermaid(mermaid);
    console.log('Updated ' + path.relative(ROOT, MERMAID_PNG));
  }

  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[update-readme-diagrams] ' + message);
    process.exit(1);
  });
  ```

- [ ] **Step 2-3: ユニットテストを再実行して既存 helper を保護**

  Run: `npm run test:unit -- test/unit/readme-diagrams.test.ts`
  Expected: PASS

- [ ] **Step 2-4: 更新コマンドを実行して画像を再生成**

  Run: `npm run update-readme-diagrams`
  Expected:
  - `Updated images/PlantUML.png`
  - `Updated images/mermaid.png`

- [ ] **Step 2-5: 生成結果を確認**

  Run: `git status --short images/PlantUML.png images/mermaid.png package.json scripts/update-readme-diagrams.ts src/readme-diagrams.ts test/unit/readme-diagrams.test.ts`
  Expected: 追加・更新対象だけが表示される

  Run: `file images/PlantUML.png images/mermaid.png`
  Expected: 両方とも `PNG image data`

- [ ] **Step 2-6: コミット**

  ```bash
  git add package.json scripts/update-readme-diagrams.ts src/readme-diagrams.ts test/unit/readme-diagrams.test.ts images/PlantUML.png images/mermaid.png
  git commit -m "feat: add README diagram refresh command"
  ```

---

## 完了条件

- `npm run update-readme-diagrams` が追加されている
- `README.md` から PlantUML / Mermaid の図ソースを抽出するロジックが `src/readme-diagrams.ts` に存在する
- `test/unit/readme-diagrams.test.ts` が追加され、抽出ロジックと HTML/URL 生成を検証している
- `scripts/update-readme-diagrams.ts` が 2 つの画像を更新できる
- `images/PlantUML.png` と `images/mermaid.png` がコマンド実行結果で更新される
- `README.ja.md` は画像参照のみで、生成元には使わない
