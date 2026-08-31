# アーキテクチャ

## 責務

- `src/`: Vite + React + TypeScript のフロントエンド。UI状態とAPI呼び出しを担当する。
- `src/features/apps/`: アプリ一覧の型利用、取得、並び順、アイコン表示用ロジックをまとめる。
- `src/lib/auth/`: Google Identity Servicesのブラウザ連携を担当する。
- `functions/api/`: Pages FunctionsのAPI。Google IDトークンまたは管理者セッションを検証し、D1の読み取り結果をフロント向け型へ変換する。`auth/login`、`auth/session`、`auth/logout` は管理者セッションを扱う。
- `migrations/`: D1の正規データ構造と初期データを管理する。

## データフロー

フロントエンドは常に `/api/apps` を呼び出し、Pages Functionsが認証を確認した後にD1を読み取る。本番だけでなくローカルでも、`wrangler pages dev` を使ってPages Functions + D1を動かす。Google Identity Servicesから得たIDトークンはAuthorizationヘッダに載せる。

正規データはD1に保存する。管理者ログインはHttpOnly CookieとD1のセッションハッシュ、GoogleログインはIDトークンで管理し、アプリ一覧をブラウザストレージへ保存することはしない。
