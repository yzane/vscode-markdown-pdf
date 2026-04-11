# README レビュー仕様書

## 背景

2.0.0 リリース (2026-04-11) に伴い、README.md と README.ja.md は複数の PR を経て更新されてきた。本仕様書は、そのレビューで洗い出された不整合・タイポ・構成上の改善点を一括で修正するための設計をまとめる。

本レビューは「包括的レビュー」の方針で実施し、以下 5 観点から問題を抽出した:

- A. 実装と README の事実関係の整合
- B. タイポ・文法・表記揺れ
- C. 構成・読みやすさ
- D. 抜け漏れ
- E. EN/JA 間の乖離

意思決定の結果、以下に示す 15 件の修正を実施する。コードの変更は一切なく、対象は `README.md` と `README.ja.md` の 2 ファイルのみである。

## 対象ファイル

- `README.md` (英語版)
- `README.ja.md` (日本語版)

コードおよび `package.json` の変更は含めない。

## 修正一覧

### A. 事実・技術的整合

#### Fix-2: puppeteer screenshot ドキュメントのリンクを更新

- **対象**: `README.md` L505 / `README.ja.md` L499
- **現状**: `https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagescreenshotoptions`
- **修正後**: `https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.screenshotoptions.md`
- **理由**: 旧 GoogleChrome 組織名、旧 master ブランチを参照しており、同じ README 内の PDF 側 URL (L410) は既に `puppeteer/puppeteer` の `main` に更新済み。PNG/JPEG 側だけ取り残されている。
- **備考**: 実装時に URL が実在することを確認する。存在しない場合は `puppeteer/puppeteer` リポジトリ内の対応するドキュメントページを参照する。

#### Fix-3: `markdown-it-include` を built-in 表記に更新

- **対象**: `README.md` L43 (機能箇条書き)
- **現状**: `[markdown-it-include](https://github.com/camelaissani/markdown-it-include)` (外部リポジトリへのリンクのみ)
- **修正後**: Fix-18 の表形式再編で「built-in custom plugin」と明示する
- **理由**: 2.0.0 で内製カスタム実装に置換されており、外部リンクのみの記載は誤解を招く。

#### Fix-5: ホームディレクトリ相対パスの記号を修正

- **対象**: `README.ja.md` L288
- **現状**: 「パスが `^` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます」
- **修正後**: 「パスが `~` で始まっている場合、ホームディレクトリからの相対パスとして解釈されます」
- **理由**: 実装は `~` (チルダ) プレフィックスのみを解釈する。EN L293 は `~` と正しく記載されているが、JA のみ `^` (サーカムフレックス) になっており実装と矛盾する。ユーザーを実装と異なる方向に誘導するバグ。

#### Fix-6: `markdown-it-checkbox` の表記を EN と揃える

- **対象**: `README.ja.md` L38 (機能箇条書き)
- **現状**: `[markdown-it-checkbox](https://github.com/mcecot/markdown-it-checkbox)` (外部リンクのみ)
- **修正後**: Fix-18 の表形式再編で「内製カスタムプラグイン」と明示する
- **理由**: Fix-3 と同じ理由。

#### Fix-7: 1.6.0 Release Notes に不足している Refactor 行を追加

