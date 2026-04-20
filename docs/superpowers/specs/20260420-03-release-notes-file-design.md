# Release Notes ファイル分離 設計

> **方針変更 (2026-04-20):** 本設計で提案した `RELEASE_NOTES.md` / `RELEASE_NOTES.ja.md` の新設は取りやめた。
>
> 業界標準である「CHANGELOG.md 単一ファイル」を尊重し、VS Code Marketplace が CHANGELOG.md をネイティブ表示することを活かす方針に転換した。結果として、以下のみ採用：
>
> - README 下部セクション名を `Release Notes` → `Change Log` にリネーム（本文は CHANGELOG.md へのリンクのみ）
> - README 上部 `What's New` を短いバレットリストに簡素化し、詳細は既存の機能・オプション・FAQ セクションに委譲
> - PlantUML フェンスドコードブロック記述の不正確な箇所（「VS Code プレビュー・GitHub・GitLab と同じ書式」）を修正
> - 2.0.0 で改善された Include 機能の読み込み失敗時挙動を `### Include` 機能説明に追記
>
> 以下の設計内容は経緯の記録として保存する。

## 背景と目的

現在、リリースに関連する情報は以下の 3 箇所に分散している。

- `README.md` 上部の `## What's New` セクション — ユーザー視点の新機能・改善
- `README.md` 上部の `## Breaking Changes` セクション — 対応が必要な変更点
- `README.md` 下部の `## [Release Notes](CHANGELOG.md)` セクション — CHANGELOG.md の抜粋とリンク
- `CHANGELOG.md` — 全変更の網羅的なログ

下部の「Release Notes」セクションは元々、VS Code Marketplace 公開時に「前回公開したバージョンからの変更点」をユーザーに見せるための抜粋だった。しかし現在は上部の `What's New` / `Breaking Changes` が同じ役割を果たしており、同じバージョン範囲の情報が形式違いで二重に並んだ状態になっている。

この設計では、ユーザー視点の変更説明を独立ファイルに切り出し、README / RELEASE_NOTES / CHANGELOG の 3 層に役割を明確化する。

## 目的

- README の長期的な肥大化を抑える。
- ユーザーに「このバージョンで何ができるか／何に対応が必要か」を読みやすい形で提供する。
- 開発視点の詳細な変更履歴は CHANGELOG.md に残し、ユーザー向け説明とは用途を分ける。
- 日本語・英語の両ユーザーに対して同じ情報が提供される状態を維持する。

## 3 層の責務

| ファイル | 読者 | 内容 | 書き方 |
|---|---|---|---|
| `README.md` / `README.ja.md` | Marketplace / GitHub 訪問者 | 最新バージョンの要点を上部で即座に見せる | 簡潔な箇条書き + 詳細リンク |
| `RELEASE_NOTES.md` / `RELEASE_NOTES.ja.md` | 拡張機能ユーザー | ユーザー視点の変更説明。「こう使えます」「こう対応が必要です」を記述 | バージョン見出し + 項目ごとに太字ラベル + プロース（ハイブリッド形式） |
| `CHANGELOG.md` | 開発者・詳細を追いたい人 | 全変更の網羅的ログ | 現状維持（Breaking / Changes / Fixes の箇条書き） |

**導線**: README → RELEASE_NOTES → CHANGELOG の一方向。深掘りしたい読者だけが次の層に進む。

## `RELEASE_NOTES.md` の構造

### ファイル骨格

```markdown
# Release Notes

User-facing summary of changes. For the detailed development log, see [CHANGELOG.md](CHANGELOG.md).

## X.Y.Z (YYYY/MM/DD)

**新機能: PlantUML fenced code block サポート**

` ```plantuml ` 形式のコードブロックがそのまま PlantUML として描画されるようになりました。従来の `@startuml` ... `@enduml` 形式も互換性のため引き続き動作します。

    ```plantuml
    Alice -> Bob: hello
    ```

**Breaking change: Markdown 内の HTML サニタイズが既定で有効化**

