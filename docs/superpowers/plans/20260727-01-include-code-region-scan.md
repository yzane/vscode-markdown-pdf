# include コード領域スキャナの誤ペアリング修正 実装プラン

- 設計: [`docs/superpowers/specs/20260727-01-include-code-region-scan-design.md`](../specs/20260727-01-include-code-region-scan-design.md)
- ブランチ: `bugfix/include-code-region-scan`（worktree: `.worktrees/include-code-region-scan/`。作業中は維持する）
- 対象 issue / PR: [#443](https://github.com/yzane/vscode-markdown-pdf/issues/443) / [#444](https://github.com/yzane/vscode-markdown-pdf/pull/444)

## 前提

- 作業はすべて `.worktrees/include-code-region-scan/` 配下で行う。ブランチを離れない
- `node_modules` は root へのジャンクション済み（`tsconfig` の `typeRoots` が `./node_modules/@types` 固定のため必須）
- コード内のコメントは英語、プラン / スペックは日本語（`AGENTS.md` 準拠）
- ベースライン: `npx tsx --test "test/unit/**/*.test.ts"` が **447 pass / 0 fail**（develop 時点）
- PR #444 の head は `pr-444-review`（= `94c8911`）としてローカルに fetch 済み

---

## Task 0: spec / plan をコミット

- [x] **Step 0-1: 2 ファイルを追加**

対象:

- Add: `docs/superpowers/specs/20260727-01-include-code-region-scan-design.md`
- Add: `docs/superpowers/plans/20260727-01-include-code-region-scan.md`

```
git add docs/superpowers/specs/20260727-01-include-code-region-scan-design.md docs/superpowers/plans/20260727-01-include-code-region-scan.md
git commit -m "docs: add include code-region scan fix plan"
```

---

## Task 1: PR #444 を SHA 保持でマージ

作者クレジットと PR の merged 判定を成立させるため、**cherry-pick / squash / rebase は使わない**。

- [x] **Step 1-1: マージ前確認**

`AGENTS.md` のマージ確認ルールに従い、実行前にユーザー承認を得る。

- [x] **Step 1-2: `--no-ff` でマージ**

```
git merge --no-ff pr-444-review -m "Merge PR #444 into bugfix/include-code-region-scan"
```

期待: コンフリクトなし（PR は現 develop の真上に作られている）。`git log --format='%an %s' -3` で `94c8911` の author が `JasRockr` のまま残ることを確認する。

- [x] **Step 1-3: マージ直後の検証**

```
npx tsc --noEmit
npx tsx --test "test/unit/**/*.test.ts"
```

期待: tsc クリーン、**454 pass / 0 fail**。

---

## Task 2: 性能追補（二分探索 + indexOf 復帰）

対象: `src/markdown-it-include.ts` の Pass 2。

現状の問題は `fenceRegionAt()` が走査 1 文字ごとに `fenceRegions.find()` の線形探索を行い、かつ非バックティック文字を 1 文字ずつ前進すること。`O(文書長 × フェンス数)` になっている。

- [x] **Step 2-1: 性能ベースラインを記録**

実装前に現状（PR #444 マージ後）の数値を控える。合成文書での計測手順は Task 4 に置く。

期待の記録値（既測値）: 49KB/フェンス500 で約 14ms、200KB/フェンス2000 で約 197ms。

- [x] **Step 2-2: テストを先に追加（CRLF: RED / `~~~`: GREEN）**

対象: `test/unit/markdown-it-include.test.ts`

2 件は役割が異なる。実装より先に追加するのは共通だが、追加時点での期待結果が違う。

| 追加ケース | 役割 | 追加時点での結果 |
|---|---|---|
| CRLF 文書で後続段落の include が展開される（`'Stray ` backtick.\r\n\r\n:[a](part.md) and `code` here.'`） | **RED テスト**。Step 2-8 の CRLF 修正で GREEN になる | **失敗する**（実測で `expanded=false` を確認済み） |
| `~~~` フェンスが段落を中断する位置にある（`'Text with stray `backtick.\n~~~txt\nraw\n~~~\nLater `ok` here.'`） | **characterization test**。リファクタリング前の正しい挙動を固定し、Step 2-6 / 2-7 の `indexOf` 最適化が退行を入れないことを保証する | **成功する**（PR #444 の内側ループは 1 文字ずつ `fenceRegionAt()` を判定するため、この時点では正しく動く） |

`~~~` ケースにガードとしての実効性があることは、レビュー時に素朴な `indexOf` 版で実測して確認済みである（`delta=+22`、再発時の出力は spec の「`~~~` フェンスに関する注意」に記載）。実装中に誤実装を一時的に当てて再確認する必要はない。

```
npx tsx --test test/unit/markdown-it-include.test.ts
```

期待: CRLF ケースのみ失敗（8 pass / 1 fail）。

- [x] **Step 2-3: `fenceRegionAt()` を二分探索にする**

`fenceRegions` は Pass 1 の左→右単一パスで得られるため `start` 昇順かつ非重複。この前提を関数のコメントに明記する。

```ts
// fenceRegions is sorted by start and non-overlapping (Pass 1 is a single
// left-to-right scan), so the containing region can be found by binary search.
// A monotonic cursor is not usable here: the outer loop's `pos` can move back
// behind the inner search's `searchPos`.
function fenceRegionAt(index: number): CodeRegion | undefined {
  let lo = 0;
  let hi = fenceRegions.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = fenceRegions[mid];
    if (index < r.start) { hi = mid - 1; }
    else if (index >= r.end) { lo = mid + 1; }
    else { return r; }
  }
  return undefined;
}
```

- [x] **Step 2-4: `nextFenceStartFrom()` を追加する**

`searchLimit` をフェンス開始位置でクランプするために必要。同じく二分探索で求める。

```ts
// Start offset of the first fence region beginning at or after `from`,
// or src.length when there is none.
function nextFenceStartFrom(from: number): number {
  let lo = 0;
  let hi = fenceRegions.length - 1;
  let best = src.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (fenceRegions[mid].start >= from) { best = fenceRegions[mid].start; hi = mid - 1; }
    else { lo = mid + 1; }
  }
  return best;
}
```

- [x] **Step 2-5: `searchLimit` をフェンス開始位置でクランプする**

```ts
// A code span can cross neither a paragraph break nor a fenced block, so the
// closer search stops at whichever comes first.
const searchLimit = Math.min(nextParagraphBreak(openEnd), nextFenceStartFrom(openEnd));
```

**これは必須要件である。** 候補バックティック位置に対する `fenceRegionAt()` 判定だけでは `~~~` フェンスを飛び越える（`~~~` はバックティックを含まないため `indexOf` がフェンス全体をスキップし、候補位置はフェンス外になって判定を通過する）。空行があるケースは段落境界が偶然守るため見落としやすい。CommonMark ではフェンスが段落を中断できるので、空行なしのケースは正当な Markdown である。詳細と実測は spec の「`~~~` フェンスに関する注意」を参照。

クランプ方式にすることで、内側ループから位置ごとのフェンス判定が完全に不要になる。Step 2-2 で追加した `~~~` ケースがこの要件のガードになる。

- [x] **Step 2-6: 外側ループの 1 文字前進を `indexOf` に戻す**

```ts
while (pos < src.length) {
  const fenceHere = fenceRegionAt(pos);
  if (fenceHere) { pos = fenceHere.end; continue; }

  const tickIdx = src.indexOf('`', pos);
  if (tickIdx === -1) break;
  // A fence can start between pos and tickIdx, so re-check at the tick.
  const fenceAtTick = fenceRegionAt(tickIdx);
  if (fenceAtTick) { pos = fenceAtTick.end; continue; }
  pos = tickIdx;
  ...
}
```

注意: `indexOf` で飛ばした区間にフェンスが含まれる可能性があるため、見つけた位置で再判定する。この再判定を省くと `pos` がフェンス内に入り込み、Pass 2 の領域がフェンス領域と重複し得る。

- [x] **Step 2-7: 内側ループの 1 文字前進を `indexOf` に戻す**

`searchLimit`（段落境界とフェンス開始位置の小さい方）で打ち切る。Step 2-5 のクランプにより、ループ内でのフェンス判定は不要になる。

```ts
let searchPos = openEnd;
let closeStart = -1;
while (searchPos < searchLimit) {
  const candidate = src.indexOf('`', searchPos);
  if (candidate === -1 || candidate >= searchLimit) break;
  let candEnd = candidate;
  while (candEnd < src.length && src[candEnd] === '`') candEnd++;
  if (candEnd - candidate === openLen) { closeStart = candidate; break; }
  searchPos = candEnd;
}
```

- [x] **Step 2-8: `nextParagraphBreak()` を CRLF 対応にする**

PR #444 自身の欠陥。`/\n[ \t]*\n/` は `\r\n\r\n` に一致しない。include ルールは markdown-it の `normalize` より前に走るため CRLF が素通しで渡ってくる。

```ts
const blankLineRe = /\r?\n[ \t]*\r?\n/g;
```

CRLF 文書では段落制限が一切効かず（常に `src.length` を返す）、閉じ相手のないバックティックが後続段落のバックティックと対になり、**include 記法が黙って展開されなくなる**。重複は起きないが別の不具合になる。

- [x] **Step 2-9: 検証（GREEN）**

```
npx tsc --noEmit
npx tsx --test "test/unit/**/*.test.ts"
```

期待: tsc クリーン、**456 pass / 0 fail**（PR マージ後 454 + 追加 2）。

- [x] **Step 2-10: コミット**

```
git add src/markdown-it-include.ts test/unit/markdown-it-include.test.ts
git commit -m "fix: bound include code-span search by fence and CRLF paragraph break"
```

`src/markdown-it-include.ts` を未コミットで残さないこと。残すと develop へのマージに含まれない。

---

## Task 3: CHANGELOG 追記

方針確定（2026-07-27・レビュー指摘 4 を採用）: **プレースホルダ見出し `## X.Y.Z (YYYY/MM/DD)`** を新設し、`### Fixes` に本修正を追記する。

