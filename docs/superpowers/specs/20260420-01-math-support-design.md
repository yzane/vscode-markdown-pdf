# 数式表示サポート設計

## 背景

VS Code 標準の Markdown プレビューは組み込み拡張「Markdown Math」
(`vscode.markdown-math`) により `$...$` / `$$...$$` の LaTeX 数式を KaTeX で
描画する。一方、本拡張は現状、数式記法をサポートしておらず、プレビューでは
正しく表示される数式が PDF / HTML 書き出し時にはそのまま `$` 記号を含む
テキストとして出力される。プレビューと書き出しの見た目のずれは利用者の主な
不満点になり得る。

既存の描画系機能には以下があり、本機能はそれらと整合する追加として位置づけ
られる。

- シンタックスハイライト: `highlight.js` をローカル同梱し、markdown-it の
  レンダリング段で静的に処理
- PlantUML: `markdown-it-plantuml` と `` ```plantuml `` フェンスを併用して
  サーバサイドで `<img>` に展開
- Mermaid: CDN の `mermaid.min.js` をテンプレートに注入し Chromium 側で描画

## 目的

VS Code 標準プレビューと**同じ挙動**で数式を描画し、PDF / HTML / PNG / JPEG
の各出力に反映する。描画エンジンは KaTeX を採用し、VS Code プレビュー利用者
が追加の学習なしに書き出しを利用できる状態にする。将来的に MathJax を切り
替え可能にする余地を設計に残すが、**初期リリースでは KaTeX のみ実装する**。

## スコープ

含むもの:

- KaTeX による `$...$` / `$$...$$` / `\(...\)` / `\[...\]` / `` ```math ``
  フェンスの描画
- VS Code プレビューと同じ `@vscode/markdown-it-katex` プラグインの採用
- 設定 `markdown-pdf.math.enabled` / `markdown-pdf.math.katex.macros` の追加
- 同設定のフロントマター上書きサポート
- KaTeX CSS とフォントファイル (woff2 18 種) の拡張同梱とオフライン描画
- 単体テスト・統合テスト・サンプル文書・README / CHANGELOG の更新

含まないもの:

- MathJax による描画（別フェーズで検討する。`@mathjax/src` v4 対応 markdown-it
  プラグインの不在・`mathjax-full` v3 の deprecation などエコシステムの成熟
  待ち）
- `markdown-pdf.math.engine` 設定の追加（エンジンが 1 種しかない状態では
  YAGNI。MathJax 追加時に加算的に導入する）
- `throwOnError` / `errorColor` / `strict` / `trust` の設定露出（KaTeX デフォ
  ルトに従う）
- `\href` など `trust: true` が必要なコマンドの有効化
- 記法のオン/オフ個別設定（`$` だけ有効、フェンスだけ有効、等の分離）
- Mermaid / PlantUML 等、他レンダリング系機能への変更
- VS Code プレビューで描画される MathML / カスタム拡張への追随

## アーキテクチャ概要

markdown-it パイプラインに 3 つの経路を追加する。いずれも `math_inline` / `math_block` トークンを生成し、Task 6 で共通化したレンダラオーバーライドが `renderMath()` を呼び出して KaTeX HTML に変換する。

| 経路 | 担当 | 入力 | 出力 |
|---|---|---|---|
| A. デリミタ検出（`$` 系） | `@vscode/markdown-it-katex`（`enableBareBlocks: true`） | `$...$` / `$$...$$` / `\begin{env}...\end{env}` | `math_inline` / `math_block` トークン |
| A'. デリミタ検出（ブラケット系） | カスタム markdown-it プラグイン（新規） | `\(...\)` / `\[...\]` | `math_inline` / `math_block` トークン |
| B. フェンス検出 | カスタム `fence` レンダラ（新規） | `` ```math ... ``` `` | `renderMath(..., displayMode: true)` の HTML |

