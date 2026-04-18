# Task 7 手動検証 実施記録 (2026-04-19, Remote-WSL)

> **この文書は Task 7 の実施記録（スナップショット）です。** 将来のリリースで再検証する場合は `docs/chromium-auto-download-manual-verification.md` の再利用可能な手順書を参照してください。関連プラン: `20260418-01-chromium-auto-download.md`、仕様書: `docs/superpowers/specs/20260418-01-chromium-auto-download-design.md` §7.3

## Context

`feature/chromium-auto-download` ブランチの実装（Task 1〜6）が完了し、仕様書 7.3 節の 5 シナリオを実環境で確認する Task 7 が残っている。作業は git worktree `/home/z/dev/github/vscode-markdown-pdf/.worktrees/chromium-auto-download/` で行っている。

検証環境は **Windows + Remote-WSL（WSL2 Linux）** 構成。WSL 内で `code` コマンドを叩くと Windows 側 VS Code Desktop に接続し、WSL 内で `vscode-server` が起動し、拡張はそこで動く。

## 環境上の重要な制約（シナリオ 1 の実測で判明）

- **`--user-data-dir` は Remote-WSL では効かない**: Windows 側 VS Code Desktop のプロファイルにしか作用せず、拡張が動く WSL 側 `vscode-server` の `context.globalStorageUri` には伝搬しない。
- **キャッシュの実パスは固定**: `~/.vscode-server/data/User/globalStorage/yzane.markdown-pdf/` 配下。プロファイル隔離はできないので、シナリオ間のリセットはこのディレクトリを `rm -rf` で行う。
- **`--disable-extensions` + `--extensionDevelopmentPath` は効く**: Marketplace 版拡張は無効化され、ワークツリーの dev 版のみロードされる。設定ファイル（settings.json）は共有される点に注意。

## 現在のデバッグログ（マージ前に revert する）

`src/chromium-resolver.ts::resolveChromiumPath` に **どの分岐が選ばれたかを Console に出力する `[Markdown PDF][resolve] <branch> → <path>` ログ** を追加済み（`user-setting` / `system` / `autoDownload=false, cached` / `downloaded latest` / `cached fallback`）。マージ前に revert が必要。

---

## セットアップ

```bash
cd /home/z/dev/github/vscode-markdown-pdf/.worktrees/chromium-auto-download
npm run build   # dist/extension.js を更新

# 実パス変数（各シェルで export）
export MDPDF_STORAGE="$HOME/.vscode-server/data/User/globalStorage/yzane.markdown-pdf"
export MDPDF_CACHE="$MDPDF_STORAGE/chrome"
```

### EDH 起動

```bash
code --extensionDevelopmentPath="$(pwd)" --disable-extensions README.md
```

起動後に **Help > Toggle Developer Tools** を開いて Console タブを常時監視する（フィルタ: `[Markdown PDF]`）。

### 共通診断

```bash
# 拡張が書き込んだ全ファイル
find "$MDPDF_STORAGE" -maxdepth 4 -print 2>/dev/null

# Chromium 実行ファイルが存在するか
ls "$MDPDF_CACHE"/linux-*/chrome-linux64/chrome 2>/dev/null

# 変換中に puppeteer が起動したバイナリ
ps auxww | grep -iE 'chrom|puppeteer' | grep -v grep
```

---

## シナリオ別手順

### シナリオ 1: クリーン環境で初回起動 → 最新 Chromium DL — **[OK] 確認済み（2026-04-19）**

- Console: `[Markdown PDF][fetch] GET ... → 200 → resolved latest buildId 147.0.7727.57` → `[Markdown PDF][ensure] installing ...` → `[Markdown PDF][resolve] downloaded latest (147.0.7727.57) → ...chrome-linux64/chrome`
- バンドル版 `146.0.7680.153` より新しい `147.0.7727.57` が DL 確認
- 「Installing Chromium ...」通知も表示確認済み
- 以後のシナリオはこのキャッシュを前提に進める

