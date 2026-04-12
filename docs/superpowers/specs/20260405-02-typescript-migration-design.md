# TypeScript移行 設計仕様

## 概要

vscode-markdown-pdf のソースコード（約1,265行・3ファイル）およびテストファイル（5ファイル）を JavaScript から TypeScript に一括変換する。

### 目的

- 型安全性を高めてバグを減らす
- コードの可読性・保守性を向上させる
- 将来の機能追加に備えてリファクタリングしやすい基盤を作る

### スコープ

- ソースファイル3つとテストファイル5つをTypeScriptに変換
- ビルド・テスト設定の更新
- 機能変更やリファクタリングは行わない

## ファイル構成

### 変換対象

| 変換前 | 変換後 |
|--------|--------|
| `extension.js` (ルート) | `src/extension.ts` |
| `src/utils.js` | `src/utils.ts` |
| `src/chromium-resolver.js` | `src/chromium-resolver.ts` |
| `test/unit/utils.test.js` | `test/unit/utils.test.ts` |
| `test/unit/chromium-resolver.test.js` | `test/unit/chromium-resolver.test.ts` |
| `test/unit/vscodeignore.test.js` | `test/unit/vscodeignore.test.ts` |
| `test/integration/extension.test.js` | `test/integration/extension.test.ts` |
| `test/sample/generate-sample.js` | `test/sample/generate-sample.ts` |

### 削除対象

- `jsconfig.json` — `tsconfig.json` に置き換え
- `extension.js` — `src/extension.ts` に移動のため

### 新規作成

- `tsconfig.json`
- `src/types/*.d.ts` — 型定義のないパッケージ用

### 変更なし

- `work/` 配下のファイル — 古い作業ファイルのため対象外
- `package.json` の `"main": "./dist/extension"` — バンドル出力先は同じ

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- `target: ES2020` — VS Code engines `^1.98.0` は Node 20+ が前提
- `strict: true` — 最初から厳密モードを適用
- `noEmit: true` — コンパイルは esbuild に任せ、tsc は型チェック専用
- `rootDir: "."` — `src/` と `test/` の両方を含むため

## ビルド設定

### package.json scripts

```json
{
  "build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --format=cjs --platform=node --external:vscode",
  "check": "tsc --noEmit",
  "watch": "npm run build -- --watch",
  "test": "npm run test:unit && npm run test:integration",
  "test:unit": "tsx --test test/unit/**/*.test.ts",
  "pretest:integration": "npm run build",
  "test:integration": "vscode-test --config .vscode-test.mjs",
  "presample": "npm run build",
  "sample": "vscode-test --config .vscode-test.mjs --label sample"
}
```

- esbuild のエントリポイントを `extension.js` → `src/extension.ts` に変更
- `check` スクリプトを追加（型チェック専用）
- ユニットテストの実行を `node --test` → `tsx --test` に変更

### devDependencies の追加

- `typescript`
- `@types/vscode`
- `@types/node`
- `tsx`（テスト実行用）

## 型定義の方針

### import文

`var x = require('...')` → `import ... from '...'` に統一（ESモジュール構文）。esbuild が CommonJS に変換するので実行時の互換性は問題なし。

### 関数の型付け

- すべての関数に引数の型と戻り値の型を明示する
- 例: `setBooleanValue(a, b)` → `setBooleanValue(a: boolean | undefined, b: boolean): boolean`
- vscode API: `extensionContext` は `vscode.ExtensionContext | null` として型付け
- puppeteer 関連は `puppeteer-core` の型をそのまま利用

### 型定義のないパッケージ

`src/types/` ディレクトリに `.d.ts` ファイルを作成する。

対象候補:
- `emoji-images`
- `markdown-it-named-headers`
- `markdown-it-include`
- `markdown-it-plantuml`
- `markdown-it-container`
- `markdown-it-checkbox`

実際に使っている関数のシグネチャを定義する（`declare module 'xxx'` だけでなく具体的な型を付ける）。

### 既に型定義があるパッケージ

- `cheerio` — 型同梱済み
- `puppeteer-core` — 型同梱済み
- `@puppeteer/browsers` — 型同梱済み
- `gray-matter` — 型同梱済み
- `highlight.js` — 型同梱済み
- `markdown-it` — `@types/markdown-it` を追加
- `mustache` — `@types/mustache` を追加
- `markdown-it-emoji` — 型同梱済み

## テストの移行

### テストランナー

- 引き続き Node.js 組み込みの `node:test` を使用
- `tsx` 経由で `.ts` テストファイルを直接実行

### ユニットテスト

- `test/unit/utils.test.ts` — `utils.ts` のヘルパー関数テスト
- `test/unit/chromium-resolver.test.ts` — Chromium解決ロジックのテスト
- `test/unit/vscodeignore.test.ts` — `.vscodeignore` の検証テスト

### インテグレーションテスト・サンプル生成

- `test/integration/extension.test.ts` — VS Code テストランナー経由
- `test/sample/generate-sample.ts` — 同上
- `.vscode-test.mjs` のテストファイルパターンを `.ts` に更新する必要がある場合は対応

## 移行手順

1. **環境構築** — devDependencies インストール、`tsconfig.json` 作成
2. **型宣言ファイル作成** — `src/types/` に `.d.ts` を作成
3. **ソースファイル移行** — 依存の少ないものから順に:
   - `src/utils.ts`（他に依存しない純粋なユーティリティ）
   - `src/chromium-resolver.ts`（外部依存のみ）
   - `src/extension.ts`（上記2つに依存）
4. **テストファイル移行** — ユニットテスト → インテグレーションテスト → サンプル生成
5. **ビルド設定更新** — `package.json` scripts、esbuild エントリポイント変更
6. **クリーンアップ** — `jsconfig.json` 削除、旧JSファイル削除
7. **動作確認** — `npm run check`、`npm run build`、`npm test`
