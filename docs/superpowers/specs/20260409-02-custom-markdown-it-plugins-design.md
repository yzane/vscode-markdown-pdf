# markdown-it プラグイン自前実装 設計書

## 概要

メンテナンスされていない外部 markdown-it プラグインを自前実装に置き換える。VS Code 本体（`markdown-language-features`）の実装方針に合わせ、VS Code が自前実装しているものは自前実装し、VS Code がパッケージを使っているものは同じパッケージを使う。

### 背景・動機

- `markdown-it-named-headers` (v0.0.4) は2015年11月を最後に更新されていない
- `markdown-it-checkbox` (v1.1.0) は2015年3月を最後に更新されておらず、`underscore` への不要な依存がある
- VS Code 本体は named-headers 相当を GitHub 互換の slugifier で自前実装しており、同じ挙動に合わせたい
- VS Code 本体は checkbox、emoji、container、plantuml を含まない（外部拡張として提供される仕組み）

### VS Code の markdown-it プラグイン構成

VS Code の `markdown-language-features` が使用するパッケージ:
- `markdown-it` — 本体
- `markdown-it-front-matter` — frontmatter 処理

VS Code が自前実装しているもの:
- named-headers（GitHub 互換 slugifier による見出し id 付与）
- ソースマップ、画像レンダリング、リンク処理（markdown-pdf には不要）

### ゴール

1. `markdown-it-named-headers` を VS Code 互換の GitHub slugifier で自前実装に置き換える
2. `markdown-it-checkbox` を自前実装に置き換える
3. `markdown-it-container`、`markdown-it-emoji` は公式チーム管理でメンテナンスされているため、パッケージを継続使用する
4. `markdown-it-plantuml` は deflate 互換性の難易度が高いため、今回スコープ外とする

### スコープ外

- `markdown-it-plantuml` の自前実装（deflate エンコードの PlantUML サーバー互換性検証が必要なため）
- `markdown-it-container` の自前実装（公式チーム管理、2023-12 更新）
- `markdown-it-emoji` の自前実装（公式チーム管理、2023-12 更新）
- `vscode-markdown-languageservice` パッケージの利用（alpha 版であり、LSP 依存が付いてくるため slugify のためだけに使うのはオーバーキル）

## 設計

### 1. markdown-it-named-headers 自前実装

#### ファイル構成

| ファイル | 操作 | 説明 |
|---|---|---|
| `src/markdown-it-named-headers.ts` | 新規 | GitHub 互換 slugifier + heading id 付与プラグイン |
| `src/utils.ts` | 変更 | `Slug` 関数を GitHub 互換ロジックに置き換え |
| `src/extension.ts` | 変更 | import を自前プラグインに切り替え |
| `src/types/markdown-it-named-headers.d.ts` | 削除 | 外部パッケージの型定義 |
| `package.json` | 変更 | `markdown-it-named-headers` 依存削除 |

#### プラグイン API

```typescript
import type MarkdownIt from 'markdown-it';

interface NamedHeadersOptions {
  slugify?: (text: string) => string;
}

export function githubSlugify(text: string): string;
export function markdownItNamedHeaders(md: MarkdownIt, options?: NamedHeadersOptions): void;
```

#### GitHub 互換 slugifier

