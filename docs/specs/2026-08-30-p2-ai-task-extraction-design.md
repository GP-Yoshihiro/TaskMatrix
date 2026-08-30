# TaskMatrix 第2フェーズ（AI タスク抽出）設計書

- 作成日: 2026-08-30
- 対象: P2 AI フェーズ
- 一次仕様: `README.md` の「② AI タスク抽出・改善提案機能」
- 前提となる設計: `docs/specs/2026-08-30-p1-foundation-design.md`
- 動作規則: `CLAUDE.md`
- ステータス: 承認済み（2026-08-30）

---

## 1. 目的とスコープ

P1 で完成した基盤（プロジェクト・フォルダ・ファイル・バージョン履歴）の上に、
ドキュメントからタスクを抽出する機能を載せる。

### 対象とするもの

- ファイル単位の手動起動による AI タスク抽出
- 不透明な記述の指摘（不透明点メモ）と改善提案の生成
- 抽出結果のプレビューと、ユーザーが選んで登録するワークフロー
- タスク管理画面（リスト表示 / カンバン表示、手動での追加・編集・削除）
- 対応形式: `md` `txt` `docx` `xlsx` `pptx` `pdf`（P1 の対応形式すべて）

### 対象としないもの

スケジュール自動算出、カレンダー連携、RAG チャット、
フォルダ単位・プロジェクト単位の一括抽出、アップロード時の自動抽出、
タスクの共有・担当者アサイン通知。

---

## 2. 確定した仕様判断

| 論点 | 確定 |
|---|---|
| 起動単位 | **ファイル単位の手動実行**。API コストを制御でき、失敗時の切り分けが容易 |
| 対応形式 | **P1 の全形式**。Office はサーバー側でテキスト抽出する |
| スコープ | **抽出＋タスク管理**。README ② を完備する |
| 抽出結果の扱い | **非破壊**。提案としてプレビューし、ユーザーが選択して登録する |

---

## 3. 外部 API の調査結果（2026-08-30 時点）

設計に影響する事実を記録する。実装時に変わっている可能性があるため、
着手時に再確認すること。

| 事実 | 出典 | 設計への影響 |
|---|---|---|
| Gemini のドキュメント入力は **PDF のみ**実質的に解釈可能。docx / xlsx / pptx は非対応 | Document understanding | Office はサーバー側でテキスト抽出が必須 |
| 現行 API は **Interactions API**（`ai.interactions.create`）。`generateContent` は Legacy | Models / Structured outputs | 新 API で実装する |
| 構造化出力（`response_format.schema`）は **Gemini 3 系のみ**対応 | Structured outputs | モデルは 3.x 系を採用 |
| PDF 直接入力は 50MB / 1000 ページ、1 ページ ≈ 258 トークン | Document understanding | テキスト化した方が大幅に安い |

参照:
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/interactions/structured-output
- https://ai.google.dev/gemini-api/docs/interactions/document-processing

### 3.1 実機検証の結果（2026-08-30 実施）

`@google/genai` v2.19.0 で実際に呼び出して確認した事実。検証用の架空の会議メモを
送信しており、プロジェクト情報は含めていない。

| 確認事項 | 結果 |
|---|---|
| SDK に `ai.interactions.create` が存在する | あり（`create` / `get` / `delete` / `cancel`） |
| 構造化出力の呼び出し形 | `response_format: { type:'text', mime_type:'application/json', schema }` で成功 |
| 結果の取り出し | `interaction.output_text`（JSON 文字列）を `JSON.parse` する |
| レスポンスのフィールド | `id, status, usage, created, updated, service_tier, steps, object, model, output_text` |
| トークン使用量 | `interaction.usage` に `total_input_tokens` / `total_output_tokens` / `total_thought_tokens` |
| `gemini-3.7-flash` | **500「currently experiencing high demand」を継続的に返した** |
| `gemini-3.5-flash` | 成功。約 18 秒（入力 43 / 思考 949 / 出力 290 トークン） |
| 抽出品質 | 「来週まで」「適宜」といった曖昧な期限を不透明点として正しく指摘した |
| `due_date` の実際の出力 | **`YYYY-MM-DD` ではなく「来週まで」「適宜」など自然言語が返った** |

