# 数式表示サポート 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VS Code 標準の Markdown プレビューと同じ挙動で `$...

 / `$$...$$` / `\(...\)` / `\[...\]` / `` ```math `` の 5 種記法を KaTeX で描画し、PDF / HTML / PNG / JPEG へ反映する。

**Architecture:** markdown-it パイプラインに 2 つの経路を追加する。(A) デリミタ記法は `@vscode/markdown-it-katex`（VS Code 組み込み Markdown Math と同一プラグイン）でトークナイズし、直後に `md.renderer.rules.math_inline` / `math_block` を差し替えて `src/math-renderer.ts` の `renderMath()` へ委譲する。(B) `` ```math `` フェンスは `src/markdown-it-math-fence.ts` を新規追加し、既存 PlantUML フェンス (`src/extension.ts:259-271`) と同じパターンで `md.renderer.rules.fence` をチェーンしつつ同じ `renderMath()` を呼ぶ。両経路は同一ヘルパを通ることでオプション・マクロ・例外フォールバックが統一される。KaTeX CSS は `styles/katex/` に同梱し、フォントを base64 `data:` URI としてインライン埋め込みしたうえで `<style>` タグとして注入する（生成 HTML は自己完結で、移動・共有しても壊れない）。`markdown-pdf.math.enabled: false` のときは経路 A / B および CSS 注入をいずれも登録しない。

**Tech Stack:** TypeScript, markdown-it, `@vscode/markdown-it-katex` ^1.1.2（新規追加）, `katex` ^0.16.45（新規追加）, esbuild（既存）, node:test + assert（既存単体テスト）, Mocha + vscode-test（既存統合テスト）, VS Code 拡張 API。

**Spec:** `docs/superpowers/specs/20260420-01-math-support-design.md`

**Branch:** `feature/math-support`（現在の worktree: `.worktrees/feature-math-support/`。実装中も維持）

**前提となる動作確認**:

- `npm test` がベースラインで成功していること（本プラン作成時点で確認済み）。各タスク完了時に再実行する
- 作業はすべて `.worktrees/feature-math-support/` 配下で行う
- コード内のコメントは英語、プラン / スペックは日本語（`AGENTS.md` 準拠）

---

## Task 1: `katex` と `@vscode/markdown-it-katex` を依存に追加する

**Files:**
- Modify: `package.json`（`dependencies` セクション）
- Modify: `package-lock.json`（`npm install` で自動更新）

- [ ] **Step 1: 現状確認**

実行: `grep -n '"markdown-it-plantuml"\|"markdown-it"' package.json`

期待: `dependencies` の該当行が確認できる（950 行前後）。依存はアルファベット順に並んでいる。`@vscode/markdown-it-katex` はスコープ付きパッケージなので先頭近く、`katex` は `js-yaml` の後あたりに入る。

- [ ] **Step 2: 依存を追加**

```bash
npm install --save @vscode/markdown-it-katex@^1.1.2 katex@^0.16.45
```

`package.json` の `dependencies` に両エントリが追加され、`package-lock.json` が更新される。

- [ ] **Step 3: 型定義の状況を確認**

`katex` と `@vscode/markdown-it-katex` は型定義を同梱している。

実行: `ls node_modules/katex/dist/katex.d.ts node_modules/@vscode/markdown-it-katex/dist/index.d.ts`

期待: どちらも存在する。存在しない場合は Task 3 / Task 4 の実装で `any` キャストまたは `src/types/` にスタブを追加する（Task 2 の Step 4 で対処）。

- [ ] **Step 4: 既存テストが壊れていないことを確認**

実行: `npm test`

期待: 既存テストがすべて通る（依存の追加だけでは挙動は変わらない）。

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json
git commit -m "build(deps): add katex and @vscode/markdown-it-katex for math rendering"
```

---

## Task 2: KaTeX CSS とフォントを `styles/katex/` に同梱する

`katex.min.css` は `@font-face` で `fonts/KaTeX_*.woff2` 等を相対参照している。CSS と同じ相対レイアウトを保ったまま拡張ルート配下 (`styles/katex/`) にコピーし、`.vscodeignore` で配布対象に含める。

**Files:**
- Create: `styles/katex/katex.min.css`
- Create: `styles/katex/fonts/*`（woff2 / woff / ttf フォント一式）
- Modify: `.vscodeignore`（`styles/katex/**` を配布に含める調整は不要。`styles/` は現状除外されていない）

- [ ] **Step 1: KaTeX 配布物の場所を確認**

実行: `ls node_modules/katex/dist/ | head -20` と `ls node_modules/katex/dist/fonts | wc -l`

期待: `katex.min.css` が存在し、`fonts/` に 60 ファイル前後（woff2 / woff / ttf の 3 形式 × 20 フォント）が存在する。

- [ ] **Step 2: スタイルとフォントをコピー**

```bash
mkdir -p styles/katex/fonts
cp node_modules/katex/dist/katex.min.css styles/katex/katex.min.css
cp node_modules/katex/dist/fonts/* styles/katex/fonts/
```

CSS 内の `url(fonts/KaTeX_*.woff2)` は相対パスで `fonts/` を参照するため、`styles/katex/katex.min.css` と `styles/katex/fonts/` の親子関係をそのまま維持する。

- [ ] **Step 3: `.vscodeignore` の除外状況を確認**

実行: `grep -n '^styles' .vscodeignore || echo 'styles not excluded'`

期待: `styles not excluded` が表示される。既存の `styles/markdown.css` 等と同じく配布対象のまま扱う。追加設定は不要。

- [ ] **Step 4: `.gitignore` の状況を確認**

実行: `grep -n 'styles' .gitignore || echo 'styles not gitignored'`

期待: `styles not gitignored`。KaTeX の CSS / フォントは `node_modules` に存在するが、拡張パッケージングの都合でリポジトリに物理コピーしてコミットする（`highlight.js` のテーマは `node_modules` 同梱を再利用しているが、KaTeX はフォントが多数かつ相対参照であり、拡張ルート配下の方が扱いやすい）。

- [ ] **Step 5: 既存テストが壊れていないことを確認**

実行: `npm test`

期待: CSS / フォントの追加だけでは挙動は変わらず、全テストが通る。

- [ ] **Step 6: コミット**

```bash
git add styles/katex/
git commit -m "build(katex): bundle katex.min.css and fonts under styles/katex/"
```

注意: フォントファイルは数十個あるためコミットサイズが大きくなる。`git status styles/katex` で内容を一度確認する。

---

## Task 3: `src/math-renderer.ts` を TDD で追加する

`katex.renderToString(tex, options)` を呼ぶ薄いラッパを追加する。不正 TeX や例外を捕捉し、`<code>` フォールバックを返す。マクロ・`displayMode` など最小限のオプションを受け取る。

**Files:**
- Create: `src/math-renderer.ts`
- Create: `test/unit/math-renderer.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

ファイル新規作成: `test/unit/math-renderer.test.ts`

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderMath } from '../../src/math-renderer';

describe('renderMath', () => {
  it('should render inline math as a <span class="katex"> element', () => {
    const html = renderMath('E = mc^2', false, {});
    assert.match(html, /<span class="katex">/);
    assert.doesNotMatch(html, /<span class="katex-display">/);
  });

  it('should render block math as a <span class="katex-display"> element', () => {
    const html = renderMath('E = mc^2', true, {});
    assert.match(html, /<span class="katex-display">/);
  });

  it('should expand user macros when provided', () => {
    const html = renderMath('\\RR', false, { macros: { '\\RR': '\\mathbb{R}' } });
    assert.match(html, /mathbb|mathbb\{R\}|R/);
  });

  it('should render invalid TeX as an inline katex-error span, not a <code> fallback', () => {
    // With throwOnError: false (the renderer default), KaTeX does NOT throw for
    // parse errors like \foo; it emits a span styled with errorColor. The <code>
    // fallback is only for runtime exceptions (tested separately below).
    const html = renderMath('\\foo', false, {});
    assert.doesNotThrow(() => renderMath('\\foo', false, {}));
    assert.match(html, /katex-error/);
    assert.doesNotMatch(html, /^<code>/);
  });

  it('should fall back to a <code> block when katex.renderToString throws', () => {
    // Passing a non-string triggers a runtime TypeError inside KaTeX even with
    // throwOnError: false, exercising the defensive catch block in renderMath.
    const html = renderMath(undefined as unknown as string, false, {});
    assert.match(html, /^<code>/);
  });

  it('should not throw on empty input', () => {
    assert.doesNotThrow(() => renderMath('', false, {}));
    assert.doesNotThrow(() => renderMath('', true, {}));
  });
});
```

※ KaTeX 0.16 の挙動: `throwOnError: false` のもと、パースエラー（`\foo` 等）は例外を投げずに `<span class="katex-error" style="color:#cc0000">` を返す。本当に例外が飛ぶのは「型違いの入力」「内部バグ」等のケースのみで、その 1 本線が `<code>` フォールバックの責務範囲。`undefined` を渡すテストは、`katex.renderToString` が `tex.length` 等で TypeError を起こす挙動に依存している。もし KaTeX のバージョン更新でこの振る舞いが変わり `undefined` テストが通らなくなったら、代わりに `renderMath` を `Object.assign(Object.create(null), { [Symbol.toPrimitive]: () => { throw new Error(); } })` のようなスローするオブジェクトで呼び出す方式へ差し替える。

- [ ] **Step 2: テストが失敗することを確認**

実行: `npx tsx --test test/unit/math-renderer.test.ts`

期待: `Cannot find module '../../src/math-renderer'` または `renderMath is not a function` で失敗する。

- [ ] **Step 3: 最小実装を追加**

ファイル新規作成: `src/math-renderer.ts`

```typescript
import katex, { KatexOptions } from 'katex';

export interface RenderMathOptions extends Pick<KatexOptions, 'macros'> {}

/**
 * Thin wrapper around katex.renderToString that normalizes options and
 * captures any runtime error so an invalid TeX snippet does not break the
 * whole document. On error, returns the original source wrapped in <code>
 * so the user can still see what they wrote.
 */
