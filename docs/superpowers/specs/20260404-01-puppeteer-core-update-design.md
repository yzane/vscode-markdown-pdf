# puppeteer-core 24.x 更新設計

## 概要

`puppeteer-core` を 2.1.1 から 24.x に更新する。Chromium の実行パス解決ロジックを刷新し、OS インストール済み Chrome の自動検出と `@puppeteer/browsers` によるダウンロード管理を導入する。

## パッケージ変更

- `puppeteer-core`: `^2.1.1` → `^24.40.0`
- `@puppeteer/browsers` は `puppeteer-core` の内部依存として含まれるため、直接追加しない

## Chromium 実行パス解決

新しい `resolveChromiumPath()` 関数を作成し、以下の優先順位で Chromium の実行パスを解決する。

### Step 1: ユーザー設定

- `markdown-pdf.executablePath` の設定値を確認する
- パスが存在し実行可能であればそのパスを使用する
- 設定されているが使用できない場合はログを出力し、Step 2 に進む（エラーにしない）

### Step 2: OS インストール済み Chrome/Chromium 検出

プラットフォーム別の既知パスを順に確認し、最初に見つかったパスを返す。

#### Windows

システムインストール:

- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
- `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
- `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`

ユーザーインストール (`process.env.LOCALAPPDATA` で展開):

- `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`
- `%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe`
- `%LOCALAPPDATA%\Chromium\Application\chrome.exe`

#### macOS

- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `/Applications/Chromium.app/Contents/MacOS/Chromium`
- `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`

#### Linux

- `/usr/bin/google-chrome`
- `/usr/bin/google-chrome-stable`
- `/usr/bin/chromium-browser`
- `/usr/bin/chromium`
- `/usr/bin/microsoft-edge`
- `/usr/bin/microsoft-edge-stable`

### Step 3: 自動ダウンロード

- `@puppeteer/browsers`（puppeteer-core の内部依存）の `install()` で Chromium をダウンロードする
- キャッシュディレクトリ: VS Code の `globalStorageUri` 配下
- `puppeteer-core` が要求する Chromium の buildId に基づいてダウンロードする
- ダウンロード済みで buildId が同じであればキャッシュを再利用する（再ダウンロードしない）
- buildId が変わった場合（拡張更新時など）は新しい Chromium をダウンロードし、古い buildId の Chromium を削除する
- `computeExecutablePath()` でダウンロード済み Chromium のパスを取得する
- ダウンロード進捗をステータスバーに表示する

## puppeteer API の変更対応

### 廃止される API

| 現在 (2.x) | 24.x での対応 |
|---|---|
| `puppeteer.executablePath()` | 廃止。`resolveChromiumPath()` で置き換え |
| `puppeteer.createBrowserFetcher()` | 廃止。`@puppeteer/browsers` の `install()` で置き換え |

### 互換性のある API

以下の API は 24.x でも互換性がある:

- `puppeteer.launch(options)`
- `page.goto(url, options)`
- `page.pdf(options)`
- `page.screenshot(options)`
- `page.setDefaultTimeout(timeout)`
- `browser.newPage()`
- `browser.close()`

## コード変更箇所

### `exportPdf()`

- `executablePath` の解決を `resolveChromiumPath()` に置き換える
- `puppeteer.executablePath()` フォールバックを削除する

### `checkPuppeteerBinary()`

- `resolveChromiumPath()` を使うように書き換える
- `puppeteer.executablePath()` への依存を削除する

### `installChromium()`

- `puppeteer.createBrowserFetcher()` ベースのロジックを `@puppeteer/browsers` の `install()` で全面書き換えする
- buildId ベースのキャッシュ管理を実装する
- 古い Chromium リビジョンの自動削除を維持する

### `init()`

- 起動時の Chromium チェック・ダウンロードの流れを更新する

## テスト

- 既存のユニットテスト・インテグレーションテストで回帰確認する
- `resolveChromiumPath()` のユニットテストを追加する（各 Step の分岐テスト）

## リスク

- **CommonJS 互換性**: puppeteer-core 24.x が `require()` で読み込めるか確認が必要。ESM only になっている場合は対策が必要
- **`page.pdf()` オプション互換性**: 細かいオプション名や挙動の変更がないか確認が必要
