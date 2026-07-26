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

- [ ] **Step 0-1: 2 ファイルを追加**

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

- [ ] **Step 1-1: マージ前確認**

`AGENTS.md` のマージ確認ルールに従い、実行前にユーザー承認を得る。

- [ ] **Step 1-2: `--no-ff` でマージ**

```
git merge --no-ff pr-444-review -m "Merge PR #444 into bugfix/include-code-region-scan"
```

期待: コンフリクトなし（PR は現 develop の真上に作られている）。`git log --format='%an %s' -3` で `94c8911` の author が `JasRockr` のまま残ることを確認する。

- [ ] **Step 1-3: マージ直後の検証**

```
npx tsc --noEmit
npx tsx --test "test/unit/**/*.test.ts"
```

期待: tsc クリーン、**454 pass / 0 fail**。

---

## Task 2: 性能追補（二分探索 + indexOf 復帰）

対象: `src/markdown-it-include.ts` の Pass 2。

現状の問題は `fenceRegionAt()` が走査 1 文字ごとに `fenceRegions.find()` の線形探索を行い、かつ非バックティック文字を 1 文字ずつ前進すること。`O(文書長 × フェンス数)` になっている。

- [ ] **Step 2-1: 性能ベースラインを記録**

実装前に現状（PR #444 マージ後）の数値を控える。合成文書での計測手順は Task 4 に置く。

期待の記録値（既測値）: 49KB/フェンス500 で約 14ms、200KB/フェンス2000 で約 197ms。

- [ ] **Step 2-2: `fenceRegionAt()` を二分探索にする**

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

- [ ] **Step 2-3: 外側ループの 1 文字前進を `indexOf` に戻す**

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

注意: `indexOf` で飛ばした区間にフェンスが含まれる可能性があるため、見つけた位置で再判定する。この再判定を省くと `pos` がフェンス内に入り込み、Pass 2 の領域がフェンス領域と重複し得る（本バグの再発）。

- [ ] **Step 2-4: 内側ループの 1 文字前進を `indexOf` に戻す**

`searchLimit`（段落境界）で打ち切る。

```ts
let searchPos = openEnd;
let closeStart = -1;
while (searchPos < searchLimit) {
  const candidate = src.indexOf('`', searchPos);
  if (candidate === -1 || candidate >= searchLimit) break;
  const fenceAhead = fenceRegionAt(candidate);
  if (fenceAhead) break;   // a code span can never cross a fence
  let candEnd = candidate;
  while (candEnd < src.length && src[candEnd] === '`') candEnd++;
  if (candEnd - candidate === openLen) { closeStart = candidate; break; }
  searchPos = candEnd;
}
```

注意: `fenceRegionAt` の判定位置は「候補バックティック」でなければならない。飛ばした空白側で判定するとフェンス直前で誤って break する。

- [ ] **Step 2-5: 検証**

```
npx tsc --noEmit
npx tsx --test "test/unit/**/*.test.ts"
```

期待: tsc クリーン、**454 pass / 0 fail**（挙動を変えない内部最適化なので新規テストは追加しない）。

---

## Task 3: CHANGELOG 追記

方針確定（2026-07-27）: **`## Unreleased` 節を新設**し、`### Fixes` に本修正を追記する。

現 `CHANGELOG.md` の先頭は `## 2.1.0 (2026/05/24)`（リリース済み）で `Unreleased` 節は無い。develop に積まれている他の未リリース変更（サニタイズ除去、エラー診断ログ、error-message-hints、AI 診断性改善）は CHANGELOG 未追記のままなので、新設する `Unreleased` 節の内容は本修正のみで**不完全な状態**になる。リリース時に節をバージョン見出しへ改名し、他の未リリース項目を追加する運用になる点を `AGENTS.md` の Release Notes 節と `docs/release-process.md` の記述と突き合わせ、齟齬があれば別途整理する（本 bugfix のスコープ外）。

- [ ] **Step 3-1: `## Unreleased` 節を新設して追記**

`# Change Log` の直後、`## 2.1.0 (2026/05/24)` の前に挿入する。

```markdown
## Unreleased

### Fixes

* Fix: ...
```

`### Fixes` に入れる文面:

```markdown
* Fix: Documents containing an unmatched backtick before a fenced code block no longer have a chunk of content duplicated as raw Markdown in the export. The `markdown-it-include` code-region scanner could pair an opening backtick with a closing backtick on the far side of a fenced block, producing overlapping protected regions that were emitted twice. Affects 2.0.0 through 2.1.0; the include scan runs on every export because `markdown-pdf.markdown-it-include.enable` defaults to `true` [#443](https://github.com/yzane/vscode-markdown-pdf/issues/443) [#444](https://github.com/yzane/vscode-markdown-pdf/pull/444)
```

- [ ] **Step 3-2: コミット**

```
git add CHANGELOG.md
git commit -m "docs: add changelog entry for include duplication fix"
```

---

## Task 4: 性能の実測確認

回帰テストにはしない（実行環境依存で不安定なため）。手元で 1 回計測し、develop 同等に戻ったことを確認する。

- [ ] **Step 4-1: 計測**

一時スクリプトをスクラッチパッドに置き、`markdownItInclude` の core rule のみを呼んで合成文書 3 種（フェンス 50 / 500 / 2000）と実文書（`docs/superpowers/plans/20260420-01-math-support.md`）を通す。リポジトリには一時ファイルを残さない。

期待:

| 文書 | develop | PR #444 | 追補後 |
|---|---|---|---|
| 49KB / フェンス 500 | 1.1 ms | 14.0 ms | develop 同等 |
| 200KB / フェンス 2000 | 14.5 ms | 197.2 ms | develop 同等 |

- [ ] **Step 4-2: 正しさの最終確認**

実文書で入力とバイト一致すること、および include フィクスチャ 3 件の展開結果が develop と一致することを確認する。

---

## Task 5: develop へマージ

- [ ] **Step 5-1: マージ前確認**

`AGENTS.md` のマージ確認ルールに従い、実行前にユーザー承認を得る。

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
2. **PR #444 への返信** — 性能追補を行った旨を伝えるか
3. **`Unreleased` 節の運用** — リリース時にバージョン見出しへ改名する手順が `docs/release-process.md` に無い場合、追記が必要か（本 bugfix のスコープ外）
