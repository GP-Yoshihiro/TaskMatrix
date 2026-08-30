# TaskMatrix 第1フェーズ（基盤フェーズ）設計書

- 作成日: 2026-08-30
- 対象: P1 基盤フェーズ
- 一次仕様: `README.md`
- 動作規則: `CLAUDE.md`
- ステータス: 承認済み（2026-08-30）

---

## 1. 背景と目的

`README.md` の仕様は 9 画面・AI タスク抽出・スケジュール自動算出・カレンダー双方向同期・
RAG チャット・PWA / watchOS 連携を含む大規模なものである。
一度の設計・実装サイクルでは検証が破綻するため、4 フェーズに分割し、本書は **P1（基盤フェーズ）** のみを対象とする。

P1 の目的は、後続フェーズがすべて乗る土台
（認証境界・データ境界・ファイル実体管理・履歴・UI 基盤）を、
動作確認可能な状態で完成させることである。

## 2. フェーズ分割

| フェーズ | 内容 | 本書の対象 |
|---|---|---|
| **P1 基盤** | 認証 / プロジェクト / フォルダ・ファイル / Markdown エディタ / バージョン履歴 / ダッシュボード / プラットフォームテーマ | ✅ |
| P2 AI | Gemini によるタスク抽出・改善提案、タスク管理画面 | ─ |
| P3 スケジュール | AI 日程算出、カレンダー UI、Google Calendar 同期 / .ics 入出力 | ─ |
| P4 拡張 | RAG チャット、PWA 完全対応、iOS ショートカット / Webhook API、GitHub 履歴連携 | ─ |

P1 は P2〜P4 を後から差し込める形にする。具体的には次の 3 点を設計に織り込む。

1. データアクセスをリポジトリインターフェース越しにし、実装を差し替え可能にする
2. `file_versions` を P1 から持ち、P4 の GitHub 連携時に同期元として使えるようにする
3. すべてのデータをプロジェクト単位で境界付け、P2 の AI 解析・P4 の RAG 検索の範囲を明確にする

## 3. 確定した仕様判断

`README.md` に曖昧さがあった箇所について、以下を確定事項とする。

| 論点 | README の記述 | 確定 |
|---|---|---|
| 認証方式 | 「Supabase Auth」のみ | **メールアドレス＋パスワード**。OAuth は将来拡張 |
| プロジェクト上限 | 「Free: 5 / Pro: 無制限」と「最大 20 個」が併記 | **全ユーザー一律 20 個**。`profiles.plan` 列は持つが P1 では制御に用いない |
| テキスト履歴の保存先 | 「Supabase DB および GitHub API」 | **P1 は Supabase DB のみ**。GitHub 連携は P4 |
| UI | 「Apple エコシステム最適化」 | **共通基盤 1 セット＋プラットフォーム別デザイントークン**（Apple / Windows）。操作感の差のみテーマで表現 |

## 4. 技術スタック

| 区分 | 採用 |
|---|---|
| フレームワーク | Next.js（App Router）/ React / TypeScript（strict） |
| スタイル | Tailwind CSS + CSS 変数によるデザイントークン層 |
| UI 部品 | 自前プリミティブ（外部 UI ライブラリは不採用） |
| バックエンド | Supabase（PostgreSQL / Auth / Storage） |
| セッション | `@supabase/ssr`（Cookie ベース） |
| 入力検証 | Zod |
| テスト | Vitest + @testing-library/react |
| 静的検査 | ESLint + `tsc --noEmit` |

Supabase プロジェクト: `TaskMatrix`（リージョン `ap-northeast-1`、無料プラン）

## 5. アーキテクチャ

### 5.1 採用方針

**Server Components で読み取り、Server Actions で書き込み**を行う。

採用理由:

- Supabase の Service Role Key・将来の Gemini API キーがクライアントバンドルに載らない（`CLAUDE.md` R-14）
- API 層を別途設けないため実装量が最小になる
- Next.js / Vercel の標準構成であり、後から Route Handlers を追加しても共存できる

不採用とした案:

- **Route Handlers + クライアント fetch**: P4 の Webhook API には有利だが、P1 では層が 1 つ増えるだけ。必要になった時点で追加する
- **クライアント直 Supabase SDK**: RLS のみが防御線になり、P2 以降のサーバー側 AI 処理と噛み合わない

### 5.2 ディレクトリ構成

```
app/
  (auth)/login/                        ログイン
  (auth)/signup/                       サインアップ
  (app)/dashboard/                     ホーム（本日の更新・プロジェクト数）
  (app)/projects/                      プロジェクト一覧
  (app)/projects/[projectId]/          フォルダ / ファイル一覧
  (app)/projects/[projectId]/files/[fileId]/          ビューア / Markdown エディタ
  (app)/projects/[projectId]/files/[fileId]/history/  バージョン履歴・差分
  (app)/settings/                      テーマ設定
lib/
  domain/          純粋ロジック（検証・パス生成・差分・上限判定）
  repositories/    データアクセス（interface + Supabase 実装）
  supabase/        クライアント生成（server / browser / middleware）
  platform/        プラットフォーム判定とテーマ解決
  actions/         Server Actions
components/ui/     トークン駆動プリミティブ
components/app/    画面固有コンポーネント
```