- **対象**: `README.ja.md` L715-717 付近
- **現状**: Fix (#404) と Update の 2 項目のみ
- **修正後**: EN L712-714 と同じく 3 項目とする。追加する内容:
  - `Refactor: 外部 checkbox / named-header の markdown-it パッケージを内製実装に置換`
- **理由**: EN/JA の Release Notes 粒度を揃える。

### B. タイポ・文法・表記揺れ

#### Fix-8: タイポ `Oppening` → `Opening`

- **対象**: `README.md` L541 (`markdown-pdf.plantumlOpenMarker`)
- **現状**: `Oppening delimiter used for the plantuml parser.`
- **修正後**: `Opening delimiter used for the plantuml parser.`

#### Fix-9: タイポ `Visutal` → `Visual` (JA 2 箇所)

- **対象**: `README.ja.md` L255, L387
- **現状**: 「Visutal Studio Code の再起動が必要です」
- **修正後**: 「Visual Studio Code の再起動が必要です」

#### Fix-10: 文法修正 `from the each root folder` → `from each root folder`

- **対象**: `README.md` L284, L324
- **現状**: `interpreted as a relative path from the each root folder`
- **修正後**: `interpreted as a relative path from each root folder`
- **理由**: 冗長な冠詞 `the` を除去。

#### Fix-11: emoji cheat sheet の URL を統一

- **対象**: `README.md` L383, `README.ja.md` L378 (Emoji options セクション)
- **現状**: `https://www.webpagefx.com/tools/emoji-cheat-sheet/` (旧ドメイン)
- **修正後**: `https://www.webfx.com/tools/emoji-cheat-sheet/` (新ドメイン)
- **理由**: 同ドキュメント内の Features 箇条書き (EN L39 / JA L37) は既に新ドメインを使用しており、統一する。

#### Fix-12: `default:` の大小文字を `Default:` に統一

- **対象**: `README.md` L402 / `README.ja.md` L397 (`markdown-pdf.scale`)
- **現状**: `number. default: 1`
- **修正後**: `number. Default: 1`
- **理由**: 他のすべての設定項目は `Default:` (大文字スタート) を使用している。

#### Fix-14: 空行追加 (JA L268-269)

- **対象**: `README.ja.md` L268-269
- **現状**: `convertOnSaveExclude` のコードブロックの閉じ行の直後に `#### markdown-pdf.outputDirectory` が空行なしで続いている
- **修正後**: コードブロック終端と見出しの間に空行を 1 行挿入
- **理由**: 一部の Markdown パーサで見出しが正しく認識されない可能性があるため。

#### Fix-15: 空行追加 (JA L439-440)

- **対象**: `README.ja.md` L439-440
- **現状**: `headerTemplate` のコードブロック終端の直後に `#### markdown-pdf.footerTemplate` が空行なしで続いている
- **修正後**: Fix-14 と同様に空行を 1 行挿入

### C. 構成・コンテンツ

#### Fix-16: `Install` → `Chromium` セクションリネーム

- **対象**: `README.md` L131 / `README.ja.md` L128 (セクション見出し)
- **現状**: `## Install` / `## インストール`
- **修正後**: `## Chromium` / `## Chromium`
- **理由**: セクション名が「Install」でありながら、中身は Chromium ブラウザの解決と設定に関する説明のみ。拡張機能自体のインストール手順 (Marketplace からのインストール等) は含まれていない。誤解を避けるため、実際の内容に合わせて `Chromium` にリネームする。

**影響範囲**:

- TOC (EN L13 / JA L10) の該当行を `- [Chromium](#chromium)` に更新する
- セクション内のサブ見出し `### Chromium resolution` (EN L133) は削除し、本文直下に統合する。セクション名自体が `Chromium` になるため、同名のサブ見出しは冗長である
- 他セクションからの内部リンクは現状存在しないことを確認済み (FAQ 側は `#markdown-pdfexecutablepath` など個別設定アンカーへのリンク)

#### Fix-17: `Specification Changes` → `Breaking Changes in 2.0.0` (EN のみ)

- **対象**: `README.md` L26
- **現状**: `## Specification Changes`
- **修正後**: `## Breaking Changes in 2.0.0`
- **理由**: 英語話者にとって `Specification Changes` は「プロトコル仕様の変更」のように読めるため不自然。実際の内容は 2.0.0 の破壊的変更の告知であり、`Breaking Changes` が適切。
- **JA への影響**: `## 仕様変更` は日本語として自然なため現状維持。TOC の EN 側のみ `- [Breaking Changes in 2.0.0](#breaking-changes-in-200)` に更新する。

#### Fix-18: Features セクションを記法ベースの表形式に再編

- **対象**: `README.md` / `README.ja.md` の Features (機能) セクション全体
- **理由**: 現状の構成は「プラグイン名ごと」にサブセクションが作られているが、2.0.0 で一部プラグインが内製カスタム実装に置換されたため「プラグイン」という軸での整理が適切でなくなった。使える記法ごとに整理するほうが読み手にとって有用である。

**変更内容**:

**a) 機能箇条書きを 3 列表に置換**

