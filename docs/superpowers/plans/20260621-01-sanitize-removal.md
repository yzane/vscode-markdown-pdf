# サニタイズ除去＋通知 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブロックレベルの `<style>`/`<script>`/`<iframe>` を中身ごと除去し（#437 解決）、除去・属性除去が起きたらユーザーへ通知する（手動エクスポート時トースト＋「Show Output」、保存時自動変換はチャネルのみ）。

**Architecture:** `sanitizeRawHtml`（`utils.ts`）を `{ html, report }` 返却＋`removeWithContent` オプション化。レンダラ配線は vscode 非依存の新モジュール `markdown-it-sanitize.ts`（`installSanitizeRules`）に抽出し、html_block は除去あり・html_inline は除去なし（エスケープ）。`convertMarkdownToHtml` がレポートを集約して返し、`markdownPdf` がループ後に1回 `notifySanitize` する。

**Tech Stack:** TypeScript / markdown-it（レンダラ規則）/ VS Code Extension API（通知・logger）/ `node:test`+`tsx`（ユニット）/ esbuild。

**Spec:** [`docs/superpowers/specs/20260621-01-sanitize-removal-design.md`](../specs/20260621-01-sanitize-removal-design.md)

**Branch:** `bugfix/sanitize-removal`（worktree: `.worktrees/bugfix-sanitize-removal`）。全タスクこのブランチで実施。

---

## 全体の制約

- コードコメントは英語。`utils.ts` / `markdown-it-sanitize.ts` は **vscode を import しない**（tsx ユニットテスト維持）。通知・トーストは `extension.ts`（vscode 依存）に置く。
- **検証ゲートの注意（重要）**: Task 1 で `sanitizeRawHtml` の戻り値が `string`→`{ html, report }` に変わると、未更新の `extension.ts` で `tsc` 型エラーが出る。よって **Task 1〜3 は `npm run test:unit`（tsx、型チェックなしで実行）でゲート**し、`npm run check`（`tsc --noEmit`）は **Task 4 で extension.ts を更新した後にグリーンへ戻す**。Task 1〜3 の途中で `npm run check` が赤なのは想定どおり。
- コマンドは worktree ルート `.worktrees/bugfix-sanitize-removal` で実行。

