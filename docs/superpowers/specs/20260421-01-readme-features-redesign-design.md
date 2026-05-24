# README「機能」節の再設計 — 設計書

## 概要

README.md / README.ja.md の `## Features` (`## 機能`) 節を再構成し、説明不足・レイアウトの見づらさを解消する。概要テーブルは「リンク集」として簡素さを保ち、サブセクションの粒度・順序・見出し階層・出力表現を統一する。範囲は README 2 本と、付随する画像アセット生成テストの調整にとどめる。

## 背景と動機

現状の `## Features` 節には以下の問題がある。

1. **粒度の不揃い**: Math 節だけ「設定」「無効化方法」「カスタマイズ」まで詳述されており、Checkbox / Container / Mermaid 等は最小 INPUT/OUTPUT のみ。読者の期待が機能ごとに裏切られる。
2. **説明の簡素さ**: 概要テーブルの「説明」列および一部サブセクションが機能名の言い換えに近く、ユーザーが得る価値や代表的な使いどころが伝わらない。
3. **順序の不一致**: 概要テーブル順 (Syntax → Emoji → Checkbox → Heading IDs → Container → Include → PlantUML → Math → Mermaid) と実際のサブセクション並び (Heading IDs → Checkbox → Container → PlantUML → Include → Mermaid → Math) が食い違い、読者が迷子になる。
4. **サンプルファイルリンクの分断**: 概要テーブル直後に置かれた `pdf / html / png / jpeg` リンクが、続くサブセクション群への流れを視覚的に切断している。
5. **OUTPUT 表現のばらつき**: PlantUML / Mermaid は画像、Checkbox / Container は HTML ソース、Math は実レンダリング、Include はテキスト、と表現が不揃い。特に Math の実レンダリングは環境依存で表示されない場合がある。

## 変更方針

以下 9 点を決定する。

### 1. 節の骨格を 2 段化

カテゴリ H3 × 3 の下に機能 H4 × 7 を配置する。GFM のアンカー ID は見出しテキストから生成されるため、既存 `### Checkbox` → `#### Checkbox` のように階層だけ下げてもアンカー `#checkbox` は維持される。外部から機能アンカーを参照しているリンクは壊れない。

```
## Features
  (導入文 1〜2 行)

  ### Basic syntax extensions
    (小テーブル: Syntax highlighting / Emoji / Checkbox / Heading IDs)
    #### Checkbox
    #### Heading IDs

  ### Content composition
    (小テーブル: Container / Include)
    #### Container
    #### Include

  ### Diagrams & math
    (小テーブル: PlantUML / Mermaid / Math)
    #### PlantUML
      ##### Fenced code block
      ##### Block markers
    #### Mermaid
    #### Math

  ### Sample files
    (導入文 + 4 形式の箇条書き)
```

TOC は `depthFrom:2 depthTo:2` のため H3 / H4 / H5 いずれも載らず、TOC 項目数は変化しない。

### 2. 概要テーブルを 3 分割

既存の 9 行 1 テーブルを、カテゴリ H3 直下の小テーブル 3 本に分割する。列構成（Feature / Description / Example）は現状踏襲。テーブル内の表示名・説明・記法例も現状踏襲し、リンク集としての簡素さを維持する。ただし README.ja.md の `[数式](#math)` は **`[Math](#math)` に改める**（後述の日本語同期方針に合わせる）。

各小テーブルの内容は以下。

**Basic syntax extensions**