各ユニットは「何をするか・どう使うか・何に依存するか」を単独で説明できる粒度に保つ。
`lib/domain` は外部依存を持たず、単体テストの中心とする。

## 6. データモデル

### 6.1 テーブル

```
profiles
  id           uuid PK  -> auth.users(id)
  email        text
  plan         text     default 'free'
  theme        text     default 'auto'   -- 'auto' | 'apple' | 'windows'
  created_at   timestamptz

projects
  id           uuid PK
  owner_id     uuid     -> profiles(id)
  name         text
  description  text
  created_at   timestamptz
  updated_at   timestamptz

folders
  id           uuid PK
  project_id   uuid     -> projects(id) ON DELETE CASCADE
  parent_id    uuid     -> folders(id)  NULL = ルート
  name         text
  created_at   timestamptz
  updated_at   timestamptz

files
  id              uuid PK
  project_id      uuid  -> projects(id) ON DELETE CASCADE
  folder_id       uuid  -> folders(id)  NULL = プロジェクト直下
  name            text
  kind            text  -- 'markdown' | 'text' | 'binary'
  mime_type       text
  size            bigint
  storage_path    text  -- binary のみ
  current_version int   default 1
  created_by      uuid  -> profiles(id)
  created_at      timestamptz
  updated_at      timestamptz

file_versions
  id           uuid PK
  file_id      uuid  -> files(id) ON DELETE CASCADE
  version      int
  content      text  -- markdown / text の全文スナップショット
  storage_path text  -- binary の版ごとの実体
  size         bigint
  author_id    uuid  -> profiles(id)
  note         text
  created_at   timestamptz
  UNIQUE (file_id, version)
```

### 6.2 アクセス制御（RLS）

全テーブルで RLS を有効化する。判定の起点は `projects.owner_id = auth.uid()`。

- `projects`: `owner_id = auth.uid()`
- `folders` / `files`: 所属 `project_id` が上記条件を満たすこと
- `file_versions`: 所属 `file_id` の `project_id` が上記条件を満たすこと
- `profiles`: `id = auth.uid()`

サインアップ時に `auth.users` への挿入をトリガーで受け、`profiles` 行を自動生成する。

### 6.3 プロジェクト上限

上限は 20 件。二重に防御する。

1. `projects` の INSERT 前トリガーで所有件数を数え、20 件以上なら例外を送出（整合性の担保）
2. Server Action 側でも事前に件数を確認し、日本語のエラーメッセージを返す（UX）

### 6.4 ファイル実体（Supabase Storage）

- バケット `project-files`（private）
- パス: `{project_id}/{file_id}/{version}/{file_id}.{拡張子}`
  - Supabase Storage は非 ASCII のオブジェクトキーを `InvalidKey` で拒否するため、
    日本語ファイル名をキーに使えない。表示名は `files.name` に保持し、
    ダウンロード時に署名付きURLの `download` パラメータで復元する
- 配信は署名付き URL のみ。公開 URL は発行しない
- 対応形式: `.xlsx` `.docx` `.pptx` `.pdf` `.txt` `.md`
- サイズ上限: 25 MB（`lib/domain` の定数として一元管理）

### 6.5 バージョン履歴

- `markdown` / `text`: 保存のたびに `file_versions.content` へ全文スナップショットを追加。差分表示はアプリ側で生成
- `binary`: 版ごとに Storage 実体を保持し、`file_versions` にメタデータを記録。差分表示は行わず、版の一覧とダウンロードを提供
- `files.current_version` が最新版を指す

## 7. プラットフォーム適応 UI

### 7.1 方針

基盤は共通とし、プラットフォームによる差はデザイントークンで表現する。
コンポーネントは 1 セットのみ実装し、二重実装は行わない。

### 7.2 トークン

CSS 変数として次を定義し、`apple` / `windows` の 2 テーマで値を切り替える。

`--radius-*` / `--shadow-*` / `--font-ui` / `--space-unit` / `--motion-duration` /
`--motion-easing` / `--color-*`（背景・前景・境界・アクセント・危険）

ライト / ダークは独立した軸とし、両テーマそれぞれに対応する。

### 7.3 解決順序

1. `profiles.theme` が `apple` / `windows` なら、それを採用
2. `auto` の場合は User-Agent から判定（Apple 系プラットフォーム → `apple`、それ以外 → `windows`）
3. 判定結果を Cookie に保存し、初回描画のちらつきを防ぐ

設定画面から手動で上書きできる。

### 7.4 挙動の差

差が大きい箇所のみ、テーマ値に応じて挙動を分岐させる。

