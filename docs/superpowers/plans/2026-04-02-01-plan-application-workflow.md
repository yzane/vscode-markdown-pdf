# superpowers plan適用ワークフロー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/plans/` にある既存 plan を番号順に適用し、各 plan を `feature/*` ブランチ単位で完結させて `develop` へ順次マージできる状態にする。

**Architecture:** 実装は `docs/superpowers/specs/2026-04-02-01-plan-application-workflow-design.md` を運用仕様として進める。各 task では対象 plan / spec を確認し、`develop` から専用 `feature/*` ブランチを作成し、対象 plan の実装・狭い検証・必要最小限の文書補正を完了させたうえで `develop` にマージする。

**Tech Stack:** Git, Node.js, npm, Mocha, VS Code extension test runner, Markdown

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `docs/superpowers/specs/2026-04-02-01-plan-application-workflow-design.md` | 実行順、ブランチ運用、補正方針、完了条件の基準 |
| `docs/superpowers/plans/2026-03-30-01-unit-tests.md` | 最初の抽出とユニットテスト導入 |
| `docs/superpowers/plans/2026-03-30-02-integration-tests.md` | 統合テスト導入 |
| `docs/superpowers/plans/2026-03-30-03-extract-and-test.md` | 追加抽出とテスト強化 |
| `docs/superpowers/plans/2026-03-30-04-edge-case-tests.md` | エッジケースのテスト追加 |
| `docs/superpowers/plans/2026-03-31-01-utils-path-tests.md` | パス解決系テストの深掘り |
| `docs/superpowers/plans/2026-03-31-02-test-documentation.md` | テスト文書整備 |
| `docs/superpowers/plans/2026-03-31-03-additional-tests.md` | 追加テスト |
| `docs/superpowers/plans/2026-03-31-04-test-readme-refresh.md` | `test/README` 更新 |
| `docs/superpowers/plans/2026-03-31-05-export-options-tests.md` | export options 系テスト |
| `docs/superpowers/plans/2026-03-31-06-extract-convert-html-tests.md` | `convertMarkdownToHtml()` 周辺抽出とテスト |
| `docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md` | 残存ロジック抽出 |

### Task 1: 実行前の基準を固定する

**Files:**
- Read: `docs/superpowers/specs/2026-04-02-01-plan-application-workflow-design.md`
- Read: `docs/superpowers/plans/2026-03-30-01-unit-tests.md`
- Read: `docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md`

- [ ] **Step 1: 運用 spec の成功基準を確認する**

Run: `sed -n '1,220p' docs/superpowers/specs/2026-04-02-01-plan-application-workflow-design.md`
Expected: 実行順、`plan 1件 = 1 feature branch = 1 develop へのマージ`、補正方針、完了条件の4項目を確認できる

- [ ] **Step 2: 先頭と末尾の plan を読んで粒度を再確認する**

Run: `sed -n '1,220p' docs/superpowers/plans/2026-03-30-01-unit-tests.md`
Expected: 初期段階で `src/utils.js` と `test/unit/utils.test.js` を導入する計画であることを確認できる

Run: `sed -n '1,220p' docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md`
Expected: 後半段階で既存の抽出パターンを前提に残存ロジックを抽出する計画であることを確認できる

- [ ] **Step 3: 実行対象一覧を作業メモとして固定する**

Run: `printf '%s\n' docs/superpowers/plans/2026-03-30-01-unit-tests.md docs/superpowers/plans/2026-03-30-02-integration-tests.md docs/superpowers/plans/2026-03-30-03-extract-and-test.md docs/superpowers/plans/2026-03-30-04-edge-case-tests.md docs/superpowers/plans/2026-03-31-01-utils-path-tests.md docs/superpowers/plans/2026-03-31-02-test-documentation.md docs/superpowers/plans/2026-03-31-03-additional-tests.md docs/superpowers/plans/2026-03-31-04-test-readme-refresh.md docs/superpowers/plans/2026-03-31-05-export-options-tests.md docs/superpowers/plans/2026-03-31-06-extract-convert-html-tests.md docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md`
Expected: 11件の実行対象が番号順で表示される

### Task 2: 各 plan の共通実行手順を固定する

**Files:**
- Read: `docs/superpowers/specs/2026-04-02-01-plan-application-workflow-design.md`

- [ ] **Step 1: 作業開始時のブランチ作成コマンドを確認する**

Run: `git switch develop`
Expected: `Already on 'develop'` または `Switched to branch 'develop'`

