# OutputChannel ロガー基盤 設計

## 背景・目的

issue #437 対応の一環。本文 `<style>` 等のサニタイズ無害化が現状ユーザーに一切通知されない問題に対し、以下の3要素で対応する計画のうち、本 spec は **要素③** を扱う。

- 要素①: サニタイズ除去 — `<style>`/`<script>`/`<iframe>` をエスケープから完全除去に変更（`bugfix/*`）
- 要素②: 警告通知（Tier 1）— 除去時に `showWarningMessage` トースト（`bugfix/*`）
- **要素③（本 spec）: 詳細ログ基盤（Tier 2 / OutputChannel）— ユーザーが「出力」パネルで確認できるログ基盤を新規実装（`feature/*`）**

要素③を先行する理由: 警告通知（②）と詳細ログ（③）の両方に除去内容を出すには、ログ基盤（③）が先に存在する必要がある。③を後にすると①②のコードを二度触る中間状態が生まれる。#437 は回避策（`sanitize: "gfm-allow-style"`）があり緊急性が低いため、③完成を待っても実害はない。③単独でも既存 `console.log` の移行という独立した価値を持つ。

ブランチ: `feature/output-channel-logger`（`develop` から分岐、`.worktrees/feature-output-channel-logger`）。

## スコープ

### やること

1. VS Code の `LogOutputChannel`（チャネル名 `Markdown PDF`）を用いたログ基盤の新規実装。
2. ユーザー影響のある既存 `console.*` 出力を本基盤へ移行（範囲は「中庸」= 後述）。

### やらないこと（本 spec の対象外）

- 要素①（サニタイズ除去ロジックの変更）・要素②（トースト通知）は別途 `bugfix/*` で実装する。本基盤はそれらが利用する土台を提供するのみ。
- 存在チェックのプローブ的な `console.warn`（失敗が正常系でノイズ）は移行しない。

## アーキテクチャ

### 設計原則: vscode 依存を `extension.ts` に閉じ込める

現状のリポジトリは、`vscode` を import するのは `extension.ts` のみ。`utils.ts` / `math-renderer.ts` / `chromium-resolver.ts` は vscode 非依存に保たれており、これが `tsx --test`（実 VS Code 不要）でのユニットテストを成立させている。

`logger.ts` が `vscode` を直接 import すると、それを import する `utils.ts` / `math-renderer.ts` が芋づる式に vscode 依存となり、既存ユニットテスト（`utils.test.ts` / `math-renderer.test.ts`）が tsx で破綻する。

そこで **依存性逆転（Dependency Inversion）** を用い、`logger.ts` を vscode 非依存に保つ。

### `src/logger.ts`（新規・vscode 非依存）

`vscode` の実体ではなく「形（interface）」だけに依存する。

```ts
// src/logger.ts — import 'vscode' を含まない
export interface LogSink {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  show(preserveFocus?: boolean): void;
}

// 初期化に必要な host の最小形（VS Code の ExtensionContext 相当が構造的に満たす）
export interface LoggerHost {
  subscriptions: { push(disposable: { dispose(): void }): void };
}

let sink: LogSink | undefined;

export function setLogSink(s: LogSink | undefined): void {
  sink = s;
}

// 実体生成（createChannel）と登録を 1 関数に集約。
// createChannel を注入にすることで、fake host / fake factory でユニットテスト可能。
export function initializeLogger(
  host: LoggerHost,
  createChannel: () => LogSink & { dispose(): void }
): void {
  const channel = createChannel();
  host.subscriptions.push(channel);   // 破棄は host(VS Code) のライフサイクルに委譲
  setLogSink(channel);
}

export function logInfo(message: string, ...args: unknown[]): void {
  sink?.info(message, ...args);
}

export function logWarn(message: string, ...args: unknown[]): void {
  sink?.warn(message, ...args);
}

export function logError(message: string, ...args: unknown[]): void {
  sink?.error(message, ...args);
}

export function showLog(): void {
  sink?.show(true);
}

// unknown を決定論的に文字列化する純粋関数（P3 対応）。
// Error はスタックを優先、無ければ name+message。非 Error は String()。
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}
```

ポイント:

- `LogSink` / `LoggerHost` は自前の型定義のみ。`logger.ts` のコード本体（コメント含む）に `vscode` の語・import は一切登場しない → import の鎖がここで止まる。なお本設計書の散文中で `vscode.LogOutputChannel` 等に言及するのは説明のためであり、`logger.ts` のソースには含めない。
- `vscode.LogOutputChannel` は `info / warn / error / show` を互換シグネチャで持つため、TypeScript の構造的型付け（structural typing）により、明示的な `implements` なしでそのまま `LogSink` として渡せる。同様に `vscode.ExtensionContext` は `LoggerHost` を構造的に満たす。
- 実体が注入されていない場合（ユニットテスト等）、`sink?.` のオプショナルチェーンにより各関数は no-op となり安全に無視される。

### `src/extension.ts`（唯一の vscode 依存箇所）が実体を注入

