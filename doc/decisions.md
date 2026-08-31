# 実装判断

## D1 binding名は `DB`

インフラ資料には `MY_APP_DB` の例もあるが、プロジェクト固有の `AI/AGENTS.md` で `DB` に固定されているため、`wrangler.toml`、Functions、ドキュメントのすべてで `DB` を採用した。

## リンクはアンカー要素で実装

アプリカードは `window.location.href` の直接操作ではなく、通常の `<a href>` として実装した。同一タブ遷移を標準にしつつ、Ctrl/Cmdクリック、中クリック、ブラウザの長押し操作を標準挙動として利用できる。ヘッダーメニューでは全カードを新規タブで開くUI状態も切り替えられる。

## Googleトークン検証

認証処理はフロントでGoogle Identity Servicesに委譲し、FunctionsではGoogle公開JWKを使ってRS256署名を検証する。署名だけでなくissuer、audience、exp、email_verified、許可メールアドレスを検証し、検証失敗時は一覧を返さない。
