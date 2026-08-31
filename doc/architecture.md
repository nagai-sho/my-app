# アーキテクチャ

## 責務

- `src/`: Vite + React + TypeScript のフロントエンド。UI状態とAPI呼び出しを担当する。
- `src/features/apps/`: アプリ一覧の型利用、モック、取得、並び順、アイコン表示用ロジックをまとめる。
- `src/lib/auth/`: ローカル簡易ログインとGoogle Identity Servicesのブラウザ連携を担当する。
- `functions/api/apps.ts`: Pages Functionsの `GET /api/apps`。認証トークンを検証し、D1の読み取り結果をフロント向け型へ変換する。
- `migrations/`: D1の正規データ構造と初期データを管理する。

## データフロー

ローカルの通常開発ではモックJSONを使い、UIを即時確認できる。`VITE_API_MODE=real` にするとフロントは `/api/apps` を呼び出す。本番ではGoogle Identity Servicesから得たIDトークンをAuthorizationヘッダに載せ、Pages Functionsが検証した後にD1を読み取る。

正規データはD1に保存し、ブラウザストレージには開発ログインの状態だけを保存する。アプリ一覧自体をlocalStorageへ保存することはしない。
