# PlantUML 記法の対等化（非推奨マーキング撤回）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先行 PR で付与した `` ```plantuml `` 推奨 / `@startuml` 非推奨というマーキングを全撤回し、両記法を対等な選択肢として提示し直す（未リリース状態の方針転換）。

**Architecture:** 実コードは無変更。変更対象は `package.json`（設定 UI の `deprecationMessage`）、`README.md` / `README.ja.md`（冒頭 CHANGELOG 抜粋・PlantUML セクション・Options List）、`CHANGELOG.md` 未リリース節、`sample/README.html`（再生成のみ）。

**Tech Stack:** Node.js / VS Code extension / markdown-it / npm scripts (`npm run sample`, `npm test`)

**Spec:** [`docs/superpowers/specs/20260420-02-plantuml-syntax-equal-footing-design.md`](../specs/20260420-02-plantuml-syntax-equal-footing-design.md)

**作業ブランチ:** `feature/plantuml-equal-footing`（develop から派生済み、`.worktrees/plantuml-equal-footing/`）

---

## ファイル構造

変更対象ファイル:

| ファイル | 変更種別 | 担当する責務 |
|---|---|---|
| `package.json` | 修正 | `plantumlOpenMarker` / `plantumlCloseMarker` から `deprecationMessage` キーを削除 |
| `CHANGELOG.md` | 修正 | 未リリース節 `X.Y.Z` の `### Changes` 内 2 行を中立文 1 行に再編 |
| `README.md` | 修正 | 冒頭 What's New・PlantUML セクション・PlantUML options を両記法対等の表現に書き換え |
| `README.ja.md` | 修正 | README.md と同じ情報量・構造で日本語側を書き換え |
| `sample/README.html` | 再生成 | `npm run sample` により README.md から自動生成（手動編集禁止） |

変更しないもの: `src/**`、`test/**`、旧 spec、旧 plan、他設定項目。

---

## Task 1: `package.json` から `deprecationMessage` を削除

**Files:**
- Modify: `package.json:888-898`

- [ ] **Step 1: 現状を確認**

Run: `grep -n "deprecationMessage" package.json`

Expected output:
```
892:          "deprecationMessage": "Deprecated. Use ```plantuml fenced code blocks instead. This setting is kept only for backward compatibility with the @startuml/@enduml block syntax."
898:          "deprecationMessage": "Deprecated. Use ```plantuml fenced code blocks instead. This setting is kept only for backward compatibility with the @startuml/@enduml block syntax."
```

- [ ] **Step 2: `plantumlOpenMarker` から `deprecationMessage` を削除**

`package.json:888-893` の置換（Edit tool, `replace_all: false`）:

old_string:
```json
        "markdown-pdf.plantumlOpenMarker": {
          "type": "string",
          "default": "@startuml",
          "description": "Oppening delimiter used for the plantuml parser.",
          "deprecationMessage": "Deprecated. Use ```plantuml fenced code blocks instead. This setting is kept only for backward compatibility with the @startuml/@enduml block syntax."
        },
```

new_string:
```json
        "markdown-pdf.plantumlOpenMarker": {
          "type": "string",
          "default": "@startuml",
          "description": "Oppening delimiter used for the plantuml parser."
        },
```

注意: `description` 末尾のカンマを削除する（最後のキーになるため）。`Oppening` の既存 typo は **本タスクでは修正しない**（スコープ外・別 PR で扱う）。

- [ ] **Step 3: `plantumlCloseMarker` から `deprecationMessage` を削除**

`package.json:894-899` の置換:

old_string:
```json
        "markdown-pdf.plantumlCloseMarker": {
          "type": "string",
          "default": "@enduml",
          "description": "Closing delimiter used for the plantuml parser.",
          "deprecationMessage": "Deprecated. Use ```plantuml fenced code blocks instead. This setting is kept only for backward compatibility with the @startuml/@enduml block syntax."
        },
```

new_string:
```json
        "markdown-pdf.plantumlCloseMarker": {
          "type": "string",
          "default": "@enduml",
          "description": "Closing delimiter used for the plantuml parser."
        },
```

- [ ] **Step 4: JSON 構文を検証**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && echo OK`