`@vscode/markdown-it-katex@1.1.2` はブラケット区切り (`\(...\)` / `\[...\]`) をネイティブにサポートしないため、同等のトークンを生成する小さな markdown-it プラグインを自前で追加する（VS Code 組込みプレビューもプラグイン自体はブラケット非対応である）。バックスラッシュのエスケープ (`\\(` など) とコードスパン・コードブロック内の保護は markdown-it のトークナイズ順で担保する。

既存の PlantUML フェンス (`src/extension.ts:262-271`) と同じパターンで `fence`
ルールを差し替え、`info === 'math'` のとき KaTeX を呼ぶ。既存の PlantUML フェ
ンス判定より**後**に数式フェンス判定を追加する（既存挙動に影響を与えないため）。

`math.enabled: false` のとき経路 A / A' / B をどれも有効化せず、`$`・`\(`・`\[`
は通常のテキスト、`` ```math `` は通常のコードブロックとして出力される。

## コンポーネントとファイル構成

| 変更対象 | 内容 |
|---|---|
| `src/math-renderer.ts`（新規） | `renderMath(tex: string, displayMode: boolean, options: KatexOptions): string` を提供。内部で `katex.renderToString` を呼び、例外を捕捉して元の TeX ソースを `<code>` として返すフォールバックを実装 |
| `src/markdown-it-math-fence.ts`（新規） | `md.renderer.rules.fence` を差し替える薄いプラグイン。`token.info.trim().toLowerCase() === 'math'` のとき `renderMath(content, true, options)` を呼ぶ。それ以外は委譲 |
| `src/markdown-it-math-brackets.ts`（新規） | ブラケット区切り (`\(...\)` / `\[...\]`) を検出する markdown-it プラグイン。インラインルール・ブロックルールを追加し、`math_inline` / `math_block` トークンを生成（本文の HTML 生成は Task 6 のレンダラオーバーライド経由で `renderMath` が担当） |
| `src/extension.ts` | markdown-it 構築部に `@vscode/markdown-it-katex`、ブラケットプラグイン、`markdown-it-math-fence` を `md.use(...)` で登録。`math.enabled` の判定・KaTeX オプション構築・フロントマター反映を担当 |
| `src/utils.ts` | `buildKatexStyleTag(baseDir: string): string` を追加（`styles/katex/katex.min.css` を読み、`url(fonts/...)` をフォントファイルの base64 `data:` URI に書き換えて `<style>` タグで返すヘルパ）。必要に応じてフロントマター / 設定のマージヘルパ (`buildKatexOptions` 等) も追加 |
| `styles/katex/`（新規） | `node_modules/katex/dist/katex.min.css` と `fonts/KaTeX_*.woff2` / `.woff` / `.ttf` を拡張同梱する（CSS 内 `url(fonts/...)` の相対参照はビルド時ではなく `buildKatexStyleTag` による実行時書き換えで解決） |
| `template/template.html` | 変更なし（サーバサイド描画のため Chromium 側スクリプト注入不要） |
| `package.json` | `dependencies` に `@vscode/markdown-it-katex` と `katex` を追加。`contributes.configuration` に 2 オプションを追加 |

変更しないもの:

- `template/template.html` の mermaid 関連構造
- `markdown-pdf.sanitize` のサニタイズ対象（`html_block` / `html_inline` のみ。
  KaTeX 出力は `math_inline` / `math_block` トークンから別ルートでレンダリング
  されるため非対象）
- `plantumlServer` / `plantumlOpenMarker` 等の既存設定
- `src/readme-diagrams.ts`（README 生成用、本件とは独立）

## 設定オプション

| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| `markdown-pdf.math.enabled` | boolean | `true` | 数式描画を有効化 |
| `markdown-pdf.math.katex.macros` | object | `{}` | KaTeX ユーザー定義マクロ。例: `{"\\RR": "\\mathbb{R}"}` |

命名規則は既存の `markdown-pdf.margin.top`、`markdown-pdf.chromium.autoDownload`
等のドット区切りネストに揃える。

### フロントマター上書き

両設定とも上書き可。記法差異により、セキュリティ設定ではないためプロジェクト
方針「フロントマターはセキュリティ設定を除いて拡大可」に沿う。

```yaml
---
math:
  enabled: true
  katex:
    macros:
      "\\RR": "\\mathbb{R}"
