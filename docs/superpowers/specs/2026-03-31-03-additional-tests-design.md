# 追加テスト設計仕様書

## 概要

既存テストスイートのカバレッジギャップを段階的に解消する。フェーズ2でユニットテストのエッジケースを補強し、フェーズ3で統合テストを拡充する。

## 背景

現在のテスト状況:

- `src/utils.js`: 12関数、90+ユニットテスト
- `extension.js`: 統合テスト14件（HTMLスナップショット7 + バイナリ生成3 + その他）
- `src/compile.js`: テストなし（ビルドスクリプト、対象外）

調査により、ユニットテストの実用的エッジケース不足と統合テストの機能カバレッジ不足が確認された。

---

## フェーズ2: ユニットテスト エッジケース補強

### 対象ファイル

- 変更: `test/unit/utils.test.js`
- ソースコード変更: なし

### convertImgPath（5件追加）

| # | テストケース | 入力例 | 期待結果 | 根拠 |
|---|---|---|---|---|
| 1 | クエリ文字列付きURL | `https://example.com/img.png?v=1` | そのまま返す | CDNキャッシュバスティングで頻出 |
| 2 | フラグメント付きURL | `https://example.com/img.svg#icon` | そのまま返す | SVGスプライト参照で使用 |
| 3 | Unicodeパス | `画像/テスト.png`（相対） | `file://` URIに変換 | 日本語ファイル名は現実的 |
| 4 | 複数の`#`を含むパス | `path/to/C#/image#1.png` | `#`が全て`%23`に置換 | `/g`フラグ付きreplaceの動作確認 |
| 5 | 空のfilename | 任意のsrc, `''` | クラッシュしない | `path.dirname('')`の挙動確認 |

### resolveHref（4件追加）

| # | テストケース | 入力例 | 期待結果 | 根拠 |
|---|---|---|---|---|
| 1 | フラグメント付きhref | `style.css#print` | ファイル相対で`file://`解決 | CSSメディアクエリ指定で使われうる |
| 2 | プロトコル相対URL | `//cdn.example.com/style.css` | 絶対パスとして`file://`付与 | `path.isAbsolute('//...')`がtrueを返す挙動の文書化 |
| 3 | `file://`スキーム付きhref | `file:///home/user/style.css` | `url.parse`で`protocol=file:`、http/httpsではないのでパス扱い — 現在の挙動確認 |
| 4 | 末尾スラッシュ付きhref | `styles/` | ファイル相対で解決 | ユーザーがディレクトリを指定する可能性 |

### Slug（4件追加）

| # | テストケース | 入力例 | 期待結果 | 根拠 |
|---|---|---|---|---|
| 1 | 句読点のみ | `"!@#$%^&*()"` | `""` | 全文字除去後の結果確認 |
| 2 | 既にスラグ化済み | `"hello-world"` | `"hello-world"` | 冪等性の確認 |
| 3 | CJK + Latin混合 | `"日本語 English テスト"` | encodeURIされハイフン結合 | 多言語ドキュメントで現実的 |
| 4 | 絵文字入り | `"Hello 🎉 World"` | encodeURIされハイフン結合 | モダンなMarkdownで使用される |

### readFile（2件追加）

| # | テストケース | 入力例 | 期待結果 | 根拠 |
|---|---|---|---|---|
| 1 | ディレクトリを渡す | 既存ディレクトリのパス | `''`（readFileSyncがERRORを投げるがisExistsPathはtrue） | 実挙動の確認・文書化 |
| 2 | BOM付きUTF-8ファイル | BOM(`\uFEFF`)で始まるファイル | BOM含むまま返す | Windows環境での現実的なケース |

### isExcludeFile（3件追加）

| # | テストケース | 入力例 | 期待結果 | 根拠 |
|---|---|---|---|---|
| 1 | regex特殊文字を含むファイル名 | `"test[1].md"`, patterns: `["test\\[1\\]"]` | `true` | ブラケット付きファイル名は現実的 |
| 2 | 大文字小文字の違い | `"README.md"`, patterns: `["^readme"]` | `false` | RegExpデフォルトcase-sensitiveの挙動明示 |
| 3 | 空文字列のfilename | `""`, patterns: `[".*"]` | `true` | `".*"`は空文字にもマッチ |

### buildStyleTags（3件追加）