この検証を受けて、以下を設計に反映する。

1. **モデルのフォールバック**: 既定モデルが 5xx を返した場合、フォールバックモデルへ切り替えて再試行する
2. **長い応答時間への対応**: 20 秒超を前提に、Server Action の最大実行時間を延ばし、UI に待機状態を出す
3. **期限の扱い**: `due_date` は `YYYY-MM-DD` か空文字のみを許可し、
   「来週」「適宜」のような曖昧な表現は空文字にしたうえで不透明点メモに回すようプロンプトで指示する

---

## 4. R-21 に基づく外部送信の内容

`CLAUDE.md` R-21 の事前提示として、Gemini API へ送信する内容を定義する。
本設計の承認をもって、この範囲の送信について承認を得たものとする。

| 項目 | 内容 |
|---|---|
| **何を** | ユーザーが選択した 1 ファイルの本文テキスト（Office / PDF は抽出後のテキスト） |
| **どこへ** | Google Gemini API `https://generativelanguage.googleapis.com`（Interactions API） |
| **なぜ** | ドキュメントからタスクを抽出し、不透明点と改善案を生成するため |
| **どうなるか** | 有料 API 経由では Google は入力をモデル学習に使用しない方針。無料枠では学習に利用される場合がある |

### 送信しないもの

- 選択されたファイル以外の内容
- ファイル名、プロジェクト名、フォルダ名
- ユーザーのメールアドレス、ユーザー ID
- Supabase の URL・キー類

### 遵守事項

- 送信するのは目的に必要な最小限のテキストのみ
- `GEMINI_API_KEY` はサーバー側でのみ保持し、クライアントへ露出させない
- 送信本文をログに平文で出力しない
- 抽出画面に「このファイルの本文が Gemini API に送信されます」と明示する

---

## 5. アーキテクチャ

### 5.1 採用方針

**全形式を `officeparser` でテキスト化し、Gemini にはテキストのみを送る。**

例外として、PDF から抽出したテキストが極端に短い場合（既定 200 文字未満）は
スキャン PDF とみなし、PDF 本体を Gemini のドキュメント入力として送信する。

採用理由:

- 経路が 1 本に統一され、形式ごとの分岐が最小になる
- テキスト送信はページ単位課金より大幅に安い
- スキャン PDF という現実的な失敗ケースを、小さな追加分岐で救済できる

不採用とした案:

- **Office は officeparser、PDF は常に Gemini へ直接送信**:
  PDF の図表を解釈できる利点はあるが、常時 258 トークン / ページのコストがかかる
- **md / txt のみ対応**: 安価だが、確定した「全形式対応」を満たさない

### 5.2 ディレクトリ構成（P2 で追加する分）

```
app/
  (app)/projects/[projectId]/tasks/          タスク一覧（リスト / カンバン）
lib/
  domain/tasks.ts          タスクの検証・並び替え・ステータス遷移
  domain/extraction.ts     抽出テキストの前処理・長さ検証
  gemini/client.ts         Gemini クライアント生成
  gemini/extract-tasks.ts  抽出プロンプトと構造化スキーマ
  extraction/text.ts       officeparser によるテキスト抽出
  repositories/tasks.ts
  repositories/extraction-runs.ts
  usecases/extract-tasks.ts   抽出ユースケース（依存を引数で受け取る）
  actions/tasks.ts
  actions/extraction.ts
components/app/
  task-extract-panel.tsx   抽出実行と提案プレビュー
  task-list.tsx            リスト表示
  task-board.tsx           カンバン表示
  task-form.tsx            手動での追加・編集
```

`lib/domain` は外部依存を持たない方針を P1 から継承する。
Gemini SDK と officeparser への依存は `lib/gemini` と `lib/extraction` に閉じ込め、
`lib/usecases` はインターフェース越しに呼ぶ。これにより API を叩かずに単体テストできる。

---

## 6. データモデル

### 6.1 テーブル