## ファイル構成

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/utils.ts` | `SanitizeReport`/`SanitizeOptions` 型、`sanitizeRawHtml`（`{html,report}`＋`removeWithContent`）、`stripDangerousAttributes`（除去属性を返す）、`buildSanitizeSummary`/`buildSanitizeLogDetail`（純粋関数） | 修正 |
| `test/unit/utils.test.ts` | 既存 sanitize テストを `.html` 化＋除去/レポート/builder の新テスト | 修正 |
| `src/markdown-it-sanitize.ts` | `installSanitizeRules`（html_block=除去, html_inline=エスケープ, report 集約） | 新規 |
| `test/unit/markdown-it-sanitize.test.ts` | markdown-it 実体での統合テスト（block 除去 / inline エスケープ） | 新規 |
| `src/extension.ts` | `convertMarkdownToHtml`（`installSanitizeRules`＋`{html,report}` 返却）、`markdownPdf`（`isOnSave`＋ループ後 `notifySanitize`）、`markdownPdfOnSave`（`true` 渡し）、`notifySanitize` 追加 | 修正 |

---

## Task 0: ブランチ / worktree の確認＋依存インストール（プリフライト）

**Files:** （変更なし）

- [ ] **Step 1: git の dubious ownership を回避（必要時のみ）**

一部の agentic worker 実行環境では、worktree 配下の `git` 操作が `detected dubious ownership` で失敗する。`git status` 等が止まる場合のみ、当該 worktree を安全ディレクトリに登録してから続行する:

Run（`git` がエラーなく動く環境では不要、出る場合のみ）: `git config --global --add safe.directory C:/work/github/yzane/vscode-markdown-pdf/.worktrees/bugfix-sanitize-removal`
（このコマンドは冪等で無害。）

- [ ] **Step 2: ブランチ確認**

Run: `git branch --show-current && git status --short`
Expected: `bugfix/sanitize-removal`。未コミット変更は spec/plan のみ（または無し）。異なれば中断して報告。

- [ ] **Step 3: 依存インストール（新規 worktree のため）**

Run: `npm ci`
Expected: 完了（`node_modules` 生成）。

- [ ] **Step 4: ベースライン確認**

Run: `npm run test:unit`（`node --test` は失敗時に非0終了するので、**終了コード**でゲートする。要約だけ見たい場合は別途 `npm run test:unit 2>&1 | tail -5` を使う）
Expected: 既存テストが全 pass（0 fail）。

---

## Task 1: sanitizeRawHtml を {html, report}＋removeWithContent に変更

**Files:**
- Modify: `src/utils.ts`（`SanitizeMode` 付近に型追加、`stripDangerousAttributes`、`sanitizeRawHtml`）
- Test: `test/unit/utils.test.ts`（`sanitizeRawHtml` describe を新シェイプへ）

- [ ] **Step 1: 既存テストを新シェイプ（`.html`）へ更新し、新テストを追加（失敗させる）**

`test/unit/utils.test.ts` の `describe('sanitizeRawHtml', ...)`（現行 1803〜1952 行付近）内で、**既存の `utils.sanitizeRawHtml(...)` 呼び出し 28 箇所すべてに `.html` を付ける**（戻り値がオブジェクトになるため。デフォルト `removeWithContent` 省略＝エスケープ動作なので既存アサーションは不変）。例:
```ts
// before
const result = utils.sanitizeRawHtml('<script>alert(1)</script>', 'gfm');
assert.strictEqual(result, '&lt;script>alert(1)&lt;/script>');
// after
const result = utils.sanitizeRawHtml('<script>alert(1)</script>', 'gfm').html;
assert.strictEqual(result, '&lt;script>alert(1)&lt;/script>');
```
ループ内（現行 1830 行）も `utils.sanitizeRawHtml(input, 'gfm').html` に、`none` ケース（1851/1855/1864 等）も `.html` に。

続いて `describe('sanitizeRawHtml', ...)` の末尾（`buildPlantumlImgTag` describe の前）に新テスト群を追加:
```ts
    describe('removeWithContent (block context)', function () {
      const BLOCK = { removeWithContent: true };

      it('removes <style> with its content', function () {
        const r = utils.sanitizeRawHtml('<style>body{color:red}</style>', 'gfm', BLOCK);
        assert.strictEqual(r.html, '');
        assert.deepEqual(r.report.removedElements, ['style']);
      });

      it('removes <script> with its content', function () {
        const r = utils.sanitizeRawHtml('<script>alert(1)</script>', 'gfm', BLOCK);
        assert.strictEqual(r.html, '');
        assert.deepEqual(r.report.removedElements, ['script']);
      });

      it('removes <iframe> with its content', function () {
        const r = utils.sanitizeRawHtml('<iframe src="x">fallback</iframe>', 'gfm', BLOCK);
        assert.strictEqual(r.html, '');
        assert.deepEqual(r.report.removedElements, ['iframe']);
      });

      it('removes a <style> embedded in surrounding markup, keeping the rest', function () {
        const r = utils.sanitizeRawHtml('<div>a<style>x{}</style>b</div>', 'gfm', BLOCK);
        assert.strictEqual(r.html, '<div>ab</div>');
        assert.deepEqual(r.report.removedElements, ['style']);
      });

      it('is case-insensitive for the closing tag', function () {
        const r = utils.sanitizeRawHtml('<SCRIPT>x</SCRIPT>', 'gfm', BLOCK);
        assert.strictEqual(r.html, '');
        assert.deepEqual(r.report.removedElements, ['script']);
      });

      it('degrades to removing only the opening tag when no closing tag is present', function () {
        const r = utils.sanitizeRawHtml('<style>x{}', 'gfm', BLOCK);
        assert.strictEqual(r.html, 'x{}');
        assert.deepEqual(r.report.removedElements, ['style']);
      });

      it('keeps the escape set escaped even in block context', function () {
        const r = utils.sanitizeRawHtml('<textarea>x</textarea>', 'gfm', BLOCK);
        assert.strictEqual(r.html, '&lt;textarea>x&lt;/textarea>');
        assert.deepEqual(r.report.removedElements, []);
      });

      it('does not remove <style> in gfm-allow-style mode', function () {
        const r = utils.sanitizeRawHtml('<style>body{}</style>', 'gfm-allow-style', BLOCK);
        assert.strictEqual(r.html, '<style>body{}</style>');
        assert.deepEqual(r.report.removedElements, []);
      });
    });

    describe('inline context (removeWithContent omitted = escape)', function () {
      it('escapes <script> and reports no removal', function () {
        const r = utils.sanitizeRawHtml('<script>', 'gfm');
        assert.strictEqual(r.html, '&lt;script>');
        assert.deepEqual(r.report.removedElements, []);
      });
    });

    describe('attribute stripping report', function () {
      it('reports stripped on* attribute', function () {
        const r = utils.sanitizeRawHtml('<div onclick="x">y</div>', 'gfm');
        assert.strictEqual(r.html, '<div>y</div>');
        assert.deepEqual(r.report.strippedAttributes, ['onclick']);
      });

      it('reports stripped javascript: href', function () {
        const r = utils.sanitizeRawHtml('<a href="javascript:alert(1)">y</a>', 'gfm');
        assert.strictEqual(r.html, '<a>y</a>');
        assert.deepEqual(r.report.strippedAttributes, ['href(javascript:)']);
      });
    });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:unit`
Expected: FAIL（`sanitizeRawHtml` がまだ文字列を返すため `.html`/`.report` が undefined、新テストが落ちる）。

- [ ] **Step 3: 型を追加**

`src/utils.ts` の `export type SanitizeMode = ...;`（現行 814 行付近）の直後に追加:
```ts
export interface SanitizeReport {
  // Tag names of block-level elements removed with their content (one entry per occurrence).
  removedElements: string[];
  // Identifiers of attributes stripped (e.g. 'onclick', 'href(javascript:)'), one per occurrence.
  strippedAttributes: string[];
}

