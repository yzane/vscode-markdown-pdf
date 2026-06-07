# クロスプラットフォーム対応ユニットテスト 設計書

## 背景・課題

開発環境を WSL(Ubuntu) から Windows 11 へ移行したところ、`npm run test` が失敗するようになった。`test` スクリプトは `test:unit && test:integration` の構成で、`test:unit`（`tsx --test`）の段階で **18 件が失敗**し、`&&` のため `test:integration` には到達しない。

### 根本原因

失敗はすべて同一原因で、**テストの期待値が POSIX パス前提でハードコードされている**ことによる。実装側（`src/utils.ts` の `convertImgPath` 等、`src/readme-previews.ts` の `resolveReadmePreviewExportPath`）は `path.resolve` / `path.join` を使用しており、各 OS で正しく動作する。

- Linux: `path.resolve('/doc', 'real.png')` → `/doc/real.png` → `file:///doc/real.png`
- Windows: `path.resolve('/doc', 'real.png')` → カレントドライブが補われ `C:\doc\real.png` → `file:///C:/doc/real.png`

つまり**実装はバグではなく**、テストが `/home/user/...`・`/doc/...`・`/tmp/...`・`/workspace` などの POSIX 絶対パスと、それに対応する POSIX 形式の出力文字列を固定値として期待しているため、Windows ではドライブレター `C:` 混入やセパレータ差異で不一致になる。

実差分の例:

```
+ actual:   '<img alt="look src=bad.png" src="file:///C:/doc/real.png">'
- expected: '<img alt="look src=bad.png" src="file:///doc/real.png">'
```

### 重要な制約: ドライブ非決定性

Windows では `path.resolve('/doc', ...)` の結果ドライブは **テスト実行時のカレントドライブ依存**（`C:` とは限らず `D:` 等になりうる）。したがって期待値に `C:` を決め打ちする方式は脆弱であり、採用しない。

## ゴール（成功条件）

テストをクロスプラットフォーム対応へ書き換え、実装（`src/`）は変更しない。成功条件は段階的に定義する。

- **主要成功条件（必達）**: 両 OS（Windows / WSL・Linux）で `npm run test:unit` が同一に全パスする。今回の直接原因はすべてユニットテストにあり、これが本対応の確定スコープ。
- **副次確認（Windows 実行環境）**: 修正後に `npm run test`（`test:unit && test:integration`）まで実行する。`test:integration` は `vscode-test` による VS Code バイナリのダウンロードと GUI/Electron 実行を要するため、環境によっては起動・完走しない可能性がある。その場合は「ユニットは全パス、integration は環境要因で未検証」と明示し、integration の検証は別途扱いとする（本対応は integration テスト自体を変更しない）。

## 失敗テストの内訳（全 18 件）

| スイート | 件数 | 契約ファミリー |
|---|---|---|
| `utils` → `convertImgPath` | 7 | file URI 変換（pathToFileURL 契約） |
| `utils` → `resolveHref` | 1 | `'file://' + path.join(...)` |
| `utils` → `transformHtmlBlock` | 8 | file URI 変換（pathToFileURL 契約） |
| `readme-previews` → `resolveReadmePreviewExportPath` | 2 | プレーンパス結合 |

失敗テストには **3 つの契約ファミリー**が存在する。

1. **file URI 変換（pathToFileURL 契約）**（`convertImgPath` / `transformHtmlBlock`）: 期待値は `file:///...` 形式。空白・Unicode はリテラル保持、`#` は `%23`。
2. **`'file://' + path.join(...)`**（`resolveHref`）: 実装は `file:///` 正規化や encode を行わず、単に `'file://'` へ `path.join(...)` を連結する。隣接する resolveHref テスト群（419〜440 行、既にクロスプラットフォーム対応済み）と同じ形で期待値を導出する。`fileUri` ヘルパは使わない。
3. **プレーンなパス結合**（`resolveReadmePreviewExportPath` → `resolveOutputDir`、内部で `path.join` 使用）: 期待値は `/workspace/sample/PlantUML.png`（Windows では `\workspace\sample\...`）。

