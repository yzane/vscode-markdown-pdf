# markdown-it-include 自前実装 設計書

## 概要

外部パッケージ `markdown-it-include` を削除し、同等機能を自前の markdown-it プラグインとして実装する。

### 背景・動機

- `markdown-it-include` (v2.0.0) は2020年9月を最後に更新されておらず、メンテナンスされていない
- コードブロックやインラインコード内の include 構文も処理してしまうバグがある
  - README.md 変換時に `` `:[alternate-text](relative-path-to-file.md)` `` がインラインコード内にあるにもかかわらず処理され、`INCLUDE ERROR` が出力HTMLに埋め込まれる
- 代替パッケージはいずれも採用実績が低く（週5DL以下）、同じアーキテクチャ上の問題を抱えている
- プラグイン本体は約100行と小規模であり、自前実装のコストは低い

### ゴール

1. `markdown-it-include` の外部依存を除去する
2. コードブロック・インラインコード内の include 構文をスキップする
3. 既存の機能・挙動・設定との互換性を維持する

## 設計

### ファイル構成

| ファイル | 操作 | 説明 |
|---|---|---|
| `src/markdown-it-include.ts` | 新規 | 自前プラグイン本体 |
| `src/extension.ts` | 変更 | import先を自前プラグインに変更 |
| `src/types/markdown-it-include.d.ts` | 削除 | 外部パッケージの型定義、不要に |
| `package.json` | 変更 | `markdown-it-include` 依存を削除 |
| `test/integration/fixtures/include-codeblock.md` | 新規 | コードブロック内スキップのテスト用fixture |
| `test/integration/expected/include-codeblock.html` | 新規 | 期待出力HTML |

### プラグインAPI

```typescript
import type MarkdownIt from 'markdown-it';

interface MarkdownItIncludeOptions {
  root: string;            // include対象ファイルの基準ディレクトリ
  throwError?: boolean;    // エラー時に例外をスローするか（デフォルト: true）
}

function markdownItInclude(md: MarkdownIt, options: string | MarkdownItIncludeOptions): void;
```

- `options` が文字列の場合は `root` として扱う（現行互換）
- `includeRe` や `bracesAreOptional` は内部で固定するため外部公開しない
  - 構文は `:[alt-text](relative-path.md)` で固定

### 構文

```
:[表示テキスト](相対パス.md)
```

- 正規表現: `/:\[.+?\]\(\s*(.+?\..+?)\s*\)/`
- パス前後の空白はトリムする（現行互換: `:[alt]( path.md )` も動作）

### コードブロック・インラインコードのスキップ

`md.core.ruler.before('normalize', 'include', ...)` のタイミングで `state.src` を処理する。このタイミングでは markdown パースが行われていないため、自前でコード領域を特定する必要がある。

#### アルゴリズム

1. ソース文字列を先頭から走査する
2. 以下の「保護領域」を検出した場合、その領域をスキップする：
   - **Fenced code block**: 行頭の `` ``` `` または `~~~`（3つ以上）で開始し、同じまたはそれ以上の数の同一文字で閉じる
   - **Inline code**: バッククォート（1つ以上の連続）で囲まれた領域
3. 保護領域外のテキストに対してのみ include 正規表現を適用する
4. マッチしたパスに対してファイル読み込み・再帰処理を行う

#### 実装方針

ソースを「保護領域」と「通常テキスト」のチャンクに分割し、通常テキスト部分のみに include 置換を適用して再結合する。

```
入力: "text :[a](b.md) `:[c](d.md)` text"
分割: ["text :[a](b.md) ", "`:[c](d.md)`", " text"]
         ↑ 置換対象         ↑ スキップ       ↑ 置換対象
```

### 再帰 include

include されたファイルの内容に対しても同じ処理を再帰的に適用する。ただし、再帰処理時にもコードブロックスキップを適用する。

### 循環参照検出

処理済みファイルパスのリストを保持し、同じファイルが再度 include される場合はエラーメッセージを埋め込む。

### エラー処理

現行の挙動を維持する：

| エラー種別 | throwError=true | throwError=false |
|---|---|---|
| ファイル未検出 | 例外をスロー | `\n\n# INCLUDE ERROR: File '{{FILE}}' not found.\n\n` を埋め込み |
| 循環参照 | 例外をスロー | `\n\n# INCLUDE ERROR: Circular reference between '{{FILE}}' and '{{PARENT}}'.\n\n` を埋め込み |

extension.ts 側の既存の警告表示ロジック（`includeErrorRe` による検出と `showWarningMessage`）はそのまま動作する。

### extension.ts の変更

```typescript
// Before
import markdownItInclude from 'markdown-it-include';
// ...
md.use(markdownItInclude, {
  root: path.dirname(filename),
  includeRe: /:\[.+\](\(.+\..+\))/i,
  bracesAreOptional: true,
  throwError: false
});

// After
import { markdownItInclude } from './markdown-it-include';
// ...
md.use(markdownItInclude, {
  root: path.dirname(filename),
  throwError: false
});
```

### 設定の互換性

`markdown-pdf.markdown-it-include.enable` 設定はそのまま維持。package.json の contributes.configuration は変更しない。

### テスト

#### 既存テスト

- `include.md` / `include.html`: 基本的な include 動作 — 期待出力HTMLは変更不要（互換動作）
- `include-missing.md`: ファイル未検出時の挙動 — 互換動作

#### 新規テスト

- `include-codeblock.md`: コードブロック・インラインコード内の include 構文がスキップされることを検証

## スコープ外

- include 構文の変更（`:[alt](path)` 以外の構文サポート）
- 行番号指定による部分 include
- HTML `<pre>` / `<code>` タグ内のスキップ（markdown-it の normalize 前なので raw HTML がそのまま含まれる可能性は低く、fenced code block と inline code で十分）
