# エラーログの AI 原因調査向け診断性 調査・改善設計

## 背景・目的

直近で 2 つのエラー対応強化が `develop` にマージ済み（未リリース）:

- **feature/error-diagnostics**（マージ `f863802` / 設計 [`20260621-03-error-diagnostics-design.md`](20260621-03-error-diagnostics-design.md)）— `src/diagnostics.ts` 新設、エクスポート開始時の「環境スナップショット + 変換コンテキスト」出力、Chromium 解決元（source）のログ化、診断コマンド `Output Diagnostics` 追加、パスマスキング。
- **feature/error-message-hints**（マージ `9500ff9` / 設計 [`20260622-01-error-message-hints-design.md`](20260622-01-error-message-hints-design.md)）— エラートーストに対処ヒント＋アクションボタン＋`Show Details`。

本ドキュメントは、これらの強化を踏まえ **「ユーザーがエラー発生時に出力チャネルのログをそのまま AI（または issue）に渡して原因調査できるか」** という観点で現状を評価し、改善方針を示す。実装は本ドキュメントでは行わない（評価・設計のみ）。

3 部構成:

- **① 現状エラー発生時に出力されるログがどのようなものか**（事実・サンプル）
- **② 調査に必要な情報が出力されているか**（評価）
- **③ 改善のためにできること**（提案・優先度）

---

## ① 現状エラー発生時に出力されるログ

### 出力先

`vscode.window.createOutputChannel('Markdown PDF', { log: true })`（[`src/extension.ts:91`](../../../src/extension.ts)）で生成される **LogOutputChannel**。`{ log: true }` のため、各 `logInfo` / `logWarn` / `logError` 呼び出しの先頭に **タイムスタンプ＋レベル**（例 `2026-06-23 10:15:30.001 [info]`）が自動付与される。ユーザーはトーストの **`Show Details`** ボタン、またはコマンド **`Markdown PDF: Output Diagnostics`** からこのチャネルを開ける。

### ログ出力ポイント一覧

| タイミング | レベル | 関数 | 内容 |
|---|---|---|---|
| エクスポート開始（type ごと） | info | `markdownPdf()` [`extension.ts:183`](../../../src/extension.ts) | `buildStartDiagnostics`：環境ブロック ＋ 変換コンテキストブロック |
| 出力先確定後 | info | `exportPdf()` [`extension.ts:508`](../../../src/extension.ts) | `Output: <マスク済み出力パス>` |
| Chromium 解決後 | info | `exportPdf()` [`extension.ts:568`](../../../src/extension.ts) | `Chromium: <マスク済みパス> (source: <出所>)` |
| ダイアログ自動 dismiss | warn | `exportPdf()` [`extension.ts:577`](../../../src/extension.ts) | レンダリング中のブロッキングダイアログを破棄した旨 |
| 各種ガード | warn | `markdownPdf()` [`extension.ts:127-149`](../../../src/extension.ts) | エディタなし / markdown でない / 未保存 / パス解決不可 |
| 例外発生時 | error | `reportError()` [`extension.ts:886`](../../../src/extension.ts) | `operation` / `where` / `context` / `Hint: …` / `formatError(error)` を**各行に分けて** `logError`（存在する項目のみ、最大 5 行） |

### `reportError` の構造（エラー時の中核）

[`src/extension.ts:886-921`](../../../src/extension.ts)（引数は `ErrorReport` interface [`extension.ts:864`](../../../src/extension.ts)）。出力チャネルへは **存在する項目を 1 つずつ別々の `logError` で**出力する（`{ log: true }` のため各行が個別のタイムスタンプ＋`[error]` を持つ）。出力順は:

1. `operation` … 失敗の説明（トーストにも出る人間可読文。例: exportPdf 経路は `Failed to export pdf.`（`'Failed to export ' + type + '.'`）、markdownPdf 等の上位 catch は `Markdown PDF: export failed. The file was not generated.`（`EXPORT_FAILED_MSG`））— **常に出力**
2. `where` … 失敗した関数（`convertMarkdownToHtml()` / `makeHtml()` / `exportPdf()` / `getOutputDir()` 等）— あれば
3. `context` … `buildContextSummary`（`type=… , source=… , output=… , chromium=…`）— あれば
4. `Hint: <hint>` … `classify: true` かつ `classifyError` がヒントを返したとき — あれば
5. `formatError(error)` … `error` があるときのみ（フルスタックトレース）

