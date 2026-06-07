# 統合テストの改行コード差異対応 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows での `npm run test:integration` のスナップショットテスト 17 件の失敗（CRLF vs LF 不一致）を解消する。テスト側で改行を正規化（堅牢性）し、`.gitattributes` で期待値フィクスチャを LF 固定（決定性）する。`src/` は変更しない。

**Architecture:** `normalizeHtml()` に CRLF/CR→LF 正規化を追加し、生成側・期待側の両方を同関数経由にする。加えてリポジトリ直下に `.gitattributes` を追加し、`test/integration/expected/*.html` を `eol=lf` に固定する。

**Tech Stack:** TypeScript, @vscode/test-cli (vscode-test), mocha

**Branch:** `develop` から `.worktrees/cross-platform-integration-tests`（`bugfix/cross-platform-integration-tests`）を作成済み。作業はこの worktree 内で行う。

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| Modify | `test/integration/extension.test.ts` | `normalizeHtml()` に CRLF→LF 正規化を追加、`expectedHtml` を `normalizeHtml()` 経由に変更 |
| Create | `.gitattributes` | 期待値フィクスチャを `eol=lf` に固定 |

---

### Task 1: テスト側の改行正規化

**Files:**
- Modify: `test/integration/extension.test.ts:9-13`（`normalizeHtml`）
- Modify: `test/integration/extension.test.ts:112-114`（`expectedHtml`）

- [ ] **Step 1: `normalizeHtml()` に CRLF/CR→LF 正規化を追加**

`replace(/\r\n?/g, '\n')` をチェーン先頭に追加する。

- [ ] **Step 2: `expectedHtml` を `normalizeHtml()` 経由にする**

`readFileSync` + タイトル置換の結果を `normalizeHtml()` でラップする。

- [ ] **Step 3: ビルド + 統合テストを実行して 0 failures を確認**

```powershell
npm run test:integration
```

Expected: スナップショットテスト 17 件を含む全テストが PASS。

---

### Task 2: `.gitattributes` で期待値フィクスチャを LF 固定

**Files:**
- Create: `.gitattributes`

- [ ] **Step 1: `.gitattributes` を作成**

```gitattributes
# Integration test fixtures must stay LF so the snapshot comparison
# matches the LF output produced by the extension on all platforms.
test/integration/expected/*.html text eol=lf
```

- [ ] **Step 2: 属性が効いているか確認**

```powershell
git check-attr -a test/integration/expected/breaks.html
git ls-files --eol test/integration/expected/
```

Expected: `eol: lf` が表示され、各ファイルが `w/lf`。

- [ ] **Step 3: インデックスを再正規化**

```powershell
git add --renormalize .
git status
```

Expected: 本作業コピーは既に LF のため、フィクスチャの差分は出ない見込み。

---

### Task 3: CRLF 状態での回帰検証（テスト側正規化の有効性確認）

**Files:**
- なし（一時的な検証のみ。変更はコミットしない）

- [ ] **Step 1: 期待値フィクスチャを意図的に CRLF 化**

```powershell
Get-ChildItem test/integration/expected/*.html | ForEach-Object {
  $c = [System.IO.File]::ReadAllText($_.FullName)
  $c = $c -replace "`r`n", "`n" -replace "`n", "`r`n"
  [System.IO.File]::WriteAllText($_.FullName, $c)
}
```

- [ ] **Step 2: 統合テストを実行して 0 failures を確認**

```powershell
npm run test:integration
```

Expected: CRLF 化した状態でも全テスト PASS（テスト側正規化が効いている）。

- [ ] **Step 3: フィクスチャを元の LF 状態に戻す**

```powershell
git checkout -- test/integration/expected/
```

---

### Task 4: コミット

**Files:**
- `test/integration/extension.test.ts`, `.gitattributes`, `docs/superpowers/specs/20260607-01-integration-test-line-endings-design.md`, `docs/superpowers/plans/20260607-01-integration-test-line-endings.md`

- [ ] **Step 1: 変更をコミット**

```powershell
git add test/integration/extension.test.ts .gitattributes docs/superpowers
git commit -m "fix: normalize line endings in integration snapshot tests for Windows"
```

---

### Task 5: ブランチ完了

- [ ] **Step 1: `develop` へのマージ（マージ確認ルールに従い、ユーザー承認後に実施）**

AGENTS.md のブランチ完了規約に従い、既定は `develop` へのローカルマージ。マージ操作前に確認メッセージを表示し、ユーザー承認を待つ。
