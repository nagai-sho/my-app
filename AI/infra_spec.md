# 実装前提（CI/CD・インフラ仕様書）

## 概要

本ドキュメントは、AI（Copilot等）が迷わず実装できるように、
事前に固定する「実行環境」「インフラ構成」「CI/CDルール」を定義する。

---

## 1. システム基本構成

- フロントエンド: Cloudflare Pages
- バックエンド: Pages Functions
- 認証: Google Auth
- データベース: Cloudflare D1
- ソース管理: GitHub
- CI/CD: GitHub Actions

---

## 2. 実行環境

- Node.js: 最新
- パッケージマネージャ: npm
- フレームワーク: Vite + React（特に指定がない場合）
- 言語: TypeScript

---

## 3. ビルド設定

### インストールコマンド

npm install

### ビルドコマンド

npm run build

### ビルド成果物の出力先

dist

---

## 4. CI/CD設定

### 実行タイミング

- Pull Request 作成時
- main ブランチへの push 時

### 実行内容

- ソースコードの取得（checkout）
- Node.js のセットアップ（最新のバージョン）
- npm install の実行
- npm run build の実行

### 目的

- ビルドが正常に完了することを保証する
- デプロイ前にエラーを検出する

---

## 5. デプロイ方法

- GitHub に push する
- Cloudflare Pages により自動でビルド・デプロイが実行される

---

## 6. 環境変数

最低限設定すること：

- USER_NAME
- PASSWORD

※ 環境変数は .env ファイルを作成し、ローカルではGoogle認証に依存しないログインが出来るようにする
本番環境はデプロイ環境側で管理すること

---

## 7. 認証方針

- Google Auth を利用する
- ログイン処理はフロントエンドで実装する
- Pages Functions ではトークンの検証のみ行う

---

## 8. API（Pages Functions）の役割

### 使用用途

- 認証トークンの検証
- 外部APIとの連携
- サーバー側でのみ実行すべき処理

### 禁止事項

- 認証処理の自前実装
- 重い処理（長時間処理・大容量処理）

---

## 9. ディレクトリ構成（例）

/ ├ src/ ├ functions/ ├ public/ ├ .github/workflows/ ├ package.json ├
tsconfig.json ├ vite.config.ts

---

## 10. AIへの実装制約

以下の条件を必ず満たすこと：

- npm install が正常に実行できること
- npm run build が成功すること
- Node.js は最新のもの前提で動作すること
- Cloudflare Pages 上で動作すること
- 環境変数は外部設定を前提とすること

---

## 11. 禁止事項

- node_modules をリポジトリに含めない
- ローカル環境依存の設定を追加しない
- 未定義の環境変数を使用しない

---

## 12. 完了条件

以下を満たした場合、実装完了とする：

- CIが正常に完了する
- デプロイが成功する
- 最低限の画面が表示される

---

## 最終方針

本仕様に従い、すべてのアプリを構築すること。
CI/CDでの自動実行を前提としてコードを生成すること。