- モーダル表現: `apple` はボトムシート寄り、`windows` は中央ダイアログ
- 主ボタンの配置順
- アニメーションの時間と減衰

## 8. エラー処理

- Server Action の戻り値は判別可能ユニオン
  `{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }`
  とし、例外を UI に投げっぱなしにしない。`message` は日本語
- 入力は Zod スキーマで検証。ファイルは拡張子・MIME・サイズを検証
- 各ルートセグメントに `error.tsx` と `not-found.tsx` を配置
- 想定エラーコード: `UNAUTHENTICATED` / `FORBIDDEN` / `NOT_FOUND` / `VALIDATION_ERROR` /
  `PROJECT_LIMIT_EXCEEDED` / `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` / `STORAGE_ERROR` / `UNKNOWN`

## 9. テストと検証

### 9.1 テスト方針

`CLAUDE.md` R-12 に従い、テストを先に書く。

- **単体（Vitest）**: `lib/domain` の純粋ロジック
  — ファイル種別判定、サイズ・拡張子検証、Storage パス生成、
  プロジェクト上限判定、フォルダ階層の組み立て、テキスト差分
- **ユースケース（Vitest）**: モックリポジトリを用いた Server Action のロジック
- **コンポーネント（@testing-library/react）**: フォームの検証表示、テーマ切り替え

### 9.2 検証セット

各区切りで次をすべて実行し、グリーンであることを確認してからコミットする（R-05 / R-06）。

```
npm run lint
npm run typecheck
npm test
npm run build
```

加えて、画面が関わる変更では開発サーバーを起動し、実際の表示と操作を確認する。

### 9.3 P1 で導入しないもの

E2E テスト（Playwright）は P1 では導入しない。ブラウザでの実操作確認で代替する。

## 10. ブランチ計画

`CLAUDE.md` R-03 に従い、機能ごとにブランチを切る。

| 順 | ブランチ | 内容 |
|---|---|---|
| 1 | `docs/spec-p1` | 動作規則（`CLAUDE.md`）と本設計書 |
| 2 | `chore/scaffold` | Next.js / TS / Tailwind / Vitest / ESLint 初期化、環境変数雛形 |
| 3 | `feature/platform-theme` | デザイントークン層とテーマ切り替え |
| 4 | `feature/auth` | サインアップ・ログイン・ログアウト・保護ルート |
| 5 | `feature/projects` | プロジェクト CRUD・上限 20 |
| 6 | `feature/folders-files` | 階層フォルダ・アップロード・ダウンロード・削除 |
| 7 | `feature/markdown-editor` | アプリ内 Markdown 作成 / 編集 / プレビュー |
| 8 | `feature/version-history` | 履歴一覧・差分表示 |
| 9 | `feature/dashboard` | ホーム画面 |
| 10 | `docs/readme` | GitHub 閲覧用 README 整備 |

## 11. 依存パッケージ

`next` / `react` / `react-dom` / `typescript` / `tailwindcss` / `@supabase/supabase-js` /
`@supabase/ssr` / `zod` / `vitest` / `@testing-library/react` / `eslint`

機能実装時に追加予定: `react-markdown` + `remark-gfm`（Markdown 描画）、`diff`（差分生成）

外部 UI ライブラリは採用しない。

## 12. 環境変数

| 変数 | 用途 | 公開範囲 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | クライアント可 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名キー（RLS 前提） | クライアント可 |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理操作用。P1 では RLS と匿名キーで完結するため未使用。雛形にのみ記載する | **サーバー専用** |

`.env.local` はコミットしない。雛形として `.env.local.example` を用意する。

## 13. P1 の完了条件

1. 新規ユーザーがサインアップし、ログイン・ログアウトできる
2. 未ログインで保護ルートにアクセスするとログイン画面へ遷移する
3. プロジェクトを作成・改名・削除でき、21 件目の作成が日本語メッセージで拒否される
4. フォルダを階層的に作成・改名・削除できる
5. 対応形式のファイルをアップロードし、一覧表示・ダウンロード・削除できる
6. 非対応形式・サイズ超過が日本語メッセージで拒否される
7. アプリ内で Markdown ファイルを新規作成・編集・保存し、プレビューできる
8. ファイルのバージョン履歴を一覧でき、テキスト系は版間の差分を表示できる
9. ダッシュボードに最近の更新とプロジェクト数が表示される
10. テーマが自動判定され、設定画面から手動で切り替えられる
11. 他ユーザーのデータに一切アクセスできない（RLS の確認）
12. `lint` / `typecheck` / `test` / `build` がすべてグリーン

## 14. P1 で実装しないもの

AI タスク抽出、スケジュール自動算出、カレンダー同期（Google Calendar / .ics）、
RAG チャット、iOS ショートカット / Webhook API、Service Worker による PWA 完全対応、
GitHub API 連携、課金・プラン制御、複数ユーザーでのプロジェクト共有。