### シナリオ 2: キャッシュあり → JSON のみ取得、DL なし

**前提:** シナリオ 1 のキャッシュ（`linux-147.0.7727.57/`）が残っている。

**実行:**
1. EDH はそのまま（起動し直してもよい）。Dev Tools の **Network タブ** を開き、Filter に `googlechromelabs` を入れる
2. コマンドパレット → `Markdown PDF: Export (pdf)` を再実行

**期待:**
- Console に `[Markdown PDF][resolve] downloaded latest (147.0.7727.57) → ...` が出る（= 既存キャッシュを `PB.computeExecutablePath` で解決し、DL は起きない）
- Network タブで `last-known-good-versions.json` への GET は **1 回のみ**（メモ化で 2 回目以降は 0 回）
- `storage.googleapis.com` への Chrome バイナリ GET が発生しない
- `ls "$MDPDF_CACHE"` の内容が変わらない
- 変換は成功

### シナリオ 3: オフライン → 既存キャッシュで動作

**前提:** シナリオ 1 のキャッシュが残っている。メモ化をリセットするため EDH を一度終了する。

**オフライン化（いずれか）:**
- 方法 A: `sudo iptables -A OUTPUT -d googlechromelabs.github.io -j REJECT`（`storage.googleapis.com` も同様）
- 方法 B: Wi-Fi / 有線 LAN 切断
- 方法 C: `/etc/hosts` に `127.0.0.1 googlechromelabs.github.io` を追加

**実行:** EDH 再起動 → `Markdown PDF: Export (pdf)`

**期待:**
- 変換が **成功**（キャッシュ済み Chromium を使用）
- Console に `[Markdown PDF] Failed to fetch latest Chromium version: ...` warning
- Console に `[Markdown PDF] Falling back to cached Chromium build`
- Console に `[Markdown PDF][resolve] cached fallback → ...chrome-linux64/chrome`

**後片付け:**
```bash
# iptables の場合:
sudo iptables -D OUTPUT -d googlechromelabs.github.io -j REJECT
# /etc/hosts を触った場合は該当行を削除
```

### シナリオ 4: `autoDownload=false` + キャッシュなし + システムブラウザなし

**重要な順序:** キャッシュ削除を `autoDownload=false` 設定より先に行うと、EDH 起動時に `init()` が自動 DL を走らせてシナリオが成立しない。必ず以下の順序で実施する。

**手順:**

1. **（EDH 起動中に）設定を先に入れる**
   - コマンドパレット → `Preferences: Open User Settings (JSON)`
   - 追加:
     ```json
     {
       "markdown-pdf.chromium.autoDownload": false
     }
     ```
   - 保存
   - **注意**: この settings.json は WSL 側の user profile と共有される。シナリオ 4/5 の終了後に `autoDownload` 行を削除するか `true` に戻すこと

2. **EDH を完全に終了する**
   - VS Code ウィンドウを閉じる（`vscode-server` のプロセスも落ちるのを `ps -ef | grep vscode-server` 等で確認すると確実）

3. **キャッシュ削除 & システムブラウザ不在確認**
   ```bash
   rm -rf "$MDPDF_STORAGE"   # キャッシュ全消し

   which google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable 2>/dev/null
   ls /opt/google/chrome/chrome /opt/microsoft/msedge/msedge /usr/bin/chromium* /usr/bin/microsoft-edge* 2>/dev/null
   # すべて出力なしであること
   ```

4. **EDH 再起動** → `Markdown PDF: Export (pdf)` 実行

**期待:**
- Console に `[Markdown PDF][resolve] autoDownload=false, cached → null`
- VS Code の通知に以下のエラーメッセージが表示される（`src/extension.ts:363-369` の `showErrorMessage`）:
  > Chromium not found. Automatic download is disabled (markdown-pdf.chromium.autoDownload = false). Install Google Chrome / Chromium / Microsoft Edge, set markdown-pdf.executablePath, or enable markdown-pdf.chromium.autoDownload. See https://github.com/yzane/vscode-markdown-pdf#install

