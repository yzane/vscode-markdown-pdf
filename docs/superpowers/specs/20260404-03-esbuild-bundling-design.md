# esbuild バンドル化設計

## 概要

`vsce package` で生成される `.vsix` ファイルのサイズを削減するため、esbuild を導入して JavaScript 依存をバンドルする。

**現状:** 21.85 MB / 8224 ファイル
**目標:** 5-8 MB 程度

## アプローチ

esbuild で純粋な JS 依存を `dist/extension.js` に1ファイルにバンドルし、バンドルできない依存（puppeteer-core 系）は external 指定で node_modules に残す。`.vscodeignore` を強化して不要ファイルを除外する。

## 1. ビルド構成

### esbuild 設定

- エントリポイント: `extension.js`
- 出力: `dist/extension.js`
- フォーマット: `cjs`（VS Code 拡張は CommonJS）
- プラットフォーム: `node`
- バンドル: 有効
- minify: なし（デバッグしやすさ優先）
- external: `vscode`, `puppeteer-core`, `@puppeteer/browsers`

### npm scripts

```json
{
  "build": "esbuild extension.js --bundle --outfile=dist/extension.js --format=cjs --platform=node --external:vscode --external:puppeteer-core --external:@puppeteer/browsers",
  "watch": "npm run build -- --watch",
  "package": "npm run build && vsce package"
}
```

### package.json の変更

- `"main"`: `"./extension"` → `"./dist/extension"`
- `esbuild` を devDependencies に追加

## 2. `__dirname` 参照の解決

バンドル後は `__dirname` が `dist/` を指すため、静的アセットへのパスがずれる。`extension.js` 冒頭でプロジェクトルートを示す変数を導入する。

```js
var EXTENSION_ROOT = path.join(__dirname, '..');
```

### 変更箇所（extension.js の4箇所）

| 現在のコード | 変更後 |
|---|---|
| `path.join(__dirname, 'data', 'emoji.json')` | `path.join(EXTENSION_ROOT, 'data', 'emoji.json')` |
| `path.join(__dirname, 'node_modules', 'emoji-images', 'pngs', ...)` | `path.join(EXTENSION_ROOT, 'node_modules', 'emoji-images', 'pngs', ...)` |
| `path.join(__dirname, 'template', 'template.html')` | `path.join(EXTENSION_ROOT, 'template', 'template.html')` |
| `readStyles()` の `baseDir: __dirname` | `baseDir: EXTENSION_ROOT` |

`src/utils.js` は `baseDir` パラメータを受け取る設計のため変更不要。

## 3. `.vscodeignore` の強化

`node_modules/**` を全除外し、必要なものだけ `!` で復活させる。

### 除外対象

| カテゴリ | パターン | 理由 |
|---|---|---|
| ソースファイル | `extension.js`, `src/**` | バンドル済み |
| 開発・CI | `.vscode/**`, `.github/**`, `.vscode-test/**` | 開発用 |
| ドキュメント | `docs/**`, `work/**`, `sample/**` | 実行に不要 |
| ツール設定 | `.eslintrc.json`, `.cocoindex_code/**`, `.claude/**` | 開発用 |
| テスト | `test/**` | 実行に不要 |
| パッケージ関連 | `*.vsix`, `*.bat` | 成果物・スクリプト |
| node_modules | `node_modules/**`（全除外） | バンドル済み依存 |

### 復活対象（`!` パターン）

| パス | 理由 |
|---|---|
| `node_modules/puppeteer-core/**` | external 指定 |
| `node_modules/@puppeteer/browsers/**` | external 指定 |
| `node_modules/emoji-images/pngs/**` | 実行時に PNG を base64 で読み込む |
| `node_modules/highlight.js/styles/**` | 実行時に CSS を読み込む |
| puppeteer-core の推移的依存 | `npm ls puppeteer-core @puppeteer/browsers --all --prod --parseable` で確認して列挙 |

### `.vscodeignore` の `!` パターンに関する注意

`node_modules/**` で全除外した後に `!` で復活させる場合、ディレクトリ自体とその内容の両方を復活させる必要がある。また、スコープ付きパッケージ（`@puppeteer/browsers`）はスコープディレクトリも復活させる必要がある。

```
node_modules/**
!node_modules/puppeteer-core/
!node_modules/puppeteer-core/**
!node_modules/@puppeteer/
!node_modules/@puppeteer/browsers/
!node_modules/@puppeteer/browsers/**
```

推移的依存は実装時に `npm ls` で確認し、同様のパターンで列挙する。

### 維持対象（除外しない）

| パス | 理由 |
|---|---|
| `dist/**` | バンドル出力 |
| `styles/**` | 実行時 CSS |
| `template/**` | HTML テンプレート |
| `data/**` | emoji.json |
| `images/**` | 拡張機能アイコン |

## 4. `.gitignore` への追加

`dist/` をビルド成果物として `.gitignore` に追加する。

## 5. 開発フローへの影響

### 開発時

- `npm run watch` でファイル変更時に自動ビルド

### パッケージ化

- `npm run package` で build → vsce package を実行

### テスト

- ユニットテスト: `src/utils.js` を直接 require しているため影響なし
- インテグレーションテスト: VS Code が `dist/extension.js` をロードするため、ビルド後に実行する必要がある。package.json の `main` が `dist/extension` を指すため既存設定で動作する

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `package.json` | `main` 変更、`esbuild` 追加、スクリプト追加 |
| `extension.js` | `EXTENSION_ROOT` 導入、4箇所のパス参照変更 |
| `.vscodeignore` | 大幅強化 |
| `.gitignore` | `dist/` 追加 |

### 新規ファイル

- `dist/extension.js` — ビルド成果物（gitignore 対象）

### 変更しないファイル

- `src/utils.js`, `src/chromium-resolver.js`
- `styles/`, `template/`, `data/`
- テストファイル
