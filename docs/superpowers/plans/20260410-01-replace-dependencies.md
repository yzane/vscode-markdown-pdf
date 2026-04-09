# 依存パッケージ独自実装への置き換え 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** cheerio, mustache, gray-matter を独自実装に置き換え、依存パッケージを削減する

**アーキテクチャ:** 各パッケージの使用箇所を正規表現ベースまたは簡易的な独自実装に置換。gray-matter のみ YAML パース部分で js-yaml を直接利用する。変更は `src/utils.ts` と `src/extension.ts` に集中。

**技術スタック:** TypeScript, js-yaml, 正規表現

**作業ディレクトリ:** `.worktrees/replace-dependencies/`
**ブランチ:** `feature/replace-dependencies`（このブランチのみで作業すること。他のブランチへの切り替え禁止）

---

## ファイル構成

| ファイル | 変更内容 |
|---|---|
| `src/utils.ts` | cheerio 削除、`renderTemplate()` 追加、`parseFrontMatter()` 追加 |
| `src/extension.ts` | gray-matter / mustache の import を削除し utils の関数に置き換え |
| `test/unit/utils.test.ts` | 新規関数のテスト追加、既存テストの調整 |
| `package.json` | cheerio, mustache, gray-matter 削除。js-yaml, @types/js-yaml 追加。@types/mustache 削除 |

---

### Task 1: mustache を独自実装に置き換え

**対象ファイル:**
- 変更: `src/utils.ts`
- 変更: `src/extension.ts:16,287`
- テスト: `test/unit/utils.test.ts`

- [ ] **Step 1: `renderTemplate` のテストを書く**

`test/unit/utils.test.ts` の末尾（最後の `});` の直前）に追加:

```typescript
  describe('renderTemplate', function () {
    it('should replace triple-brace variables with view values', function () {
      const template = '<title>{{{title}}}</title><style>{{{style}}}</style>';
      const view = { title: 'My Doc', style: '.body { color: red; }' };
      assert.strictEqual(utils.renderTemplate(template, view), '<title>My Doc</title><style>.body { color: red; }</style>');
    });

    it('should leave unmatched variables as-is', function () {
      const template = '{{{title}}} {{{unknown}}}';
      const view = { title: 'Hello' };
      assert.strictEqual(utils.renderTemplate(template, view), 'Hello {{{unknown}}}');
    });

    it('should handle template with no variables', function () {
      const template = '<p>No variables here</p>';
      const view = { title: 'Hello' };
      assert.strictEqual(utils.renderTemplate(template, view), '<p>No variables here</p>');
    });

    it('should not escape HTML in values', function () {
      const template = '{{{content}}}';
      const view = { content: '<h1>Title</h1>' };
      assert.strictEqual(utils.renderTemplate(template, view), '<h1>Title</h1>');
    });

    it('should replace multiple occurrences of the same variable', function () {
      const template = '{{{x}}} and {{{x}}}';
      const view = { x: 'val' };
      assert.strictEqual(utils.renderTemplate(template, view), 'val and val');
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

実行: `cd .worktrees/replace-dependencies && npx tsx --test test/unit/utils.test.ts 2>&1 | tail -5`
期待結果: `renderTemplate` が存在しないため FAIL

- [ ] **Step 3: `renderTemplate` を実装**

`src/utils.ts` の `buildHtmlViewData` 関数の直後に追加:

```typescript
export function renderTemplate(template: string, view: Record<string, string>): string {
  return template.replace(/\{\{\{(\w+)\}\}\}/g, (match, key) => {
    return key in view ? view[key] : match;
  });
}
```

- [ ] **Step 4: テストが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npx tsx --test test/unit/utils.test.ts 2>&1 | tail -5`
期待結果: PASS

- [ ] **Step 5: `extension.ts` から mustache を削除し `renderTemplate` を使用**

`src/extension.ts` を修正:

1. `import mustache from 'mustache';` の行（16行目）を削除
2. `return mustache.render(template as string, view);`（287行目付近）を以下に変更:
```typescript
    return utils.renderTemplate(template as string, view);
```