```
tasks
  id              uuid PK
  project_id      uuid not null -> projects(id) ON DELETE CASCADE
  source_file_id  uuid          -> files(id) ON DELETE SET NULL
  source_version  integer                     -- 抽出元のファイルバージョン
  title           text not null
  description     text not null default ''
  status          text not null default 'todo'   check in ('todo','doing','done')
  priority        text not null default 'medium' check in ('high','medium','low')
  assignee        text not null default ''
  due_date        date
  ambiguity_note  text not null default ''    -- 不透明点メモ
  ai_suggestion   text not null default ''    -- AI 改善提案
  origin          text not null default 'manual' check in ('ai','manual')
  position        integer not null default 0  -- カンバン内の並び順
  created_by      uuid not null -> profiles(id)
  created_at      timestamptz
  updated_at      timestamptz

extraction_runs
  id             uuid PK
  project_id     uuid not null -> projects(id) ON DELETE CASCADE
  file_id        uuid          -> files(id) ON DELETE SET NULL
  file_version   integer
  model          text not null
  status         text not null check in ('running','succeeded','failed')
  task_count     integer not null default 0
  input_chars    integer not null default 0   -- 送信した文字数（コスト把握用）
  error_message  text not null default ''
  created_by     uuid not null -> profiles(id)
  created_at     timestamptz
  finished_at    timestamptz
```

`source_file_id` を `ON DELETE SET NULL` にする理由は、抽出元ファイルを削除しても
登録済みのタスクを失わせないため。`source_version` は履歴として残す。

### 6.2 アクセス制御

P1 と同じく `projects.owner_id = auth.uid()` を起点に RLS を設定する。

- `tasks`: 所属 `project_id` の所有者のみ
- `extraction_runs`: 所属 `project_id` の所有者のみ

### 6.3 インデックス

`tasks (project_id)` / `tasks (project_id, status, position)` / `extraction_runs (project_id, created_at desc)`

---

## 7. 抽出フロー

```
1. ファイル画面で「タスク抽出」を押す
2. 送信内容の確認ダイアログを表示（何が送信されるかを明示）
3. サーバーで本文を取得
     md / txt        -> file_versions.content から取得
     Office / PDF    -> Storage から取得し officeparser でテキスト化
     PDF で抽出結果が 200 文字未満 -> スキャン PDF とみなし、
                                     PDF 本体を Gemini のドキュメント入力として送る
4. 前処理（改行正規化・空白圧縮）と長さ検証（上限 200,000 文字）
5. extraction_runs に status='running' で記録
6. Gemini に構造化出力で問い合わせ
7. 結果を検証（Zod）
8. extraction_runs を status='succeeded' に更新（失敗時は 'failed' と理由）
9. 【提案プレビュー】として画面に表示。この時点では tasks に保存しない
10. ユーザーがチェックを付けて「タスクとして登録」
11. 選択されたものだけを tasks に INSERT（origin='ai'）
```

**既存タスクを自動で更新・削除しない。** 再抽出しても、ユーザーが手動編集した内容や
手動作成したタスクが失われることはない。README の「仮データ表示 → 確定」の
考え方とも一致する。

### 7.1 Gemini への出力スキーマ

```
{
  tasks: [
    {
      title: string           // タスク名（簡潔に）
      description: string     // 何をするかの説明
      priority: 'high' | 'medium' | 'low'
      assignee: string        // 文書から読み取れる担当者。不明なら空文字
      due_date: string        // YYYY-MM-DD のみ。曖昧・不明なら空文字とし、
                              // 原文の表現は ambiguity_note に記載させる
      ambiguity_note: string  // 記述が不透明な点。なければ空文字
      ai_suggestion: string   // タスク化に向けた改善・修正案。なければ空文字
    }
  ],
  document_summary: string    // ドキュメント全体の要約（1〜3文）
}
```

プロンプトは日本語で記述し、出力も日本語で得る。

---

## 8. エラー処理

Server Action は P1 と同じ判別可能ユニオンで返す。追加するエラーコード:

| コード | 発生条件 | 表示メッセージ |
|---|---|---|
| `AI_NOT_CONFIGURED` | `GEMINI_API_KEY` 未設定 | AI 機能が設定されていません。 |
| `TEXT_TOO_LONG` | 抽出テキストが上限超過 | ドキュメントが大きすぎます。分割してお試しください。 |
| `TEXT_EXTRACTION_FAILED` | officeparser が失敗 | ファイルからテキストを取り出せませんでした。 |
| `AI_REQUEST_FAILED` | API 通信失敗・タイムアウト | AI への問い合わせに失敗しました。時間をおいてお試しください。 |
| `AI_MODEL_UNAVAILABLE` | 既定・フォールバックの両モデルが 5xx | AI が混雑しています。時間をおいてお試しください。 |
| `AI_RESPONSE_INVALID` | 出力がスキーマに不一致 | AI の応答を解釈できませんでした。もう一度お試しください。 |

