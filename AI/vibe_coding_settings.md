# アプリ概要

- 名称: my-app（自分専用のアプリランチャー）
- 目的: 自分が作成・運用中の複数アプリへの入口を1つに統合し、Cloudflare Pages/Workers 側のプロジェクト数を抑制する
- 対象端末: スマホ/PC 両対応（スマホ優先）
- 公開範囲: 非公開（本番は Google 認証、ローカルは簡易ログインで代替）
- デプロイ/実行基盤: Cloudflare Pages + Pages Functions + Cloudflare D1
- コード/CI: GitHub + GitHub Actions（install/build/typecheck/test）

非機能要件（抜粋）
- ページ初期表示 < 1s（ネットワークに依存するが、UIは即描画→データ後追い）
- 1タップで目的アプリへ遷移できる
- スマホでのタップ領域44px以上、誤タップ抑制
- PWA/オフライン対応は後回し（MVP外）


# MVP

MVP機能
- ダッシュボード（1画面）で、登録アプリ一覧をカード（アイコン+名称+説明）で表示
- カードタップで該当アプリURLへ遷移（同一タブ遷移を既定、長押しまたは右上メニューで新規タブを選択可能に設計余地）
- 本番は Google Auth 済ユーザーのみ一覧取得可（Functionsでトークン検証）
- ローカルは Google 認証に依存しない簡易ログインで動作

完了条件
- Cloudflare Pages 上でダッシュボードが表示される
- 少なくとも3件以上のアプリが表示され、各カードをタップすると対応URLへ確実に遷移
- CI（install/build/typecheck/test）が成功
- 本番で未認証状態だと一覧APIが401を返す

スコープ外（次期以降）
- 検索/並び替えUI
- ピン留めのUI編集（MVPはデータにフラグを持つのみ）
- アイコンアップロード（R2は不要。MVPはURL指定 or 自動生成）


# UI / UX 要件

画面構成
- ルート（/）: アプリ一覧ダッシュボードのみ（ルーティングは最小）
- ダッシュボード
  - ヘッダ: タイトル「my-app」、右上にメニュー（新規タブで開く設定/並び順切替の将来拡張用）
  - 検索バーは非表示（MVP外）。スペースのみ確保しコンポーネントはダミーでOK
  - グリッド: レスポンシブ
    - スマホ: 3列ベース（横幅により2〜4列可）
    - タブレット: 4列
    - PC: 6列
  - カード要素
    - タップ領域: 最低44x44px
    - 表示: アイコン（URL or 文字モノグラム自動生成）、名称（必須）、説明（最大2行で省略表示）
    - 長押し（スマホ）/右クリック（PC）で「新規タブで開く」簡易メニュー（将来拡張でOK。MVPは通常タップのみでも可）

状態表示
- ローディング: スケルトンカード（8件表示）
- エラー: 「読み込みに失敗しました。再読み込みしてください。」リトライボタン
- 空状態: 「まだアプリが登録されていません」

アクセシビリティ/操作性
- キーボード操作でカード間ナビゲーション可能（Tab/矢印で移動、Enterで開く）
- カードにはaria-labelで「アプリ名を開く」を付与
- フォントサイズはOS既定に追従、拡大時も崩れないCSS

遷移ポリシー
- 既定は同一タブで遷移
- PC利用時の中クリック/ctrl+クリックで新規タブ（ブラウザ標準）


# 技術要件

フロントエンド
- Vite + React + TypeScript（Node.js: Active LTS、npm）
- 状態管理: Reactフックのみ（外部ライブラリ不要）
- スタイル: CSS Modules or Tailwind のどちらか（MVPはCSS Modules推奨。依存を軽量に）

バックエンド（API）
- Cloudflare Pages Functions（/functions）
- 用途: Google ID トークンの検証、D1読取（MVPは読み取りのみ）
- 提供API
  - GET /api/apps
    - 認証: 本番は Google ID トークン必須（Authorization: Bearer <token>）
    - 200: { apps: App[] }
    - 401: 未認証
    - 500: 予期せぬエラー

データ型（フロント/バック共通想定）
- App
  - id: string（ULID/UUID）
  - name: string（必須）
  - url: string（必須、https必須）
  - description?: string
  - sortOrder: number（昇順で表示、同順位はname昇順）
  - iconUrl?: string（省略時はモノグラム生成）
  - pinned: boolean（MVPは表示上先頭寄せのため使用、編集UIは後回し）
  - tags?: string[]（将来の検索用、MVPでは未使用）
  - createdAt: number（epoch ms）
  - updatedAt: number（epoch ms）

