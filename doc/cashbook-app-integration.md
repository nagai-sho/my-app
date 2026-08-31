# cashbook-app統合

## 公開ルート

- `/cashbook`: 月別・全期間の収支、残高、カテゴリ別集計、取引一覧、Gmailスター付きメール
- `/cashbook/settings`: 現在残高、カテゴリ、店舗の設定

ログイン画面とログアウトはmy-appの共通認証を使います。`USER_NAME` / `PASSWORD` または許可済みGoogle credentialから、同じHttpOnlyセッションCookieを発行します。

## 移設したコード

- `src/features/cashbook/`: Cashbookの画面、取引モーダル、集計グラフ、Gmail候補、設定画面
- `functions/api/v1/cashbook/[[path]].ts`: 共通Pages FunctionsのCashbook API入口
- `functions/lib/cashbookApi.ts`: 取引・カテゴリ・店舗・設定・集計・Gmail API
- `functions/lib/cashbookGmail.ts` / `cashbookGmailOAuth.ts`: Gmail OAuthとアクセストークン更新
- `public/icons/cashbook.svg`: ランチャー用アイコン
- `public/sw.js`: Cashbookの同一サイトPWAルートをアプリシェルへ追加

cashbook-app単体のWorker、ログイン画面、独自Routerは本番の実行経路には残さず、my-appの共通Pages Functions・React Router・共通認証へ統合しています。これにより4機能を同じサイト、同じD1、同じセッションで運用できます。

## API

- `/api/v1/cashbook/categories`: カテゴリの一覧・追加・更新・削除
- `/api/v1/cashbook/merchants`: 店舗の一覧・追加・更新・削除
- `/api/v1/cashbook/transactions`: 取引の一覧・追加・更新・削除
- `/api/v1/cashbook/summary`: 月次・日次の集計とカテゴリ別内訳
- `/api/v1/cashbook/settings`: 現在残高の取得・更新・補正解除
- `/api/v1/cashbook/gmail/starred`: Gmailスター付きメールの候補取得
- `/api/v1/cashbook/gmail/messages/:id/unstar`: 取引登録後のスター解除
- `/api/v1/cashbook/gmail/connect` / `callback`: Gmail OAuth開始・コールバック

すべてのCashbook APIは共通のセッションCookieを確認します。データは`owner_id = 'owner'`で既存のword-appデータと同じ所有者名前空間に移設しました。

## D1

`migrations/0010_cashbook_initial.sql` がCashbookのテーブル、インデックス、集計ビュー、初期カテゴリを作成し、`migrations/0011_cashbook_app_entry.sql` がランチャー項目を登録します。

本番のmy-app D1（`ce71b5d2-ac90-47f1-9a88-223c6ac924f2`）へ次の既存データを移設済みです。

- カテゴリ: 64件
- 店舗: 75件
- 取引: 188件
- 残高設定: 1件
- Gmail連携トークン: 1件

移設元の一時OAuth stateと管理者セッションは、期限・セッション境界が異なるため移設対象から除外しています。既存のGmail連携トークンはCashbookの所有者へ紐付けて移設しています。

## 環境変数

通常の管理者ログインには`USER_NAME`と`PASSWORD`だけが必要です。Googleログインを使う場合はPagesの`GOOGLE_CLIENT_ID`と`ALLOWED_GOOGLE_EMAILS`を設定します。Vite単体起動時だけ`VITE_GOOGLE_CLIENT_ID`をフォールバックとして設定します。

Gmail連携を使う場合は、さらにCloudflare Secretの`GOOGLE_CLIENT_SECRET`を設定し、必要に応じて`OWNER_GOOGLE_EMAIL`で連携可能なアカウントを明示します。Google Cloud OAuthクライアントには次を登録します。

```text
https://<統合サイトのドメイン>/api/v1/cashbook/gmail/callback
```

`GOOGLE_REDIRECT_URI`、`SESSION_SECRET`、`VITE_ENABLE_DEV_LOGIN`、`BYPASS_AUTH`、`VITE_API_MODE`、`RUNTIME_ENV`は使用しません。D1は環境変数ではなく、`wrangler.toml`の`DB` bindingです。
