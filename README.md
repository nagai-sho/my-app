# my-app

自分が作成・運用しているアプリへアクセスするための、個人用アプリランチャーです。
スマホを起点に、1つのCloudflare Pagesサイト + Pages Functions + D1/R2で動作します。

## ローカル起動

本番と同じAPI・認証・D1/R2を確認する場合は、共通Pages Functionsの開発サーバーを起動します。

```bash
npm install
cp .dev.vars.example .dev.vars
npm run d1:migrate:local
npm run build
npm run dev:pages
```

`.dev.vars` の `USER_NAME` / `PASSWORD` がローカル管理者ログインの認証情報です。`.dev.vars` はコミットしないでください。

## 統合機能

このリポジトリを4つの機能に共通する単一サイトとして使用します。次の移設元機能を統合しています。

- `/cashbook`: 日々の入出金、月次収支、カテゴリ・店舗、残高補正、Gmailスター付きメールからの取引候補
- `/cashbook/settings`: Cashbookの残高・カテゴリ・店舗設定
- `/word`: 単語カードの学習
- `/word/cards`: カード・ディレクトリの編集、CSV入出力
- `/collection`: 画像・PDFの書籍整理、アップロード、並び替え、閲覧
- `/gatherer`: 情報源の登録、記事収集、既読管理、実行履歴
- `/tasks`: 期限・優先度・ステータス付きの個人タスク管理

cashbook-app、word-app、collection-app、gatherer-appの画面・API・D1データは、my-app内の機能として共通ビルド・Pages Functions・認証を利用します。
移設内容の詳細は [cashbook-app統合メモ](doc/cashbook-app-integration.md) と [word-app統合メモ](doc/word-app-integration.md) を参照してください。
collection-appの移設内容は [collection-app統合メモ](doc/collection-app-integration.md) を参照してください。
gatherer-appの移設内容は [gatherer-app統合メモ](doc/gatherer-app-integration.md) を参照してください。

## 確認コマンド

```bash
npm run typecheck
npm test
npm run build
```

## 環境変数

### Vite / フロントエンド

`.env.example` を参考に設定します。`VITE_*` はブラウザへ埋め込まれるため、秘密情報を設定しません。

- `VITE_GOOGLE_CLIENT_ID`: Vite単体起動時のGoogle Identity Services用フォールバックClient ID（Pages Functions起動時は`GOOGLE_CLIENT_ID`を優先）

フロントエンドは常にmy-appの共通Pages Functions APIを呼び出します。Google credentialはログイン時にHttpOnlyセッションCookieへ交換し、localStorageには保存しません。開発用ログインやモックAPIへの切り替え設定はありません。

### Pages Functions / wrangler

Cloudflare PagesのProduction / Preview環境変数として次を設定します。

- `GOOGLE_CLIENT_ID`: Google IDトークンのaudience検証用
- `ALLOWED_GOOGLE_EMAILS`: 許可するGoogleメールアドレスのカンマ区切り。GoogleログインまたはGmail連携を使う場合に設定
- `GOOGLE_CLIENT_SECRET`: Gmail OAuthの認可コード交換用Secret。Gmail連携を使う場合のみ設定し、Cloudflare Secretとして登録
- `OWNER_GOOGLE_EMAIL`: Cashbookの所有者・管理者に対応するGoogleメールアドレス。Gmail連携のアカウント制限を明示する場合に設定
- `USER_NAME`: 管理者ログインのユーザー名
- `PASSWORD`: 管理者ログインのパスワード（Secretとして設定）
- `TAVILY_API_KEY`: GathererのTavily取得を使う場合のAPIキー（Secretとして設定）
- `TAVILY_DAILY_CREDIT_LIMIT`: Gathererの1日あたりTavilyクレジット上限（既定30）
- `TAVILY_MONTHLY_CREDIT_LIMIT`: Gathererの31日あたりTavilyクレジット上限（既定900）

ローカルでは `.dev.vars.example` を `.dev.vars` にコピーして設定します。

Googleログイン画面は`GET /api/auth/config`でPages Functionsの`GOOGLE_CLIENT_ID`を取得します。Vite単体起動時だけ`.env.example`の`VITE_GOOGLE_CLIENT_ID`へ同じClient IDを設定します。管理者の`USER_NAME` / `PASSWORD`ログインだけを使う場合、Google関連の値は不要です。CashbookのGmail連携では、Google Cloud OAuthクライアントに次のリダイレクトURIを登録します。

```text
https://<統合サイトのドメイン>/api/v1/cashbook/gmail/callback
```

`GOOGLE_REDIRECT_URI` や `SESSION_SECRET` は使用しません。コールバックURLは現在のリクエストのサイトoriginからサーバー側で組み立てます。`DB` は環境変数ではなく、`wrangler.toml` のD1 bindingです。

