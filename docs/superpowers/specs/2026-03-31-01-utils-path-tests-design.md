# utils.js パス解決系テスト深掘り 設計書

## 概要

`src/utils.js` の未テスト領域のうち、環境差と設定値の組み合わせで挙動が変わりやすい `resolveHref` と `resolveOutputDir` を中心に、分岐を深く押さえるユニットテストを追加する。

## 背景

- 既存の `test/unit/utils.test.js` では `utils.js` の各関数に対する基本的な単体テストは整っている
- 一方で、パス解決系のテストは個別ケースの列挙が中心で、「どの基準ディレクトリを優先するか」という仕様の軸で整理されていない
- `resolveHref` と `resolveOutputDir` は `workspaceFsPath` の有無や `stylesRelativePathFile` / `outputDirectoryRelativePathFile` の設定によって解決基準が変わるため、組み合わせの回帰に弱い

## 目的

- `resolveHref` の解決規則をテストから読み取れるようにする
- `resolveOutputDir` の出力先決定規則をテストから読み取れるようにする
- パス解決の基準切り替えに関する回帰を防ぐ

## 方針

- 既存の `test/unit/utils.test.js` にケースを追加する
- 実装本体の変更は行わず、現行挙動を仕様として固定する
- テストは入力形式ごとではなく、解決規則ごとに並べる
- 環境依存のある期待値は `path.join` や `os.homedir()` を使って組み立てる
- Windows 専用ケースは `process.platform === 'win32'` で条件分岐し、非 Windows 環境ではスキップする

## 対象

### 1. `resolveHref`

以下の規則を上から順に確認できるようにケースを整理する。

1. `href` が空値ならそのまま返す
2. `http:` / `https:` はそのまま返す
3. `~` 始まりはホームディレクトリ配下へ展開する
4. 絶対パスは `file://` URI に変換する
5. `stylesRelativePathFile === false` かつ `workspaceFsPath` がある場合は workspace 基準で解決する
6. それ以外は Markdown ファイル基準で解決する
7. `../` やスペースを含む相対パスでも上記ルールが維持される

追加・整理対象の代表ケース:

- workspace 基準での相対パス解決
- ファイル基準での相対パス解決
- workspace 不在時のファイル基準フォールバック
- `../styles/custom.css` の正規化
- スペースを含む相対パス
- `data:` URI が URL として素通しされず、現行実装では相対パス扱いになることの固定

### 2. `resolveOutputDir`

以下の規則を上から順に確認できるようにケースを整理する。

1. `outputDirectory` が空値なら入力 `filename` をそのまま返す
2. `~` 始まりはホームディレクトリ配下へ展開する
3. 絶対パスはディレクトリ存在チェックを行い、存在すればその配下へ、存在しなければ `null` を返す
4. `outputDirectoryRelativePathFile === false` かつ `workspaceFsPath` がある場合は workspace 基準で解決する
5. それ以外は Markdown ファイル基準で解決する
6. `../` やスペースを含む相対パスでも上記ルールが維持される

追加・整理対象の代表ケース:

- workspace 基準での出力先解決
- ファイル基準での出力先解決
- workspace 不在時のファイル基準フォールバック
- `../build` を含む相対出力先
- スペースを含む相対出力先
- 存在する絶対ディレクトリ
- 存在しない絶対ディレクトリ

## テスト構成

- 対象ファイル: `test/unit/utils.test.js`
- 既存の `describe('resolveHref', ...)` と `describe('resolveOutputDir', ...)` を維持する
- 各 `describe` 内の `it` は次の順で並べる
  - そのまま返すケース
  - ホーム展開
  - 絶対パス
  - workspace 基準
  - ファイル基準
  - workspace 不在フォールバック
  - 正規化やスペースを伴う相対パス
- 期待値の記述は、環境依存部分のみ計算で表現し、テスト意図が読める程度の明示性は残す

## 検証

- `test/unit/utils.test.js` を実行し、新規ケースと既存ケースの両方が通ることを確認する
- 可能であれば単体テスト全体も実行し、他の `utils.js` テストに影響が出ていないことを確認する

## スコープ外

- `convertImgPath` の追加深掘り
- `extension.js` 側の統合テスト追加
- `src/utils.js` のロジック変更
- パス解決系以外の関数に対する追加テスト
