# Chromium 自動ダウンロード機能 手動検証手順

## この文書について

Markdown PDF 拡張の「Chromium 自動ダウンロード」機能（`markdown-pdf.chromium.autoDownload`）を、新しいリリース候補やリグレッションの疑いがあるときに手動で再検証するためのランブックです。CI には載せていないので、リリース前チェックとして実施してください。

- 仕様書: `docs/superpowers/specs/20260418-01-chromium-auto-download-design.md` §7.3
- 導入時の実施記録: `docs/superpowers/plans/20260418-01-chromium-auto-download-task7-record.md`

検証は 5 シナリオ:

1. クリーン環境で初回起動 → 最新 Chromium を DL
2. キャッシュあり → JSON のみ取得、DL なし
3. オフライン → 既存キャッシュで動作
4. `autoDownload=false` + キャッシュなし + システムブラウザなし → エラー通知
5. `autoDownload=false` + システムブラウザあり → システムブラウザを使用

## 環境前提と注意点

### Remote-WSL / Windows VS Code Desktop

- **`--user-data-dir` は Remote-WSL では効かない**: Windows 側 VS Code Desktop のプロファイルにしか作用せず、拡張が動く WSL 側 `vscode-server` の `context.globalStorageUri` には伝搬しません。
- **キャッシュの実パスは固定**: WSL 側では `~/.vscode-server/data/User/globalStorage/<publisher>.<name>/` 配下。プロファイル隔離はできないので、シナリオ間のリセットはこのディレクトリを `rm -rf` で行います。
- **`--disable-extensions` + `--extensionDevelopmentPath` は効く**: Marketplace 版拡張は無効化され、指定したパスの dev 版のみロードされます。ただし `settings.json` は共有されるので、シナリオ 4/5 で入れた `autoDownload: false` 行は終わったら必ず削除してください。

### macOS / Linux Desktop

上記のパスを以下に読み替えてください。

- macOS: `~/Library/Application Support/Code/User/globalStorage/<publisher>.<name>/`
- Linux Desktop: `~/.config/Code/User/globalStorage/<publisher>.<name>/`

## セットアップ

```bash
# 拡張のソースディレクトリに移動して dist を更新
cd <repo>
npm run build

# ストレージ / キャッシュのパスを環境変数で固定（以下は Remote-WSL の例）
export MDPDF_STORAGE="$HOME/.vscode-server/data/User/globalStorage/yzane.markdown-pdf"
export MDPDF_CACHE="$MDPDF_STORAGE/chrome"
```

### Extension Development Host 起動

```bash
code --extensionDevelopmentPath="$(pwd)" --disable-extensions README.md
```

起動後、**Help > Toggle Developer Tools** → Console タブを常時監視。Filter に `[Markdown PDF]` を入れると関連ログだけが見えます。

### 共通診断

```bash
# 拡張が書き込んだ全ファイル
find "$MDPDF_STORAGE" -maxdepth 4 -print 2>/dev/null

# Chromium 実行ファイルが存在するか
ls "$MDPDF_CACHE"/linux-*/chrome-linux64/chrome 2>/dev/null

# 変換中に puppeteer が起動したバイナリ
ps auxww | grep -iE 'chrom|puppeteer' | grep -v grep
```

### （任意）分岐トレース用の一時ログ

`src/chromium-resolver.ts` に `[Markdown PDF][resolve] <branch> → <path>` のような分岐ログを一時的に埋め込むと、どのフォールバック分岐が選ばれたかが Console で追えて便利です。検証が終わったら必ず revert してください。コードの該当箇所は `resolveChromiumPath` / `ensureChromiumDownloaded` / `fetchLatestStableBuildId` / `defaultJsonFetcher`。

---

## シナリオ別手順

### シナリオ 1: クリーン環境で初回起動 → 最新 Chromium DL

**前提リセット:**
```bash
rm -rf "$MDPDF_STORAGE"
```

**実行:** EDH 起動 → `Markdown PDF: Export (pdf)`

**期待:**
- 「Installing Chromium ...」通知が表示される
- Console に JSON fetch ログ → install ログ → resolve downloaded latest の順に出る
- `ls "$MDPDF_CACHE"/linux-*/chrome-linux64/chrome` に実行ファイルが作成される
- バンドル版 (`puppeteer-core` が持っている buildId) より新しい buildId になっていること（＝最新 Stable を取得している証拠）
- 変換は成功

### シナリオ 2: キャッシュあり → JSON のみ取得、DL なし

**前提:** シナリオ 1 のキャッシュが残っている。

