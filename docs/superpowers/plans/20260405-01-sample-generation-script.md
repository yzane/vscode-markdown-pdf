# サンプル生成スクリプト実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run sample` で README.md を4形式（PDF, HTML, PNG, JPEG）に変換し `./sample/` に配置するスクリプトを追加する。

**Architecture:** 既存の integration test と同じ `@vscode/test-cli` の仕組みを利用。`.vscode-test.mjs` に `sample` ラベルを追加し、専用テストファイルから VS Code の拡張機能コマンドで変換を実行する。

**Tech Stack:** `@vscode/test-cli`, `vscode-test`, Mocha (tdd UI)

**ブランチ:** `feature/sample-script`（`develop` から作成済み）

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `test/sample/generate-sample.js` | 新規作成 | README.md を4形式に変換し `./sample/` へコピー |
| `.vscode-test.mjs` | 修正 | `sample` ラベルのテスト設定を追加 |
| `package.json` | 修正 | `sample` スクリプトを追加 |

---

### Task 1: テストファイル `test/sample/generate-sample.js` を作成

**Files:**
- Create: `test/sample/generate-sample.js`

- [ ] **Step 1: ファイルを作成**

```js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const SAMPLE_DIR = path.resolve(WORKSPACE_ROOT, 'sample');
const README_MD = path.resolve(WORKSPACE_ROOT, 'README.md');

function waitForFile(filePath, maxWait = 30000) {
  return new Promise((resolve, reject) => {
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

suite('Generate Sample Files', () => {
  const FORMATS = ['pdf', 'html', 'png', 'jpeg'];

  test('convert README.md to all formats and copy to sample/', async function () {
    this.timeout(120000);

    const doc = await vscode.workspace.openTextDocument(README_MD);
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('extension.markdown-pdf.all');

    for (const fmt of FORMATS) {
      const generated = path.resolve(WORKSPACE_ROOT, `README.${fmt}`);
      await waitForFile(generated);

      const dest = path.resolve(SAMPLE_DIR, `README.${fmt}`);
      fs.copyFileSync(generated, dest);
      fs.unlinkSync(generated);

      assert.ok(fs.existsSync(dest), `sample/README.${fmt} should exist`);
      const stat = fs.statSync(dest);
      assert.ok(stat.size > 0, `sample/README.${fmt} should not be empty`);
    }
  });
});
```

- [ ] **Step 2: コミット**

```bash
git add test/sample/generate-sample.js
git commit -m "feat: add sample generation test file"
```

---

### Task 2: `.vscode-test.mjs` に sample ラベルを追加

**Files:**
- Modify: `.vscode-test.mjs:39-48`

- [ ] **Step 1: `export default defineConfig` の配列に sample エントリを追加**

`.vscode-test.mjs` の `defineConfig` 配列に、既存の `integration` エントリの後に以下を追加:

```js
{
  label: 'sample',
  files: 'test/sample/**/*.js',
  mocha: { ui: 'tdd', timeout: 120000 },
  skipExtensionDependencies: true,
  launchArgs: ['--user-data-dir=' + userDataDir],
  ...installationOption,
},
```

修正後の `export default defineConfig` 部分の全体:

```js
export default defineConfig([
  {
    label: 'integration',
    files: 'test/integration/**/*.test.js',
    mocha: { ui: 'tdd', timeout: 60000 },
    skipExtensionDependencies: true,
    launchArgs: ['--user-data-dir=' + userDataDir],
    ...installationOption,
  },
  {
    label: 'sample',
    files: 'test/sample/**/*.js',
    mocha: { ui: 'tdd', timeout: 120000 },
    skipExtensionDependencies: true,
    launchArgs: ['--user-data-dir=' + userDataDir],
    ...installationOption,
  },
]);
```

- [ ] **Step 2: コミット**

```bash
git add .vscode-test.mjs
git commit -m "feat: add sample label to vscode-test config"
```

---

### Task 3: `package.json` に sample スクリプトを追加

**Files:**
- Modify: `package.json:906-914`

- [ ] **Step 1: scripts に `presample` と `sample` を追加**

`"test:integration"` の行の後に以下を追加:

```json
"presample": "npm run build",
"sample": "vscode-test --config .vscode-test.mjs --label sample"
```

修正後の scripts 全体:

```json
"scripts": {
  "build": "esbuild extension.js --bundle --outfile=dist/extension.js --format=cjs --platform=node --external:vscode",
  "watch": "npm run build -- --watch",
  "package": "npm run build && vsce package",
  "test": "npm run test:unit && npm run test:integration",
  "test:unit": "node --test test/unit/**/*.test.js",
  "pretest:integration": "npm run build",
  "test:integration": "vscode-test --config .vscode-test.mjs",
  "presample": "npm run build",
  "sample": "vscode-test --config .vscode-test.mjs --label sample"
}
```

- [ ] **Step 2: コミット**

```bash
git add package.json
git commit -m "feat: add npm run sample script"
```

---

### Task 4: 動作確認

- [ ] **Step 1: `npm run sample` を実行**

```bash
npm run sample
```

Expected: ビルドが実行され、VS Code が起動し、README.md が4形式に変換され、`./sample/` に配置される。テストが PASS する。

- [ ] **Step 2: 生成されたファイルを確認**

```bash
ls -la sample/
```

Expected: `README.pdf`, `README.html`, `README.png`, `README.jpeg` が存在し、ファイルサイズが 0 より大きい。

- [ ] **Step 3: 変更をコミット（sample/ の更新がある場合）**

```bash
git add sample/
git commit -m "chore: update sample files"
```
