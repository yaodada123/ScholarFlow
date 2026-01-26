# DeerFlow TS（非公式）

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

このリポジトリは、ByteDance のオープンソースプロジェクト **DeerFlow** の **非公式 TypeScript 再実装**です。既存の Web UI をできるだけ変更せずに、サーバー側を TypeScript に移行することを目標にしています。

- 原版（クレジット）：https://github.com/bytedance/deer-flow

## デモ

### ビデオ

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## 現状（機能概要）

- サーバー & プロトコル
  - Fastify + TypeScript（ESM）
  - SSE ストリーミング：`POST /api/chat/stream`
  - 設定：`GET /api/config`（models と `rag.provider` を返却）
- マルチエージェント（Planning + Research）
  - Coordinator：雑談の直答か研究フローに入るかを判断
  - Planner：構造化された研究計画を生成（人間のフィードバック編集 / 自動承認に対応）
  - Researcher：検索・取得（ローカル RAG / 任意で Web Search）を実行し Observations を蓄積
  - Reporter：計画と観察をもとに最終 Markdown レポートを生成（report style 対応）
- ローカル RAG（最小構成の閉ループ）
  - アップロード：`POST /api/rag/upload`（`.md` / `.txt` のみ）
  - 一覧/検索：`GET /api/rag/resources?query=`
  - 参照：入力欄で `@` からリソース選択、URI は `rag://local/<file>`
  - 取得注入：`data/rag/<file>` の抜粋を読み込みワークフローへ注入
- Web Search（任意）
  - Tavily 連携（`TAVILY_API_KEY` を設定すると有効）
  - フロントエンドのスイッチ `enable_web_search` で制御
- MCP（互換用プレースホルダ）
  - `POST /api/mcp/server/metadata`（設定画面の連携用）

> 注：全体としては “復刻進行中” です。現時点では Web UI 互換とコアフローの閉ループを優先しています。

## クイックスタート

### 環境要件

- Node.js >= 20

### 依存関係のインストール

リポジトリ直下：

```bash
npm install
```

フロントエンド依存は `web/` 配下（初回のみ）：

```bash
cd web
npm install
```

### 環境設定（.env）

デフォルトでリポジトリ直下の `.env` を読み込みます（サーバーは `dotenv`、フロント dev は `dotenv -f ../.env` で注入）。

まずはサンプルから：

```bash
cp .env.example .env
```

最低限、動く LLM 設定を 1 つ用意してください（例）：

```ini
BASIC_MODEL__MODEL=
BASIC_MODEL__API_KEY=
# BASIC_MODEL__BASE_URL=https://api.openai.com/v1
```

> 注意：`.env` には秘密情報が含まれることが多いので、公開リポジトリにコミットしないでください。

### 起動（推奨：前後端まとめて）

```bash
npm run dev:all
```

- フロントエンド：`http://localhost:3000`
- バックエンド：`http://localhost:8000`

### 個別起動

```bash
npm run dev:server
npm run dev:web
```

## ディレクトリ構成

- `src/server/`：TS バックエンド
- `data/rag/`：ローカル RAG ファイル保存先（アップロードがここに落ちます）
- `web/`：原版 Web UI（互換ターゲット）

## よく使う設定（環境変数）

- `NEXT_PUBLIC_API_URL`：フロントエンドが叩く API のベース URL（例：`http://localhost:8000/api`）
- `PORT`：バックエンドのポート（デフォルト 8000）
- `ALLOWED_ORIGINS`：CORS 許可リスト（デフォルト `http://localhost:3000,http://127.0.0.1:3000`)
- `RAG_PROVIDER`：RAG provider（未設定時は `local`）
- `ENABLE_MCP_SERVER_CONFIGURATION`：MCP 設定機能（デフォルト false；`npm run dev:server` / `dev:all` で有効化）
- `BASIC_MODEL__*` / `REASONING_MODEL__*`：モデル設定（最小：`BASIC_MODEL__MODEL` と `BASIC_MODEL__API_KEY`）
- `TAVILY_API_KEY`：Web Search を有効化（未設定なら自動で無効）

## Roadmap

- より完全な RAG：分割、索引、ベクトル検索/リランキング、リソース管理（削除/リネーム/ダウンロード）
- より完全な MCP：ツール発見、ツール呼び出し、ワークフローへの深い統合
- 原版 API 互換の拡充（評価、ポッドキャスト、prompt enhancer 等）
- 英語 README と多言語ドキュメントの拡充

## 免責事項

- 本プロジェクトは非公式実装であり、原版の作者/メンテナと直接の関係はありません。不適切な点があればご連絡ください。