VS Code の `slugify.ts`（`vscode-markdown-languageservice`）と同じロジックを移植する。元は [github-slugger](https://github.com/Flet/github-slugger) のロジック。

```typescript
// github-slugger ベースの正規表現（VS Code と同一）
const githubSlugReplaceRegex = /[\0-\x1F!-,\.\/:-@\[-\^`\{-\xA9\xAB-\xB4...]/g;

export function githubSlugify(text: string): string {
  return text.trim()
    .toLowerCase()
    .replace(githubSlugReplaceRegex, '')  // 記号類除去
    .replace(/\s/g, '-');                  // 空白をハイフンに
}
```

現行の `utils.Slug` との挙動差:

| 入力 | 現行（encodeURI ベース） | GitHub 互換 |
|---|---|---|
| `日本語の見出し` | `%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E8%A6%8B%E5%87%BA%E3%81%97` | `日本語の見出し` |
| `Hello 🎉 World` | `hello-%F0%9F%8E%89-world` | `hello--world` |
| ` -hello- ` | `hello` | `-hello-` |

#### 重複見出し対応

VS Code と同じく、同一ドキュメント内の重複見出しに連番を付与する:
- 1つ目: `heading`
- 2つ目: `heading-1`
- 3つ目: `heading-2`

現行の `markdown-it-named-headers` にはこの機能がないため、改善となる。

レンダリングごとにカウンターをリセットするため、`md.core.ruler` で状態を管理する。

#### heading_open ルール

`md.renderer.rules.heading_open` をオーバーライドし、見出しトークンの子テキストから slug を生成して `id` 属性を付与する。VS Code の `#addNamedHeaders` と同じアプローチ。

```typescript
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const title = tokenToPlainText(tokens[idx + 1]);
  const slug = slugBuilder.add(title);
  tokens[idx].attrSet('id', slug);
  return self.renderToken(tokens, idx, options);
};
```

#### utils.Slug の置き換え

`utils.Slug` 関数の中身を `githubSlugify` で置き換える。シグネチャ `(string: string) => string` は維持する。extension.ts 側の `slugify: utils.Slug` による呼び出しも引き続き動作する。

### 2. markdown-it-checkbox 自前実装

#### ファイル構成

| ファイル | 操作 | 説明 |
|---|---|---|
| `src/markdown-it-checkbox.ts` | 新規 | checkbox プラグイン |
| `src/types/markdown-it-checkbox.d.ts` | 削除 | 外部パッケージの型定義 |
| `package.json` | 変更 | `markdown-it-checkbox` 依存削除 |

#### プラグイン API

```typescript
import type MarkdownIt from 'markdown-it';

export function markdownItCheckbox(md: MarkdownIt): void;
```

オプション（`divWrap`, `divClass`, `idPrefix`）は markdown-pdf で使用していないため、サポートしない。

#### 処理ロジック

1. `md.core.ruler.push('checkbox', ...)` でルールを登録
2. inline トークンを走査し、テキストトークンに `/\[(X|\s|\_|\-)\]\s(.*)/i` がマッチする場合:
   - `<input type="checkbox" id="checkbox{N}">` トークンを生成
   - `[x]` / `[X]` の場合は `checked="true"` 属性を付与
   - `<label for="checkbox{N}">` + テキスト + `</label>` トークンを生成
3. `underscore` 依存を除去（`_.extend` → 不要）

#### 出力 HTML（現行互換）

```html
<li><input type="checkbox" id="checkbox0"><label for="checkbox0">unchecked</label></li>
<li><input type="checkbox" id="checkbox1" checked="true"><label for="checkbox1">checked</label></li>
```

### 3. extension.ts の変更

```typescript
// Before
import markdownItCheckbox from 'markdown-it-checkbox';
import markdownItNamedHeaders from 'markdown-it-named-headers';

// After
import { markdownItCheckbox } from './markdown-it-checkbox';
import { markdownItNamedHeaders } from './markdown-it-named-headers';
```

呼び出し側は変更なし:
```typescript
md.use(markdownItCheckbox);
md.use(markdownItNamedHeaders, { slugify: utils.Slug });
```

### 4. パッケージ継続使用

以下のパッケージは現状維持:
- `markdown-it-container` (v4.0.0) — markdown-it 公式チーム管理
- `markdown-it-emoji` (v3.0.0) — markdown-it 公式チーム管理
- `markdown-it-plantuml` (v1.4.1) — 今回スコープ外

## テスト

### ユニットテスト

#### `test/unit/utils.test.ts` — Slug テスト更新

GitHub 互換に変わるため、期待値を更新する:

| 入力 | 現行の期待値 | 新しい期待値 |
|---|---|---|
| `Hello World` | `hello-world` | `hello-world`（変更なし） |
| `日本語の見出し` | `encodeURI('日本語の見出し')` | `日本語の見出し` |
| `What's this?!` | `whats-this` | `whats-this`（変更なし） |
| ` -hello- ` | `hello` | `-hello-` |
| `snake_case` | `snake_case` | `snake_case`（変更なし） |
| `hello   world` | `hello-world` | `hello---world` |
| `Hello World! #1` | `hello-world-1` | `hello-world-1`（変更なし） |
| `日本語 English テスト` | encodeURI ベース | `日本語-english-テスト` |
| `Hello 🎉 World` | encodeURI ベース | `hello--world` |

#### `test/unit/markdown-it-named-headers.test.ts` — 新規

- 基本: 見出しに id が付与される
- 重複見出し: `heading`, `heading-1`, `heading-2`
- 日本語見出し
- 空見出し

#### `test/unit/markdown-it-checkbox.test.ts` — 新規

- `[ ] text` → unchecked checkbox
- `[x] text` / `[X] text` → checked checkbox
- `[-] text` / `[_] text` → unchecked checkbox
- 通常テキストに影響しないこと
- 連続する checkbox の id が連番になること

### インテグレーションテスト

- `checkbox.md` / `checkbox.html`: 出力が現行と一致することを確認（HTML 変更なしの見込み）
- 見出し id を含む既存の expected HTML: GitHub 互換の slug に更新が必要
