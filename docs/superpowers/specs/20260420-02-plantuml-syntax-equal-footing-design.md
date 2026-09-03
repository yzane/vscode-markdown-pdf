# PlantUML 記法の対等化（非推奨マーキング撤回）設計

## 背景

先行 spec `20260418-02-plantuml-fence-support-design.md` に基づく実装（`feature/plantuml-fence-support`、develop にマージ済み・未リリース）では、`` ```plantuml `` フェンスドコードブロックを **推奨記法** として追加する一方で、従来の `@startuml` / `@enduml` ブロック記法および対応する `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` 設定を **非推奨** と位置づけた。その結果、以下の "Deprecated / 非推奨 / recommended / 推奨" のマーキングが散在している。

- `package.json`: 2 つの設定項目に `deprecationMessage` を付与（VS Code 設定 UI で取り消し線・⚠表示）
- `README.md` / `README.ja.md`: 冒頭 CHANGELOG 抜粋、PlantUML セクション、Options List の各所に非推奨・推奨の注記
- `CHANGELOG.md` 未リリース節 `X.Y.Z`: 「Deprecate the `@startuml` / `@enduml` ...」行
- `sample/README.html`: 上記に追従した再生成結果

しかし方針を再検討した結果、`@startuml` / `@enduml` を非推奨扱いにする積極的な理由は薄いと判断した。既存ドキュメントは広く `@startuml` 形式で書かれており、本拡張としても `markdown-it-plantuml` に依存する形で長年サポートしてきた実績がある。`` ```plantuml `` は VS Code 標準プレビュー・GitHub・GitLab と互換であるという別軸の価値を持つが、それは `@startuml` の価値を損なうものではない。したがって両記法を **対等な選択肢** として並立させる方針に切り替える。

本変更は未リリース状態のうちに行うため、ユーザ影響はない。

## 目的

`` ```plantuml `` / `@startuml` の 2 記法を、本拡張の **対等な PlantUML 記法** として位置づけ直す。ドキュメント・設定 UI 上に付与した "Deprecated" / "recommended" マーキングを全撤回し、「既存の `@startuml` に加えて `` ```plantuml `` にも対応しました」という中立的な並列表現にする。

## スコープ

含むもの:

- `package.json` の `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` から `deprecationMessage` キーを削除
- `README.md` / `README.ja.md` の冒頭 CHANGELOG 抜粋・PlantUML セクション・Options List を、両記法対等・`` ```plantuml `` 先頭の順に書き換え（"Deprecated" / "recommended" / "非推奨" / "推奨" の語を除去）
- `CHANGELOG.md` 未リリース節 `X.Y.Z` の `### Changes` を、1 行目（Add support）は中立文に書き換え（issue 参照 `#92` / `#162` / `#389` は保持）、2 行目（Deprecate）は削除
- `sample/README.html` を README 変更に合わせて再生成

含まないもの:

- 実コード (`src/**`) の挙動変更 — 2 経路（`markdown-it-plantuml` ブロック検出 / カスタム fence レンダラ）の動作は一切変更しない
- 単体テスト・統合テストのロジック変更 — 既存テストがそのまま通ることを前提とする
- 旧 spec `docs/superpowers/specs/20260418-02-plantuml-fence-support-design.md` への修正（歴史的記録として凍結し、本 spec で上書き）
- 対応する旧 plan `docs/superpowers/plans/20260418-02-plantuml-fence-support.md` への修正
- `markdown-pdf.sanitize` の `"none"` に付いている非推奨表記（本件と無関係のため触らない）
- 新しい設定項目の追加 / 既存設定のデフォルト変更 / フェンス言語名 (`plantuml`) のカスタマイズ機能

## アーキテクチャ概要

実コードのアーキテクチャは変更しない。先行 spec の定義通り、PlantUML は 2 経路で並行サポートされ続ける。

| 経路 | 担当 | 入力 | 出力 |
|---|---|---|---|
| A. ブロック検出 | `markdown-it-plantuml` プラグイン | `@startuml` / `@enduml`（`plantumlOpenMarker` / `plantumlCloseMarker` で上書き可） | `<img>` タグ |
| B. フェンス検出 | カスタム `fence` レンダラ（`buildPlantumlImgTag`） | `` ```plantuml ... ``` `` | `<img>` タグ |

両経路は相互排他的で二重レンダリングは起きない（先行 spec 5.1 節に記載済み）。本 spec ではこの挙動を変えない。

## コンポーネントとファイル構成

