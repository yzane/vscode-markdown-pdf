# include コード領域スキャナの誤ペアリング修正 設計

- 対象 issue: [#443](https://github.com/yzane/vscode-markdown-pdf/issues/443)
- 対象 PR: [#444](https://github.com/yzane/vscode-markdown-pdf/pull/444)（作者: JasRockr）
- ブランチ: `bugfix/include-code-region-scan`（worktree: `.worktrees/include-code-region-scan/`）
- 対象ファイル: `src/markdown-it-include.ts`, `test/unit/markdown-it-include.test.ts`, `CHANGELOG.md`

## 1. 問題

`markdown-pdf.markdown-it-include.enable` はデフォルト `true` のため、include 記法を使っていない文書でも毎回のエクスポートで `findCodeRegions()` が走る。この関数がバックティックを誤ペアリングし、**文書の一部が二重に出力される**。二重化された側は生の Markdown ソースとして描画されるため、見出しや段落が途中で壊れる。

### 発火条件

同一段落内に**長さ 1 のバックティック run が奇数個**ある（＝閉じ相手のない単一バックティックが残る）状態で、その後にフェンスコードブロックが存在すること。

### メカニズム

`findCodeRegions()` は 2 パス構成である。

- Pass 1: 行頭の ``` / ~~~ からフェンス領域を収集
- Pass 2: フェンス領域外のインラインコードを収集

Pass 2 の閉じバックティック探索ループには 3 つの skip 分岐があり、そのうち「候補がフェンス領域内なら `searchFrom` をそのフェンスの `end` へ飛ばす」分岐が問題である。閉じ相手のない開きバックティックがこの分岐でフェンスを**飛び越え**、フェンスより後ろの無関係なバックティックを閉じ相手として採用してしまう。

結果、Pass 1 が記録済みのフェンス領域を**包含する**領域が Pass 2 で生成され、`regions` に重複が生じる。`replaceIncludes()` は `start` 昇順の領域を順に連結するが `pos` の巻き戻しを想定していないため、重なり部分を 2 回出力する。

```ts
for (const region of regions) {
  if (region.start > pos) { result += processIncludes(src.slice(pos, region.start), ...); }
  result += src.slice(region.start, region.end);
  pos = region.end;   // region.start < pos となる次の領域で二重出力が起きる
}
```

一度誤ペアリングすると `pos` が大きく飛び、以降のバックティックの対応が総崩れになって連鎖する。実測では奇数バックティック段落 2 件から重複領域 40 組に膨らんだ。

### 影響範囲

`findCodeRegions` は `2ef516d feat: replace markdown-it-include with custom implementation` で導入。含まれるタグは **2.0.0 / 2.0.1 / 2.1.0**。1.x は npm の `markdown-it-include` を使っていたため影響しない。

### 検証済みの事実

- `src/markdown-it-include.ts` は tag 2.1.0 と develop で完全同一。インストール済み `dist/extension.js` から関数を抽出して直接実行しても再現するため、**公開版に実在する**
- #443 添付の 82KB 文書: +21,488 文字の重複
- リポジトリ自身の `docs/superpowers/plans/20260420-01-math-support.md`（include 記法 0 件）: **+27,990 文字の重複**。フェンス 19 個が二重化し、`## Task 2: KaTeX CSS とフォントを ````bash` のように見出しにコード内容が食い込む
- `README.md` は奇数バックティック段落が 0 件のため発火しない。include フィクスチャ 3 件も全バックティックが閉じているため発火しない。これが長期間気づかれなかった理由である

## 2. なぜ既存テストで検出できなかったか

`test/integration/fixtures/include-codeblock.md` はフェンスとインラインコードの両方を持つが、**すべてのバックティックが閉じている**。「フェンスとインラインコードを保護する」という仕様は正しくテストされており、「バックティックが閉じていない場合」という観点が欠落していた。

## 3. 修正方針

PR #444 の方針を採用する。**コード span はフェンスも空行（段落境界）も越えられない**という CommonMark の性質を使い、閉じ探索をこの 2 つの境界で**打ち切る**。飛び越え対象として扱わない。

- Pass 1 の結果を `fenceRegions` として分離し、`fenceRegionAt()` で判定する
- 開きバックティックごとに `nextParagraphBreak()`（`/\r?\n[ \t]*\r?\n/`。CRLF 対応は後述）で段落終端を求め、閉じ探索をその範囲に限定する
- 閉じ候補は**長さが完全一致する run のみ**採用する。長さ違いの run は探索中のコード span の内容として読み飛ばし、新たな opener とは見なさない（CommonMark の backtick string 規則）
- 閉じが見つからなければ開き run をリテラル扱いにし、その直後から走査を再開する

これにより Pass 2 の領域が Pass 1 のフェンス領域を包含し得なくなり、領域重複が構造的に発生しなくなる。

旧コードにあった「行頭 3 連バックティックは fence 済みなのでスキップ」判定は削除する。Pass 1 は打ち切り時も `end = src.length` の領域を積むため行頭フェンスが未記録になるケースは無く、`fenceRegionAt(pos)` が代替できる。

### PR #444 自身の欠陥: CRLF の空行を検出できない

PR #444 の `nextParagraphBreak()` は `/\n[ \t]*\n/` を使うため、Windows の `\r\n\r\n` に一致しない。include ルールは markdown-it の `normalize`（`state.src` の改行を LF へ正規化する core rule）**より前**に走るため、CRLF がそのまま渡ってくる。本リポジトリは `core.autocrlf` が有効で、worktree の `README.md` は実際に CRLF になっている（LF 版 37,514 文字に対し CRLF 版 38,504 文字）ため、実害のある条件である。

CRLF 文書では段落制限が一切効かず（`nextParagraphBreak` が常に `src.length` を返す）、閉じ相手のないバックティックが後続段落のバックティックと対になる。実測:

```
入力: 'Stray ` backtick.\n\n:[a](part.md) and `code` here.'
[LF]   → "Stray ` backtick.\n\nINCLUDED and `code` here."   (展開される)
[CRLF] → 変化なし                                            (include が展開されない)
```

重複は起きない（フェンス境界で打ち切るため領域重複は発生しない）が、include 記法が保護領域に飲み込まれて**黙って展開されない**という別の不具合になる。`/\r?\n[ \t]*\r?\n/g` に修正する。

## 4. PR #444 への追補（本ブランチで実施）

PR #444 の実装には性能退行がある。`fenceRegionAt()` が**走査 1 文字ごとに `fenceRegions.find()` の線形探索**を行い、かつ非バックティック文字を `pos += 1` で 1 文字ずつ前進するため `O(文書長 × フェンス数)` になる。旧コードは `indexOf('`')` で一括して飛ばしていた。

実測:

| 文書 | 修正前 (develop) | PR #444 | 追補後の目標 |
|---|---|---|---|
| 82KB 実文書（フェンス少） | 0.88 ms | 1.30 ms | develop 同等 |
| 49KB / フェンス 500 | 1.1 ms | 14.0 ms | develop 同等 |
| 200KB / フェンス 2000 | 14.5 ms | 197.2 ms | develop 同等 |

4 倍の規模で 14 倍＝二次オーダー。82KB 実文書では 1.3ms なので実害は出ていないが、コードブロックが大量にある文書では悪化が顕在化する。

### 追補内容

1. **`fenceRegionAt()` を二分探索にする**。`fenceRegions` は Pass 1 の左→右単一パスで得られるため `start` 昇順かつ非重複であり、二分探索の前提を満たす。単調カーソル方式は採らない（外側ループの `pos` が内側ループの `searchPos` より戻る場合があり単調性が崩れるため）
2. **`searchLimit` を「段落境界」と「次のフェンス開始位置」の小さい方にクランプする**。`nextFenceStartFrom()` も `fenceRegions` に対する二分探索で求める
3. **1 文字前進を `indexOf('`')` に戻す**。外側ループは `src.indexOf('`', pos)`、内側ループは `searchLimit` で打ち切る

これにより**フェンス探索に起因する `O(n × m)`（n = 文書長, m = フェンス数）が解消**され、フェンス判定は開きバックティックごとの `O(log m)` に、文字走査は `indexOf` によるバックティック位置のみのホップになる。

スキャナ全体が `O(n log m)` になるわけではない。閉じ相手のないバックティック run が同一段落内に多数ある場合（長さの異なる run が並ぶなど）、各 run の閉じ探索が同じ範囲を繰り返し走査するため、段落内の run 数に対して二次的なコストが残る。これは PR #444 の構造に由来するもので本追補の対象外である。ただし探索範囲が段落とフェンスで打ち切られるため、修正前の「文書末尾まで無制限に探索する」挙動よりは大幅に改善している。

### `~~~` フェンスに関する注意（設計上の必須要件）

`indexOf('`')` へ戻す際、**内側ループで「候補バックティック位置がフェンス領域内か」を判定するだけでは不十分**である。`~~~` フェンスはバックティックを含まないため、`indexOf` がフェンス全体を飛び越え、候補位置はフェンス外になって判定を通過してしまう。結果として #443 と同じ領域重複が再発する。

実測（PR #444 のコードに素朴な `indexOf` 版を当てた場合）:

| ケース | 結果 |
|---|---|
| `~~~` が段落を中断（空行なし） | **delta=+22・重複再発** |
| `~~~` が空行の後 | delta=0（段落境界が偶然守る） |
| ```` ``` ```` が段落を中断 | delta=0（フェンス内にバックティックがあるため `indexOf` が内部に着地し判定が働く） |

再発時の出力: `"Text with stray \`backtick.\n~~~txt\nraw\n~~~\nLater \`~~~txt\nraw\n~~~\nLater \`ok\` here."`

空行が守るケースがあるため見落としやすい。CommonMark ではフェンスが段落を中断できるので、空行なしのケースは正当な Markdown である。

上記 2 の「`searchLimit` をフェンス開始位置でクランプする」方式ならフェンス種別に依存せず、内側ループから位置ごとのフェンス判定が完全に不要になる。この方式を採用する。

## 5. テスト方針

PR #444 が追加する `test/unit/markdown-it-include.test.ts`（7 ケース）をそのまま採用する。これは本バグの観点を正しく突いている。

| ケース | 観点 |
|---|---|
| 正当な `:[alt](path)` の展開 | 既存機能の維持 |
| 存在しない include 先のエラー表示 | 既存機能の維持 |
| インラインコード内の include 記法の保護 | 既存機能の維持 |
| フェンス内の include 記法の保護 | 既存機能の維持 |
| 1 段落内で複数行にまたがるコード span の保護 | 段落制限の副作用がないこと |
| 空行を越えたコード span は成立しない | 段落境界の扱い |
| **閉じないバックティックが後続フェンスを飲み込んで重複させない** | **本バグの回帰テスト** |

追補では **2 ケースを追加**する。いずれもレビュー指摘に対応するもので、`` ` `` フェンスだけでは検出できない観点である。実装より先に追加するが、役割と追加時点での期待結果が異なる。

| 追加ケース | 役割 | 観点 |
|---|---|---|
| CRLF 文書で段落境界が正しく効き、後続段落の include 記法が展開される | **RED テスト**（追加時点で失敗し、CRLF 修正で成功する） | `nextParagraphBreak()` の CRLF 対応 |
| `~~~` フェンスが段落を中断する位置にある場合に、閉じないバックティックがそれを飲み込んで重複させない | **characterization test**（追加時点で成功し、その挙動を固定する） | `indexOf` 最適化がフェンスを飛び越えないこと。`~~~` はバックティックを含まないため `` ``` `` のケースでは代替できない |

`~~~` ケースは PR #444 のコードでは既に正しく動く（内側ループが 1 文字ずつフェンス判定するため）。したがって RED から始まる TDD の対象ではなく、`indexOf` 最適化という**リファクタリングの安全網**として機能する。実効性はレビュー時に素朴な `indexOf` 版で実測確認済み（上表の `delta=+22`）。

二分探索化そのものは挙動を変えない内部最適化なので、専用テストは追加しない（上記＋既存 447 ケースで担保する）。

性能は回帰テストにしない（実行環境依存で不安定なため）。実装時に手元で計測して develop 同等であることを確認する。

### 検証コマンド

```
npx tsc --noEmit
npx tsx --test test/unit/markdown-it-include.test.ts
npx tsx --test "test/unit/**/*.test.ts"
```

期待:

- PR #444 マージ直後: **454 pass / 0 fail**（develop 447 + PR の新規 7）
- 追補完了後: **456 pass / 0 fail**（さらに `~~~` と CRLF の 2 ケースを追加）

## 6. 対象外

- リポジトリ自身の plan/spec 文書を include 有効で変換して入力一致を確認する e2e チェックの追加（ユーザー判断により不要）
- インデントされたフェンス（CommonMark では最大 3 スペースまで有効）が Pass 1 の `^` 起点正規表現に掛からない問題。本 PR の退行ではなく従来からの制約であり、別issueとする
- `markdown-pdf.markdown-it-include.enable` のデフォルト値変更

## 7. 取り込み手順（クレジット保持）

PR #444 の作者クレジットと PR の merged 表示を両立させるため、**コミット SHA を保持**する。

- PR head `94c8911` を `--no-ff` で本ブランチにマージする。cherry-pick / squash / rebase はしない（SHA が変わると GitHub が PR を merged と判定しない）
- その上に追補コミット（性能修正・CHANGELOG）を積む
- ローカルで `develop` へマージした時点では GitHub 上の PR は OPEN のまま。**後日 `origin/develop` へ push された時点**で `94c8911` がリモートの `develop` から到達可能になり、PR #444 が merged になる（push 手順は本 bugfix の対象外。リリース準備時に行われる）

issue #443 は自動クローズされない（GitHub が issue を自動クローズするのは default branch = `master` へのマージ時のみ）。リリース時の `develop` → `master` マージで閉じるか、手動でクローズする。

## 8. CHANGELOG

`docs/release-process.md` に文書化された規約に従い、**プレースホルダ見出し `## X.Y.Z (YYYY/MM/DD)`** を新設して `### Fixes` に 1 行追加する。

- [`docs/release-process.md:49`](../../release-process.md): ``docs: finalize x.x.x changelog entry` — replace the `X.Y.Z (YYYY/MM/DD)` placeholder in `CHANGELOG.md`.``
- [`docs/release-process.md:31`](../../release-process.md): リリース前チェックに ``CHANGELOG.md` has a `## x.x.x (YYYY/MM/DD)` entry with all placeholder text resolved.``
- `3f928a9 docs: finalize 2.1.0 changelog entry` が実際にこの運用

`## Unreleased` は CHANGELOG.md の履歴に一度も存在せず、規約にも無いため採用しない。

README の `### X.Y.Z` プレースホルダ（`What's New` / `Breaking Changes`）は追加しない。`AGENTS.md` の規定では `What's New` は v2 以降の**機能**、`Breaking Changes` は**仕様変更**が対象であり、バグ修正は対象外である。
