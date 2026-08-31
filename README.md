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
- `ALLOWED_GOOGLE_EMAILS`: 許可するGoogleメールアドレスのカンマ区切り
- `USER_NAME`: 管理者ログインのユーザー名
- `PASSWORD`: 管理者ログインのパスワード（Secretとして設定）

ローカルでは `.dev.vars.example` を `.dev.vars` にコピーして設定します。

## D1

`wrangler.toml` のD1 bindingはプロジェクト固有ルールに従い `DB`、database名は `my-app` です。
Cloudflareで作成したD1のIDを `database_id` に設定してから、次を実行します。

```bash
npm run d1:migrate:local
npm run d1:migrate
```

`migrations/0001_init.sql` が基本テーブルを作成し、`0002_seed.sql` が5件の初期データを投入し、`0003_admin_sessions.sql` が管理者セッション用テーブルを作成します。

## API

`GET /api/apps` が `{ "apps": [...] }` を返します。

- Googleログイン: `Authorization: Bearer <Google ID token>` を検証
- 管理者ログイン: `POST /api/auth/login` で `USER_NAME` / `PASSWORD` を照合し、HttpOnlyセッションCookieを発行
- 管理者セッション: `GET /api/auth/session` で再読込時のログイン状態を確認、`POST /api/auth/logout` で破棄
- D1から `pinned DESC, sort_order ASC, name ASC` で取得
- `url` と `icon_url` は `https` のみを許可

FunctionsはGoogle IDトークンの署名、`exp`、`aud`、issuer、メール検証済みフラグ、許可メールアドレスを確認します。管理者セッションのトークンはハッシュ化してD1へ保存します。

## ディレクトリ

- `src/components/`: カード、グリッド、ログイン、状態表示などの共通UI
- `src/features/apps/`: アプリ一覧取得、並び順、モノグラム
- `src/features/auth/`: 認証状態の管理
- `src/lib/auth/`: Google Identity Services連携
- `functions/api/`: Pages Functions API
- `migrations/`: D1 migration
- `doc/`: 設計判断と責務の補足