## D1

`wrangler.toml` の唯一のD1 bindingは `DB`、database名は `my-app` です。
Cloudflareで作成したD1のIDを `database_id` に設定してから、次を実行します。

```bash
npm run d1:migrate:local
npm run d1:migrate
```

`migrations/0001_init.sql` がランチャー、`0002_seed.sql` が初期アプリ、`0003_admin_sessions.sql` が旧管理者セッションの履歴、`0004`〜`0008` がword-appのテーブル、`0009_word_app_entry.sql` がword-appのランチャー項目、`0010_cashbook_initial.sql` がcashbookのテーブル・ビュー・初期カテゴリ、`0011_cashbook_app_entry.sql` がcashbookのランチャー項目、`0012_collection_initial.sql` がcollectionのテーブル、`0013_collection_app_entry.sql` がcollectionのランチャー項目、`0014_gatherer_initial.sql` がgathererのテーブル、`0015_app_sessions.sql` が共通セッション、`0016_gatherer_app_entry.sql` がgathererのランチャー項目、`0017_tasks_initial.sql` がTasksのテーブルとランチャー項目、`0018_external_links.sql` がアプリ区分と外部リンク3件、`0019_remove_unused_launcher_apps.sql` が未使用の予定管理・リンク集、`0020_add_ip_expand_link.sql` がIP Expandを追加します。

collection-appの画像・PDFは、既存のR2バケット `collection-app-image` を `COLLECTION_R2` bindingとして参照します。既存データのR2キーは移行時に変更せず、APIが旧キーをフォールバック参照します。

切替前にR2キーを正規形式へコピー・検証する場合は、まず監査し、結果を確認してから`MY_APP_R2_MIGRATION_APPLY=1 npm run migrate:collection-r2`を実行します。旧キーはロールバック期間のため`legacy_*`に保持し、旧オブジェクトはすぐに削除しません。

## API

`GET /api/apps` が `{ "apps": [...] }` を返します。

- Googleログイン: `POST /api/auth/google` でcredentialを検証し、共通HttpOnlyセッションCookieを発行
- 管理者ログイン: `POST /api/auth/login` で `USER_NAME` / `PASSWORD` を照合し、HttpOnlyセッションCookieを発行
- 共通セッション: `GET /api/auth/session` で再読込時のログイン状態を確認、`POST /api/auth/logout` で破棄
- D1から `pinned DESC, sort_order ASC, name ASC` で取得
- `category` は `integrated`（統合アプリ）または `external`（外部リンク）で、外部リンクは一覧上で区分表示し新しいタブで開く
- 外部の `url` と `icon_url` は `https`、統合アプリは `/` から始まる同一サイトのパスを許可
- Cashbook: `/api/v1/cashbook/categories`、`/merchants`、`/transactions`、`/summary`、`/settings`、`/gmail/*`
- CashbookのGmail OAuth: `/api/v1/cashbook/gmail/connect` と `/api/v1/cashbook/gmail/callback`
- Gatherer: `/api/v1/gatherer/items`、`/sources`、`/rules`、`/tasks`、`/collect`、`/runs`
- Tasks: `/api/v1/tasks`（一覧、作成、更新、削除）

Pages FunctionsはGoogle credentialの署名、`exp`、`aud`、issuer、メール検証済みフラグ、許可メールアドレスを確認します。共通セッションのトークンはハッシュ化して`app_sessions`へ保存します。

## ディレクトリ

- `src/components/`: カード、グリッド、ログイン、状態表示などの共通UI
- `src/features/apps/`: アプリ一覧取得、並び順、モノグラム
- `src/features/cashbook/`: Cashbookのダッシュボード、取引、集計、設定、Gmail連携
- `src/features/word/`: word-appの学習・編集画面、カード操作、CSV、フォルダ機能
- `src/features/collection/`: collection-appの書籍、ギャラリー、ファイルビューア、R2/D1連携
- `src/features/gatherer/`: 情報源、収集結果、タスク、実行履歴
- `src/features/tasks/`: タスク一覧、検索・フィルター、編集
- `src/features/auth/`: 認証状態の管理
- `src/lib/auth/`: Google Identity Services連携
- `functions/api/`: my-appの共通Pages Functions APIハンドラ。`api/v1/cashbook/`、`api/v1/collection/`、`api/v1/gatherer/`、`api/v1/tasks/`、`api/v1/word/` に各機能APIを含む
- `functions/_scheduled.ts`: gathererの定期収集ロジックに接続するスケジュール入口
- `public/`: 統合サイトのPWA manifest、Service Worker、アイコン
- `migrations/`: D1 migration
- `doc/`: 設計判断と責務の補足