- [ ] **Step 6: 型チェックが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npm run check 2>&1 | tail -5`
期待結果: エラーなし

- [ ] **Step 7: 全ユニットテスト通過を確認**

実行: `cd .worktrees/replace-dependencies && npm run test:unit 2>&1 | tail -10`
期待結果: 全テスト PASS

- [ ] **Step 8: コミット**

```bash
cd .worktrees/replace-dependencies
git add src/utils.ts src/extension.ts test/unit/utils.test.ts
git commit -m "feat: replace mustache with custom renderTemplate implementation"
```

---

### Task 2: cheerio を独自実装に置き換え

**対象ファイル:**
- 変更: `src/utils.ts:4,451-462`
- テスト: `test/unit/utils.test.ts`

- [ ] **Step 1: `transformHtmlBlockImages` を正規表現実装に変更**

`src/utils.ts` を修正:

1. `import { load as cheerioLoad } from 'cheerio';`（4行目）を削除
2. `transformHtmlBlockImages` 関数（451-462行目）を以下に置き換え:

```typescript
export function transformHtmlBlockImages(html: string, filename: string): string {
  if (!html) {
    return '';
  }
  return html.replace(/<img\s([^>]*?)src=(["'])(.*?)\2([^>]*?)>/gi, (match, before, quote, src, after) => {
    const href = convertImgPath(src, filename);
    return `<img ${before}src=${quote}${href}${quote}${after}>`;
  });
}
```

- [ ] **Step 2: 型チェックが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npm run check 2>&1 | tail -5`
期待結果: エラーなし

- [ ] **Step 3: 既存テストが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npx tsx --test test/unit/utils.test.ts 2>&1 | tail -10`
期待結果: 全テスト PASS

注意: cheerio は `cheerioLoad(html)` で `<html><head><body>` ラッパーを付与していたが、正規表現置換ではその副作用がない。既存テストは `indexOf` ベースなので影響はない想定だが、失敗したらテストの期待値を調整する。

- [ ] **Step 4: 自己閉じタグと属性付き img タグのテストを追加**

`test/unit/utils.test.ts` の `transformHtmlBlockImages` describe ブロック内、最後の `it` の後に追加:

```typescript
    it('should handle self-closing img tags', function () {
      const result = utils.transformHtmlBlockImages('<img src="photo.png" />', '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('photo.png') >= 0);
    });

    it('should handle img tags with other attributes', function () {
      const result = utils.transformHtmlBlockImages('<img alt="desc" src="photo.png" width="100">', '/doc/test.md');
      assert.ok(result.indexOf('file://') >= 0);
      assert.ok(result.indexOf('photo.png') >= 0);
      assert.ok(result.indexOf('alt="desc"') >= 0);
      assert.ok(result.indexOf('width="100"') >= 0);
    });

    it('should preserve surrounding html', function () {
      const result = utils.transformHtmlBlockImages('<p>before</p><img src="photo.png"><p>after</p>', '/doc/test.md');
      assert.ok(result.indexOf('<p>before</p>') >= 0);
      assert.ok(result.indexOf('<p>after</p>') >= 0);
      assert.ok(result.indexOf('file://') >= 0);
    });
```

- [ ] **Step 5: テストが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npx tsx --test test/unit/utils.test.ts 2>&1 | tail -10`
期待結果: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
cd .worktrees/replace-dependencies
git add src/utils.ts test/unit/utils.test.ts
git commit -m "feat: replace cheerio with regex-based img src transformation"
```

---

### Task 3: gray-matter を独自実装に置き換え

**対象ファイル:**
- 変更: `src/utils.ts`
- 変更: `src/extension.ts:7,159`
- テスト: `test/unit/utils.test.ts`
- 変更: `package.json`

- [ ] **Step 1: js-yaml と @types/js-yaml をインストール**

```bash
cd .worktrees/replace-dependencies
npm install js-yaml
npm install --save-dev @types/js-yaml
```

- [ ] **Step 2: `parseFrontMatter` のテストを書く**

`test/unit/utils.test.ts` の末尾（最後の `});` の直前）に追加:

```typescript
  describe('parseFrontMatter', function () {
    it('should parse YAML front matter and return data and content', function () {
      const text = '---\nbreaks: true\nemoji: false\n---\n# Hello';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true, emoji: false });
      assert.strictEqual(result.content, '# Hello');
    });

    it('should return empty data when no front matter exists', function () {
      const text = '# Hello\nWorld';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '# Hello\nWorld');
    });

    it('should handle front matter with string values', function () {
      const text = '---\nplantumlOpenMarker: "@startuml"\n---\nContent';
      const result = utils.parseFrontMatter(text);
      assert.strictEqual(result.data.plantumlOpenMarker, '@startuml');
      assert.strictEqual(result.content, 'Content');
    });

    it('should handle empty front matter block', function () {
      const text = '---\n---\n# Hello';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '# Hello');
    });

    it('should handle front matter with trailing newline', function () {
      const text = '---\nbreaks: true\n---\n\n# Hello\n';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true });
      assert.strictEqual(result.content, '\n# Hello\n');
    });

    it('should not treat --- in body as front matter delimiter', function () {
      const text = '# Hello\n---\nbreaks: true\n---\n';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '# Hello\n---\nbreaks: true\n---\n');
    });

    it('should handle empty string', function () {
      const text = '';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, {});
      assert.strictEqual(result.content, '');
    });

    it('should handle front matter only (no content after)', function () {
      const text = '---\nbreaks: true\n---\n';
      const result = utils.parseFrontMatter(text);
      assert.deepStrictEqual(result.data, { breaks: true });
      assert.strictEqual(result.content, '');
    });
  });
