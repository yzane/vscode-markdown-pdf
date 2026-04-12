# compile.js の完全削除

## 概要

`src/compile.js` は `vscode:prepublish` スクリプトとして、パッケージサイズ削減のために以下の処理を行っていた：

1. `node_modules/emoji-images/json` ディレクトリの削除
2. `node_modules/puppeteer-core/.local-chromium` ディレクトリの削除
3. `removeNPMAbsolutePaths` による `node_modules` 内の絶対パス情報の除去

これらの処理はすべて不要となったため、スクリプト自体を削除する。

## 削除理由

| 処理 | 不要な理由 |
|------|-----------|
| `deleteFile(emoji-images/json)` | 現行バージョンの `emoji-images` にはこのディレクトリが存在しない |
| `deleteFile(puppeteer-core/.local-chromium)` | `puppeteer-core` v24 ではこのディレクトリ構造が使われていない |
| `removeNPMAbsolutePaths` | npm v7 以降、`_where` / `_args` フィールドが生成されなくなった |

## 変更内容

### 1. `src/compile.js` を削除

ファイル自体を削除する。

### 2. `package.json` の変更

- `scripts` から `"vscode:prepublish": "node ./src/compile"` を削除
- `devDependencies` から `"removeNPMAbsolutePaths": "^3.0.1"` を削除

### 3. `package-lock.json` の更新

`npm install` を実行して `removeNPMAbsolutePaths` の除去をロックファイルに反映する。

## 影響範囲

- `vsce package` 実行時に prepublish スクリプトが実行されなくなるだけ
- パッケージの内容・拡張機能の動作に影響なし
