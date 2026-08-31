# 実装判断

## D1 binding名は `DB`

インフラ資料には `MY_APP_DB` の例もあるが、プロジェクト固有の `AI/AGENTS.md` で `DB` に固定されているため、`wrangler.toml`、Functions、ドキュメントのすべてで `DB` を採用した。

## リンクはアンカー要素で実装

アプリカードは `window.location.href` の直接操作ではなく、通常の `<a href>` として実装した。同一タブ遷移を標準にしつつ、Ctrl/Cmdクリック、中クリック、ブラウザの長押し操作を標準挙動として利用できる。ヘッダーメニューでは全カードを新規タブで開くUI状態も切り替えられる。

## Googleトークン検証

認証処理はフロントでGoogle Identity Servicesに委譲し、FunctionsではGoogle公開JWKを使ってRS256署名を検証する。署名だけでなくissuer、audience、exp、email_verified、許可メールアドレスを検証し、検証失敗時は一覧を返さない。

## 管理者ログイン

ユーザー要望により、Google認証に加えて `USER_NAME` / `PASSWORD` による管理者ログインを追加した。資格情報はブラウザへ埋め込まず、`POST /api/auth/login` でFunctions側だけが照合する。成功時はランダムなセッションIDのSHA-256ハッシュをD1へ保存し、HttpOnly・SameSite Cookieを発行する。`/api/apps` はこのセッションまたはGoogle IDトークンのいずれかが有効な場合に一覧を返す。

## 認証とAPIモードの一本化

ユーザー要望により、開発用ログイン、認証バイパス、モック/実API切替、実行環境識別を廃止した。対象は `VITE_ENABLE_DEV_LOGIN`、`BYPASS_AUTH`、`VITE_API_MODE`、`RUNTIME_ENV` である。フロントエンドは常にPages FunctionsのAPIを呼び出し、認証はGoogleログインまたは `USER_NAME` / `PASSWORD` による管理者ログインに統一する。ローカル確認も `wrangler pages dev` とローカルD1を使う。
