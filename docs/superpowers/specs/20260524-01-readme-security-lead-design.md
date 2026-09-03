# README 仕様変更セクションへの「セキュリティ強化」リード追加 設計

## 背景

`README.ja.md` / `README.md` の「仕様変更（Breaking Changes）」セクションには、X.Y.Z で追加された Raw HTML サニタイズに関する項目がある。現状は次のように、行頭がいきなり長い説明文で始まる。

```
- XSS のリスクに対応するため（[#411](...)）、Markdown 内の Raw HTML が既定で [GFM Disallowed Raw HTML 拡張](...) に準拠してサニタイズされるようになりました。`<script>` / `<iframe>` / `<style>` 等のタグおよび `on*` / `javascript:` 属性が Markdown 本文から除去されます。挙動は新しい [markdown-pdf.sanitize](#markdown-pdfsanitize) 設定で制御できます。
```

同セクション内の他の項目は「何が変わったか」を短く先頭に置く構成だが、この項目だけ「なぜ」から始まっており、一覧で眺めたときに「何の対応か」が一目で分かりにくい。

## 目的

仕様変更セクションを一覧として読んだときに、当該項目が「セキュリティ強化」であることが一目で分かるようにする。既存の説明文は情報量と表現を保つため、丸ごと残す。

## 変更内容

### README.ja.md (L48)

行頭に短いリード「セキュリティ強化:」を追加する。既存文章は一切変更しない。

変更前:

```
- XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の Raw HTML が既定で ...
```

変更後:

```
- セキュリティ強化: XSS のリスクに対応するため（[#411](https://github.com/yzane/vscode-markdown-pdf/issues/411)）、Markdown 内の Raw HTML が既定で ...
```

### README.md (L50)

英語版にも同様のリードを追加する。

変更前:

```
- To mitigate XSS-like risk ([#411](...)), raw HTML in Markdown is now sanitized by default ...
```

変更後:

```
- Security hardening: To mitigate XSS-like risk ([#411](...)), raw HTML in Markdown is now sanitized by default ...
```

## 設計判断

- **太字や記号を使わない**: 同セクション内の他の項目（L51 以降）は装飾を持たない平文。装飾なしで `「<カテゴリ>: <内容>」` のコロン区切りとし、書式の統一感を優先する。
- **「脆弱性」という語は使わない**: 英語版が `XSS-like risk` と表現していること、CVE 発行などの正式な脆弱性ハンドリングを経ていないことから、`セキュリティ強化` / `Security hardening` という防御的ハードニングを示す表現にとどめる。
- **既存文をそのまま残す**: ユーザー要望「元の文章はそのままで良い」に従う。FAQ への詳細リンク（L49）にも手を入れない。
- **対象は仕様変更セクションのみ**: README 下部の FAQ 本文（L865 付近）には今回変更を加えない。FAQ は背景説明として「XSS のリスクがありました」と書き出すのが自然なため、リード追加は不要。

## 影響範囲

- `README.ja.md` 1 行
- `README.md` 1 行
- VS Code Marketplace 上での表示（README.md がレンダリングされる）

## 非影響範囲（明示）

- `CHANGELOG.md` には変更を加えない（既存エントリの文面はそのまま）。
- `README.ja.md` / `README.md` の FAQ セクションには変更を加えない。
- リリースノートの構造には変更を加えない。
