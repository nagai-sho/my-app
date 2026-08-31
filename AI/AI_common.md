# AI共通方針

> このファイルは `projects/AI/AI_common.md` を正本とする共通管理ファイルです。
> 各アプリ配下の `AI/AI_common.md` は配布先であり、直接編集しません。
> 変更が必要な場合は、この正本を更新した上で同期してください。

## 目的

各プロジェクトにおいて、AI とデベロッパーが共通認識を持ちながら開発を進めるため、AI 向けの知識共有ファイルを作成し、共通の運用ルールとして管理する。

## 方針

- 各アプリの root 配下に、AI と知識を共有するための MD ファイルを配置する
- AI と共有したい知識は、必要に応じて MD ファイルとして残す
- 共通情報とプロジェクト固有情報は分けて管理する
- 各プロジェクトには、AI と知識を共有するためのディレクトリを作成する
- `AI/` 配下に `AGENTS.md`、`AI_common.md`、`vibe_coding_settings.md` などを整理して配置する
- ファイル名やディレクトリ名は、役割が分かるものにする
- 実装中に、設計意図や責務の説明が必要だと判断した場合は、都度 MD ファイルを作成する
- 既存の説明が実装とずれた場合は、関連する MD ファイルを修正する
- コードだけでは伝わりにくい判断理由や背景は、可能な限り文章として残す
- 実装変更に伴って設計意図や責務が変わった場合は、対応する MD ファイルも更新する
- 同じUIなど、機能が重複する実装は共通コンポーネントとして作成し、UIや機能を統一する

## ディレクトリ構成

- `frontend/`
- `backend/`
- `docs/`
- `scripts/`
- `AI/`
- `.vscode/`
  - `tasks.json`

## 管理対象

各プロジェクトでは、少なくとも以下のような情報を MD ファイルとして管理する。

- `AI/AGENTS.md`
- `AI/AI_common.md`
- `AI/vibe_coding_settings.md`
- 設計意図をまとめたファイル
- 主要ディレクトリや主要ファイルの責務をまとめたファイル
- 実装判断の背景や理由をまとめたファイル
- 必要に応じた運用メモや補足資料

## 実装指示書の扱い

- `AI/vibe_coding_settings.md` は、確定した実装指示書として扱う
- `AI/vibe_coding_settings.md` に記載された要件、技術スタック、MVP を確認なしで変更しない
- `AI/vibe_coding_settings.md` 自体を更新するのは、確認の上、明示的に更新依頼があった場合に限る
- 実装時は、`AI/AI_common.md`、`AI/AGENTS.md`、`AI/vibe_coding_settings.md` の順に確認する
- 要件が不足している場合でも、明記済みの言語、フレームワーク、DB、認証方針を別技術へ置き換えない

## 認証の既定値

- ローカル確認用の初回ログイン情報を実装する場合、初期情報は以下で固定する。
  - メールアドレス: `admin@example.com`
  - パスワード: `password`

## データ永続化方針

- ユーザーが作成・編集・追加する業務データなどのアプリの正規データは必ずDBに永続化する。
- データ追加時に必要なテーブル・カラム・インデックスを migration として `migrations/` に追加し、API 経由で保存・取得する。
- `localStorage`、`sessionStorage`、IndexedDB は正規データの保存先として使わない。
- ブラウザストレージを使ってよいのは、UI状態、表示設定、一時的な下書き、キャッシュなど、消えてもDB上の正規データに影響しないものに限る。

## 実行環境方針

- 実装時の実行環境は原則 Docker を使用する
- `frontend`、`backend`、`db` など必要なサービスは Docker / Docker Compose で起動できるように構成する
- AI は、明示的な指示がない限り、ホスト環境への直接インストール前提で実装しない
- 起動確認は原則 `docker compose up` または `docker compose up --build` で行える状態を作る
- ローカルで確認できるように、即起動確認に必要な `.env` も用意する
- `docker compose up --build` だけで `frontend`、`backend`、`db` など主要サービスが起動できる状態を MVP 完了条件に含める
- 実装後は Docker を使った起動手順、テスト結果、未実施項目を共有する

## Docker ローカル運用

この Mac 上で複数アプリを開発する場合、Docker Desktop の仮想ディスクにイメージ、コンテナ、ボリューム、ビルドキャッシュが蓄積しやすい。空き容量不足を防ぐため、AI は以下を守る。

