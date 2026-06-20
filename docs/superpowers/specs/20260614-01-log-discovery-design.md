# ログ動線（Show Output ボタン）設計

## 背景・目的

issue #437 対応の一環。要素③（OutputChannel ロガー基盤、`fcc06f9` で develop マージ済み）により警告・エラーが「Markdown PDF」出力チャネルに記録されるようになったが、**ログの表示方法を知らないユーザーが多く、せっかくのログに気づけない**という動線（discoverability）の問題が実機検証で判明した。

本 spec はこの動線問題のうち、**エラー通知からログへの誘導**を扱う（要素②b）。サニタイズ機能とは独立し、要素③だけに依存する。

- 要素①: サニタイズ除去（別 `bugfix/*`、未着手）
- 要素②a: サニタイズ除去通知（①と統合ブランチ、未着手）
- **要素②b（本 spec）: ログ動線 — エラートーストに「Show Output」アクションボタンを追加し `showLog()` で出力チャネルを開く（`feature/log-discovery`）**

要素③で `showLog()`（`channel.show(true)`）は公開済みで、本 spec はその「トリガー（動線）」を与える。

ブランチ: `feature/log-discovery`（`develop` から分岐、`.worktrees/feature-log-discovery`）。

## スコープ

### やること

- `extension.ts` の `showErrorMessage` を変更し、エラートーストに **「Show Output」アクションボタン**を追加。押下時に `logger.showLog()` を呼び「Markdown PDF」チャネルを開く。
- エラーオブジェクト付与時の**2つ目のトースト（生 `String(error)`）を廃止**し、ボタン付き1トーストに集約（詳細は要素③でチャネルに記録済み）。

### やらないこと（対象外）

- **自動表示はしない**（要素③の設計と一貫。フォーカス/レイアウトを勝手に変えない。ユーザーがボタンで開く）。
- **警告（`logWarn`）にはトーストを出さない**。chromium フォールバック等は診断用としてチャネルのみを維持。
- **汎用ヘルパーの抽出はしない**（YAGNI）。サニタイズ警告通知（要素②a）は別ブランチで同じ「`showXMessage(msg, action)` → `showLog()`」パターンを使い、必要になった時点で共通化を検討する。未使用コードを先回りで作らない。
- **README / CHANGELOG の更新はしない**。ドキュメントはリリース準備時に要素③①②とまとめて1回更新する。

## 現状コードと変更

### 現状（要素③マージ後の `showErrorMessage`）

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

エラーオブジェクト付きの場合、トーストが2つ積まれる（`ERROR: msg` と生 `String(error)`）。生エラーの詳細はチャネルにも `logError(formatError(error))` で記録される。

### 変更後

```ts
const SHOW_OUTPUT_ACTION = 'Show Output';

function showErrorMessage(msg: string, error?: unknown): void {
  logger.logError(msg);
  if (error) {
    logger.logError(logger.formatError(error));
  }
  vscode.window.showErrorMessage('ERROR: ' + msg, SHOW_OUTPUT_ACTION).then(selection => {
    if (selection === SHOW_OUTPUT_ACTION) {
      logger.showLog();
    }
  });
}
```

変更点:

1. **アクションボタン追加**: `showErrorMessage('ERROR: ' + msg, SHOW_OUTPUT_ACTION)` とし、押下時に `logger.showLog()` を呼ぶ。`.then` は fire-and-forget（呼び出し側は await 不要、従来どおり `void`）。
2. **2つ目のトースト廃止**: 生 `String(error)` のトーストを出さない。詳細＋スタックは要素③によりチャネルへ記録済みで、ユーザーは「Show Output」から確認できる。トーストの重複を避け、UX を簡潔化。
3. **チャネルへのログは従来どおり**: `logError(msg)`、および error がある場合 `logError(formatError(error))` を維持（順序を先に出してからトースト表示）。
4. **自動表示しない**: `showLog()` はボタン押下時のみ。

### ボタンラベル

VS Code 標準の表現に合わせ英語 **「Show Output」**。拡張のユーザー向けメッセージは英語統一のため、ローカライズはしない。

## データフロー

```
変換エラー等が発生
   ↓ showErrorMessage(msg, error)
   logError(msg) / logError(formatError(error))  → 「Markdown PDF」チャネルへ記録（従来どおり）
   ↓
   showErrorMessage('ERROR: ' + msg, 'Show Output')  → トースト1つ（ボタン付き）
   ↓ ユーザーが「Show Output」を押す
   logger.showLog()  → channel.show(true)（preserveFocus）でチャネルを前面に
```

## エラーハンドリング

- `.then` のコールバックはボタン押下（または閉じる）に対する処理のみで、例外を投げない。`selection` が `undefined`（トーストを閉じた/タイムアウト）なら何もしない。
- `showErrorMessage` の戻り値は従来どおり `void`。呼び出し側（多くは catch 節、await しない）に影響を与えない。

## テスト戦略

`showErrorMessage` は `vscode` 依存の `extension.ts` 内にあり、`tsx --test` のユニットテスト対象外（要素③ Task 4 と同じ事情）。

- **自動検証**: `npm run check`（型エラーなし）/ `npm run build`（esbuild バンドル成功）。
- **手動検証（2ケース必須）**: dev host（F5）で以下の両方を確認する。`showErrorMessage` には「error 引数なし」経路と「error 引数あり」経路があり、2つ目トースト廃止は後者でしか検証できないため、両方を踏む。
  - **ケースA（error 引数なし）**: `markdown-pdf.outputDirectory` に存在しない絶対パス（例 `C:\nope\output`）を設定して Export。`getOutputDir` が `showErrorMessage(msg)` を error 引数なしで呼ぶ経路。確認: (1) トーストに「Show Output」が表示される、(2) 押下で「Markdown PDF」チャネルが開く。
  - **ケースB（error 引数あり）**: `markdown-pdf.executablePath` に実在するフォルダ（例 `C:\Windows`）を設定して Export。`puppeteer.launch` が失敗し `exportPdf()` の catch → `showErrorMessage('exportPdf()', error)` を error 付きで呼ぶ経路。確認: (1) **トーストが1つだけ**（`ERROR: exportPdf()`＋「Show Output」）で、**生エラーの2つ目トーストが出ない**こと（＝廃止の検証）、(2) 「Show Output」押下でチャネルが開き、`formatError` 整形済みのエラー詳細＋スタックが記録されていること。
  - 検証後は両設定を空に戻す。
- ボタン押下後の分岐は `selection === 'Show Output'` のみの自明な処理のため、専用のユニットテスト抽出はしない（YAGNI）。`logger.showLog()` 自体は要素③でユニットテスト済み。

## 採用済みデフォルト（レビューで異議があれば再検討）

- ボタンラベルは英語「Show Output」固定（ローカライズなし）。
- 警告（`logWarn`）にはトースト・動線を付けない（チャネルのみ）。サニタイズ警告通知は要素②a の責務。
- README/FAQ/CHANGELOG はリリース時一括更新（本ブランチでは触らない）。
