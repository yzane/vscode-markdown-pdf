# Raw HTML サニタイズ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **作業ブランチ:** `feature/sanitize-raw-html`（worktree: `.worktrees/sanitize-raw-html/`）。他のブランチに切り替えないこと。

**Goal:** Markdown 本文内のRaw HTML に対し GFM 準拠のサニタイズを適用し、`<script>` / `<iframe>` 等による XSS リスクを既定で緩和する。

**Architecture:** `markdown-it` の `html_block` / `html_inline` レンダラを差し替え、ユーザー設定 `markdown-pdf.sanitize`（`"gfm"` / `"gfm-allow-style"` / `"none"`、既定 `"gfm"`）に応じて危険タグの `<` を `&lt;` に置換、`on*` 属性と `javascript:` URL を含む属性を削除する。サニタイズ対象はユーザー由来 HTML のみで、`markdown-pdf.styles` の外部 CSS・拡張の自動生成 HTML・テンプレートは射程外。

**Tech Stack:** TypeScript, markdown-it, node:test (tsx), esbuild

**参考仕様:**
- 設計仕様: `docs/superpowers/specs/20260418-01-sanitize-raw-html-design.md`
- [GFM Spec - 6.11 Disallowed Raw HTML (extension)](https://github.github.com/gfm/#disallowed-raw-html-extension-)

**実装方針の確定事項（設計仕様の「未確定事項」を事前解決）:**
- **スキャナ実装**: 既存の `transformHtmlBlock()` と同じ手書きスキャナ方式を踏襲し、`src/utils.ts` 内に `sanitizeRawHtml()` を実装する（`findHtmlTagEnd()` 等のヘルパを共有）
- **禁止タグの扱い**: GFM 仕様に従い、タグの先頭 `<` を `&lt;` に置換する（内容は可視テキストとして残す）
- **`on*` 属性**: 属性名=値ごと削除
- **`javascript:` URL**: `href` / `src` 属性を属性名=値ごと削除

---

## ファイル構成

**新規・変更対象:**

- `package.json` — `markdown-pdf.sanitize` 設定項目を追加
- `src/utils.ts` — `SanitizeMode` 型、`getDisallowedTags()`, `sanitizeRawHtml()` とその内部ヘルパを追加
- `src/extension.ts` — `convertMarkdownToHtml()` の `html_block` / `html_inline` レンダラ差し替えに `sanitizeRawHtml()` を組み込む
- `test/unit/utils.test.ts` — `getDisallowedTags()` / `sanitizeRawHtml()` のユニットテスト追加
- `README.md` / `README.ja.md` — 設定説明、禁止タグ一覧、移行先、導入理由
- `CHANGELOG.md` — Breaking Changes 追記

---

## Task 1: `markdown-pdf.sanitize` 設定項目の追加

**Files:**
- Modify: `package.json`（`markdown-pdf.styles` の直前あたりに追加）

- [ ] **Step 1: `package.json` に設定項目を追加**

`"markdown-pdf.styles"` のエントリ（`contributes.configuration.properties` 内）の**直前**に以下のブロックを挿入する。

```json
        "markdown-pdf.sanitize": {
          "type": "string",
          "enum": ["gfm", "gfm-allow-style", "none"],
          "default": "gfm",
          "description": "Sanitize raw HTML in Markdown to mitigate XSS-like risks. 'gfm' removes dangerous tags (script, iframe, style, etc.) per GitHub Flavored Markdown. 'gfm-allow-style' keeps <style> for PDF layout customization (CSS can still exfiltrate data via url()/@import — use only with trusted content). 'none' disables sanitization (legacy behavior, not recommended)."
        },
```

- [ ] **Step 2: JSON としてパース可能か確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: コミット**

```bash
git add package.json
git commit -m "feat(sanitize): add markdown-pdf.sanitize configuration"
```

---

## Task 2: `SanitizeMode` 型と `getDisallowedTags()` の追加（TDD）

**Files:**
- Modify: `src/utils.ts`（ファイル末尾に追記）
- Modify: `test/unit/utils.test.ts`（`describe('utils', ...)` 内のどこか、既存の他機能テストに続く位置）

- [ ] **Step 1: 失敗するテストを追加**

`test/unit/utils.test.ts` の `describe('utils', function () { ... })` の中、既存の最後のブロックのあとに以下を追加する（ブロックの入れ子位置: `describe('utils', ...)` の直下）。

```typescript
  describe('getDisallowedTags', function () {
    it('should return GFM disallowed tag set for "gfm" mode', function () {
      const tags = utils.getDisallowedTags('gfm');
      const expected = ['title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'script', 'plaintext'];
      for (const tag of expected) {
        assert.ok(tags.has(tag), `expected tag "${tag}" to be disallowed in gfm mode`);
      }
      assert.strictEqual(tags.size, expected.length);
    });

    it('should exclude <style> in "gfm-allow-style" mode', function () {
      const tags = utils.getDisallowedTags('gfm-allow-style');
      assert.strictEqual(tags.has('style'), false);
      assert.ok(tags.has('script'));
      assert.ok(tags.has('iframe'));
    });

    it('should return empty set for "none" mode', function () {
      const tags = utils.getDisallowedTags('none');
      assert.strictEqual(tags.size, 0);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: `getDisallowedTags` テストが "utils.getDisallowedTags is not a function" 等で失敗する

- [ ] **Step 3: 実装を追加**

`src/utils.ts` のファイル末尾に以下を追加する。

```typescript
// Sanitize mode for raw HTML in Markdown. 'gfm' removes dangerous tags per
// GitHub Flavored Markdown; 'gfm-allow-style' keeps <style>; 'none' disables.
export type SanitizeMode = 'gfm' | 'gfm-allow-style' | 'none';

/**
 * Returns the set of lowercase tag names to strip for the given sanitize mode.
 * See GFM 6.11 Disallowed Raw HTML extension:
 * https://github.github.com/gfm/#disallowed-raw-html-extension-
 */
export function getDisallowedTags(mode: SanitizeMode): Set<string> {
  if (mode === 'none') {
    return new Set();
  }
  const tags = new Set(['title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'script', 'plaintext']);
  if (mode === 'gfm-allow-style') {
    tags.delete('style');
  }
  return tags;
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストパス（追加した 3 件含む）

- [ ] **Step 5: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts
git commit -m "feat(sanitize): add SanitizeMode type and getDisallowedTags()"
```

---

## Task 3: `sanitizeRawHtml()` — 禁止タグのエスケープ（TDD）

GFM 仕様に従い、禁止タグの先頭 `<` を `&lt;` に置換する。タグ名は大文字小文字を問わずマッチする。

**Files:**
- Modify: `src/utils.ts`（Task 2 で追加した箇所の直後）
- Modify: `test/unit/utils.test.ts`（Task 2 の `describe('getDisallowedTags', ...)` の直後）

- [ ] **Step 1: 失敗するテストを追加**

```typescript
  describe('sanitizeRawHtml', function () {
    describe('disallowed tags (gfm mode)', function () {
      it('should escape opening < of <script> tag', function () {
        const result = utils.sanitizeRawHtml('<script>alert(1)</script>', 'gfm');
        assert.strictEqual(result, '&lt;script>alert(1)&lt;/script>');
      });

      it('should escape <iframe>', function () {
        const result = utils.sanitizeRawHtml('<iframe src="a"></iframe>', 'gfm');
        assert.strictEqual(result, '&lt;iframe src="a">&lt;/iframe>');
      });

      it('should escape <style> in gfm mode', function () {
        const result = utils.sanitizeRawHtml('<style>body{}</style>', 'gfm');
        assert.strictEqual(result, '&lt;style>body{}&lt;/style>');
      });

      it('should keep <style> in gfm-allow-style mode', function () {
        const result = utils.sanitizeRawHtml('<style>body{}</style>', 'gfm-allow-style');
        assert.strictEqual(result, '<style>body{}</style>');
      });

      it('should escape <textarea>, <title>, <xmp>, <noembed>, <noframes>, <plaintext>', function () {
        const tags = ['textarea', 'title', 'xmp', 'noembed', 'noframes', 'plaintext'];
        for (const tag of tags) {
          const input = `<${tag}>x</${tag}>`;
          const expected = `&lt;${tag}>x&lt;/${tag}>`;
          assert.strictEqual(utils.sanitizeRawHtml(input, 'gfm'), expected, `tag: ${tag}`);
        }
      });

      it('should be case-insensitive', function () {
        const result = utils.sanitizeRawHtml('<SCRIPT>x</SCRIPT>', 'gfm');
        assert.strictEqual(result, '&lt;SCRIPT>x&lt;/SCRIPT>');
      });

      it('should leave normal tags untouched', function () {
        const result = utils.sanitizeRawHtml('<div class="note">text</div>', 'gfm');
        assert.strictEqual(result, '<div class="note">text</div>');
      });

      it('should leave <b>, <i>, <a> etc untouched', function () {
        const result = utils.sanitizeRawHtml('<b>bold</b> <i>italic</i> <a href="x">link</a>', 'gfm');
        assert.strictEqual(result, '<b>bold</b> <i>italic</i> <a href="x">link</a>');
      });

      it('should pass through everything in none mode', function () {
        const input = '<script>alert(1)</script><div onclick="x">y</div>';
        assert.strictEqual(utils.sanitizeRawHtml(input, 'none'), input);
      });

      it('should handle empty string', function () {
        assert.strictEqual(utils.sanitizeRawHtml('', 'gfm'), '');
      });

      it('should preserve HTML comments', function () {
        const input = '<!-- <script>not a tag</script> -->';
        assert.strictEqual(utils.sanitizeRawHtml(input, 'gfm'), input);
      });

      it('should handle text without any tags', function () {
        assert.strictEqual(utils.sanitizeRawHtml('plain text', 'gfm'), 'plain text');
      });
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: `sanitizeRawHtml` テスト群が "utils.sanitizeRawHtml is not a function" で失敗

- [ ] **Step 3: `sanitizeRawHtml()` を実装**

`src/utils.ts` の `getDisallowedTags` の直後に以下を追加する。既存の `findHtmlTagEnd`, `getTagName`, `isOpeningTag` を内部で再利用する（それらは同ファイル下部で既に定義済み）。

```typescript
/**
 * Sanitizes raw HTML per GFM's disallowed raw HTML extension.
 * - Escapes the leading '<' of disallowed tags to '&lt;' (both opening and closing forms)
 * - Removes on* event handler attributes from non-disallowed tags
 * - Removes href/src attributes whose value starts with 'javascript:'
 *
 * Returns the input unchanged when mode is 'none' or input is empty.
 * Operates on the raw HTML string only; does not parse CSS or attribute content
 * beyond what is required for the rules above.
 */
export function sanitizeRawHtml(html: string, mode: SanitizeMode): string {
  if (mode === 'none' || !html) {
    return html;
  }
  const disallowed = getDisallowedTags(mode);
  let result = '';
  let index = 0;
  while (index < html.length) {
    // Preserve HTML comments verbatim.
    if (html.startsWith('<!--', index)) {
      const commentEnd = html.indexOf('-->', index + 4);
      if (commentEnd === -1) {
        return result + html.slice(index);
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
      return result + html.slice(index);
    }

    const tag = html.slice(index, tagEnd + 1);
    const tagName = getTagName(tag);
    if (tagName && disallowed.has(tagName)) {
      // GFM rule: replace leading '<' with '&lt;'. Preserves tag content so the
      // user still sees what was in the source as visible text.
      result += '&lt;' + tag.slice(1);
    } else {
      result += tag;
    }
    index = tagEnd + 1;
  }
  return result;
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts
git commit -m "feat(sanitize): escape disallowed GFM tags in sanitizeRawHtml"
```

---

## Task 4: `sanitizeRawHtml()` — `on*` 属性の削除（TDD）

禁止タグ以外に対し、`on*` （`onclick` などイベントハンドラ）属性を削除する。

**Files:**
- Modify: `src/utils.ts`
- Modify: `test/unit/utils.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

Task 3 で追加した `describe('disallowed tags (gfm mode)', ...)` の直後（`describe('sanitizeRawHtml', ...)` の中）に以下を追加。

```typescript
    describe('on* event attributes', function () {
      it('should strip onclick attribute (double-quoted)', function () {
        const result = utils.sanitizeRawHtml('<div onclick="alert(1)">x</div>', 'gfm');
        assert.strictEqual(result, '<div>x</div>');
      });

      it('should strip onload attribute (single-quoted)', function () {
        const result = utils.sanitizeRawHtml("<body onload='x()'>y</body>", 'gfm');
        assert.strictEqual(result, '<body>y</body>');
      });

      it('should strip unquoted on* attribute', function () {
        const result = utils.sanitizeRawHtml('<div onclick=foo()>x</div>', 'gfm');
        assert.strictEqual(result, '<div>x</div>');
      });

      it('should strip on* without value', function () {
        const result = utils.sanitizeRawHtml('<div onclick>x</div>', 'gfm');
        assert.strictEqual(result, '<div>x</div>');
      });

      it('should preserve other attributes when stripping on*', function () {
        const result = utils.sanitizeRawHtml('<a href="x" onclick="y" class="z">t</a>', 'gfm');
        assert.strictEqual(result, '<a href="x" class="z">t</a>');
      });

      it('should be case-insensitive for attribute name', function () {
        const result = utils.sanitizeRawHtml('<div ONCLICK="x">y</div>', 'gfm');
        assert.strictEqual(result, '<div>y</div>');
      });

      it('should not treat "one" or "only" as on* attribute', function () {
        const result = utils.sanitizeRawHtml('<div one="1" only="2">x</div>', 'gfm');
        assert.strictEqual(result, '<div one="1" only="2">x</div>');
      });
    });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:unit`
Expected: 新規追加テストが失敗

- [ ] **Step 3: 属性スキャン関数 `stripDangerousAttributes()` を追加**

`src/utils.ts` の `sanitizeRawHtml()` の直前に以下を追加する。

```typescript
/**
 * Removes dangerous attributes from a single HTML opening/closing tag string.
 * - on* event handlers (onclick, onload, etc.), case-insensitive
 * - href/src whose value begins with 'javascript:' (ignoring leading whitespace), case-insensitive
 *
 * The input `tag` must be the full tag including '<' and '>'. Closing tags
 * ('</tagname>') are returned unchanged. Comments are not handled here.
 */
function stripDangerousAttributes(tag: string): string {
  // Skip closing tags and bail out cheaply on malformed input.
  if (tag.length < 2 || tag[1] === '/') {
    return tag;
  }

  // Find where the tag name ends (first whitespace or '>' / '/').
  let nameEnd = 1;
  while (nameEnd < tag.length && /[a-z0-9-]/i.test(tag[nameEnd])) {
    nameEnd++;
  }

  let result = tag.slice(0, nameEnd);
  let i = nameEnd;
  while (i < tag.length) {
    // Pass through whitespace and the trailing '>' / '/>'.
    if (/\s/.test(tag[i]) || tag[i] === '/' || tag[i] === '>') {
      result += tag[i];
      i++;
      continue;
    }

    // Parse attribute name.
    const attrStart = i;
    while (i < tag.length && !/[\s=/>]/.test(tag[i])) {
      i++;
    }
    const attrName = tag.slice(attrStart, i);

    // Skip whitespace after attribute name.
    let afterName = i;
    while (afterName < tag.length && /\s/.test(tag[afterName])) {
      afterName++;
    }

    // Parse optional value.
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
          // Malformed: consume rest of tag.
          attrValue = tag.slice(valueStart + 1);
          attrEnd = tag.length;
        } else {
          attrValue = tag.slice(valueStart + 1, close);
          attrEnd = close + 1;
        }
      } else {
        // Unquoted value: read until whitespace, '/', or '>'.
        let valueEnd = valueStart;
        while (valueEnd < tag.length && !/[\s/>]/.test(tag[valueEnd])) {
          valueEnd++;
        }
        attrValue = tag.slice(valueStart, valueEnd);
        attrEnd = valueEnd;
      }
    }

    const lowerName = attrName.toLowerCase();
    const dangerous =
      /^on/.test(lowerName) && lowerName.length > 2 ||
      ((lowerName === 'href' || lowerName === 'src') &&
        attrValue !== null &&
        /^\s*javascript:/i.test(attrValue));

    if (!dangerous) {
      result += attrName;
      if (attrEnd > afterName) {
        // Include the '=' and value section verbatim.
        result += tag.slice(i, attrEnd);
      }
    }
    i = attrEnd;
  }
  return result;
}
```

- [ ] **Step 4: `sanitizeRawHtml()` から `stripDangerousAttributes()` を呼び出す**

Task 3 で書いた `sanitizeRawHtml()` 内の以下の行を:

```typescript
    } else {
      result += tag;
    }
```

次のように書き換える:

```typescript
    } else {
      result += stripDangerousAttributes(tag);
    }
```

- [ ] **Step 5: 全テストがパスすることを確認**

Run: `npm run test:unit`
Expected: 全テストパス（Task 3/4 で追加したもの含む）

- [ ] **Step 6: コミット**

```bash
git add src/utils.ts test/unit/utils.test.ts
git commit -m "feat(sanitize): strip on* event handler attributes"
```

---

## Task 5: `sanitizeRawHtml()` — `javascript:` URL の削除（TDD）

`stripDangerousAttributes()` は Task 4 で既に `href`/`src` + `javascript:` 対応も実装済み。ここではテストを追加して挙動を固定する。

**Files:**
- Modify: `test/unit/utils.test.ts`

- [ ] **Step 1: テスト追加**

`describe('on* event attributes', ...)` の直後（`describe('sanitizeRawHtml', ...)` 内）に以下を追加。

```typescript
    describe('javascript: URLs', function () {
      it('should strip href="javascript:..." on <a>', function () {
        const result = utils.sanitizeRawHtml('<a href="javascript:alert(1)">x</a>', 'gfm');
        assert.strictEqual(result, '<a>x</a>');
      });

      it('should strip src="javascript:..." on <img>', function () {
        const result = utils.sanitizeRawHtml('<img src="javascript:alert(1)">', 'gfm');
        assert.strictEqual(result, '<img>');
      });

      it('should tolerate leading whitespace before javascript:', function () {
        const result = utils.sanitizeRawHtml('<a href=" javascript:x">y</a>', 'gfm');
        assert.strictEqual(result, '<a>y</a>');
      });

      it('should be case-insensitive for javascript: scheme', function () {
        const result = utils.sanitizeRawHtml('<a href="JavaScript:x">y</a>', 'gfm');
        assert.strictEqual(result, '<a>y</a>');
      });

      it('should preserve normal href', function () {
        const input = '<a href="https://example.com">x</a>';
        assert.strictEqual(utils.sanitizeRawHtml(input, 'gfm'), input);
      });

      it('should preserve mailto and relative URLs', function () {
        const input = '<a href="mailto:a@b.c">x</a><a href="./page">y</a>';
        assert.strictEqual(utils.sanitizeRawHtml(input, 'gfm'), input);
      });

      it('should not strip javascript: on non-href/src attributes', function () {
        const input = '<div data-note="javascript:foo">x</div>';
        assert.strictEqual(utils.sanitizeRawHtml(input, 'gfm'), input);
      });
    });
```

- [ ] **Step 2: テストがパスすることを確認**

Run: `npm run test:unit`
Expected: 全テスト（新規含む）がパス

- [ ] **Step 3: コミット**

```bash
git add test/unit/utils.test.ts
git commit -m "test(sanitize): cover javascript: URL stripping"
```

---

## Task 6: `extension.ts` のレンダラ差し替え

**Files:**
- Modify: `src/extension.ts`（`convertMarkdownToHtml()` 内、既存の `html_block` 差し替え付近）

- [ ] **Step 1: 既存の該当箇所を確認**

Run: `grep -n "html_block\|md.renderer.rules" src/extension.ts`
Expected: `html_block` レンダラ差し替えの行（概ね 198 行目付近）が見える。変更前コードは次のような形のはず:

```typescript
      if (type !== 'html') {
        md.renderer.rules.html_block = function (tokens, idx) {
          return utils.transformHtmlBlock(tokens[idx].content, filename);
        };
      }
```

- [ ] **Step 2: サニタイズモードを読み込み、`html_block` / `html_inline` レンダラを差し替え**

`src/extension.ts` の上記ブロック全体を、以下で置き換える。

```typescript
      const sanitizeMode = (vscode.workspace.getConfiguration('markdown-pdf')['sanitize'] || 'gfm') as utils.SanitizeMode;

      md.renderer.rules.html_block = function (tokens, idx) {
        const sanitized = utils.sanitizeRawHtml(tokens[idx].content, sanitizeMode);
        return type !== 'html' ? utils.transformHtmlBlock(sanitized, filename) : sanitized;
      };

      md.renderer.rules.html_inline = function (tokens, idx) {
        return utils.sanitizeRawHtml(tokens[idx].content, sanitizeMode);
      };
```

- [ ] **Step 3: TypeScript コンパイル確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: ユニットテスト全通過確認**

Run: `npm run test:unit`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/extension.ts
git commit -m "feat(sanitize): apply sanitizer in html_block/html_inline renderers"
```

---

## Task 7: README.md / README.ja.md 更新

### Task 7.1: README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 設定項目一覧への追加**

`README.md` 内の設定項目テーブル（`markdown-pdf.styles` が列挙されている箇所）を検索し、同じ形式で `markdown-pdf.sanitize` を追加する。

Run: `grep -n "markdown-pdf.styles" README.md` で該当行を特定する。

項目例:

```markdown
| markdown-pdf.sanitize | Sanitization mode for raw HTML in Markdown: `"gfm"` (default, GFM-compliant), `"gfm-allow-style"` (keeps `<style>`), `"none"` (legacy, disables sanitization) | "gfm" |
```

（※ 既存テーブルの列構成に合わせて列数・区切りを調整する）

- [ ] **Step 2: 新セクション「Raw HTML Sanitization」を追加**

`README.md` の設定説明セクションの末尾、もしくは Features 直後あたり（README の既存構成に合わせる）に以下の内容を英語で記載する。

セクション内容:

````markdown
## Raw HTML Sanitization

### Why sanitization?

Earlier versions of this extension passed all raw HTML in Markdown through to the renderer without validation. Tags such as `<script>` and `<iframe>` could therefore execute during preview or PDF rendering, creating XSS-like risk when opening untrusted Markdown files ([#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)).

Starting from this release, raw HTML is sanitized by default per the [GitHub Flavored Markdown Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-).

### Modes

Controlled by `markdown-pdf.sanitize`:

| Mode | Behavior |
| --- | --- |
| `"gfm"` (default) | Strip GFM's disallowed tags and dangerous attributes. Recommended for everyone, including users who may open Markdown files authored by others. |
| `"gfm-allow-style"` | Same as `"gfm"` but keeps `<style>` so you can embed CSS directly in a Markdown file to produce a self-contained PDF. **Use only with content you trust** — CSS itself can still exfiltrate data (see below). |
| `"none"` | Disable sanitization. Legacy behavior. Not recommended. |

### What `"gfm"` removes

Tags (opening and closing forms are both escaped to visible text):
`<title>`, `<textarea>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<script>`, `<plaintext>`

Attributes:
- `on*` event handlers (`onclick`, `onload`, …)
- `href` / `src` whose value starts with `javascript:`

### Migrating from inline `<style>`

If you used to customize PDF layout by writing `<style>` directly inside a Markdown file, move that CSS into a `.css` file and reference it via `markdown-pdf.styles`. External stylesheets are loaded from your VS Code settings, not from the Markdown body, so they are not affected by sanitization.

**Caveats for external CSS:**
- CSS can still make outbound network requests through `@import url(...)`, `background: url(...)`, attribute selectors with `url(...)`, etc. Only reference stylesheet files you trust.
- When `markdown-pdf.stylesRelativePathFile` is `true`, the stylesheet path is resolved relative to the opened Markdown file. Be cautious about opening Markdown from untrusted locations that may ship a malicious sibling `.css`.

### Sanitization scope

**Sanitized:**
- Raw HTML written inside the Markdown body (rendered via markdown-it's `html_block` / `html_inline`)
- Content pulled in by the Include feature (`:[label](path.md)`) — it goes through the same renderer

**Not sanitized:**
- External CSS loaded via `markdown-pdf.styles` (by design — user-configured trust boundary)
- The extension's built-in stylesheets and HTML template
- HTML emitted by the extension itself (mermaid, highlight.js, emoji, PlantUML)
````

- [ ] **Step 3: コミット**

```bash
git add README.md
git commit -m "docs(sanitize): document markdown-pdf.sanitize in README"
```

### Task 7.2: README.ja.md

**Files:**
- Modify: `README.ja.md`

- [ ] **Step 1: 設定項目一覧への追加**

`README.ja.md` の設定項目テーブルに `markdown-pdf.sanitize` を追加する。

```markdown
| markdown-pdf.sanitize | Markdown 内のRaw HTML のサニタイズモード: `"gfm"` (既定、GFM 準拠)、`"gfm-allow-style"` (`<style>` を許可)、`"none"` (無効化、後方互換) | "gfm" |
```

- [ ] **Step 2: 日本語の Raw HTML サニタイズセクション追加**

Task 7.1 の英語セクションに対応する日本語版を追加する。

````markdown
## Raw HTML のサニタイズ

### 導入の背景

以前のバージョンでは Markdown 内のRaw HTML を検証せずにそのままレンダラに渡していたため、`<script>` や `<iframe>` 等がプレビュー／PDF 生成時に実行される可能性があり、信頼できない Markdown を開いたときに XSS のリスクがありました（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）。

本リリースから、既定で [GitHub Flavored Markdown の Disallowed Raw HTML 拡張](https://github.github.com/gfm/#disallowed-raw-html-extension-) に準拠したサニタイズを適用します。

### モード

`markdown-pdf.sanitize` で制御します。

| モード | 挙動 |
| --- | --- |
| `"gfm"` (既定) | GFM の禁止タグおよび危険な属性を除去。他者が作成した Markdown を開く可能性がある通常利用に推奨。 |
| `"gfm-allow-style"` | `"gfm"` と同様、ただし `<style>` は残す。自身で書いた Markdown に CSS を同梱して 1 ファイル完結の PDF を作成したい場合向け。**信頼できるコンテンツに限って使用してください** — CSS 自体でもデータ送信は可能です（下記参照）。 |
| `"none"` | サニタイズ無効。従来互換。基本的に非推奨。 |

### `"gfm"` で除去される対象

タグ（開きタグ・閉じタグとも `<` が `&lt;` にエスケープされ、可視テキストとして残ります）:
`<title>`, `<textarea>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<script>`, `<plaintext>`

属性:
- `on*` イベントハンドラ（`onclick`, `onload` 等）
- `href` / `src` の値が `javascript:` で始まるもの

### 本文内 `<style>` からの移行

PDF レイアウト調整のために Markdown 本文内で `<style>` を使っていた場合、CSS を別ファイルに移し `markdown-pdf.styles` で読み込むことで同等のカスタマイズが可能です。外部スタイルシートは VS Code 設定から読み込まれるため、本文のRaw HTML とは異なりサニタイズの影響を受けません。

**外部 CSS の注意点:**
- CSS は `@import url(...)`, `background: url(...)`, 属性セレクタ + `url(...)` 等によって外部送信が可能です。信頼できる CSS ファイルのみを指定してください。
- `markdown-pdf.stylesRelativePathFile: true` の場合、スタイルシートのパスは開いた Markdown ファイルからの相対として解決されます。信頼できない場所にある Markdown を開くと、隣接する悪意ある `.css` を読み込む可能性があります。

### サニタイズの適用範囲

**サニタイズ対象:**
- Markdown 本文内に書かれたRaw HTML（markdown-it の `html_block` / `html_inline` として処理されるもの）
- Include 機能（`:[label](path.md)`）でインクルードされたファイルの内容（同じレンダラを通るため自動的に適用されます）

**サニタイズ対象外:**
- `markdown-pdf.styles` で指定された外部 CSS（意図的に対象外。ユーザー設定による明示指定が信頼境界）
- 拡張内蔵の CSS およびテンプレート HTML
- 拡張自身が生成する HTML（mermaid、highlight.js、emoji、PlantUML の出力）
````

- [ ] **Step 3: コミット**

```bash
git add README.ja.md
git commit -m "docs(sanitize): document markdown-pdf.sanitize in README.ja"
```

---

## Task 8: CHANGELOG.md 更新

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 先頭に新セクションを追加**

`CHANGELOG.md` の `## 2.0.1 (2026/04/14)` の**直前**に、以下を追加する。バージョン番号はリリース時に確定するためプレースホルダ `X.Y.Z` と日付プレースホルダを置く。

```markdown
## X.Y.Z (YYYY/MM/DD)

### Breaking Changes

* Raw HTML in Markdown is now sanitized by default according to the [GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-). The following are removed from Markdown body content:
  * Tags: `<script>`, `<iframe>`, `<style>`, `<textarea>`, `<title>`, `<xmp>`, `<noembed>`, `<noframes>`, `<plaintext>` (opening `<` is escaped to `&lt;`, content is preserved as visible text)
  * `on*` event handler attributes (`onclick`, `onload`, etc.)
  * `href` / `src` attributes whose value begins with `javascript:`
* The behavior is controlled by the new `markdown-pdf.sanitize` setting (`"gfm"` / `"gfm-allow-style"` / `"none"`, default `"gfm"`). See README for details and migration notes.
* To preserve pre-change behavior, set `markdown-pdf.sanitize` to `"none"`. To keep inline `<style>` only, use `"gfm-allow-style"`. Existing layout CSS can also be migrated to external files via `markdown-pdf.styles`.

### Changes

* Add `markdown-pdf.sanitize` setting for raw HTML sanitization (see Breaking Changes above)
```

- [ ] **Step 2: コミット**

```bash
git add CHANGELOG.md
git commit -m "docs(sanitize): add breaking change entry to CHANGELOG"
```

---

## Task 9: 統合動作確認（手動）

**Files:**
- なし（実行確認のみ）

- [ ] **Step 1: 全テスト実行**

Run: `npm test`
Expected: ユニット・統合とも全パス。差分ゼロ（既存スナップショットへの回帰がないこと）。

ただし `"gfm"` が既定になるため、もし既存の統合テストに `<script>` や `<style>` 等のRaw HTML を含むサンプルがあれば出力差分が出る。その場合:

1. 差分が「サニタイズ結果として期待通り」であれば、サンプルまたはスナップショットを更新して再コミットする
2. 差分が想定外（拡張自動生成 HTML が壊れる等）であれば、実装を見直す

- [ ] **Step 2: 手動検証（開発者向け）**

任意の Markdown に以下を含む内容を作成し、`"gfm"` モードで HTML 出力した結果を目視で確認する:

```markdown
<script>alert('pwn')</script>
<iframe src="https://example.com"></iframe>
<style>body { color: red }</style>
<div onclick="alert(1)">hover me</div>
<a href="javascript:alert(1)">link</a>

<div class="note">This should survive.</div>
```

期待結果:
- `<script>`, `<iframe>`, `<style>` が `&lt;script>` 等に変換され、実行されないこと
- `onclick` と `javascript:` href が属性ごと削除されていること
- 通常の `<div class="note">` は素通ること

設定を `"gfm-allow-style"` に切り替え、`<style>` のみが素通ることを確認。
設定を `"none"` に切り替え、全てが素通ることを確認。

- [ ] **Step 3: 既存機能の非回帰確認**

以下のサンプル Markdown で視覚的に差が出ないことを確認:
- `sample/` 以下の既存サンプル
- README.md を PDF 化した結果

差分があれば、サニタイザ側の問題か、そのサンプルが本当に `<style>` 等に依存していたかを切り分ける。

---

## Self-Review（計画作成者による最終チェック）

**Spec coverage check:**

| 仕様書項目 | 対応タスク |
|---|---|
| `markdown-pdf.sanitize` 設定追加 | Task 1 |
| `SanitizeMode` 型・`getDisallowedTags()` | Task 2 |
| `sanitizeRawHtml()` 実装（禁止タグ） | Task 3 |
| `sanitizeRawHtml()` 実装（`on*` 属性） | Task 4 |
| `sanitizeRawHtml()` 実装（`javascript:` URL） | Task 5 |
| `html_block` / `html_inline` レンダラ差し替え | Task 6 |
| README.md / README.ja.md 更新（禁止タグ一覧・導入理由・移行案内・リスク注記・モード別シーン） | Task 7 |
| CHANGELOG Breaking Changes | Task 8 |
| インクルード経由のサニタイズ適用 | 設計上自動適用。Task 9 の手動検証でインクルードを含むサンプルがあれば追加確認 |
| front matter override なし | 実装で `front matter` から `sanitize` を読まない。Task 6 で `vscode.workspace.getConfiguration` のみ参照することで自動成立 |
| 外部 CSS サニタイズしない | 既存の `readStyles()` 経路に手を入れないため自動成立。Task 7 の README で明示 |

**Placeholder scan:** `TBD` / `TODO` / `実装後決定` 等は残っていない。CHANGELOG のみ `X.Y.Z (YYYY/MM/DD)` プレースホルダを意図的に残置（リリース時に確定）。

**Type / API consistency:**
- `SanitizeMode` 型: Task 2 で定義、Task 3-6 で一貫して使用
- `getDisallowedTags(mode)`: Task 2 で `Set<string>` 返却、Task 3 の `sanitizeRawHtml()` で `disallowed.has(tagName)` として使用 — 一貫
- `sanitizeRawHtml(html, mode)`: 全タスクで引数順・名称統一
- `stripDangerousAttributes(tag)`: Task 4 で定義、同タスクで呼び出し — 整合
- `utils.SanitizeMode`: Task 6 で `utils.SanitizeMode` として参照（`export type` のため整合）