Run: `git pull --ff-only origin develop`
Expected: `Already up to date.` または fast-forward だけが適用される

Run: `git switch -c feature/unit-tests-bootstrap`
Expected: `Switched to a new branch 'feature/unit-tests-bootstrap'`

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git switch -c feature/integration-tests`
Expected: `Switched to a new branch 'feature/integration-tests'`

- [ ] **Step 2: plan 着手前の差分確認コマンドを確認する**

Run: `git status --short`
Expected: 対象 plan に着手する前のワークツリー状態を確認できる

Run: `sed -n '1,220p' docs/superpowers/plans/2026-03-30-01-unit-tests.md`
Expected: 対象 plan の Goal、Architecture、Task 構成を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-30-01-unit-tests-design.md`
Expected: 対応 spec の意図とスコープを確認できる

- [ ] **Step 3: 完了時の統一確認コマンドを確認する**

Run: `git diff --stat develop...HEAD`
Expected: 差分が対象 plan のスコープに閉じていることを確認できる

Run: `git status --short`
Expected: コミット後はクリーン、または merge 前に説明可能な状態であることを確認できる

Run: `git switch develop`
Expected: `develop` へ戻る

Run: `git merge --no-ff feature/unit-tests-bootstrap`
Expected: 対象 plan の branch が `develop` にマージされる

### Task 3: `2026-03-30-01-unit-tests` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-30-01-unit-tests.md`
- Read: `docs/superpowers/specs/2026-03-30-01-unit-tests-design.md`
- Modify: `src/utils.js`
- Modify: `test/unit/utils.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `extension.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/unit-tests-bootstrap`
Expected: `Switched to a new branch 'feature/unit-tests-bootstrap'`

- [ ] **Step 2: plan / spec を確認して現行コードとの差分を洗い出す**

Run: `sed -n '1,260p' docs/superpowers/plans/2026-03-30-01-unit-tests.md`
Expected: `src/utils.js` 作成、`test/unit/utils.test.js` 作成、`test:unit` 導入の流れを確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-30-01-unit-tests-design.md`
Expected: 抽出対象とテスト対象の意図を確認できる

Run: `git status --short`
Expected: 対象外の差分がないことを確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,320p' docs/superpowers/plans/2026-03-30-01-unit-tests.md`
Expected: 実装対象、テスト対象、コミット単位を確認しながら全 Step を実行できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: `test/unit/**/*.test.js` が PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/unit-tests-bootstrap`
Expected: `feature/unit-tests-bootstrap` の変更が `develop` に入る

### Task 4: `2026-03-30-02-integration-tests` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-30-02-integration-tests.md`
- Read: `docs/superpowers/specs/2026-03-30-02-integration-tests-design.md`
- Modify: `test/integration/extension.test.js`
- Modify: `test/integration/fixtures/*`
- Modify: `test/integration/expected/*`
- Modify: `package.json`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/integration-tests`
Expected: `Switched to a new branch 'feature/integration-tests'`

- [ ] **Step 2: plan / spec と現行構成を照合する**

Run: `sed -n '1,260p' docs/superpowers/plans/2026-03-30-02-integration-tests.md`
Expected: 統合テスト導入の手順を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-30-02-integration-tests-design.md`
Expected: fixture / expected / runner の責務を確認できる

Run: `rg --files test`
Expected: `test/` 配下の現行構成を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,320p' docs/superpowers/plans/2026-03-30-02-integration-tests.md`
Expected: 既存 plan を基準に必要な補正を入れながら実装できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:integration`
Expected: 統合テストが PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/integration-tests`
Expected: `feature/integration-tests` の変更が `develop` に入る