| # | テストケース | 入力例 | 期待結果 | 根拠 |
|---|---|---|---|---|
| 1 | markdownStylesが非配列（文字列） | `markdownStyles: "style.css"` | linkタグ生成されない | `Array.isArray`チェックでスキップされる挙動確認 |
| 2 | markdownPdfStylesが非配列（文字列） | `markdownPdfStyles: "custom.css"` | 同上 | 対称テスト |
| 3 | resolveHrefFnが例外を投げる | throwする関数を渡す | 例外が伝播する | try-catchなしのため呼び出し元に伝播する挙動の文書化 |

### resolveOutputDir（2件追加）

| # | テストケース | 入力例 | 期待結果 | 根拠 |
|---|---|---|---|---|
| 1 | 末尾スラッシュ付きディレクトリ | `/tmp/output/`（存在するパス） | `path.join`が正しくbasename結合 | コピペ時の末尾スラッシュ |
| 2 | `~`が途中に出現 | `foo/~/bar` | ファイル相対で解決（`~`展開されない） | 先頭のみ対象であることの確認 |

### フェーズ2 合計: 23件

---

## フェーズ3: 統合テスト拡充

### 対象ファイル

- 変更: `test/integration/extension.test.js`
- 新規fixtures: `test/integration/fixtures/`に4つのmdファイル + 1テスト画像
- 新規expected: `test/integration/expected/`に4つのhtmlファイル

### セクション1: frontmatterによるper-file設定オーバーライド（2件）

`gray-matter`を使ったfrontmatterでの`breaks`・`emoji`オーバーライド確認。

| # | fixture | 内容 | 期待結果 |
|---|---|---|---|
| 1 | `frontmatter-breaks.md` | `breaks: true` + 改行を含むテキスト | `<br>`タグが出力される |
| 2 | `frontmatter-no-emoji.md` | `emoji: false` + `:smile:` | emoji画像に変換されずテキストのまま |

テスト方法: 既存HTMLスナップショットパターンと同一（コマンド実行 → HTML生成 → 正規化 → 比較）。

### セクション2: エラーハンドリング（2件）

| # | テストケース | 操作 | 期待結果 |
|---|---|---|---|
| 1 | 非markdownファイル | `.txt`ファイルを開いてhtml変換コマンド実行 | 例外で落ちない。出力ファイル生成されない |
| 2 | 未保存ファイル | 新規untitledドキュメントでコマンド実行 | 例外で落ちない。出力ファイル生成されない |

テスト方法: `describe('Error handling')`ブロックを新設。`assert.doesNotReject`でクラッシュしないことを確認。

### セクション3: breaks設定（1件）

| # | fixture | 内容 | 期待結果 |
|---|---|---|---|
| 1 | `breaks.md` | 通常の改行を含むテキスト（frontmatterなし） | デフォルト設定(`breaks: false`)で`<br>`にならず同一`<p>`内にまとまる |

VS Code設定の動的変更は状態汚染リスクが高いため、デフォルト設定のみをテスト。`breaks: true`はセクション1のfrontmatterテストでカバー。

### セクション4: 画像参照（1件）

| # | fixture | 内容 | 期待結果 |
|---|---|---|---|
| 1 | `image.md` | 相対パス・URL・data URI画像参照 | `<img src="...">`が正しいパスに解決 |

fixture構成:

- `test/integration/fixtures/image.md` — 3種類の画像参照を含む
- `test/integration/fixtures/test.png` — 1x1テスト用PNG（数十バイト）
- `test/integration/expected/image.html` — 期待HTML

正規化: 既存の`NORMALIZED_PATH`置換で`file:///`パスに対応。

### フェーズ3 合計: 6件

---

## 全体まとめ

| フェーズ | 目的 | テスト追加数 | コード変更 |
|---|---|---|---|
| フェーズ2 | ユニットテスト エッジケース補強 | 23件 | テストのみ |
| フェーズ3 | 統合テスト拡充 | 6件 | テスト + fixtures |
| **合計** | | **29件** | |

### 実装順序

1. フェーズ2: `test/unit/utils.test.js`にエッジケース追加 → テスト実行で確認
2. フェーズ3: 統合テストのfixture作成 → テスト追加 → テスト実行で確認

### スコープ外

- `src/compile.js`のテスト（ビルドスクリプト）
- `extension.js`からのロジック抽出・リファクタリング（別フェーズ）
- VS Code設定の動的変更を伴うテスト（状態汚染リスク）
- "エディタ未開"のエラーケース（統合テスト環境で再現困難）
- `convertOnSave`機能のテスト（イベント駆動で統合テストが複雑）
- テストドキュメント(`test/README.md`, `test/README.ja.md`)の更新（別タスク）