`docs/release-process.md` に文書化された規約に従う。

- [`docs/release-process.md:49`](../../release-process.md): ``docs: finalize x.x.x changelog entry` — replace the `X.Y.Z (YYYY/MM/DD)` placeholder in `CHANGELOG.md`.``
- [`docs/release-process.md:31`](../../release-process.md): リリース前チェックに ``CHANGELOG.md` has a `## x.x.x (YYYY/MM/DD)` entry with all placeholder text resolved.``
- `3f928a9 docs: finalize 2.1.0 changelog entry` が実際にこの運用

`## Unreleased` は CHANGELOG.md の履歴に一度も存在せず規約にも無いため採用しない。

- [x] **Step 3-1: プレースホルダ見出しを新設して追記**

`# Change Log` の直後、`## 2.1.0 (2026/05/24)` の前に挿入する。既に他の未リリース変更で同見出しが存在する場合はそこへ追記するだけにする（実装時に確認する）。

```markdown
## X.Y.Z (YYYY/MM/DD)

### Fixes

* Fix: ...
```

`### Fixes` に入れる文面:

```markdown
* Fix: Documents containing an unmatched backtick before a fenced code block no longer have a chunk of content duplicated as raw Markdown in the export. The `markdown-it-include` code-region scanner could pair an opening backtick with a closing backtick on the far side of a fenced block, producing overlapping protected regions that were emitted twice. Affects 2.0.0 through 2.1.0; the include scan runs on every export because `markdown-pdf.markdown-it-include.enable` defaults to `true` [#443](https://github.com/yzane/vscode-markdown-pdf/issues/443) [#444](https://github.com/yzane/vscode-markdown-pdf/pull/444)
```