---
```

### 露出しないオプション（YAGNI）

以下は初期リリースでは露出しない。必要性が顕在化した時点で加算的に追加する。

- `markdown-pdf.math.engine`: MathJax 追加時に導入
- `throwOnError`: 常に `false`（ソフトエラー固定）
- `errorColor`: KaTeX 既定の `#cc0000`
- `strict`: KaTeX 既定の `'warn'`
- `trust`: 常に `false`（`\href` 等を無効化）
- 記法の細分化（`$` だけ、フェンスだけ等）

## データフロー

### 経路 A（`$` 系デリミタ）

1. `@vscode/markdown-it-katex` が `$...$` / `$$...$$` / `\begin{env}...\end{env}` をパースし `math_inline` / `math_block` トークンを生成
2. Task 6 の共通レンダラオーバーライドが `renderMath(token.content, displayMode, { macros })` を呼ぶ
3. `renderMath` が `katex.renderToString` を実行し HTML を返す
4. 生成された HTML はサニタイザ (`html_block` / `html_inline` 専用) の対象外

### 経路 A'（ブラケット系デリミタ）

1. カスタムプラグインがインラインルールで `\(...\)` を検出、`math_inline` トークンを生成
2. 同プラグインのブロックルールが `\[...\]` を検出、`math_block` トークンを生成（単一行・複数行いずれも許容）
3. 以降は経路 A と同じ共通レンダラオーバーライドで `renderMath` が呼ばれる
4. `\\(` / `\\[` のようにエスケープされたバックスラッシュは検出せず、素通りさせる

### 経路 B（フェンス）

1. markdown-it がフェンスとして解析、`token.info === 'math'` / `token.content === <TeX>` を生成
2. 差し替え後の `fence` ルールが `info === 'math'` を検知
3. 既存の PlantUML フェンス判定より後に評価（PlantUML が先、次に math、最後にデフォルト）
4. `renderMath(content, true, options)` の戻り値を返す

### オプション構築フロー

1. VS Code 設定から `markdown-pdf.math.enabled` / `markdown-pdf.math.katex.macros` を取得
2. フロントマターの `math.*` 値を読み取り、設定値を上書き
3. `math.enabled === false` なら経路 A / A' / B をどれも登録しない
4. それ以外なら `@vscode/markdown-it-katex`・ブラケットプラグイン・math フェンスプラグインを `md.use()` する

## エラー処理とエッジケース

| ケース | 挙動 |
|---|---|
| 不正 TeX 構文 (`$\foo$`) | KaTeX `throwOnError: false` + `errorColor: '#cc0000'` により該当箇所のみ赤色で "ParseError: ..." を描画。他の数式・本文は正常 |
| 未閉じデリミタ (`$abc`) | `@vscode/markdown-it-katex` が数式として認識せずプレーンテキストで出力（プラグイン既存挙動） |
| 空の数式ブロック (` ```math\n``` `) | KaTeX に空文字列を渡す → 空の KaTeX ラッパが出力される。例外なし |
| KaTeX 実行時例外 | `renderMath` の try/catch で捕捉し、元 TeX ソースを `<code>` として返しつつ `console.warn` にログ出力 |
| エスケープされたブラケット (`\\(x\\)`) | ブラケットプラグインが検出せず素通り。バックスラッシュのみエスケープ解除される通常の markdown として出力 |
| `math.enabled: false` | 経路 A / A' / B をどれも登録しない。`$...$` / `\(...\)` / `\[...\]` はプレーン、`` ```math `` は通常コードブロック |
| `markdown-pdf.sanitize` 有効時 | KaTeX 出力は `math_*` トークン経由で生成されるため、`html_block` / `html_inline` に紐付くサニタイザの影響を受けない |
| 大量の数式 | KaTeX は同期・高速（1 式 1ms 未満）。数百式の文書でも体感影響なし |

