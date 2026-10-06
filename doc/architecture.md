# アーキテクチャ

## 責務

- `src/`: Vite + React + TypeScript のフロントエンド。UI状態とAPI呼び出しを担当する。
- `src/features/apps/`: アプリ一覧の型利用、取得、並び順、区分別表示、アイコン表示用ロジックをまとめる。
- `src/features/cashbook/`: Cashbookのダッシュボード、取引・カテゴリ・店舗、集計、残高設定、Gmail連携をまとめる。
- `src/features/word/`: word-appの学習・編集画面、カード操作、CSV、フォルダ機能をまとめる。
- `src/features/collection/`: collection-appの書籍一覧、ギャラリー、アップロード、ビューアをまとめる。
- `src/features/tasks/`: 個人タスクの一覧、検索、状態変更、編集をまとめる。
- `src/features/operations/`: 登録アプリの応答状況、Tasksの進捗、Gathererの実行状態をまとめる。
- `src/lib/auth/`: Google Identity Servicesのブラウザ連携を担当する。
- `functions/api/`: my-appの共通Pages Functions APIハンドラ。Google credentialはサーバーで検証して共通HttpOnlyセッションへ交換し、以後はセッションCookieだけを検証する。`api/v1/cashbook/` はCashbookのCRUD・集計・Gmail API、`api/v1/collection/` はcollectionの文書・フォルダ・ファイルAPI、`api/v1/gatherer/` は情報源・収集結果・実行履歴API、`api/v1/operations/` は登録アプリの外部疎通確認とTasks・Gathererの運用サマリー、`api/v1/tasks/` は個人タスクのCRUD APIを扱う。
- `migrations/`: D1の正規データ構造と初期データを管理する。
- `public/`: 統合サイトのPWA manifest、Service Worker、アイコンを管理する。
- `functions/_scheduled.ts`: gathererの定期収集ロジックに接続するスケジュール入口を管理する。静的ファイルはPagesから配信する。

## データフロー

ランチャーは `/api/apps` を呼び出し、共通Pages Functionsが認証を確認した後にD1を読み取る。Cashbookは `/cashbook`、collectionは `/collection`、gathererは `/gatherer`、operationsは `/operations`、tasksは `/tasks`、wordは `/word` として同じSPA内で表示し、それぞれ`/api/v1/<feature>/*`の名前空間で取得・更新する。本番・ローカルともにPages + Pages Functions + D1/R2を動かす。Google Identity Servicesのcredentialは`POST /api/auth/google`で一度だけ検証し、ブラウザにはGoogle tokenを保存しない。

正規データは`DB` bindingのD1に保存する。`app_users`の単一`owner`を全機能で共有し、共通セッションのハッシュは`app_sessions`へ保存する。ランチャーの`apps.category`は統合アプリと外部リンクを区別し、外部リンクは専用の一覧区分と外部バッジで表示する。wordのIndexedDBはD1のカード・フォルダをオフライン閲覧するためのキャッシュに限定する。collectionの原本・サムネイルは`COLLECTION_R2` bindingで参照し、ファイルAPIが所有者確認後に`private, no-store`で返すためService WorkerはAPIと非公開ファイルをキャッシュしない。CashbookのGmail OAuth一時stateは`cashbook_oauth_states`、アクセストークンは`cashbook_gmail_tokens`に保存する。

gathererの収集ロジックは`functions/_scheduled.ts`から起動できる。PagesデプロイだけではCron Triggerは作成されないため、自動実行を有効にする場合はCloudflare側のスケジューラ／Worker Cronを別途設定し、`0 22 * * *`（UTC、07:00 JST）でこのロジックを呼び出す。取得結果は`gatherer_items`の`(source_id, external_id)`一意制約で再実行時も重複登録せず、`gatherer_fetch_runs`に手動・定期収集、件数、失敗内容を記録する。Tasksの正規データは`task_items`に保存し、一覧・作成・更新・削除は共通セッション認証済みの`/api/v1/tasks`で行う。

運用状況画面は共通セッション認証済みの`GET /api/v1/operations`からデータを取得する。`apps`の統合アプリは同一SPAのルートとして稼働中と表示し、`external`のHTTPSリンクだけをPages FunctionからHEAD（405/501の場合はGET）で確認する。Tasksの未完了・期限超過・完了率、Gathererの有効情報源・最新実行、直近の更新履歴をD1からまとめて返す。外部URLの確認は1件5秒で打ち切り、応答できない場合はそのサービスを停止として表示する。
