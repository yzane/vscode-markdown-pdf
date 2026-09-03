# テスト

## 概要

このディレクトリには、リポジトリのテスト構成を説明する開発者向けドキュメントを置きます。
テストは補助ロジック向けのユニットテスト、VS Code のコマンド経由における統合テスト、および統合テストと同じ VS Code ハーネスで走るサンプル／プレビュー生成タスクに分かれます。

## 実行方法

- `npm run test:unit` — ユニットテストのみ（`tsx --test`）。
- `npm run test:integration` — 統合テストのみ（VS Code テストハーネス。先に `npm run build` を実行）。
- `npm test` — `test:unit` の後に `test:integration` を実行。
- `npm run sample` — `sample/README.{pdf,html,png,jpeg}` を再生成。
- `npm run update-readme-previews` — README が参照する `images/` 配下のプレビュー PNG を再生成。

## テスト構成

- `test/unit/chromium-resolver.test.ts` は Chromium/Chrome 実行ファイルの解決ロジックを検証し、設定値、システム検索、ビルド ID のフォーマット、キャッシュのクリーンアップをカバーします。
- `test/unit/utils.test.ts` は `src/utils.ts` にある共通ヘルパー群を対象にし、真偽値の標準化、ファイル/ディレクトリ検出、スラッグ化、テンプレート置換、ファイル読み込み、CSS 組み立て、画像 URI 変換、除外判定、href/出力先解決、ハイライトコールバック、MIME 固有オプションなどを網羅します。スペース、`#`、`file://`、`~/`、`../`、data URI、Windows 固有パスなどの境界条件も引き続き押さえています。
- `test/unit/vscodeignore.test.ts` は `.vscodeignore` ファイルを読み込み、node_modules が除外され、バンドル対象が含まれず、実行時アセットが再包含され、puppeteer まわりが不要に再導入されないことを検証します。
- `test/unit/markdown-it-checkbox.test.ts` は GitHub 形式のチェックボックス (`- [ ]` / `- [x]`) を扱う内製 markdown-it プラグインを検証します。
- `test/unit/markdown-it-named-headers.test.ts` は見出し ID 生成と、アンカーを GitHub 互換に保つための `githubSlugify` ヘルパーを検証します。
- `test/unit/markdown-it-math-brackets.test.ts` は `\(...\)` / `\[...\]` ブラケット区切り数式記法のトークン化を検証します。
- `test/unit/markdown-it-math-fence.test.ts` は ` ```math ` フェンスドコードブロックのトークン化を検証します。
- `test/unit/math-renderer.test.ts` は KaTeX を用いる `renderMath()` の出力（インライン／ディスプレイの別、ユーザー定義マクロ、エラーハンドリング）を検証します。
- `test/unit/readme-previews.test.ts` は README プレビュー生成で使われる純粋ヘルパー群（セクション／フェンスブロック抽出、Mermaid 描画 HTML 組み立て、PlantUML URL 生成、エクスポート先パス解決）を検証します。
- `test/integration/extension.test.ts` は VS Code テストハーネスを使って拡張機能をドライブし、生成されたマークアップ、バイナリ、エラー出力を信頼済みフィクスチャと比較します。
- `test/integration/fixtures/` には統合テストで用いる Markdown 入力を置きます。
- `test/integration/expected/` には比較用の正規化済み HTML スナップショットを保管します。
- `test/sample/generate-sample.ts` は VS Code テストハーネス上で `README.md` を pdf/html/png/jpeg にエクスポートし、`sample/` ディレクトリへ書き出します。
- `test/sample/update-readme-previews.ts` は VS Code テストハーネス上で README から参照される `images/` 配下のプレビュー PNG を再生成します。

## ユニットテスト

各ユニットスイートは `tsx --test` で Node の組み込みテストランナーを使い、特定のヘルパー群に絞って検証を行います。

- `chromium-resolver` テストはユーザー指定パスとシステム探索結果の両方を確認し、ビルド ID 形式を検証し、キャッシュ削除が古いブラウザのみを対象にしていることを保証します。
- `utils` テストは `src/utils.ts` の共通ヘルパーを網羅し、プラットフォーム差のあるパス処理やテンプレート処理、スタイル生成、画像関連処理、出力先解決などを含みます。
- `.vscodeignore` テストは無効化された依存関係や再包含されたアセットをチェックすることで、esbuild 生成物との整合性を維持します。
- `markdown-it-checkbox` テストは内製プラグインに fixture Markdown を通し、GitHub の無効化チェックボックスと同じ HTML 形状になることを確認します。
- `markdown-it-named-headers` テストは ASCII / CJK / アンダースコア / 記号を含む見出しの ID 割り当てと、`githubSlugify` 単体の挙動をカバーし、ジェネレータが VS Code / GitHub と互換であることを保証します。
- `markdown-it-math-brackets` / `markdown-it-math-fence` テストはそれぞれブラケット区切り数式とフェンス数式について、パーサーレベルのトークン化、隣接インライン構文との優先順位、エスケープされた区切り子の素通し挙動を検証します。
- `math-renderer` テストはインライン／ディスプレイ／LaTeX 環境の代表的な式を KaTeX に通し、`katex` / `katex-display` ラッパクラス、ユーザー定義マクロが呼び出し間で漏洩しないことなどを確認します。
- `readme-previews` テストは統合スイートからも使われる純粋ヘルパー群（README セクション抽出、最初のフェンスブロック抽出、最初の `<pre>` ブロック抽出、Mermaid 用 HTML 組み立て、PlantUML 画像 URL 生成、エクスポート先解決）を対象にします。

## 統合テスト

統合スイートは `test/integration/extension.test.ts` で VS Code ハーネスを使い、同じコマンドパレットのエントリを走らせます。
HTML 系テストでは fixture Markdown を開いてエクスポートし、ファイル URI やタイムスタンプなど実行ごとに変動する値を正規化のうえで登録済みスナップショットと比較します。
フィクスチャは拡張機能の構文カバレッジを広く取り、checkbox / container / emoji / image / syntax-highlighting / breaks / page-break / mermaid / include（成功・missing・code-block・target）/ front matter（breaks・no-emoji）/ math（有効と無効）/ PlantUML を `@startuml`/`@enduml` ブロックマーカー形式と ` ```plantuml ` フェンス形式の両方で確認します（両形式は同じエンコード済み画像 URL を生成するはずです）。
PlantUML 系 fixture は例外フィルターを使い、ローカルに Java VM がない環境でも比較が成立するよう設計されています — 生成された画像バイトではなく決定論的な `<img src="...">` URL を比較します。
バイナリ生成テストは Markdown fixture を組み合わせて PDF/PNG/JPEG を生成し、それぞれの存在、サイズ、マジックバイトを確認します。
異常系テストでは非 Markdown ファイルや未保存ドキュメントを使ってコマンドを実行し、余計な HTML を吐かず安全に完了することを確かめます。

