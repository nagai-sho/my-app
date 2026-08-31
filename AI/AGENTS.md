# AGENTS.md

## 最初に確認すること

- `AI/AI_common.md` を先に読む
- この `AI/AGENTS.md` に書かれたプロジェクト固有ルールを守る
- `AI/vibe_coding_settings.md` を実装指示の正本として読む
- 既存コードとドキュメントを確認する

## AI への実装指示

- 変更前に必ず確認すること:
- 優先して守る設計方針:
- 共通ルールは `AI/AI_common.md` に従う
- 実行環境は Cloudflare Pages + Pages Functions + Cloudflare D1 とする
- D1 設定ファイルは `wrangler.toml` を作成する
- `wrangler.toml` には `name`、`compatibility_date`、`pages_build_output_dir = "dist"`、`[[d1_databases]]` を必ず定義する
- D1 binding 名は `DB` で固定する
- D1 database 名はアプリディレクトリ名と一致させる
- `package.json` に `d1:migrate`、`build`、`typecheck`、`test` を必ず定義する
- 初期実装後は、`projects/AI` から `node scripts/scaffold-app-runtime.mjs --app <app-name>` を実行して、`wrangler.toml`、D1 migration script、`npm install` をまとめて適用する
- migration は `migrations/` に SQL ファイルとして作成し、`npm run d1:migrate` で適用できるようにする
- 関連ドキュメントを更新する条件:コンテキスト内での指示を常に反映させる
- テストファイルの作成有無: 有

## テスト指示

- 実装後に期待する確認方法: 起動確認
- 必ず実行したいテスト:
- テスト未実施を許容する条件:
- テスト未実施時に残すべき報告:

## ドキュメント指示

- 主要ディレクトリの責務が変わったら説明も更新する
- AI と共有したい判断理由は、実装と同時に記録する
- このプロジェクトで特に更新したい資料:

## このプロジェクトで AI に期待すること

- 最小限の構成で起動確認ができること
- 変更内容と理由を短く明確に共有する
- `doc/`に 整理された仕様が全てMDファイルとして作成されている