> 補足: `utils → resolveOutputDir` の `should handle relative path with spaces`（573 行）など、既に `path.join(...)` で期待値を導出しているテストはクロスプラットフォーム対応済みで失敗しない。失敗していた `should handle relative path with spaces` は `resolveHref` ブロック（443 行）の 1 件のみ。

## アプローチ

検討した 3 案:

- **A. 共有ヘルパで OS 正しい期待値を導出（採用）**: OS 依存部分を Node 標準ライブラリに委譲し、その上にプロジェクト固有契約を薄く重ねる。精度と頑健性を両立。
- B. 各アサーションをプラットフォーム分岐リテラルに: 冗長・重複、`C:` 決め打ちで別ドライブ実行に弱い。不採用。
- C. 構造的アサーションに緩める: OS 差に頑健だが検証精度が下がる。不採用。

A を採用する。

## 設計詳細

### 1. 共有ヘルパ（新規ファイル）

`test/unit/helpers/path-platform.ts`（テスト支援コード・単一責務）

```ts
import { pathToFileURL } from 'node:url';

/**
 * Converts an absolute filesystem path to the project's file URI contract,
 * in an OS-independent way.
 *
 * The OS-dependent parts (drive letter, slash direction) are delegated to
 * Node's battle-tested pathToFileURL. The project-specific contract is then
 * applied as a thin layer: spaces and unicode are kept literal (decoded),
 * and '#' is escaped as %23.
 *
 * On POSIX this reduces to the original literal (e.g. '/home/user/x.png'
 * -> 'file:///home/user/x.png'), so existing Linux expectations are preserved.
 */
export function fileUri(absPath: string): string {
  return decodeURIComponent(pathToFileURL(absPath).href).replace(/#/g, '%23');
}
```

設計上の根拠:

- ドライブレターの有無・スラッシュ方向の処理を実装の手書き文字列処理ではなく標準ライブラリ `pathToFileURL` に委ねるため、別ドライブ実行でも正しい。
- Linux でも `pathToFileURL` は空白や Unicode を `%20` などにエンコードするため `decodeURIComponent` は no-op ではない。エンコードを `decodeURIComponent` が打ち消し（往復の相殺）、かつドライブ付与もないため、最終的な期待値は**従来の POSIX 期待文字列に一致**する（Linux 挙動が保存される）。
- 実装の手書きフォーマットと標準 `pathToFileURL` を突き合わせる形になり、トートロジーを回避（フォーマット退行も検出できる）。

契約ファミリー 2（`resolveHref`）・3（プレーンパス結合）には `fileUri` は使わず、テスト内で `path.join` を直接利用する（`join` はドライブを付与しないため決定的）。`resolveHref` は結果に `'file://'` を前置するため、期待値も `'file://' + path.join(...)` とする。

### 2. テスト書き換え方針

入力の POSIX リテラルは**そのまま残し**、期待値だけをヘルパ／`path.resolve`／`path.join` で導出する。

#### `test/unit/utils.test.ts` — `convertImgPath`（8 件）

期待値を `fileUri(path.resolve(<dir>, <decoded-rel>))` で導出。`<dir>` は実装と同じく `path.dirname(filename)` 相当。

```ts
// before
assert.strictEqual(utils.convertImgPath('image.png', '/home/user/doc.md'), 'file:///home/user/image.png');
// after
assert.strictEqual(utils.convertImgPath('image.png', '/home/user/doc.md'), fileUri(path.resolve('/home/user', 'image.png')));
```