Expected output: `OK`

- [ ] **Step 5: grep で全件削除を確認**

Run: `grep -n "deprecationMessage" package.json || echo "no matches"`

Expected output: `no matches`

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "feat(plantuml): drop deprecationMessage from plantumlOpenMarker/CloseMarker

Retract the deprecation marking introduced in the preceding feature
branch. With ```plantuml and @startuml positioned as equal-footing
syntaxes, the settings UI no longer needs a Deprecated warning."
```

---

## Task 2: `CHANGELOG.md` 未リリース節を中立表現に書き換え

**Files:**
- Modify: `CHANGELOG.md:17-18`

- [ ] **Step 1: 現状を確認**

Run: `sed -n '14,21p' CHANGELOG.md`

Expected output: 14〜20 行目が以下を含む:
- L16 sanitize 行
- L17 "Add support for ```plantuml ... as the recommended PlantUML syntax ..."
- L18 "Deprecate the `@startuml` / `@enduml` ..."
- L19 chromium.autoDownload 行

- [ ] **Step 2: L17〜L18 を 1 行に書き換え**

`CHANGELOG.md` の置換:

old_string:
```
* Add support for `` ```plantuml `` fenced code blocks as the recommended PlantUML syntax (the same form used by VS Code preview, GitHub, and GitLab) [#92](https://github.com/yzane/vscode-markdown-pdf/issues/92) [#162](https://github.com/yzane/vscode-markdown-pdf/issues/162) [#389](https://github.com/yzane/vscode-markdown-pdf/issues/389)
* Deprecate the `@startuml` / `@enduml` block syntax and the `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` settings. They remain functional for backward compatibility, but the VS Code settings UI now shows them as deprecated.
```

new_string:
```
* Add support for `` ```plantuml `` fenced code blocks as a PlantUML syntax in addition to the existing `@startuml` / `@enduml` block markers. Both are supported on equal footing (same form used by VS Code preview, GitHub, and GitLab) [#92](https://github.com/yzane/vscode-markdown-pdf/issues/92) [#162](https://github.com/yzane/vscode-markdown-pdf/issues/162) [#389](https://github.com/yzane/vscode-markdown-pdf/issues/389)
```

- [ ] **Step 3: 書き換え結果を検証**

Run: `sed -n '14,20p' CHANGELOG.md`

Expected: L14 が `### Changes`、L16 sanitize 行、L17 が新しい中立文、L18 が chromium.autoDownload 行（Deprecate 行が消えている）。

Run: `grep -n "Deprecate\|recommended" CHANGELOG.md | grep -v "^## \|^### " | head`

Expected: 未リリース節 `X.Y.Z`（L1〜L20 付近）に `Deprecate` / `recommended` がヒットしないこと（古いリリース節のヒットは許容）。

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): reword plantuml fence note to equal-footing

Merge the prior 'Add' + 'Deprecate' pair into a single neutral entry
that presents \`\`\`plantuml and @startuml as equal-footing syntaxes.
Issue references (#92, #162, #389) are preserved."
```

---

## Task 3: `README.md` の PlantUML 関連 3 箇所を書き換え

