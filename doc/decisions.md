# 実装判断

## D1 binding名は `DB`

統合方針に合わせ、デプロイ時の唯一のD1 bindingは`DB`とする。word・cashbook・collection・gathererは同じmy-appのPages Functionsからこのbindingを共有し、Cloudflare上にアプリごとの追加D1 bindingやDBは作成しない。

## リンクはアンカー要素で実装

アプリカードは `window.location.href` の直接操作ではなく、通常の `<a href>` として実装した。同一タブ遷移を標準にしつつ、Ctrl/Cmdクリック、中クリック、ブラウザの長押し操作を標準挙動として利用できる。ヘッダーメニューでは全カードを新規タブで開くUI状態も切り替えられる。

## Googleトークン検証

認証処理はフロントでGoogle Identity Servicesに委譲し、Pages FunctionsではGoogle公開JWKを使ってRS256署名を検証する。署名だけでなくissuer、audience、exp、email_verified、許可メールアドレスを検証し、成功したcredentialは`app_sessions`のHttpOnly Cookieへ交換する。以後の機能APIはCookieだけを使い、Google ID tokenをlocalStorageやAuthorizationヘッダへ保持しない。

## 管理者ログイン

ローカル確認用に`USER_NAME` / `PASSWORD`ログインは残すが、Googleログインと同じ`app_sessions`・同じHttpOnly Cookieを発行する。資格情報やGoogle credentialはブラウザへ保存せず、`/api/apps`を含む全APIは共通セッションだけを検証する。

## 認証とAPIモードの一本化

ユーザー要望により、開発用ログイン、認証バイパス、モック/実API切替、実行環境識別を廃止した。対象は `VITE_ENABLE_DEV_LOGIN`、`BYPASS_AUTH`、`VITE_API_MODE`、`RUNTIME_ENV` である。フロントエンドは常にmy-appの共通Pages Functions APIを呼び出し、認証はGoogleログインまたは管理者ログインから共通セッションへ統一する。ローカル確認も`wrangler pages dev`とローカルD1を使う。

## word-appの統合

my-appを複数機能共通の単一サイトとし、word-appを `/word` と `/word/cards` に統合した。word-appの独立Worker、独自OAuth画面は採用せず、画面は `src/features/word/`、APIは `functions/api/v1/word/`、D1は共通の `DB` bindingを使用する。word-appのカード・フォルダ用テーブルはmy-appのmigration番号 `0004`〜`0008` に移設し、`0009` でランチャー項目を登録する。word APIの認証は共通のHttpOnlyセッションCookieに統一する。

## cashbook-appの統合

cashbook-appも同じ単一サイトへ移設し、画面を `src/features/cashbook/`、APIを `functions/api/v1/cashbook/` と `functions/lib/cashbook*`、D1を共通の `DB` bindingへ統合した。Cashbook固有のテーブル名には `cashbook_` prefixを付け、word-appのテーブルや既存の `app_oauth_states` と衝突させない。Gmail OAuthの一時stateは `cashbook_oauth_states` に分離する。

word-appの独自OAuth用Secretは使用しないが、CashbookのGmail OAuthでは `GOOGLE_CLIENT_SECRET` を使用する。どのアプリから呼び出しても認証入口は共通のセッションCookieに統一する。

## collection-appの統合

collection-appも同じ単一サイトへ移設し、画面を `src/features/collection/`、APIを `functions/api/v1/collection/` と `functions/lib/collection*`、メタデータを共通の `DB` bindingへ統合した。collection固有のOAuth・セッションは採用せず、共通のセッションCookieに統一する。

collectionの既存D1データは `collection_documents` と `collection_folders` へ移し、既存のR2キーを保持した。`COLLECTION_R2` bindingは既存バケット `collection-app-image` を参照し、ファイルAPIはcanonicalキーを優先して旧キーへフォールバックする。フォルダ移動はR2オブジェクトを移動せず、D1の `folder_path` だけを更新する。

## gatherer-appの統合

gatherer-appをmy-app内の機能として`/gatherer`と`/api/v1/gatherer/*`へ統合した。旧来の`users`、`sources`、`rules`、`items`、`fetch_runs`、`tasks`、`task_logs`は共有D1で衝突しないよう`gatherer_` prefixのテーブルへ移し、全データを`owner_id = 'owner'`で管理する。収集処理は`functions/_scheduled.ts`の共通ロジックへ移し、外部取得は10秒タイムアウト・最大3回・指数バックオフとする。Pagesの自動CronはCloudflare側のスケジューラ／Worker Cron設定が必要で、アプリごとのサイトやWorkerを作成しない。切替前は`npm run backup:cutover`でD1全体とcollectionのR2オブジェクトを退避し、必要に応じて`npm run migrate:gatherer`で旧D1から変換SQLを生成する。
