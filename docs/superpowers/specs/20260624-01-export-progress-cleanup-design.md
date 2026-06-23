# Exporting 通知と一時 HTML 後処理の堅牢化 設計

## 背景・目的

GitHub Issue [#374](https://github.com/yzane/vscode-markdown-pdf/issues/374) では、PDF ファイル自体は生成されるにもかかわらず、`Exporting (pdf) ...` の通知が閉じず、さらに一時 HTML ファイルも削除されない問題が報告されている。同様の報告が複数あり、VS Code の notification が重なってエディタ領域を覆うため、ユーザー体験への影響が大きい。

現行実装では、`src/extension.ts` の `exportPdf()` が `vscode.window.withProgress({ location: Notification, ... }, async () => { ... })` を使って `Exporting (...) ...` を表示している。この通知は明示的に閉じる API を呼んでいるのではなく、`withProgress` の async callback が resolve した時点で VS Code により自然に終了する。したがって、callback 内の後処理が完了しない場合、通知も閉じない。

Issue の「PDF は生成済み」という観測から、`page.goto(..., { waitUntil: 'networkidle0' })` や `page.pdf()` は完了しており、その後の `browser.close()` または一時 HTML 削除前後で処理が止まっている可能性が高い。本設計では、PDF/画像生成後の後処理が無期限に `withProgress` を保持しないようにし、通知と一時 HTML cleanup の両方を堅牢化する。

## 現状の通知処理

### ポップアップ通知

- `Exporting (...) ...`
  - `vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: ... }, async () => { ... })` で表示される。
  - 表示終了は `withProgress` callback の完了に依存する。
  - 明示的に閉じる処理は存在しない。
  - callback 内の `await` が戻らない場合、通知が残り続ける。

- 単発の warning / information / error toast
  - `No active Editor!`、`Please save the file!`、include 失敗、sanitize 警告、highlight style fallback、Chromium install 開始/成功、エラー通知など。
  - ユーザーが閉じる通常通知であり、`withProgress` のように処理完了と連動して閉じる通知ではない。
  - 今回の #374 とは直接の対象にしない。

### ステータスバー通知

- `$(markdown) Converting (convertMarkdownToHtml) ...`
  - Markdown から HTML への変換中に表示される。
  - 現行実装では `statusbarmessage.dispose()` により消す。
  - catch 経路でも dispose されるため、今回の主対象ではない。

- `$(markdown) <exportFilename>`
  - HTML/PDF/PNG/JPEG の出力完了後に表示される。
  - `StatusbarMessageTimeout` 付きで表示されるため、一定時間後に消える。
  - 今回の主対象ではない。

- Chromium install 関連
  - `Installing Chromium ...` や進捗率をステータスバーに表示する。
  - インストール処理がハングした場合は残り続ける可能性があるが、export 後処理とは別経路であるため今回の対象外にする。

## 根本原因の仮説

現行の `exportPdf()` は、PDF/画像生成後に次の順序で後処理を行う。

```text
page.pdf() / page.screenshot()
  -> await browser.close()
  -> debug=false の場合に一時 HTML を削除
  -> status bar に出力ファイル名を表示
  -> withProgress callback 完了
```

この順序では、`browser.close()` が戻らない場合に以下が同時に発生する。

- `withProgress` callback が完了しないため、`Exporting (...) ...` 通知が閉じない。
- 一時 HTML 削除処理に到達しないため、`*_tmp.html` が残る。
- 後続の status bar 完了表示にも到達しない。

Issue の症状（PDF は生成されるが通知と一時 HTML が残る）と整合するため、本設計では `browser.close()` の完了待ちが後処理全体を止めないようにする。

## スコープ

### やること

- `exportPdf()` の PDF/PNG/JPEG 生成後処理を `finally` に移し、成功・失敗に関係なく一時 HTML 削除を試みる。
- `browser.close()` は通常どおり呼び出すが、`await` に短い待ち切りを設ける。
- 一時 HTML 削除は `browser.close()` の待ち切り後に行う。正常系では Chromium の file handle 解放後に削除できるよう、現行の「close 後に削除」という安全特性を維持する。
- 待ち切りに達した場合は OutputChannel に warning を記録し、エラー toast は出さず、`withProgress` callback を完了させる。
- 一時 HTML 削除に失敗した場合も OutputChannel に warning を記録し、export 成功自体を失敗扱いにしない。
- Chromium 解決失敗時にある既存のインライン一時 HTML 削除は削除し、一時 HTML cleanup を `finally` の一箇所に集約する。
- Chromium 解決失敗時も他の PDF/PNG/JPEG export 経路と同じく `debug` 設定に従い、`debug=true` の場合は調査用に一時 HTML を残す。
- 待ち切り helper は `src/utils.ts` に切り出して unit test できるようにする。

### やらないこと

- `Exporting (...) ...` 通知を直接閉じる処理は追加しない。`withProgress` callback が resolve できるようにすることで、VS Code の通常動作として閉じる。
- `page.goto(..., { waitUntil: 'networkidle0' })` 自体のタイムアウトは変更しない。これは PDF 生成前の読み込み待機に影響し、大きな文書、外部画像、Mermaid、PlantUML などの挙動に波及するため、別 spec で扱う。
- Chromium install の information toast / status bar 表示は変更しない。構造的には残り続ける可能性があるが、export 後処理とは別経路のため、別 issue / 別 spec 候補として記録する。
- `browser.close()` が待ち切りに達した場合の強制 kill は行わない。まずは通知と一時 HTML cleanup が無期限に詰まる状態を避けることを優先する。
- 強制 kill しないため、`browser.close()` 待ち切り時には Chromium プロセスや一時 user-data-dir が残る可能性がある。これは既知の制約として扱い、必要なら別 spec で `browser.process()?.kill()` などの後追い強制終了を検討する。
- README / CHANGELOG は今回触らない。ユーザー向け挙動の大きな新機能ではなく、既存動作の堅牢化として扱う。

## アーキテクチャ

### 変更対象

- `src/extension.ts`
  - `exportPdf()` の後処理順序を整理する。
  - `tmpfilename` と `browser` を `try` ブロック外から参照できるようにする。
  - `finally` で `browser.close()` と一時 HTML 削除を行う。
  - close 待ち切り時と削除失敗時に `logger.logWarn` で記録する。
  - Chromium 解決失敗分岐のインライン一時 HTML 削除を除去し、削除処理を `finally` に一本化する。
  - Chromium 解決失敗分岐でも `debug=true` の場合は一時 HTML を残す。

- `src/utils.ts`
  - Promise の完了を一定時間だけ待つ helper を追加する。
  - helper は VS Code / puppeteer に依存しない純粋な async utility とする。
  - helper は timeout 後に元 Promise が遅れて reject しても未処理 rejection を出さないよう、元 Promise を観測する。
  - helper は Promise が timeout 前に settle した場合も timeout に達した場合も、内部 timer を解放する。

- `test/unit/await-with-timeout.test.ts`
  - helper の成功ケース、期限前 reject、待ち切り、timeout 後の遅延 reject、timer 解放を unit test する。

### 推奨処理順

```text
tmpfilename を作成して exportHtml(data, tmpfilename)
browser = await puppeteer.launch(...)
page = await browser.newPage()
page.goto(...)
page.pdf() / page.screenshot()
status bar に出力ファイル名を表示
finally:
  browser があれば browser.close() を呼び、短時間だけ待つ
  close 待ち切り時は warning をログに残して先へ進む
  debug=false かつ tmpfilename があれば一時 HTML 削除を試みる
withProgress callback 完了
```

一時 HTML 削除を `browser.close()` の後に置く理由は、正常系で Chromium が `file://` の一時 HTML を参照している可能性を避け、現行実装と同じく close 完了後に削除する安全特性を維持するためである。一方で `browser.close()` には待ち切りを設けるため、close が戻らない場合でも削除処理には到達する。

`finally` 内では `browser.close()` と一時 HTML 削除をそれぞれ独立した `try/catch` で囲む。close の失敗や待ち切りが削除を妨げず、削除失敗も close 結果の記録を妨げないようにする。

### `browser.close()` 待ち切りの意味

ここで導入する待ち切りは、レンダリング処理全体のタイムアウトではなく、`browser.close()` の Promise 完了待ちに限定する。

- 影響する範囲: PDF/画像生成後の Chromium 終了処理のみ。
- 影響しない範囲: `page.goto()`、`page.pdf()`、`page.screenshot()`、生成される PDF/画像の内容。
- 待ち切り時の挙動:
  - OutputChannel に warning を記録する。
  - エラー toast は出さない。
  - export 自体を失敗扱いにしない。
  - `withProgress` callback を完了させ、VS Code に通知を閉じさせる。

待ち切り時間は短すぎると通常 close 中にも warning が出やすく、長すぎると #374 の体感改善が弱くなる。初期値は 5 秒を候補とする。これは実装 plan で定数化し、テストでは helper を直接検証する。

helper の契約は次の通りにする。

- 元 Promise が timeout 前に resolve した場合: `{ timedOut: false, value }` を返す。
- 元 Promise が timeout 前に reject した場合: reject を呼び出し元へ伝播する。
- timeout に達した場合: `{ timedOut: true }` を返す。
- timeout 後に元 Promise が遅れて reject した場合: 未処理 rejection を出さない。
- timeout 用 timer は resolve / reject / timeout のいずれでも解放する。

## エラーハンドリング

- `exportPdf()` 本体の既存 `catch` は維持し、変換・出力失敗時は従来どおり `reportError()` を使う。
- `finally` 内の一時 HTML 削除失敗は `logger.logWarn` のみとし、`reportError()` は呼ばない。
- `browser.close()` が reject した場合は `logger.logWarn` に `logger.formatError(error)` を含める。
- `browser.close()` が待ち切りに達した場合は、次の趣旨の warning を出す。

```text
Timed out while closing Chromium after export; continuing so the progress notification can finish.
```

- `withProgress` callback を完了させることを優先し、close 待ち切り時に例外を投げ直さない。
- `page.pdf()` / `page.screenshot()` が throw した場合も `finally` に入るため、現行実装では到達しない可能性がある `browser.close()` と一時 HTML cleanup を試みられる。これは #374 対応に伴う副次的な堅牢化である。

## テスト戦略

`exportPdf()` は VS Code API と puppeteer に強く依存しており、現状の `tsx --test` unit test から直接検証しにくい。そのため、自動テストでは待ち切り helper を unit test し、`exportPdf()` への組み込みは型チェック・ビルド・手動確認で検証する。

### 自動テスト

- `test/unit/await-with-timeout.test.ts`
  - Promise が timeout 前に resolve した場合、`{ timedOut: false, value }` を返す。
  - Promise が timeout 前に reject した場合、その reject を呼び出し元へ伝播する。
  - Promise が pending のまま timeout に達した場合、`{ timedOut: true }` を返す。
  - timeout 後に元 Promise が遅れて reject しても、未処理 rejection が発生しない。
  - timeout 前に settle した場合に timer が残って test runner を待たせない。

- 既存回帰確認
  - `npm run test:unit`
  - `npm run check`
  - `npm run build`

### 手動確認

開発用 VS Code Extension Host で、#374 に近い条件の Markdown を PDF export する。

- PDF が生成される。
- `Exporting (pdf) ...` notification が閉じる。
- `debug=false` のとき、一時 HTML が残らない。
- `debug=true` のとき、Chromium 解決失敗時も一時 HTML が残る。
- OutputChannel に不要な error toast 相当のログが出ない。
- `browser.close()` が通常完了する環境では、待ち切り warning が出ない。
- 通常ケースでは close 後に一時 HTML が削除される。

`browser.close()` の実ハングは環境依存で再現が難しいため、手動確認では「通常ケースを壊していないこと」を主に見る。待ち切り分岐は helper の unit test とコードレビューで担保する。

## 関連するが別途扱う課題

### `page.goto(..., waitUntil: 'networkidle0')` の無期限待機

`page.goto(..., { waitUntil: 'networkidle0' })` と `page.setDefaultTimeout(0)` の組み合わせは、外部リソースやページ内処理によって PDF 生成前に無期限待機する可能性がある。これは #412 のような「export しても何も起きない」系の issue に関係する可能性がある。

ただしこの領域にタイムアウトを入れると、大きな文書や遅い外部リソースを含む既存利用に影響する。#374 では PDF が生成済みと報告されているため、本設計では対象外とし、必要なら別 spec で待機条件やユーザー設定の有無から検討する。

### Chromium install 通知の残留

Chromium 自動インストールでは、information toast と status bar を併用している。ダウンロードや解決処理が無期限に待つ場合、status bar が残る可能性はあるが、export 後処理とは別経路である。今回の spec では対象外とする。

### warning toast の重複

include 失敗、highlight style fallback、sanitize 警告などは、複数形式 export 時に繰り返し表示される可能性がある。これは通知 UX の改善余地だが、#374 の「処理完了と連動する progress notification が閉じない」問題とは性質が違うため対象外とする。

### close 待ち切り後の Chromium プロセス残留

`browser.close()` が待ち切りに達した後も、Chromium プロセスが裏で残る可能性はある。本設計では強制 kill まで踏み込まず、progress notification と一時 HTML cleanup が無期限に詰まらないことを優先する。プロセス残留や一時 user-data-dir 残留の解消は、必要なら別 spec で検討する。

## 受け入れ条件

- PDF/PNG/JPEG export の後処理で、`browser.close()` の完了待ちが無期限に `withProgress` callback を保持しない。
- `debug=false` のとき、一時 HTML 削除は `browser.close()` の成否に依存しない。通常完了した場合は close 後に削除し、待ち切りに達した場合も削除処理へ進む。
- `debug=true` のとき、Chromium 解決失敗時も他経路と同じく一時 HTML を残す。
- `Exporting (...) ...` notification を直接閉じる処理は追加せず、callback 完了により自然に閉じる。
- `page.goto(..., waitUntil: 'networkidle0')` の挙動は変更しない。
- 待ち切り helper に、成功、期限前 reject、timeout、timeout 後の遅延 reject、timer 解放の unit test がある。
- `npm run test:unit`、`npm run check`、`npm run build` が成功する。

## Spec self-review

- プレースホルダーはない。
- #374 の観測症状（PDF 生成済み、通知残留、一時 HTML 残留）と設計対象が一致している。
- `browser.close()` 待ち切りと `page.goto()` タイムアウトの違いを明記している。
- 一時 HTML 削除を close 待ち切り後に置く理由と、close 前削除を避ける理由を明記している。
- cleanup 一本化に伴う Chromium 解決失敗時の `debug=true` 挙動変化を意図的な決定として明記している。
- 待ち切り helper の late reject と timer 解放を仕様・テスト対象に含めている。
- Chromium install 通知、warning toast 重複、`networkidle0` 全体タイムアウトは対象外として分離している。