XSS リスク低減のため、Markdown 本文中の `<script>` / `<iframe>` / `<style>` 等、`on*` 属性、`javascript:` で始まる `href` / `src` が既定で除去されます（[GFM Disallowed Raw HTML extension](https://github.github.com/gfm/#disallowed-raw-html-extension-) 準拠）。

対応が必要なケース:

- 従来の挙動を維持したい: `markdown-pdf.sanitize` を `"none"` に設定
- インライン `<style>` だけ残したい: `"gfm-allow-style"` に設定
- レイアウト用 CSS は `markdown-pdf.styles` での外部ファイル指定に移行も可能

（以降、同形式で 2.0.1 / 2.0.0 が続く）
```

### 構造ルール

- バージョン見出しは `## X.Y.Z (YYYY/MM/DD)` 形式、**降順**（最新が上）で並べる。
- 各項目は `**カテゴリ: タイトル**` 形式の太字ラベルで始める。
- カテゴリ語彙（ユーザーに影響する範囲で記述する）:
  - `新機能` — 新しい機能・API・設定の追加
  - `改善` — 既存機能の挙動改善・利便性向上
  - `Breaking change` — 既存利用への影響があり、対応が必要な変更
  - `修正` — ユーザーに影響するバグ修正
- ラベル直下にプロースで説明。必要に応じてコード例・設定キー・関連 issue へのリンクを挿入。
- 日付形式は CHANGELOG.md と揃えて `YYYY/MM/DD`。

### 日本語版

- `RELEASE_NOTES.ja.md` を並行整備する。
- 同じバージョン範囲・同じ構造ルールをカバーする。
- 運用上の扱いは `README.md` / `README.ja.md` と同じ方針（対訳のメンテナンスを同一 PR 内で行う）。

### アンカー方針

- バージョン見出しのアンカーは明示的な `<a id="...">` を置かず、GitHub（および VS Code プレビュー）の自動スラグ生成に従う。CHANGELOG.md も同じ方式で、既存運用と整合する。
- 見出し `## X.Y.Z (YYYY/MM/DD)` / `## 2.0.1 (2026/04/14)` / `## 2.0.0 (2026/04/13)` から生成されるスラグはそれぞれ `xyz-yyyymmdd` / `201-20260414` / `200-20260413`。
- README 側からは `RELEASE_NOTES.md#<slug>` 形式で参照する（日本語版は `RELEASE_NOTES.ja.md#<slug>`）。
- 本リリースで X.Y.Z を具体的なバージョン・日付に書き換える際は、RELEASE_NOTES と README 両方のスラグ参照も同時に書き換える（対訳と同じく同一 PR 内で）。

### 用語についての注意

- 日本語版では「生 HTML」という表現は使わず、「Markdown 内の HTML」など、文脈を明示する表現を使う。

## 初期コンテンツ

Q4 で合意した範囲（2.0.0 以降）を初期コンテンツとする。現 `README.md` 上部の `What's New` / `Breaking Changes` に既にユーザー視点の文章が書かれているため、これを種にハイブリッド形式に再構成する。追加執筆はほぼ不要。

### X.Y.Z（次回リリース予定分）

- 新機能: PlantUML fenced code block サポート
- 新機能/改善: `@startuml` / `@enduml` 形式のブロック記法および関連設定の deprecate（互換性のため引き続き動作する旨を明記）
- 改善: Chromium 自動ダウンロードが Chrome for Testing API から最新 Stable を取得するように変更。`markdown-pdf.chromium.autoDownload` 設定の追加
- Breaking change: Markdown 内の HTML サニタイズが既定で有効化。`markdown-pdf.sanitize` 設定の追加

### 2.0.1 (2026/04/14)

- 修正: 自己閉じタグ形式の `<div class="page" />` が改ページとして正しく認識されない問題を修正

### 2.0.0 (2026/04/13)

- 改善: Include (`:[label](path.md)`) がエラー時にインラインで報告されるようになった（従来はエクスポート全体が失敗）
- 改善: 画像 `src` の書き換えが引用属性・柔軟な空白・raw-text コンテキストで正しく動作するよう改善
- 改善: BOM 付き front matter に対応
- Breaking change: 見出し ID 生成が GitHub 互換の VS Code slug 方式になった（既存アンカーが変わる可能性）
- Breaking change: highlight.js の v9 → v11 アップグレードに伴うスタイル名の変更
- Breaking change: front matter の解析が厳格化された（YAML sequence / non-plain object を拒否）
- Breaking change: Chromium のダウンロード / キャッシュ管理ロジックが刷新された

## README.md / README.ja.md の変更

### Table of Contents

- TOC 内の `- [Release Notes](#release-notes)` を `- [Change Log](#change-log)` に置き換える。

### 上部 `What's New` セクション

- セクション自体は現状維持（Q8-α: 抜粋モデル）。
- セクション冒頭の説明文に「過去の詳細は [RELEASE_NOTES.md](RELEASE_NOTES.md) を参照」の一文を追加する。
- 各項目の末尾に `Details: [RELEASE_NOTES.md#<anchor>](RELEASE_NOTES.md#...)` を追加。既存の機能詳細／FAQ へのリンクはそのまま残す。
- 記載バージョン数は Q6-D に従い、期間ベースで判断する。ルール化はしないが、方針としてコメントまたは隣接するメモに以下を明記する。
  - 短期間に複数リリースが並ぶ期間 → 複数バージョンを掲載
  - リリース間隔が長い期間 → 最新バージョンのみを掲載

### 上部 `Breaking Changes` セクション

- セクション自体は現状維持。
- 冒頭に「過去の詳細は [RELEASE_NOTES.md](RELEASE_NOTES.md) を参照」の一文を追加。
- 各項目の `Details:` リンク先に `RELEASE_NOTES.md` の該当アンカーを加える（既存の FAQ リンクはそのまま残す）。

### 下部 `## [Release Notes](CHANGELOG.md)` セクション

- 見出しを `## [Change Log](CHANGELOG.md)` にリネーム。アンカーは `#change-log` になる。
- 現在記載されている最新 2 バージョン分の箇条書き抜粋は削除する。
- 本文は 1〜2 行の案内にする。例:

  > For the detailed change history, see [CHANGELOG.md](CHANGELOG.md). For a user-facing summary of changes, see [RELEASE_NOTES.md](RELEASE_NOTES.md).

### `README.ja.md`

- 上記と対称の変更を行う。
- リンク先は `RELEASE_NOTES.ja.md` と `CHANGELOG.md`（CHANGELOG は単一ファイル）に向ける。
- 見出しも日本語版の従来の訳語ポリシーに合わせる（例: `Change Log` / `変更履歴`）。既存訳のトーンを踏襲し、新たな用語を導入しないこと。

### PlantUML に関する既存記述の修正

現在 README 内に「the same form used by VS Code preview, GitHub, and GitLab」という記述が 2 箇所あるが、これは事実として不正確である。

- GitLab: 管理者が PlantUML サーバー連携を有効化した場合、` ```plantuml ` をネイティブに描画する。
- VS Code ビルトイン Markdown preview: ` ```plantuml ` を PlantUML としてはレンダリングしない（拡張機能に依存）。
- GitHub: `mermaid` はネイティブ描画するが、`plantuml` はしない。単なるコードブロックとして表示される。

本 spec の実装範囲で以下を修正する（`README.ja.md` の対応箇所も同様）。

- `README.md` 行 40 付近（`What's New` の PlantUML 項目）: 第三者ツールとの並列比較を削除し、「PlantUML の一般的な fence 記法」「従来形式も互換動作」といった事実ベースの表現に改める。
- `README.md` 行 151 付近（`### PlantUML` セクション内）: 同様に、ビルトインで描画するかのように読める表現を修正する。GitLab のみを正確に言及するか、第三者ツール名自体を書かない形にする。

## Marketplace 公開時のワークフロー

1. `RELEASE_NOTES.md` と `RELEASE_NOTES.ja.md` に新バージョンのユーザー視点エントリを追記する。
2. `CHANGELOG.md` に詳細エントリを追記する（従来どおり）。
3. `README.md` / `README.ja.md` 上部の `What's New` / `Breaking Changes` を更新する。Q6-D の期間ベース判断で、古いバージョンを残すか外すか決める。
4. `develop` で検証 → `release/x.y.z` → `develop` にマージ → `master` にマージして Marketplace に公開。

この手順は既存の公開フローに対し手順 1 が追加されるのみで、手順 2〜4 は従来どおり。

## スコープ外（YAGNI）

以下は本設計の対象外とする。

- `RELEASE_NOTES.md` の自動生成ツールや CI。手運用で開始する。
- 1.x 以前の過去バージョンの `RELEASE_NOTES.md` へのバックフィル。開始点は 2.0.0 とする。
- Marketplace の Changelog タブへの影響評価や変更。引き続き `CHANGELOG.md` がそのまま表示される。
- `CHANGELOG.md` のフォーマット変更。現状のスタイルを維持する。

## 受け入れ基準

- [ ] `RELEASE_NOTES.md` が存在し、2.0.0 / 2.0.1 / X.Y.Z のエントリがハイブリッド形式（太字ラベル + プロース）で記述されている。
- [ ] `RELEASE_NOTES.ja.md` が存在し、英語版と同じバージョン範囲・同じ項目を日本語で提供している。
- [ ] `README.md` の TOC が `Change Log` に更新されている。
- [ ] `README.md` の上部 `What's New` / `Breaking Changes` に、`RELEASE_NOTES.md` への参照リンクが追加されている。
- [ ] `README.md` 下部のセクションが `## [Change Log](CHANGELOG.md)` にリネームされ、本文が抜粋なしのリンクのみに置き換えられている。
- [ ] `README.ja.md` に対して対称の変更がなされ、TOC / 上部セクション / 下部セクション / リンク先（`RELEASE_NOTES.ja.md`）がすべて英語版と一致する構造になっている。
- [ ] `CHANGELOG.md` には変更を加えない。
- [ ] README 内で `#release-notes` を参照している箇所が残っていない（TOC・本文中の相互リンクを含め、すべて `#change-log` または `RELEASE_NOTES.md` への直接リンクに更新されている）。
- [ ] `README.md` の「the same form used by VS Code preview, GitHub, and GitLab」系の不正確な PlantUML 記述が、事実に即した表現に修正されている（行 40 付近の `What's New` 項目、および行 151 付近の `### PlantUML` セクション）。
- [ ] `README.ja.md` 側の対応する PlantUML 記述も、英語版と整合する形に修正されている。

## オープンな疑問

実装段階で確認または判断が必要な項目:

- `RELEASE_NOTES.ja.md` の見出し（例: `# Release Notes` を日本語化するかどうか）。日本語版 README との整合性を見て決定する。
- 既存の `Release Notes` アンカーを参照する外部リンクが存在するかの調査（見つかればリダイレクトまたは両アンカーの維持を検討）。
