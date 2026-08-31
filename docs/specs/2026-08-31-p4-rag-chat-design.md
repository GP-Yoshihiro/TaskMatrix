# TaskMatrix 第4フェーズ（RAG チャット）設計書

- 作成日: 2026-08-31
- 対象: P4 のうち **プロジェクト横断 AI チャット（RAG）**
- 一次仕様: `README.md` の「④ コンテキスト重視 AI アシスタント (RAG チャット)」
- 前提: P1 基盤 / P2 AI タスク抽出 / P3 スケジュール / P4 PWA
- 動作規則: `CLAUDE.md`

---

## 1. 目的とスコープ

プロジェクト内のファイルを横断して検索し、
「〇〇の進捗はどう？」のような質問に根拠付きで答える。

### 対象とするもの

- ファイル本文の**分割（チャンク化）と埋め込みベクトルの作成**
- 質問に近いチャンクだけを取り出して Gemini に渡す
- **根拠の明示**（どのファイルのどの部分を参照したか）
- プロジェクトごとの**会話履歴の保存**と再表示
- 埋め込みの作成・再作成をユーザーが実行できる画面

### 対象としないもの

タスク・予定の内容を検索対象に含めること（第一段はファイル本文のみ）、
複数プロジェクトをまたぐ検索、ストリーミング応答、
アップロード時の自動埋め込み（手動実行とする）。

---

## 2. 確定した仕様判断

| 論点 | 確定 | 理由 |
|---|---|---|
| 検索方式 | **埋め込みベクトル（pgvector）** | 大規模でも動き、送信量とコストを抑えられる |
| 会話履歴 | **DB に保存** | 文脈を継続でき、後から見返せる |
| 埋め込みの実行 | **手動**（画面のボタン） | 意図しない API 呼び出しと費用を避ける |
| 埋め込みの対象 | ファイル本文のみ | まず中核を確実に動かす |

---

## 3. 外部 API の調査結果（2026-08-31 実測）

`@google/genai` v2.19.0 で実際に呼び出して確認した。
送信したのは検証用の短い日本語文のみで、プロジェクト情報は含めていない。

| 確認事項 | 結果 |
|---|---|
| 利用できる埋め込みモデル | `gemini-embedding-2` / `gemini-embedding-2-preview` / `gemini-embedding-001` |
| 呼び出し | `ai.models.embedContent({ model, contents, config: { outputDimensionality } })` |
| 結果の取り出し | `response.embeddings[i].values` |
| 次元数 | 128〜3072 で可変。**768 を採用** |
| 所要時間 | 1 件あたり約 0.4〜0.6 秒 |

### 一括埋め込みの落とし穴

**`contents` に文字列の配列を渡すと、黙って 1 件に統合される。**

| 渡し方 | 3 件渡した結果 |
|---|---|
| `['A', 'B', 'C']` | **1 件しか返らない** |
| `[{ parts: [{ text: 'A' }] }, ...]` | 3 件返る（正しい） |

エラーにならず件数だけが減るため、気づかないと
「全チャンクの埋め込みが 1 つになる」という壊れ方をする。
**必ず `{ parts: [{ text }] }` の配列で渡し、
返ってきた件数が入力件数と一致することを検証する。**

### 次元数を 768 にする理由

- 3072 より保存容量とインデックスの負荷が小さい
- 128 では日本語の意味の差を捉えにくい
- 推奨値（768 / 1536 / 3072）の最小であり、費用対効果が良い

`vector(768)` は固定長のため、後から変えるには作り直しが要る。
その旨をマイグレーションのコメントに残す。

---

## 4. R-21 に基づく外部送信の内容

本機能では 2 種類の送信が発生する。

### 埋め込みの作成時

| 項目 | 内容 |
|---|---|
| **何を** | プロジェクト内のファイル本文を分割したテキスト |
| **どこへ** | Google Gemini API（`embedContent`） |
| **なぜ** | 質問に近い部分を検索できるようにするため |

### 質問への回答時

| 項目 | 内容 |
|---|---|
| **何を** | 質問文、質問に近い上位のチャンク本文、直近の会話履歴 |
| **どこへ** | Google Gemini API（Interactions API） |
| **なぜ** | 根拠に基づいて回答を生成するため |

### 送信しないもの

ファイル名以外のメタ情報、プロジェクト名、フォルダ名、
ユーザーのメールアドレスや ID、Supabase のキー類、
質問に関係しないチャンク。

**ファイル名は送信する。** 根拠として「どのファイルの記述か」を
示すために必要なため。この点は画面にも明記する。

---

## 5. データモデル

```
file_chunks
  id          uuid PK
  project_id  uuid not null -> projects(id) ON DELETE CASCADE
  file_id     uuid not null -> files(id)    ON DELETE CASCADE
  file_version integer not null            -- どの版から作ったか
  chunk_index integer not null             -- ファイル内の順番
  content     text not null                -- 分割した本文
  embedding   vector(768)                  -- 埋め込み。作成前は NULL
  created_at  timestamptz
  unique (file_id, file_version, chunk_index)

chat_sessions
  id          uuid PK
  project_id  uuid not null -> projects(id) ON DELETE CASCADE
  title       text not null default ''      -- 最初の質問から作る
  created_by  uuid not null -> profiles(id)
  created_at  timestamptz
  updated_at  timestamptz

chat_messages
  id          uuid PK
  session_id  uuid not null -> chat_sessions(id) ON DELETE CASCADE
  role        text not null check in ('user','assistant')
  content     text not null
  sources     jsonb not null default '[]'   -- 参照したチャンクの根拠
  created_at  timestamptz
```

