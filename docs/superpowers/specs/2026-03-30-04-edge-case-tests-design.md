# パス変換系関数 エッジケーステスト追加 設計書

## 概要

`utils.js` のパス変換系関数（`convertImgPath`, `resolveHref`, `resolveOutputDir`, `readFile`）に対し、未テストの入力パターンをカバーするエッジケーステストを追加する。

## 背景

- 既存テスト: 12関数41件のユニットテストで基本パスはカバー済み
- パス変換系関数は実際のユーザー環境で多様な入力を受けるが、スペース入りパス、`../` を含む相対パス、data: URL、Windowsパスなどのテストが不足
- 前回設計（`2026-03-30-extract-and-test-design.md`）で計画した4関数の抽出とテストは全て完了済み

## 方針

- 既存の `test/unit/utils.test.js` にケースを追加する（ファイル分割はしない）
- Windowsパスのテストは `process.platform === 'win32'` 条件付きで記述
- 合計18件のテストケースを追加

## テスト対象

### 1. `convertImgPath()` — 6件追加（既存8件）

| # | テストケース | 入力 | 期待値 |
|---|-------------|------|--------|
| 1 | スペースを含むパス | `'my image.png'`, `/home/user/doc.md` | `file:///home/user/my image.png` |
| 2 | `../` を含む相対パス | `'../../assets/img.png'`, `/home/user/docs/sub/doc.md` | `file:///home/assets/img.png` |
| 3 | data: URL パススルー | `'data:image/png;base64,abc'`, `/home/user/doc.md` | そのまま返す |
| 4 | 空文字 | `''`, `/home/user/doc.md` | `file:///home/user/` (path.resolve結果) |
| 5 | Windows絶対パス (Win限定) | `'C:\\Users\\img.png'`, `C:\\docs\\doc.md` | `file:///C:/Users/img.png` |
| 6 | `%20` エンコード済みスペース | `'my%20image.png'`, `/home/user/doc.md` | `file:///home/user/my image.png` |

### 2. `resolveHref()` — 5件追加（既存8件）

| # | テストケース | 入力 | 期待値 |
|---|-------------|------|--------|
| 1 | `../` 付き相対パス (workspace有) | `'../styles/custom.css'`, `/home/user/doc.md`, `false`, `/workspace` | `file://` + path.join結果 |
| 2 | `../` 付き相対パス (file相対) | `'../styles/custom.css'`, `/home/user/doc.md`, `true`, `/workspace` | `file:///home/styles/custom.css` |
| 3 | data: URL パススルー | `'data:text/css;base64,abc'`, `/home/user/doc.md`, `false`, `/workspace` | そのまま返す |
| 4 | スペースを含む相対パス | `'my styles/custom.css'`, `/home/user/doc.md`, `false`, `/workspace` | `file:///workspace/my styles/custom.css` |
| 5 | Windows絶対パス (Win限定) | `'C:\\styles\\custom.css'`, `C:\\docs\\doc.md`, `false`, `C:\\workspace` | `file://C:\\styles\\custom.css` |

### 3. `resolveOutputDir()` — 4件追加（既存7件）

| # | テストケース | 入力 | 期待値 |
|---|-------------|------|--------|
| 1 | スペースを含む相対パス | `'/home/user/doc.pdf'`, `'my output'`, `false`, `/home/user/doc.md`, `/workspace` | `path.join('/workspace', 'my output', 'doc.pdf')` |
| 2 | `../` を含む相対パス | `'/home/user/doc.pdf'`, `'../build'`, `false`, `/home/user/doc.md`, `/workspace` | `path.join('/workspace', '../build', 'doc.pdf')` |
| 3 | スペースを含む絶対パス (要tmpDir) | `'/home/user/doc.pdf'`, tmpDir内にスペース入りサブディレクトリを作成して使用 | `path.join(spaceDir, 'doc.pdf')` |
| 4 | Windows絶対パス (Win限定) | `'C:\\docs\\doc.pdf'`, `'C:\\output'` (実在), `C:\\docs\\doc.md`, `C:\\workspace` | `path.join('C:\\output', 'doc.pdf')` |

### 4. `readFile()` — 3件追加（既存5件）

| # | テストケース | 入力 | 期待値 |
|---|-------------|------|--------|
| 1 | スペースを含むファイルパス | tmpFileをスペース入りパスに作成 | ファイル内容を返す |
| 2 | `file://` + スペースを含むパス | `'file://' + tmpFileWithSpace` | ファイル内容を返す |
| 3 | Windows `file:///C:/` 形式 (Win限定) | `'file:///C:/path/to/file.txt'` (実在ファイル) | ファイル内容を返す |

## テスト構成

- ファイル: `test/unit/utils.test.js`（既存ファイルに追加）
- Windows限定テストのパターン:
  ```javascript
  (process.platform === 'win32' ? it : it.skip)('should handle Windows path', function () {
    // ...
  });
  ```
- テンポラリファイル/ディレクトリは既存の `before`/`after` フックと同じパターンで管理

## スコープ外

- `extension.js` からの新規ロジック抽出
- 統合テストの追加
- パス系以外の関数（`setBooleanValue`, `Slug`, `transformTemplate`, `isExcludeFile`, `makeCss`, `buildStyleTags`）のエッジケース