ローカル開発方針
- UIはモックAPIで最初に完成させる（開発速度優先）
- Functions + D1 連携は後段で有効化（動作検証は wrangler で個別に実行）
- 認証は以下2モード切替
  - devモード: 簡易ログイン（フロント実装・.env.localのVITE_DEV_* を参照）。Google不要
  - prodモード: Google Auth（Google Identity Services）。IDトークンを取得しAPIに添付


# インフラ / デプロイ要件

構成（infra_spec/app_architecture準拠）
- Frontend: Cloudflare Pages（静的配信）
- Backend: Pages Functions（軽量API、トークン検証）
- DB: Cloudflare D1
- Auth: Google 認証（本番）。ローカルは簡易ログイン
- リポジトリ: GitHub
- デプロイ: Cloudflare Pages と GitHub の連携（main pushで自動ビルド/デプロイ）

Cloudflare Pages 設定（本番）
- Build command: npm run build
- Output directory: dist
- Functions: /functions
- D1 binding（例）: MY_APP_DB → D1 の database をバインド
- 環境変数（Production/Previewに設定）
  - GOOGLE_CLIENT_ID（Functionsのaudience検証用に保持、フロントには渡さない）
  - ALLOWED_GOOGLE_EMAILS（カンマ区切り）
  - USER_NAME / PASSWORD（要件上は最低限設定。prodでは未使用推奨）
  - BYPASS_AUTH（false）※ Previewで一時的にtrueにして動作確認する場合あり
  - RUNTIME_ENV（production | preview）
  - VITE_GOOGLE_CLIENT_ID（フロントで参照、Build時に埋め込み。注意: プロジェクト変数としてPagesに登録）

ローカル/開発用 .env.local（コミット禁止）
- VITE_ENABLE_DEV_LOGIN=true
- VITE_DEV_USER=任意
- VITE_DEV_PASSWORD=任意
- VITE_GOOGLE_CLIENT_ID=ローカルテスト用（必要時）
- APIモード切替（任意）: VITE_API_MODE=mock | real（既定: mock）

権限
- Functionsは「トークン検証 + DB読取」のみ。重い処理は禁止


# CI/CD 要件

