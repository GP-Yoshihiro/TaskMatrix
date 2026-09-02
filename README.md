# TaskMatrix

> ドキュメント（フォルダ）を中心に、AI がタスク抽出とスケジュール自動生成を行う
> Apple エコシステム最適化型プロジェクト管理ツール。

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth%20%7C%20Storage-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

---

## 目次

- [概要](#概要)
- [技術スタック](#技術スタック)
- [主要機能と実装状況](#主要機能と実装状況)
- [アーキテクチャ](#アーキテクチャ)
- [データベース構成](#データベース構成)
- [画面一覧](#画面一覧)
- [外部連携 API](#外部連携-api)
- [セットアップ](#セットアップ)
- [開発コマンド](#開発コマンド)
- [開発ルールとドキュメント](#開発ルールとドキュメント)
- [ロードマップ](#ロードマップ)

---

## 概要

TaskMatrix は、プロジェクトのドキュメントを一箇所に集約し、そこから
**タスクの抽出**と**スケジュールの自動算出**までを一貫して行うことを目指した
Web アプリケーションです。

- **ドキュメント中心**: フォルダ階層でファイルを整理し、更新履歴を保持する
- **AI による解析**: ドキュメントからタスクを抽出し、不明瞭な記述を指摘する（第2フェーズ）
- **根拠のあるスケジュール**: AI が算出理由を併記した日程案を提示する（第3フェーズ）
- **Apple エコシステム最適化**: PWA と iOS ショートカットでの利用を想定（第4フェーズ）

---

## 技術スタック

| 区分 | テクノロジー / サービス | 採用理由・役割 |
| --- | --- | --- |
| フロントエンド | Next.js 16（App Router）/ React 19 / TypeScript / PWA | Vercel と親和性が高く、レスポンシブ・PWA 対応 |
| バックエンド / DB | Supabase（PostgreSQL / Auth / Storage） | 認証、データ独立、ファイル実体管理、メタデータ管理 |
| AI エンジン | Google AI Studio（Gemini API） | 高度なテキスト・ドキュメント解析（RAG 実装） |
| デプロイ | Vercel | API 統合・CI/CD |
| コード管理 | GitHub | 本アプリのソースコード管理（アプリ内の変更履歴は Supabase が保持） |
| 対象環境 | macOS / iOS / iPadOS / watchOS（PWA・ショートカット） | Apple 端末でのシームレスな利用 |

---

## 主要機能と実装状況

凡例: ✅ 実装済み ／ 🚧 未実装（後続フェーズ）

最終更新: 2026-09-02

### ① フォルダ・ドキュメント管理 ✅

- 対応フォーマット: Excel（`.xlsx`）／ Word（`.docx`）／ PowerPoint（`.pptx`）／
  テキスト（`.txt` `.md`）／ PDF（`.pdf`）
- ファイルサイズ上限 25 MB、非公開バケットへ保存し署名付き URL でのみ配信
- アプリ内簡易 Markdown エディタ（編集とプレビューを左右に並べて表示、GFM 対応）
- **タグ**（ファイルごとに付与。ロック付きタグを付けたファイルは削除できない）

### ② AI タスク抽出・改善提案（Gemini API） ✅

- **解析・抽出**: 指定フォルダ／ドキュメントを読み込み、タスクを自動リスト化
- **品質向上**: 不透明な記述の指摘、タスク化に向けた具体的な改善・修正案の提示
- **手動調整**: 自動抽出されたタスクの手動追加・編集・削除

### ③ スケジュール自動算出 ✅

- **算出**: タスクの負荷・期限に基づき、AI が最適なスケジュール仮案を出力
- **根拠の明記**: 「なぜその日時に割り当てたか」を提案時に併記
- **確定ワークフロー**: 仮データ表示 → ユーザーの「確定」操作でカレンダーへ反映
- **連携**: Google Calendar 同期、Apple カレンダー用 `.ics` 書き出し

### ④ コンテキスト重視 AI アシスタント（RAG チャット） ✅

プロジェクト内のファイルを横断検索し、「〇〇の進捗はどう？」などの質疑応答に対応。

### ⑤ エコシステム拡張 ✅

iOS ショートカット / Webhook API を通じた、音声やショートカット経由での
タスク追加・本日の予定参照。

- ✅ 連携トークンの発行・失効、`POST /api/v1/tasks`、`GET /api/v1/tasks/today`
- ✅ PWA（オフライン表示・ホーム画面への追加）
- ✅ Google Calendar 同期（専用カレンダーへの書き出しと、日時変更の取り込み）
- ✅ Apple カレンダー用 `.ics` 書き出し

### ⑥ 変更履歴 ✅

プロジェクト内のすべてのファイルの変更を、1 つのページで追えます。
管理職の方が全体の動きを把握するための機能です。

- ファイルの**追加・編集・削除**を記録。**ファイルを削除しても履歴は残る**
- 保存するのは**変更箇所だけ**（全文は持たない）
- 1 項目 1 行で表示し、**無限スクロール**でプロジェクト始動時まで遡れる
- 「編集」を押すと画面右側に差分を表示（境界をドラッグして比率を変更・記憶）
- 検索: ファイル名・ファイル形式・年月・日付範囲・タグ
- 保存期間は**半永久**。容量が上限に近づいたときだけ、
  ロック付きタグの付いたファイルを除いて古い順に整理

**巻き戻し（版の復元）は行いません。**

### ⑦ プラットフォーム適応 UI ✅

コンポーネントは 1 セットのまま、デザイントークン（角丸・影・フォント・
アニメーション・配色）を **Apple 風 / Windows 風**で切り替えます。
初回は User-Agent で自動判定し、設定画面から手動で上書きできます。
ライト / ダークは独立した軸として両テーマに対応します。

---

## アーキテクチャ

読み取りは Server Components、書き込みは Server Actions で行います。
Supabase のキーがクライアントバンドルに載らず、全テーブルで RLS が有効です。

```
app/
  (auth)/login, (auth)/signup            認証画面
  (app)/dashboard                        ホーム
  (app)/projects                         プロジェクト一覧
  (app)/projects/[projectId]             フォルダ / ファイル一覧
  (app)/projects/[projectId]/files/[fileId]  ビューア / Markdown エディタ / タグ
  (app)/projects/[projectId]/tasks       タスク管理
  (app)/projects/[projectId]/schedule    スケジュールと Google 連携
  (app)/projects/[projectId]/chat        AI チャット（RAG）
  (app)/projects/[projectId]/history     変更履歴（一覧・差分・検索）
  (app)/settings                         表示名 / テーマ / 稼働条件 / 使用量
  api/v1/tasks                           iOS ショートカット向け API
  api/google/connect, api/google/callback  Google カレンダー連携
lib/
  domain/        純粋ロジック（検証・パス生成・差分・上限判定）※単体テストの中心
  usecases/      リポジトリを引数で受け取るユースケース
  repositories/  データアクセス（インターフェース + Supabase 実装）
  actions/       Server Actions
  supabase/      クライアント生成（server / browser / proxy）
  platform/      プラットフォーム判定とテーマ解決
components/ui/   デザイントークン駆動のプリミティブ
components/app/  画面固有コンポーネント
proxy.ts         セッション更新とルート保護（Next.js 16 で middleware から改称）
```

### データ保持戦略

| 種別 | 保存先 |
| --- | --- |
| ファイル実体（Word / Excel / PowerPoint / PDF） | Supabase Storage（非公開バケット `project-files`） |
| テキスト・Markdown の本文 | Supabase DB（`file_versions` は**現在の版のみ**保持） |
| 変更履歴 | Supabase DB（`history_entries` に**変更箇所だけ**を保持） |
| カレンダー同期 | Google Calendar API（専用カレンダー）/ `.ics` 書き出し |
| watchOS 対応 | PWA および iOS ショートカット |

---

## データベース構成

```mermaid
erDiagram
    profiles ||--o{ projects : "所有"
    projects ||--o{ folders : "含む"
    projects ||--o{ files : "含む"
    folders  ||--o{ folders : "親子"
    folders  ||--o{ files : "含む"
    files    ||--o{ file_versions : "版を持つ"
    profiles ||--o{ file_versions : "更新者"
    files    ||--o{ file_tags : "タグ付け"
    projects ||--o{ tags : "持つ"
    tags     ||--o{ file_tags : "付与"
    projects ||--o{ history_entries : "記録"

    profiles {
        uuid id PK
        text email
        text plan
        text theme
    }
    projects {
        uuid id PK
        uuid owner_id FK
        text name
        text description
    }
    folders {
        uuid id PK
        uuid project_id FK
        uuid parent_id FK
        text name
    }
    files {
        uuid id PK
        uuid project_id FK
        uuid folder_id FK
        text name
        text kind
        text storage_path
        int  current_version
    }
    file_versions {
        uuid id PK
        uuid file_id FK
        int  version
        text content
        text storage_path
        uuid author_id FK
        text note
    }
    history_entries {
        uuid id PK
        uuid project_id FK
        uuid file_id "外部キーなし"
        text file_name
        text action
        jsonb changes
        uuid author_id FK
    }
    tags {
        uuid id PK
        uuid project_id FK
        text name
        bool locked
    }
    file_tags {
        uuid file_id FK
        uuid tag_id FK
    }
```

図には中心となる表のみを示しています。このほかに次の表があります。

| 表 | 用途 |
| --- | --- |
| `tasks` | タスク（抽出元・ステータス・優先度・期限・不透明点メモ・AI 改善提案） |
| `schedules` | 確定した予定（開始/終了日時・算出理由・Google のイベント ID） |
| `extraction_runs` | AI 抽出の実行記録 |
| `file_chunks` / `chat_sessions` / `chat_messages` | RAG チャット（埋め込みと会話） |
| `ai_usage_logs` | AI の使用トークン量と所要時間（**追記のみ**） |
| `api_tokens` | 連携トークン（**ハッシュのみ保存**） |
| `google_connections` | Google 連携（リフレッシュトークンは**暗号化**して保存） |
| `history_entries` | 変更履歴。**ファイルに外部キーを張らない**（削除しても残すため） |
| `tags` / `file_tags` | タグとその付与（ロック付きタグはファイルの削除を防ぐ） |

### アクセス制御

全テーブルで RLS を有効化し、`projects.owner_id = auth.uid()` を起点に
フォルダ・ファイル・バージョン・Storage 実体まで所有者のみに限定しています。

---

## 画面一覧

| 画面 | パス | 状態 |
| --- | --- | --- |
| ログイン / 新規登録 | `/login` `/signup` | ✅ |
| ホーム（ダッシュボード） | `/dashboard` | ✅ |
| プロジェクト一覧 | `/projects` | ✅ |
| プロジェクト詳細 / フォルダ一覧 | `/projects/[projectId]` | ✅ |
| データ閲覧・編集（Markdown エディタ） | `/projects/[projectId]/files/[fileId]` | ✅ |
| 設定（表示テーマ・稼働条件） | `/settings` | ✅ |
| AI の使用量 | `/settings/usage` | ✅ |
| 変更履歴 | `/projects/[projectId]/history` | ✅ |
| タスク管理 | `/projects/[projectId]/tasks` | ✅ |
| スケジュール | `/projects/[projectId]/schedule` | ✅ |
| AI チャット（RAG） | `/projects/[projectId]/chat` | ✅ |
| オフライン | `/offline` | ✅ |

---

## 外部連携 API

iPhone のショートカットや Siri から利用できます。
プロジェクト画面で発行した**連携トークン**を `Authorization` ヘッダーに付けます。

```
Authorization: Bearer tmx_xxxxxxxx...
```

| メソッド | パス | 用途 |
| --- | --- | --- |
| `POST` | `/api/v1/tasks` | タスクを追加。本文は `{ "title": "..." }` |
| `GET` | `/api/v1/tasks/today` | 今日やることを取得 |

**操作できるプロジェクトはトークンが決めます。**
リクエストでプロジェクトを指定することはできません（指定しても無視されます）。
これは、他人のプロジェクト ID を指定して覗く経路を構造的に断つためです。

- トークンは**発行直後の 1 回だけ**全文を表示します。保存されるのはハッシュのみです
- 認証失敗はすべて `401` で、理由を書き分けません
- トークン 1 本あたり**毎分 60 回**まで。超えると `429` と `Retry-After` を返します
- `GET /api/v1/tasks/today` の `summary` は日本語の 1 行で、そのまま読み上げに使えます

詳細は [`docs/specs/2026-09-01-shortcuts-api-design.md`](./docs/specs/2026-09-01-shortcuts-api-design.md) を参照してください。

---

## セットアップ

### 前提

- Node.js 20 以上
- Supabase プロジェクト（PostgreSQL / Auth / Storage）

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、
Supabase の値を記入します。`.env.local` はコミットしないでください。

```bash
cp .env.local.example .env.local
```

| 変数 | 用途 | 公開範囲 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | クライアント可 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名キー（RLS 前提） | クライアント可 |
| `SUPABASE_SERVICE_ROLE_KEY` | ショートカット / Webhook API で使用。**RLS を通らない強い権限** | **サーバー専用** |
| `GEMINI_API_KEY` | AI タスク抽出・スケジュール算出・RAG チャット | **サーバー専用** |
| `GEMINI_MODEL` | 使用するモデル（省略時は既定値） | **サーバー専用** |
| `GEMINI_FALLBACK_MODEL` | 混雑時に切り替えるモデル | **サーバー専用** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google カレンダー連携の OAuth | **サーバー専用** |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | リフレッシュトークンの暗号化鍵（base64 の 32 バイト） | **サーバー専用** |

**「サーバー専用」の変数に `NEXT_PUBLIC_` を付けないでください。**
付けるとクライアントのバンドルに含まれ、第三者から読み取れる状態になります。

暗号化鍵は次のコマンドで作れます。

```bash
openssl rand -base64 32
```

### Google カレンダー連携を使う場合

Google Cloud で次の準備が必要です。

1. プロジェクトを作成し、**Google Calendar API を有効化**する
2. OAuth 同意画面を設定し、利用するアカウントを**テストユーザーに追加**する
3. OAuth クライアント ID（ウェブアプリケーション）を作成し、
   承認済みリダイレクト URI に `http://localhost:3000/api/google/callback` を追加する

要求する権限は `calendar.app.created` のみで、
**このアプリが作ったカレンダーしか読み書きできません。**

公開ステータスが「テスト」の間、**リフレッシュトークンは 7 日で失効します**（Google の仕様）。
失効すると画面に再接続を促す表示が出ます。

### 3. データベースの初期化

`supabase/migrations/` の SQL を番号順に適用します。
Supabase ダッシュボードの SQL Editor、または Supabase CLI を使用してください。

```bash
supabase db push
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` を開き、`/signup` からアカウントを作成します。

> **メール確認について**
> Supabase はデフォルトでメール確認が有効です。ローカル開発では
> Authentication → Providers → Email の「Confirm email」を
> 無効化しておくと検証が容易になります。

---

## 開発コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバーを起動 |
| `npm run lint` | ESLint による静的検査 |
| `npm run typecheck` | ルート型生成 + `tsc --noEmit` |
| `npm test` | Vitest によるテスト実行 |
| `npm run test:watch` | テストの監視実行 |

コミット前に `lint` → `typecheck` → `test` → `build` をすべて通してください。

---

## 開発ルールとドキュメント

本リポジトリでの作業規則は [`CLAUDE.md`](./CLAUDE.md) に定義しています。
主な内容は、機能ごとのブランチ運用、テスト駆動開発、
検証がグリーンでない状態でのコミット禁止、秘密情報の取り扱いです。

| ドキュメント | 内容 |
| --- | --- |
| [`CLAUDE.md`](./CLAUDE.md) | 開発時の動作規則 |
| [`docs/specs/`](./docs/specs) | 設計書 |
| [`docs/plans/`](./docs/plans) | 実装計画 |
| [`supabase/migrations/`](./supabase/migrations) | データベースマイグレーション |

---

## ロードマップ

| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| **P1 基盤** | 認証 / プロジェクト / フォルダ・ファイル / Markdown エディタ / バージョン履歴 / ダッシュボード / プラットフォームテーマ | ✅ 完了 |
| **P2 AI** | Gemini によるタスク抽出・改善提案、タスク管理画面 | ✅ 完了 |
| **P3 スケジュール** | AI 日程算出、カレンダー UI、`.ics` 書き出し | ✅ 完了 |
| **P4 拡張** | RAG チャット、PWA 完全対応、iOS ショートカット / Webhook API | ✅ 完了 |
| **P5 連携** | Google Calendar 同期 | ✅ 完了 |
| **P6 変更履歴** | 履歴の記録・一覧・差分表示・検索・タグ・容量監視 | ✅ 完了 |