## サンプル／プレビュー生成

統合スイートと同じ VS Code テストハーネス上で動くヘルパータスクが 2 つあります。これらはトラッキング対象のアーティファクト（`sample/`, `images/`）を書き換えるため、`npm test` には含めていません。

- `npm run sample` は `test/sample/generate-sample.ts` を呼び、テストワークスペース上で `README.md` を開いて全形式（`sample/README.pdf` / `README.html` / `README.png` / `README.jpeg`）に出力します。README の "Sample files" セクションからリンクされている成果物です。
- `npm run update-readme-previews` は `test/sample/update-readme-previews.ts` を呼び、README 内の各プレビュー元（Mermaid ブロック / PlantUML ブロック / 数式ブロック / Checkbox サンプル / Container サンプルなど）を抽出して `.tmp-readme-previews/` の一時ワークスペースで PNG 化し、README が参照している `images/` 配下に書き出します。機能セクションのプレビュー画像を更新したいときに使用します。

どちらのタスクも実行時拡張と同じ解決ロジックで Chromium/Chrome 実行ファイルを必要とし、`dist/` のバンドルを通して動くため、`pretest:*` / `presample` の npm script から自動的に `npm run build` が先行します。

## 注意点と制約

- 統合テストは通常の Node.js プロセスではなく VS Code 拡張テスト環境で動作します。
- バイナリ生成、サンプル生成、README プレビュー生成のいずれも、拡張ランタイムから利用できる Chromium または Chrome 実行ファイルを必要とします。
- 一部の統合テストは比較前にファイル URI・タイムスタンプ・キャッシュパスなど環境依存出力を正規化します。
- PlantUML 統合テストは決定論的な画像 URL を比較するため、ローカルに Java VM が無くても成立します。
- Windows 固有のユニットテストは非 Windows 環境ではスキップされます。
- 異常系テストではコマンドが安全に終了することを確認しますが、警告メッセージ自体は検証しません。
- `npm run sample` と `npm run update-readme-previews` はトラッキング対象のアーティファクトを書き換えるため、コミット前に diff を確認してください。
- これらのテストは見た目の厳密一致や UI 操作の完全な end-to-end を保証するものではありません。