| Feature | Description | Example |
|---|---|---|
| [Syntax highlighting](https://highlightjs.org/demo) | Code block highlighting via highlight.js | ` ```js ` |
| [Emoji](https://www.webfx.com/tools/emoji-cheat-sheet/) | Emoji shortcodes | `:smile:` |
| [Checkbox](#checkbox) | GitHub-style task lists | `- [ ]` / `- [x]` |
| [Heading IDs](#heading-ids) | GitHub-compatible heading anchors | `# Heading` → `#heading` |

**Content composition**

| Feature | Description | Example |
|---|---|---|
| [Container](#container) | Admonition-like blocks | `::: warning` |
| [Include](#include) | Embed Markdown fragments | `:[label](path.md)` |

**Diagrams & math**

| Feature | Description | Example |
|---|---|---|
| [PlantUML](#plantuml) | UML diagrams from code blocks | `@startuml` … `@enduml` |
| [Mermaid](#mermaid) | Diagrams from fenced code blocks | ` ```mermaid ` |
| [Math](#math) | LaTeX math via KaTeX | `$E = mc^2$` |

Syntax highlighting と Emoji は外部ドキュメントが充実しているため**サブセクションを設けない**。残り 7 機能のみ機能 H4 を持つ。

### 3. サブセクションの統一テンプレート

7 機能すべてを以下のフォーマットに統一する。

```
#### <機能名>

<1〜2 文の説明：「何ができるか + 主要なユースケース or 注意点」。機能名の言い換えは禁止>

Markdown
<コードブロック>

Preview
<画像ファイル (Include のみコードブロック例外)>

See also: <関連設定 / FAQ へのリンク 0〜2 本>
```

要点:

- ラベルは `INPUT` / `OUTPUT` から **`Markdown` / `Preview`** に変更する（VS Code の「Markdown Preview」用語と整合、README.md / README.ja.md 共通）。
- OUTPUT 表現は原則**画像**に統一（Checkbox / Container / Math は新規画像、PlantUML / Mermaid は既存画像を使用）。**Include のみ例外** として、連結されるテキスト構造を示すコードブロックを維持する。画像化すると「ただの通常 Markdown」に見えて機能の本質が伝わらないため。
- `See also:` 行は関連設定や FAQ がない機能では省略可（例: Checkbox には Options / FAQ の関連項目がないため省略）。

**テンプレートの許容される例外は 3 つ:**

- **Math**: 対応記法 bullet リスト（4 項目）を説明と Markdown 例の間に挿入（詳細は次節）。
- **PlantUML**: 2 構文（fenced code block / block markers）が等価に成立する仕様上、`#### PlantUML` の下に `##### Fenced code block` と `##### Block markers` の H5 を配置し、それぞれに Markdown 例を持つ。Preview（`images/PlantUML.png`）は 2 構文が同じ出力を生むため、PlantUML 直下に 1 枚だけ配置する。既存の見出し構造をレベルだけ 1 段下げる扱いで、アンカー `#fenced-code-block` / `#block-markers` は維持される。
- **Heading IDs**: 「見出しテキスト → 生成されるアンカー ID」のマッピング表を現状踏襲。Heading IDs は ID 生成仕様であり、レンダリング結果を画像で示しても情報量が増えない（Preview 上でアンカー ID は視覚表示されない）。Markdown/Preview ペアを持たず、説明 + マッピング表 + See also の構成で他機能と並ぶ。

### 4. Math 節の例外許容と移管

Math 節だけは粒度 B の 1〜2 文説明に加えて **対応記法 bullet リスト**（4 項目）を節内に残す。これは Math で何が書けるかを知るための核心情報であり、Options / FAQ へ飛ばしてはならない。

Math サブセクションの構成:

```
#### Math

<1〜2 文説明（Node 実行・ネットワーク不要の補足を 2 文目に吸収）>

Supported notations:
- Inline: `$E = mc^2$`, `\(E = mc^2\)`
- Display: `$$\int_0^\infty f(x)\,dx$$`, `\[\alpha\]`
- LaTeX environments: `\begin{aligned}...\end{aligned}`
- Fenced code block: ```math

Markdown
<コードブロック: インライン + ディスプレイ + 環境の混在>

Preview
![math](images/math.png)

See also:
- [markdown-pdf.math.enabled](#markdown-pdfmathenabled) — disable math rendering
- [markdown-pdf.math.katex.macros](#markdown-pdfmathkatexmacros) — custom KaTeX macros
```

Math 節から外に出す内容と移管先:

| 現状の内容 | 移管先 | 備考 |
|---|---|---|
| 無効化方法（設定 `false` / front matter `math.enabled: false` / `\$` エスケープ） | Options の `markdown-pdf.math.enabled` 説明を 1〜2 行拡張して吸収 | FAQ は新設しない |
| KaTeX マクロ front matter 例 | Options の `markdown-pdf.math.katex.macros` 説明に front matter YAML 例を追記 | 既存設定項目の説明拡張 |
| 「Node 実行・ネットワーク不要」 | Math サブセクションの 1〜2 文説明に吸収 | 節外へ移さない |

### 5. 画像アセットの生成

新規に必要な画像:

| ファイル | 内容 |
|---|---|
| `images/checkbox.png` | `- [ ] Task A` / `- [x] Task B` のレンダリング結果 |
| `images/container.png` | `::: warning` ブロックのレンダリング結果 |
| `images/math.png` | インライン + ディスプレイ + LaTeX 環境の混在サンプルのレンダリング結果 |

既存の `test/sample/update-readme-diagrams.ts` を **`test/sample/update-readme-previews.ts` にリネーム** し、現行の PlantUML / mermaid のエクスポート手順と同じパターンで上記 3 画像のエクスポートを追加する。

- Markdown ソースの持ち方: README.md の該当サブセクションから抽出する方式（既存 PlantUML / mermaid と同じ方式）。抽出ヘルパーを `src/readme-diagrams.ts` に追加する必要があれば併せてリネーム・拡張（例: `src/readme-previews.ts` など）。ヘルパー名は実装段階で決定する。
- トリミングは手動運用を踏襲（PlantUML.png / mermaid.png と同じ）。
- 画像形式は既存画像に合わせて **PNG** とする。

### 6. サンプルファイルリンクの配置

現状は概要テーブル直下（L78-82 付近）。これを **Features 節の末尾**（`#### Math` の後ろ、`## Chromium` の直前）に移す。

配置形式（英語版）:

```markdown
### Sample files

This README converted to each output format:

- [pdf](sample/README.pdf)
- [html](sample/README.html)
- [png](sample/README.png)
- [jpeg](sample/README.jpeg)
```

日本語版の導入文は「この README を各形式に変換したサンプル:」など。H3 見出しは英語共通（`### Sample files`）。

### 7. README.ja.md 同期方針

README.md（英語）と README.ja.md（日本語）は**節構成・見出しレベル・機能名・順序を完全対応**させる。見出しと機能名は英語共通、説明プロズだけ日本語化する。

| 要素 | README.md | README.ja.md |
|---|---|---|
| H2 | `## Features` | `## 機能`（既存踏襲） |
| H3 カテゴリ | `### Basic syntax extensions` 他 | 同じ英語 |
| H3 サンプル | `### Sample files` | 同じ英語 |
| H4 機能名 | `#### Checkbox` 他 | 同じ英語 |
| 概要テーブル表示名 | `[Checkbox](#checkbox)` 他 | 同じ英語（既存 `[数式]` は `[Math]` に変更） |
| テーブル列ヘッダ | `Feature / Description / Example` | `機能 / 説明 / 記法例`（既存踏襲） |
| 1〜2 文説明 | 英語 | 日本語 |
| `See also:` | 同じ英語 | 同じ英語 |
| `Markdown` / `Preview` ラベル | 同じ英語 | 同じ英語 |

### 8. 破壊的変更の有無

- **内部アンカー**: H3 → H4 への変更はアンカー ID を変えない。`#checkbox`, `#container`, `#include`, `#plantuml`, `#mermaid`, `#math`, `#heading-ids` および PlantUML の `#fenced-code-block`, `#block-markers` はすべて維持。
- **外部からのアンカー参照**: 壊れない。
- **CHANGELOG への影響**: README 再編のみで機能挙動の変更はないため、`### Fixes` や `### Changes` への記載要否は実装プラン段階で判断する（「docs」扱いで CHANGELOG に書かない選択肢も含めて）。

### 9. 既知の漏れ（本スペックの非目標）

以下は本スペックの範囲外とする。必要に応じて別スペックで対応する。

- **front matter 総論ドキュメント**: README 全体で front matter が「設定の上書き手段」として使えることを説明する総論セクションは存在しない。本スペックで Math 節の front matter 例を Options 個別項目へ移管した結果、概念説明の欠落がより目立つ状態になる。front matter 対応は拡大中（プロジェクト方針として確認済み）であるため、対応設定の一覧化・Options への導入段落追加などは独立したスペックで扱う。本スペックの担当範囲ではない。
- **Syntax highlighting / Emoji のサブセクション化**: 外部ドキュメントに委ねる現行方針を維持。将来ハイライトテーマや emoji 挙動のカスタマイズを README で詳述する要望が出た場合に別途検討する。
- **Options / FAQ 節の構成見直し**: Math 節から移管する内容以外、Options / FAQ の節構造は触らない。

## 非目標

- 機能本体の挙動変更は一切行わない。README / 生成テストのドキュメント再編のみ。
- 概要テーブルの列構成（Feature / Description / Example）の変更。
- `## What's New` / `## Breaking Changes` 節の変更（今回の再編に由来する新項目記載は実装プラン段階で判断）。

## 受入条件

1. `README.md` の `## Features` 節が合計 11 見出しの骨格（カテゴリ H3 × 3 + 機能 H4 × 7 + Sample files H3 × 1）になっている。
2. 概要テーブルが 3 カテゴリに分割された小テーブル 3 本になっている。
3. 7 つの機能 H4 がすべて「説明 + Markdown/Preview + (任意の See also)」テンプレートに沿っている。Math のみ対応記法 bullet が追加で含まれる。
4. Checkbox / Container / Math のサブセクションが `images/*.png` を Preview として参照している。Include は現状のコードブロック維持。Heading IDs は現状のマッピング表を維持。
5. サンプルファイルリンクが `## Features` 節の末尾、`## Chromium` の直前に `### Sample files` として配置されている。
6. Math 節から移管された内容（無効化方法・`\$` エスケープ・front matter 例・KaTeX マクロ front matter 例）が Options の該当設定項目の説明に含まれている。
7. `README.ja.md` が README.md と同じ骨格・見出し・機能名構成になっている。説明プロズのみ日本語化されている。
8. `test/sample/update-readme-previews.ts` が存在し、実行すると `images/PlantUML.png` / `mermaid.png` / `checkbox.png` / `container.png` / `math.png` の 5 画像をエクスポートする。
9. 既存アンカー（`#checkbox`, `#container`, `#include`, `#plantuml`, `#mermaid`, `#math`, `#heading-ids`, `#fenced-code-block`, `#block-markers`）がすべて有効のままである。
10. 本スペックの「既知の漏れ」で記載した front matter 総論ドキュメントの欠如が、別スペック化が必要な項目として文書内に記録されている。
