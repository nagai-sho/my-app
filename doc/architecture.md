# アーキテクチャ

## 責務

- `src/`: Vite + React + TypeScript のフロントエンド。UI状態とAPI呼び出しを担当する。
- `src/features/apps/`: アプリ一覧の型利用、取得、並び順、アイコン表示用ロジックをまとめる。
- `src/features/cashbook/`: Cashbookのダッシュボード、取引・カテゴリ・店舗、集計、残高設定、Gmail連携をまとめる。
- `src/features/word/`: word-appの学習・編集画面、カード操作、CSV、フォルダ機能をまとめる。
- `src/lib/auth/`: Google Identity Servicesのブラウザ連携を担当する。
- `functions/api/`: Pages FunctionsのAPI。Google IDトークンまたは管理者セッションを検証し、D1の読み取り結果をフロント向け型へ変換する。`auth/login`、`auth/session`、`auth/logout` は管理者セッションを扱い、`api/v1/cashbook/` はCashbookのCRUD・集計・Gmail APIを扱う。
- `migrations/`: D1の正規データ構造と初期データを管理する。
- `public/`: 統合サイトのPWA manifest、Service Worker、アイコンを管理する。

## データフロー

ランチャーは `/api/apps` を呼び出し、Pages Functionsが認証を確認した後にD1を読み取る。Cashbookは `/cashbook`、`/cashbook/settings` から同じサイト内で表示し、データは `/api/v1/cashbook/*` で取得・更新する。word-appは `/word`、`/word/cards` と `/api/v1/word/*` を使用する。本番だけでなくローカルでも、`wrangler pages dev` を使ってPages Functions + D1を動かす。Google Identity Servicesから得たIDトークンは各APIのAuthorizationヘッダに載せる。

正規データはD1に保存する。管理者ログインはHttpOnly CookieとD1のセッションハッシュ、GoogleログインはIDトークンで管理し、アプリ一覧・Cashbookの取引・カード・フォルダをブラウザストレージへ保存することはしない。CashbookのGmail OAuth一時stateは`cashbook_oauth_states`、アクセストークンは`cashbook_gmail_tokens`に保存する。