いずれも `extraction_runs.error_message` に記録し、後から原因を追える状態にする。

---

## 9. テストと検証

### 9.1 テスト方針

`CLAUDE.md` R-12 に従い、テストを先に書く。

- **単体（Vitest）**: `lib/domain/tasks.ts`（検証・並び替え・ステータス遷移）、
  `lib/domain/extraction.ts`（前処理・長さ検証・スキャン PDF 判定）
- **ユースケース（Vitest）**: Gemini クライアントと抽出器をモックした `extractTasks`。
  **実際の API は呼ばない**
- **コンポーネント**: 提案プレビューの選択状態、カンバンのステータス変更

### 9.2 実 API を使う確認

自動テストでは API を呼ばない。実 API の疎通は、開発サーバー上での手動確認で
1 回だけ行い、結果を `docs/worklog/` に記録する。

### 9.3 検証セット

`npm run lint` → `npm run typecheck` → `npm test` → `npm run build` をすべてグリーンにしてからコミットする。

---

## 10. ブランチ計画

| 順 | ブランチ | 内容 |
|---|---|---|
| 1 | `docs/spec-p2` | 本設計書と実装計画 |
| 2 | `feature/task-schema` | `tasks` / `extraction_runs` テーブルと RLS |
| 3 | `feature/text-extraction` | officeparser によるテキスト抽出とドメインロジック |
| 4 | `feature/gemini-client` | Gemini クライアントと構造化出力 |
| 5 | `feature/task-extraction` | 抽出フローと提案プレビュー UI |
| 6 | `feature/task-management` | タスク一覧（リスト / カンバン）と手動 CRUD |
| 7 | `feature/task-improvements` | 不透明点・改善提案の表示 |

各ブランチ完了時に Claude が PR を作成し、ユーザーの承認を得てマージする（R-04）。

---

## 11. 依存パッケージ

| パッケージ | 用途 | 備考 |
|---|---|---|
| `@google/genai` | Gemini SDK | Interactions API を使用 |
| `officeparser` | docx / xlsx / pptx / pdf のテキスト抽出 | v7.8.0 / MIT。単一パッケージで全形式を処理 |

個別ライブラリ（mammoth / exceljs / pdf-parse など）を複数入れる代わりに
`officeparser` 1 つで済むため、これを採用する（R-19）。

---

## 12. 環境変数（P2 で追加）

| 変数 | 用途 | 公開範囲 |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API の認証キー | **サーバー専用**。`NEXT_PUBLIC_` を付けない |
| `GEMINI_MODEL` | 使用モデル。未設定時は `gemini-3.7-flash` | サーバー専用 |
| `GEMINI_FALLBACK_MODEL` | 既定モデルが 5xx のときの代替。未設定時は `gemini-3.5-flash` | サーバー専用 |

---

## 13. P2 の完了条件

1. md / txt ファイルからタスクを抽出でき、提案がプレビュー表示される
2. docx / xlsx / pptx / pdf からもテキストを取り出して抽出できる
3. 提案から選んだものだけがタスクとして登録される
4. 再抽出しても既存タスクが失われない
5. 各タスクに不透明点メモと AI 改善提案が表示される
6. タスクを手動で追加・編集・削除できる
7. リスト表示とカンバン表示を切り替えられ、カンバンでステータスを変更できる
8. `GEMINI_API_KEY` 未設定時に日本語のメッセージが出る
9. 上限超過・API 失敗・スキーマ不一致が日本語で表示され、`extraction_runs` に記録される
10. 他ユーザーのタスクに一切アクセスできない（RLS の確認）
11. `GEMINI_API_KEY` がクライアントバンドルに含まれない
12. 既定モデルが 5xx を返してもフォールバックモデルで抽出が完了する
13. `lint` / `typecheck` / `test` / `build` がすべてグリーン