| 変更対象 | 内容 |
|---|---|
| `package.json` | `contributes.configuration` の `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` から `deprecationMessage` キーをそれぞれ削除。他のフィールド (`description` / `type` / `default`) は既存のまま |
| `README.md` | 冒頭 CHANGELOG 抜粋・PlantUML セクション・Options List を後述の方針で書き換え |
| `README.ja.md` | README.md と同じ情報量・構造で日本語側を書き換え |
| `CHANGELOG.md` | 未リリース節 `X.Y.Z` の `### Changes` を後述の方針で書き換え |
| `sample/README.html` | 既存の生成パイプライン (`test/sample/update-readme-diagrams.ts`) を通じて再生成。手動編集はしない |

変更しないもの:

- `src/extension.ts` / `src/utils.ts` / `src/markdown-it-math-fence.ts` など実装コード
- `src/types/markdown-it-plantuml.d.ts` / `src/types/plantuml-encoder.d.ts`
- `test/unit/**` / `test/integration/**` 配下のテストおよび fixture
- 旧 spec / 旧 plan 文書

## 具体的な書き換え方針

### `package.json`

2 箇所の `deprecationMessage` フィールドをキーごと削除する（空文字化ではない）。他の属性に追加・補足説明は入れない（最小差分）。

### `README.md` / `README.ja.md` 冒頭 CHANGELOG 抜粋

現状の 2 行（Add support / Deprecated）を 1 行にまとめ、中立表現に書き換える。

