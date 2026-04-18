# PlantUML フェンス記法サポート 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ` ```plantuml ... ``` ` フェンス記法でも PlantUML 図にレンダリングされるようにする（既存の `@startuml`/`@enduml` ブロックは無改造で維持）。

**Architecture:** `markdown-it-plantuml` プラグインは `@startuml`/`@enduml` 経路のためそのまま残し、`md.renderer.rules.fence` を上書きして `info==='plantuml'` の場合だけ自前のヘルパで `<img>` を生成する。両経路で `markdown-pdf.plantumlServer` 設定を共有する。

**Tech Stack:** TypeScript, markdown-it, markdown-it-plantuml (既存), plantuml-encoder (新規追加), Mocha (統合テスト), node:test + assert (単体テスト), VS Code 拡張 API。

**Spec:** `docs/superpowers/specs/20260418-02-plantuml-fence-support-design.md`

**Branch:** `feature/plantuml-fence-support`（現在の worktree。実装中も維持）

**前提となる動作確認**:

- baseline で `npm test` が 18 passing になっている（このプラン作成時点で確認済み）。各タスク完了時に再実行する
- 作業はすべて `.worktrees/plantuml-fence-support/` 配下で行う

---

## Task 1: `plantuml-encoder` を依存に追加する

**Files:**
- Modify: `package.json`（`dependencies` に追加）
- Modify: `package-lock.json`（`npm install` で自動更新）

- [ ] **Step 1: 現状確認**

`package.json` の `dependencies` セクションに `markdown-it-plantuml` の隣あたりに `plantuml-encoder` を追加する位置を決める。アルファベット順に並んでいるなら同様に整列する。

実行: `grep -n '"markdown-it-plantuml"' package.json`

期待出力例: `945:    "markdown-it-plantuml": "^1.4.1",`

- [ ] **Step 2: 依存を追加**

```bash
npm install --save plantuml-encoder
```

`package.json` の `dependencies` に `"plantuml-encoder": "^1.x.x"` が追加され、`package-lock.json` が更新される。

- [ ] **Step 3: 既存テストが壊れていないことを確認**

実行: `npm test`

