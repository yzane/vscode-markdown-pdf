# CocoIndex 関連設定の削除設計

## 背景

このリポジトリの `AGENTS.md` はコード探索時に `cocoindex-code` MCP を最初に使うよう指定している。しかし、現在の開発環境では CocoIndex を利用しておらず、このリポジトリの規模でも専用の意味検索インデックスを維持する必要はない。

## 方針

CocoIndex を現在の開発手順から完全に外す。別の探索ツールをリポジトリ固有ルールとして追加せず、汎用的な探索方法は各エージェントの標準動作に委ねる。

## 変更範囲

- `AGENTS.md` の `Code Exploration` セクションを削除する。
- `.gitignore` から `.cocoindex_code/` を削除する。
- `.vscodeignore` から `.cocoindex_code/**` を削除する。
- 元の主作業ツリー `C:\work\github\yzane\vscode-markdown-pdf` に残っているローカルな未追跡の `.cocoindex_code/` を削除する。このディレクトリは feature worktree には存在しないため、削除と不在確認は主作業ツリーを対象に行う。

## 維持するもの

`docs/superpowers/` にある過去の設計・計画文書は、当時の判断を記録する履歴であるため変更しない。

## 非対象

- 新しいコード探索ツールや MCP サーバーの導入
- 過去文書の書き換え
- CocoIndex のグローバル設定や実行環境の削除（現在はインストール・登録されていない）

## 検証

- `AGENTS.md`、`.gitignore`、`.vscodeignore` を個別に検索し、CocoIndex の参照が残っていないことを確認する。
- 追跡ファイル全体を検索し、残る CocoIndex の参照が `docs/superpowers/` の過去資料と本設計書だけであることを確認する。
- 元の主作業ツリー `C:\work\github\yzane\vscode-markdown-pdf\.cocoindex_code` が存在しないことを確認する。
- `.vscodeignore` を対象とする単体テストを含む `npm run test:unit` を実行する。
