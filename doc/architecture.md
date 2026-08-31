# アーキテクチャ

## 責務

- `src/`: Vite + React + TypeScript のフロントエンド。UI状態とAPI呼び出しを担当する。
- `src/features/apps/`: アプリ一覧の型利用、取得、並び順、アイコン表示用ロジックをまとめる。
- `src/features/cashbook/`: Cashbookのダッシュボード、取引・カテゴリ・店舗、集計、残高設定、Gmail連携をまとめる。
- `src/features/word/`: word-appの学習・編集画面、カード操作、CSV、フォルダ機能をまとめる。
- `src/features/collection/`: collection-appの書籍一覧、ギャラリー、アップロード、ビューアをまとめる。
- `src/lib/auth/`: Google Identity Servicesのブラウザ連携を担当する。
- `functions/api/`: Pages FunctionsのAPI。Google IDトークンまたは管理者セッションを検証し、D1/R2の結果をフロント向け型へ変換する。`auth/login`、`auth/session`、`auth/logout` は管理者セッションを扱い、`api/v1/cashbook/` はCashbookのCRUD・集計・Gmail API、`api/v1/collection/` はcollectionの文書・フォルダ・ファイルAPIを扱う。
- `migrations/`: D1の正規データ構造と初期データを管理する。
- `public/`: 統合サイトのPWA manifest、Service Worker、アイコンを管理する。

## データフロー

ランチャーは `/api/apps` を呼び出し、Pages Functionsが認証を確認した後にD1を読み取る。Cashbookは `/cashbook`、`/cashbook/settings`、word-appは `/word`、`/word/cards`、collection-appは `/collection` とその配下から同じサイト内で表示し、それぞれのAPIで取得・更新する。本番だけでなくローカルでも、`wrangler pages dev` を使ってPages Functions + D1/R2を動かす。Google Identity Servicesから得たIDトークンは各APIのAuthorizationヘッダに載せる。

正規データはD1に保存する。管理者ログインはHttpOnly CookieとD1のセッションハッシュ、GoogleログインはIDトークンで管理し、アプリ一覧・Cashbookの取引・カード・collectionの文書メタデータをブラウザストレージへ保存することはしない。collectionの原本・サムネイルは既存R2バケットを `COLLECTION_R2` bindingで参照し、ファイルAPIが所有者確認後に非公開レスポンスとして返す。CashbookのGmail OAuth一時stateは`cashbook_oauth_states`、アクセストークンは`cashbook_gmail_tokens`に保存する。