**Files:**
- Modify: `README.md:40-43` (What's New)
- Modify: `README.md:145-172` (PlantUML セクション本体)
- Modify: `README.md:711-721` (PlantUML options)

- [ ] **Step 1: 現状を確認**

Run: `grep -n "plantuml\|PlantUML\|startuml\|enduml\|Deprecated\|recommended" README.md`

想定される主なヒット:
- L40, L42: What's New の 2 行
- L145 〜 L172 付近: PlantUML 本文セクション
- L711 〜 L721 付近: PlantUML options

- [ ] **Step 2: What's New セクション（L40〜L43）を書き換え**

old_string:
```markdown
- Added support for ` ```plantuml ` fenced code blocks as the recommended PlantUML syntax (the same form used by VS Code preview, GitHub, and GitLab). The legacy `@startuml` / `@enduml` block syntax still works for backward compatibility.
    - Details: [PlantUML](#plantuml)
- Deprecated the `@startuml` / `@enduml` block markers and the `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` settings. They remain functional for backward compatibility, but the VS Code settings UI now marks them as deprecated.
    - Details: [PlantUML](#plantuml)
```

new_string:
```markdown
- Added support for ` ```plantuml ` fenced code blocks as a PlantUML syntax, in addition to the existing `@startuml` / `@enduml` block markers. Both are supported on equal footing (the fence form is the same one used by VS Code preview, GitHub, and GitLab).
    - Details: [PlantUML](#plantuml)
```

- [ ] **Step 3: PlantUML 本文セクション（L145〜L172）を書き換え**

old_string:
```markdown
### PlantUML

Render UML diagrams via [PlantUML](https://plantuml.com/) using [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml).

The recommended syntax is the ```` ```plantuml ```` fenced code block, which is the same form used by VS Code's built-in Markdown preview, GitHub, and GitLab.

INPUT

````
```plantuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
```
````

OUTPUT

![PlantUML](images/PlantUML.png)

> **Backward compatibility (generally not recommended for new content):**
> The legacy `@startuml` / `@enduml` block syntax is also still supported.
>
> ```
> @startuml
> Bob -[#red]> Alice : hello
> Alice -[#0000FF]->Bob : ok
> @enduml
> ```
```

new_string:
```markdown
### PlantUML

Render UML diagrams via [PlantUML](https://plantuml.com/) using [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml).

Two equivalent syntaxes are supported. Both produce the same `<img>` tag and share the same [markdown-pdf.plantumlServer](#markdown-pdfplantumlserver) setting.

#### Fenced code block

A ```` ```plantuml ```` fenced code block. This is the same form used by VS Code's built-in Markdown preview, GitHub, and GitLab.

INPUT

````
```plantuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
```
````

#### Block markers

`@startuml` / `@enduml` block markers. The markers can be customized via [markdown-pdf.plantumlOpenMarker](#markdown-pdfplantumlopenmarker) and [markdown-pdf.plantumlCloseMarker](#markdown-pdfplantumlclosemarker).

INPUT

```
@startuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
@enduml
```

OUTPUT (either form produces the same image)

![PlantUML](images/PlantUML.png)
```

- [ ] **Step 4: PlantUML options セクション（L711〜L721）を書き換え**

old_string:
```markdown
#### `markdown-pdf.plantumlOpenMarker`
  - **Deprecated.** Use the ```` ```plantuml ```` fenced code block syntax shown in the [PlantUML](#plantuml) section instead. This setting is kept only for backward compatibility with the `@startuml` / `@enduml` block syntax.
  - Opening delimiter used for the plantuml parser.
  - Default: @startuml

#### `markdown-pdf.plantumlCloseMarker`
  - **Deprecated.** Use the ```` ```plantuml ```` fenced code block syntax shown in the [PlantUML](#plantuml) section instead. This setting is kept only for backward compatibility with the `@startuml` / `@enduml` block syntax.
  - Closing delimiter used for the plantuml parser.
  - Default: @enduml
```

new_string:
```markdown
#### `markdown-pdf.plantumlOpenMarker`
  - Opening delimiter for the `@startuml` / `@enduml` block marker syntax. Change this if you want to use a different start marker.
  - Default: @startuml

#### `markdown-pdf.plantumlCloseMarker`
  - Closing delimiter for the `@startuml` / `@enduml` block marker syntax. Change this if you want to use a different end marker.
  - Default: @enduml
```

- [ ] **Step 5: PlantUML 関連箇所の文言監査**

Run: `awk '/^### PlantUML$/,/^### Include/' README.md | grep -nE "Deprecated|recommended" || echo "clean"`

Expected: `clean`

Run: `awk '/^### PlantUML options/,/^### [^P]/' README.md | grep -nE "Deprecated" || echo "clean"`

Expected: `clean`

Run: `sed -n '38,50p' README.md | grep -nE "Deprecated|recommended" || echo "clean"`

Expected: `clean`（What's New 節に残っていないこと）

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(readme): present plantuml syntaxes as equal footing (en)

Rewrite the What's New blurb, the PlantUML section body, and the
PlantUML options list so that \`\`\`plantuml and @startuml appear as
two equivalent syntaxes rather than recommended / deprecated pair."
```

---

## Task 4: `README.ja.md` の PlantUML 関連 3 箇所を書き換え（日本語ミラー）

**Files:**
- Modify: `README.ja.md:38-41` (What's New)
- Modify: `README.ja.md:143-170` (PlantUML セクション本体)
- Modify: `README.ja.md:708-718` (PlantUML options)

- [ ] **Step 1: 現状を確認**

Run: `grep -n "plantuml\|PlantUML\|startuml\|enduml\|非推奨\|推奨" README.ja.md`

- [ ] **Step 2: What's New セクション（L38〜L41）を書き換え**

old_string:
```markdown
- PlantUML の推奨記法として ```` ```plantuml ```` フェンスドコードブロックをサポートしました（VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式）。従来の `@startuml` / `@enduml` ブロック記法も後方互換のため引き続き利用可能です。
    - 詳細: [PlantUML](#plantuml)
- `@startuml` / `@enduml` ブロック記法および `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` 設定を非推奨化しました。後方互換のため動作は維持されますが、VS Code の設定 UI 上では非推奨として表示されます。
    - 詳細: [PlantUML](#plantuml)
```

new_string:
```markdown
- 既存の `@startuml` / `@enduml` ブロックマーカー記法に加えて、```` ```plantuml ```` フェンスドコードブロック記法にも対応しました（フェンス記法は VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式）。両者は対等にサポートされます。
    - 詳細: [PlantUML](#plantuml)
```

- [ ] **Step 3: PlantUML 本文セクション（L143〜L170）を書き換え**

old_string:
```markdown
### PlantUML

[markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml) を使って [PlantUML](https://plantuml.com/) の UML 図を生成します。

推奨記法は ```` ```plantuml ```` フェンス記法です（VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式）。

INPUT

````
```plantuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
```
````

OUTPUT

![PlantUML](images/PlantUML.png)

> **後方互換（新規利用は基本的に非推奨）:**
> 従来の `@startuml` / `@enduml` 形式も引き続き利用できます。
>
> ```
> @startuml
> Bob -[#red]> Alice : hello
> Alice -[#0000FF]->Bob : ok
> @enduml
> ```
```

new_string:
```markdown
### PlantUML

[markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml) を使って [PlantUML](https://plantuml.com/) の UML 図を生成します。

2 つの記法を対等にサポートします。どちらの記法でも同じ `<img>` タグにレンダリングされ、[markdown-pdf.plantumlServer](#markdown-pdfplantumlserver) 設定を共有します。

#### フェンスドコードブロック記法

```` ```plantuml ```` フェンスドコードブロック記法です。VS Code 標準の Markdown プレビュー・GitHub・GitLab と同じ書式です。

INPUT

````
```plantuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
```
````

#### ブロックマーカー記法

`@startuml` / `@enduml` ブロックマーカー記法です。マーカーは [markdown-pdf.plantumlOpenMarker](#markdown-pdfplantumlopenmarker) / [markdown-pdf.plantumlCloseMarker](#markdown-pdfplantumlclosemarker) 設定でカスタマイズできます。

INPUT

```
@startuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
@enduml
```

OUTPUT（どちらの記法でも同じ画像が生成されます）

![PlantUML](images/PlantUML.png)
```

- [ ] **Step 4: PlantUML options セクション（L708〜L718）を書き換え**

old_string:
```markdown
#### `markdown-pdf.plantumlOpenMarker`
  - **非推奨。** [PlantUML](#plantuml) セクションに記載の ```` ```plantuml ```` フェンス記法を使ってください。この設定は `@startuml` / `@enduml` ブロック記法との後方互換のためにのみ残しています。
  - plantuml パーサーの開始区切り文字
  - Default: @startuml

#### `markdown-pdf.plantumlCloseMarker`
  - **非推奨。** [PlantUML](#plantuml) セクションに記載の ```` ```plantuml ```` フェンス記法を使ってください。この設定は `@startuml` / `@enduml` ブロック記法との後方互換のためにのみ残しています。
  - plantuml パーサーの終了区切り文字
  - Default: @enduml
```

new_string:
```markdown
#### `markdown-pdf.plantumlOpenMarker`
  - `@startuml` / `@enduml` ブロックマーカー記法で使用する開始区切り文字です。別の開始マーカーを使いたい場合に変更します。
  - Default: @startuml

#### `markdown-pdf.plantumlCloseMarker`
  - `@startuml` / `@enduml` ブロックマーカー記法で使用する終了区切り文字です。別の終了マーカーを使いたい場合に変更します。
  - Default: @enduml
```

- [ ] **Step 5: PlantUML 関連箇所の文言監査**

Run: `awk '/^### PlantUML$/,/^### Include/' README.ja.md | grep -nE "非推奨|推奨|Deprecated|recommended" || echo "clean"`

Expected: `clean`

Run: `awk '/^### PlantUML options/,/^### [^P]/' README.ja.md | grep -nE "非推奨|Deprecated" || echo "clean"`

Expected: `clean`

Run: `sed -n '36,48p' README.ja.md | grep -nE "非推奨|推奨|Deprecated|recommended" || echo "clean"`

Expected: `clean`（What's New 節に残っていないこと）

注意: README.ja.md の他節（例: `"none"` サニタイズ非推奨注記、`X.Y.Z` Breaking Changes の "非推奨" 等）にはヒットする可能性があるが、本タスクのスコープ外。`awk` で PlantUML 関連部分に絞って監査している。

- [ ] **Step 6: Commit**

```bash
git add README.ja.md
git commit -m "docs(readme-ja): present plantuml syntaxes as equal footing (ja)

Japanese mirror of the English README update: rewrite the What's New
blurb, PlantUML section body, and options list so that \`\`\`plantuml
and @startuml appear as two equivalent syntaxes."
```

---

## Task 5: `sample/README.html` を再生成

**Files:**
- Regenerate: `sample/README.html`
- Regenerate: `sample/README.pdf`（同一スクリプトで一緒に更新される可能性あり）

- [ ] **Step 1: 再生成コマンドを実行**

Run: `npm run sample`

Expected: `vscode-test --config .vscode-test.mjs --label sample` が走り、`convert README.md to all formats and copy to sample/` テストが成功する。実行時間は数十秒〜数分。

注意: VS Code extension host と Chromium を使うため、WSL 環境ではディスプレイバッファ (Xvfb) が必要になる場合がある。失敗した場合は `.vscode-test.mjs` と既存の generate-sample.ts 構成を確認すること。

- [ ] **Step 2: 差分を確認**

Run: `git status sample/`

Expected: `sample/README.html` が modified（必要に応じ `sample/README.pdf` 等も）。

Run: `git diff sample/README.html | head -100`

Expected: What's New 節・PlantUML セクション・PlantUML options の 3 箇所が README.md の新文面に同期していること。

- [ ] **Step 3: 再生成結果の文言監査**

Run: `grep -nE "Deprecated|recommended" sample/README.html | grep -i plantuml || echo "clean"`

Expected: `clean`（`Deprecated` / `recommended` が PlantUML 関連箇所に残らない）。

注意: sample/README.html は HTML エスケープが効くため、` ```plantuml ` は `<code>` タグ内に入る。grep のノイズを減らすため `-i plantuml` で PlantUML 関連に絞っている。

- [ ] **Step 4: Commit**

```bash
git add sample/
git commit -m "docs(sample): regenerate sample with plantuml equal-footing wording

Regenerated via \`npm run sample\` to mirror the README.md updates
(What's New, PlantUML section body, PlantUML options list)."
```

---

## Task 6: 全体検証

**Files:** N/A（検証のみ）

- [ ] **Step 1: package.json の JSON 構文を再確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && echo OK`

Expected: `OK`

- [ ] **Step 2: 単体テストを実行**

Run: `npm run test:unit`

Expected: すべてのテスト pass。

- [ ] **Step 3: 統合テストを実行**

Run: `npm run test:integration`

Expected: すべてのテスト pass。とくに以下が通ること:
- `plantuml.md` / `expected/plantuml.html`（経路 A: `@startuml` / `@enduml`）
- `plantuml-custom-marker.md` / `expected/plantuml-custom-marker.html`（経路 A: `plantumlOpenMarker` ワークアラウンド）
- `plantuml-fence.md` / `expected/plantuml-fence.html`（経路 B: `` ```plantuml `` フェンス）

注意: WSL 環境では Chromium ダウンロードが必要。失敗時は既存 `plantuml` 関連 fixture がそのままか確認する。

- [ ] **Step 4: 全体の文言監査（PlantUML 関連ドキュメント）**

Run: `awk '/^### PlantUML$/,/^### Include/' README.md README.ja.md | grep -nE "Deprecated|deprecated|recommended|非推奨|推奨" || echo "clean"`

Expected: `clean`

Run: `awk '/^### PlantUML options/,/^### [^P]/' README.md README.ja.md | grep -nE "Deprecated|deprecated|non推奨|非推奨" || echo "clean"`

Expected: `clean`

Run: `sed -n '1,25p' CHANGELOG.md | grep -nE "Deprecate|recommended" || echo "clean"`

Expected: `clean`（未リリース節 `X.Y.Z` に非推奨・推奨の語が残らない）

Run: `grep -n "deprecationMessage" package.json || echo "clean"`

Expected: `clean`

- [ ] **Step 5: git log を確認**

Run: `git log --oneline feature/plantuml-equal-footing ^develop`

Expected: 計 6 コミット。内訳は spec コミット（`f050e93` "docs(plantuml): add spec for equal-footing policy..."）＋ Task 1〜5 分の 5 コミット（package.json, CHANGELOG, README.md, README.ja.md, sample/）。Task 6 はコミットなし。

- [ ] **Step 6: マージ判断（AGENTS.md に従い確認を取る）**

マージは行わず、**ユーザに確認を取って承認を待つ**。AGENTS.md:
> Before any merge operation (integration into another branch, including `git merge` and PR merges), show a confirmation message and wait for user approval — even in auto-accept mode.

ユーザへの提示内容:
- ブランチ `feature/plantuml-equal-footing` のコミット一覧
- 主要差分の要約（package.json 2 箇所、README 英/日、CHANGELOG、sample/README.html）
- 既存テストが通ったこと
- `develop` への `--no-ff` マージを提案（ユーザメモリ: "Always use --no-ff merge commits for feature branches"）

承認を得たら以下:

```bash
# .worktrees/plantuml-equal-footing の外で実行（git worktree の制約）
git -C /home/z/dev/github/vscode-markdown-pdf checkout develop
git -C /home/z/dev/github/vscode-markdown-pdf merge --no-ff feature/plantuml-equal-footing
```

マージ後に worktree のクリーンアップを行う:

```bash
git -C /home/z/dev/github/vscode-markdown-pdf worktree remove .worktrees/plantuml-equal-footing
```

---

## 受け入れ基準（spec 5d 対応）

1. ✅ `package.json` の `plantumlOpenMarker` / `plantumlCloseMarker` から `deprecationMessage` が消えている（Task 1, Task 6 Step 4）
2. ✅ README の PlantUML セクションで `` ```plantuml `` が先頭、`@startuml` が後続になっている（Task 3 Step 3 / Task 4 Step 3）
3. ✅ README の PlantUML セクション・Options List・冒頭 CHANGELOG 抜粋に `Deprecated` / `非推奨` / `recommended` / `推奨` が残っていない（Task 3 Step 5 / Task 4 Step 5 / Task 6 Step 4）
4. ✅ CHANGELOG 未リリース節から `Deprecate` 行が消え、`Add support` 行が中立文に書き換わっている（issue 参照保持）（Task 2 Step 3 / Task 6 Step 4）
5. ✅ `sample/README.html` が再生成され、README 変更が反映されている（Task 5 Step 3）
6. ✅ 既存の単体テスト・統合テストがすべて通る（Task 6 Step 2, 3）
7. ✅ 新 spec と本 plan が新規追加され、旧 spec `20260418-02-plantuml-fence-support-design.md` は未変更（spec は既にコミット済み `f050e93`）
8. ✅ `feature/plantuml-equal-footing` ブランチで作業され、マージ前にユーザ確認を取る（Task 6 Step 6）
