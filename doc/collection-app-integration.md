# collection-app 統合メモ

## 方針

collection-appをmy-appの `/collection` 配下の機能として統合した。collection専用の認証・Router・Worker・D1は追加せず、my-appの共通認証、Viteビルド、Pages Functions、共通D1を利用する。

## 移設した機能

- 書籍一覧、書籍作成・名称変更・削除
- ディレクトリ一覧、作成・移動・名称変更・削除
- 画像・PDFの複数アップロード、サムネイル生成、並び替え、一括移動・削除
- 画像ビューア、PDFページ描画、拡大縮小、前後ページ移動、キーボード・スワイプ操作
- `/api/v1/collection/*` の文書・フォルダ・R2ファイルAPI
- 旧 `/api/files?key=...` の読み取り互換API

## 認証

管理者ログインはmy-appの `USER_NAME` / `PASSWORD` と共通のHttpOnlyセッションCookieを利用する。Google credentialも共通セッションへ交換する。collection-app固有のOAuth状態・セッションテーブルは作成しない。

R2ファイルは同一サイトの共通Pages Functions APIから取得し、所有者確認後に`private, no-store`で返す。Service WorkerはAPIと非公開ファイルをキャッシュしない。

## D1データ

`0012_collection_initial.sql` で次のテーブルを作成する。

- `collection_documents`
- `collection_folders`

collection-appのD1から既存データを対象テーブルだけに限定して移行した。移行後の確認値は文書1,838件、フォルダ35件、サムネイル1,838件である。所有者IDはmy-app共通の `owner` を使用する。

## R2データ

`wrangler.toml` の `COLLECTION_R2` bindingは既存バケット `collection-app-image` を参照する。既存データの切替直後も旧キーを読めるようにしているが、正規キーへのコピーは外部データを変更するため未実行である。

既存データのキーは旧形式のままD1へ保持し、新規アップロードは次の正規キーへ保存する。

```text
collection/owner/<document-id>/original
collection/owner/<document-id>/thumbnail
```

ファイル取得は正規キー、既存D1に保持した旧キーの順に解決する。フォルダ移動ではR2キーを変更せず、D1の `folder_path` だけを更新する。

切替前のR2キー監査・コピー・D1更新は、次のスクリプトで実施する。引数なしは監査モードで、`--apply`または`MY_APP_R2_MIGRATION_APPLY=1`を指定した場合だけ正規キーへのコピーとD1更新を行う。失敗した文書はD1のキーを変更せず、旧キーでの読み出しを維持する。

```bash
npm run migrate:collection-r2
MY_APP_R2_MIGRATION_APPLY=1 npm run migrate:collection-r2
```

## ルートとAPI

- `/collection`
- `/collection/books/edit`
- `/collection/books/detail?path=...`
- `/collection/gallery`
- `/collection/viewer/:id`
- `/api/v1/collection/documents`
- `/api/v1/collection/folders`
- `/api/v1/collection/files`

トップ画面のランチャーには `collection-app` を登録し、アイコンは `/icons/collection.svg` を使用する。