- [x] **Step 3-2: コミット**

```
git add CHANGELOG.md
git commit -m "docs: add changelog entry for include duplication fix"
```

---

## Task 4: 性能の実測確認

回帰テストにはしない（実行環境依存で不安定なため）。手元で 1 回計測し、develop 同等に戻ったことを確認する。

- [x] **Step 4-1: 計測**

一時スクリプトをスクラッチパッドに置き、`markdownItInclude` の core rule のみを呼んで合成文書 3 種（フェンス 50 / 500 / 2000）と実文書（`docs/superpowers/plans/20260420-01-math-support.md`）を通す。リポジトリには一時ファイルを残さない。

期待:

| 文書 | develop | PR #444 | 追補後 |
|---|---|---|---|
| 49KB / フェンス 500 | 1.1 ms | 14.0 ms | develop 同等 |
| 200KB / フェンス 2000 | 14.5 ms | 197.2 ms | develop 同等 |

- [x] **Step 4-2: 正しさの最終確認**

実文書で入力とバイト一致すること、および include フィクスチャ 3 件の展開結果が develop と一致することを確認する。

### 実測結果（2026-07-27）

`markdownItInclude` の core rule のみを minimal な ruler stub で呼び出した。測定対象は scanner 実装 `fe0aa14`、develop 比較は `1f312a7`。環境は Node.js v24.6.0、Windows_NT 10.0.26200 x64、AMD Ryzen 5 5600X（論理 CPU 12）である。このプランへの記録コミット（`09c1110` 以降）は、測定対象の本番コードを変更していない。