export interface SanitizeOptions {
  // true = block context: remove style/script/iframe with their content.
  // false/omitted = inline context: escape them like the other disallowed tags.
  removeWithContent?: boolean;
}

// Disallowed tags removed with their content (block context only). They render as
// noise or are unsafe in a PDF: <style>/<script> dump text; <iframe> cannot function.
const REMOVE_WITH_CONTENT = new Set(['style', 'script', 'iframe']);
```

- [ ] **Step 4: `stripDangerousAttributes` を「除去属性を返す」形にリファクタ**

`src/utils.ts` の `stripDangerousAttributes`（現行 824 行付近）を次に置換（パース処理は不変、戻り値と dangerous 分岐のみ変更）:
```ts
function stripDangerousAttributes(tag: string): { tag: string; stripped: string[] } {
  const stripped: string[] = [];
  // Skip closing tags and bail out cheaply on malformed input.
  if (tag.length < 2 || tag[1] === '/') {
    return { tag, stripped };
  }

  let nameEnd = 1;
  while (nameEnd < tag.length && /[a-z0-9-]/i.test(tag[nameEnd])) {
    nameEnd++;
  }

  let result = tag.slice(0, nameEnd);
  let i = nameEnd;
  while (i < tag.length) {
    const wsStart = i;
    while (i < tag.length && /\s/.test(tag[i])) {
      i++;
    }
    const ws = tag.slice(wsStart, i);

    if (i >= tag.length) {
      result += ws;
      break;
    }

    if (tag[i] === '/' || tag[i] === '>') {
      result += ws;
      result += tag[i];
      i++;
      continue;
    }

    const attrStart = i;
    while (i < tag.length && !/[\s=/>]/.test(tag[i])) {
      i++;
    }
    const attrName = tag.slice(attrStart, i);

    let afterName = i;
    while (afterName < tag.length && /\s/.test(tag[afterName])) {
      afterName++;
    }

    let attrEnd = afterName;
    let attrValue: string | null = null;
    if (afterName < tag.length && tag[afterName] === '=') {
      let valueStart = afterName + 1;
      while (valueStart < tag.length && /\s/.test(tag[valueStart])) {
        valueStart++;
      }
      if (valueStart < tag.length && (tag[valueStart] === '"' || tag[valueStart] === "'")) {
        const quote = tag[valueStart];
        const close = tag.indexOf(quote, valueStart + 1);
        if (close === -1) {
          attrValue = tag.slice(valueStart + 1);
          attrEnd = tag.length;
        } else {
          attrValue = tag.slice(valueStart + 1, close);
          attrEnd = close + 1;
        }
      } else {
        let valueEnd = valueStart;
        while (valueEnd < tag.length && !/[\s/>]/.test(tag[valueEnd])) {
          valueEnd++;
        }
        attrValue = tag.slice(valueStart, valueEnd);
        attrEnd = valueEnd;
      }
    }

    const lowerName = attrName.toLowerCase();
    const isEventHandler = /^on[a-z]{3}/i.test(lowerName);
    const isJavascriptUrl =
      (lowerName === 'href' || lowerName === 'src') &&
      attrValue !== null &&
      /^\s*javascript:/i.test(attrValue);

    if (!isEventHandler && !isJavascriptUrl) {
      result += ws;
      result += attrName;
      if (attrEnd > afterName) {
        result += tag.slice(i, attrEnd);
      }
    } else {
      // Record what was stripped for the sanitize report.
      stripped.push(isEventHandler ? lowerName : lowerName + '(javascript:)');
    }
    i = attrEnd;
  }
  return { tag: result, stripped };
}
```

- [ ] **Step 5: `sanitizeRawHtml` を `{html, report}`＋`removeWithContent` に置換**

`src/utils.ts` の `sanitizeRawHtml`（現行 956 行付近）を次に置換:
```ts
export function sanitizeRawHtml(
  html: string,
  mode: SanitizeMode,
  options?: SanitizeOptions,
): { html: string; report: SanitizeReport } {
  const report: SanitizeReport = { removedElements: [], strippedAttributes: [] };
  if (mode === 'none' || !html) {
    return { html, report };
  }
  const removeWithContent = options?.removeWithContent === true;
  const disallowed = getDisallowedTags(mode);
  let result = '';
  let index = 0;
  while (index < html.length) {
    // Preserve HTML comments verbatim.
    if (html.startsWith('<!--', index)) {
      const commentEnd = html.indexOf('-->', index + 4);
      if (commentEnd === -1) {
        result += html.slice(index);
        break;
      }
      result += html.slice(index, commentEnd + 3);
      index = commentEnd + 3;
      continue;
    }

    if (html[index] !== '<') {
      result += html[index];
      index++;
      continue;
    }

    const tagEnd = findHtmlTagEnd(html, index + 1);
    if (tagEnd === -1) {
      result += html.slice(index);
      break;
    }

    const tag = html.slice(index, tagEnd + 1);
    const tagName = getTagName(tag);

    if (tagName && disallowed.has(tagName)) {
      if (removeWithContent && REMOVE_WITH_CONTENT.has(tagName)) {
        if (tag[1] === '/') {
          // Stray closing tag of a remove-set element: drop silently.
          index = tagEnd + 1;
          continue;
        }
        // Opening tag: remove through the matching closing tag (inclusive).
        const closeRe = new RegExp('</' + tagName + '\\s*>', 'i');
        const match = closeRe.exec(html.slice(tagEnd + 1));
        if (match) {
          index = tagEnd + 1 + match.index + match[0].length;
        } else {
          // No closing tag in this token: drop just the opening tag (graceful degrade).
          index = tagEnd + 1;
        }
        report.removedElements.push(tagName);
        continue;
      }
      // Escape set, or remove-set in inline context: GFM escape of leading '<'.
      result += '&lt;' + tag.slice(1);
      index = tagEnd + 1;
      continue;
    }

    const stripResult = stripDangerousAttributes(tag);
    result += stripResult.tag;
    for (let s = 0; s < stripResult.stripped.length; s++) {
      report.strippedAttributes.push(stripResult.stripped[s]);
    }
    index = tagEnd + 1;
  }
  return { html: result, report };
}
```

- [ ] **Step 6: テストを実行して通過を確認**

Run: `npm run test:unit`
Expected: PASS（既存＋新規、0 fail）。`npm run check` はこの時点では extension.ts の型エラーで赤のまま（Task 4 で解消・想定どおり）。

- [ ] **Step 7: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts
git commit -m "feat: sanitizeRawHtml returns {html, report} and removes block style/script/iframe with content"
```