`vscode` を触るのは「チャネル生成の factory」と「context の受け渡し」だけ。生成・登録・注入のロジックは `initializeLogger` 側に閉じる。

```ts
import * as vscode from 'vscode';
import * as logger from './logger';

export function activate(context: vscode.ExtensionContext) {
  logger.initializeLogger(
    context,
    () => vscode.window.createOutputChannel('Markdown PDF', { log: true })
  );
  // ... 既存の activate 処理 ...
}
```

`LogOutputChannel` は `info/warn/error` にタイムスタンプとログレベルを自動付与し、ユーザーは UI からログレベルを制御できる。エンジン要件 `^1.110.0` で利用可能。

### 自動表示しない

ログ出力時に「出力」パネルを自動で前面に出す（`show`）ことはしない。フォーカスを奪わない VS Code 推奨の振る舞い。`showLog()`（`show(true)` = preserveFocus）を公開し、要素②のトースト「Show Output」ボタン等から明示的に呼び出す口とする。

## データフロー

```
[VS Code 実行時]
  extension.activate() が logger.initializeLogger(context, factory) を呼ぶ
        ↓ factory が LogOutputChannel を生成 → subscriptions 登録 → setLogSink
  logger の sink に実体が入る
        ↓
  各モジュールが logWarn(...) 等を呼ぶ → sink.warn(...) → 「出力: Markdown PDF」パネルへ

[tsx ユニットテスト]
  setLogSink は呼ばれない（または fake sink を注入）
        ↓
  sink は undefined（または記録用 fake）
        ↓
  logWarn(...) → no-op（または呼び出し記録）→ vscode 不要でテスト続行
```

## 移行マッピング（中庸範囲）

線引き: **存在チェックのプローブ（失敗が正常系＝ノイズ）だけ `console` に残し、ユーザー影響のあるものは logger へ移行する。**

### 移行する（→ logger）

| 箇所 | 現状 | 移行後 | 理由 |
|---|---|---|---|
| `extension.ts` `showErrorMessage` 内 | `console.log` ×2 | `logError`（error は `formatError` で整形）| エラー詳細。既存のトースト表示は残し、二重で届ける |
| `utils.ts` `readFile`（**要ロジック変更**）| `isExistsPath` ガード＋読込例外時のみ `console.warn` | `isExistsPath` を外し単一 `try/catch` 化。`ENOENT`＝`File not found:`、他＝`Failed to read file:` を `logWarn` | 後述の P1/P3 対応。CSS/テンプレート等の読込失敗＝ユーザー影響あり |
| `math-renderer.ts` KaTeX fallback | `console.warn` | `logWarn` | 数式が `<code>` に劣化＝ユーザーが視認できる影響 |
| `chromium-resolver.ts` 全10箇所（行: 23, 156, 164, 242, 244, 248, 343, 351, 356, 360）| `console.warn/log/error` | `logWarn/logInfo/logError` | Chromium 取得の成否＝出力可否に直結。既存の `[Markdown PDF]` プレフィックスはチャネル名と重複するため除去 |

`chromium-resolver.ts` の行ごとのレベル対応:

| 行 | 内容 | 移行後 |
|---|---|---|
| 23 | Configured executablePath not found | `logWarn` |
| 156 | Latest version response had unexpected shape | `logWarn` |
| 164 | Failed to fetch latest version | `logWarn` |
| 242 | Removed old Chromium（成功時の保守情報）| `logInfo` |
| 244 | Failed to remove old Chromium | `logWarn` |
| 248 | Failed to cleanup old Chromium | `logWarn` |
| 343 | Failed to download latest Chromium | `logError` |
| 351 | Falling back to cached build | `logWarn` |
| 356 | Falling back to bundled build | `logWarn` |
| 360 | All acquisition attempts failed | `logError` |

### P1: `readFile` のロジック変更（重要）

現状の `readFile()` は実読込の前に `isExistsPath()` を呼び、存在しなければ早期 return する。そのため CSS/テンプレートの「ファイルが見つからない」ケースは `readFile` の catch に到達せず、`isExistsPath` 側の低レベル `console.warn` にしか残らない。`isExistsPath` を console に残す方針のままだと、ユーザー影響のある読込失敗が新ロガーに乗らない。

対応として **`readFile` から `isExistsPath` 経由のガードを外し、単一の `try/catch` で読込を行う**。これにより「未検出（`ENOENT`）」と「その他の読込エラー」を `error.code` で判別しつつ、`isExistsPath` の低レベル `console.warn` との二重ログも回避できる:

```ts
try {
  return fs.readFileSync(filename, encode);
} catch (error: unknown) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') {
    logWarn(`File not found: ${filename}`);
  } else {
    logWarn(`Failed to read file: ${filename}`, formatError(error));
  }
  return '';
}
```