### セキュリティ方針

- `trust: false` 固定により `\href{…}` 等の任意 URL 埋め込みを無効化
- 外部リソースへの自動アクセスを発生させない（フォントは同梱ローカルファイル）
- 将来 `trust` を解放する場合もフロントマター経由を許可しない（メモリ上のセ
  キュリティ設定ポリシーに準拠）

## CSS とフォントのバンドル

KaTeX はフォント `KaTeX_Main-*`, `KaTeX_Math-*` 等 18 種の woff2 / woff / ttf
ファイルを CSS 内の `@font-face` 経由で参照する。拡張パッケージング時に次を
実施する。

1. `node_modules/katex/dist/katex.min.css` と `node_modules/katex/dist/fonts/`
   を拡張ルート配下（`styles/katex/`）に配置
2. `readStyles()` 経路で `utils.buildKatexStyleTag(baseDir)` ヘルパ経由で
   KaTeX CSS を `<style>` タグとしてインライン化し、既存スタイルと一緒に HTML
   へ埋め込む
3. CSS 内の `url(fonts/KaTeX_*.woff2)` 相対参照は、同ヘルパ内でフォントファイ
   ルを読み込み `url(data:font/woff2;base64,...)` 形式の data: URI に書き換え
   る。これにより生成 HTML は完全に自己完結となり、別ディレクトリや別マシン
   に移動しても数式フォントが壊れない（既存の `markdown.css` 等が `makeCss()`
   でインライン化されているのと同じ方針）

注入条件は「出力本文に KaTeX 要素が含まれるとき (`htmlBody.includes('class="katex')`)」
に限定する。KaTeX を使わない文書の HTML が ~300KB 肥大化するのを防ぎ、既存
スナップショット (`test/integration/expected/*.html`) への影響も最小化する。

`math.enabled: false` のときはそもそも経路 A / B が登録されないため、出力本文
に `class="katex` が含まれず、CSS とフォントも注入されない。

## パッケージング

- esbuild による `src/extension.ts` のバンドルに `katex` 本体を含める（Node
  ランタイムで実行される）
- CSS / フォントファイルはバンドル対象外とし、拡張配布パッケージに物理コピー
  で同梱する（配置方法は実装段階で `.vscodeignore` 調整も含めて決定）

## テスト戦略

### 単体テスト (`test/unit/`)

- `test/unit/math-renderer.test.ts`
  - 決定論的な既知入力に対する `renderMath` の出力 HTML 断片の一致
  - 不正 TeX で例外を飲み込み、`<code>` フォールバックを返すこと
  - マクロが反映されること
- `test/unit/markdown-it-math-fence.test.ts`
  - `info === 'math'` で描画関数が呼ばれること
  - `info === 'math-foo'` 等の派生ではデフォルト fence にフォールバックすること
  - 既存の PlantUML フェンスの判定に干渉しないこと

### 統合テスト (`test/integration/`)

- `fixtures/math.md` — 網羅サンプル:
  - インライン `$E = mc^2$`
  - ブロック `$$\int_0^\infty f(x)\,dx$$`
  - LaTeX 括弧 `\(\alpha\)` / `\[\beta\]`
  - `` ```math `` フェンス
  - フロントマターで定義したマクロ使用
  - 不正 TeX 1 例（赤色エラーが描画されること）
- `expected/math.html` — 期待 HTML（KaTeX の出力は決定論的なのでそのまま固定可）
- `fixtures/math-disabled.md` / `expected/math-disabled.html` — フロントマターで
  `math.enabled: false` を指定し、`$...$` がプレーン、`` ```math `` が通常コード
  ブロックとして出力されることを検証