### Task 5: `2026-03-30-03-extract-and-test` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-30-03-extract-and-test.md`
- Read: `docs/superpowers/specs/2026-03-30-03-extract-and-test-design.md`
- Modify: `extension.js`
- Modify: `src/utils.js`
- Modify: `test/unit/utils.test.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/extract-and-test`
Expected: `Switched to a new branch 'feature/extract-and-test'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,280p' docs/superpowers/plans/2026-03-30-03-extract-and-test.md`
Expected: 抽出対象関数とテスト追加対象を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-30-03-extract-and-test-design.md`
Expected: 既存抽出パターンとの整合を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,340p' docs/superpowers/plans/2026-03-30-03-extract-and-test.md`
Expected: 現行コードに合わせて補正しつつ実装を完了できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: 抽出した関数のユニットテストを含めて PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/extract-and-test`
Expected: `feature/extract-and-test` の変更が `develop` に入る

### Task 6: `2026-03-30-04-edge-case-tests` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-30-04-edge-case-tests.md`
- Read: `docs/superpowers/specs/2026-03-30-04-edge-case-tests-design.md`
- Modify: `test/unit/utils.test.js`
- Modify: `test/integration/extension.test.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/edge-case-tests`
Expected: `Switched to a new branch 'feature/edge-case-tests'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,280p' docs/superpowers/plans/2026-03-30-04-edge-case-tests.md`
Expected: エッジケースの対象関数とテスト観点を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-30-04-edge-case-tests-design.md`
Expected: 現行挙動を固定する方針を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,340p' docs/superpowers/plans/2026-03-30-04-edge-case-tests.md`
Expected: 既存テストとの重複を避けながら追加ケースを実装できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: ユニットテストが PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/edge-case-tests`
Expected: `feature/edge-case-tests` の変更が `develop` に入る

### Task 7: `2026-03-31-01-utils-path-tests` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-31-01-utils-path-tests.md`
- Read: `docs/superpowers/specs/2026-03-31-01-utils-path-tests-design.md`
- Modify: `test/unit/utils.test.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/utils-path-tests`
Expected: `Switched to a new branch 'feature/utils-path-tests'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,320p' docs/superpowers/plans/2026-03-31-01-utils-path-tests.md`
Expected: `resolveHref` と `resolveOutputDir` の深掘り方針を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-31-01-utils-path-tests-design.md`
Expected: パス解決規則ごとの整理方針を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,360p' docs/superpowers/plans/2026-03-31-01-utils-path-tests.md`
Expected: 既存ケースを壊さずに追加と並び替えを完了できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: パス解決系を含めてユニットテストが PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/utils-path-tests`
Expected: `feature/utils-path-tests` の変更が `develop` に入る

### Task 8: `2026-03-31-02-test-documentation` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-31-02-test-documentation.md`
- Read: `docs/superpowers/specs/2026-03-31-02-test-documentation-design.md`
- Modify: `docs/superpowers/plans/2026-03-31-02-test-documentation.md`
- Modify: `docs/superpowers/specs/2026-03-31-02-test-documentation-design.md`
- Modify: `test/README.md`
- Modify: `test/README.ja.md`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/test-documentation`
Expected: `Switched to a new branch 'feature/test-documentation'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,280p' docs/superpowers/plans/2026-03-31-02-test-documentation.md`
Expected: 文書整備の対象と更新方針を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-31-02-test-documentation-design.md`
Expected: 英日ドキュメントの整合条件を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,340p' docs/superpowers/plans/2026-03-31-02-test-documentation.md`
Expected: 文書だけの変更として必要範囲を更新できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `git diff -- test/README.md test/README.ja.md docs/superpowers`
Expected: 意図した文書差分だけを確認できる

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/test-documentation`
Expected: `feature/test-documentation` の変更が `develop` に入る

### Task 9: `2026-03-31-03-additional-tests` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-31-03-additional-tests.md`
- Read: `docs/superpowers/specs/2026-03-31-03-additional-tests-design.md`
- Modify: `test/unit/utils.test.js`
- Modify: `test/integration/extension.test.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/additional-tests`
Expected: `Switched to a new branch 'feature/additional-tests'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,280p' docs/superpowers/plans/2026-03-31-03-additional-tests.md`
Expected: 追加テストの対象範囲を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-31-03-additional-tests-design.md`
Expected: 既存テストとの棲み分けを確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,340p' docs/superpowers/plans/2026-03-31-03-additional-tests.md`
Expected: 重複を避けて追加ケースを実装できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: ユニットテストが PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/additional-tests`
Expected: `feature/additional-tests` の変更が `develop` に入る

### Task 10: `2026-03-31-04-test-readme-refresh` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-31-04-test-readme-refresh.md`
- Read: `docs/superpowers/specs/2026-03-31-04-test-readme-refresh-design.md`
- Modify: `test/README.md`
- Modify: `test/README.ja.md`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/test-readme-refresh`
Expected: `Switched to a new branch 'feature/test-readme-refresh'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,280p' docs/superpowers/plans/2026-03-31-04-test-readme-refresh.md`
Expected: README 更新の対象と観点を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-31-04-test-readme-refresh-design.md`
Expected: 英日 README の整合方針を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,320p' docs/superpowers/plans/2026-03-31-04-test-readme-refresh.md`
Expected: テストコードの現状に合わせて README を更新できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `git diff -- test/README.md test/README.ja.md`
Expected: README 2ファイルに意図した差分だけが出る

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/test-readme-refresh`
Expected: `feature/test-readme-refresh` の変更が `develop` に入る

### Task 11: `2026-03-31-05-export-options-tests` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-31-05-export-options-tests.md`
- Read: `docs/superpowers/specs/2026-03-31-05-export-options-tests-design.md`
- Modify: `test/unit/utils.test.js`
- Modify: `extension.js`
- Modify: `src/utils.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/export-options-tests`
Expected: `Switched to a new branch 'feature/export-options-tests'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,300p' docs/superpowers/plans/2026-03-31-05-export-options-tests.md`
Expected: export options 系の観点を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-31-05-export-options-tests-design.md`
Expected: 抽出方針とテスト対象を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,360p' docs/superpowers/plans/2026-03-31-05-export-options-tests.md`
Expected: 現行コードに合わせて補正しながら実装できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: export options 関連のユニットテストが PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/export-options-tests`
Expected: `feature/export-options-tests` の変更が `develop` に入る

### Task 12: `2026-03-31-06-extract-convert-html-tests` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-03-31-06-extract-convert-html-tests.md`
- Read: `docs/superpowers/specs/2026-03-31-06-extract-convert-html-tests-design.md`
- Modify: `extension.js`
- Modify: `src/utils.js`
- Modify: `test/unit/utils.test.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/extract-convert-html-tests`
Expected: `Switched to a new branch 'feature/extract-convert-html-tests'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,300p' docs/superpowers/plans/2026-03-31-06-extract-convert-html-tests.md`
Expected: `convertMarkdownToHtml()` 周辺の抽出対象とテスト対象を確認できる