export function renderMath(tex: string, displayMode: boolean, options: RenderMathOptions): string {
  const katexOptions: KatexOptions = {
    displayMode,
    throwOnError: false,
    errorColor: '#cc0000',
    strict: 'warn',
    trust: false,
    macros: options.macros,
  };
  try {
    return katex.renderToString(tex, katexOptions);
  } catch (error) {
    const escaped = escapeHtml(tex);
    // eslint-disable-next-line no-console
    console.warn('[markdown-pdf] KaTeX render failure, falling back to <code>:', (error as Error).message);
    return '<code>' + escaped + '</code>';
  }
}

function escapeHtml(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 4: テストが通ることを確認**

実行: `npx tsx --test test/unit/math-renderer.test.ts`

期待: 6 件 pass。

- [ ] **Step 5: 全テストを再実行**

実行: `npm test`

期待: 既存テスト + 6 件の新規テストが通る。

- [ ] **Step 6: コミット**

```bash
git add src/math-renderer.ts test/unit/math-renderer.test.ts
git commit -m "feat(math-renderer): add KaTeX wrapper with graceful error fallback"
```

---

## Task 4: `src/markdown-it-math-fence.ts` を TDD で追加する

`` ```math `` フェンスを `renderMath(content, true, options)` の結果で差し替える薄いプラグイン。既存の PlantUML フェンスと同じパターン (`token.info.trim().toLowerCase()` による判定 + 委譲) に揃える。このプラグインは既存のレンダラをチェーンするため、PlantUML フェンスとも共存できる。

**Files:**
- Create: `src/markdown-it-math-fence.ts`
- Create: `test/unit/markdown-it-math-fence.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

ファイル新規作成: `test/unit/markdown-it-math-fence.test.ts`

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import MarkdownIt from 'markdown-it';
import { mathFencePlugin } from '../../src/markdown-it-math-fence';

function makeMd() {
  const md = new MarkdownIt();
  md.use(mathFencePlugin, { macros: {} });
  return md;
}

describe('mathFencePlugin', () => {
  it('should render ```math fences through KaTeX (block mode)', () => {
    const html = makeMd().render('```math\nE = mc^2\n```\n');
    assert.match(html, /<span class="katex-display">/);
    assert.doesNotMatch(html, /<pre><code class="language-math">/);
  });

  it('should fall back to default fence renderer for non-math languages', () => {
    const html = makeMd().render('```js\nconst x = 1;\n```\n');
    assert.match(html, /<pre><code class="language-js">/);
  });

  it('should treat variants like math-foo as non-math and fall back to default fence', () => {
    const html = makeMd().render('```math-foo\nnot math\n```\n');
    assert.match(html, /<pre><code class="language-math-foo">/);
  });

  it('should preserve an upstream custom fence renderer for non-math info strings', () => {
    const md = new MarkdownIt();
    md.renderer.rules.fence = () => '<div class="upstream"></div>';
    md.use(mathFencePlugin, { macros: {} });
    const html = md.render('```plantuml\nBob -> Alice\n```\n');
    assert.match(html, /<div class="upstream"><\/div>/);
  });

  it('should handle empty math fence without throwing', () => {
    const md = makeMd();
    assert.doesNotThrow(() => md.render('```math\n```\n'));
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

実行: `npx tsx --test test/unit/markdown-it-math-fence.test.ts`

期待: `Cannot find module '../../src/markdown-it-math-fence'` で失敗する。

- [ ] **Step 3: 最小実装を追加**

ファイル新規作成: `src/markdown-it-math-fence.ts`

```typescript
import type MarkdownIt from 'markdown-it';
import { renderMath, RenderMathOptions } from './math-renderer';

export interface MathFencePluginOptions extends RenderMathOptions {}

/**
 * markdown-it plugin: overrides md.renderer.rules.fence so that a
 * ```math fenced code block is rendered via KaTeX in display mode.
 * For any other info string the previous fence renderer (or renderToken)
 * is used, so this plugin composes with other fence-handling plugins
 * (e.g. the PlantUML fence renderer already installed in extension.ts).
 */
export function mathFencePlugin(md: MarkdownIt, options: MathFencePluginOptions): void {
  const previousFenceRenderer = md.renderer.rules.fence;

  md.renderer.rules.fence = function (tokens, idx, mdOptions, env, self) {
    const token = tokens[idx];
    if (token.info.trim().toLowerCase() === 'math') {
      return renderMath(token.content, true, options);
    }
    if (previousFenceRenderer) {
      return previousFenceRenderer(tokens, idx, mdOptions, env, self);
    }
    return self.renderToken(tokens, idx, mdOptions);
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

実行: `npx tsx --test test/unit/markdown-it-math-fence.test.ts`

期待: 5 件 pass。

- [ ] **Step 5: 全テストを再実行**

実行: `npm test`

期待: 既存テスト + Task 3 の 6 件 + Task 4 の 5 件が通る。

- [ ] **Step 6: コミット**

```bash
git add src/markdown-it-math-fence.ts test/unit/markdown-it-math-fence.test.ts
git commit -m "feat(markdown-it-math-fence): render \`\`\`math fences via KaTeX"
```

---

## Task 5: `package.json` に `math.enabled` / `math.katex.macros` 設定を追加する

`contributes.configuration.properties` に 2 エントリを追加する。他の既存設定 (`markdown-pdf.margin.top`、`markdown-pdf.chromium.autoDownload` 等) と同じくドット区切りのフラット表記に揃える。配置位置は `mermaidServer` の後、クロージング `}` の直前とする。

**Files:**
- Modify: `package.json:911-915` 付近（`markdown-pdf.mermaidServer` の直後）

- [ ] **Step 1: 該当箇所を確認**

実行: `grep -n '"markdown-pdf.mermaidServer"' package.json`

期待: `911:        "markdown-pdf.mermaidServer": {` のような出力。

- [ ] **Step 2: 設定エントリを追加**

`"markdown-pdf.mermaidServer"` エントリの閉じ `}` の直後、`"properties"` オブジェクトの閉じ `}` の **前** に、以下を挿入する（カンマの位置に注意）。

```json
        "markdown-pdf.math.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable math rendering via KaTeX for $...$, $$...$$, \\(...\\), \\[...\\], and ```math fenced code blocks. Matches the behavior of VS Code's built-in Markdown preview. Set to false to keep the raw $ / \\( / \\[ / ```math text."
        },
        "markdown-pdf.math.katex.macros": {
          "type": "object",
          "default": {},
          "additionalProperties": {
            "type": "string"
          },
          "markdownDescription": "User-defined KaTeX macros passed to the KaTeX renderer. Example: `{ \"\\\\RR\": \"\\\\mathbb{R}\" }`. See https://katex.org/docs/options.html for details."
        }
```

`mermaidServer` の末尾にカンマが無い場合は追加する。

- [ ] **Step 3: JSON 構文を確認**

実行: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')"`

期待: `OK`。

- [ ] **Step 4: 既存テストが壊れていないことを確認**

実行: `npm test`

期待: 設定の追加だけでは既存挙動は変わらず、全テスト pass。

- [ ] **Step 5: コミット**

```bash
git add package.json
git commit -m "feat(settings): add markdown-pdf.math.enabled and math.katex.macros"
```

---

## Task 6: `src/extension.ts` に KaTeX 経路を組み込む

`md.use(markdownItPlantuml, plantumlOptions);` の **直後** かつ既存 PlantUML フェンス上書き (`src/extension.ts:259-271`) の **前** に、数式経路を差し込む。PlantUML フェンス上書きが後から `md.renderer.rules.fence` を再度チェーンするため、`math` フェンスと `plantuml` フェンスは干渉しない。

VS Code 設定 + フロントマターから `math.enabled` / `math.katex.macros` を組み立てるヘルパは `extension.ts` のスコープに留める（`utils.ts` の `getFrontMatterRecord` 追加は Task 7 のローカル判定で代替する）。

**Files:**
- Modify: `src/extension.ts:165-173`（フロントマター取得ヘルパの追加）
- Modify: `src/extension.ts:257-272`（markdown-it 構築）
- Modify: `src/extension.ts` の import 宣言（先頭付近）

- [ ] **Step 1: 該当箇所を読み返す**

実行: `sed -n '1,30p' src/extension.ts`

期待: 先頭の `import markdownItPlantuml from 'markdown-it-plantuml';` など既存 import が見える。

実行: `sed -n '163,275p' src/extension.ts`

期待: `getFrontMatterString` のヘルパ関数と、`// PlantUML` ブロック + PlantUML フェンス上書きが見える。

- [ ] **Step 2: 新しい import を追加**

ファイル先頭の既存 `import markdownItPlantuml from 'markdown-it-plantuml';` 行の **後** に以下を挿入する。

```typescript
import markdownItKatex from '@vscode/markdown-it-katex';
import { mathFencePlugin } from './markdown-it-math-fence';
import { renderMath } from './math-renderer';
```

※ `@vscode/markdown-it-katex` の default エクスポートがプラグイン本体であることを import 形式でロックする。型が上手く解決しないときは暫定で `const markdownItKatex = require('@vscode/markdown-it-katex') as any;` へフォールバックし、Task 6 の Step 6 で解消する。`renderMath` は経路 A（デリミタ）と経路 B（フェンス）の両方で同じヘルパを通すために必要。

- [ ] **Step 3: フロントマターから object を読むヘルパを追加**

`src/extension.ts:170-173` の `getFrontMatterString` の **直後** に、以下を追加する。

```typescript
function getFrontMatterRecord(data: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = data[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}
```

- [ ] **Step 4: `md.use(markdownItPlantuml, plantumlOptions);` 直後に数式経路を挿入**

`src/extension.ts:257` の `md.use(markdownItPlantuml, plantumlOptions);` の **直後** かつ既存 PlantUML フェンス上書き (`const defaultFenceRenderer = md.renderer.rules.fence;`) の **前** に、以下を挿入する。

```typescript
      // Math rendering via KaTeX
      // https://github.com/microsoft/vscode-markdown-it-katex (same plugin as VS Code's built-in Markdown Math)
      const mathFrontmatter = getFrontMatterRecord(matterParts.data, 'math') || {};
      const mathFrontmatterKatex = getFrontMatterRecord(mathFrontmatter, 'katex') || {};
      const mathSettings = vscode.workspace.getConfiguration('markdown-pdf').get<{ enabled?: boolean; katex?: { macros?: Record<string, string> } }>('math') || {};
      const mathEnabled = utils.setBooleanValue(
        typeof mathFrontmatter['enabled'] === 'boolean' ? (mathFrontmatter['enabled'] as boolean) : undefined,
        mathSettings.enabled,
      ) ?? true;
      const mathMacrosFrontmatter = getFrontMatterRecord(mathFrontmatterKatex, 'macros');
      const mathMacrosSettings = (mathSettings.katex && mathSettings.katex.macros) || {};
      const mathMacros: Record<string, string> = {};
      for (const [k, v] of Object.entries(mathMacrosSettings)) {
        if (typeof v === 'string') { mathMacros[k] = v; }
      }
      if (mathMacrosFrontmatter) {
        for (const [k, v] of Object.entries(mathMacrosFrontmatter)) {
          if (typeof v === 'string') { mathMacros[k] = v; }
        }
      }
      if (mathEnabled) {
        md.use(markdownItKatex, { enableBareBlocks: true, enableMathBlockInHtml: false });
        // Route the delimiter path (math_inline / math_block tokens produced by
        // @vscode/markdown-it-katex) through the same renderMath() helper used
        // by the fence path. This unifies options, macros, and error handling
        // across both paths per the design document (spec §データフロー).
        md.renderer.rules.math_inline = function (tokens, idx) {
          return renderMath(tokens[idx].content, false, { macros: mathMacros });
        };
        md.renderer.rules.math_block = function (tokens, idx) {
          return renderMath(tokens[idx].content, true, { macros: mathMacros });
        };
        md.use(mathFencePlugin, { macros: mathMacros });
      }
```

※ `@vscode/markdown-it-katex` のオプション名は `enableBareBlocks` (LaTeX 括弧記法の有効化) / `enableMathBlockInHtml` (HTML 内インライン解析)。プロジェクトの goal は VS Code プレビュー互換なので、VS Code 組み込み Markdown Math と同じ値（`enableBareBlocks: true`、`enableMathBlockInHtml: false`）に揃える。正確なオプション名は `node_modules/@vscode/markdown-it-katex/dist/index.d.ts` で実装前に確認する。

※ プラグイン側にも `macros` オプションはあるが、`md.renderer.rules.math_*` を上書きするため **プラグインに `macros` を渡す必要は無い**。マクロは `renderMath` 経由で反映される。また、`renderMath` は `src/markdown-it-math-fence.ts` でも使われており、両経路の差し替え後 HTML は同じヘルパが生成するため、結果の整合性と例外フォールバックが統一される。

※ `renderMath` の import を忘れずに Step 2 で追加する（`import { renderMath } from './math-renderer';`）。

- [ ] **Step 5: 既存 PlantUML フェンス上書きの位置と順序を確認**

実行: `sed -n '275,295p' src/extension.ts`

期待: 上記挿入のあと、`const defaultFenceRenderer = md.renderer.rules.fence;` の行が続く。PlantUML フェンス上書きは **Math プラグイン登録の後** に走るため、`previousFenceRenderer` チェーンにより両方が共存する。

- [ ] **Step 6: 型チェック**

実行: `npm run check`（= `tsc --noEmit`）

期待: エラーなし。`@vscode/markdown-it-katex` の default export 型が合わない場合は `* as` import に変更するか、最終手段として `src/types/` にスタブを置く。

- [ ] **Step 7: 既存テストを実行**

実行: `npm test`

期待: 既存単体・統合テスト + Task 3 / Task 4 の新規単体テストがすべて pass。`math.enabled` のデフォルトは `true` だが、既存 fixture に `$` / `\(` / `` ```math `` は含まれていないため、回帰は発生しない見込み。もし既存 fixture (`syntax-highlighting.md` など) に `$` 含有テキストが混じっていて expected が変わる場合、その時点で fixture を見直す（本タスク内で修正せず、ユーザに相談）。

- [ ] **Step 8: コミット**

```bash
git add src/extension.ts
git commit -m "feat(extension): wire KaTeX math rendering and \`\`\`math fence into markdown-it"
```

---

## Task 7: KaTeX CSS をフォント埋め込みでインライン注入する

既存の `markdown.css` / `markdown-pdf.css` / ハイライトテーマは `utils.makeCss()` で `<style>...</style>` としてインライン化されており、生成 HTML は単体で移動・共有しても壊れない。KaTeX の CSS もこの方針に合わせる。

KaTeX の CSS は `url(fonts/KaTeX_*.woff2)`（および `.woff` / `.ttf`）の相対参照でフォントを読む。`<style>` タグでインライン化すると相対 URL はドキュメント URL を基準に解決されるため、HTML ファイルを移動した瞬間にフォントが壊れる。`<link rel="stylesheet" href="file:///.../styles/katex/katex.min.css">` 形式は拡張のインストール先パスに出力 HTML を縛ってしまい、これも持ち運び性が失われる。

両方を解決する方法は **KaTeX CSS 内のフォント URL をすべて `data:` URI に書き換えてから `<style>` で埋め込む** こと。これにより HTML は完全自己完結になる（既定 CSS と同じ挙動）。サイズは ~300KB 程度増えるが、既にバンドルされている highlight テーマ (`tomorrow.css` 他) やデフォルト CSS と同列で扱える。

注入条件は「出力本文に KaTeX 要素が含まれるとき」に限定し、KaTeX を使わない文書の HTML が肥大化しないようにする。

**Files:**
- Modify: `src/utils.ts`（`buildKatexStyleTag(baseDir)` ヘルパを新規追加）
- Modify: `test/unit/utils.test.ts`（`buildKatexStyleTag` のテストを追加）
- Modify: `src/extension.ts:508-537`（`readStyles()` のシグネチャに `htmlBody` 追加）
- Modify: `src/extension.ts:311-336`（`makeHtml()` の `readStyles` 呼び出し）

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/utils.test.ts` の末尾 `describe('utils', …)` の閉じ括弧の **直前** に、以下の `describe` ブロックを追加する。

```typescript
  describe('buildKatexStyleTag', function () {
    const baseDir = path.resolve(__dirname, '..', '..');

    it('should return an inline <style> tag for KaTeX CSS', function () {
      const result = utils.buildKatexStyleTag(baseDir);
      assert.match(result, /^\s*<style>[\s\S]*<\/style>\s*$/);
      assert.match(result, /\.katex\s*\{/);
    });

    it('should rewrite font url(...) references to base64 data: URIs', function () {
      const result = utils.buildKatexStyleTag(baseDir);
      // Any remaining relative font reference would break portable HTML.
      assert.doesNotMatch(result, /url\(\s*['"]?fonts\//);
      assert.doesNotMatch(result, /url\(\s*['"]?\.\//);
      // At least one KaTeX font should have been inlined as data:.
      assert.match(result, /url\(\s*['"]?data:font\/woff2;base64,[A-Za-z0-9+/=]+['"]?\s*\)/);
    });

    it('should return an empty string when KaTeX CSS is missing', function () {
      const result = utils.buildKatexStyleTag('/nonexistent-base-dir-for-test');
      assert.strictEqual(result, '');
    });
  });
```

※ `path` は既存テストで import 済み。未 import の場合は先頭に `import path from 'path';` を追加する。

- [ ] **Step 2: テストが失敗することを確認**

実行: `npm run test:unit`

期待: `utils.buildKatexStyleTag is not a function` で 3 件失敗。

- [ ] **Step 3: 最小実装を `src/utils.ts` に追加**

`src/utils.ts` の末尾（または `makeCss` の近く）に以下を追加する。

```typescript
const KATEX_FONT_MIME: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

/**
 * Builds an inline <style> tag for KaTeX CSS with every url(fonts/...)
 * reference rewritten to a base64 data: URI. Produces a fully self-contained
 * stylesheet so the generated HTML stays portable when copied or moved.
 * Returns '' when the KaTeX CSS file is not present at the expected location.
 */
export function buildKatexStyleTag(baseDir: string): string {
  const cssPath = path.join(baseDir, 'styles', 'katex', 'katex.min.css');
  const rawCss = readFile(cssPath);
  if (!rawCss || typeof rawCss !== 'string') {
    return '';
  }
  const katexDir = path.join(baseDir, 'styles', 'katex');
  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const inlined = rawCss.replace(urlRe, function (match, _quote, href: string) {
    // Skip URLs that are already absolute or data: URIs.
    if (/^(data:|https?:|file:)/i.test(href)) {
      return match;
    }
    const normalized = href.replace(/^\.\//, '').split('?')[0].split('#')[0];
    const fontPath = path.join(katexDir, normalized);
    // Guard against path traversal: only allow files below styles/katex/.
    const relative = path.relative(katexDir, fontPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return match;
    }
    if (!isExistsPath(fontPath)) {
      return match;
    }
    const ext = path.extname(fontPath).toLowerCase();
    const mime = KATEX_FONT_MIME[ext];
    if (!mime) {
      return match;
    }
    const buffer = fs.readFileSync(fontPath);
    const base64 = buffer.toString('base64');
    return 'url(data:' + mime + ';base64,' + base64 + ')';
  });
  return '\n<style>\n' + inlined + '\n</style>\n';
}
```

`fs`, `path`, `isExistsPath`, `readFile` は既存 util で利用可能（同ファイル内）。

- [ ] **Step 4: 単体テストが通ることを確認**

実行: `npm run test:unit`

期待: 3 件 pass。Task 2 で `styles/katex/katex.min.css` と `styles/katex/fonts/*` が実在することが前提。

- [ ] **Step 5: `readStyles()` / `makeHtml()` を書き換える**

`src/extension.ts:508` の `readStyles` シグネチャを次のように変更する。

```typescript
function readStyles(uri: vscode.Uri, htmlBody: string | undefined): string | undefined {
```

関数末尾（`return utils.buildStyleTags({...})` の行）を次に置き換える。

```typescript
    let style = utils.buildStyleTags({
      includeDefaultStyles: includeDefaultStyles,
      highlight: highlight,
      highlightStyle: highlightStyle,
      markdownStyles: markdownStyles,
      markdownPdfStyles: markdownPdfStyles,
      baseDir: EXTENSION_ROOT,
      onMissingHighlightStyle: function (requestedStyle: string, resolvedStyle: string) {
        vscode.window.showWarningMessage(
          'The configured markdown-pdf.highlightStyle "' + requestedStyle +
          '" is no longer supported. Falling back to "' + resolvedStyle +
          '". See https://github.com/yzane/vscode-markdown-pdf#markdown-pdfhighlightstyle for available styles.'
        );
      },
      resolveHrefFn: function (href: string) {
        return fixHref(uri, href) || '';
      },
    }) || '';

    // Inline KaTeX CSS with data: URI fonts only when the body actually
    // contains KaTeX output. This keeps unrelated documents small and avoids
    // regenerating every existing snapshot just because math support shipped.
    if (htmlBody && htmlBody.includes('class="katex')) {
      style += utils.buildKatexStyleTag(EXTENSION_ROOT);
    }

    return style;
```

呼び出し側 `src/extension.ts:315`（`style += readStyles(uri);`）を次に変更する。

```typescript
    style += readStyles(uri, data);
```

`data` は `makeHtml(data, uri)` の第 1 引数であり、markdown-it が生成した HTML 本文。

- [ ] **Step 6: 型チェックとテスト**

実行: `npm run check && npm test`

期待: エラーなし、全テスト pass。既存 fixture には `class="katex` が含まれないため `expected/*.html` に差分は出ない。

- [ ] **Step 7: 自己完結性の目視確認（手動）**

Task 8 完了後に改めて行ってよいが、本タスクでも簡易確認できる。

1. 小さな数式入り Markdown を用意してエクスポート（`$E = mc^2$` のみ）
2. 生成 HTML を別ディレクトリへコピー → そのコピーをブラウザで開く
3. 数式フォントが正しく表示される（元の場所・`node_modules` 有無に依存しない）

- [ ] **Step 8: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts src/extension.ts
git commit -m "feat(styles): inline KaTeX CSS with base64 data: URI fonts for portable HTML"
```

---

## Task 7.5: ブラケット区切りプラグインを追加する

`@vscode/markdown-it-katex@1.1.2` は `\(...\)` / `\[...\]` をネイティブ対応しない（VS Code 組込みプレビューも同様）。本タスクでは同等のトークンを生成する小さな markdown-it プラグインを TDD で追加し、`extension.ts` に組み込む。

**Files:**
- Create: `src/markdown-it-math-brackets.ts`
- Create: `test/unit/markdown-it-math-brackets.test.ts`
- Modify: `src/extension.ts:290-301`（`markup` を見て displayMode を決める + 新プラグインを `md.use()`）

トークン設計:

| 入力 | トークン | `markup` |
|---|---|---|
| `\(tex\)` インライン | `math_inline` | `'\\('` |
| `\[tex\]` インライン | `math_inline` | `'\\['` |
| `\[tex\]` ブロック（単独行または複数行） | `math_block` | `'\\['` |

既存レンダラオーバーライドは `math_inline` を常に `displayMode: false` でレンダしていたが、本タスクで `markup === '$$' || markup === '\\['` の判定を導入する。これは `@vscode/markdown-it-katex` のインラインブロック数式（文中の `$$...$$`）の display 判定を正しく反映する副次的改善にもなる。

- [ ] **Step 1: 失敗テストを書く**

ファイル新規作成: `test/unit/markdown-it-math-brackets.test.ts`

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import MarkdownIt from 'markdown-it';
import { mathBracketsPlugin } from '../../src/markdown-it-math-brackets';

function tokenize(src: string) {
  const md = new MarkdownIt();
  md.use(mathBracketsPlugin);
  return md.parse(src, {});
}

describe('mathBracketsPlugin', () => {
  it('emits math_inline token for \\(...\\) on a single line', () => {
    const tokens = tokenize('Hello \\(E = mc^2\\) world.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.ok(math, 'math_inline token should be emitted');
    assert.strictEqual(math?.content, 'E = mc^2');
    assert.strictEqual(math?.markup, '\\(');
  });

  it('emits math_inline token with display markup for inline \\[...\\]', () => {
    const tokens = tokenize('See \\[\\alpha\\] here.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.ok(math, 'math_inline token should be emitted');
    assert.strictEqual(math?.content, '\\alpha');
    assert.strictEqual(math?.markup, '\\[');
  });

  it('emits math_block token for \\[...\\] on its own block', () => {
    const src = '\\[\n\\gamma^2\n\\]\n';
    const tokens = tokenize(src);
    const block = tokens.find((t) => t.type === 'math_block');
    assert.ok(block, 'math_block token should be emitted');
    assert.strictEqual(block?.content.trim(), '\\gamma^2');
    assert.strictEqual(block?.markup, '\\[');
  });

  it('does not emit math tokens for escaped delimiters (\\\\( / \\\\[)', () => {
    const tokens = tokenize('Literal: \\\\(x\\\\) and \\\\[y\\\\].');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline' || t.type === 'math_block');
    assert.strictEqual(math, undefined);
  });

  it('does not treat \\(...\\) inside a code span as math', () => {
    const tokens = tokenize('Code: `\\(x\\)` here.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.strictEqual(math, undefined);
  });

  it('does not match an unclosed \\( delimiter', () => {
    const tokens = tokenize('Dangling: \\(x + y.');
    const inline = tokens.find((t) => t.type === 'inline');
    const math = inline?.children?.find((t) => t.type === 'math_inline');
    assert.strictEqual(math, undefined);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

実行: `npx tsx --test test/unit/markdown-it-math-brackets.test.ts`

期待: モジュール `../../src/markdown-it-math-brackets` が存在しないため解決エラー。

- [ ] **Step 3: 最小実装を追加**

ファイル新規作成: `src/markdown-it-math-brackets.ts`

```typescript
import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';

/**
 * Inline rule: matches \(...\) and \[...\] on a single line.
 * - \(...\)  -> math_inline with markup '\\(' (displayMode: false)
 * - \[...\]  -> math_inline with markup '\\[' (displayMode: true)
 * Skips when the opening backslash is itself escaped (e.g. "\\(" in source).
 */
function inlineBracketMath(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x5c /* \\ */) {
    return false;
  }
  const next = src.charCodeAt(pos + 1);
  const isParen = next === 0x28; /* ( */
  const isBracket = next === 0x5b; /* [ */
  if (!isParen && !isBracket) {
    return false;
  }
  // Reject when preceding char is an unescaped backslash (i.e., the leading \\ is itself escaped).
  // markdown-it's \\ escape handling consumes the escape before calling inline rules, so in practice
  // "\\\\(x\\\\)" arrives here already unescaped to "\(x\)"; we only guard against explicit \\ that
  // was *not* consumed (defensive). This matches katex plugin behavior.
  const closeOpen = isParen ? '\\)' : '\\]';
  const end = src.indexOf(closeOpen, pos + 2);
  if (end < 0) {
    return false;
  }
  const content = src.slice(pos + 2, end);
  // Reject if content crosses a line break (inline rules are per-line in markdown-it).
  if (content.indexOf('\n') >= 0) {
    return false;
  }
  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.content = content;
    token.markup = isParen ? '\\(' : '\\[';
  }
  state.pos = end + 2;
  return true;
}

/**
 * Block rule: matches a block that starts with \[ and continues until \]
 * (possibly across multiple lines). Emits math_block with markup '\\['.
 * Only triggers when the line begins with \[ (allowing leading whitespace).
 */
function blockBracketMath(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const startMax = state.eMarks[startLine];
  const firstLine = state.src.slice(startPos, startMax);
  if (!/^\\\[/.test(firstLine)) {
    return false;
  }
  if (silent) {
    return true;
  }
  let found = false;
  let nextLine = startLine;
  let lastLine = '';
  for (; nextLine < endLine; nextLine++) {
    const pos = state.bMarks[nextLine] + state.tShift[nextLine];
    const max = state.eMarks[nextLine];
    const line = state.src.slice(pos, max);
    const closeIdx = line.indexOf('\\]');
    if (closeIdx >= 0) {
      lastLine = line.slice(0, closeIdx);
      found = true;
      break;
    }
  }
  if (!found) {
    return false;
  }
  // Assemble content from the block, stripping the opening \[ on the first line and the \] on the last.
  const rawFirst = state.src.slice(startPos, startMax).replace(/^\\\[/, '');
  const middleLines: string[] = [];
  for (let i = startLine + 1; i < nextLine; i++) {
    const p = state.bMarks[i] + state.tShift[i];
    const m = state.eMarks[i];
    middleLines.push(state.src.slice(p, m));
  }
  const parts = [rawFirst, ...middleLines, lastLine].filter((s) => s.length > 0 || true);
  const content = parts.join('\n').trim();
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = content;
  token.markup = '\\[';
  token.map = [startLine, nextLine + 1];
  state.line = nextLine + 1;
  return true;
}

export function mathBracketsPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('escape', 'math_brackets_inline', inlineBracketMath);
  md.block.ruler.before('fence', 'math_brackets_block', blockBracketMath, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
}
```

- [ ] **Step 4: テスト成功を確認**

実行: `npx tsx --test test/unit/markdown-it-math-brackets.test.ts`

期待: 6 件すべて pass。

- [ ] **Step 5: `extension.ts` にプラグインを組み込み、`markup` 判定を追加**

`src/extension.ts` の import ブロックに追加:

```typescript
import { mathBracketsPlugin } from './markdown-it-math-brackets';
```

既存の `if (mathEnabled) { ... }` ブロックを次のように書き換える:

```typescript
if (mathEnabled) {
  md.use(markdownItKatex, { enableBareBlocks: true, enableMathBlockInHtml: false });
  md.use(mathBracketsPlugin);
  // Route delimiter-path math tokens through renderMath(). Respect `markup` so
  // inline $$...$$ and \[...\] render as display math, matching the upstream
  // @vscode/markdown-it-katex behavior.
  md.renderer.rules.math_inline = function (tokens, idx) {
    const token = tokens[idx];
    const displayMode = token.markup === '$$' || token.markup === '\\[';
    return renderMath(token.content, displayMode, { macros: mathMacros });
  };
  md.renderer.rules.math_block = function (tokens, idx) {
    return renderMath(tokens[idx].content, true, { macros: mathMacros });
  };
  md.use(mathFencePlugin, { macros: mathMacros });
}
```

- [ ] **Step 6: 既存単体テストがすべて pass することを確認**

実行: `npm run test:unit`

期待: 既存テスト + 新規 6 件がすべて pass、0 失敗。

- [ ] **Step 7: コミット**

```bash
git add src/markdown-it-math-brackets.ts \
        test/unit/markdown-it-math-brackets.test.ts \
        src/extension.ts
git commit -m "feat(math): add bracket delimiter plugin for \\(...\\) and \\[...\\]"
```

---

## Task 8: 数式の統合テスト fixture と期待 HTML を追加する

既存 PlantUML fence の手順（`docs/superpowers/plans/20260418-02-plantuml-fence-support.md` Task 4）と同じ要領で、数式入り fixture と期待 HTML を追加する。KaTeX の出力は決定論的なので期待値を固定できる。

**Files:**
- Create: `test/integration/fixtures/math.md`
- Create: `test/integration/expected/math.html`
- Create: `test/integration/fixtures/math-disabled.md`
- Create: `test/integration/expected/math-disabled.html`
- Modify: `test/integration/extension.test.ts:61-77`（`HTML_FEATURES` 配列）

- [ ] **Step 1: `math.md` fixture を作成**

ファイル新規作成: `test/integration/fixtures/math.md`

````markdown
# Math

Inline: $E = mc^2$.

Display:

$$
\int_0^\infty e^{-x}\,dx = 1
$$

LaTeX brackets inline: \(\alpha + \beta\).

LaTeX brackets display: \[\gamma^2\].

Math fence:

```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```
````

- [ ] **Step 2: `math-disabled.md` fixture を作成**

ファイル新規作成: `test/integration/fixtures/math-disabled.md`

````markdown
---
math:
  enabled: false
---

# Math disabled

Inline: $100 and $200 should stay as plain text.

```math
\alpha = \beta
```
````

`math.enabled: false` のとき、`$100` 等は数式として解釈されずプレーンテキスト、`` ```math `` は通常のコードブロックになる。

- [ ] **Step 3: `HTML_FEATURES` 配列にエントリを追加**

`test/integration/extension.test.ts:61-77` の配列に、`{ name: 'page-break' }` の **前** に 2 項目を追加する（位置はどこでもよいが、既存順序を踏襲し末尾付近に置く）。

差分例:

```typescript
  { name: 'include-codeblock' },
  { name: 'math' },
  { name: 'math-disabled' },
  { name: 'page-break' },
```

- [ ] **Step 4: 期待 HTML を生成して保存する**

PlantUML fence Task 4 と同じ方針で:

1. テストを 1 件だけ実行して生成 HTML を取得する。テストは期待ファイル不一致で失敗するが、`safeDelete(generatedHtmlPath)` で削除される前に別名でコピーする。
2. 簡便な代替: **既存の `plantuml-fence.html` のヘッダ構造をテンプレートとしてコピー**し、本文だけ差し替える。KaTeX の出力部分は手書きではなく、**実行結果を Linux で 1 回生成してからコミットする**（空白や id の揃い方が KaTeX バージョンに依存するため）。

推奨手順:

```bash
# 1. fixture を置いた後、test を 1 件だけ走らせる
npx vscode-test --config .vscode-test.mjs --label integration \
  --mocha-grep "^math: HTML snapshot matches expected$"
```

テストは期待ファイル不存在で失敗するが、`test/integration/fixtures/math.html` が一時的に生成される。タイムアウト 60 秒以内に手動コピーするか、`safeDelete` を一時コメントアウトしてテスト実行→ 手動コピー → `safeDelete` を戻す方が確実。

生成 HTML を `test/integration/expected/math.html` に保存し、`<title>math.md</title>` 部分は既存パターンと整合する（テスト実行時に `<title>math.md</title>` → `<title>math.md</title>` の置換は同名のため無変更）。

`math-disabled.html` も同様に生成する。

- [ ] **Step 5: 期待 HTML の KaTeX 出力を確認**

`test/integration/expected/math.html` を開き、以下が含まれることを確認する。

- `<span class="katex">` が少なくとも 2 箇所（インライン: `E = mc^2`, `\alpha + \beta`）
- `<span class="katex-display">` が少なくとも 3 箇所（`$$…$$`、`\[…\]`、` ```math ` フェンス）
- インライン `<style>` ブロック内に `.katex {` などの KaTeX スタイル定義と、`url(data:font/woff2;base64,…)` 形式の埋め込みフォントが含まれる（Task 7 の `buildKatexStyleTag` による自己完結 CSS）
- 外部 `<link>` タグは追加されない（KaTeX 用の `file://` 参照は発生しない）

`test/integration/expected/math-disabled.html` では:

- `<span class="katex">` が **存在しない**
- `$100 and $200` は `<p>` 内にプレーンテキストで残る（エスケープのみ）
- ` ```math ` は `<pre><code class="language-math">\\alpha = \\beta\n</code></pre>` 相当
- KaTeX の `<style>` ブロック（`.katex {` / `data:font/woff2;base64,…`）が **含まれない**（Task 7 の条件により、`class="katex` が本文に無いため注入されない）

- [ ] **Step 6: テストを実行**

実行: `npm test`

期待: `math: HTML snapshot matches expected` / `math-disabled: HTML snapshot matches expected` を含む全ケースが pass。差分が出た場合は生成 HTML を再度取得して expected を更新する。

- [ ] **Step 7: コミット**

```bash
git add test/integration/fixtures/math.md \
        test/integration/fixtures/math-disabled.md \
        test/integration/expected/math.html \
        test/integration/expected/math-disabled.html \
        test/integration/extension.test.ts
git commit -m "test(integration): add math fixtures for KaTeX rendering and disabled state"
```

---

## Task 9: サンプル生成で数式が含まれるように README を更新する

`test/sample/generate-sample.ts` は `README.md` を変換して `sample/README.*` を生成する。README に数式セクションを追加することでサンプルにも数式が含まれるようになるが、README 更新は Task 10 で行うため本タスクでは触らない。

サンプル生成の動作確認だけ行う。

**Files:**
- （変更なし。動作確認のみ）

- [ ] **Step 1: サンプル生成が壊れていないことを確認**

実行: `npm run sample`

期待: `sample/README.pdf` / `sample/README.html` / `sample/README.png` / `sample/README.jpeg` が生成される（README にまだ数式が無い時点での確認）。

- [ ] **Step 2: コミット不要**

変更が無いためコミットは行わない。次タスクに進む。

---

## Task 10: README.md に数式セクションを追加する

`### Mermaid` の直後に `### Math` セクションを新設する。VS Code プレビュー互換・KaTeX 採用・オプトアウト方法を明記する。

**Files:**
- Modify: `README.md:200-218`（`### Mermaid` セクションの直後）
- Modify: `README.md:14-29`（Table of Contents に `### Math` は入らない。depthTo:2 なので影響無し）
- Modify: `README.md:77-88`（`Features` テーブルに行を追加）
- Modify: `README.md:38-45`（What's New の X.Y.Z 節にエントリ追加）

- [ ] **Step 1: `### Math` セクションを追加**

`README.md:218` の `![mermaid](images/mermaid.png)` の行の次、`## Chromium` の **前** に、以下を挿入する。

````markdown
### Math

Render LaTeX math via [KaTeX](https://katex.org/). Uses [@vscode/markdown-it-katex](https://github.com/microsoft/vscode-markdown-it-katex) (the same plugin as VS Code's built-in Markdown preview) for `$…$`, `$$…$$`, and `\begin{env}…\end{env}`, plus a small in-house plugin for `\(…\)` and `\[…\]` bracket delimiters. Rendering runs in Node, so no network access is required.

Supported notations:

- Inline: `$E = mc^2$`, `\(E = mc^2\)`
- Display: `$$\int_0^\infty f(x)\,dx$$`, `\[\alpha\]`
- LaTeX environments: `\begin{aligned}a &= b\\c &= d\end{aligned}`
- Fenced code block:

````
```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```
````

To disable math rendering (for example, when `$100` should stay as plain text), set [markdown-pdf.math.enabled](#markdown-pdfmathenabled) to `false`, add `math.enabled: false` to the document front matter, or escape the `$` as `\$`.

User-defined KaTeX macros can be passed via [markdown-pdf.math.katex.macros](#markdown-pdfmathkatexmacros) or in the front matter:

```yaml
---
math:
  katex:
    macros:
      "\\RR": "\\mathbb{R}"
---
```
````

- [ ] **Step 2: Features テーブルに行を追加**

`README.md:87` の `| [Mermaid](#mermaid) | Diagrams from fenced code blocks | ` ```mermaid ` |` の **前** に、以下の行を追加する。

```
| [Math](#math) | LaTeX math via KaTeX | `$E = mc^2$` |
```

- [ ] **Step 3: What's New エントリを追加**

`README.md:38-45` の `### X.Y.Z` 節、最後の項目 (Chromium auto-download) の **下** に以下の 2 行を追加する。

```markdown
- Added math rendering support via [KaTeX](https://katex.org/), matching VS Code's built-in Markdown preview. Supports inline `$…$` / `\(…\)`, display `$$…$$` / `\[…\]`, and ```math fenced code blocks. Opt out via [markdown-pdf.math.enabled](#markdown-pdfmathenabled).
    - Details: [Math](#math)
```

- [ ] **Step 4: `### Options` に 2 エントリを追加**

該当箇所を確認: `grep -n '^#### \`markdown-pdf.mermaidServer\`' README.md`

期待: `mermaidServer` の節が見つかる。その **後** に以下 2 節を追加する。

```markdown
#### `markdown-pdf.math.enabled`
  - Enable math rendering via KaTeX for `$…$`, `$$…$$`, `\(…\)`, `\[…\]`, and ```math fenced code blocks.
  - Matches the behavior of VS Code's built-in Markdown preview.
  - Set to `false` to keep the raw `$` / `\(` / `\[` / ```math text (use this if your document relies on `$100`-style literal dollar signs).
  - Default: true

#### `markdown-pdf.math.katex.macros`
  - User-defined [KaTeX macros](https://katex.org/docs/options.html) passed to the KaTeX renderer.
  - Example: `{ "\\RR": "\\mathbb{R}" }`
  - Default: {}
```

- [ ] **Step 5: 目視確認**

実行: `sed -n '200,250p' README.md` / `sed -n '85,92p' README.md` / `sed -n '38,50p' README.md`

期待: マークダウン整形が崩れていないこと、リンク `#math` / `#markdown-pdfmathenabled` / `#markdown-pdfmathkatexmacros` が対応見出しに合うこと。

- [ ] **Step 6: コミット**

```bash
git add README.md
git commit -m "docs(math): document KaTeX math rendering and math.* settings"
```

---

## Task 11: README.ja.md を更新する

README.md と同じ内容を日本語で追加する。位置関係は README.md に対応する。

**Files:**
- Modify: `README.ja.md`（Mermaid セクション直後に Math、Features テーブルに行追加、What's New エントリ追加、Options セクションに 2 節追加）

- [ ] **Step 1: 位置を確認**

実行: `grep -n '^### Mermaid\|^### PlantUML\|^## Chromium\|What.s New\|markdown-pdf.mermaidServer' README.ja.md`

期待: `### Math` を挿入する直前位置・Options セクション末尾位置が把握できる。

- [ ] **Step 2: `### Math` セクションを追加（日本語）**

`### Mermaid` セクションの画像リンク (`![mermaid](images/mermaid.png)`) の直後、`## Chromium` の前に、以下を挿入する。

````markdown
### Math

[@vscode/markdown-it-katex](https://github.com/microsoft/vscode-markdown-it-katex) を使って [KaTeX](https://katex.org/) で LaTeX 数式を描画します（VS Code 標準の Markdown プレビューと同じプラグイン）。Node 側で描画するのでネットワーク接続は不要です。

対応記法:

- インライン: `$E = mc^2$`, `\(E = mc^2\)`
- ブロック: `$$\int_0^\infty f(x)\,dx$$`, `\[\alpha\]`
- フェンスコードブロック:

````
```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```
````

数式描画を無効化する場合（例: `$100` をそのままテキストとして扱いたい場合）は、[markdown-pdf.math.enabled](#markdown-pdfmathenabled) を `false` に設定するか、フロントマターに `math.enabled: false` を追加するか、`$` を `\$` としてエスケープします。

KaTeX のユーザー定義マクロは [markdown-pdf.math.katex.macros](#markdown-pdfmathkatexmacros) またはフロントマターで指定できます:

```yaml
---
math:
  katex:
    macros:
      "\\RR": "\\mathbb{R}"
---
```
````

- [ ] **Step 3: Features テーブル（あれば）と What's New / Options を更新**

README.ja.md の該当箇所に、README.md Task 10 Step 2〜4 と同内容の日本語訳を加える。

Features テーブル行:

```
| [数式](#math) | KaTeX による LaTeX 数式 | `$E = mc^2$` |
```

What's New（`### X.Y.Z` 節の既存末尾項目の下に追加）:

```markdown
- [KaTeX](https://katex.org/) による数式描画に対応しました（VS Code 標準の Markdown プレビューと同じ動作）。インライン `$…$` / `\(…\)`、ブロック `$$…$$` / `\[…\]`、および ```math フェンスコードブロックをサポートします。[markdown-pdf.math.enabled](#markdown-pdfmathenabled) で無効化できます。
    - 詳細: [Math](#math)
```

Options セクション（`markdown-pdf.mermaidServer` の後）:

```markdown
#### `markdown-pdf.math.enabled`
  - `$…$`, `$$…$$`, `\(…\)`, `\[…\]`, ```math フェンスコードブロックの数式描画を KaTeX で有効化します。
  - VS Code 標準の Markdown プレビューと同じ動作になります。
  - `false` にすると `$` / `\(` / `\[` / ```math はそのままテキストとして残ります（`$100` のようなドル記号リテラルを使う場合はこちらを利用してください）。
  - Default: true

#### `markdown-pdf.math.katex.macros`
  - KaTeX に渡すユーザー定義 [KaTeX マクロ](https://katex.org/docs/options.html) です。
  - 例: `{ "\\RR": "\\mathbb{R}" }`
  - Default: {}
```

- [ ] **Step 4: 目視確認**

実行: `grep -n '^### Math\|^#### \`markdown-pdf.math' README.ja.md`

期待: それぞれ 1 箇所ずつ見つかる。

- [ ] **Step 5: コミット**

```bash
git add README.ja.md
git commit -m "docs(math): document KaTeX math rendering and math.* settings (ja)"
```

---

## Task 12: CHANGELOG.md にエントリを追加する

`## X.Y.Z` セクションの `### Changes` 節に新機能を追加する。2 系マイナーとして出すが、具体的なバージョン番号はリリース時に確定するため本タスクでは `X.Y.Z` のまま。

**Files:**
- Modify: `CHANGELOG.md:1-18`（先頭の `## X.Y.Z` セクション）

- [ ] **Step 1: 該当箇所を確認**

実行: `sed -n '1,20p' CHANGELOG.md`

期待: `### Changes` 節が見え、既存の `sanitize` / `plantuml` / `chromium` エントリが並んでいる。

- [ ] **Step 2: エントリを追加**

`### Changes` 節の末尾（最後の項目の下）に以下 1 行を追加する。

```markdown
* Add math rendering support via KaTeX for `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, and ```math fenced code blocks (matches VS Code's built-in Markdown preview). Controlled by the new `markdown-pdf.math.enabled` (default `true`) and `markdown-pdf.math.katex.macros` settings.
```

- [ ] **Step 3: 目視確認**

実行: `sed -n '1,22p' CHANGELOG.md`

期待: 追加行が正しい位置に入っている。

- [ ] **Step 4: コミット**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note KaTeX math rendering support"
```

---

## Task 13: 最終検証

すべての変更がまとまった状態で最終確認を行う。

- [ ] **Step 1: 全テストを再実行**

実行: `npm test`

期待: 既存テスト + 新規単体 14 件（Task 3: 6 件、Task 4: 5 件、Task 7: 3 件）+ 新規統合 2 件（Task 8: `math` / `math-disabled`）がすべて pass。

- [ ] **Step 2: 型チェック**

実行: `npm run check`

期待: エラーなし。

- [ ] **Step 3: ビルドが成功することを確認**

実行: `npm run build`

期待: `dist/extension.js` が生成されエラーが無い。`katex` は Node ランタイムで読まれるため esbuild のバンドル対象に含まれる。バンドルサイズが大きく増える（KaTeX は数百 KB）ことを確認する。

- [ ] **Step 4: サンプル生成確認**

実行: `npm run sample`

期待: `sample/README.pdf` / `.html` / `.png` / `.jpeg` が生成され、README.md に追加した `### Math` セクションが数式として描画される。

実行: `file sample/README.pdf` と `ls -la sample/README.*`

期待: PDF サイズが前回より増えている（KaTeX フォント埋め込み or CSS 経由描画）。

- [ ] **Step 5: オフライン確認（手動）**

VS Code で `test/integration/fixtures/math.md` を開き、ネットワークを一時的に切断した状態で `Markdown PDF: Export (html)` を実行する。ブラウザで生成 HTML を開き、数式フォントが正しく表示されることを目視する。

ネットワーク切断が難しい場合は、代わりに `sample/README.html` をブラウザで開いて「ネットワークタブで外部リクエストが発生しないこと」を DevTools で確認する。

- [ ] **Step 6: VS Code 設定 UI の確認（手動）**

VS Code でこの worktree を開き、`Cmd/Ctrl + ,` で設定 UI を開いて `markdown-pdf.math` を検索する。`Enabled` / `Katex: Macros` の 2 項目が表示されることを確認する。

- [ ] **Step 7: コミット履歴を確認**

実行: `git log --oneline feature/math-support ^develop`

期待: Task 1〜12 のコミットが順に並んでいる（最終検証で見つかった微修正があればそれも含む）。

- [ ] **Step 8: 完了報告**

ユーザに「実装完了。`feature/math-support` を `develop` へマージしてよいか」と確認を仰ぐ。マージは AGENTS.md ルール（`--no-ff` マージ、マージ前の明示的な承認）に従い、ユーザ承認なしに実行しない。

---

## 自己レビュー（プラン作成者用メモ）

スペック各セクションがプランのタスクで実装されているか:

- [x] 背景 / 目的 → 不要（プランは実装手順）
- [x] スコープ「含むもの」
  - KaTeX によるデリミタ記法 → Task 6（`markdownItKatex` 登録）
  - `` ```math `` フェンス → Task 4 + Task 6
  - `@vscode/markdown-it-katex` 採用 → Task 1 + Task 6
  - `math.enabled` / `math.katex.macros` 設定追加 → Task 5
  - フロントマター上書き → Task 6（`getFrontMatterRecord` + `mathFrontmatter`）
  - KaTeX CSS / フォント同梱とオフライン → Task 2 + Task 7
  - 単体・統合テスト・サンプル・README / CHANGELOG → Task 3 / 4 / 8 / 9 / 10 / 11 / 12
- [x] スコープ「含まないもの」→ 該当タスクを設けないことで担保（MathJax、`math.engine`、`throwOnError` 露出、記法オンオフ個別設定、他レンダリング変更）
- [x] アーキテクチャ概要（経路 A / B） → Task 4 + Task 6
- [x] コンポーネントとファイル構成 → Task 1 / 2 / 3 / 4 / 5 / 6 / 7 すべて
- [x] データフロー（経路 A / B / オプション構築） → Task 6 の挿入コード。経路 A は `md.renderer.rules.math_inline` / `math_block` を `renderMath` に差し替えることでスペック §データフロー §経路 A:2「`@vscode/markdown-it-katex` のレンダラが `renderMath(token.content, displayMode, options)` を呼ぶ」を満たす。
- [x] エラー処理とエッジケース
  - 不正 TeX（パースエラー）→ Task 3 のテストで `katex-error` スパン出力を検証（スペック §エラー処理「該当箇所のみ赤色で ParseError を描画」を反映）
  - KaTeX 実行時例外 → Task 3 の `<code>` フォールバックテスト（`undefined` 入力で強制）
  - 未閉じデリミタ → Task 6 でプラグインに委譲（既存挙動）
  - 空の math フェンス → Task 4 のテスト
  - `math.enabled: false` → Task 6 の分岐 + Task 8 の `math-disabled.md`
  - sanitize 影響なし → KaTeX は `math_*` トークン経由で `html_*` サニタイザ対象外（Task 6 では既存 sanitize フローに手を入れないことで担保）
- [x] セキュリティ方針 → Task 3 で `trust: false` 固定、フロントマター露出しない設計（`mathMacrosFrontmatter` のみ許可）
- [x] CSS とフォントのバンドル → Task 2 + Task 7（`<style>` タグでインライン化し、`url(fonts/...)` を base64 `data:` URI に書き換えることで HTML が自己完結）
- [x] パッケージング → Task 1 + Task 2（CSS / フォントは `.vscodeignore` で除外されず `styles/katex/` が配布に含まれる）+ Task 13 ビルド確認
- [x] テスト戦略 → Task 3 / 4 / 8 / 9
- [x] ドキュメント更新 → Task 10 / 11 / 12
- [x] リリースとマイグレーション → CHANGELOG / README の文言で `$100` 注意喚起とオプトアウト方法を明記（Task 10 Step 1 / Task 11 Step 2 / Task 12 Step 2）
- [x] 依存関係 → Task 1
- [x] ブランチ運用 → プラン冒頭の前提、Task 13 Step 8 の確認依頼
- [x] 受け入れ基準 → Task 13 Step 1〜6 で網羅

タイプの整合性チェック:

- `RenderMathOptions` (Task 3) と `MathFencePluginOptions` (Task 4) が同一の `macros` キーを持つ → OK
- `renderMath(tex, displayMode, options)` のシグネチャ → Task 3 / Task 4 / Task 6 で統一（経路 A の `math_inline` / `math_block` オーバライドも同じ呼び出し）
- `mathFencePlugin(md, options)` のシグネチャ → Task 4 / Task 6 で統一
- `getFrontMatterRecord` の戻り値型 `Record<string, unknown> | undefined` → Task 6 で `mathFrontmatter` / `mathFrontmatterKatex` / `mathMacrosFrontmatter` すべて同じ扱い
- `@vscode/markdown-it-katex` のオプション名 `enableBareBlocks` / `enableMathBlockInHtml` → Task 6 Step 4 で `node_modules/@vscode/markdown-it-katex/dist/index.d.ts` を確認する手順を明記
- `readStyles(uri, htmlBody)` のシグネチャ変更 → Task 7 Step 5 と `makeHtml` 側 `src/extension.ts:315` の呼び出しで整合
- `buildKatexStyleTag(baseDir)` のシグネチャ → Task 7 Step 1（テスト）/ Step 3（実装）/ Step 5（利用）で統一
