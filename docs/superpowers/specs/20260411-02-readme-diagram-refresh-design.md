# README 図更新コマンド設計

## 目的

`README.md` に埋め込んでいる PlantUML / Mermaid のサンプル画像を、必要なときだけローカルコマンドで再生成できるようにする。

対象画像は以下の 2 つに限定する。

- `images/PlantUML.png`
- `images/mermaid.png`

`README.ja.md` は同じ画像を参照するだけで、生成元にはしない。

## 前提

- 図の正本は `README.md` に置く
- 更新は手動実行のみとし、自動 hook や CI には組み込まない
- ネットワーク利用は許容する
- PlantUML は既定の PlantUML サーバーを利用する
- Mermaid は既定の Mermaid CDN スクリプトを利用する

## 方針

`README.md` から対象コードブロックを直接抽出し、専用コマンドで PNG を生成する。

追加するコマンドは `npm run update-readme-diagrams` とし、内部では単機能のスクリプトを呼び出す。

## 入力と出力

### 入力

- `README.md` 内の `### markdown-it-plantuml` セクションにある PlantUML コードブロック
- `README.md` 内の `### mermaid` セクションにある Mermaid コードブロック

### 出力

- `images/PlantUML.png`
- `images/mermaid.png`

既存ファイルは上書き更新する。

## 実装概要

### コマンド

- `package.json` に `update-readme-diagrams` script を追加する

### スクリプト

- `scripts/update-readme-diagrams.mjs` を追加する
- スクリプトは以下を順に実行する
  1. `README.md` を読み込む
  2. PlantUML セクションの fenced code block を抽出する
  3. Mermaid セクションの fenced code block を抽出する
  4. PlantUML 画像を生成する
  5. Mermaid 画像を生成する
  6. 生成結果を `images/` に保存する

## PlantUML 生成

- 抽出した UML テキストを PlantUML サーバー互換の URL に変換する
- サーバーから PNG を取得し、`images/PlantUML.png` に保存する
- サーバー URL は拡張機能の既定値と同じ `http://www.plantuml.com/plantuml` を使う

## Mermaid 生成

- 一時 HTML を組み立て、Mermaid CDN (`https://unpkg.com/mermaid/dist/mermaid.min.js`) を読み込む
- headless browser で Mermaid を描画する
- 図要素を PNG として `images/mermaid.png` に保存する

## 抽出ルール

- PlantUML は `### markdown-it-plantuml` 見出し配下の最初の fenced code block を使う
- Mermaid は `### mermaid` 見出し配下の ` ```mermaid ` fenced code block を使う
- 想定した見出しまたはコードブロックが見つからない場合は失敗として終了する

## エラーハンドリング

- `README.md` が読めない場合は失敗
- 対象見出しが見つからない場合は失敗
- コードブロック抽出に失敗した場合は失敗
- PlantUML サーバー応答が失敗した場合は失敗
- Mermaid 描画または PNG 保存に失敗した場合は失敗

失敗時は非 0 終了コードを返し、どの段階で失敗したか分かるメッセージを出す。

## 既存コードとの整合

- 生成対象は README 用画像だけに限定し、既存の sample 生成フローは変更しない
- README の画像参照パスは変更しない
- 拡張機能本体の PlantUML / Mermaid 実装や設定値とは競合しないよう、既定値だけを参照する

## 検証

- `npm run update-readme-diagrams` が成功すること
- `images/PlantUML.png` と `images/mermaid.png` が生成または更新されること
- コマンド失敗時に非 0 で終了すること

## スコープ外

- README.ja.md からの図抽出
- CI や GitHub Actions による自動更新
- README 内の他画像の自動更新
- sample 生成フローとの統合
- 図生成対象の一般化
