# 図面ドラフト統合メモ

## 配置と境界

- 画面とAPIクライアントは `src/features/arch-draft-app/` に置き、 `/arch-draft-app` で表示する。
- Pages Functions の入口は `functions/api/v1/arch-draft-app/`、機能ロジックは `functions/lib/arch-draft-app/` に置く。
- D1は既存の `DB` binding（my-appデータベース）を使い、全テーブルに `arch_draft_` prefixを付ける。
- ファイルは専用 `ARCH_DRAFT_R2` binding（`arch-draft-app-image`）を使い、R2キーを `arch-draft-app/` 以下に限定する。アップロードはPages Functionsへstreamで送り、最大100MBで打ち切る。
- 画面ルートはmy-app共通ログインで保護する。APIも既存のHttpOnlyセッションを確認し、認証方式は新設しない。図面単位のowner/editor/viewer権限は後続対応とする。
- アプリ追加による共通側の変更は、Reactルートとランチャーmigrationの1項目だけに限る。

## MVPの操作

1. UTF-8テキスト形式の`.jww`または`.jwc`をテンプレートとして登録する（2MBまで）。
2. ファイル内の`${UPPER_CASE_NAME}`を自動検出し、作成画面で値を入力する。
3. 差し替えた内容を図面v1としてR2へ保存する。
4. `.jww` / `.jwc`（100MBまで）をアップロードし、図面または既存図面の新しい版として保存する。
5. バージョン詳細から元ファイルをダウンロードする。
6. DXFジョブを作成する。実CAD変換API接続前は、図形を変換しないモックDXFを出力する。

## APIとデータ

- `GET/POST /api/v1/arch-draft-app/templates`
- `GET /api/v1/arch-draft-app/drawings`
- `GET /api/v1/arch-draft-app/drawings/:id`
- `POST /api/v1/arch-draft-app/drawings`（テンプレートから作成）
- `POST /api/v1/arch-draft-app/drawings/upload`（新規図面または版をアップロード）
- `POST /api/v1/arch-draft-app/jobs`（DXFモックジョブ）
- `GET /api/v1/arch-draft-app/files/:id/download`

`migrations/0025_arch_draft_app.sql`は共有DBに機能専用テーブルとランチャー項目を追加する。適用する場合は既存の `npm run d1:migrate:local` / `npm run d1:migrate` を使う。D1作成・binding追加・環境変数追加は不要。

## 未対応

- 実CAD変換API、外部ジョブcallback、署名付きURL、DXF/DWG品質確認。
- 図面単位の共有権限、編集ロール、監査ログ。
- `${...}` 差し替えはUTF-8テキストテンプレートを対象とし、JWバイナリのベクタ編集や描画は行わない。
- 現在のDXF出力はヘッダーと「図形未変換」のコメントを含む確認用ファイルで、CAD変換済み成果物として利用できない。