- アプリ開発時に Docker を使う場合、同時に起動する Docker Compose プロジェクトは原則1アプリ分だけにする。
- Docker を起動する前に、既存の Docker コンテナが動いていないか `docker ps` や `docker compose ps` で確認する。
- 別アプリの Docker コンテナが起動中の場合は、ユーザーに確認したうえで、そのアプリのディレクトリで `docker compose down` してから作業対象アプリを起動する。
- 作業対象アプリの確認が終わったら、継続起動が必要だと明示されていない限り、`docker compose down` で停止する。
- `docker compose up` をバックグラウンド実行した場合は、終了時に起動中の compose プロジェクト、ポート、停止要否を共有する。
- 容量不足が疑われる場合は、削除の前に `docker system df` で Docker 使用量を確認し、イメージ、コンテナ、ボリューム、ビルドキャッシュのどれが大きいかをユーザーに説明する。
- Docker の prune、volume 削除、`Docker.raw` 削除、Docker Desktop の初期化は破壊的操作として扱い、明示的な許可なしに実行しない。

## `projects/AI` 共通スクリプト対応

今後作成する Cloudflare Pages + D1 アプリは、`projects/AI` 側の共通 Task / script が動くように、最低限以下を満たす。

### `scripts/apps.json`

```json
{
  "name": "<app-name>",
  "path": "../repositories/<app-name>",
  "database": "<d1-database-name>"
}
```

### アプリ root

- `package.json`、`wrangler.toml`、`migrations/` を置く。
- `package.json` には最低限以下を定義する。

```json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "d1:migrate": "wrangler d1 migrations apply <d1-database-name> --remote"
  }
}
```

- `d1:migrate` は remote D1 用にする。
- local migration が必要な場合は `d1:migrate:local` のように別名にする。
- `wrangler.toml` には最低限以下を定義する。

```toml
name = "<cloudflare-pages-project-name>"
compatibility_date = "YYYY-MM-DD"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "<d1-database-name>"
database_id = "<d1-database-id>"
```

- `name` は Cloudflare Pages project name、`database_name` は `scripts/apps.json` の `database` と一致させる。
- D1 binding 名は原則 `DB` とする。

### Wrangler / workerd の依存関係

Cloudflare `wrangler` は native binary を含む `workerd` に依存するため、OS / CPU architecture が違う環境で作られた `node_modules` を使い回すと、以下のような platform mismatch が発生する。

```text
You installed workerd on another platform than the one you're currently using.
```

再発防止のため、Cloudflare Pages + D1 アプリでは以下を必ず守る。

- `node_modules/` をコピー、同期、移植、コミットしない。
- Docker、別 Mac、別 CPU architecture、CI、生成済みテンプレートから持ち込んだ `node_modules/` をそのまま使わない。
- `wrangler`、D1 migration、Pages dev / deploy を実行する前に、対象アプリ root で現在の環境向けに依存関係をインストールする。
- 初回作成、clone 後、テンプレート展開後、別環境からのファイル移動後は、対象アプリ root で `npm install` を実行してから `wrangler` を使う。
- `projects/AI` の共通 D1 script は、対象アプリの `node_modules/.bin/wrangler` が存在する場合それを使うため、対象アプリ側の `node_modules` が壊れていると共通 script も失敗する。
- `workerd` の platform mismatch が出た場合は、対象アプリ root で `node_modules/` を削除し、`npm install` で再作成してから再実行する。

復旧手順:

```bash
cd /path/to/app
rm -rf node_modules
npm install
```

その後、必要な `wrangler` / D1 command を再実行する。

## 禁止行為

- 本番データに影響する操作
- 明示的な許可なく `git push` を実行すること
- デプロイ、公開、本番反映、Cloudflare Workers / Pages など外部環境への反映を行うこと
- 実装修正、動作確認、テスト、ビルドの依頼を、デプロイ許可として解釈すること
- 依存関係の大幅変更
- 破壊的なファイル操作
- 外部サービス課金が発生する操作

## 期待する状態

- AI がプロジェクトの目的、構造、責務を読み取りやすい
- 人間が後から見ても、設計意図や判断理由を追いやすい
- 実装だけでなく、背景知識も継続的に蓄積される

## 位置付け

- この `AI_common.md` は、各プロジェクトで AI 用ドキュメントを整備するための共通方針とする
- プロジェクト固有のルールや事情は、各プロジェクトの `AI/AGENTS.md` や `AI/vibe_coding_settings.md` に記載する
