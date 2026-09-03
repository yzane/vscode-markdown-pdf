# PlantUML フェンス記法サポート設計

## 背景

現在、本拡張は `markdown-it-plantuml` プラグインを通じて `@startuml` / `@enduml`
で囲まれた PlantUML ブロックを画像にレンダリングできる。しかし、VS Code 標準
プレビューや GitLab/GitHub などの周辺ツールでは ` ```plantuml ... ``` ` 形式の
フェンス記法が広く使われており、両者を同一文書で両立させにくいという問題が
長期にわたって報告されている。

関連 issue / PR:

- [#389](https://github.com/yzane/vscode-markdown-pdf/issues/389) ` ```plantuml ` ヘッダ付きでも `@startuml` 同様にレンダリングしてほしい
- [#162](https://github.com/yzane/vscode-markdown-pdf/issues/162) 三重バッククォートで囲んだ PlantUML が PDF に出力されない（20 件のコメント）
- [#92](https://github.com/yzane/vscode-markdown-pdf/issues/92)  GitLab/VS Code プレビューと同じ ` ```plantuml ` 記法を求める原典 issue
- PR [#294](https://github.com/yzane/vscode-markdown-pdf/pull/294) 既定マーカーを ` ```plantuml ` / ``` ``` に **置き換える** 提案（OPEN、両立しない）
- PR [#104](https://github.com/yzane/vscode-markdown-pdf/pull/104) (MERGED) `plantumlOpenMarker` / `plantumlCloseMarker` 設定を追加した過去のワークアラウンド（片方しか有効化できない）

PR [#104](https://github.com/yzane/vscode-markdown-pdf/pull/104) で追加された設定は、ユーザが `plantumlOpenMarker` を ` ```plantuml ` に
書き換えることで部分的に対処できるが、その瞬間 `@startuml` は使えなくなる。
両表記の同時利用ができないことが本質的な不便さである。

## 目的

` ```plantuml ... ``` ` フェンス記法を **新たな推奨記法** としてサポートする
（VS Code 標準プレビュー・GitHub・GitLab と書式が一致するため）。既存の
`@startuml` / `@enduml` 形式は **後方互換目的** で引き続き動作させるが、新規
利用には推奨しない位置づけとする。同等に、`@startuml` 系マーカーをカスタマイズ
する設定 (`plantumlOpenMarker` / `plantumlCloseMarker`) も後方互換目的のみに
位置づけ、ドキュメントと VS Code 設定 UI 上で非推奨であることを明示する。

## スコープ

含むもの:

- `` ```plantuml `` フェンスを `@startuml` / `@enduml` と並行サポートする
- 両経路で同じ `markdown-pdf.plantumlServer` 設定を共有する
- `@startuml` / `@enduml` 記法を「後方互換目的・新規利用は非推奨」とドキュメントに明示する
- `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` 設定を非推奨マーキングする（`package.json` の VS Code 設定スキーマに `deprecationMessage` を付与し、README にも非推奨注記を入れる）
- 単体テスト・統合テスト・README / CHANGELOG の更新

含まないもの:

- `markdown-it-plantuml` プラグインの差し替えや独自実装への置換
- フェンス言語名 (`plantuml`) を設定で変更可能にする機能
- フロントマターでの `plantumlServer` 上書きサポート（既存コードに無いため踏襲）
- Mermaid など他のフェンス言語への波及（Mermaid はブラウザ側スクリプトが既に処理しており、サーバ側介在不要）
- `@startuml` / `@enduml` 経路および `plantumlOpenMarker` / `plantumlCloseMarker` 設定の **削除や機能停止**（非推奨マーキングは行うが、動作は維持する）

## アーキテクチャ概要

PlantUML を 2 経路で並行サポートする。

| 経路 | 担当 | 入力 | 出力 |
|---|---|---|---|
| A. ブロック検出 | 既存 `markdown-it-plantuml` プラグイン（無改造） | `@startuml`/`@enduml`（`plantumlOpenMarker`/`plantumlCloseMarker` で上書き可） | `<img>` タグ（`src` は `${server}/svg/${encoded}`） |
| B. フェンス検出（新規） | カスタム `fence` レンダラ | `` ```plantuml ... ``` `` | `<img>` タグ（`src` は `${server}/svg/${encoded}`） |

両経路は同じ `plantumlServer` 設定を共有する。出力 `<img>` タグは構造的に同等
（同じサーバ、`/svg/` エンドポイント、同じ属性セット）とする。エンコード後
の `src` ペイロードは両経路で異なる場合がある（`plantuml-encoder` と
`markdown-it-plantuml` 内部 deflate は実装が異なるため、同じ PlantUML ソース
に対して別々のバイト列を生成しうる — いずれも PlantUML サーバは等価に復号
する）。属性セットの細部は実装段階で経路 A の挙動に揃える。

## コンポーネントとファイル構成

| 変更対象 | 内容 |
|---|---|
| `src/utils.ts` | 新規ヘルパ `buildPlantumlImgTag(source: string, server: string): string` を追加。`plantuml-encoder` で deflate+base64 エンコードし、経路 A と同等の `<img>` タグ（`src` は `${server}/svg/${encoded}`、属性セットは経路 A 実出力に合わせる）を返す |
| `src/extension.ts` | `md.use(markdownItPlantuml, …)` の **直後** で `md.renderer.rules.fence` を上書き。`token.info.trim().toLowerCase() === 'plantuml'` のとき `buildPlantumlImgTag` を呼び、それ以外は元の fence レンダラへ委譲 |
| `package.json` | `dependencies` に `plantuml-encoder` を追加 |
| `package-lock.json` | `npm install` で自動更新 |

変更しないもの:

- `markdown-it-plantuml` プラグイン本体および型定義 (`src/types/markdown-it-plantuml.d.ts`)
- 既存の `plantumlOpenMarker` / `plantumlCloseMarker` / `plantumlServer` 設定の挙動
- `src/readme-diagrams.ts` の `buildPlantumlImageUrl`（README 生成専用、別文脈のためそのまま）

レンダラ上書きパターン（疑似コード）:

```ts
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
  if (tokens[idx].info.trim().toLowerCase() === 'plantuml') {
    return utils.buildPlantumlImgTag(tokens[idx].content, plantumlOptions.server);
  }
  return defaultFence(tokens, idx, opts, env, self);
};
```

## データフロー（経路 B）

1. ユーザの markdown に `` ```plantuml ... ``` `` が含まれる
2. markdown-it のトークナイザがフェンスとして解析し `token.type='fence'`, `token.info='plantuml'`, `token.content=<inner text>` を生成
3. レンダリング時、上書きした `fence` ルールが `info==='plantuml'` を検知
4. `buildPlantumlImgTag(content, server)` が `plantuml-encoder` で deflate + base64 エンコード → `<img src="${server}/svg/${encoded}" alt="">` を返す
5. 出力 `<img>` は経路 A と同形式のため、後段の HTML→PDF 変換に差はない

### 経路 A との競合

`markdown-it-plantuml` のブロックルールはトークン化段階で `@startuml` /
`@enduml` マーカーを行頭から探す。`` ```plantuml `` から始まる行はマーカーに
一致しないため経路 A は反応せず、フェンスがそのまま消費される。逆に `@startuml`
だけが書かれた素の段落は経路 A が処理し、フェンスにはならないので経路 B も発火
しない。**両経路は相互排他的** で、二重レンダリングは起きない。

### 既存ワークアラウンド利用者への影響

`plantumlOpenMarker: "```plantuml"` を設定済みのユーザは、その設定により
`markdown-it-plantuml` のブロックルールがフェンス開始行よりも先（`'before fence'`）
に発火し続けるため、従来通り経路 A で処理される。経路 B は発火せず、出力は
変わらない。

## エラー処理とエッジケース

| ケース | 挙動 |
|---|---|
| `` ```plantuml `` フェンスの本文が空 | `plantuml-encoder` は空文字列でも有効な URL を返す。出力は空図の `<img>`。例外なし |
| `plantumlServer` 設定が空文字列 | URL 先頭が `/svg/...` になり相対パス扱い。経路 A と同じ既存挙動 |
| `info` が `plantuml ` のように末尾空白付き / 大文字 `PLANTUML` | `token.info.trim().toLowerCase() === 'plantuml'` で判定し許容 |
| `info` が `plantuml-foo` 等の派生 | 厳密一致でないので **マッチしない** → 既定の fence レンダラに委譲（コードブロック表示） |
| 既存の `mermaid` フェンス | `info==='plantuml'` でないので素通り。ブラウザ側 mermaid.js が従来通り処理 |
| `markdown-pdf.sanitize` 有効時 | 出力は `<img src="...">` のみで `sanitize-html` のデフォルト許可タグに含まれるため通過する。経路 A と同じ |

例外方針: ヘルパは内部で例外を投げない。`plantuml-encoder` の `encode` は同期で
純粋関数であり、文字列入力に対して常に成功する。

## 設定との関係

| 設定 | 既定 | 経路 A への影響 | 経路 B への影響 |
|---|---|---|---|
| `markdown-pdf.plantumlServer` | `http://www.plantuml.com/plantuml` | 既存通り使用 | 同じ値を共有 |
| `markdown-pdf.plantumlOpenMarker` | `@startuml` | 既存通り使用 | 影響なし |
| `markdown-pdf.plantumlCloseMarker` | `@enduml` | 既存通り使用 | 影響なし |
| フロントマター `plantumlOpenMarker` / `plantumlCloseMarker` | なし | 既存通り設定を上書き | 影響なし |

`markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` は
経路 A 専用設定として動作は維持するが、**非推奨**として扱う。具体的には
`package.json` の VS Code 設定スキーマに `deprecationMessage`
（例: "Deprecated. Use ` ```plantuml ` fenced code blocks instead."）を付与し、
README の対応セクションにも非推奨注記を加える。フロントマター上書きについても
README で同様に注記する。`markdown-pdf.plantumlServer` は両経路で共有される
現役設定として維持し、非推奨にはしない。

## テスト戦略

### 単体テスト (`test/unit/utils.test.ts`)

- `buildPlantumlImgTag`
  - 既知の入力に対して `src` 属性が `${server}/svg/${expectedEncoded}` となる `<img>` を返すこと
  - サーバ URL が末尾スラッシュ有無のいずれでも経路 A と同じ結合挙動になること
  - 空文字列入力でも例外を投げず `<img>` を返すこと
  - 出力 `<img>` タグが、`markdown-it-plantuml` プラグインに同じソースを通したときの `<img>` タグと **構造的に同等** であること（どちらも `<img src="${server}/svg/<encoded>" alt="uml diagram">` の形に一致することをシェイプ正規表現でロックする。エンコード済みペイロード自体は両経路で実装依存のため、バイト厳密比較はしない）

### 統合テスト (`test/integration/`)

新規 fixture を追加する。

- `fixtures/plantuml-fence.md`:

  ~~~markdown
  # PlantUML fence

  ```plantuml
  Bob -> Alice : hello
  ```
  ~~~

- `expected/plantuml-fence.html`: 本文と同じ位置に `<img src="…/svg/…" alt="">` を含む期待 HTML
- `extension.test.ts` に既存 fixture と同じパターンで登録する

### 回帰確認

- `plantuml.md`（`@startuml`/`@enduml` 経路）が変わらず通ること
- `plantuml-custom-marker.md`（`plantumlOpenMarker: "```plantuml"` ワークアラウンド）が変わらず通ること（経路 A 維持を担保）

## ドキュメント更新

| ファイル | 変更内容 |
|---|---|
| `README.md` / `README.ja.md` | PlantUML セクションを「`` ```plantuml `` フェンス記法（推奨、VS Code プレビューと同じ書式）」中心に書き換える。`@startuml`/`@enduml` は **後方互換目的・基本的に非推奨** として併記する。PlantUML options セクションの `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` にも **Deprecated** 注記を加える |
| `CHANGELOG.md` | 適切な節に "Add support for ```plantuml fenced code blocks as the recommended syntax. The existing `@startuml`/`@enduml` block syntax (and the `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` settings) remain functional but are now deprecated." を追加 |
| `package.json` | `contributes.configuration` の `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` に `deprecationMessage` を追加（VS Code 設定 UI で取り消し線＋警告として表示される） |

書かないこと:

- フロントマター `plantumlServer` 上書きへの言及（スコープ外）
- `@startuml` 経路の機能停止や削除（後方互換のため動作は維持）

## 依存関係

- 追加: `plantuml-encoder`（小さく安定したパッケージ。`markdown-it-plantuml` は内部実装の `lib/deflate.js` を持っており `plantuml-encoder` には依存していないため明示追加が必要）

## 受け入れ基準

- ` ```plantuml ... ``` ` フェンスを含む markdown を PDF / HTML 出力したとき、対応する PlantUML 図が `<img>` として表示される
- 同一文書内に `@startuml ... @enduml` ブロックがあれば、それも引き続き図として表示される
- `plantumlServer` を独自サーバに設定しても両経路の `<img>` URL がそのサーバを指す
- `plantumlOpenMarker` / `plantumlCloseMarker` を設定しているユーザの既存挙動が変わらない（動作レベルの後方互換）
- VS Code 設定 UI で `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` が非推奨表示される
- README / README.ja の PlantUML セクションが `` ```plantuml `` フェンスを推奨記法として案内し、`@startuml` を後方互換として記載している
- CHANGELOG に新機能と非推奨化が記録されている
- 既存の統合テスト 18 件が引き続き通る
- 新規追加した単体テスト・統合テストが通る