`sources` の形:

```json
[{ "fileId": "...", "fileName": "要件メモ.md", "chunkIndex": 3, "excerpt": "…" }]
```

### インデックス

- `file_chunks (project_id)`
- `file_chunks (file_id)`
- `file_chunks USING hnsw (embedding vector_cosine_ops)` — 近傍検索用
- `chat_messages (session_id, created_at)`

### アクセス制御

全テーブルで RLS を有効化し、`projects.owner_id = auth.uid()` を起点とする。
`chat_messages` は所属 `session_id` のプロジェクト所有者のみ。

### 検索用の関数

近傍検索は SQL 関数として定義する。RLS を効かせるため
`security invoker` にする。

```sql
create function public.match_file_chunks(
  target_project_id uuid,
  query_embedding vector(768),
  match_count integer
) returns table (...)
language sql stable security invoker
```

`security definer` にしてはならない。RLS を迂回して
他人のチャンクを返してしまうため。

---

## 6. チャンク分割

`lib/domain/chunk.ts` に純粋関数として実装し、単体テストの中心とする。

| 項目 | 値 | 理由 |
|---|---|---|
| 1 チャンクの目安 | 800 文字 | 日本語で段落 2〜3 個分。文脈が保てる |
| 重なり | 100 文字 | 境界で意味が切れるのを防ぐ |
| 分割の優先順位 | 段落（空行）→ 改行 → 文（。）→ 強制切断 | 意味の切れ目を優先する |

空白のみのチャンクは捨てる。上限（既定 300 チャンク）を超えたら
日本語で拒否し、ファイルの分割を促す。

---

## 7. 処理の流れ

### 7.1 埋め込みの作成

```
1. プロジェクトのチャット画面で「検索用データを作成」を押す
2. 送信内容の確認ダイアログ（R-21）
3. 対象ファイルを取得（markdown / text は DB、binary は Storage → officeparser）
4. 前処理してチャンクに分割
5. file_chunks に本文だけ先に保存（embedding は NULL）
6. まとめて埋め込みを作成し、embedding を更新
   - **{ parts: [{ text }] } の配列で渡す**
   - **返却件数と入力件数の一致を検証する**
7. 完了件数を表示
```

**同じファイル・同じ版のチャンクは作り直す前に削除する。**
版が上がったら古い版のチャンクも消す（検索結果が古くならないように）。

### 7.2 質問への回答

```
1. 質問を入力
2. 質問を埋め込みに変換
3. match_file_chunks で上位 8 件を取得
4. 該当が 0 件なら「検索用データがありません」と案内
5. 直近の会話（最大 6 往復）＋ 上位チャンク ＋ 質問を Gemini に送る
6. 回答と根拠を chat_messages に保存
7. 回答の下に根拠（ファイル名と抜粋）を表示
```

**根拠が無い場合は推測で答えさせない。** プロンプトで
「提供された抜粋に無いことは『資料からは分かりません』と答える」よう指示する。

---

## 8. エラー処理

| コード | 発生条件 | 表示メッセージ |
|---|---|---|
| `NO_INDEXED_CONTENT` | チャンクが 0 件 | 検索用データがありません。先に作成してください。 |
| `TOO_MANY_CHUNKS` | 上限超過 | ファイルが多すぎます。対象を絞ってください。 |
| `EMBEDDING_COUNT_MISMATCH` | 返却件数が入力と不一致 | 検索用データの作成に失敗しました。もう一度お試しください。 |

既存の `AI_*` 系と `NETWORK_ERROR` はそのまま使う。

---

## 9. テストと検証

- **単体**: `lib/domain/chunk.ts`（分割・重なり・上限）、
  `lib/domain/rag.ts`（根拠の整形・履歴の切り詰め）
- **ユースケース**: 埋め込み器と Gemini をモックした
  `buildIndexForProject` と `answerQuestion`。**実 API は呼ばない**
- **一括埋め込みの件数不一致**を検知することをテストで固定する
- **実機**: 埋め込み作成 → 質問 → 根拠付きの回答 → 履歴の再表示までを通しで確認。
  RLS を SQL で確認する

---

## 10. ブランチ計画

| 順 | ブランチ | 内容 |
|---|---|---|
| 1 | `docs/spec-p4-rag` | 本設計書と実装計画 |
| 2 | `feature/rag-schema` | pgvector・テーブル・RLS・検索関数・チャンク分割 |
| 3 | `feature/rag-indexing` | 埋め込みの作成と再作成 |
| 4 | `feature/rag-chat` | 質問・回答・根拠の表示・会話履歴 |

---

## 11. 依存パッケージ

**追加なし。** `@google/genai` は導入済み、`officeparser` も導入済み。
pgvector は Supabase の拡張として有効化する。

---

## 12. 完了条件

1. `vector` 拡張が有効になり、`file_chunks` に `vector(768)` が作られる
2. 検索用データを作成でき、チャンク数が表示される
3. 一括埋め込みの件数が入力と一致することを検証している
4. 質問に対し、根拠（ファイル名と抜粋）付きで回答が返る
5. 資料に無いことは「資料からは分かりません」と答える
6. 会話履歴が保存され、再訪時に表示される
7. 検索用データが無いときに日本語の案内が出る
8. ファイルの版が上がったら古い版のチャンクが消える
9. 他ユーザーのチャンク・会話にアクセスできない
10. 近傍検索の関数が RLS を迂回しない（`security invoker`）
11. `lint` / `typecheck` / `test` / `build` がすべてグリーン
