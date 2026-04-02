# plan適用ワークフロー設計

## 概要

`docs/superpowers/plans/` に保存されている既存 plan を、このリポジトリの現行 `develop` ブランチへ順次適用していくための運用設計を定義する。

各 plan は独立した実装単位として扱い、`develop` から作成した `feature/*` ブランチ上で実装・検証・文書補正を完結させたうえで `develop` へマージする。

## 背景

- `docs/superpowers/` 配下には、複製環境で段階的に作成された spec / plan が存在する
- 現行 `develop` ブランチには、これらの plan が前提とする抽出済みコードやテスト基盤がまだ入っていない
- そのため、plan の意図は維持しつつも、現行コードとの差分を吸収しながら適用する運用ルールが必要になる
- 1回の変更に複数 plan を混ぜると、差分の説明責任と不具合発生時の切り分けが難しくなる

## 目的

- plan を番号順に適用する実装順序を明確にする
- `plan 1件 = 1 feature branch = 1 develop へのマージ` の運用を固定する
- 現行コードとの不一致がある場合の補正方針を明文化する
- 各 plan の完了条件と検証範囲を揃える

## 適用単位

各 plan は独立した作業単位として扱う。1つの `feature/*` ブランチに複数 plan を混在させない。

実施順は `docs/superpowers/plans/` の番号順を基本とする。前の plan が `develop` にマージされるまでは、次の plan の実装には進まない。

この順序により、plan の連番がそのまま実装履歴となり、どの差分がどの計画に対応するかを追跡しやすくする。

適用対象ファイルは以下の plan / spec の組み合わせとする。

1. `docs/superpowers/plans/2026-03-30-01-unit-tests.md`
   `docs/superpowers/specs/2026-03-30-01-unit-tests-design.md`
2. `docs/superpowers/plans/2026-03-30-02-integration-tests.md`
   `docs/superpowers/specs/2026-03-30-02-integration-tests-design.md`
3. `docs/superpowers/plans/2026-03-30-03-extract-and-test.md`
   `docs/superpowers/specs/2026-03-30-03-extract-and-test-design.md`
4. `docs/superpowers/plans/2026-03-30-04-edge-case-tests.md`
   `docs/superpowers/specs/2026-03-30-04-edge-case-tests-design.md`
5. `docs/superpowers/plans/2026-03-31-01-utils-path-tests.md`
   `docs/superpowers/specs/2026-03-31-01-utils-path-tests-design.md`
6. `docs/superpowers/plans/2026-03-31-02-test-documentation.md`
   `docs/superpowers/specs/2026-03-31-02-test-documentation-design.md`
7. `docs/superpowers/plans/2026-03-31-03-additional-tests.md`
   `docs/superpowers/specs/2026-03-31-03-additional-tests-design.md`
8. `docs/superpowers/plans/2026-03-31-04-test-readme-refresh.md`
   `docs/superpowers/specs/2026-03-31-04-test-readme-refresh-design.md`
9. `docs/superpowers/plans/2026-03-31-05-export-options-tests.md`
   `docs/superpowers/specs/2026-03-31-05-export-options-tests-design.md`
10. `docs/superpowers/plans/2026-03-31-06-extract-convert-html-tests.md`
   `docs/superpowers/specs/2026-03-31-06-extract-convert-html-tests-design.md`
11. `docs/superpowers/plans/2026-04-01-01-extract-remaining-logic.md`
   `docs/superpowers/specs/2026-04-01-01-extract-remaining-logic-design.md`

## ブランチ運用

各 plan の開始時に、最新の `develop` から `feature/<plan-topic>` ブランチを作成する。

そのブランチでは、以下のみを実施対象とする。

- 対象 plan に対応する実装
- 対象 plan に必要なテストの追加または更新
- 実装内容に合わせた spec / plan の最小限の補正
- 完了条件を満たすための狭い範囲の関連修正

対象 plan と無関係な変更、後続 plan の先取り、広いリファクタリングは含めない。

検証が完了したら、その plan 専用 branch を `develop` へマージする。これを各 plan について最後まで繰り返す。

## plan / spec の扱い

各 plan と対応 spec は、その branch における作業契約として扱う。ただし、それらは複製環境で作成されたため、現行 `develop` に対して次のような不一致が発生し得る。

- 参照ファイルがまだ存在しない、または既に構成が変わっている
- 記載された行番号が現状とずれている
- 想定しているテストコマンドや依存関係が現状と一致しない
- ブランチ名やコミット例が現行の進め方と一致しない

この場合は、plan の目的を維持したまま、手順・参照パス・検証方法・補足説明を現行コードに合わせて補正する。

一方で、plan の中心的な意図は変更しない。たとえば、「純粋関数の抽出」「ユニットテストの追加」「既存委譲パターンの踏襲」といった目的は保持し、実施手順のみを更新する。

補正が入った場合、実装済みコードと文書の内容が乖離しないよう、対象 plan または spec も同じ branch 内で更新する。

## 実装方針

実装は常に現行 `develop` の状態を基準に開始する。plan の記述をそのまま機械的に適用するのではなく、対象コードの現状を確認したうえで最小差分で変更する。

コード探索では、まず `cocoindex-code` MCP による限定的な探索を行い、必要な箇所だけを読む。変更は狭く保ち、対象 plan に直接関係する関数・モジュール・テストに限定する。

実装中に現れた派生課題が後続 plan のスコープに属する場合は、その branch で解決しない。必要なら文書に補足を残し、次の plan で扱う。

## 検証方針

各 plan の検証は、広いテストではなく、その変更に最も近い狭い検証から始める。

例:

- ユニット関数の抽出なら `test:unit`
- 既存 extension 振る舞いに影響するなら既存の統合テスト
- 文書修正のみなら記述整合の確認

変更範囲が広い場合に限り、必要な追加検証を広げる。毎回フルスイートを前提にはしないが、少なくとも対象 plan の変更が壊れていないことは確認する。

## 完了条件

各 plan を `develop` へマージ可能と判断する条件は以下の4点とする。

1. 対象 plan の目的を現行コード上で満たしていること
2. 実装に必要な範囲で spec / plan の補正が反映されていること
3. 変更に対応する検証が成功していること
4. 差分の意図と影響範囲を、1つの plan として説明できること

この条件を満たさない限り、次の plan には進まない。

## エラーハンドリング

plan の記述と現行コードの差が大きく、目的の維持が困難な場合は、その場で実装を進めず、差分内容を明確化して設計または plan 自体を見直す。

また、現在の plan を完了させるために後続 plan の変更が不可欠だと判明した場合は、スコープ設定に問題があるため、文書側を修正して作業単位を再定義する。

## テスト戦略

- 既存のテスト基盤を優先し、新規テスト基盤の導入は必要最小限に留める
- 抽出した純粋関数にはユニットテストを追加する
- 既存 extension の主要導線に影響する変更では、必要に応じて既存統合テストも実行する
- テストの追加順序も、plan ごとの目的達成に必要な範囲に限定する

## スコープ外

以下は本設計の対象外とする。

- 各個別 plan の詳細実装内容そのもの
- 全 plan をまとめた一括 branch 運用
- `develop` を経由しない `master` 直行運用
- 既存 branching model の変更

## 成功基準

- `docs/superpowers/plans/` の各 plan を番号順に順次適用できる
- 各作業が `feature/*` 単位で閉じ、`develop` に順次マージされる
- 現行コードとの差分があっても、plan の意図を崩さずに補正して実装できる
- 各段階で、何を終えたかと次に何を行うかが文書とブランチ履歴の両方から追跡できる