期待: 18 passing（plantuml-encoder の追加だけでは既存テストの結果は変わらない）

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json
git commit -m "build(deps): add plantuml-encoder for plantuml fence rendering"
```

---

## Task 2: `buildPlantumlImgTag` ヘルパを TDD で追加する

`@startuml`/`@enduml` 経路（経路 A）と同じ `<img>` タグを返す関数を `src/utils.ts` に追加する。経路 A は `markdown-it-plantuml` プラグインを使い `<img src="..." alt="uml diagram">` を出力するので、新規ヘルパも同じ形式に揃える。両者の同等性は単体テストでロックする。

**Files:**
- Modify: `src/utils.ts`（末尾あたりに新規関数を追加）
- Modify: `test/unit/utils.test.ts`（既存テストに `describe('buildPlantumlImgTag', …)` を追加）

- [ ] **Step 1: 失敗するテストを書く**

`test/unit/utils.test.ts` の末尾の `});`（最上位 `describe('utils', …)` の閉じ括弧）の **直前** に、以下の `describe` ブロックを追加する。

```typescript
  describe('buildPlantumlImgTag', function () {
    it('should produce an <img> tag whose src points to the encoded plantuml URL', function () {
      const source = 'Bob -> Alice : hello\n';
      const server = 'http://www.plantuml.com/plantuml';

      const result = utils.buildPlantumlImgTag(source, server);

      assert.match(result, /^<img src="http:\/\/www\.plantuml\.com\/plantuml\/svg\/[A-Za-z0-9_-]+" alt="uml diagram">$/);
    });

    it('should not throw on empty input and still return an <img> tag', function () {
      const result = utils.buildPlantumlImgTag('', 'http://www.plantuml.com/plantuml');
      assert.match(result, /^<img src="http:\/\/www\.plantuml\.com\/plantuml\/svg\/[A-Za-z0-9_-]*" alt="uml diagram">$/);
    });

    it('should produce the same <img> tag as markdown-it-plantuml plugin for the same source', async function () {
      const MarkdownIt = (await import('markdown-it')).default;
      const markdownItPlantuml = (await import('markdown-it-plantuml')).default;
      const server = 'http://www.plantuml.com/plantuml';
      const source = 'Bob -> Alice : hello\nAlice -> Bob : ok\n';

      const md = new MarkdownIt();
      md.use(markdownItPlantuml, { openMarker: '@startuml', closeMarker: '@enduml', server });
      const pluginRendered = md.render('@startuml\n' + source + '@enduml\n').trim();

      const helperRendered = utils.buildPlantumlImgTag(source, server);

      assert.strictEqual(helperRendered, pluginRendered);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

実行: `npx mocha --require ts-node/register test/unit/utils.test.ts`
（既存リポジトリのテストランナーコマンドが異なる場合は `npm test` のスクリプト定義を確認して合わせる。`grep -n '"test"' package.json` で確認できる）

期待: `buildPlantumlImgTag` は未定義のため 3 件の新規テストが TypeScript コンパイルエラーまたは「`utils.buildPlantumlImgTag is not a function`」で失敗する。

- [ ] **Step 3: 最小実装を追加**

`src/utils.ts` の末尾に、以下を追加する。`plantuml-encoder` には型定義が無い可能性があるので必要なら `// @ts-ignore` または小さな `.d.ts` を加える（次の Step で型定義を入れる方針）。

```typescript
import plantumlEncoder from 'plantuml-encoder';

/**
 * Builds an <img> tag for a PlantUML source string. The output matches the
 * <img> tag produced by markdown-it-plantuml so that both the @startuml/@enduml
 * path and the ```plantuml fence path render identically.
 */
export function buildPlantumlImgTag(source: string, server: string): string {
  const encoded = plantumlEncoder.encode(source);
  return '<img src="' + server + '/svg/' + encoded + '" alt="uml diagram">';
}
```

`import` 文はファイル先頭の他の `import` の隣（既存スタイルに合わせて）へ移動する。

- [ ] **Step 4: `plantuml-encoder` の型定義スタブを追加**

`plantuml-encoder` には公式型定義が無いため、`src/types/` にスタブを追加する。

ファイル新規作成: `src/types/plantuml-encoder.d.ts`

```typescript
declare module 'plantuml-encoder' {
  /**
   * Deflate + base64-encode a PlantUML source string into the URL-safe form
   * expected by PlantUML servers (e.g. http://www.plantuml.com/plantuml/svg/<encoded>).
   */
  export function encode(source: string): string;

  const _default: { encode: typeof encode };
  export default _default;
}
```

- [ ] **Step 5: テストが通ることを確認**

実行: `npm test`

期待: 既存 18 + 新規 3 = 21 passing。

特に 3 番目のテスト（プラグインとのバイト一致）が通ることが重要。失敗する場合は原因を切り分ける:
- `plantuml-encoder.encode` と `markdown-it-plantuml` 内部の `lib/deflate.js` が異なる結果を返している可能性
- 入力に末尾改行などの違いがある可能性 → 必要なら `source` を `String(source)` で正規化、または末尾改行の扱いをプラグインに合わせる

修正が必要なら `buildPlantumlImgTag` 内で normalize してから encode する。

- [ ] **Step 6: コミット**

```bash
git add src/utils.ts src/types/plantuml-encoder.d.ts test/unit/utils.test.ts
git commit -m "feat(utils): add buildPlantumlImgTag helper for plantuml fence rendering"
```

---

## Task 3: `extension.ts` に fence レンダラの上書きを組み込む

`md.use(markdownItPlantuml, plantumlOptions)` の **直後** で `md.renderer.rules.fence` を上書きする。`info` トリミング後・小文字化後に `'plantuml'` と一致したら `buildPlantumlImgTag` を呼び、それ以外は元の fence レンダラへ委譲する。

**Files:**
- Modify: `src/extension.ts:249` 付近（`md.use(markdownItPlantuml, plantumlOptions);` の直後）

- [ ] **Step 1: 該当箇所を読み返す**

実行: `sed -n '240,260p' src/extension.ts`

期待: 以下のような構造が見える。

```typescript
      // PlantUML
      // https://github.com/gmunguia/markdown-it-plantuml
      const plantumlOptions = utils.buildPlantumlOptions({ ... });
      md.use(markdownItPlantuml, plantumlOptions);

      // Include markdown fragment files...
```

- [ ] **Step 2: fence レンダラ上書きを追加**

`md.use(markdownItPlantuml, plantumlOptions);` の直後、`// Include markdown fragment files` コメントの **前** に以下を挿入する。

```typescript
      // ```plantuml fenced code blocks render as PlantUML diagrams alongside the
      // @startuml/@enduml block syntax handled by markdown-it-plantuml above.
      const defaultFenceRenderer = md.renderer.rules.fence;
      md.renderer.rules.fence = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        if (token.info.trim().toLowerCase() === 'plantuml') {
          return utils.buildPlantumlImgTag(token.content, plantumlOptions.server);
        }
        if (defaultFenceRenderer) {
          return defaultFenceRenderer(tokens, idx, options, env, self);
        }
        return self.renderToken(tokens, idx, options);
      };
```

`defaultFenceRenderer` が undefined になるケース（markdown-it のバージョン次第）に備えて `self.renderToken` フォールバックを入れる。

- [ ] **Step 3: 型エラーが無いことを確認**

実行: `npx tsc --noEmit`（このリポジトリの type-check スクリプトがあれば `npm run` でも可。`grep -n '"compile\\|type"' package.json` で確認）

期待: エラーなし。

- [ ] **Step 4: 既存テストが壊れていないことを確認**

実行: `npm test`

期待: 21 passing（Task 2 で追加した 3 件含む）。`@startuml`/`@enduml` 経路や `plantumlOpenMarker` 設定経路の既存統合テストが赤くなっていないことが重要。

- [ ] **Step 5: コミット**

```bash
git add src/extension.ts
git commit -m "feat(extension): render \`\`\`plantuml fences alongside @startuml/@enduml"
```

---

## Task 4: 統合テスト fixture と期待 HTML を追加する

`@startuml` 経路の既存 fixture と同じパターンで、フェンス経路の fixture と期待スナップショットを追加する。

**Files:**
- Create: `test/integration/fixtures/plantuml-fence.md`
- Create: `test/integration/expected/plantuml-fence.html`
- Modify: `test/integration/extension.test.ts` の `HTML_FEATURES` 配列に `{ name: 'plantuml-fence' }` を追加

- [ ] **Step 1: fixture を作成**

ファイル新規作成: `test/integration/fixtures/plantuml-fence.md`

`````markdown
# PlantUML fence

```plantuml
Bob -> Alice : hello
Alice -> Bob : ok
```
`````

注意: 上記の **外側の 5 連バッククォートはこのプラン上の表示用** であり、実際のファイル内容は内側の `# PlantUML fence` から `` ``` `` までの **3 連バッククォートを含む素のテキスト** をそのまま書き込む。

- [ ] **Step 2: `HTML_FEATURES` 配列にエントリを追加**

`test/integration/extension.test.ts:61-76` の `HTML_FEATURES` 配列に、`{ name: 'plantuml-custom-marker' }` の **次** に `{ name: 'plantuml-fence' }` を追加する。

差分例:

```typescript
  { name: 'plantuml-custom-marker' },
  { name: 'plantuml-fence' },
  { name: 'frontmatter-breaks' },
```

- [ ] **Step 3: 期待 HTML をテスト実行で生成する**

期待 HTML はバイト単位で比較されるので、まず実際に拡張を走らせて生成 HTML を取得し、それを期待ファイルとして保存する。手順:

1. テストを 1 件だけ実行して生成 HTML を取得する。
   実行: `npx mocha --grep 'plantuml-fence: HTML snapshot' --timeout 60000` （または既存の test スクリプト経由）

2. テストは「期待ファイルが存在しない」または「内容不一致」で失敗するが、**一度でも実行すれば** 生成 HTML が `test/integration/fixtures/plantuml-fence.html` として残る（テスト末尾で `safeDelete` されるため、削除前に保存する必要あり）。

3. 簡便な代替: テストの `safeDelete(generatedHtmlPath)` 部分が呼ばれる前に手動で対象ファイルをコピーする方が確実。あるいは、最も確実なのは **既存の `plantuml.html` をテンプレートとして複製し、画像 `<img>` の URL だけを正しい encoded 値に置き換える** こと。

4. 推奨手順:
   - 既存の `test/integration/expected/plantuml.html` を `test/integration/expected/plantuml-fence.html` にコピー
   - 4 行目のタイトル `<title>plantuml.md</title>` → `<title>plantuml-fence.md</title>`
   - 本文 `<h1 id="plantuml">PlantUML</h1>` を `<h1 id="plantuml-fence">PlantUML fence</h1>` に変更
   - その下の `<img src="...">` 行は、`Bob -> Alice : hello\nAlice -> Bob : ok\n` を `plantuml-encoder` でエンコードした URL に置き換える
   - 期待 URL は Task 2 の単体テスト 3 番目で確認したのと同じ符号化結果を使う

実行例（期待 URL を CLI で確認）:

```bash
node -e "console.log(require('plantuml-encoder').encode('Bob -> Alice : hello\nAlice -> Bob : ok\n'))"
```

得られた文字列を `http://www.plantuml.com/plantuml/svg/<エンコード結果>` の形で `<img>` の `src` に埋める。`alt` は `"uml diagram"` で固定。

- [ ] **Step 4: テストが通ることを確認**

実行: `npm test`

期待: 22 passing（既存 18 + Task 2 で追加した 3 + Task 4 で追加した 1）。`plantuml-fence: HTML snapshot matches expected` が緑であること。

差分が出たら、生成 HTML（テスト失敗時のメッセージ）を見て期待ファイルと照合し、誤差を修正する（多くは末尾改行や CSS の改行差）。

- [ ] **Step 5: コミット**

```bash
git add test/integration/fixtures/plantuml-fence.md \
        test/integration/expected/plantuml-fence.html \
        test/integration/extension.test.ts
git commit -m "test(integration): add fixture for plantuml fence rendering"
```

---

## Task 5: README.md を更新する

PlantUML セクションに `` ```plantuml `` フェンス記法のサポートを追記する。`@startuml`/`@enduml` も従来通り使用可能であることを明示する。

**Files:**
- Modify: `README.md` の `### PlantUML` セクション（118 行目付近）

- [ ] **Step 1: 該当セクションを差し替える**

`README.md:118-132` を以下の内容に置き換える。

`````markdown
### PlantUML

Render UML diagrams via [PlantUML](https://plantuml.com/) using [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml).

Both the `@startuml` / `@enduml` block syntax and the ```` ```plantuml ```` fenced code block syntax (the same form used by VS Code's built-in Markdown preview) are supported.

INPUT
```
@startuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
@enduml
```

or

````
```plantuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
```
````

OUTPUT

![PlantUML](images/PlantUML.png)
`````

注意: 上記の **外側の 5 連バッククォートはこのプラン上の表示用** であり、実際の README.md には内側の `### PlantUML` から `![PlantUML](images/PlantUML.png)` までの内容をそのまま書く。`@startuml` 例の周囲は 3 連バッククォート、`` ```plantuml `` 例の周囲は 4 連バッククォートを保つこと。

- [ ] **Step 2: 表示の整合を目視確認**

実行: `cat README.md | sed -n '118,150p'`

期待: マークダウンの整形が崩れていないこと。

- [ ] **Step 3: コミット**

```bash
git add README.md
git commit -m "docs(plantuml-fence): document \`\`\`plantuml fence syntax in README"
```

---

## Task 6: README.ja.md を更新する

`README.md` と同じ内容を日本語で追記する。

**Files:**
- Modify: `README.ja.md` の `### PlantUML` セクション（116 行目付近）

- [ ] **Step 1: 該当セクションを差し替える**

`README.ja.md:116-130` を以下の内容に置き換える。

`````markdown
### PlantUML

[markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml) を使って [PlantUML](https://plantuml.com/) の UML 図を生成します。

`@startuml` / `@enduml` 形式に加えて、 ```` ```plantuml ```` フェンス記法（VS Code 標準の Markdown プレビューと同じ書式）にも対応しています。

INPUT
```
@startuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
@enduml
```

または

````
```plantuml
Bob -[#red]> Alice : hello
Alice -[#0000FF]->Bob : ok
```
````

OUTPUT

![PlantUML](images/PlantUML.png)
`````

注意: 上記の **外側の 5 連バッククォートはこのプラン上の表示用** であり、実際の README.ja.md には内側の `### PlantUML` から `![PlantUML](images/PlantUML.png)` までの内容をそのまま書く。`@startuml` 例の周囲は 3 連バッククォート、`` ```plantuml `` 例の周囲は 4 連バッククォートを保つこと。

- [ ] **Step 2: 表示の整合を目視確認**

実行: `cat README.ja.md | sed -n '116,148p'`

期待: マークダウンの整形が崩れていないこと。

- [ ] **Step 3: コミット**

```bash
git add README.ja.md
git commit -m "docs(plantuml-fence): document \`\`\`plantuml fence syntax in README.ja"
```

---

## Task 7: CHANGELOG.md にエントリを追加する

`X.Y.Z` の `### Changes` 節に新機能を追記する。

**Files:**
- Modify: `CHANGELOG.md`（先頭の `## X.Y.Z` セクション）

- [ ] **Step 1: 該当箇所を確認**

実行: `sed -n '1,17p' CHANGELOG.md`

期待: 以下の構造が見える。

```
## X.Y.Z (YYYY/MM/DD)

### Breaking Changes
...

### Changes

* Add `markdown-pdf.sanitize` setting for raw HTML sanitization (see Breaking Changes above)
```

- [ ] **Step 2: エントリを追加**

`### Changes` セクションの最後の項目の **下** に、以下を追加する。

```markdown
* Add support for ```plantuml fenced code blocks (in addition to the existing `@startuml`/`@enduml` syntax) [#92](https://github.com/yzane/vscode-markdown-pdf/issues/92) [#162](https://github.com/yzane/vscode-markdown-pdf/issues/162) [#389](https://github.com/yzane/vscode-markdown-pdf/issues/389)
```

- [ ] **Step 3: コミット**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note \`\`\`plantuml fence support"
```

---

## Task 8: 最終検証

すべての変更がまとまった状態で、最終確認を行う。

- [ ] **Step 1: 全テストを再実行**

実行: `npm test`

期待: 22 passing、0 failing。

- [ ] **Step 2: 型チェック**

実行: `npx tsc --noEmit`

期待: エラーなし。

- [ ] **Step 3: 手動の煙テスト（オプションだが推奨）**

VS Code でこの worktree を開き、`test/integration/fixtures/plantuml-fence.md` を開いて `Markdown PDF: Export (html)` を実行し、生成された HTML をブラウザで開いて図が表示されることを目視確認する。
（ヘッドレス CI 環境では Step 1 の統合テストで担保されるため、手動確認はあくまで補助）

- [ ] **Step 4: コミット履歴を確認**

実行: `git log --oneline feature/plantuml-fence-support ^develop`

期待: Task 1〜7 のコミットが順に並んでいること（追加で「最終検証で見つかった微修正」のコミットがあれば含む）。

- [ ] **Step 5: 完了報告**

ユーザに「実装完了。`feature/plantuml-fence-support` を `develop` へマージしてよいか」と確認を仰ぐ。マージは AGENTS.md ルールにより、ユーザの明示的な承認なしに実行しない。

---

## 自己レビュー（プラン作成者用メモ）

スペックの各セクションがプランのタスクで実装されているか:

- [x] 背景 / 目的 → 不要（プランは実装手順）
- [x] スコープ「含むもの」: フェンス経路 → Task 2-4、`plantumlServer` 共有 → Task 3、テスト → Task 2/4、README/CHANGELOG → Task 5-7
- [x] スコープ「含まないもの」: 該当タスクを設けないことで担保
- [x] アーキテクチャ概要（経路 A/B 並行） → Task 3
- [x] コンポーネントとファイル構成 → Task 1-3
- [x] データフロー（経路 B） → Task 3 の挿入コード
- [x] 経路 A との競合 / ワークアラウンド利用者への影響 → Task 4 の既存テスト回帰確認
- [x] エラー処理とエッジケース（空入力等） → Task 2 の Step 1 テスト
- [x] 設定との関係 → Task 3 の `plantumlOptions.server` 共有
- [x] テスト戦略（単体・統合・回帰） → Task 2, 4
- [x] ドキュメント更新 → Task 5, 6, 7
- [x] 依存関係 → Task 1
- [x] 受け入れ基準 → Task 8
