# エラー診断ログ整備 設計

## 背景・目的

issue で「変換に失敗した」という報告が複数上がっている（[#436](https://github.com/yzane/vscode-markdown-pdf/issues/436) browser 起動失敗 / [#435](https://github.com/yzane/vscode-markdown-pdf/issues/435) unknown issue / [#431](https://github.com/yzane/vscode-markdown-pdf/issues/431) File name does not get / [#412](https://github.com/yzane/vscode-markdown-pdf/issues/412) export does nothing / [#408](https://github.com/yzane/vscode-markdown-pdf/issues/408) ENOENT temp file / [#383](https://github.com/yzane/vscode-markdown-pdf/issues/383) not working 等）が、現状のエラー出力は情報が不足しており、メンテナが原因を追跡できていない。

ログ基盤（OutputChannel ロガー `fcc06f9`）と動線（エラートーストの「Show Output」ボタン）は整備済み。本 spec は、その基盤の上に流す **エラーメッセージの内容・コンテキスト・経緯** を整備し、「変換失敗」報告から原因を特定／大幅に絞り込める診断ログを実現する。

### 現状の課題

現在、全ての `catch` は `showErrorMessage('関数名()', error)` を呼ぶ統一構造（`extension.ts`）で、ログに残るのは **関数名 + スタックトレースのみ**。以下が一切残らない:

- 対象ファイル名 / 出力形式（pdf/html/png/jpeg）/ 出力先パス
- 使用した Chromium のパスと出所（システム / ダウンロード / ユーザー指定）
- 主要な設定値（executablePath, outputDirectory, sanitize, autoDownload 等）
- 環境スナップショット（OS・VS Code・拡張・Node・puppeteer-core・期待 Chrome build id）
- 正常系のトレース（いつ・何を・どの形式で変換開始したか）

加えて、`markdownPdf().1` 等の内部識別子や `File name does not get!`（#431）など不親切な文言があり、警告系（`No active Editor!` 等）はログに残らないため「なぜ変換が始まらなかったか」も追えない。

### 最優先ゴール

**ユーザーが出力チャネル（Markdown PDF）の内容を issue に貼れば、メンテナが原因を特定／大幅に絞り込める状態。**

ブランチ: `feature/error-diagnostics`（`develop` から分岐、`.worktrees/feature-error-diagnostics`）。

## スコープ

### やること

1. 新規 `src/diagnostics.ts`（vscode/os 非依存）に、環境／コンテキストの整形・パスマスキングの純粋関数を集約。
2. エクスポート開始時に「環境スナップショット + 変換コンテキスト」を `logInfo` で 1 ブロック出力（成功・失敗を問わず毎回）。
3. `showErrorMessage` を拡張（第3引数 `context`）し、重要な `catch` に段階固有のコンテキストを付与。
4. `resolveChromiumPath` の戻り値を `{ path, source }` に拡張し、Chromium の出所を診断に記録。
5. 診断コマンド `extension.markdown-pdf.diagnostics`（"Markdown PDF: Output Diagnostics"）を追加。
6. パスマスキング（`os.homedir()` → `~`）を診断出力の全パスに適用。
7. 文言改善: エラー文言の書き直し + 警告系（`No active Editor!` 等）の `logWarn` 化。
8. ユニットテスト（`test/unit/diagnostics.test.ts` 新規、`test/unit/chromium-resolver.test.ts` 更新）。

### やらないこと（対象外）

- 構造化ログ（JSON / key-value）出力。人間可読の issue 貼付を優先（YAGNI）。
- マスキングの ON/OFF 設定。デフォルト ON 固定（YAGNI、必要時に追加）。
- README / README.ja / CHANGELOG の更新。リリース準備時に他の未リリース要素とまとめて 1 回更新する。
- ログ基盤（`logger.ts`）自体の変更。基盤は完成済みで、本 spec は利用側のみ。
- 低レベルプローブ（`isExistsPath` / `isExistsDir` の `console.warn`）の変更。失敗が正常系でノイズのため据え置く。

## アーキテクチャ

### 設計原則: vscode 依存を `extension.ts` に閉じ込める（既存方針の踏襲）

`logger.ts` と同じく、診断の整形ロジックは vscode / os 非依存の純粋関数に保ち、実値の収集（`vscode.version`, `os.release()`, `process.platform` 等）だけを `extension.ts` に置く。これにより `diagnostics.ts` は `tsx --test`（実 VS Code 不要）で決定論的にユニットテストできる。`utils.ts` は既に 1000 行超のため、診断系は新規 `diagnostics.ts` に分離して肥大化を避ける。

### `src/diagnostics.ts`（新規・vscode/os 非依存）

```ts
// Environment snapshot. Values are collected by extension.ts (the only
// host-aware module) and passed in, keeping this module unit-testable.
export interface EnvironmentInfo {
  extensionVersion: string;
  vscodeVersion: string;
  platform: string;          // process.platform, e.g. 'win32'
  osRelease: string;         // os.release()
  arch: string;              // process.arch
  nodeVersion: string;       // process.version
  puppeteerCoreVersion: string;
  expectedChromeBuildId: string;
}

// How the Chromium executable was resolved.
export type ChromiumSource =
  | 'user-setting' | 'system' | 'latest' | 'cached' | 'bundled-fallback';

// Context for a single export invocation. Fields known up front are required;
// values resolved later in exportPdf() are optional and filled in as they
// become available, so the start block and error logs never show a stale path.
export interface ConvertContext {
  sourceFile: string;
  outputType: string;        // pdf/html/png/jpeg
  executablePath: string;    // configured value (may be empty)
  autoDownload: boolean;
  outputDirectory: string;   // configured value (may be empty)
  sanitize: string;
  outputPath?: string;             // filled after getOutputDir() in exportPdf
  resolvedChromiumPath?: string;   // filled in after Chromium resolution
  chromiumSource?: ChromiumSource; // filled in after Chromium resolution
}

// Replace a leading home-directory prefix with '~' (case-insensitive, so the
// Windows drive-letter casing C:\ vs c:\ is absorbed). Empty/unmatched input
// is returned unchanged.
export function maskHomePath(p: string, homeDir: string): string;

// Human-readable multi-line blocks (key: value), suitable for pasting into an issue.
export function buildEnvironmentBlock(env: EnvironmentInfo): string;
export function buildContextBlock(ctx: ConvertContext, homeDir: string): string;
export function buildStartDiagnostics(env: EnvironmentInfo, ctx: ConvertContext, homeDir: string): string;

// One-line context summary for error logs. The full block is already emitted at
// export start, so this only re-states which invocation failed
// (type / output / source / chromium) without re-dumping the whole block.
export function buildContextSummary(ctx: ConvertContext, homeDir: string): string;
```

ポイント:

- `diagnostics.ts` は `vscode` も `os` も import しない。`homeDir` は引数で受け取り、`os.homedir()` の呼び出しは `extension.ts` 側に置く（テストの決定論性）。
- 整形は人間可読の複数行（`key: value`）。issue にそのまま貼れる体裁にする。

### `src/extension.ts`（実値収集）

```ts
function collectEnvironment(): EnvironmentInfo {
  return {
    extensionVersion: extensionContext?.extension.packageJSON.version ?? 'unknown',
    vscodeVersion: vscode.version,
    platform: process.platform,
    osRelease: os.release(),
    arch: process.arch,
    nodeVersion: process.version,
    puppeteerCoreVersion: getPuppeteerCoreVersion(),
    expectedChromeBuildId: chromiumResolver.getExpectedBuildId(),
  };
}
```

- `puppeteer-core` の version 取得: `require('puppeteer-core/package.json').version`。esbuild バンドル時に解決可能か実装時に検証し、不可なら定数化やフォールバック（'unknown'）で対応する。
- `getExpectedBuildId()` は `chromium-resolver.ts` に既存。

## 診断ブロックの内容（出力例）

エクスポート開始時（`logInfo`、値はすべて例示）:

```
=== Markdown PDF Diagnostics ===
Extension: 2.1.0
VS Code: 1.110.0
OS: win32 10.0.26220 (x64)
Node: v20.18.0
puppeteer-core: 24.40.0
Expected Chrome build: 131.0.6778.204
--- Convert ---
Source: ~\docs\sample.md
Type: pdf
sanitize: gfm
executablePath: (not set)
chromium.autoDownload: true
outputDirectory: (not set)
```

`exportPdf` 内で出力先と Chromium が確定した後（`logInfo`。`Output` は `getOutputDir()` が `outputDirectory` を反映した実パス、`source` は解決経路）:

```
Output: ~\docs\sample.pdf
Chromium: ~\AppData\Roaming\Code\...\chrome.exe (source: latest)
```

エラー時（`logError`、`showErrorMessage` 経由。`LogOutputChannel` がタイムスタンプ／レベルを自動付与）:

```
exportPdf()
[type=pdf, source=~\docs\sample.md, output=~\docs\sample.pdf, chromium=system]
Error: Failed to launch the browser process ...
    <stack trace>
```

## データフロー

```
markdownPdf(type)
  env = collectEnvironment()
  ↓ types のループ各回
    ctx = ConvertContext を構築（source/type/設定。outputPath/chromium は未確定）
    logInfo(buildStartDiagnostics(env, ctx, homeDir))   ← 開始時の診断ブロック（毎回）
    convertMarkdownToHtml(filename, type, text, ctx, homeDir)
    makeHtml(data, uri, ctx, homeDir)
    exportPdf(data, filename, type, uri, ctx, homeDir)
      exportPdf 内: exportFilename = getOutputDir(filename, uri)
                    ctx.outputPath を補完 → logInfo('Output: ...')
                    resolveChromiumPath → resolution.{path, source}
                    ctx.resolvedChromiumPath / ctx.chromiumSource を補完 → logInfo('Chromium: ...')
  ↓ 失敗時（各 catch: convertMarkdownToHtml / makeHtml / exportPdf）
    showErrorMessage('<関数名>()', error, buildContextSummary(ctx, homeDir))
      logError(msg) / logError(context) / logError(formatError(error))
      トースト（ERROR: msg ＋ Show Output ボタン）
```

`ConvertContext` は `markdownPdf` で生成し、`convertMarkdownToHtml` / `makeHtml` / `exportPdf` のすべてに `homeDir` とともに引数で渡す（Finding 2）。これにより全段階の `catch` が同じ `ctx` で context 付きログを出せる。`outputPath` は `getOutputDir()` が `outputDirectory` を反映して決めるため `exportPdf` 内で確定し `ctx` に補完する（Finding 1）。早期段階（convert/makeHtml）のエラーは出力先非依存のため、`outputPath` 未確定（summary では `output=(unresolved)`）でも診断上の支障はない。

## 各要素の詳細設計

### 変換パイプラインへの ctx 受け渡し（Finding 1・2 対応）

`ConvertContext` と `homeDir` を変換パイプラインの全関数に渡し、各段階の `catch` が同じ `ctx` で context 付きログを出せるようにする。シグネチャは末尾に `ctx, homeDir` を加える形（既存引数は維持し、変更を最小化）:

- `convertMarkdownToHtml(filename, type, text, ctx, homeDir)`
- `makeHtml(data, uri, ctx, homeDir)`
- `exportPdf(data, filename, type, uri, ctx, homeDir)`

各関数の `catch` を `showErrorMessage('<関数名>()', error, buildContextSummary(ctx, homeDir))` に変更する。これで早期段階（convert/makeHtml）のエラーにも context が付く（**Finding 2**）。

**`outputPath` の確定タイミング（Finding 1）**: 実際の出力先は `exportPdf` 内の `getOutputDir(filename, uri)` が `markdown-pdf.outputDirectory` を反映して決める。`markdownPdf` 開始時の `filename` は元 md と同じディレクトリへの単純置換にすぎないため、これを出力先として診断に出すと誤提示になる。よって `ctx.outputPath` は開始時には確定させず、`exportPdf` 内で `getOutputDir()` 直後に補完し `logInfo('Output: ' + maskHomePath(...))` で出力する（`chromiumSource` と同じ「解決後に補完」パターン）。開始ブロックには `outputDirectory` 設定値のみ載せる。

`getOutputDir()` が `undefined`（`outputDirectory` 無効）を返したら、`exportPdf` 内で早期 `return Promise.resolve()` してその type を中止する。**現行コードは `exportFilename as string` のまま `exportHtml` / `page.pdf` に渡して続行してしまうため、この早期 return を新設する**（`getOutputDir` 内で `showErrorMessage` は実行済み）。開始診断ブロックは既に出力済みのため、「何をしようとして失敗したか」は残る。

### Chromium 出所（resolver 拡張）

```ts
export interface ChromiumResolution {
  path: string;
  source: ChromiumSource;
}
// resolveChromiumPath(...): Promise<ChromiumResolution | null>
```

`resolveChromiumPath` の各 return 箇所で `source` を付与する:

| 経路 | source |
|---|---|
| `findChromiumFromUserSetting` 成功 | `'user-setting'` |
| `findChromiumFromSystem` 成功 | `'system'` |
| `ensureChromiumDownloaded`（latest build, DL または既存キャッシュ）成功 | `'latest'` |
| `findLatestCachedChromium` 成功（autoDownload=false、または fetch 失敗時の cache） | `'cached'` |
| `ensureChromiumDownloaded`（bundled fallback build, DL または既存キャッシュ）成功 | `'bundled-fallback'` |

`'latest'` は「最新安定ビルド ID で解決した経路」を表す。`ensureChromiumDownloaded` は対象ビルドが既にキャッシュにあればダウンロードせずに返すため、`'latest'` / `'bundled-fallback'` は実ダウンロードと既存キャッシュを名前では区別しない（解決経路が分かれば診断には十分。厳密な download/cache 区別は YAGNI のため `ensureChromiumDownloaded` の戻り値は変更しない）。

呼び出し元の更新（2 箇所のみ。`init`→`checkPuppeteerBinary` は `findChromiumFrom*` を直接使い `resolveChromiumPath` を経由しないため影響なし）:

- `exportPdf`（`extension.ts:436`）: `resolvedExecPath`（string）→ `resolution`（object）。`if (!resolvedExecPath)` → `if (!resolution)`、`executablePath: resolution.path`、`ctx.resolvedChromiumPath = resolution.path` / `ctx.chromiumSource = resolution.source`。
- `installChromium`（`extension.ts:698`）: `if (executablePath)` → `if (resolution)`、成功ログに `resolution.source` を含めても良い。

戻り値の型が `string | null` → `ChromiumResolution | null` に変わるが、内部 API のため後方互換は不要（呼び出し元を同時更新する）。

### `showErrorMessage` 改修

```ts
function showErrorMessage(msg: string, error?: unknown, context?: string): void {
  logger.logError(msg);
  if (context) {
    logger.logError(context);
  }
  if (error) {
    logger.logError(logger.formatError(error));
  }
  vscode.window.showErrorMessage('ERROR: ' + msg, SHOW_OUTPUT_ACTION).then(function (selection) {
    if (selection === SHOW_OUTPUT_ACTION) {
      logger.showLog();
    }
  });
}
```

- `context` は任意。**トーストには出さない**（チャネルのみ）。トーストは従来どおり簡潔さを維持。
- コンテキストを付与する `catch`: `exportPdf` / `convertMarkdownToHtml` / `makeHtml`（前述のとおり `ctx` / `homeDir` を引数で受け取る）。`context` には `buildContextSummary(ctx, homeDir)`（1 行）を渡す。開始時に詳細ブロックが出ているため、エラー時は重複を避けて 1 行サマリに留める。それ以外（`getOutputDir` 等）は段階が関数名で分かるため任意。過剰には付けない。

### 診断コマンド

`package.json`:

- `contributes.commands` に `{ "command": "extension.markdown-pdf.diagnostics", "title": "Markdown PDF: Output Diagnostics", "group": "markdown-pdf" }`
- `activationEvents` に `"onCommand:extension.markdown-pdf.diagnostics"`
- `commandPalette`: `when` 制限を付けない（markdown を開いていなくても診断可能にする）
- `editor/context` メニューには **追加しない**（稀な操作）

`extension.ts`:

- `registerCommand` で実装。`collectEnvironment()` → `logInfo(buildEnvironmentBlock(env))` ＋ 現在の主要設定（executablePath / autoDownload / outputDirectory / sanitize / type）→ `logger.showLog()`。
- アクティブな markdown があればファイル名（マスク済み）も出す（任意）。

### パスマスキング

```ts
export function maskHomePath(p: string, homeDir: string): string {
  if (!p || !homeDir) {
    return p;
  }
  if (p.toLowerCase().startsWith(homeDir.toLowerCase())) {
    return '~' + p.slice(homeDir.length);
  }
  return p;
}
```

- 診断ブロック・コマンド出力の全パス（Source / Output / executablePath / Chromium / outputDirectory）に適用。
- 大小無視で Windows のドライブレター差（`C:\` vs `c:\`）を吸収。`~` 以降の区切りは元のセパレータを保持。

### 文言改善

| 現状 | 改善後 |
|---|---|
| `markdownPdf().1/2/3 Supported formats: html, pdf, png, jpeg.` | `Unsupported output format. Supported: html, pdf, png, jpeg.`（内部識別子 `.1/.2/.3` は context ログへ移す） |
| `File name does not get!`（#431） | `Cannot determine the file path. Virtual or remote workspaces (e.g. Azure DevOps) are not supported. Save the file to a local folder.` |
| `No active Editor!` | 文言維持 ＋ 直前に `logWarn` 追加 |
| `It is not a markdown mode!` | 文言維持 ＋ 直前に `logWarn` 追加 |
| `Please save the file!` | 文言維持 ＋ 直前に `logWarn` 追加 |
| `Chromium or Chrome does not exist! ...` | 維持（既にインストールリンクあり） |

警告系の `logWarn` 化: 早期 `return` の直前に `logWarn` を追加し、「なぜ変換が始まらなかったか」を経緯として残す。文言は英語統一（リポジトリ方針）。

## エラーハンドリング

- `diagnostics.ts` の関数は純粋関数で、空入力でも例外を投げず安全に文字列を返す。
- `collectEnvironment` は `extensionContext` が null でも `'unknown'` でフォールバック。
- `maskHomePath` は `homeDir` が空でも安全（そのまま返す）。
- `resolveChromiumPath` の null 分岐（取得失敗）は従来どおり維持。診断ブロックは開始時に既に出力済みなので、取得失敗時も「何をしようとしたか」はログに残る。

## テスト戦略

### ユニットテスト（tsx、実 VS Code 不要）

- `test/unit/diagnostics.test.ts`（新規）:
  - `maskHomePath`: homedir 先頭一致 / 大小違い / 未一致 / 空文字 / homeDir 空。
  - `buildEnvironmentBlock` / `buildContextBlock` / `buildContextSummary` / `buildStartDiagnostics`: 既知の `EnvironmentInfo` / `ConvertContext` から、主要キーの存在とマスク適用、未設定値が `(not set)` 表記になることを検証。`buildContextSummary` は 1 行であることも確認。
- `test/unit/chromium-resolver.test.ts`（更新）:
  - 各経路（user-setting / system / latest / cached / bundled-fallback）で `source` が正しいことを検証。
  - 既存テストの戻り値参照を `.path` に追随。

### 手動検証（dev host F5）

- 正常エクスポート: 開始時に診断ブロックが出力され、Chromium 解決後に `source` が出る。パスが `~` にマスクされている。
- `markdown-pdf.executablePath` に実在フォルダ（例 `C:\Windows`）を設定 → `exportPdf` 失敗 → エラーに context（`type` / `source` / `chromium`）が付く。
- 診断コマンド `Markdown PDF: Output Diagnostics` 実行 → 環境 + 現在設定がチャネルに出力され、チャネルが前面化する。
- 警告経路（`No active Editor!` 等）→ 文言とともに `logWarn` がチャネルに残る。

### 自動検証

- `npm run check`（型エラーなし）/ `npm run build`（esbuild バンドル成功）/ `npm run test:unit`。

## 採用済みデフォルト（レビューで異議があれば再検討）

- 診断ブロックは人間可読の複数行（`key: value`）。JSON にはしない。
- マスキングは `homedir` → `~` のみ。デフォルト ON、設定は設けない。
- 診断コマンドはコマンドパレットのみ（コンテキストメニュー非表示）。
- 警告（`logWarn`）にはトースト動線を付けない（エラーのみ「Show Output」動線）。
- README / CHANGELOG はリリース時に一括更新（本ブランチでは触らない）。