- 絶対パス `/images/photo.png` → `fileUri(path.resolve('/images/photo.png'))`
- spaces / `../` / unicode / `%20`: いずれも **デコード済みの形**を `path.resolve` に渡して導出（`'my image.png'`, `'画像/テスト.png'` 等）。
- empty string src: 現在の壊れた期待値 `'file://' + path.resolve('/home/user', '')` を `fileUri(path.resolve('/home/user', ''))` に置換。

#### `test/unit/utils.test.ts` — `transformHtmlBlock`（8 件）

埋め込み URI をヘルパで生成。

```ts
const uri = fileUri(path.resolve('/doc', 'real.png'));
assert.strictEqual(result, `<img alt="look src=bad.png" src="${uri}">`);
```

`indexOf('src="file:///doc/photo.png"')` 形式のアサーションも `` `src="${fileUri(path.resolve('/doc', 'photo.png'))}"` `` へ置換。

#### `test/unit/utils.test.ts` — `resolveHref`（1 件）

`should handle relative path with spaces`（443 行）のみ期待値が POSIX 固定（`'file:///workspace/my styles/custom.css'`）。隣接テスト群（419〜440 行）と同じ `'file://' + path.join(...)` 形式へ揃える。`fileUri` は使わない（`resolveHref` は `file:///` 正規化や encode を行わないため）。

```ts
// before
assert.strictEqual(
  utils.resolveHref('my styles/custom.css', '/home/user/doc.md', false, '/workspace'),
  'file:///workspace/my styles/custom.css'
);
// after
assert.strictEqual(
  utils.resolveHref('my styles/custom.css', '/home/user/doc.md', false, '/workspace'),
  'file://' + path.join('/workspace', 'my styles/custom.css')  // win: file://\workspace\my styles\custom.css
);
```

#### `test/unit/readme-previews.test.ts` — `resolveReadmePreviewExportPath`（2 件）

file URI ではなくプレーンパス。実装が `path.join` を使うため期待値も `path.join` で導出。

```ts
assert.strictEqual(
  resolveReadmePreviewExportPath('/tmp/PlantUML.png', '/tmp/PlantUML.md', 'sample', false, '/workspace'),
  path.join('/workspace', 'sample', 'PlantUML.png')  // win: \workspace\sample\PlantUML.png
);
```

### 3. 触らない方針

- 実装（`src/`）は変更しない。
- `process.platform === 'win32'` でガード済みの Windows 専用テストは現状維持。
- integration テストは本対応のスコープ外。

## 検証計画

### Windows（実行環境）で実行可能な検証

1. `npm run test:unit` を実行し、失敗していた 18 件すべてがパスすること（＝主要成功条件）を確認。
2. 続けて `npm run test` を実行し、`test:unit` 通過後に `test:integration` まで到達することを確認する。`test:integration` が `vscode-test` の VS Code バイナリ取得・Electron 実行で完走しない場合は、その結果（未検証）を記録する。integration テスト自体は本対応で変更しない。
3. ヘルパ自体の妥当性は既存スイートのグリーン化で担保（テスト支援コードのため専用テストは追加しない）。

### Linux（WSL）側の担保 — コード実行なしで構造的に保証

- `fileUri('/posix/abs/path')` は、`pathToFileURL` がエンコードした空白/Unicode を `decodeURIComponent` が打ち消す（往復の相殺）こと、かつドライブ付与がないことから、元の POSIX リテラルと一致する。
- `path.join('/workspace', 'sample', ...)` は POSIX では `/workspace/sample/...` のまま。
- よって書き換え後の期待値は Linux では従来の期待文字列に一致し、回帰しない。

### 回帰防止の補足

- `git diff` で `src/` に変更が入っていないこと（テストのみの変更）を確認。
- 検証の確定スコープはユニット（主要成功条件）まで。`npm run test` 全体の実行は副次確認として行い、integration が環境要因で走らない場合はリスクとして明示する。

## スコープ外（明示）

- 実装ロジックの変更。
- Windows 専用ガードの変更。
- integration テストの修正。
