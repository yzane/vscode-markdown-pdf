# README 図更新コマンド extension host 化 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run update-readme-diagrams` を VS Code extension host 経由で動作させ、既存の `extension.markdown-pdf.png` export 経路を使って `images/PlantUML.png` と `images/mermaid.png` を更新できるようにする。

**Architecture:** README からの図抽出は既存の `src/readme-diagrams.ts` を再利用し、実行は `vscode-test --label readme-diagrams` で `test/sample/update-readme-diagrams.ts` を走らせる。既存の直接描画 script は撤去し、Chromium 解決・Mermaid・PlantUML・PNG 出力を extension host 側に統一する。

**Tech Stack:** TypeScript, @vscode/test-cli, VS Code extension host, puppeteer-core (indirectly via existing extension path)

**Reference:** 設計書 `docs/superpowers/specs/20260411-03-readme-diagram-refresh-vscode-host-design.md`

**Working branch:** `feature/readme-diagram-refresh`

---

## 事前確認

- [ ] **Step 0: 作業ブランチ確認**

  Run: `git branch --show-current`
  Expected: `feature/readme-diagram-refresh`

  もし異なる場合は `git checkout feature/readme-diagram-refresh` で切り替える。

---

## Task 1: extension host 用の README 図更新 runner を追加する

**Files:**
- Modify: `.vscode-test.mjs`
- Create: `test/sample/update-readme-diagrams.ts`
- Reuse: `src/readme-diagrams.ts`

### 実装方針

- `test/sample/update-readme-diagrams.ts` を新規追加し、sample 生成とは責務を分離する
- `.vscode-test.mjs` に `label: 'readme-diagrams'` を追加する
- runner は `README.md` から PlantUML / Mermaid を抽出し、図ごとに一時 Markdown を作って `extension.markdown-pdf.png` を呼ぶ
- 生成された一時 PNG を `images/PlantUML.png` / `images/mermaid.png` にコピーし、一時ファイルは消す

- [ ] **Step 1-1: 失敗する runner を追加**

  Modify `.vscode-test.mjs` to add one config entry:

  ```js
  {
    label: 'readme-diagrams',
    files: 'test/sample/update-readme-diagrams.ts',
    mocha: { ui: 'tdd', timeout: 120000, require: ['tsx'] },
    skipExtensionDependencies: true,
    launchArgs: ['--user-data-dir=' + userDataDir],
    ...installationOption,
  }
  ```

  Create `test/sample/update-readme-diagrams.ts`:

  ```ts
  import assert from 'assert';
  import fs from 'fs';
  import os from 'os';
  import path from 'path';
  import * as vscode from 'vscode';
  import { extractReadmeDiagramSources } from '../../src/readme-diagrams';

  const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
  const README_MD = path.resolve(WORKSPACE_ROOT, 'README.md');
  const IMAGES_DIR = path.resolve(WORKSPACE_ROOT, 'images');

  function waitForFile(filePath: string, maxWait = 30000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (fs.existsSync(filePath)) {
        resolve();
        return;
      }

      const interval = 500;
      let waited = 0;
      const timer = setInterval(() => {
        waited += interval;
        if (fs.existsSync(filePath)) {
          clearInterval(timer);
          resolve();
        } else if (waited >= maxWait) {
          clearInterval(timer);
          reject(new Error(`File not found after ${maxWait}ms: ${filePath}`));
        }
      }, interval);
    });
  }

  suite('Update README Diagram Images', () => {
    test('placeholder', async function () {
      this.timeout(120000);
      const markdown = fs.readFileSync(README_MD, 'utf-8');
      const sources = extractReadmeDiagramSources(markdown);
      assert.ok(sources.plantuml.includes('@startuml'));
      assert.ok(sources.mermaid.length > 0);
    });
  });
  ```

- [ ] **Step 1-2: 新ラベルを起動して runner が見つかることを確認**

  Run: `vscode-test --config .vscode-test.mjs --label readme-diagrams`
  Expected: placeholder test が PASS