比較時は各 revision の `git show` 出力を revision 固有の module identity で個別コンパイルした。source SHA-256 は current `bd61847893e5920507986c0b8476e7415094cb0c99b35944bfb5aa3f63122a04`、develop `68bdda528dee63303c9a11e3cf7b6659f0f36e4aa80281c96eb2e7be968c71ad` で相違する。plugin 関数 identity が異なること、および計測前に current は実文書を保持する一方 develop は変更することも assert し、module cache による同一実装の二重読込を排除した。

合成文書は各セクションにインラインコード 1 個とバックティックフェンス 1 個を含め、25 回のウォームアップ後に計測した。

| フェンス数 | バイト数 | 計測回数 | 中央値 | 最小 | 最大 |
|---:|---:|---:|---:|---:|---:|
| 50 | 4,810 | 100 | 0.036 ms | 0.033 ms | 0.301 ms |
| 500 | 50,060 | 60 | 0.386 ms | 0.368 ms | 0.684 ms |
| 2,000 | 205,560 | 40 | 1.728 ms | 1.615 ms | 2.545 ms |

上表は主要計測の絶対値である。入力が 50,060 bytes から 205,560 bytes（約 4.1 倍）になると中央値は 0.386 ms から 1.728 ms（約 4.48 倍）となり、PR #444 で見られた二次関数的な増大は再発しなかった。

500 / 2,000 フェンスの主要計測値は PR #444 の履歴ベースライン（約 14 ms / 約 197 ms）を大きく下回った。ただし絶対時間は実行環境に依存し、履歴値は同一プロセス比較ではないため、そこから直接の高速化倍率は算出しない。

cache-safe な同一プロセス比較では、次のセクションを `i = 0..N-1` で連結した。1 セクションは `87 + 3 × digits(i)` bytes で、インラインコード 1 個とバックティックフェンス 1 個を含む。

````text
## Section {i}
Text with `inline-{i}` code & prose for scanning.

```js
const value = {i};
```

````

両 revision とも各サイズで 25 回ウォームアップ後に 100 回計測し、呼出順を交互にした。

| フェンス数 | バイト数 | current 中央値（最小–最大） | develop 中央値（最小–最大） | develop / current |
|---:|---:|---:|---:|---:|
| 500 | 47,670 | 0.385 ms（0.376–0.863） | 1.022 ms（0.991–1.822） | 2.65 倍 |
| 2,000 | 194,670 | 1.663 ms（1.608–2.780） | 14.533 ms（13.068–16.888） | 8.74 倍 |

