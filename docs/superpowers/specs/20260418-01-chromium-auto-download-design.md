# Chromium 自動ダウンロード機能の最新版追従と無効化オプション 設計書

- 日付: 2026-04-18
- 関連 Issue: [#341](https://github.com/yzane/vscode-markdown-pdf/issues/341)
- ブランチ: `feature/chromium-auto-download`

## 1. 概要

`vscode-markdown-pdf` 拡張機能が Chromium を自動ダウンロードする際、Chrome for Testing API から **最新の Chrome Stable バージョンを取得し、常に最新版に追従する** ようにする。あわせて、自動ダウンロード自体を **完全に無効化する設定** `markdown-pdf.chromium.autoDownload` を追加する。

これにより、Issue #341 で報告された「初回セットアップで古い Chromium がインストールされ、未パッチの脆弱性にさらされる」問題を恒久的に解決する。

## 2. 背景と動機

### 2.1 現状の問題

現在の実装 (`src/chromium-resolver.ts:106` `ensureChromiumDownloaded`) は、`puppeteer-core` の `PUPPETEER_REVISIONS.chrome` で固定された buildId をダウンロードする。これは `puppeteer-core` の依存バージョンを上げない限り更新されないため、時間経過で古い Chromium が固定化される。

### 2.2 v2.0 での既存対策

v2.0 から、以下の優先順位で Chromium を解決する設計に変更済み (`resolveChromiumPath`):

1. ユーザー指定パス (`markdown-pdf.executablePath`)
2. システムインストール済み Chrome / Chromium / Edge
3. キャッシュ確認 → なければダウンロード（フォールバック）

優先順位 1・2 が利用される場合、Chromium のバージョンは利用者の環境（OS のアップデート機構）に委ねられるため、脆弱性追従の問題は実質的に解決済み。

### 2.3 残された課題

優先順位 3（自動ダウンロード）が選ばれるケースで、依然として `puppeteer-core` 同梱バージョンが固定される。本設計はこのフォールバック経路にのみ最新版追従を導入する。

## 3. 設定の追加

### 3.1 設定キー

`package.json` の `contributes.configuration.properties` に以下を追加する。

```json
"markdown-pdf.chromium.autoDownload": {
  "type": "boolean",
  "default": true,
  "description": "Automatically download the latest Chrome Stable when no system Chromium/Edge is found and no executable path is specified. Disable to prevent any Chromium download (system or user-specified Chromium must be available)."
}
```

### 3.2 値の意味

| 値 | 挙動 |
|----|------|
| `true` (デフォルト) | ダウンロードパス到達時に最新 Chrome Stable を取得し、必要に応じて自動更新 |
| `false` | 一切ダウンロードしない。システム / ユーザー指定 / 既存キャッシュのみで動作 |

### 3.3 命名方針

既存の `markdown-pdf.markdown-it-include.enable` と同じネスト命名を採用する。将来 Chromium 関連設定が追加された場合に同じグループへ集約しやすい。

## 4. 動作仕様

### 4.1 解決フロー

`resolveChromiumPath` の解決順序は以下のとおり。

```
入力: userExecutablePath, cacheDir, { autoDownload, onProgress }
出力: Chromium 実行パス | null

[Step 1] ユーザー指定パス
  if userExecutablePath が有効 → return パス

[Step 2] システムブラウザ検出
  if Chrome/Chromium/Edge がシステムにある → return パス

[Step 3] ダウンロードパス（autoDownload で分岐）

  ├── autoDownload = true:
  │     ├─ 最新 buildId をセッションメモから取得
  │     │   └─ 未取得なら Chrome for Testing JSON fetch → メモに格納
  │     │
  │     ├─ JSON 取得成功:
  │     │   ├─ キャッシュに最新 buildId あり → return パス
  │     │   └─ なし → ダウンロード → cleanup 旧版 → return パス
  │     │
  │     └─ JSON 取得失敗（フォールバック）:
  │         ├─ 既存キャッシュ走査 → 使えるものあり → return パス（warn ログ）
  │         └─ なければ puppeteer-core 固定 buildId を DL 試行
  │              ├─ 成功 → return パス
  │              └─ 失敗 → return null
  │
  └── autoDownload = false:
        ├─ 既存キャッシュ走査 → 使えるものあり → return パス
        └─ なし → return null（呼び出し側でエラー表示）
```

### 4.2 最新版チェックのタイミング

| タイミング | JSON チェック実行？ |
|------------|---------------------|
| 拡張機能アクティベート時 (`checkPuppeteerBinary` → `installChromium`) | `autoDownload=true` のときのみ実行 |
| 変換コマンド実行時 1 回目 (`resolveChromiumPath`) | 同セッション内で未取得なら実行 |
| 変換コマンド実行時 2 回目以降 | メモ化されたものを使用（実行しない） |
| `autoDownload=false` | 実行しない |

### 4.3 ダウンロードのタイミング

| シナリオ | ダウンロード発生？ |
|----------|-------------------|
| 初回インストール（キャッシュ空） | あり |
| Chrome Stable が新バージョンをリリースしたあとの初回起動 | あり（旧キャッシュは自動削除） |
| キャッシュを手動削除したあとの初回起動 | あり |
| 通常起動（最新 buildId が既にキャッシュにある） | なし（JSON チェックのみ） |
| 同セッション中の 2 回目以降の変換 | なし（メモ化） |
| `autoDownload=false` | なし |
| JSON 取得失敗 → 既存キャッシュあり | なし |
| JSON 取得失敗 → キャッシュなし | あり（`puppeteer-core` 固定 buildId をフォールバックで DL） |

### 4.4 旧版 Chromium の削除タイミング

旧版 Chromium の削除 (`cleanupOldChromium`) は、**新規ダウンロードが成功した直後にのみ実行する**。

| シナリオ | DL 実行 | cleanup 実行 |
|---------|---------|-------------|
| `autoDownload=true`, 最新 buildId がキャッシュにヒット | なし | なし |
| `autoDownload=true`, Chrome Stable 新リリース → 最新 DL | あり | あり（旧版削除） |
| `autoDownload=true`, 初回インストール（キャッシュ空） | あり | あり（削除対象なし） |
| `autoDownload=true`, JSON 取得失敗 → 既存キャッシュ使用 | なし | なし |
| `autoDownload=true`, JSON 取得失敗 → puppeteer-core 固定 DL | あり | あり（フォールバック到達時はキャッシュ空のため、実質削除対象なし） |
| `autoDownload=false`, キャッシュ使用 | なし | なし |

#### 設計意図

フォールバック経路（JSON 取得失敗時）で既存キャッシュを使う場合は、cleanup を実行しない。理由は以下。

- JSON 取得失敗は一時的なネットワーク障害の可能性があり、本当の最新版を知らない状態である
- そこで旧版を消すと、次セッションで JSON が復活したときに「実は手元にあった少し新しい版」まで失う恐れがある
- 既存キャッシュは保険として残す方が安全

### 4.5 「JSON 取得失敗」の定義

以下のいずれかが発生した場合を JSON 取得失敗として扱い、フォールバック経路に進む。

- ネットワークエラー（DNS 解決失敗、接続拒否、タイムアウト）
- HTTP ステータス 200 以外（4xx / 5xx）
- レスポンスボディの JSON パースエラー
- `channels.Stable.version` フィールドの欠落 / 不正な値（バージョン文字列フォーマット不一致）

タイムアウト値は 10 秒程度を想定する（実装時に調整可）。

### 4.6 セッションメモのライフサイクル

`chromium-resolver.ts` のモジュールスコープに以下の状態を保持する。

```ts
let cachedLatestBuildId: string | null = null;
let cachedLatestFetchFailed: boolean = false;
```

- `cachedLatestBuildId` がセットされていれば JSON fetch をスキップ
- `cachedLatestFetchFailed` がセットされていれば、同セッション中は再試行しない
- VS Code リロード / 拡張機能リロードで自動的にリセット（モジュール再ロードのため）

時系列例:

```
時系列                  cachedLatestBuildId   動作
─────────────────────────────────────────────────────
VS Code 起動           null                  -
1 回目の解決            null → "131.x"        JSON fetch、メモ更新
2 回目の解決            "131.x"               メモ使用、JSON fetch なし
... （何度でも同じ）   "131.x"
VS Code リロード        null                  次回 fetch
```

## 5. アーキテクチャ

### 5.1 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/chromium-resolver.ts` | 最新版取得・メモ化・更新ロジックを追加 |
| `src/extension.ts` | `installChromium` / `checkPuppeteerBinary` から `autoDownload` を参照、UI 文言調整 |
| `package.json` | 設定キー `markdown-pdf.chromium.autoDownload` を追加 |
| `test/unit/chromium-resolver.test.ts` | 新ロジックの単体テスト追加 |

### 5.2 `src/chromium-resolver.ts` への追加 API

```ts
// JSON エンドポイント定数
const CHROME_FOR_TESTING_LATEST_URL =
  'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json';

// 最新 Chrome Stable の buildId を取得（セッションキャッシュあり）
export async function fetchLatestStableBuildId(): Promise<string | null>;

// セッションメモをリセット（テスト用）
export function resetLatestBuildIdCache(): void;

// キャッシュ内で最も新しい Chrome ビルドの実行パスを返す
export async function findLatestCachedChromium(cacheDir: string): Promise<string | null>;
```

### 5.3 既存 API のシグネチャ変更

#### `resolveChromiumPath`

オプションオブジェクト化し、`autoDownload` を受け取る。

```ts
// before
export async function resolveChromiumPath(
  userExecutablePath: string,
  cacheDir: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<string | null>

// after
export async function resolveChromiumPath(
  userExecutablePath: string,
  cacheDir: string,
  options?: {
    autoDownload?: boolean;
    onProgress?: (downloaded: number, total: number) => void;
  }
): Promise<string | null>
```

#### `ensureChromiumDownloaded`

`buildId` を引数化し、責務を「指定 buildId のダウンロード」に絞る。

```ts
// before
export async function ensureChromiumDownloaded(
  cacheDir: string,
  onProgress?: (...) => void
): Promise<string>

// after
export async function ensureChromiumDownloaded(
  cacheDir: string,
  buildId: string,
  onProgress?: (...) => void
): Promise<string>
```

`getExpectedBuildId()` は残し、フォールバック時に呼び出す。

### 5.4 `src/extension.ts` での参照

```ts
// 共通ヘルパー
function getAutoDownload(): boolean {
  return vscode.workspace.getConfiguration('markdown-pdf')['chromium']?.['autoDownload'] ?? true;
}

// resolveChromiumPath 呼び出し
const resolved = await chromiumResolver.resolveChromiumPath(
  userExecPath,
  cacheDir,
  { autoDownload: getAutoDownload(), onProgress }
);
```

`installChromium` 関数は内部で `resolveChromiumPath` を呼ぶ形に統一し、二重実装を解消する。`checkPuppeteerBinary` 内の固定 buildId チェック (`src/extension.ts:546-554`) も `findLatestCachedChromium` を使う形に整理する。

### 5.5 呼び出し関係

```
extension.activate()
  └─ extension.init()
       ├─ extension.checkPuppeteerBinary()
       │    ├─ chromiumResolver.findChromiumFromUserSetting()
       │    ├─ chromiumResolver.findChromiumFromSystem()
       │    └─ chromiumResolver.findLatestCachedChromium()  【新規呼び出し】
       │
       └─ [autoDownload=true なら] extension.installChromium()
            └─ chromiumResolver.resolveChromiumPath()  ← 内部統一
                 └─ (詳細は下)

extension.exportPdf()
  └─ chromiumResolver.resolveChromiumPath(opts)
       │
       ├─ findChromiumFromUserSetting()  → 見つかれば return
       ├─ findChromiumFromSystem()       → 見つかれば return
       │
       ├─ [autoDownload=true]
       │    ├─ fetchLatestStableBuildId()
       │    ├─ [取得成功] ensureChromiumDownloaded(cacheDir, latestBuildId, onProgress)
       │    │    └─ cleanupOldChromium(cacheDir, latestBuildId)
       │    └─ [取得失敗] フォールバック:
       │         ├─ findLatestCachedChromium(cacheDir)  → あれば return
       │         └─ ensureChromiumDownloaded(cacheDir, getExpectedBuildId(), onProgress)
       │
       └─ [autoDownload=false]
            └─ findLatestCachedChromium(cacheDir)
                 ├─ あれば return
                 └─ なければ return null（呼び出し側でエラー表示）
```

### 5.6 HTTP 取得関数の注入可能性

`fetchLatestStableBuildId` の中で `fetch`（Node 18+ グローバル）を直接使うのではなく、注入可能な薄いラッパーを介してテスト時に差し替えやすくする。

```ts
type JsonFetcher = (url: string) => Promise<unknown>;

let jsonFetcher: JsonFetcher = defaultJsonFetcher;

export function setJsonFetcherForTesting(f: JsonFetcher): void;
```

## 6. エラー処理と UI

### 6.1 エラーシナリオ一覧

| # | 状況 | UI 通知 | ログ | 続行可否 |
|---|------|---------|------|---------|
| 1 | 通常成功（最新版 DL or キャッシュ使用） | プログレス表示（DL 時のみ） | info | OK |
| 2 | JSON 取得失敗 → 既存キャッシュ使用 | なし（透過的フォールバック） | warn | OK |
| 3 | JSON 取得失敗 → puppeteer-core 固定版 DL 成功 | プログレス表示 | warn | OK |
| 4 | JSON 取得失敗 → 全 DL 失敗 | エラーダイアログ | error | NG |
| 5 | DL 中にネットワーク切断 | エラーダイアログ | error | NG |
| 6 | `autoDownload=false` + 既存キャッシュあり | なし | info | OK |
| 7 | `autoDownload=false` + 何もない（変換実行時） | エラーダイアログ | error | NG |
| 8 | `autoDownload=false` + 何もない（アクティベート時） | なし（変換まで遅延） | warn | - |

### 6.2 UI メッセージ

#### 既存メッセージ（変更なし）

```
[起動時 DL 開始]    "[Markdown PDF] Installing Chromium ..."
[DL 進捗]           "$(markdown) Installing Chromium NN%"
[DL 成功]           "[Markdown PDF] Chromium installation succeeded."
[DL 失敗]           "Failed to download Chromium! If you are behind a proxy, ..."
```

#### 新規メッセージ（シナリオ 7）

```
"Chromium not found. Automatic download is disabled
 (markdown-pdf.chromium.autoDownload = false).

 To resolve this, do one of the following:
   - Install Google Chrome, Chromium, or Microsoft Edge
   - Set markdown-pdf.executablePath to a Chromium/Chrome executable
   - Enable markdown-pdf.chromium.autoDownload

 See https://github.com/yzane/vscode-markdown-pdf#install"
```

### 6.3 ログ方針

`console.warn` / `console.error` を使い、プレフィックス `[Markdown PDF]` で統一する（既存の慣習に合わせる）。

```ts
console.warn('[Markdown PDF] Failed to fetch latest Chromium version: ' + msg);
console.warn('[Markdown PDF] Falling back to cached Chromium build: ' + buildId);
console.warn('[Markdown PDF] Falling back to bundled Chromium build: ' + buildId);
console.error('[Markdown PDF] All Chromium acquisition attempts failed: ' + msg);
```

### 6.4 プログレス UI

JSON 取得は数 KB と高速なため、JSON 取得段階での進捗表示は行わない。実際にバイナリ DL が始まる段階のみ既存の `onProgress` で表示する（実装変更なし）。

ユーザー視点では:

- キャッシュヒット → 一瞬で変換開始（プログレスなし）
- 新バージョン DL 発生 → 既存と同じ進捗バー（"Installing Chromium NN%"）

## 7. テスト方針

### 7.1 単体テスト（`test/unit/chromium-resolver.test.ts`）

既存テストと同じ `node:test` 形式・モンキーパッチ手法を踏襲する。

#### 新規 describe ブロックと主要ケース

`fetchLatestStableBuildId`

- JSON 取得成功時、`channels.Stable.version` を返す
- 同セッション 2 回目はネットワーク呼び出しなし（メモ使用）
- JSON 取得失敗時は `null` を返し、再呼び出し時もネットワークなし
- JSON が想定外スキーマの場合 `null` を返す
- `resetLatestBuildIdCache()` 後は再 fetch される

`findLatestCachedChromium`

- キャッシュディレクトリに複数バージョンがあれば最新を返す
- Chrome ブラウザのみ対象（Firefox など他ブラウザは無視）
- キャッシュ空 / ディレクトリ不在 → `null`

`resolveChromiumPath` の分岐テスト

- ユーザー指定パスが有効 → DL 関連関数を一切呼ばずに即 return
- システムブラウザあり → DL 関連関数を一切呼ばずに即 return
- `autoDownload=true`, JSON 取得成功, キャッシュにヒット → DL 呼ばれない
- `autoDownload=true`, JSON 取得成功, キャッシュミス → `ensureChromiumDownloaded` が最新 buildId で呼ばれる
- `autoDownload=true`, JSON 取得失敗, キャッシュあり → 既存キャッシュパスを返す
- `autoDownload=true`, JSON 取得失敗, キャッシュなし → puppeteer-core 固定 buildId で DL 試行
- `autoDownload=false`, キャッシュあり → 既存キャッシュパスを返す
- `autoDownload=false`, キャッシュなし → `null`（DL 関数は呼ばれない）

#### 既存テストの維持

`findChromiumFromUserSetting` / `findChromiumFromSystem` / `getExpectedBuildId` / `cleanupOldChromium` のテストはシグネチャ非破壊なので変更不要。

### 7.2 統合テスト

実 Chrome のダウンロードを伴うため、統合テストは既存の export 系テストでカバー継続する。新たに `autoDownload` フラグを使う統合シナリオは追加しない（CI 時間増を避けるため）。

### 7.3 手動検証項目

実環境での動作確認は以下を docs に列挙する。

1. クリーン環境で初回起動 → 最新 Chromium が DL されることを確認
2. 既にキャッシュがある状態で起動 → JSON のみ取得、DL なしを確認（ネットワークログ）
3. オフラインで起動 → 既存キャッシュで動作することを確認
4. `autoDownload=false` 設定 + キャッシュなし + システムブラウザなし → 変換時のエラーメッセージを確認
5. `autoDownload=false` 設定 + システムブラウザあり → 正常に変換されることを確認

## 8. スコープと非スコープ

### 8.1 スコープ内

- 設定 `markdown-pdf.chromium.autoDownload` (boolean, デフォルト `true`) の追加
- Chrome for Testing API (`last-known-good-versions.json`) からの最新 Stable バージョン取得
- ダウンロードパス到達時の最新 buildId チェックと自動更新
- セッション内メモ化による重複 fetch 抑制
- JSON 取得失敗時のフォールバックチェーン（既存キャッシュ → puppeteer-core 固定版 → エラー）
- `autoDownload=false` 時の DL 完全抑止と適切なエラーメッセージ
- 既存の活性化時 `installChromium` フローの設定対応
- `chromium-resolver.ts` 新規 API (`fetchLatestStableBuildId`, `findLatestCachedChromium`, `resetLatestBuildIdCache`) と既存 API のシグネチャ変更
- 単体テストの追加

### 8.2 非スコープ

- 「最新確認のタイミングをユーザーが細かく制御」する追加設定
- 永続キャッシュ + TTL（セッションメモ化で十分）
- 拡張機能バージョンに連動した強制再チェック
- Chrome Beta / Dev / Canary チャネル選択
- プロキシ設定の改善（既存の `setProxy` を流用）
- 統合テストでの実 DL 検証
- 既存の `installChromium` UX 大幅変更（プログレス表示・通知文言は流用）
- Markdown PDF 拡張機能のリリース版バンプ判断（リリース計画は別タスク）

## 9. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Chrome for Testing JSON のスキーマ変更 | 最新版取得が失敗 | パースエラー耐性、フォールバックチェーン |
| 新 Chrome Stable と `puppeteer-core` の CDP 非互換 | 変換失敗 | `puppeteer-core` 自身も継続的に更新 |
| 短期間に複数のメジャー Chrome リリース | 頻繁な ~150MB DL | `cleanupOldChromium` で旧版自動削除、ストレージ肥大なし |
| エンタープライズ環境で `googlechromelabs.github.io` がブロックされる | 最新版取得不可 | 既存キャッシュ + 固定版フォールバック、ログで原因特定可能 |
| 既存ユーザーの初回アップグレード時に古いキャッシュが残る | 一時的なディスク使用増 | 最新版 DL 完了時に `cleanupOldChromium` で自動削除 |

## 10. 後続タスク（別 spec で扱う）

- 拡張機能のリリース版バンプとリリースノート整備
- README に新設定の説明追加
- 必要なら `puppeteer-core` 自動更新の Renovate / Dependabot 導入
