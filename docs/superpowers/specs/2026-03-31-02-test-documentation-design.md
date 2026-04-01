# テスト内容ドキュメント化 設計書

## 概要

既存のテストコードを読み解かなくても、`test/` 配下のテストが何を検証しているかを把握できるように、開発者向けの説明ドキュメントを英語版と日本語版で追加する。

追加する文書は以下の 2 ファイルとする。

- `test/README.md`
- `test/README.ja.md`

## 背景

- このリポジトリには `test/unit/utils.test.js` と `test/integration/extension.test.js` があり、ユーティリティ関数の単体テストと拡張機能の統合テストが整備されている
- 一方で、各テスト群の責務、実行前提、環境依存の扱いをまとめた開発者向け文書は存在しない
- ルートの `README.md` / `README.ja.md` は拡張機能利用者向けの文書であり、開発者向けのテスト説明を混在させるのは役割がぶれる

## 目的

- 開発者が `test/` 配下のテスト構成を短時間で理解できるようにする
- ユニットテストと統合テストが何を保証しているかを明文化する
- テスト追加時に、どの粒度で文書を更新すべきかの基準を揃える

## 方針

- 利用者向け README には追記せず、`test/` 配下に独立した開発者向け文書を置く
- 英語版と日本語版で同じ構成を採用し、内容の対応関係を保つ
- 文書はテストケース名の単純な列挙ではなく、`describe` 単位や fixture 群単位で責務を要約する
- 最近追加されたパス解決や出力先解決の境界条件、環境依存値の正規化、Chromium 依存の有無など、保守上重要な前提を優先して書く
- `docs/superpowers/` 配下には設計・計画のみを置き、本体の説明文書は `test/` 配下に置く

## 対象読者

- テストを追加・更新する開発者
- テスト失敗時に、どの領域の保証が崩れたのかを把握したい開発者
- リポジトリのテスト戦略を把握したいメンテナ

## ドキュメント構成

英語版・日本語版ともに以下の構成とする。

1. Overview / 概要
2. Test structure / テスト構成
3. Unit tests / ユニットテスト
4. Integration tests / 統合テスト
5. How to run / 実行方法
6. Notes and limitations / 注意点と制約

## セクション設計

### 1. Overview / 概要

- このディレクトリの文書が開発者向けであること
- テストが unit / integration の 2 系統で構成されていること
- 詳細はテストコード本体にあるが、この文書では意図と範囲を要約すること

### 2. Test structure / テスト構成

- `test/unit/utils.test.js` が `src/utils.js` の関数群を対象にしていること
- `test/integration/extension.test.js` が VS Code コマンド経由の出力を対象にしていること
- `test/integration/fixtures/` と `test/integration/expected/` の役割

### 3. Unit tests / ユニットテスト

以下の観点で `utils.test.js` を要約する。

- 真偽値処理やファイル存在確認などの基本ユーティリティ
- `Slug` とテンプレート変換の文字列処理
- `readFile` や `makeCss` のファイル読み込み
- `convertImgPath` の URI / パス変換
- `isExcludeFile` の除外判定
- `resolveHref` と `resolveOutputDir` の基準ディレクトリ解決
- スペース、`#`、`file://`、`~`、`../`、Windows 専用ケースなどの境界条件
- `buildStyleTags` のデフォルトスタイル・ハイライト・追加 CSS の組み立て

個々の `it(...)` 名を全列挙するのではなく、どの関数がどの種類の回帰を防いでいるかが分かる書き方にする。

### 4. Integration tests / 統合テスト

以下の観点で `extension.test.js` を要約する。

- HTML スナップショット比較
- fixture と expected を使った機能単位の検証
- `normalizeHtml` によるパス・日付・時刻の正規化
- PlantUML テストを先頭で扱う理由
- PDF / PNG / JPEG の生成テスト
- Chromium または Chrome がない場合にバイナリ生成テストを skip すること
- 生成ファイルの存在確認、サイズ確認、マジックバイト確認、後始末

### 5. How to run / 実行方法

- `package.json` に定義されているスクリプトを根拠に、テスト実行コマンドを載せる
- 可能であれば unit と integration の実行方法を分けて説明する
- VS Code 拡張テストが通常の Node.js 単体テストとは異なる前提を持つ場合は補足する

### 6. Notes and limitations / 注意点と制約

- バイナリ生成テストは実行環境に依存すること
- HTML 比較は出力の一部を正規化していること
- 見た目品質の完全一致や UI 操作の完全 end-to-end までは保証していないこと
- Windows 専用ケースの一部は非 Windows 環境ではスキップされること

## 成果物

- `test/README.md`
- `test/README.ja.md`

両ファイルは見出し構成を揃え、保守時に英日で差分追跡しやすい状態にする。

## 検証

- 追加した 2 文書を読み比べ、見出し構成と説明対象が揃っていることを確認する
- 実行コマンドが `package.json` と矛盾しないことを確認する
- テストファイル名やディレクトリ名の参照先に誤りがないことを確認する

## スコープ外

- テストコードそのものの追加・修正
- `README.md` / `README.ja.md` への統合
- `docs/superpowers/` 配下への英語版文書追加
- 新しいテスト戦略やカバレッジ方針の策定