### シナリオ 5: `autoDownload=false` + システムブラウザあり

**前提:** シナリオ 4 の `autoDownload: false` 設定を維持。キャッシュは引き続きなし。

**システムブラウザ用意:**
```bash
which chromium || which chromium-browser || which microsoft-edge
# どれもなければインストール:
#   sudo apt install chromium-browser
# （Snap 版が /snap/bin/chromium にしかない場合、findChromiumFromSystem の候補に含まれないので注意。
#   候補パスは src/chromium-resolver.ts:66-72 参照。Linux では以下のみ:
#     /usr/bin/chromium-browser, /usr/bin/chromium, /usr/bin/microsoft-edge, /usr/bin/microsoft-edge-stable
#   加えて PB.computeSystemExecutablePath が /opt/google/chrome/chrome などを発見する）
```

**実行:** `Markdown PDF: Export (pdf)`

**期待:**
- Console に `[Markdown PDF][resolve] system → /usr/bin/chromium-browser`（または該当パス）
- 変換が **成功**
- `ls "$MDPDF_CACHE"` は空または存在しない（DL は起きない）
- 変換中の `ps auxww | grep -i chrom` でそのシステムバイナリが起動していることを確認

**後片付け:**
- `settings.json` の `markdown-pdf.chromium.autoDownload: false` 行を削除

---

## 検証記録フォーマット

| シナリオ | 判定 | 備考 |
|---------|------|------|
| 1 | **[OK]** | 147.0.7727.57 DL、バンドル 146 より新しい。`fetch GET/200` → `ensure installing` → `resolve downloaded latest` |
| 2 | **[OK]** | `fetch memoized buildId` + `ensure cache hit` で DL なし（同一 EDH セッション） |
| 3 | **[OK]** | オフライン化: 方法C（`/etc/hosts` に `127.0.0.1 googlechromelabs.github.io`）。`fetch failed` → `resolve cached fallback` に落ちて変換成功 |
| 4 | **[OK]** | `resolve autoDownload=false, cached → null` ログ + コード `extension.ts:363-369` のエラー通知を確認 |
| 5 | **[OK]** | `resolve system → /usr/bin/chromium-browser` で DL なし・システムブラウザ使用 |

NG の場合は Console ログ（特に `[Markdown PDF][resolve]` 行）と期待との差分を記録する。

## すべて OK 後の最終手順

1. **デバッグログを revert** し、`src/chromium-resolver.ts` を Task 6 時点に戻す:
   - 現在追加されている `[Markdown PDF][resolve] ...` ログをすべて削除
   - `git diff src/chromium-resolver.ts` でクリーンな状態を確認
2. `npm run check && npm run test:unit && npm run build` で回帰なし確認
3. Task 7 完了をマーク
4. `develop` への `--no-ff` マージ確認に進む

## 後片付け

検証完了後:
```bash
# キャッシュ全消し（必要なら）
rm -rf "$MDPDF_STORAGE"

# iptables / /etc/hosts を触っていた場合は元に戻す

# settings.json から markdown-pdf.chromium.autoDownload を削除
```

## 参考ファイル（コード変更なし・参照のみ）

- `src/extension.ts:23-37` — `getExtensionCacheDir()`
- `src/extension.ts:39-46` — `getAutoDownload()`
- `src/extension.ts:360-374` — `autoDownload=false` 時のエラーメッセージ
- `src/chromium-resolver.ts:29-51` — `findChromiumFromSystem`（`PB.computeSystemExecutablePath` + 候補パス）
- `src/chromium-resolver.ts:66-72` — Linux のシステムブラウザ候補パス
- `src/chromium-resolver.ts:316-363` — `resolveChromiumPath` のフォールバックチェーン（現状デバッグログ混入）
- `docs/superpowers/specs/20260418-01-chromium-auto-download-design.md` §6.1, §7.3 — エラーシナリオ表と手動検証項目