> 注: 「1 行サマリ `operation [where] (context)`」のような **連結 1 行ではない**。各項目は独立した `[error]` 行になる（`operation` を最初に出すのは、`error` を持たない経路でも `Show Details` の貼り付けが意味を持つようにするため）。

`formatError`（[`src/logger.ts:55`](../../../src/logger.ts)）は `error.stack` をそのまま返す（無ければ `name: message`、非 Error は `String()`）。

トースト側は `ERROR: <operation>`（`classify` 時は ` — <hint>` を付加）＋ ボタン（アクションがあれば `[<action.label>, Show Details]`、無ければ `[Show Details]`）。**生の `error.message` はトーストに出さず、ログのみ**に記録する。

### `classifyError` のヒント分類

[`src/diagnostics.ts:129-166`](../../../src/diagnostics.ts)。コード優先（locale 非依存）＋メッセージ部分一致のフォールバックで分類:

| 条件 | ヒント | アクション |
|---|---|---|
| `Failed to launch the browser process` / `Could not find Chrome` | Chromium を起動できない。パス設定 or 自動DL有効化 | 設定 `markdown-pdf.executablePath` |
| `EBUSY` / `EPERM` / `EACCES` | 出力ファイルがロック / 権限不足 | （なし） |
| `ENOSPC` | ディスク空き不足 | （なし） |
| `ENOENT` / `EISDIR` | 出力パス不正 | 設定 `markdown-pdf.outputDirectory` |
| それ以外 | （ヒントなし。operation ＋ `Show Details` のみ） | （なし） |

### 実ログサンプル（コードから再構成）

**サンプル A — Chromium 起動失敗（最頻出）**

```
2026-06-23 10:15:30.001 [info] === Markdown PDF Diagnostics ===
Extension: 1.5.0
VS Code: 1.95.0
OS: win32 10.0.26100 (x64)
Node: v20.18.1
puppeteer-core: 23.11.1
Expected Chrome build: 131.0.6778.204
--- Convert ---
Source: ~\docs\sample.md
Type: pdf
sanitize: gfm
executablePath: (not set)
chromium.autoDownload: true
outputDirectory: (not set)
2026-06-23 10:15:30.045 [info] Output: ~\docs\sample.pdf
2026-06-23 10:15:31.230 [info] Chromium: ~\.cache\puppeteer\chrome\win64-131.0.6778.204\chrome.exe (source: cached)
2026-06-23 10:15:31.450 [error] Failed to export pdf.
2026-06-23 10:15:31.450 [error] exportPdf()
2026-06-23 10:15:31.451 [error] type=pdf, source=~\docs\sample.md, output=~\docs\sample.pdf, chromium=cached
2026-06-23 10:15:31.451 [error] Hint: Chromium could not be started. Set a valid Chromium path or enable auto-download.
2026-06-23 10:15:31.452 [error] Error: Failed to launch the browser process!
spawn C:\Users\me\.cache\puppeteer\chrome\win64-131.0.6778.204\chrome.exe ENOENT
TROUBLESHOOTING: https://pptr.dev/troubleshooting
    at ChildProcess.onClose (.../puppeteer-core/.../BrowserRunner.js:299:20)
    at ChildProcess.emit (node:events:519:28)
```

**サンプル B — 出力ファイルがロック（PDF を開いたまま再変換 / EBUSY）**

```
2026-06-23 10:20:11.300 [error] Failed to export pdf.
2026-06-23 10:20:11.300 [error] exportPdf()
2026-06-23 10:20:11.301 [error] type=pdf, source=~\docs\sample.md, output=~\docs\sample.pdf, chromium=cached
2026-06-23 10:20:11.301 [error] Hint: Cannot write the output file. Close it if it is open in another app, then check write permission.
2026-06-23 10:20:11.302 [error] Error: EBUSY: resource busy or locked, open 'C:\...\sample.pdf'
    at Object.writeFileSync (node:fs:2342:20)
    at writeFile (.../src/utils.ts:NN:NN)
```