Run: `sed -n '1,220p' docs/superpowers/specs/2026-03-31-06-extract-convert-html-tests-design.md`
Expected: 抽出境界と想定依存を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,380p' docs/superpowers/plans/2026-03-31-06-extract-convert-html-tests.md`
Expected: `extension.js` と `utils.js` の責務分離を進められる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: 抽出した HTML 変換ロジックのユニットテストが PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/extract-convert-html-tests`
Expected: `feature/extract-convert-html-tests` の変更が `develop` に入る

### Task 13: `2026-04-01-01-extract-remaining-logic` を適用する

**Files:**
- Read: `docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md`
- Read: `docs/superpowers/specs/2026-04-01-01-extract-remaining-logic-design.md`
- Modify: `extension.js`
- Modify: `src/utils.js`
- Modify: `test/unit/utils.test.js`

- [ ] **Step 1: 専用 branch を作成する**

Run: `git switch develop`
Expected: `develop` にいる

Run: `git switch -c feature/extract-remaining-logic`
Expected: `Switched to a new branch 'feature/extract-remaining-logic'`

- [ ] **Step 2: plan / spec を確認する**

Run: `sed -n '1,320p' docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md`
Expected: 残存ロジック6件の抽出対象と順序を確認できる

Run: `sed -n '1,240p' docs/superpowers/specs/2026-04-01-01-extract-remaining-logic-design.md`
Expected: 後半段階の抽出境界と低優先項目を確認できる

- [ ] **Step 3: 対象 plan の全手順を完了する**

Run: `sed -n '1,420p' docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md`
Expected: 既存の抽出パターンを踏襲して実装を完了できる

- [ ] **Step 4: 狭い検証を実行する**

Run: `npm run test:unit`
Expected: 抽出した残存ロジックのユニットテストが PASS する

- [ ] **Step 5: `develop` にマージする**

Run: `git switch develop`
Expected: `develop` に戻る

Run: `git merge --no-ff feature/extract-remaining-logic`
Expected: `feature/extract-remaining-logic` の変更が `develop` に入る

### Task 14: 全体完了を確認する

**Files:**
- Read: `docs/superpowers/specs/2026-04-02-01-plan-application-workflow-design.md`
- Read: `docs/superpowers/plans/2026-04-02-01-plan-application-workflow.md`

- [ ] **Step 1: 最終的な実行対象一覧が完了したか確認する**

Run: `sed -n '1,220p' docs/superpowers/specs/2026-04-02-01-plan-application-workflow-design.md`
Expected: 11件の対象 plan がすべて順次適用済みであることを照合できる

- [ ] **Step 2: `develop` 上の履歴で feature ごとの統合を確認する**

Run: `git log --oneline --decorate --graph develop -20`
Expected: 各 `feature/*` のマージ履歴を確認できる

- [ ] **Step 3: 最終状態を確認する**

Run: `git status --short`
Expected: ワークツリーがクリーンである