入力増加は約 4.08 倍に対して current は約 4.32 倍、develop は約 14.22 倍に増えた。同一プロセスでは current が develop より速く、規模が大きいほど差が広がった。比率を含む絶対値は実行環境に依存する。

実文書も同じ core-rule-only ハーネスで 25 回ウォームアップ後に 100 回計測した。

| revision | 入力 bytes | 出力 bytes | 中央値 | 最小 | 最大 |
|---|---:|---:|---:|---:|---:|
| current (`fe0aa14`) | 67,102 | 67,102 | 0.217 ms | 0.188 ms | 0.804 ms |
| develop (`1f312a7`) | 67,102 | 97,549 | 0.325 ms | 0.279 ms | 2.146 ms |

develop は出力内容が異なるため、実文書の 2 行は同等ワークロードの性能比較には使用しない。

正しさの確認結果:

- `docs/superpowers/plans/20260420-01-math-support.md`: current の入力と出力がバイト一致（SHA-256: `70d841ce284f616f355157edf3382fa458cdc14085c2ff92f409cee245d52a04`）。develop 出力の SHA-256 は `20c240c2d91582ddf7bc611e4550a601a2c6fa15482eccfa8c392111fd5fb0b0`
- current と develop の core rule 出力がバイト一致: `include.md`（203 bytes、SHA-256: `e1b31fd0e55c10273dc09d12a88b3b6ce6ea46ab3acd6e27431eb7dbbcf25d5e`）、`include-missing.md`（214 bytes、SHA-256: `21dd972e2d1bf330b63a160c205340515db67300d7be841f25e320bc7e6655be`）、`include-codeblock.md`（367 bytes、SHA-256: `0e1ce072a24cd91dd10ff6fed68a8cad137aa1b8f75edb10654a2fd086ddab52`）
- `markdown-it-include` の対象 unit test は 9 pass / 0 fail（重複回帰、CRLF、チルダフェンスを含む）
- スクラッチを削除し、worktree がクリーンであることを確認

---

## Task 5: develop へマージ

- [ ] **Step 5-1: マージ前確認**

`AGENTS.md` のマージ確認ルールに従い、実行前にユーザー承認を得る。**承認を求める前に、メインツリーの状態を確認する。**

```
git -C C:/work/github/yzane/vscode-markdown-pdf rev-parse --abbrev-ref HEAD
git -C C:/work/github/yzane/vscode-markdown-pdf status --short
```

必須条件:

- ブランチが **`develop` であること**。別ブランチに切り替わっていた場合、そのブランチへ誤ってマージされる
- 作業ツリーが**クリーンであること**。現時点で `.vscode/settings.json` が modified のまま残っているため、マージ前に戻すか退避する必要がある

どちらかを満たさない場合はマージせず、ユーザーに状態を報告して指示を仰ぐ。

- [ ] **Step 5-2: マージ**

```
git -C C:/work/github/yzane/vscode-markdown-pdf merge --no-ff bugfix/include-code-region-scan
```

`94c8911` が develop から到達可能になるため、push 後に PR #444 が自動的に merged になる。

- [ ] **Step 5-3: 後片付け**

- worktree `.worktrees/include-code-region-scan` を削除
- 検証用 worktree `.worktrees/pr-444-review` とローカルブランチ `pr-444-review` を削除
- issue #443 は自動クローズされない（default branch が `master` のため）。リリース時の master マージで閉じるか手動クローズするかを判断する

---

## 未決事項

1. **issue #443 の返信** — 修正内容と影響バージョンを報告するか。返信する場合は生 Markdown をフェンスコードブロックで囲んで出力する
2. **PR #444 への返信** — 性能追補と 2 件の不具合（`~~~` フェンス飛び越えは追補側の設計課題、CRLF は PR 自身の欠陥）を修正した旨を伝えるか
3. **`.vscode/settings.json` の include 設定** — `false` は 1.x 時代の回避策で 2.0.0 以降は不要と実測確認済み。有効へ戻すかは本 bugfix のスコープ外（integration の `readme-previews` / `sample` が include 有効で通ることの確認が必要）