- 英（置換後）: `Added support for ```plantuml fenced code blocks as a PlantUML syntax in addition to the existing @startuml / @enduml block syntax. Both are supported on equal footing. [#92] [#162] [#389]`
- 和（置換後）: `既存の @startuml / @enduml ブロック記法に加えて、```plantuml フェンスドコードブロック記法にも対応しました。両者は対等にサポートされます。 [#92] [#162] [#389]`

Deprecated 行は削除。

### README.md / README.ja.md PlantUML セクション本体

両者対等・`` ```plantuml `` 先頭の順で構造を書き直す:

1. **導入文**: 本拡張は PlantUML を 2 つの記法でサポートする旨を中立的に宣言。どちらを使っても結果は同じ `<img>` タグとしてレンダリングされ、`markdown-pdf.plantumlServer` 設定を共有することに触れる
2. **Fenced code block** サブ見出し: `` ```plantuml ... ``` `` のサンプル。VS Code 標準プレビュー・GitHub・GitLab と同じ書式であることも中立トーンで併記
3. **Block marker** サブ見出し: `@startuml ... @enduml` のサンプル。`markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` でマーカーをカスタマイズ可能である旨を中立記載

削除対象:

- README.ja.md の `> **後方互換（新規利用は基本的に非推奨）:**` の見出し風ブロックとその解説
- 同等の英語文（"backward compatibility only" / "not recommended for new documents" 等）
- セクション内外の「推奨 / recommended」「非推奨 / deprecated」の語すべて

### README.md / README.ja.md Options List

`plantumlOpenMarker` / `plantumlCloseMarker` の説明から Deprecated マーキングと「`` ```plantuml `` フェンス記法を使ってください」という誘導文を削除し、中立表現に書き換える。

- 英（例）: `Block marker for the start/end of a PlantUML block used by the @startuml / @enduml syntax. Change this if you want to use different markers.`
- 和（例）: `@startuml / @enduml 記法で使用する PlantUML ブロックの開始／終了マーカーです。別のマーカーを使いたい場合に変更します。`

### `CHANGELOG.md` 未リリース節

`### Changes` の 1 行目を中立文に書き換え、2 行目（Deprecate）を削除する:

置換前:

```
* Add support for ```plantuml fenced code blocks as the recommended PlantUML syntax ... [#92] [#162] [#389]
* Deprecate the @startuml / @enduml block syntax and the markdown-pdf.plantumlOpenMarker / markdown-pdf.plantumlCloseMarker settings. They remain functional for backward compatibility, but the VS Code settings UI now shows them as deprecated.
```

置換後:

```
* Add support for ```plantuml fenced code blocks as a PlantUML syntax in addition to the existing @startuml / @enduml block syntax. Both are supported on equal footing. [#92] [#162] [#389]
```

他の節（`### Breaking Changes`、`sanitize` / `chromium.autoDownload` / `math` 関連の行）は触らない。

### `sample/README.html`

既存の README 生成パイプラインを経由して再生成する。生成スクリプト (`test/sample/update-readme-diagrams.ts`) は現行のまま利用。手動編集は行わない。影響範囲は `Deprecated` / `recommended` を含んでいた箇所（L404 / L409 / L1299 / L1305 付近）が新文面に置き換わる。PlantUML 図 (`<img>`) の生成ロジックは変わらないため URL は現状維持。

## 執筆方針

- 日英で同じ構造・同じ情報量を維持する（片方だけ厚くならないように）
- 既存の例文・サンプルコードは、方針と矛盾しない限り可能な限り流用して diff を最小化する
- Markdown の目次・アンカーリンクに影響する見出し変更は `sample/README.html` の再生成で自動追従する範囲にとどめる
- 実コードを変更しない前提に反する記述を入れない

## テスト戦略

### 自動テスト

コードの挙動変更がないため、新規テスト追加・既存テスト修正は不要。以下の既存テストが引き続き通ることを確認する。

- 単体: `test/unit/utils.test.ts`（`buildPlantumlImgTag` の出力形）
- 単体: `test/unit/readme-diagrams.test.ts`
- 統合: `test/integration/expected/plantuml.html`（経路 A: `@startuml` / `@enduml`）
- 統合: `test/integration/expected/plantuml-custom-marker.html`（経路 A: `plantumlOpenMarker` ワークアラウンド）
- 統合: `test/integration/expected/plantuml-fence.html`（経路 B: `` ```plantuml `` フェンス）

### 手動検証

- VS Code の設定 UI で `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` を開き、取り消し線・⚠アイコンが消えていること、通常の設定項目として表示されることを確認
- README.md / README.ja.md をプレビューで開き、PlantUML セクションと Options List に `Deprecated` / `非推奨` / `recommended` / `推奨` の語が残っていないこと
- `sample/README.html` が再生成され、対応箇所が新文面になっていること（差分確認）

### 文言監査（grep 系）

spec / plan / 旧 spec 以外のファイルに対して以下がマッチしないことを最終確認する。

- `README.md` / `README.ja.md` の PlantUML 関連箇所: `Deprecated` / `deprecated` / `非推奨` / `recommended` / `推奨`
- `CHANGELOG.md` 未リリース節: `Deprecate` / `deprecated` / `recommended`
- `package.json`: `deprecationMessage`（今回の 2 箇所が対象。他箇所は存在しない前提だが、ゼロヒットで確認）

## エラー処理とエッジケース

コード経路を変更しないため、実行時のエッジケースは先行 spec `20260418-02` のエラー処理表がそのまま有効である。本 spec で新たに考慮すべきエッジケースはない。

ドキュメント上のエッジケース:

- 翻訳漏れ: 日英どちらか片方に "Deprecated" / "非推奨" が残るリスク → 文言監査 grep でゼロヒットを確認
- `sample/README.html` の再生成忘れ: README と sample の内容ズレが発生 → 再生成を受け入れ基準に含める
- VS Code 設定 UI のキャッシュ: 開発者環境で古い `deprecationMessage` が残って見える可能性 → 手動検証は VS Code を再読み込みしてから行う

## 受け入れ基準

1. `package.json` の `markdown-pdf.plantumlOpenMarker` / `markdown-pdf.plantumlCloseMarker` から `deprecationMessage` が消えている（他のフィールドは既存のまま）
2. README.md / README.ja.md の PlantUML セクション冒頭例が `` ```plantuml `` になっており、続いて `@startuml` の例が紹介されている
3. README.md / README.ja.md の PlantUML セクション・Options List・冒頭 CHANGELOG 抜粋に `Deprecated` / `非推奨` / `recommended` / `推奨` の語が残っていない（文言監査 grep がゼロヒット）
4. CHANGELOG.md 未リリース節 `X.Y.Z` から `Deprecate` 行が消え、`Add support for` 行が中立文に書き換わっている（issue 参照 `#92` / `#162` / `#389` は保持）
5. `sample/README.html` が再生成され、README 変更が反映されている（同様に "Deprecated" / "recommended" が残らない）
6. 既存の単体テスト・統合テストがすべて通る
7. `docs/superpowers/specs/20260420-02-plantuml-syntax-equal-footing-design.md` と対応 plan が新規追加され、旧 spec `20260418-02-plantuml-fence-support-design.md` は未変更
8. ブランチは `develop` から派生した `feature/plantuml-equal-footing` を使用し、マージ前には AGENTS.md のマージ確認ルールに従う