**サンプル C — autoDownload 無効（`error` を持たない経路）**

```
2026-06-23 10:25:02.110 [error] Chromium not found. Automatic download is disabled (markdown-pdf.chromium.autoDownload = false). Install Google Chrome / Chromium / Microsoft Edge, set markdown-pdf.executablePath, or enable markdown-pdf.chromium.autoDownload. See https://github.com/yzane/vscode-markdown-pdf#chromium
2026-06-23 10:25:02.110 [error] exportPdf()
```

→ この経路（[`extension.ts:536`](../../../src/extension.ts)）は `error`・`context`・`classify` を渡さないため、ログは `operation` と `where` の 2 行のみで **スタックトレース行・`Hint:` 行は出ない**。トーストは `ERROR: <operation>` ＋ ボタン `[Open Settings, Show Details]` で設定へ誘導する設計（文言は `AUTO_DOWNLOAD_DISABLED_MSG` [`extension.ts:859`](../../../src/extension.ts)）。

**サンプル D — 手動診断コマンド `Output Diagnostics`**

```
2026-06-23 10:30:00.000 [info] === Markdown PDF Diagnostics ===
Extension: 1.5.0
VS Code: 1.95.0
OS: win32 10.0.26100 (x64)
Node: v20.18.1
puppeteer-core: 23.11.1
Expected Chrome build: 131.0.6778.204
2026-06-23 10:30:00.001 [info] --- Settings ---
type: "pdf"
sanitize: gfm
executablePath: (not set)
chromium.autoDownload: true
outputDirectory: (not set)
```

→ 環境ブロック ＋ `--- Settings ---`（`type` / `sanitize` / `executablePath` / `chromium.autoDownload` / `outputDirectory`）を 2 つの `logInfo` で出力してチャネルを表示する。変換コンテキスト（`Source:` 等）や個別エラーは含まない。[`extension.ts:70`](../../../src/extension.ts)。

---

## ② 調査に必要な情報は足りているか（評価）

### 充足している項目

| 観点 | 状態 | 根拠 |
|---|---|---|
| 拡張 / VS Code / OS / arch / Node バージョン | ✅ | `buildEnvironmentBlock` [`diagnostics.ts:60`](../../../src/diagnostics.ts) |
| puppeteer-core 版・期待 Chrome build id | ✅ | バージョン不整合の特定に有効 |
| Chromium の解決元(source)と実パス | ✅ | `cached`/`system`/`user-setting`/`latest`/`bundled-fallback` を区別 [`extension.ts:568`](../../../src/extension.ts) |
| 失敗した段階(where) | ✅ | convert / makeHtml / exportPdf / getOutputDir を区別 |
| 入出力パス・主要設定（4 項目） | ✅ | `buildContextBlock` [`diagnostics.ts:72`](../../../src/diagnostics.ts) |
| フルスタックトレース | ✅ | `formatError` が `error.stack` を丸ごと |
| 個人情報マスク | ✅ | `maskHomePath` でホーム配下を `~` 化 |

骨格（環境・段階・スタックトレース）は揃っており、**大半のエラーはこのログをそのまま AI / issue に貼れば原因に到達できる**水準。

### 不足・弱い項目