---

## Task 2: buildSanitizeSummary / buildSanitizeLogDetail（純粋関数）

**Files:**
- Modify: `src/utils.ts`（末尾付近に2関数を追加）
- Test: `test/unit/utils.test.ts`（新 describe）

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/utils.test.ts` の `describe('sanitizeRawHtml', ...)` の閉じ `});` の後（同じ最上位 `describe('utils', ...)` 内）に追加:
```ts
  describe('buildSanitizeSummary', function () {
    it('lists removed element kinds and notes stripped attributes', function () {
      const summary = utils.buildSanitizeSummary({
        removedElements: ['style', 'script', 'script'],
        strippedAttributes: ['onclick'],
      });
      assert.match(summary, /<style>/);
      assert.match(summary, /<script>/);
      assert.match(summary, /attribute/i);
      assert.match(summary, /See output for details\.$/);
    });

    it('handles removals only (no attributes)', function () {
      const summary = utils.buildSanitizeSummary({ removedElements: ['iframe'], strippedAttributes: [] });
      assert.match(summary, /<iframe>/);
      assert.doesNotMatch(summary, /attribute/i);
    });
  });

  describe('buildSanitizeLogDetail', function () {
    it('includes mode and per-kind counts', function () {
      const detail = utils.buildSanitizeLogDetail({
        removedElements: ['style', 'script', 'script'],
        strippedAttributes: ['onclick', 'href(javascript:)'],
      }, 'gfm');
      assert.match(detail, /mode: gfm/);
      assert.match(detail, /<style>×1/);
      assert.match(detail, /<script>×2/);
      assert.match(detail, /onclick×1/);
      assert.match(detail, /href\(javascript:\)×1/);
    });

    it('adds the gfm-allow-style tip only when <style> was removed', function () {
      const withStyle = utils.buildSanitizeLogDetail({ removedElements: ['style'], strippedAttributes: [] }, 'gfm');
      assert.match(withStyle, /gfm-allow-style/);
      const withoutStyle = utils.buildSanitizeLogDetail({ removedElements: ['script'], strippedAttributes: [] }, 'gfm');
      assert.doesNotMatch(withoutStyle, /gfm-allow-style/);
    });
  });
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run test:unit`
Expected: FAIL（`buildSanitizeSummary`/`buildSanitizeLogDetail` 未定義）。

- [ ] **Step 3: 実装**

`src/utils.ts` の末尾（`sanitizeRawHtml` の後）に追加:
```ts
// Counts occurrences of each string, preserving first-seen order.
function tallyOccurrences(items: string[]): Array<{ name: string; count: number }> {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!counts.has(item)) {
      order.push(item);
    }
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return order.map(function (name) {
    return { name: name, count: counts.get(name) || 0 };
  });
}

