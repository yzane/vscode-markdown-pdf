# 目視確認用 PDF 生成テスト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不要なバイナリ生成テストを削除し、全フィクスチャを結合した PDF を `tmp/` に出力する目視確認用テストに置き換える

**Architecture:** 既存の `Integration Binary Generation Tests` スイート全体を削除し、同じ位置に `Visual Inspection Tests` スイートを追加する。`HTML_FEATURES` の各 `.md` を結合して `tmp/_all-features.md` を生成し、PDF に変換して `tmp/_all-features.pdf` として保存する。

**Tech Stack:** TypeScript, Mocha (tdd), VS Code Extension Test API

---

### Task 1: `.gitignore` と `.vscodeignore` に `tmp/` を追加

**Files:**
- Modify: `.gitignore`
- Modify: `.vscodeignore`

- [ ] **Step 1: `.gitignore` に `tmp/` を追加**

`.gitignore` の末尾に追加:

```
# Visual inspection output
tmp/
```

- [ ] **Step 2: `.vscodeignore` に `tmp/` を追加**

`.vscodeignore` の `# Test` セクションの後に追加:

```
tmp/
```

追加位置は既存の `test/**` の次の行。

- [ ] **Step 3: コミット**

```bash
git add .gitignore .vscodeignore
git commit -m "chore: add tmp/ to gitignore and vscodeignore"
```

---

### Task 2: テストスイートの削除と置き換え

**Files:**
- Modify: `test/integration/extension.test.ts:119-199`

- [ ] **Step 1: `Integration Binary Generation Tests` スイートを削除**

`test/integration/extension.test.ts` の 119〜199 行目（`suite('Integration Binary Generation Tests', () => {` から対応する `});` まで）を削除する。

- [ ] **Step 2: 同じ位置に `Visual Inspection Tests` スイートを追加**

削除した位置（118 行目の後）に以下を挿入:

```typescript
suite('Visual Inspection Tests', () => {
  const TMP_DIR = path.resolve(__dirname, '..', '..', 'tmp');
  const allFeaturesMd = path.resolve(TMP_DIR, '_all-features.md');
  const allFeaturesPdf = path.resolve(TMP_DIR, '_all-features.pdf');

  suiteSetup(function () {
    fs.mkdirSync(TMP_DIR, { recursive: true });

    const contents = HTML_FEATURES.map(({ name }) => {
      const filePath = path.resolve(FIXTURES_DIR, `${name}.md`);
      return fs.readFileSync(filePath, 'utf-8');
    });
    fs.writeFileSync(allFeaturesMd, contents.join('\n\n---\n\n'), 'utf-8');
  });

  test('generates combined PDF for visual inspection', async function () {
    this.timeout(60000);

    const doc = await vscode.workspace.openTextDocument(allFeaturesMd);
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('extension.markdown-pdf.pdf');
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await waitForFile(allFeaturesPdf);

    const stat = fs.statSync(allFeaturesPdf);
    assert.ok(stat.size > 0, 'PDF file should not be empty');
  });
});
```

注意点:
- `executeMarkdownPdfCommand` は `FIXTURES_DIR` 基準のため使わず、`vscode.workspace.openTextDocument` で直接 `tmp/` 内のファイルを開く
- `TMP_DIR` は `generate-sample.ts` と同じ `path.resolve(__dirname, '..', '..')` パターンで `WORKSPACE_ROOT` を算出し、その下の `tmp/`
- `suiteTeardown` は不要（ファイルを残す）

- [ ] **Step 3: コミット**

```bash
git add test/integration/extension.test.ts
git commit -m "test: replace binary generation tests with visual inspection PDF output"
```

---

### Task 3: 動作確認

- [ ] **Step 1: lint チェック**

```bash
npm run lint
```

期待: エラーなし

- [ ] **Step 2: テスト実行**

```bash
npm test -- --label integration
```

期待: `Visual Inspection Tests` が PASS し、`tmp/_all-features.pdf` が生成される

- [ ] **Step 3: 生成ファイルの確認**

```bash
ls -la tmp/_all-features.md tmp/_all-features.pdf
```

期待: 両ファイルが存在し、PDF のサイズが 0 より大きい