**実行:** EDH はそのまま（同一セッションでも再起動後でも可）→ `Markdown PDF: Export (pdf)`

**期待:**
- 同一 EDH セッションなら fetch は memoized で 0 回、EDH 再起動後なら `googlechromelabs.github.io/.../last-known-good-versions.json` への GET が 1 回だけ
- `storage.googleapis.com` への Chrome バイナリ GET は発生しない（＝ DL なし）
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

**後片付け:**
```bash
# iptables の場合:
sudo iptables -D OUTPUT -d googlechromelabs.github.io -j REJECT
# /etc/hosts を触った場合は該当行を削除
```

### シナリオ 4: `autoDownload=false` + キャッシュなし + システムブラウザなし

**重要な順序:** キャッシュ削除を `autoDownload=false` 設定より先に行うと、EDH 起動時に `init()` が自動 DL を走らせてシナリオが成立しません。必ず以下の順序で実施してください。

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
   - **注意**: `settings.json` は user profile と共有されるので、シナリオ 4/5 の終了後に `autoDownload` 行を削除するか `true` に戻すこと

2. **EDH を完全に終了する**
   - VS Code ウィンドウを閉じる（Remote-WSL なら `vscode-server` のプロセスも落ちるのを `ps -ef | grep vscode-server` で確認すると確実）

3. **キャッシュ削除 & システムブラウザ不在確認**
   ```bash
   rm -rf "$MDPDF_STORAGE"

   which google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable 2>/dev/null
   ls /opt/google/chrome/chrome /opt/microsoft/msedge/msedge /usr/bin/chromium* /usr/bin/microsoft-edge* 2>/dev/null
   # すべて出力なしであること
   ```

4. **EDH 再起動** → `Markdown PDF: Export (pdf)` 実行

**期待:**
- VS Code の通知に以下のエラーメッセージが表示される（`src/extension.ts` の `showErrorMessage`）:
  > Chromium not found. Automatic download is disabled (markdown-pdf.chromium.autoDownload = false). Install Google Chrome / Chromium / Microsoft Edge, set markdown-pdf.executablePath, or enable markdown-pdf.chromium.autoDownload. See https://github.com/yzane/vscode-markdown-pdf#install

### シナリオ 5: `autoDownload=false` + システムブラウザあり

**前提:** シナリオ 4 の `autoDownload: false` 設定を維持。キャッシュは引き続きなし。

**システムブラウザ用意:**
```bash
which chromium || which chromium-browser || which microsoft-edge
# どれもなければインストール（例）:
#   sudo apt install chromium-browser
```

- **候補パスに注意**: Snap 版 (`/snap/bin/chromium`) は `findChromiumFromSystem` の候補に含まれないので、`/usr/bin/` 配下に実体がある状態にしてください。
- Linux の候補パス（参考）: `/usr/bin/chromium-browser`, `/usr/bin/chromium`, `/usr/bin/microsoft-edge`, `/usr/bin/microsoft-edge-stable`
- 加えて `PB.computeSystemExecutablePath` が `/opt/google/chrome/chrome` などを発見します。

**実行:** `Markdown PDF: Export (pdf)`

**期待:**
- 変換が **成功**
- `ls "$MDPDF_CACHE"` は空または存在しない（DL は起きない）
- 変換中の `ps auxww | grep -i chrom` でシステムバイナリが起動していることを確認

**後片付け:**
- `settings.json` の `markdown-pdf.chromium.autoDownload: false` 行を削除

---

## 検証記録テンプレート

実施時は本テンプレートをコピーして `docs/superpowers/plans/YYYYMMDD-NN-<topic>-manual-verification-record.md` などに記録してください。

| シナリオ | 判定 | 備考 |
|---------|------|------|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |

NG の場合は Console ログ（特に分岐トレースログ）と期待との差分を記録してください。

## 後片付け

検証完了後:
```bash
# キャッシュ全消し（必要なら）
rm -rf "$MDPDF_STORAGE"

# iptables / /etc/hosts を触っていた場合は元に戻す

# settings.json から markdown-pdf.chromium.autoDownload を削除
```

## 参考ファイル

- `src/extension.ts` — `getExtensionCacheDir()`, `getAutoDownload()`, `autoDownload=false` 時のエラーメッセージ
- `src/chromium-resolver.ts` — `findChromiumFromSystem`, Linux のシステムブラウザ候補パス, `resolveChromiumPath` のフォールバックチェーン
- `docs/superpowers/specs/20260418-01-chromium-auto-download-design.md` §6.1, §7.3 — エラーシナリオ表と手動検証項目