// Short, human-facing summary for the warning toast (no counts; kinds only).
export function buildSanitizeSummary(report: SanitizeReport): string {
  const parts: string[] = [];
  const removedKinds = tallyOccurrences(report.removedElements).map(function (e) {
    return '<' + e.name + '>';
  });
  if (removedKinds.length > 0) {
    parts.push('removed ' + removedKinds.join(', '));
  }
  if (report.strippedAttributes.length > 0) {
    parts.push('stripped unsafe attribute(s)');
  }
  return 'Markdown PDF: ' + parts.join('; ') + ' for security. See output for details.';
}

// Detailed line(s) for the output channel, including mode and per-kind counts.
export function buildSanitizeLogDetail(report: SanitizeReport, mode: SanitizeMode): string {
  const segments: string[] = [];
  const removed = tallyOccurrences(report.removedElements).map(function (e) {
    return '<' + e.name + '>×' + e.count;
  });
  const stripped = tallyOccurrences(report.strippedAttributes).map(function (e) {
    return e.name + '×' + e.count;
  });
  if (removed.length > 0) {
    segments.push('removed ' + removed.join(', '));
  }
  if (stripped.length > 0) {
    segments.push('stripped ' + stripped.join(', '));
  }
  const lines: string[] = ['Sanitized raw HTML (mode: ' + mode + '): ' + segments.join('; ') + '.'];
  if (report.removedElements.indexOf('style') !== -1) {
    lines.push('Tip: to keep <style>, set "markdown-pdf.sanitize": "gfm-allow-style".');
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: 通過を確認**

Run: `npm run test:unit`
Expected: PASS（0 fail）。

- [ ] **Step 5: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts
git commit -m "feat: add buildSanitizeSummary/buildSanitizeLogDetail for sanitize notifications"
```

---

## Task 3: markdown-it-sanitize.ts（installSanitizeRules）＋統合テスト

**Files:**
- Create: `src/markdown-it-sanitize.ts`
- Test: `test/unit/markdown-it-sanitize.test.ts`

- [ ] **Step 1: 失敗する統合テストを書く**

`test/unit/markdown-it-sanitize.test.ts` を新規作成:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import markdownIt from 'markdown-it';
import { installSanitizeRules } from '../../src/markdown-it-sanitize';
import type { SanitizeReport } from '../../src/utils';

function render(source: string, mode: 'gfm' | 'gfm-allow-style' | 'none' = 'gfm'): { html: string; report: SanitizeReport } {
  const md = markdownIt({ html: true });
  const report: SanitizeReport = { removedElements: [], strippedAttributes: [] };
  installSanitizeRules(md, mode, report);
  const html = md.render(source);
  return { html, report };
}

describe('installSanitizeRules', function () {
  describe('block-level removal', function () {
    it('removes a block <style> with its content', function () {
      const { html, report } = render('<style>body{color:red}</style>\n');
      assert.doesNotMatch(html, /body\{color:red\}/);
      assert.doesNotMatch(html, /<style/);
      assert.deepEqual(report.removedElements, ['style']);
    });

    it('removes a block <script> with its content', function () {
      const { html, report } = render('<script>alert(1)</script>\n');
      assert.doesNotMatch(html, /alert\(1\)/);
      assert.ok(report.removedElements.indexOf('script') !== -1);
    });

    it('removes a block <iframe>', function () {
      const { html, report } = render('<iframe src="x"></iframe>\n');
      assert.doesNotMatch(html, /<iframe/);
      assert.ok(report.removedElements.indexOf('iframe') !== -1);
    });
  });

  describe('inline raw HTML stays escaped (not removed)', function () {
    it('escapes inline <script> and keeps its text content', function () {
      const { html, report } = render('foo <script>alert(1)</script> bar');
      // No executable script tag in the output.
      assert.doesNotMatch(html, /<script>/);
      // The text content survives as visible text, and the tag is escaped.
      assert.match(html, /alert\(1\)/);
      assert.match(html, /&lt;script/);
      assert.deepEqual(report.removedElements, []);
    });

    it('escapes inline <style>', function () {
      const { html, report } = render('foo <style>body{}</style> bar');
      assert.match(html, /&lt;style/);
      assert.match(html, /body\{\}/);
      assert.deepEqual(report.removedElements, []);
    });

    it('escapes inline <iframe>', function () {
      const { html, report } = render('foo <iframe>fallback</iframe> bar');
      assert.match(html, /&lt;iframe/);
      assert.match(html, /fallback/);
      assert.deepEqual(report.removedElements, []);
    });
  });

  describe('mode interactions', function () {
    it('keeps block <style> in gfm-allow-style mode', function () {
      const { html, report } = render('<style>body{}</style>\n', 'gfm-allow-style');
      assert.match(html, /<style>body\{\}<\/style>/);
      assert.deepEqual(report.removedElements, []);
    });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run test:unit`
Expected: FAIL（`src/markdown-it-sanitize` 未作成で import 解決失敗）。

- [ ] **Step 3: 実装**

`src/markdown-it-sanitize.ts` を新規作成:
```ts
// Installs html_block / html_inline renderer rules that sanitize raw HTML via
// utils.sanitizeRawHtml, accumulating a removal/strip report. Kept free of any
// 'vscode' import so it stays unit-testable with markdown-it under tsx.
import type MarkdownIt from 'markdown-it';
import { sanitizeRawHtml, SanitizeMode, SanitizeReport } from './utils';

export function installSanitizeRules(
  md: MarkdownIt,
  mode: SanitizeMode,
  report: SanitizeReport,
  transformBlock?: (html: string) => string,
): void {
  function collect(content: string, removeWithContent: boolean): string {
    const result = sanitizeRawHtml(content, mode, { removeWithContent: removeWithContent });
    for (let i = 0; i < result.report.removedElements.length; i++) {
      report.removedElements.push(result.report.removedElements[i]);
    }
    for (let i = 0; i < result.report.strippedAttributes.length; i++) {
      report.strippedAttributes.push(result.report.strippedAttributes[i]);
    }
    return result.html;
  }

  md.renderer.rules.html_block = function (tokens, idx) {
    // Block context: remove style/script/iframe with their content.
    const html = collect(tokens[idx].content, true);
    return transformBlock ? transformBlock(html) : html;
  };

  md.renderer.rules.html_inline = function (tokens, idx) {
    // Inline context: open/content/close are separate tokens, so only escape.
    return collect(tokens[idx].content, false);
  };
}
```

- [ ] **Step 4: 通過を確認**

Run: `npm run test:unit`
Expected: PASS（0 fail）。`npm run check` はまだ extension.ts のため赤（Task 4 で解消）。

- [ ] **Step 5: コミット**

```bash
git add src/markdown-it-sanitize.ts test/unit/markdown-it-sanitize.test.ts
git commit -m "feat: add installSanitizeRules (block removal, inline escape) with markdown-it integration tests"
```

---

## Task 4: extension.ts 配線（集約・戻り値変更・通知）

**Files:**
- Modify: `src/extension.ts`（import 追加、`convertMarkdownToHtml`、`markdownPdf`、`markdownPdfOnSave`、`notifySanitize` 追加）

> `extension.ts` は vscode 依存でユニットテスト対象外。検証は `npm run check`＋`npm run build`＋手動。本タスクで Task 1 由来の型エラーが解消し `npm run check` がグリーンに戻る。

- [ ] **Step 1: installSanitizeRules を import**

`src/extension.ts` の `import * as logger from './logger';`（要素②b で追加済み）の直後に追加:
```ts
import { installSanitizeRules } from './markdown-it-sanitize';
```

- [ ] **Step 2: convertMarkdownToHtml の html_block/html_inline 規則を installSanitizeRules に置換し、戻り値を {html, report} に**

`src/extension.ts` の `convertMarkdownToHtml` 内、現行の sanitize 規則ブロック（`const sanitizeMode = ...;` の行から html_inline 規則の閉じまで、現行 222〜231 行付近）を次に置換:

変更前:
```ts
      const sanitizeMode = (vscode.workspace.getConfiguration('markdown-pdf')['sanitize'] || 'gfm') as utils.SanitizeMode;

      md.renderer.rules.html_block = function (tokens, idx) {
        const sanitized = utils.sanitizeRawHtml(tokens[idx].content, sanitizeMode);
        return type !== 'html' ? utils.transformHtmlBlock(sanitized, filename) : sanitized;
      };

      md.renderer.rules.html_inline = function (tokens, idx) {
        return utils.sanitizeRawHtml(tokens[idx].content, sanitizeMode);
      };
```
変更後:
```ts
      const sanitizeMode = (vscode.workspace.getConfiguration('markdown-pdf')['sanitize'] || 'gfm') as utils.SanitizeMode;
      const sanitizeReport: utils.SanitizeReport = { removedElements: [], strippedAttributes: [] };
      installSanitizeRules(
        md,
        sanitizeMode,
        sanitizeReport,
        type !== 'html' ? function (h: string) { return utils.transformHtmlBlock(h, filename); } : undefined,
      );
```

次に、`convertMarkdownToHtml` の戻り値を変更。現行（337〜346 行付近）:
```ts
      const html = md.render(matterParts.content);

      // Show warning for missing include files
      const includeErrorRe = /INCLUDE ERROR: (.+?)(?=<\/h1>|<\/p>|\n)/g;
      let match;
      while ((match = includeErrorRe.exec(html)) !== null) {
        vscode.window.showWarningMessage(match[1]);
      }

      return html;
```
を次に:
```ts
      const html = md.render(matterParts.content);

      // Show warning for missing include files
      const includeErrorRe = /INCLUDE ERROR: (.+?)(?=<\/h1>|<\/p>|\n)/g;
      let match;
      while ((match = includeErrorRe.exec(html)) !== null) {
        vscode.window.showWarningMessage(match[1]);
      }

      return { html: html, report: sanitizeReport };
```

`convertMarkdownToHtml` のシグネチャ（現行 195 行付近）の戻り値型を変更:
変更前:
```ts
function convertMarkdownToHtml(filename: string, type: string, text: string): string | undefined {
```
変更後:
```ts
function convertMarkdownToHtml(filename: string, type: string, text: string): { html: string; report: utils.SanitizeReport } | undefined {
```
（`catch` 節は従来どおり `showErrorMessage(...)` 後に暗黙 `undefined` を返す。変更不要。）

- [ ] **Step 3: notifySanitize ヘルパーを追加**

`src/extension.ts` の `showErrorMessage` 関数（要素②b の `SHOW_OUTPUT_ACTION` 定義あり）の直後に追加:
```ts
function notifySanitize(report: utils.SanitizeReport, mode: utils.SanitizeMode, isOnSave: boolean): void {
  if (report.removedElements.length === 0 && report.strippedAttributes.length === 0) {
    return;
  }
  // Always record details to the output channel (manual and on-save).
  logger.logWarn(utils.buildSanitizeLogDetail(report, mode));
  // Toast only on explicit/manual export to avoid spamming on convertOnSave.
  if (!isOnSave) {
    vscode.window.showWarningMessage(utils.buildSanitizeSummary(report), SHOW_OUTPUT_ACTION).then(function (selection) {
      if (selection === SHOW_OUTPUT_ACTION) {
        logger.showLog();
      }
    });
  }
}
```

- [ ] **Step 4: markdownPdf に isOnSave とループ後通知を追加**

`src/extension.ts` の `markdownPdf` シグネチャ（現行 86 行付近）:
変更前:
```ts
async function markdownPdf(option_type: string): Promise<void> {
```
変更後:
```ts
async function markdownPdf(option_type: string, isOnSave = false): Promise<void> {
```

`markdownPdf` 内の変換ループ（現行 124〜142 行付近）を次に置換。

変更前:
```ts
    // convert and export markdown to pdf, html, png, jpeg
    if (types && Array.isArray(types) && types.length > 0) {
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        if (types_format.indexOf(type) >= 0) {
          filename = mdfilename.replace(ext, '.' + type);
          const text = editor.document.getText();
          const content = convertMarkdownToHtml(mdfilename, type, text);
          const html = makeHtml(content, uri);
          await exportPdf(html, filename, type, uri);
        } else {
          showErrorMessage('markdownPdf().2 Supported formats: html, pdf, png, jpeg.');
          return;
        }
      }
    } else {
      showErrorMessage('markdownPdf().3 Supported formats: html, pdf, png, jpeg.');
      return;
    }
```
変更後:
```ts
    // convert and export markdown to pdf, html, png, jpeg
    if (types && Array.isArray(types) && types.length > 0) {
      const sanitizeMode = (vscode.workspace.getConfiguration('markdown-pdf')['sanitize'] || 'gfm') as utils.SanitizeMode;
      let sanitizeReport: utils.SanitizeReport = { removedElements: [], strippedAttributes: [] };
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        if (types_format.indexOf(type) >= 0) {
          filename = mdfilename.replace(ext, '.' + type);
          const text = editor.document.getText();
          const converted = convertMarkdownToHtml(mdfilename, type, text);
          if (converted) {
            // Report is identical across export types (same source + mode); keep the latest.
            sanitizeReport = converted.report;
          }
          const html = makeHtml(converted ? converted.html : undefined, uri);
          await exportPdf(html, filename, type, uri);
        } else {
          showErrorMessage('markdownPdf().2 Supported formats: html, pdf, png, jpeg.');
          return;
        }
      }
      // One notification per invocation, after all export types are processed.
      notifySanitize(sanitizeReport, sanitizeMode, isOnSave);
    } else {
      showErrorMessage('markdownPdf().3 Supported formats: html, pdf, png, jpeg.');
      return;
    }
```

- [ ] **Step 5: markdownPdfOnSave で isOnSave=true を渡す**

`src/extension.ts` の `markdownPdfOnSave`（現行 155〜157 行付近）:
変更前:
```ts
    if (!isMarkdownPdfOnSaveExclude()) {
      markdownPdf('settings');
    }
```
変更後:
```ts
    if (!isMarkdownPdfOnSaveExclude()) {
      markdownPdf('settings', true);
    }
```

- [ ] **Step 6: 型チェックとバンドル**

Run: `npm run check && npm run build`
Expected: 双方エラーなし（Task 1 由来の型エラーが解消し、`dist/extension.js` 生成）。

- [ ] **Step 7: ユニットテスト（回帰）**

Run: `npm run test:unit`（`node --test` は失敗時に非0終了するので、**終了コード**でゲートする。要約だけ見たい場合は別途 `npm run test:unit 2>&1 | tail -5` を使う）
Expected: 0 fail。

- [ ] **Step 8: コミット**

```bash
git add src/extension.ts
git commit -m "feat: aggregate sanitize report and notify once per export (toast on manual, channel on save)"
```

---

## Task 5: 最終検証（全テスト＋ビルド＋手動）

**Files:** （コード変更なし。検証のみ。）

- [ ] **Step 1: ユニット全実行**

Run: `npm run test:unit`（`node --test` は失敗時に非0終了するので、**終了コード**でゲートする。要約だけ見たい場合は別途 `npm run test:unit 2>&1 | tail -5` を使う）
Expected: 全 PASS（0 fail）。utils / markdown-it-sanitize / 既存全て。

- [ ] **Step 2: 型チェック＋バンドル**

Run: `npm run check && npm run build`
Expected: 双方エラーなし。

- [ ] **Step 3: 手動検証（dev host）**

worktree を開いて F5。「Markdown PDF」出力チャネルは各ケース前に**閉じておく**（押下で開くことを検証するため）。デモ .md を用意（行頭に `<style>body{color:red}</style>`、`<script>alert(1)</script>`、本文に `<a href="x" onclick="y">link</a>` を含む）。

- **手動エクスポート（pdf）**: PDF/プレビューに CSS/JS がリテラル表示されない（除去済）。手動なので**警告トーストが出て「Show Output」**を含む。押下でチャネルに `removed <style>×1, <script>×1; stripped onclick×1` 等＋`gfm-allow-style` ヒント。
- **convertOnSave**（設定 `markdown-pdf.convertOnSave: true` で同 .md を保存）: **トーストなし**。チャネルには同等の `logWarn` 記録あり。
- **`sanitize: gfm-allow-style`**: `<style>` が保持・適用（除去通知に style は出ない）。`<script>` は除去・通知される。
- **`all` エクスポート**: 通知は**1回だけ**。
- 検証後、いじった設定（`convertOnSave` 等）を元に戻す。

> 手動検証は人手。サブエージェント実行時は Step 1〜2 を実施し、Step 3 はチェックリストとして残しユーザーに依頼する。

---

## Self-Review チェック結果

- **Spec coverage**: ①除去（Task 1: `removeWithContent` 除去ロジック）／戻り値レポート（Task 1）／属性レポート（Task 1 `stripDangerousAttributes`）／通知文言（Task 2 builders）／配線抽出と block-inline 分岐（Task 3 `installSanitizeRules`＋統合テスト）／集約・1回通知・isOnSave 出し分け（Task 4）／テスト戦略（各 Task のユニット＋統合、Task 5 手動）を網羅。inline がエスケープ維持される点は Task 3 統合テストで実体検証。
- **Placeholder scan**: TBD/TODO なし。各コードステップは完全なコード。
- **Type consistency**: `SanitizeReport{removedElements,strippedAttributes}` / `SanitizeOptions{removeWithContent}` / `sanitizeRawHtml(html,mode,options): {html,report}` / `installSanitizeRules(md,mode,report,transformBlock?)` / `buildSanitizeSummary(report)` / `buildSanitizeLogDetail(report,mode)` / `notifySanitize(report,mode,isOnSave)` / `convertMarkdownToHtml(...): {html,report}|undefined` を全 Task で一貫使用。`SHOW_OUTPUT_ACTION` は要素②b 既存定数を再利用。