```

- [ ] **Step 3: テストが失敗することを確認**

実行: `cd .worktrees/replace-dependencies && npx tsx --test test/unit/utils.test.ts 2>&1 | tail -5`
期待結果: `parseFrontMatter` が存在しないため FAIL

- [ ] **Step 4: `parseFrontMatter` を実装**

`src/utils.ts` の先頭の import に追加:
```typescript
import yaml from 'js-yaml';
```

`renderTemplate` 関数の直後に追加:

```typescript
export function parseFrontMatter(text: string): { data: Record<string, unknown>; content: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: text };
  }
  const yamlStr = match[1];
  const content = match[2];
  if (!yamlStr.trim()) {
    return { data: {}, content: content };
  }
  const data = yaml.load(yamlStr);
  return {
    data: (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>,
    content: content,
  };
}
```

- [ ] **Step 5: テストが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npx tsx --test test/unit/utils.test.ts 2>&1 | tail -10`
期待結果: 全テスト PASS

- [ ] **Step 6: `extension.ts` から gray-matter を削除し `parseFrontMatter` を使用**

`src/extension.ts` を修正:

1. `import grayMatter from 'gray-matter';`（7行目）を削除
2. `const matterParts = grayMatter(text);`（159行目付近）を以下に変更:
```typescript
  const matterParts = utils.parseFrontMatter(text);
```

- [ ] **Step 7: 型チェックが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npm run check 2>&1 | tail -5`
期待結果: エラーなし

- [ ] **Step 8: 全ユニットテスト通過を確認**

実行: `cd .worktrees/replace-dependencies && npm run test:unit 2>&1 | tail -10`
期待結果: 全テスト PASS

- [ ] **Step 9: コミット**

```bash
cd .worktrees/replace-dependencies
git add src/utils.ts src/extension.ts test/unit/utils.test.ts package.json package-lock.json
git commit -m "feat: replace gray-matter with custom parseFrontMatter using js-yaml"
```

---

### Task 4: 不要な依存を削除しクリーンアップ

**対象ファイル:**
- 変更: `package.json`

- [ ] **Step 1: cheerio, mustache, gray-matter と @types/mustache を削除**

```bash
cd .worktrees/replace-dependencies
npm uninstall cheerio mustache gray-matter
npm uninstall --save-dev @types/mustache
```

- [ ] **Step 2: 型チェックが通ることを確認**

実行: `cd .worktrees/replace-dependencies && npm run check 2>&1 | tail -5`
期待結果: エラーなし

- [ ] **Step 3: 全ユニットテスト通過を確認**

実行: `cd .worktrees/replace-dependencies && npm run test:unit 2>&1 | tail -10`
期待結果: 全テスト PASS

- [ ] **Step 4: esbuild バンドルが成功することを確認**

実行: `cd .worktrees/replace-dependencies && npm run build 2>&1 | tail -5`
期待結果: エラーなし

- [ ] **Step 5: コミット**

```bash
cd .worktrees/replace-dependencies
git add package.json package-lock.json
git commit -m "chore: remove cheerio, mustache, gray-matter dependencies"
```
