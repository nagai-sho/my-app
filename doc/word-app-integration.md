# word-app統合

## 公開ルート

- `/word`: 単語カードの学習
- `/word/cards`: カード・ディレクトリの編集、CSV入出力

## API

- `/api/v1/word/cards`: カードの取得・登録・削除
- `/api/v1/word/folders`: ディレクトリの取得・登録・削除

いずれもmy-appの共通HttpOnlyセッションCookieで認証する。Google credentialはログイン時に共通セッションへ交換し、word-app独自のOAuth開始・コールバック・セッションは使用しない。

## D1

カードとディレクトリのテーブルは、my-appの共通 `DB` bindingへ統合した。IndexedDBはオフライン閲覧用のキャッシュであり、正規データではない。

- `word_folders`: 47件を移設済み
- `word_cards`: 841件を移設済み
- `migrations/0004`〜`0008`: word-appのスキーマ
- `migrations/0009`: ランチャー項目

移設元のOAuth一時stateはセッション情報ではないため、移設対象から除外した。

## 構成上の整理

word-appの独立Worker、word-app独自OAuth用の `GOOGLE_CLIENT_SECRET`、`GOOGLE_REDIRECT_URI`、`SESSION_SECRET` は使用しない。画面は `src/features/word/`、Pages Functions APIは `functions/api/v1/word/` に配置する。なお、`GOOGLE_CLIENT_SECRET` はcashbook-appのGmail OAuth用途では使用する。
