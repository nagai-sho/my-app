# my-app

自分が作成・運用しているアプリへアクセスするための、個人用アプリランチャーです。
スマホを起点に、Cloudflare Pages + Pages Functions + D1 で動作します。

## ローカル起動

本番と同じAPI・認証・D1を確認する場合は、Pages Functionsを含む開発サーバーを起動します。

```bash
npm install
cp .dev.vars.example .dev.vars
npm run d1:migrate:local
npm run build
npx wrangler pages dev dist
```

`.dev.vars` の `USER_NAME` / `PASSWORD` がローカル管理者ログインの認証情報です。`.dev.vars` はコミットしないでください。

## 統合アプリ

このリポジトリを4アプリ共通のサイトとして使用します。現在は次のアプリを統合しています。

- `/cashbook`: 日々の入出金、月次収支、カテゴリ・店舗、残高補正、Gmailスター付きメールからの取引候補
- `/cashbook/settings`: Cashbookの残高・カテゴリ・店舗設定
- `/word`: 単語カードの学習
- `/word/cards`: カード・ディレクトリの編集、CSV入出力

cashbook-appとword-appの画面・API・D1データはmy-appのビルド・Pages Functions・共通認証を利用します。
移設内容の詳細は [cashbook-app統合メモ](doc/cashbook-app-integration.md) と [word-app統合メモ](doc/word-app-integration.md) を参照してください。

## 確認コマンド

```bash
npm run typecheck
npm test
npm run build
```

## 環境変数

### Vite / フロントエンド

`.env.example` を参考に設定します。`VITE_*` はブラウザへ埋め込まれるため、秘密情報を設定しません。

- `VITE_GOOGLE_CLIENT_ID`: Google Identity Services用Client ID。Googleログインを使う場合に設定

フロントエンドは常にPages Functionsの実APIを呼び出します。開発用ログインやモックAPIへの切り替え設定はありません。

### Pages Functions / wrangler

Cloudflare PagesのProduction / Preview環境変数として次を設定します。

- `GOOGLE_CLIENT_ID`: Google IDトークンのaudience検証用
- `ALLOWED_GOOGLE_EMAILS`: 許可するGoogleメールアドレスのカンマ区切り。GoogleログインまたはGmail連携を使う場合に設定
- `GOOGLE_CLIENT_SECRET`: Gmail OAuthの認可コード交換用Secret。Gmail連携を使う場合のみ設定し、Cloudflare Secretとして登録
- `OWNER_GOOGLE_EMAIL`: Cashbookの所有者・管理者に対応するGoogleメールアドレス。Gmail連携のアカウント制限を明示する場合に設定
- `USER_NAME`: 管理者ログインのユーザー名
- `PASSWORD`: 管理者ログインのパスワード（Secretとして設定）

ローカルでは `.dev.vars.example` を `.dev.vars` にコピーして設定します。

Googleログインをブラウザで使う場合は、`.env.example` の `VITE_GOOGLE_CLIENT_ID` に同じClient IDを設定します。管理者の `USER_NAME` / `PASSWORD` ログインだけを使う場合、Google関連の値は不要です。CashbookのGmail連携では、Google Cloud OAuthクライアントに次のリダイレクトURIを登録します。

```text
https://<統合サイトのドメイン>/api/v1/cashbook/gmail/callback
```

`GOOGLE_REDIRECT_URI` や `SESSION_SECRET` は使用しません。コールバックURLは現在のリクエストのサイトoriginからサーバー側で組み立てます。`DB` は環境変数ではなく、`wrangler.toml` のD1 bindingです。

## D1

`wrangler.toml` のD1 bindingはプロジェクト固有ルールに従い `DB`、database名は `my-app` です。
Cloudflareで作成したD1のIDを `database_id` に設定してから、次を実行します。

```bash
npm run d1:migrate:local
npm run d1:migrate
```

`migrations/0001_init.sql` がランチャー、`0002_seed.sql` が初期アプリ、`0003_admin_sessions.sql` が管理者セッション、`0004`〜`0008` がword-appのテーブル、`0009_word_app_entry.sql` がword-appのランチャー項目、`0010_cashbook_initial.sql` がcashbookのテーブル・ビュー・初期カテゴリ、`0011_cashbook_app_entry.sql` がcashbookのランチャー項目を作成します。

## API

`GET /api/apps` が `{ "apps": [...] }` を返します。

- Googleログイン: `Authorization: Bearer <Google ID token>` を検証
- 管理者ログイン: `POST /api/auth/login` で `USER_NAME` / `PASSWORD` を照合し、HttpOnlyセッションCookieを発行
- 管理者セッション: `GET /api/auth/session` で再読込時のログイン状態を確認、`POST /api/auth/logout` で破棄
- D1から `pinned DESC, sort_order ASC, name ASC` で取得
- 外部の `url` と `icon_url` は `https`、統合アプリは `/` から始まる同一サイトのパスを許可
- Cashbook: `/api/v1/cashbook/categories`、`/merchants`、`/transactions`、`/summary`、`/settings`、`/gmail/*`
- CashbookのGmail OAuth: `/api/v1/cashbook/gmail/connect` と `/api/v1/cashbook/gmail/callback`

FunctionsはGoogle IDトークンの署名、`exp`、`aud`、issuer、メール検証済みフラグ、許可メールアドレスを確認します。管理者セッションのトークンはハッシュ化してD1へ保存します。

## ディレクトリ

- `src/components/`: カード、グリッド、ログイン、状態表示などの共通UI
- `src/features/apps/`: アプリ一覧取得、並び順、モノグラム
- `src/features/cashbook/`: Cashbookのダッシュボード、取引、集計、設定、Gmail連携
- `src/features/word/`: word-appの学習・編集画面、カード操作、CSV、フォルダ機能
- `src/features/auth/`: 認証状態の管理
- `src/lib/auth/`: Google Identity Services連携
- `functions/api/`: Pages Functions API。`api/v1/cashbook/` と `api/v1/word/` に統合アプリAPIを含む
- `public/`: 統合サイトのPWA manifest、Service Worker、アイコン
- `migrations/`: D1 migration
- `doc/`: 設計判断と責務の補足