| # | 項目 | 状態 | 内容 |
|---|---|---|---|
| 1 | `error.cause` / `AggregateError` 未展開 | ❌ | `formatError`（[`logger.ts:55`](../../../src/logger.ts)）は最上位 `error.stack` のみ。puppeteer / ネットワーク系は **真因が `cause` にネスト**することがあり、そこが切れる。最も影響が大きい穴。 |
| 2 | ログのコピー導線が弱い | △ | `Show Details` でチャネルは開くが、その先は **手動選択コピー**。AI に渡す前提のワンクリック導線がない。 |
| 3 | コンテキストの設定網羅性 | △ | 出るのは `sanitize` / `executablePath` / `autoDownload` / `outputDirectory` の 4 項目のみ。`format` / `margin` / `headerTemplate` / `footerTemplate` / `scale` / `mermaidServer` / `plantumlServer` / `breaks` 等、失敗に絡む設定が出ない。 |
| 4 | 複数回実行時の相関 | △ | invocation 区切り / 連番がない。タイムスタンプで追えるが、連続実行時にどのエラーがどの開始ブロックに対応するか判別しにくい。 |
| 5 | 早期ガード時に環境ブロックが出ない | △ | エディタなし等のガードは `logWarn` のみで環境ブロックを伴わない（自明なエラーのため実害は小、`Output Diagnostics` で手動取得は可能）。 |

### AI 調査観点での総合評価

- **「貼れば概ね分かる」状態には到達している。** 環境・設定・失敗段階・スタックトレースという、AI が原因を推定するための主要素は揃っている。
- 残る弱点は **(1) `cause` チェーン欠落**（真因が隠れるケースがある）と **(2) コピー導線**（ユーザーが「全部を漏れなく渡す」のが難しい）。この 2 つが「AI が一発で当てられるか」を最も左右する。
- (3) 設定網羅性は、`headerTemplate` の不正 HTML や `mermaidServer` / `plantumlServer` 接続失敗など、特定カテゴリの調査時に効く。

---

## ③ 改善のためにできること（提案・優先度）

各案は「対象 / 内容 / 効果 / コスト・リスク」を併記する。本ドキュメントでは実装しない。着手時は本リポジトリの方針（`docs/superpowers/` に spec → plan を作成してから）に従う。

### 優先度: 高（低コスト・高効果）

#### H-1. `formatError` を `error.cause` 連鎖 / `AggregateError` 対応にする

- **対象**: [`src/logger.ts:55`](../../../src/logger.ts) `formatError`。
- **内容**: 最上位の `stack` に加え、`error.cause` を再帰的に辿って `Caused by:` として連結し、`AggregateError.errors` も列挙する。循環参照と深さ上限（例: 5 段）をガード。
- **効果**: puppeteer 起動失敗やネットワーク系で **真因が `cause` に入るケースを取りこぼさない**。②-1 を解消。AI が根本原因に到達できる確率が最も上がる。
- **コスト・リスク**: 小。純粋関数の局所改修。`logger.ts` は vscode 非依存なので `test/unit` で決定論的にテスト可能。

#### H-2. 診断のワンクリックコピー導線を追加

- **対象**: `reportError`（[`extension.ts:886`](../../../src/extension.ts)）のトーストボタン、および `Output Diagnostics` コマンド（[`extension.ts:70`](../../../src/extension.ts)）。
- **前提（重要）**: `LogOutputChannel` は **過去に出力したログ本文を読み戻す API を持たない**。したがって「チャネルから直近ログを取得してコピー」は実装できない。**自前で直近診断スナップショットをメモリ保持する**設計を前提にする。
- **内容**: モジュールスコープに「最新の `EnvironmentInfo` ＋ 最新の `ConvertContext`（マスキング適用済み）＋ 最後のエラー（`formatError`、cause 込み）」を保持し、`Copy Diagnostics` 実行時にそれらを 1 つの文字列へ整形して `vscode.env.clipboard.writeText` でコピーする。トーストに `Copy Details` ボタンを追加、または診断コマンドにコピー版を用意。
- **効果**: 「AI / issue に渡す」用途を一級の導線にする。②-2・②-4・②-5 を実質的に解消（手動選択コピーの取りこぼし・相関の問題を回避）。
- **コスト・リスク**: 中。スナップショット保持の状態管理が増える。保持するのは整形済み（マスキング適用済み）文字列に限り、生パス・生エラーを残さない。`H-1` を先に入れると「最後のエラー」に cause が含まれ効果が高い。

### 優先度: 中

#### M-1. コンテキストブロックの設定項目を拡充（既定値からの差分のみ）