- [ ] **Step 1-3: 最小の更新処理を実装**

  Replace `test/sample/update-readme-diagrams.ts` with:

  ```ts
  import fs from 'fs';
  import os from 'os';
  import path from 'path';
  import * as vscode from 'vscode';
  import { extractReadmeDiagramSources } from '../../src/readme-diagrams';

  const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
  const README_MD = path.resolve(WORKSPACE_ROOT, 'README.md');
  const IMAGES_DIR = path.resolve(WORKSPACE_ROOT, 'images');

  function waitForFile(filePath: string, maxWait = 30000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (fs.existsSync(filePath)) {
        resolve();
        return;
      }

      const interval = 500;
      let waited = 0;
      const timer = setInterval(() => {
        waited += interval;
        if (fs.existsSync(filePath)) {
          clearInterval(timer);
          resolve();
        } else if (waited >= maxWait) {
          clearInterval(timer);
          reject(new Error(`File not found after ${maxWait}ms: ${filePath}`));
        }
      }, interval);
    });
  }

  async function exportDiagramPng(markdownSource: string, outputName: string): Promise<void> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-pdf-readme-diagram-'));
    const markdownPath = path.join(tempDir, outputName + '.md');
    const generatedPng = path.join(tempDir, outputName + '.png');
    const finalPng = path.join(IMAGES_DIR, outputName + '.png');

    fs.writeFileSync(markdownPath, markdownSource);

    try {
      const doc = await vscode.workspace.openTextDocument(markdownPath);
      await vscode.window.showTextDocument(doc);
      await vscode.commands.executeCommand('extension.markdown-pdf.png');
      await waitForFile(generatedPng, 60000);
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      fs.copyFileSync(generatedPng, finalPng);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  suite('Update README Diagram Images', () => {
    test('export README PlantUML and Mermaid snippets to images/', async function () {
      this.timeout(180000);

      const markdown = fs.readFileSync(README_MD, 'utf-8');
      const { plantuml, mermaid } = extractReadmeDiagramSources(markdown);

      await exportDiagramPng(plantuml, 'PlantUML');
      await exportDiagramPng('```mermaid\\n' + mermaid + '\\n```', 'mermaid');
    });
  });
  ```

- [ ] **Step 1-4: runner を実行して画像更新を確認**

  Run: `vscode-test --config .vscode-test.mjs --label readme-diagrams`
  Expected:
  - test PASS
  - `images/PlantUML.png` が更新される
  - `images/mermaid.png` が更新される

- [ ] **Step 1-5: コミット**

  ```bash
  git add .vscode-test.mjs test/sample/update-readme-diagrams.ts images/PlantUML.png images/mermaid.png
  git commit -m "test: add extension-host README diagram refresh runner"
  ```

---

## Task 2: npm script を extension host runner に切り替え、直接描画 script を撤去する

**Files:**
- Modify: `package.json`
- Delete: `scripts/update-readme-diagrams.ts`

### 実装方針

- `npm run update-readme-diagrams` は `vscode-test --config .vscode-test.mjs --label readme-diagrams` を呼ぶだけにする
- 直接描画 script は不要になるため削除する
- これにより Chromium キャッシュパスや描画経路を extension host に統一する

- [ ] **Step 2-1: npm script を失敗させる形で先に切り替える**

  Modify `package.json`:

  ```json
  {
    "update-readme-diagrams": "vscode-test --config .vscode-test.mjs --label readme-diagrams"
  }
  ```

  Run: `npm run update-readme-diagrams`
  Expected: Task 1 が未完了なら FAIL、Task 1 完了後なら PASS

- [ ] **Step 2-2: 直接描画 script を削除**

  Delete file:

  ```text
  scripts/update-readme-diagrams.ts
  ```

- [ ] **Step 2-3: npm script 経由の動作を再確認**

  Run: `npm run update-readme-diagrams`
  Expected:
  - `readme-diagrams` label が起動する
  - test PASS
  - `images/PlantUML.png` が更新される
  - `images/mermaid.png` が更新される

- [ ] **Step 2-4: 生成後に repo 配下へ不要な一時ディレクトリが残らないことを確認**

  Run: `git status --short`
  Expected: 画像差分と実装差分だけが表示され、`.tmp/` のような不要ディレクトリは出ない

- [ ] **Step 2-5: sample 既存経路への影響確認**

  Run: `vscode-test --config .vscode-test.mjs --label sample`
  Expected: sample 生成 test が PASS

- [ ] **Step 2-6: コミット**

  ```bash
  git add package.json .vscode-test.mjs
  git rm scripts/update-readme-diagrams.ts
  git commit -m "feat: route README diagram refresh through extension host"
  ```

---

## 完了条件

- `npm run update-readme-diagrams` が extension host 経由で実行される
- `.vscode-test.mjs` に `readme-diagrams` label が追加されている
- `test/sample/update-readme-diagrams.ts` が追加されている
- `src/readme-diagrams.ts` の抽出ロジックを再利用している
- `images/PlantUML.png` と `images/mermaid.png` が更新される
- repo 配下に `.tmp/` など不要な一時ディレクトリを残さない
- `scripts/update-readme-diagrams.ts` は削除されている
- `vscode-test --label sample` が引き続き通る
