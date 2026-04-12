# compile.js 完全削除 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不要になった `src/compile.js` とその関連設定・依存を完全に削除する。

**Architecture:** `src/compile.js` を削除し、`package.json` から prepublish スクリプトと `removeNPMAbsolutePaths` 依存を除去、`npm install` でロックファイルを更新する。

**Tech Stack:** Node.js, npm

---

## ファイル構成

| 操作 | ファイル |
|------|---------|
| 削除 | `src/compile.js` |
| 変更 | `package.json` |
| 自動更新 | `package-lock.json` |

---

### Task 1: package.json から不要なエントリを削除

**Files:**
- Modify: `package.json`

- [ ] **Step 1: `vscode:prepublish` スクリプトを削除**

`package.json` の `scripts` セクションから以下の行を削除する：

```json
"vscode:prepublish": "node ./src/compile",
```

変更後の `scripts` セクション：

```json
"scripts": {
  "test": "npm run test:unit && npm run test:integration",
  "test:unit": "node --test test/unit/**/*.test.js",
  "test:integration": "vscode-test --config .vscode-test.mjs"
},
```

- [ ] **Step 2: `removeNPMAbsolutePaths` を devDependencies から削除**

`package.json` の `devDependencies` セクションから以下の行を削除する：

```json
"removeNPMAbsolutePaths": "^3.0.1"
```

変更後の `devDependencies` セクション：

```json
"devDependencies": {
  "@vscode/test-cli": "^0.0.12",
  "@vscode/test-electron": "^2.5.2"
},
```

---

### Task 2: compile.js を削除

**Files:**
- Delete: `src/compile.js`

- [ ] **Step 1: ファイルを削除**

```bash
rm src/compile.js
```

- [ ] **Step 2: 削除確認**

```bash
ls src/
```

期待結果: `compile.js` が一覧に含まれない。`chromium-resolver.js` と `utils.js` のみ。

---

### Task 3: ロックファイルを更新し動作確認

**Files:**
- Auto-update: `package-lock.json`

- [ ] **Step 1: `npm install` でロックファイルを更新**

```bash
npm install
```

期待結果: `removeNPMAbsolutePaths` がアンインストールされ、`package-lock.json` が更新される。

- [ ] **Step 2: `removeNPMAbsolutePaths` が除去されたことを確認**

```bash
npm ls removeNPMAbsolutePaths
```

期待結果: パッケージが見つからないエラー（正常）。

- [ ] **Step 3: 既存テストが通ることを確認**

```bash
npm run test:unit
```

期待結果: すべてのテストが PASS。

---

### Task 4: コミット

- [ ] **Step 1: 変更内容を確認**

```bash
git status
git diff
```

期待結果: `src/compile.js` が deleted、`package.json` と `package-lock.json` が modified。

- [ ] **Step 2: コミット**

```bash
git add src/compile.js package.json package-lock.json
git commit -m "fix: remove obsolete compile.js and removeNPMAbsolutePaths dependency"
```
