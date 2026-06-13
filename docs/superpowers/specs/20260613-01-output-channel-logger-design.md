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

let sink: LogSink | undefined;

export function setLogSink(s: LogSink | undefined): void {
  sink = s;
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
```

ポイント:

- `LogSink` は自前の型定義のみ。`logger.ts` に `vscode` の語は一切登場しない → import の鎖がここで止まる。
- `vscode.LogOutputChannel` は `info / warn / error / show` を互換シグネチャで持つため、TypeScript の構造的型付け（structural typing）により、明示的な `implements` なしでそのまま `LogSink` として渡せる。
- 実体が注入されていない場合（ユニットテスト等）、`sink?.` のオプショナルチェーンにより各関数は no-op となり安全に無視される。

### `src/extension.ts`（唯一の vscode 依存箇所）が実体を注入

```ts
import * as vscode from 'vscode';
import * as logger from './logger';

export function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel('Markdown PDF', { log: true });
  context.subscriptions.push(channel);   // 破棄は VS Code に委譲
  logger.setLogSink(channel);
  // ... 既存の activate 処理 ...
}
```

`LogOutputChannel` は `info/warn/error` にタイムスタンプとログレベルを自動付与し、ユーザーは UI からログレベルを制御できる。エンジン要件 `^1.110.0` で利用可能。

### 自動表示しない

ログ出力時に「出力」パネルを自動で前面に出す（`show`）ことはしない。フォーカスを奪わない VS Code 推奨の振る舞い。`showLog()`（`show(true)` = preserveFocus）を公開し、要素②のトースト「Show Output」ボタン等から明示的に呼び出す口とする。

## データフロー

```
[VS Code 実行時]
  extension.activate() が LogOutputChannel を生成
        ↓ logger.setLogSink(channel)
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
| `extension.ts` `showErrorMessage` 内 | `console.log` ×2 | `logError` | エラー詳細。既存のトースト表示は残し、二重で届ける |
| `utils.ts` `readFile` | `console.warn` | `logWarn` | CSS/テンプレート等のファイル読込失敗＝ユーザー影響あり |
| `math-renderer.ts` KaTeX fallback | `console.warn` | `logWarn` | 数式が `<code>` に劣化＝ユーザーが視認できる影響 |
| `chromium-resolver.ts` 全9箇所 | `console.warn/log/error` | `logWarn/logInfo/logError` | Chromium 取得の成否＝出力可否に直結。既存の `[Markdown PDF]` プレフィックスはチャネル名と重複するため除去 |

`chromium-resolver.ts` のレベル対応の目安:

- 設定 executablePath 不在 / 最新版取得失敗 / 旧版削除失敗 / キャッシュ・バンドルへのフォールバック → `logWarn`
- 旧 Chromium 削除成功（保守情報） → `logInfo`
- 最新版ダウンロード失敗 / 全取得手段の失敗 → `logError`

### `console` のまま残す（開発デバッグ）

| 箇所 | 理由 |
|---|---|
| `utils.ts` `isExistsPath` | 存在チェックのプローブ。失敗は正常系（`readFile` のガードでも発火）でノイズ |
| `utils.ts` `isExistsDir` ×2 | 同上 |

## エラーハンドリング

- logger 関数は実体未注入時も例外を投げず no-op（`sink?.`）。呼び出し側はログ可否を気にせず呼べる。
- `setLogSink` は冪等的に上書き可能。テストでの注入・リセットに用いる。
- チャネルの破棄は `context.subscriptions` 登録により VS Code のライフサイクルに委譲し、明示的な dispose 管理を持たない。

## テスト戦略

### ユニットテスト（tsx, 実 VS Code 不要）

`test/unit/logger.test.ts` を新規作成。

- 呼び出しを記録する fake `LogSink`（`{calls: [...], info/warn/error/show}`）を `setLogSink` で注入。
- `logInfo/logWarn/logError` が対応する sink メソッドへ正しく転送されること、引数（可変長含む）がそのまま渡ることを検証。
- `showLog()` が `sink.show(true)` を呼ぶこと。
- 未注入時（`setLogSink(undefined)`）に各関数が例外を投げず no-op になること。
- 各テスト後に `setLogSink(undefined)` でグローバル状態をリセット（テスト分離）。

移行先モジュール（`utils.test.ts` / `math-renderer.test.ts` / `chromium-resolver.test.ts`）は、logger 非注入時に no-op となるため**既存テストがそのまま通過する**ことを回帰確認する。

### 統合テスト（実 VS Code）

`test/integration/extension.test.ts` に追加。

- `activate()` 後にチャネル名 `Markdown PDF` の OutputChannel が生成され、`context.subscriptions` に登録されていること。

## 採用済みデフォルト（レビューで異議があれば再検討）

- `chromium-resolver.ts:242`「Removed old Chromium」（成功時の保守情報）は `logInfo` として残す（移行表のとおり）。
- `logDebug` は初期段階では公開しない（YAGNI、必要になった時点で追加）。
