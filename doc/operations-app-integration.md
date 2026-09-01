# 運用状況機能の統合メモ

## 画面

- `/operations`: 登録アプリの状態、Tasksの進捗、Gathererの実行状態、最近の動きを表示する。
- ランチャーのDashboardカードから同じサイト内で遷移する。
- ヘッダーの再確認ボタンで最新状態を取得し、外部リンクは新しいタブで開く。

## API

- `GET /api/v1/operations`: 共通セッション認証後、登録アプリの状態とTasks・Gathererのサマリーを返す。
- 統合アプリは同一SPA内のルートを持つため、APIからの応答確認なしで稼働中として扱う。
- 外部リンクはHTTPS URLに限ってサーバー側から確認し、HEADが使えないサービスにはGETをフォールバックする。
- URLごとのタイムアウトは5秒で、監視失敗は個別サービスの状態に閉じ込める。

## D1

`migrations/0021_operations_app_entry.sql` が初期Dashboardのプレースホルダーを `/operations` の統合アプリへ切り替える。運用状況専用のテーブルは追加せず、既存の `apps`、`task_items`、`gatherer_sources`、`gatherer_fetch_runs` を読み取る。