EN:

```markdown
## Features

| Feature | Description | Example |
|---|---|---|
| [Syntax highlighting](https://highlightjs.org/demo) | Code block highlighting via highlight.js | ` ```js ` |
| [Emoji](https://www.webfx.com/tools/emoji-cheat-sheet/) | Emoji shortcodes | `:smile:` |
| Checkbox | GitHub-style task lists (built-in custom plugin) | `- [ ]` / `- [x]` |
| Heading IDs | GitHub-compatible heading anchors (built-in custom plugin) | `# Heading` → `#heading` |
| [Container](https://github.com/markdown-it/markdown-it-container) | Admonition-like blocks | `::: warning` |
| Include | Embed Markdown fragments (built-in custom plugin) | `:[label](path.md)` |
| [PlantUML](https://plantuml.com/) | UML diagrams from code blocks | `@startuml` … `@enduml` |
| [Mermaid](https://mermaid-js.github.io/mermaid/) | Diagrams from fenced code blocks | ` ```mermaid ` |
```

JA:

```markdown
## 機能

| 機能 | 説明 | 記法例 |
|---|---|---|
| [Syntax highlighting](https://highlightjs.org/demo) | highlight.js によるコードブロックのハイライト | ` ```js ` |
| [Emoji](https://www.webfx.com/tools/emoji-cheat-sheet/) | 絵文字ショートコード | `:smile:` |
| Checkbox | GitHub 形式のタスクリスト (内製カスタムプラグイン) | `- [ ]` / `- [x]` |
| Heading IDs | GitHub 互換の見出しアンカー生成 (内製カスタムプラグイン) | `# 見出し` → `#見出し` |
| [Container](https://github.com/markdown-it/markdown-it-container) | 注記ブロック | `::: warning` |
| Include | Markdown フラグメントの埋め込み (内製カスタムプラグイン) | `:[label](path.md)` |
| [PlantUML](https://plantuml.com/) | コードブロックから UML 図を生成 | `@startuml` … `@enduml` |
| [Mermaid](https://mermaid-js.github.io/mermaid/) | フェンスドコードブロックから図を生成 | ` ```mermaid ` |
```

サンプルファイルへのリンク (`sample/README.pdf` 等) は表の下に残す。

**b) サブセクション見出しのリネーム**

プラグイン名ではなく記法名を見出しとする:

| 旧 | 新 |
|---|---|
| `### markdown-it-container` | `### Container` |
| `### markdown-it-include` | `### Include` |
| `### markdown-it-plantuml` | `### PlantUML` |
| `### mermaid` | `### Mermaid` |

各サブセクション内の INPUT/OUTPUT 例は変更しない。ただし `### PlantUML` サブセクションには、INPUT/OUTPUT の前に 1 行の導入テキストを追加し、公式サイト ([PlantUML](https://plantuml.com/)) と利用している markdown-it プラグイン ([markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml)) の両方へのリンクを載せる。これは Features 表側では PlantUML 公式サイトへのリンクのみを載せているため、プラグインへのリンクを失わないようにするための措置である。

導入テキスト例:

EN: `Render UML diagrams via [PlantUML](https://plantuml.com/) using [markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml).`

JA: `[markdown-it-plantuml](https://github.com/gmunguia/markdown-it-plantuml) を使って [PlantUML](https://plantuml.com/) の UML 図を生成します。`

**c) 新規サブセクションの追加**

- `### Checkbox`: GitHub 形式のタスクリスト記法 `- [ ]` / `- [x]` の INPUT/OUTPUT 例を追加
- `### Heading IDs`: Fix-19 で詳細を定義

**d) サブセクション作成の対象外**

- `Syntax highlighting` と `Emoji` はサブセクションを作らず、表の 1 行のみで完結させる。詳細は外部サイトへのリンクで十分とする。

**e) 表と詳細サブセクションの役割分担**

- 表 = 概要 (1 行で機能名・説明・記法例)
- 詳細サブセクション = 実際の INPUT/OUTPUT サンプルを載せる

#### Fix-19: `Heading IDs` サブセクションと JA 機能表の同期

- **対象**: `README.md` / `README.ja.md` の Features セクション
- **内容**:
  - `### Heading IDs` サブセクションを新規追加する。内容は以下を含む:
    - 例となる Markdown 見出しと、生成される ID の対応例 (例: `# My Heading` → `#my-heading`, `# 日本語見出し` → `#日本語見出し`)
    - FAQ の `Why did my heading anchors change?` (EN) / `見出しのアンカーが変わったのはなぜ?` (JA) への参照リンク
  - Fix-18 の機能表が JA 側にも追加されることで、`Checkbox` と `Heading IDs` が自動的に JA の機能一覧にも掲載される (EN/JA 乖離の解消)。

## 対象外 (本仕様書では扱わないもの)

以下は検討されたが、今回のスコープから除外する:

- `markdown-pdf.StatusbarMessageTimeout` 設定のドキュメント化 (意図的に記載していないため)
- 2.0.0 Release Notes の「Replace `markdown-it-include` / `markdown-it-named-headers` / `markdown-it-checkbox`」という表現の調整 (実際には 1.6.0 で 2 件が既に置換済みだが、現行の記載で問題なしと判断)
- Special thanks セクションの整理
- FAQ の追加項目
- JA 側 `Specification Changes` の見出し変更 (「仕様変更」は自然なため現状維持)
- JA 側 `plantumlServer` の英語説明文の日本語化 (既存のまま残す)
- `<a id="..."></a>` アンカータグの扱い (JA FAQ の設計として問題なし)

## 検証方法

本仕様書の対象はドキュメントのみのためユニットテストは存在しない。代わりに以下で検証する:

1. **Markdown 構文の検証**
   - `README.md` と `README.ja.md` を VS Code のプレビューで開き、表・コードブロック・見出し・リンクが正しくレンダリングされることを確認する
2. **アンカー整合性の確認**
   - TOC 内のリンクがすべて実在する見出しを指していることを確認する (Fix-16, Fix-17 で TOC を更新しているため)
   - セクション間の内部リンク (例: FAQ → 設定項目) がすべて有効であることを確認する
3. **サンプル PDF の再生成**
   - 既存の README スナップショットテスト (`npm run test:snapshot` 等があれば) を実行し、期待通りの差分に収まることを確認する
   - 必要に応じて `sample/README.pdf` を更新する
4. **EN/JA の対訳確認**
   - Fix-6, Fix-7, Fix-18, Fix-19 で EN/JA 対応を変更しているため、該当箇所の対応関係が乱れていないことを目視確認する

## 実施順序の想定

実装プランは別ファイル (`docs/superpowers/plans/20260411-04-readme-review.md`) に詳細化するが、本仕様書での想定順序は以下の通り:

1. タイポ・文法・空行 (Fix-8, 9, 10, 14, 15) — 最も影響範囲が小さく、差分が明確
2. 事実・URL 修正 (Fix-2, 5, 11, 12) — 局所的な置換のみ
3. Fix-3, Fix-6 は Fix-18 の再編の一部として反映 (独立修正にはしない)
4. Fix-7 (JA Release Notes) — 独立した 1 行追加
5. 構成変更 (Fix-16, 17, 18, 19) — まとめて作業し、TOC 更新も同時に行う
6. 全体のアンカー・リンク検証
7. サンプル再生成が必要な場合は別コミットに分ける

## 影響範囲

- `README.md` と `README.ja.md` の 2 ファイルのみを変更する
- TOC 内のリンク (該当 2 ファイル内部) も同時に更新する
- コード・`package.json`・CHANGELOG・`sample/` 配下は (サンプル再生成を除き) 変更しない
- 動作変更は一切なく、純粋なドキュメント修正である
