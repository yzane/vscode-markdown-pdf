# 依存パッケージ独自実装への置き換え設計

## 概要

`cheerio`、`mustache`、`gray-matter` の3つの依存パッケージを独自実装に置き換える。
目的はメンテナンスされていないパッケージへの依存を減らすこと（セキュリティ/安定性）と、依存パッケージ数の削減（シンプルさ）。

## 背景

| パッケージ | 最終リリース | メンテナンス状況 |
|---|---|---|
| cheerio (^1.2.0) | 3ヶ月前 | 活発（だが使用範囲が極小） |
| mustache (^4.2.0) | 5年前 | 事実上停止（2023年以降commitなし） |
| gray-matter (^4.0.3) | 5年前 | やや停滞（2025年に一部活動あり） |

いずれもこのプロジェクトで使用している機能はごく限定的であり、独自実装のコスト・リスクが低い。

## 依存の変化

| 変更 | パッケージ |
|---|---|
| 削除 | cheerio, mustache, gray-matter（+ 間接依存: section-matter, strip-bom-string, kind-of 等） |
| 追加 | js-yaml（gray-matterが内部で使用していたYAMLパーサー） |
| 結果 | 直接依存 -3、間接依存も大幅削減。js-yaml 1つ追加 |

## 設計詳細

### 1. cheerio → 正規表現による `<img src>` 置換

**対象ファイル**: `src/utils.ts`
**対象関数**: `transformHtmlBlockImages()`

**現在の実装**:
```typescript
import { load as cheerioLoad } from 'cheerio';

export function transformHtmlBlockImages(html: string, filename: string): string {
  if (!html) { return ''; }
  const $ = cheerioLoad(html);
  $('img').each(function () {
    const src = $(this).attr('src');
    const href = convertImgPath(src as string, filename);
    $(this).attr('src', href);
  });
  return $.html();
}
```

**置き換え方針**:
- 正規表現で `<img` タグの `src` 属性を検出し、`convertImgPath()` で変換した値に置換する。
- markdown-itが生成するHTMLは予測可能な形式のため、正規表現で十分安全。
- cheerioの import と `package.json` の依存を削除。

**注意点**:
- `src` 属性がシングルクォートまたはダブルクォートで囲まれている両方のケースに対応する。
- 自己閉じタグ (`<img ... />`) と閉じなしタグ (`<img ...>`) の両方に対応する。
- cheerioLoad は HTML全体をパースして `<html><head><body>` ラッパーを付与する副作用があったが、正規表現置換ではその副作用がなくなる。既存テストで差異を確認する。

### 2. mustache → `String.replace()` による `{{{key}}}` 置換

**対象ファイル**: `src/extension.ts`
**対象関数**: `makeHtml()`

**現在の実装**:
```typescript
import mustache from 'mustache';
// ...
return mustache.render(template as string, view);
```

**テンプレート** (`template/template.html`):
```html
{{{title}}}, {{{style}}}, {{{mermaid}}}, {{{content}}}
```
すべて `{{{ }}}` (非エスケープ、triple mustache) の変数置換のみ。条件分岐・ループ・パーシャル等の高度な機能は一切使用していない。

**置き換え方針**:
- ユーティリティ関数を `src/utils.ts` に追加。テンプレート文字列中の `{{{key}}}` を view オブジェクトの対応する値で置換する。
- `String.replace()` と正規表現 `/\{\{\{(\w+)\}\}\}/g` で実装。
- mustache の import と `package.json` の依存を削除。

### 3. gray-matter → 正規表現による `---` 分離 + js-yaml

**対象ファイル**: `src/extension.ts`
**対象関数**: `convertMarkdownToHtml()`

**現在の実装**:
```typescript
import grayMatter from 'gray-matter';
// ...
const matterParts = grayMatter(text);
// matterParts.data → { breaks: true, emoji: false, ... }
// matterParts.content → Markdown本文
```

**使用しているプロパティ**:
- `matterParts.data.breaks` — markdown-itの改行動作設定
- `matterParts.data.emoji` — emojiプラグインの有効/無効
- `matterParts.data.plantumlOpenMarker` — PlantUMLデリミタ設定
- `matterParts.data.plantumlCloseMarker` — PlantUMLデリミタ設定
- `matterParts.content` — front matterを除いたMarkdown本文

**置き換え方針**:
- `src/utils.ts` にfront matterパース関数を追加。
- 正規表現で先頭の `---` ... `---` ブロックを検出・分離する。
- YAML部分を `js-yaml` の `load()` でパースしオブジェクト化する。
- front matterが存在しない場合は `{ data: {}, content: text }` を返す。
- `js-yaml` を `package.json` の直接依存に追加。gray-matter の依存を削除。

**VS Codeとの関係**:
VS Codeは `markdown-it-front-matter` プラグインでレンダリング中にfront matterを処理するが、このプロジェクトではfront matterの値でmarkdown-itの設定を事前に構成する必要があるため、レンダリング前の独立したパース処理が必須。

## テスト方針

各置換関数について:
- 既存テストがある場合はそのまま維持し、出力の差異がないことを確認する。
- 新規ユーティリティ関数（テンプレート置換、front matterパース）にはユニットテストを追加する。
- cheerioからの移行ではHTML出力のラッパー有無の差異に注意してテストを調整する。