GitHub Actions（PR作成時 / main push時）
- 実行内容
  - actions/checkout
  - setup-node（node: lts/*、キャッシュ: npm）
  - npm ci または npm install（lockfile生成方針に合わせる。初回は npm install、その後 lockfile 固定で npm ci 推奨）
  - npm run typecheck
  - npm run build
  - npm test（存在すれば）
- 成功条件
  - 依存解決/ビルド/型チェック/テストが成功すること
- デプロイトリガ
  - Cloudflare Pages 側のGitHub連携で main push を検知しビルド/公開

サンプルworkflow（抜粋）
```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test --if-present
```

禁止事項
- GitHub Actions から Cloudflare デプロイやシークレット操作を行わない
- Cloudflare API Token をリポジトリやCIに追加しない


# データ要件

D1 スキーマ（migrations/0001_init.sql）
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  icon_url TEXT,
  pinned INTEGER NOT NULL DEFAULT 0, -- 0/1
  tags TEXT, -- JSON文字列の配列を格納（将来用）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_apps_sort_pinned ON apps (pinned DESC, sort_order ASC, name COLLATE NOCASE);
```

初期データ（migrations/0002_seed.sql 例）
```sql
INSERT INTO apps (id, name, url, description, sort_order, icon_url, pinned, tags, created_at, updated_at)
VALUES
  ('app_1','Notes','https://notes.example.com','個人メモ', 10, NULL, 1, '["tool"]', strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('app_2','Tasks','https://tasks.example.com','タスク管理', 20, NULL, 1, '["productivity"]', strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('app_3','Links','https://links.example.com','リンク集', 30, NULL, 0, '["utility"]', strftime('%s','now')*1000, strftime('%s','now')*1000);
```

API 仕様
- GET /api/apps
  - 認証: 本番で Google ID トークン必須
  - クエリ: なし（MVP）。サーバ側で ORDER BY pinned DESC, sort_order ASC, name ASC
  - レスポンス: { apps: App[] }（iconUrl は DB の icon_url を変換）
  - エラー: { error: string }

データ整合
- icon_url が NULL の場合はフロントでモノグラム描画
- url は https スキームのみ許可（関数側でバリデーション）


# 作業ルール

ブランチ戦略/PR
- 子Issue 1件 = 1ブランチ = 1PR（mobile_vibe_coding_workflow準拠）
- ブランチ名: feat/xxx, fix/xxx, chore/xxx など
- PR には「目的/変更点/確認観点」を簡潔に記載
- CI 成功をPRマージ条件にする

コーディング標準
- TypeScript strict mode
- ESLint + Prettier（推奨、MVPで最低限設定）
- 関数は小さく、UIロジックとデータ取得を分離（hooks/useApps.ts等）
- モジュール境界（例）
  - src/components/*（UIピュアコンポーネント）
  - src/features/apps/*（アプリ一覧のロジック）
  - src/lib/auth/*（Google/Dev 認証ヘルパ）
  - src/types/*（共通型定義）
  - functions/api/*（Pages Functions）
- シークレット・認証情報はコードに直書き禁止。VITE_* はビルド時埋め込みのため公開前提に注意
- 各機能がコード単位で分かれており、共通化が必須な部分以外はディレクトリ構造が明確に分かれていること
- UIdesignは平仄が合うように、共通コンポーネントを用意しそれを利用すること

テスト
- 単体テスト: ユーティリティ（並び替え、モノグラム生成）
- E2EはMVP外（後日検討）

禁止事項
- Docker 前提の手順/依存を追加しない
- node_modules をコミットしない
- 未定義の環境変数を使用しない
- 認証処理をFunctionsで自前実装しない（検証のみ）


# 初回でやってほしいこと

1. プロジェクト初期化
   - Vite(React+TS) で雛形作成
   - tsconfig strict、ESLint/Prettier 設定
   - npm scripts
     - dev: vite
     - build: vite build
     - preview: vite preview
     - typecheck: tsc --noEmit
     - test: vitest run（導入時）
2. UIモック実装（モックデータ）
   - src/types/app.ts に App 型定義
   - src/features/apps/mock/apps.json（3〜6件）
   - src/features/apps/useApps.ts（VITE_API_MODE=mock の場合にモックを返す）
   - ダッシュボード（グリッド/カード/スケルトン/エラー/空状態）
   - カードクリックで window.location.href = url
   - アイコン未指定時のモノグラム（先頭文字と背景色算出）
3. 認証（UI側）
   - devログイン画面（VITE_ENABLE_DEV_LOGIN=true の時のみ表示）
     - ユーザー名/パスワードを入力→VITE_DEV_USER/VITE_DEV_PASSWORD と照合
     - localStorage に dev-login フラグ保存、/ に遷移
   - prod表示時（VITE_ENABLE_DEV_LOGIN=false）はGoogleボタンのみ表示
4. Functions/API
   - functions/api/apps.ts 作成
     - 本番: AuthorizationヘッダからGoogle IDトークンを受け取り、署名/exp/audを検証、email が ALLOWED_GOOGLE_EMAILS に含まれるか確認（許容失敗時401）
     - 開発（BYPASS_AUTH=true のとき）: 認証スキップ
     - D1 から SELECT し JSON 返却
5. D1
   - migrations/0001_init.sql, 0002_seed.sql を追加
   - wrangler.toml（D1 binding: MY_APP_DB）を用意
   - ローカルで wrangler d1 を使いマイグレーション実行（任意）
6. フロントとAPIの接続
   - VITE_API_MODE=real のとき fetch('/api/apps', { headers: { Authorization: `Bearer ${idToken}` }})
   - idToken は Google Sign-In 完了時に取得（ローカルはdevログインでスキップ）
7. CI 設定
   - .github/workflows/ci.yml を配置（前述のサンプル）
8. README 整備（ビルド/実行、環境変数、D1 binding、認証、注意点）
9. GitHub リポジトリ作成→push→PR 作成→CI 通過を確認
10. Cloudflare Pages プロジェクト作成
    - GitHub 連携
    - Build command / Output dir 設定
    - D1 binding / 環境変数（本番/プレビュー）設定
    - 初回デプロイを確認


# 補足

- 本アプリは infra_spec.md / app_architecture.md に従い、バックエンドは「Cloudflare Pages Functions」を用います（Cloudflare Workers 単体は使用しない）。「Workers」記載がある既存メモは読み替えます。
- 認証は「フロントエンドでGoogleログイン、Functionsはトークン検証のみ」を厳守します。ローカル開発では VITE_ENABLE_DEV_LOGIN=true により Google 依存を回避します（本番ビルドでは false）。
- USER_NAME/PASSWORD は infra_spec の「最低限の環境変数」に従って設定しますが、MVPの本番フローでは利用しません（互換維持のため予約）。
- 画像アイコンはR2を使わず、URL指定またはモノグラムで代替します。ファイルアップロードUIはMVP外です。
- セキュリティ上、VITE_* 変数はクライアントに露出します。機密値は Functions 側の通常環境変数に置き、クライアントへは渡さない運用にしてください。
- スマホ起点運用では、生成/ビルド/テスト/デプロイはクラウド側（GitHub Actions/Pages）で行い、スマホではPRと画面確認・承認のみを基本とします。