- **対象**: `buildContextBlock`（[`diagnostics.ts:72`](../../../src/diagnostics.ts)）と呼び出し元の `ConvertContext` 構築（[`extension.ts:175`](../../../src/extension.ts)）。
- **内容**: `format` / `orientation` / `margin` 有無 / `displayHeaderFooter` / `headerTemplate`・`footerTemplate` の有無 / `scale` / `mermaidServer` / `plantumlServer` / `breaks` / `emoji` 等を追加。冗長化を避けるため **「既定値から変更されている項目だけ」** 出力する方針を推奨。
- **効果**: ②-3 を解消。`headerTemplate` 不正 HTML、`mermaid` / `plantuml` サーバ接続失敗など、特定カテゴリのエラー調査が一気に進む。
- **コスト・リスク**: 中。項目が多く、既定値判定のロジックが必要。出し過ぎるとノイズになるため「差分のみ」が要。

#### M-2. `classifyError` に Linux 共有ライブラリ不足ルールを追加

- **対象**: `classifyError`（[`diagnostics.ts:129`](../../../src/diagnostics.ts)）。
- **内容**: `error while loading shared libraries` / `cannot open shared object file`（例 `libnss3.so`）を検出し、依存パッケージのインストール手順（puppeteer troubleshooting）へのリンクを提示するルールを追加。
- **効果**: Linux / WSL / コンテナ環境での「browser 起動失敗」報告（[#436](https://github.com/yzane/vscode-markdown-pdf/issues/436) 系）に直接効く。
- **コスト・リスク**: 小。ルール 1 件追加 ＋ テスト。ブラウザ起動失敗ルール（既存 #1）より前に置くか、ヒント文を分岐する。

### 優先度: 低

#### L-1. invocation 区切り・連番

- **対象**: エクスポート開始ログ（[`extension.ts:183`](../../../src/extension.ts)）。
- **内容**: 開始ブロックの前に区切り線＋連番（例 `--- export #3 ---`）を入れ、連続実行時の相関を明確化。
- **効果**: ②-4 の補助。ただし LogOutputChannel のタイムスタンプで概ね追えるため優先度は低い。H-2（コピー導線で対象 invocation を限定）を入れるなら不要になる可能性が高い。
- **コスト・リスク**: 小。

### やらないこと（対象外）

- 構造化ログ（JSON）出力 — 既存方針どおり「人間可読の issue 貼付」を優先（YAGNI）。
- ログのテレメトリ送信・外部送出 — プライバシー方針上スコープ外。手元でのコピー導線（H-2）に留める。
- レンダリング失敗時のソース行特定 — 投資対効果が低く過剰（YAGNI）。

---

## 推奨着手順

1. **H-1（`cause` 展開）** … 単独で安全・高効果。まずこれ。
2. **H-2（コピー導線）** … 「AI に渡す」目的に直結。H-1 の出力を取り込む形にすると効果的。
3. 余力で **M-2 → M-1**。

H-1・H-2 はいずれも小さく安全に入る。着手する場合は spec → plan を作成してから実装する。

---

## 参考: 関連ファイル・コミット

- ログ基盤: [`src/logger.ts`](../../../src/logger.ts)（`formatError` / `LogSink`）
- 診断整形: [`src/diagnostics.ts`](../../../src/diagnostics.ts)（`buildEnvironmentBlock` / `buildContextBlock` / `buildContextSummary` / `classifyError` / `maskHomePath`）
- 利用側: [`src/extension.ts`](../../../src/extension.ts)（`reportError` / `outputDiagnostics` / `markdownPdf` / `exportPdf`）
- ユニットテスト: [`test/unit/diagnostics.test.ts`](../../../test/unit/diagnostics.test.ts)
- 関連設計: [`20260613-01-output-channel-logger-design.md`](20260613-01-output-channel-logger-design.md) / [`20260621-03-error-diagnostics-design.md`](20260621-03-error-diagnostics-design.md) / [`20260622-01-error-message-hints-design.md`](20260622-01-error-message-hints-design.md)
- 関連コミット: `f863802`（error-diagnostics マージ）/ `9500ff9`（error-message-hints マージ）
