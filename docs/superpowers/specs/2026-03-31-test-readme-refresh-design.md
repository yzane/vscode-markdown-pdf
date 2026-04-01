# テスト README 最新化 Design

## 目的

`test/README.md` と `test/README.ja.md` を、現在の `test/integration/extension.test.js` の構成に合わせて最新化する。特に、統合テストが HTML スナップショット、バイナリ生成、異常系の 3 系統で構成されていることを文書から明確に読み取れる状態にする。

## 対象

- `test/README.md`
- `test/README.ja.md`

## 非対象

- テストコード本体の修正
- `package.json` のスクリプト変更
- 利用者向け README の更新

## 現状認識

- `test/unit/utils.test.js` は `src/utils.js` のヘルパー群を対象にしている。
- `test/integration/extension.test.js` には次の 3 系統のテストがある。
  - HTML 出力を expected スナップショットと比較するテスト
  - PDF、PNG、JPEG の生成可否とマジックバイトを確認するテスト
  - 非 Markdown ファイルと untitled ドキュメントで拡張機能がクラッシュしないことを確認する異常系テスト
- 既存 README は主に HTML スナップショットとバイナリ生成に焦点があり、異常系テストの説明が欠けている。

## 方針

- 既存の見出し構成は維持する。
- `Test Structure` / `テスト構成` では、`test/integration/extension.test.js` の責務を 3 系統として説明する。
- `Integration Tests` / `統合テスト` では、以下を分けて記述する。
  - HTML スナップショットの実行フローと正規化内容
  - バイナリ生成テストの前提条件と検証内容
  - 異常系テストが「警告を出して戻る」振る舞いを確認していること
- `How to Run` / `実行方法` は `package.json` の現行スクリプト定義に合わせる。
- `Notes and Limitations` / `注意点と制約` では `xvfb-run` と Chromium/Chrome 依存、環境依存値の正規化、プラットフォーム依存スキップを明記する。

## 英日整合性

- 英語版と日本語版は同一の見出し順を保つ。
- 内容差は翻訳上の自然さに限定し、説明対象のテスト範囲は一致させる。

## 検証

- 更新後に `git diff -- test/README.md test/README.ja.md` で差分を確認する。
- 文面が `test/unit/utils.test.js`、`test/integration/extension.test.js`、`package.json` の現状と矛盾しないことを目視確認する。