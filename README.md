# my-app

自分が作成・運用しているアプリへアクセスするための、個人用アプリランチャーです。
スマホを起点に、Cloudflare Pages + Pages Functions + D1 で動作する構成です。

## ローカル起動

```bash
npm install
npm run dev
```

`.env.local` はローカル確認用に用意済みです。初期ログイン情報は次のとおりです。

- ユーザー名: `admin@example.com`
- パスワード: `password`

初期状態では `VITE_API_MODE=mock` のため、D1やGoogle認証なしで5件のモックアプリを確認できます。

## 確認コマンド

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run preview` はビルド後の静的画面を確認するコマンドです。

## 環境変数

### Vite / フロントエンド

`.env.example` を参考に設定します。`VITE_*` はブラウザへ埋め込まれるため、秘密情報を設定しません。

- `VITE_ENABLE_DEV_LOGIN`: `true` で簡易ログインを表示
- `VITE_DEV_USER`: 簡易ログインのユーザー名
- `VITE_DEV_PASSWORD`: 簡易ログインのパスワード
- `VITE_API_MODE`: `mock` または `real`。未設定時はローカル開発で `mock`、本番ビルドで `real`
- `VITE_GOOGLE_CLIENT_ID`: 本番のGoogle Identity Services用Client ID

### Pages Functions / wrangler

Cloudflare PagesのProduction / Preview環境変数として次を設定します。

- `GOOGLE_CLIENT_ID`: IDトークンのaudience検証用
- `ALLOWED_GOOGLE_EMAILS`: 許可するGoogleメールアドレスのカンマ区切り
- `USER_NAME`: 管理者ログインのユーザー名
- `PASSWORD`: 管理者ログインのパスワード（Secretとして設定）
- `BYPASS_AUTH`: ローカル確認時だけ `true`。本番は `false` または未設定
- `RUNTIME_ENV`: `production` または `preview`

ローカルのPages Functionsを認証なしで確認するときは、`.dev.vars.example` を `.dev.vars` にコピーし、ビルド後に実行します。

```bash
cp .dev.vars.example .dev.vars
npm run build
npx wrangler pages dev dist
```

## D1

`wrangler.toml` のD1 bindingはプロジェクト固有ルールに従い `DB`、database名は `my-app` です。
Cloudflareで作成したD1のIDを `database_id` に設定してから、次を実行します。

```bash
npm run d1:migrate:local
npm run d1:migrate
```

`migrations/0001_init.sql` がテーブルとインデックスを作成し、`0002_seed.sql` が5件の初期データを投入します。

## API

`GET /api/apps` が `{ "apps": [...] }` を返します。

- 本番: `Authorization: Bearer <Google ID token>` が必須
- 管理者ログイン: `POST /api/auth/login` で `USER_NAME` / `PASSWORD` を照合し、HttpOnlyセッションCookieを発行
- 管理者セッション: `GET /api/auth/session` で再読込時のログイン状態を確認、`POST /api/auth/logout` で破棄
- `BYPASS_AUTH=true`: ローカル確認用に認証を省略
- D1から `pinned DESC, sort_order ASC, name ASC` で取得
- `url` と `icon_url` は `https` のみを許可

FunctionsはGoogle IDトークンの署名、`exp`、`aud`、issuer、メール検証済みフラグ、許可メールアドレスを確認します。Google認証そのものはGoogle Identity Servicesが担当します。管理者セッションのトークンはハッシュ化してD1へ保存します。

## ディレクトリ

- `src/components/`: カード、グリッド、ログイン、状態表示などの共通UI
- `src/features/apps/`: アプリ一覧取得、モック、並び順、モノグラム
- `src/features/auth/`: 認証状態の管理
- `src/lib/auth/`: 開発ログインとGoogle Identity Services連携
- `functions/api/`: Pages Functions API
- `migrations/`: D1 migration
- `doc/`: 設計判断と責務の補足
