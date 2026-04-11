# README 図更新コマンド extension host 化設計

## 目的

`README.md` に埋め込んでいる PlantUML / Mermaid のサンプル画像更新を、VS Code extension host 上で既存の export 経路を再利用して実行できるようにする。

外部からの入口は手動コマンド `npm run update-readme-diagrams` を維持する。

## 背景

既存の `scripts/update-readme-diagrams.ts` は Node スクリプトとして直接動作し、README からの抽出・PlantUML 取得・Mermaid 描画を独自に処理している。この方式でも動作は可能だが、以下の点で既存実装と分岐する。

- Chromium キャッシュパスの決定が拡張本体と分かれる
- Mermaid 描画経路が拡張本体の export 経路と別になる
- VS Code extension host を使う integration / sample 実行系と構造が揃わない

このため、README 図更新も extension host 経由に寄せる。

## 方針

- ユーザー向けコマンド名は `npm run update-readme-diagrams` のままにする
- 内部実装は `vscode-test --label readme-diagrams` を使う
- 実際の画像生成は VS Code extension host 上で既存の export コマンドを呼び出して行う
- README 図用の一時 Markdown を生成し、その Markdown を PNG 出力して `images/PlantUML.png` / `images/mermaid.png` に反映する

## 既存実装との関係

### 再利用するもの

- `.vscode-test.mjs` の test launcher 構成
- `test/sample/generate-sample.ts` の extension host 上でコマンドを呼ぶパターン
- 拡張本体の `extension.markdown-pdf.png` export 経路
- Chromium 解決・キャッシュ管理・Mermaid 描画・PlantUML 処理の既存実装

### 置き換えるもの

- `scripts/update-readme-diagrams.ts` による直接描画

このスクリプトは削除するか、`vscode-test --label readme-diagrams` を呼ぶ薄いラッパーに置き換える。

## 入出力

### 入力

- `README.md` 内の `### markdown-it-plantuml` セクションの図コードブロック
- `README.md` 内の `### mermaid` セクションの図コードブロック

### 出力

- `images/PlantUML.png`
- `images/mermaid.png`

## 実行フロー

1. `npm run update-readme-diagrams` を実行
2. npm script から `vscode-test --config .vscode-test.mjs --label readme-diagrams` を起動
3. `test/sample/` 配下の専用テストが実行される
4. テスト内で `README.md` から PlantUML / Mermaid のコードを抽出する
5. 図ごとに一時 Markdown を作成する
6. extension host 上で `extension.markdown-pdf.png` を呼び出して PNG を生成する
7. 生成された PNG を `images/PlantUML.png` / `images/mermaid.png` にコピーする
8. 一時 Markdown と一時 PNG を削除する

## ファイル構成

### 追加・変更対象

- Modify: `package.json`
- Modify: `.vscode-test.mjs`
- Modify: `test/sample/generate-sample.ts` または Create: `test/sample/update-readme-diagrams.ts`
- Reuse: `src/readme-diagrams.ts`

### 推奨構成

sample 生成と責務を分けるため、新規ファイル `test/sample/update-readme-diagrams.ts` を追加する。

- `test/sample/generate-sample.ts`
  - 既存の sample 一括生成専用
- `test/sample/update-readme-diagrams.ts`
  - README 図更新専用

## README 抽出ロジック

README 抽出は既存の `src/readme-diagrams.ts` を再利用する。

- `extractReadmeDiagramSources()` で PlantUML / Mermaid の文字列を取得する
- 追加の抽出ロジックは原則不要

## 一時 Markdown 形式

図ごとに最小 Markdown を生成する。

### PlantUML 用

```md
@startuml
...
@enduml
```

### Mermaid 用

```md
```mermaid
...
```
```

出力対象は PNG のみとする。

## export 実行

extension host 上で以下を使う。

- 対象 Markdown を開く
- `vscode.window.showTextDocument()` で表示する
- `vscode.commands.executeCommand('extension.markdown-pdf.png')` を実行する
- 生成された PNG を待機し、目的の `images/` 配下へコピーする

これにより、Chromium 解決・Mermaid・PlantUML・PNG 出力は拡張本体の既存経路に統一される。

## Chromium キャッシュ

README 図更新処理では cache path を独自に決めない。

既存の extension host 実行時と同じく、拡張本体が使う global storage ベースのキャッシュ管理に従う。

これにより、sample / integration / 手動更新で Chromium 解決の挙動を揃える。

## 検証

- `npm run update-readme-diagrams` が成功する
- `images/PlantUML.png` が更新される
- `images/mermaid.png` が更新される
- 実行後に repo 配下へ不要な一時ディレクトリを残さない
- sample 生成処理 (`npm run sample`) に影響を与えない

## エラーハンドリング

- `README.md` の対象セクションが見つからない場合は失敗
- 一時 Markdown 作成に失敗した場合は失敗
- `extension.markdown-pdf.png` 実行後に PNG が生成されない場合は失敗
- 失敗時も一時ファイルは cleanup する

## スコープ外

- `README.ja.md` からの図抽出
- CI / GitHub Actions での自動更新
- README 内の他画像更新
- sample 生成物全体の再設計