### 回帰確認

- 既存の統合テスト (`test/integration/fixtures/` 配下と `expected/` の対応) が
  すべて通ること
- 特に `plantuml-fence.md` が `math.enabled: true` 下でも影響を受けないこと

### サンプル生成

`test/sample/` および `npm run sample` の経路に数式セクションを追加し、
`sample/` 配下に数式入りサンプル出力を生成できるようにする。

## ドキュメント更新

| ファイル | 変更内容 |
|---|---|
| `README.md` / `README.ja.md` | 数式サポートセクションを新設（対応記法、KaTeX 採用理由、VS Code プレビュー互換である旨、無効化方法）。"What's New" 節にリリース項目を追加（具体的なバージョン番号はリリース時に決定） |
| `CHANGELOG.md` | 対応する 2 系マイナーリリースのエントリに "Add math rendering support via KaTeX (opt-out: `markdown-pdf.math.enabled: false`)" を追加 |
| `package.json` | `contributes.configuration` に 2 オプションを追加、バージョンはリリース時に更新 |

書かないこと:

- MathJax エンジンに関する記述（本スコープ外）
- `markdown-pdf.math.engine` 設定（本スコープ外）

## リリースとマイグレーション

- **バージョン**: 2 系マイナーリリースで出す方針（具体的な番号はリリース時に確定）
  - `math.enabled: true` 既定のため、`$100` のように `$` を素のテキストとして
    書いている既存文書は数式解釈されて見た目が変わる可能性がある
  - ただし VS Code プレビューは既に同じ解釈を行っており、プレビューと書き出し
    の齟齬を解消する調整である点、オプトアウトが容易である点からメジャー昇格
    は行わない
- **回避方法（READMEに明記）**:
  - 設定: `"markdown-pdf.math.enabled": false`
  - フロントマター: `math.enabled: false`
  - エスケープ: `\$100`

## 依存関係

- 追加: `@vscode/markdown-it-katex` ^1.1.2（Microsoft 維持、VS Code 組み込み
  Markdown Math と同一）
- 追加: `katex` ^0.16.45（Khan Academy / コミュニティ維持、活発）

削除・置換なし。

## ブランチ運用

- `feature/math-support` を `develop` から切って作業（`AGENTS.md` の GitFlow 準拠）
- `.worktrees/` 配下のワークツリーで作業（メモリの worktree 方針に従う）
- 完了時のマージは `--no-ff` で実施（メモリの Merge style に従う）し、マージ
  前にユーザ確認を取る（メモリの Merge confirmation required に従う）

## 受け入れ基準

- `$...$` / `$$...$$` / `\(...\)` / `\[...\]` / `` ```math `` の 5 種記法を含む
  markdown を PDF / HTML / PNG / JPEG に書き出したとき、KaTeX で描画された数式
  が表示される
- VS Code プレビュー上と PDF 出力上の数式が視覚的に同等である
- 設定 `markdown-pdf.math.enabled: false` で数式描画が停止し、既存挙動と同等
  のテキスト出力になる
- フロントマター `math.enabled: false` / `math.katex.macros` が期待通り
  設定を上書きする
- 不正 TeX が含まれても他の本文・他の数式は正常に描画される
- オフライン環境（ネットワーク未接続）で数式と KaTeX フォントが正しく表示される
- HTML 出力を別ディレクトリや別マシンに移動しても数式と KaTeX フォントが正しく
  表示される（CSS とフォントが `<style>` タグ + `data:` URI で自己完結している）
- `markdown-pdf.sanitize` の各モード（`gfm` / `gfm-allow-style` / `none`）
  のいずれでも KaTeX 出力が剥がれない
- 既存の統合テストが引き続き通る
- 新規追加した単体・統合テストが通る
- README / CHANGELOG / package.json バージョンが更新されている
