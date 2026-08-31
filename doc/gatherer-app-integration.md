# gatherer-app 統合メモ

## ルートとAPI

- `/gatherer`: 今日の収集結果
- `/gatherer/tasks`: 収集・習慣タスクの記録
- `/gatherer/add`: 情報源の追加
- `/gatherer/sources`: 情報源と条件の管理
- `/gatherer/runs`: 定期・手動収集の実行履歴
- `/api/v1/gatherer/items`
- `/api/v1/gatherer/sources`
- `/api/v1/gatherer/rules`
- `/api/v1/gatherer/tasks`
- `/api/v1/gatherer/collect`
- `/api/v1/gatherer/runs`

gatherer専用のサイト、Worker、D1、ログインは作成せず、my-app内の機能として共通Pages Functions・`DB`・共通セッションCookieを利用します。

## D1

`0014_gatherer_initial.sql`で、旧アプリの汎用テーブルを次へ分離します。

- `gatherer_sources`
- `gatherer_rules`
- `gatherer_items`
- `gatherer_item_states`
- `gatherer_fetch_runs`
- `gatherer_tasks`
- `gatherer_task_logs`

すべての業務データは`owner_id = 'owner'`で絞り込みます。`gatherer_items`は`(source_id, external_id)`を一意にし、同一収集の再実行でも重複行を作りません。

旧gatherer-appのD1からの変換SQLは次で生成します。生成後のSQLをレビューしてから、表示された`wrangler d1 execute`コマンドで適用します。

```bash
npm run migrate:gatherer
```

## 収集と監視

収集ロジックは`functions/_scheduled.ts`から起動できます。Cloudflare PagesのデプロイだけではCron Triggerは作成されないため、自動実行を有効にする場合はCloudflare側のスケジューラ／Worker Cronから`0 22 * * *`（UTC、07:00 JST）でこのロジックを呼び出します。外部取得は10秒タイムアウト、最大3回、指数バックオフで再試行します。レスポンス本文は2MiBまでに制限します。

実行ごとに`gatherer_fetch_runs`へ、trigger、status、開始・終了時刻、追加・更新・条件外件数、Tavilyクレジット、失敗内容を記録します。Pages Functions／スケジューラのログには`feature: gatherer`とイベント名を付けます。

Tavilyを使う場合はPagesのSecretの`TAVILY_API_KEY`を設定し、`TAVILY_DAILY_CREDIT_LIMIT`（既定30）と`TAVILY_MONTHLY_CREDIT_LIMIT`（既定900）で上限を指定します。RSS、JSON API、GitHub Releases、HTMLの取得にはAPIキーは不要です。

## 切替前のバックアップ

データ切替前に、D1全体とcollectionのR2本体を退避します。

```bash
npm run backup:cutover
```

バックアップは`backups/`以下に作られ、D1 SQL、R2オブジェクト、R2キー一覧を含みます。秘密情報や`.dev.vars`はバックアップ対象にしません。旧アプリは切替確認後も一定期間削除せず、ロールバックに使える状態で残します。