`readFile` の呼び出し元（`makeCss` の CSS、`buildKatexStyleTag`、emoji.json、テンプレート等）はいずれも「存在が前提」のファイルであり、未検出は異常系。よって not-found 分岐のログは通常運用でノイズにならない。`readFile` はもう `isExistsPath` を呼ばないため、未検出ケースは OutputChannel にのみ記録され、`console.warn` との二重出力は発生しない（P3 対応）。空文字列の早期 return（先頭の `filename.length === 0` ガード）は従来どおり維持する。`isExistsPath` 自体は他の呼び出し元（`buildKatexStyleTag` のフォント存在確認等）で引き続き使われるため、その `console.warn` は低レベルプローブとして据え置く。

### `console` のまま残す（開発デバッグ）

| 箇所 | 理由 |
|---|---|
| `utils.ts` `isExistsPath` | 存在チェックのプローブ。失敗が正常系でノイズ。ユーザー影響のあるファイル読込失敗は `readFile` 側の `logWarn` が単独で供給する（`readFile` はもう `isExistsPath` を経由しない） |
| `utils.ts` `isExistsDir` ×2 | 同上 |

## エラーハンドリング

- logger 関数は実体未注入時も例外を投げず no-op（`sink?.`）。呼び出し側はログ可否を気にせず呼べる。
- `setLogSink` は冪等的に上書き可能。テストでの注入・リセットに用いる。
- チャネルの破棄は `initializeLogger` 内で `host.subscriptions` に登録し、VS Code のライフサイクルに委譲。明示的な dispose 管理は持たない。

### Error の文字列化（P3 対応）

`showErrorMessage` の `console.log(error)`（raw error object）を `logError` に移すと、整形を決めないと現状よりデバッグ情報が減りうる。`formatError(error: unknown)` で決定論的に整形する:

- `Error` インスタンス → `error.stack`（あれば。スタックを保持してデバッグ情報を最大化）、無ければ `${name}: ${message}`
- 非 `Error` 値 → `String(error)`

`LogOutputChannel` はタイムスタンプとログレベルを自動付与するため、チャネルへ渡すメッセージに手動の `ERROR:` プレフィックスは付けない（トースト側の `'ERROR: ' + msg` は従来どおり維持）。移行後の `showErrorMessage`:

```ts
function showErrorMessage(msg: string, error?: unknown): void {
  vscode.window.showErrorMessage('ERROR: ' + msg);
  logger.logError(msg);
  if (error) {
    vscode.window.showErrorMessage(String(error));
    logger.logError(logger.formatError(error));
  }
}
```

## テスト戦略

### ユニットテスト（tsx, 実 VS Code 不要）

`test/unit/logger.test.ts` を新規作成。logger.ts は vscode 非依存なので全て tsx で完結する。

- **転送**: 呼び出しを記録する fake `LogSink`（`{calls: [...], info/warn/error/show}`）を `setLogSink` で注入し、`logInfo/logWarn/logError` が対応する sink メソッドへ正しく転送されること、引数（可変長含む）がそのまま渡ることを検証。
- **showLog**: `showLog()` が `sink.show(true)` を呼ぶこと。
- **no-op**: 未注入時（`setLogSink(undefined)`）に各関数が例外を投げず no-op になること。
- **initializeLogger（P2 対応）**: fake host（`{subscriptions:{push}}`）と fake factory（`LogSink & {dispose}` を返す）を渡し、(1) factory が 1 回呼ばれ、(2) 生成物が `host.subscriptions.push` に渡され、(3) 以降 `logInfo` 等がその生成物へ転送されることを検証。実 VS Code・実 OutputChannel 一覧 API（非公開）に依存しない。
- **formatError（P3 対応）**: `Error`（stack あり / stack なし）と非 Error 値（文字列・数値・null 等）それぞれの整形結果を検証。
- 各テスト後に `setLogSink(undefined)` でグローバル状態をリセット（テスト分離）。

移行先モジュール（`utils.test.ts` / `math-renderer.test.ts` / `chromium-resolver.test.ts`）は、logger 非注入時に no-op となるため**既存テストがそのまま通過する**ことを回帰確認する。`readFile` のロジック変更（P1/P3）については、fake sink を注入して以下を `utils.test.ts` に追加する:

- 未検出（`ENOENT`）時に `File not found:` を含む `logWarn` が出て、戻り値が `''` であること。
- ディレクトリを渡した場合（既存テストの `readFile(__dirname)` 相当、`EISDIR`）に戻り値が従来どおり `''` で、ログは `Failed to read file:` 側に入ること。
- その他の読込例外時に `Failed to read file:` を含む `logWarn` が出ること。

### 統合テスト（実 VS Code）

OutputChannel の生成検証は VS Code が作成済みチャネル一覧を公開していないため統合テストでは確実に行えない（P2 指摘）。上記の `initializeLogger` ユニットテストで factory 呼び出しと subscriptions 登録を fake で検証する方式に置き換える。統合テストには本基盤専用の新規ケースは追加しない（既存の `extension.test.ts` が activation 時にエラーを起こさないことが間接的な回帰確認となる）。

## 採用済みデフォルト（レビューで異議があれば再検討）

- `chromium-resolver.ts:242`「Removed old Chromium」（成功時の保守情報）は `logInfo` として残す（移行表のとおり）。
- `logDebug` は初期段階では公開しない（YAGNI、必要になった時点で追加）。
