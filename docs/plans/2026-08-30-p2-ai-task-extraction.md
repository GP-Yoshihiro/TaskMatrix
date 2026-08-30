# TaskMatrix 第2フェーズ（AI タスク抽出）実装計画

> **エージェント実行者へ:** 本計画は `superpowers:subagent-driven-development` または
> `superpowers:executing-plans` を用いてタスク単位で実装すること。
> 手順はチェックボックス (`- [ ]`) 形式で追跡する。

**ゴール:** ドキュメントからタスクを抽出し、不透明点と改善提案を添えて提示し、
ユーザーが選んで登録・管理できる状態にする。

**アーキテクチャ:** 全形式を `officeparser` でテキスト化して Gemini にテキストを送る。
抽出結果は保存せず提案として提示し、ユーザーが選択したものだけを `tasks` に登録する。
Gemini SDK と officeparser への依存は `lib/gemini` と `lib/extraction` に閉じ込め、
`lib/usecases` はインターフェース越しに呼ぶことで API を叩かずに単体テストする。

**技術スタック:** Next.js 16 / React 19 / TypeScript / Supabase /
`@google/genai` v2.19.0 / `officeparser` v7.8.0 / Zod / Vitest

**設計書:** `docs/specs/2026-08-30-p2-ai-task-extraction-design.md`

---

## グローバル制約

- 応答・コメント・UI 文言・コミットメッセージはすべて**日本語**（R-02）
- 機能ごとに**新規ブランチ**。`main` へ直接コミットしない（R-03）
- 各タスクの最後に `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`。
  **すべてグリーンでのみコミット**（R-05 / R-06）
- テストを先に書く（R-12）
- 各ブランチ完了時に Claude が PR を作成し、ユーザーの承認を得てマージ（R-04）
- Supabase プロジェクト ref: `patasstmipeqaaovfihv`
- **`GEMINI_API_KEY` はサーバー専用。`NEXT_PUBLIC_` を絶対に付けない**（R-14）
- **自動テストで実 API を呼ばない**。Gemini クライアントは必ずモックする
- 既定モデル `gemini-3.7-flash`、フォールバック `gemini-3.5-flash`
- 抽出テキストの上限: **200,000 文字**
- スキャン PDF 判定のしきい値: 抽出テキスト **200 文字未満**
- タスクのステータス: `todo` / `doing` / `done`
- 優先度: `high` / `medium` / `low`
- 承認要求時・完了時に `say -v Kyoko "..."` で音声通知（R-08）

---

## ファイル構成

| ファイル | 責務 |
|---|---|
| `lib/domain/tasks.ts` | タスク名・期限の検証、ステータス／優先度の定義、並び替え |
| `lib/domain/extraction.ts` | 抽出テキストの前処理・長さ検証・スキャン PDF 判定 |
| `lib/extraction/text.ts` | officeparser によるバイナリからのテキスト抽出 |
| `lib/gemini/client.ts` | Gemini クライアント生成とモデルのフォールバック |
| `lib/gemini/extract-tasks.ts` | 抽出プロンプトと構造化出力スキーマ |
| `lib/repositories/tasks.ts` | `tasks` のデータアクセス |
| `lib/repositories/extraction-runs.ts` | `extraction_runs` のデータアクセス |
| `lib/usecases/extract-tasks.ts` | 抽出ユースケース（依存を引数で受け取る） |
| `lib/actions/tasks.ts` | タスクの Server Actions |
| `lib/actions/extraction.ts` | 抽出の Server Action |
| `components/app/task-extract-panel.tsx` | 抽出実行と提案プレビュー |
| `components/app/task-list.tsx` | リスト表示 |
| `components/app/task-board.tsx` | カンバン表示 |
| `components/app/task-form.tsx` | 手動での追加・編集 |
| `app/(app)/projects/[projectId]/tasks/page.tsx` | タスク一覧画面 |

---

## Task 1: タスクのデータモデルとドメインロジック

**ブランチ:** `feature/task-schema`

**Files:**
- Create: `supabase/migrations/0004_tasks.sql`
- Create: `lib/domain/tasks.ts`, `lib/domain/__tests__/tasks.test.ts`

**Interfaces:**
- Consumes: `Result` `ok` `err`（P1 Task 1）
- Produces:
  - `type TaskStatus = 'todo' | 'doing' | 'done'`
  - `type TaskPriority = 'high' | 'medium' | 'low'`
  - `const TASK_STATUSES: readonly TaskStatus[]`
  - `const TASK_PRIORITIES: readonly TaskPriority[]`
  - `const TASK_TITLE_MAX_LENGTH = 200`
  - `const STATUS_LABEL: Record<TaskStatus, string>`
  - `const PRIORITY_LABEL: Record<TaskPriority, string>`
  - `function validateTaskTitle(title: string): Result<string>`
  - `function normalizeDueDate(value: string): string | null`
  - `function isTaskStatus(value: string): value is TaskStatus`
  - `function isTaskPriority(value: string): value is TaskPriority`
  - DB テーブル `tasks` / `extraction_runs`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout main
git pull --ff-only
git checkout -b feature/task-schema
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/domain/__tests__/tasks.test.ts` を作成する。

```typescript
import { describe, expect, it } from 'vitest'
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  isTaskPriority,
  isTaskStatus,
  normalizeDueDate,
  validateTaskTitle,
} from '@/lib/domain/tasks'

describe('validateTaskTitle', () => {
  it('前後の空白を取り除いて受け入れる', () => {
    const result = validateTaskTitle('  見積もりを提出する  ')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe('見積もりを提出する')
  })

  it('空文字を拒否する', () => {
    const result = validateTaskTitle('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('上限を超える名前を拒否する', () => {
    expect(validateTaskTitle('あ'.repeat(TASK_TITLE_MAX_LENGTH + 1)).ok).toBe(false)
  })

  it('ちょうど上限は受け入れる', () => {
    expect(validateTaskTitle('あ'.repeat(TASK_TITLE_MAX_LENGTH)).ok).toBe(true)
  })

  it('上限は 200 文字である', () => {
    expect(TASK_TITLE_MAX_LENGTH).toBe(200)
  })
})

describe('normalizeDueDate', () => {
  it('YYYY-MM-DD をそのまま返す', () => {
    expect(normalizeDueDate('2026-09-10')).toBe('2026-09-10')
  })

  it('空文字は null にする', () => {
    expect(normalizeDueDate('')).toBeNull()
    expect(normalizeDueDate('   ')).toBeNull()
  })

  it('自然言語の期限は null にする', () => {
    // AI は「来週まで」「適宜」のような表現を返すことがある
    expect(normalizeDueDate('来週まで')).toBeNull()
    expect(normalizeDueDate('適宜')).toBeNull()
    expect(normalizeDueDate('9月10日')).toBeNull()
  })

  it('形式が正しくても存在しない日付は null にする', () => {
    expect(normalizeDueDate('2026-02-30')).toBeNull()
    expect(normalizeDueDate('2026-13-01')).toBeNull()
  })
})

describe('ステータスと優先度', () => {
  it('ステータスは 3 種類である', () => {
    expect([...TASK_STATUSES]).toEqual(['todo', 'doing', 'done'])
  })

  it('優先度は 3 種類である', () => {
    expect([...TASK_PRIORITIES]).toEqual(['high', 'medium', 'low'])
  })

  it('型ガードが正しく判定する', () => {
    expect(isTaskStatus('todo')).toBe(true)
    expect(isTaskStatus('archived')).toBe(false)
    expect(isTaskPriority('high')).toBe(true)
    expect(isTaskPriority('urgent')).toBe(false)
  })

  it('日本語ラベルがすべて定義されている', () => {
    for (const status of TASK_STATUSES) expect(STATUS_LABEL[status]).toBeTruthy()
    for (const priority of TASK_PRIORITIES) expect(PRIORITY_LABEL[priority]).toBeTruthy()
  })
})
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/domain/tasks` を解決できない）

- [ ] **Step 4: 最小の実装を書く**

`lib/domain/tasks.ts` を作成する。

```typescript
import { type Result, err, ok } from './result'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const
export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const

/** タスク名の最大文字数 */
export const TASK_TITLE_MAX_LENGTH = 200

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value)
}

export function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value)
}

export function validateTaskTitle(title: string): Result<string> {
  const trimmed = title.trim()

  if (trimmed.length === 0) {
    return err('VALIDATION_ERROR', 'タスク名を入力してください。')
  }

  if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
    return err(
      'VALIDATION_ERROR',
      `タスク名は ${TASK_TITLE_MAX_LENGTH} 文字以内で入力してください。`,
    )
  }

  return ok(trimmed)
}

/**
 * 期限を YYYY-MM-DD に正規化する。
 * AI は「来週まで」「適宜」のような自然言語を返すことがあるため、
 * 確定した日付以外はすべて null にして不透明点として扱わせる。
 */
export function normalizeDueDate(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

  const [year, month, day] = trimmed.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day

  return valid ? trimmed : null
}
```

- [ ] **Step 5: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（tasks 13 件を含む全件）

- [ ] **Step 6: マイグレーション SQL を作成する**

`supabase/migrations/0004_tasks.sql` を作成する。

```sql
-- ============================================================
-- TaskMatrix 第2フェーズ タスクと抽出実行記録
-- ============================================================

create table public.tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  source_file_id uuid references public.files(id) on delete set null,
  source_version integer,
  title          text not null,
  description    text not null default '',
  status         text not null default 'todo'
                   check (status in ('todo', 'doing', 'done')),
  priority       text not null default 'medium'
                   check (priority in ('high', 'medium', 'low')),
  assignee       text not null default '',
  due_date       date,
  ambiguity_note text not null default '',
  ai_suggestion  text not null default '',
  origin         text not null default 'manual'
                   check (origin in ('ai', 'manual')),
  position       integer not null default 0,
  created_by     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_board_idx      on public.tasks (project_id, status, position);
create index tasks_source_file_idx on public.tasks (source_file_id);

create table public.extraction_runs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  file_id       uuid references public.files(id) on delete set null,
  file_version  integer,
  model         text not null default '',
  status        text not null default 'running'
                  check (status in ('running', 'succeeded', 'failed')),
  task_count    integer not null default 0,
  input_chars   integer not null default 0,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  error_message text not null default '',
  created_by    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index extraction_runs_project_idx
  on public.extraction_runs (project_id, created_at desc);

-- ============================================================
-- 行レベルセキュリティ
-- ============================================================

alter table public.tasks           enable row level security;
alter table public.extraction_runs enable row level security;

create policy tasks_all_own on public.tasks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy extraction_runs_all_own on public.extraction_runs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = extraction_runs.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = extraction_runs.project_id and p.owner_id = (select auth.uid())
    )
  );
```

> **注意**: RLS ポリシー内で `projects p` を結合する際、`tasks.project_id` のように
> **テーブル名で修飾する**こと。P1 で `storage.foldername(name)` の `name` が
> サブクエリ側の列に解決され、ポリシーが常に偽になる不具合を起こしている。

- [ ] **Step 7: マイグレーションを適用する**

Supabase MCP の `apply_migration` を `project_id = patasstmipeqaaovfihv`、
`name = 0004_tasks` として適用する。

- [ ] **Step 8: 適用結果と RLS を確認する**

`list_tables`（スキーマ `public`）で `tasks` と `extraction_runs` が
`rls_enabled: true` で存在することを確認する。
続いて `get_advisors`（`type: security`）で警告が出ていないことを確認する。
警告があれば修正してから次へ進む。

- [ ] **Step 9: RLS が実効であることを SQL で確認する**

`execute_sql` で次を実行し、別ユーザーから 0 件であることを確認する。

```sql
create temporary table t_check(step text, result text);
grant all on t_check to authenticated;

do $$
declare
  intruder uuid := '11111111-2222-3333-4444-555555555555';
  n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', intruder, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.tasks;
  insert into t_check values ('別ユーザーから見えるタスク', n::text);

  select count(*) into n from public.extraction_runs;
  insert into t_check values ('別ユーザーから見える抽出記録', n::text);

  reset role;
end $$;

select * from t_check;
```

Expected: いずれも `0`

- [ ] **Step 10: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 11: コミットして PR を作成する**

```bash
git add -A
git commit -m "feat(tasks): タスクのデータモデルとドメインロジックを追加

- tasks / extraction_runs テーブルとRLSポリシーを定義
- ステータス・優先度の型と日本語ラベルを定義
- タスク名の検証と期限の正規化を実装
- AI が返す自然言語の期限は null にして不透明点に回す方針を実装"

gh pr create --base main --head feature/task-schema \
  --title "feat(tasks): タスクのデータモデルとドメインロジックを追加" \
  --body-file <(cat <<'BODY'
（設計書 docs/specs/2026-08-30-p2-ai-task-extraction-design.md の §6 に対応）
BODY
)
```

PR 本文は `CLAUDE.md` R-04 の 6 項目を満たすこと。

---

## Task 2: テキスト抽出（officeparser）

**ブランチ:** `feature/text-extraction`

**Files:**
- Create: `lib/domain/extraction.ts`, `lib/domain/__tests__/extraction.test.ts`
- Create: `lib/extraction/text.ts`

**Interfaces:**
- Consumes: `Result` `ok` `err`、`FileKind`（P1 `lib/domain/files.ts`）
- Produces:
  - `const MAX_EXTRACTION_CHARS = 200000`
  - `const SCANNED_PDF_THRESHOLD = 200`
  - `function preprocessText(text: string): string`
  - `function validateExtractedText(text: string): Result<string>`
  - `function looksLikeScannedPdf(text: string, extension: string): boolean`
  - `interface TextExtractor { extract(input: { buffer: Uint8Array; filename: string }): Promise<string> }`
  - `function createOfficeParserExtractor(): TextExtractor`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout main
git pull --ff-only
git checkout -b feature/text-extraction
```

- [ ] **Step 2: 依存を追加する**

```bash
npm install officeparser
```

- [ ] **Step 3: 失敗するテストを書く**

`lib/domain/__tests__/extraction.test.ts` を作成する。

```typescript
import { describe, expect, it } from 'vitest'
import {
  MAX_EXTRACTION_CHARS,
  SCANNED_PDF_THRESHOLD,
  looksLikeScannedPdf,
  preprocessText,
  validateExtractedText,
} from '@/lib/domain/extraction'

describe('preprocessText', () => {
  it('改行を LF に統一する', () => {
    expect(preprocessText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('3 行以上の連続する空行を 2 行に圧縮する', () => {
    expect(preprocessText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('行末の空白を取り除く', () => {
    expect(preprocessText('a   \nb\t\n')).toBe('a\nb')
  })

  it('全体の前後の空白を取り除く', () => {
    expect(preprocessText('\n\n  本文  \n\n')).toBe('本文')
  })

  it('通常の本文は変えない', () => {
    expect(preprocessText('# 見出し\n\n- 項目')).toBe('# 見出し\n\n- 項目')
  })
})

describe('validateExtractedText', () => {
  it('通常の本文を受け入れる', () => {
    const result = validateExtractedText('タスクの説明が書かれた文章')
    expect(result.ok).toBe(true)
  })

  it('空のテキストを拒否する', () => {
    const result = validateExtractedText('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TEXT_EXTRACTION_FAILED')
  })

  it('上限ちょうどは受け入れる', () => {
    expect(validateExtractedText('あ'.repeat(MAX_EXTRACTION_CHARS)).ok).toBe(true)
  })

  it('上限を 1 文字超えたら拒否する', () => {
    const result = validateExtractedText('あ'.repeat(MAX_EXTRACTION_CHARS + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TEXT_TOO_LONG')
  })

  it('上限は 20 万文字である', () => {
    expect(MAX_EXTRACTION_CHARS).toBe(200000)
  })
})

describe('looksLikeScannedPdf', () => {
  it('PDF で抽出テキストが極端に短ければ true', () => {
    expect(looksLikeScannedPdf('a'.repeat(SCANNED_PDF_THRESHOLD - 1), 'pdf')).toBe(true)
  })

  it('しきい値ちょうどなら false', () => {
    expect(looksLikeScannedPdf('a'.repeat(SCANNED_PDF_THRESHOLD), 'pdf')).toBe(false)
  })

  it('PDF 以外は短くても false', () => {
    expect(looksLikeScannedPdf('', 'docx')).toBe(false)
    expect(looksLikeScannedPdf('', 'md')).toBe(false)
  })

  it('しきい値は 200 文字である', () => {
    expect(SCANNED_PDF_THRESHOLD).toBe(200)
  })
})
```

- [ ] **Step 4: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/domain/extraction` を解決できない）

- [ ] **Step 5: ドメインロジックを実装する**

`lib/domain/extraction.ts` を作成する。

```typescript
import { normalizeLineEndings } from './files'
import { type Result, err, ok } from './result'

/** Gemini へ送るテキストの最大文字数 */
export const MAX_EXTRACTION_CHARS = 200000

/** これ未満の抽出結果はスキャン PDF とみなす文字数 */
export const SCANNED_PDF_THRESHOLD = 200

/**
 * 抽出したテキストを整える。
 * 無駄な空白と空行を削ってトークン消費を抑える。
 */
export function preprocessText(text: string): string {
  return normalizeLineEndings(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function validateExtractedText(text: string): Result<string> {
  const trimmed = text.trim()

  if (trimmed.length === 0) {
    return err('TEXT_EXTRACTION_FAILED', 'ファイルからテキストを取り出せませんでした。')
  }

  if (trimmed.length > MAX_EXTRACTION_CHARS) {
    return err(
      'TEXT_TOO_LONG',
      'ドキュメントが大きすぎます。分割してお試しください。',
    )
  }

  return ok(trimmed)
}

/**
 * 画像だけの PDF かどうかを判定する。
 * true の場合はテキストではなく PDF 本体を Gemini に送る。
 */
export function looksLikeScannedPdf(text: string, extension: string): boolean {
  if (extension.toLowerCase() !== 'pdf') return false
  return text.trim().length < SCANNED_PDF_THRESHOLD
}
```

- [ ] **Step 6: エラーコードを追加する**

`lib/domain/result.ts` の `AppErrorCode` に次を追加する。

```typescript
  | 'AI_NOT_CONFIGURED'
  | 'TEXT_TOO_LONG'
  | 'TEXT_EXTRACTION_FAILED'
  | 'AI_REQUEST_FAILED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_RESPONSE_INVALID'
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（extraction 14 件を含む全件）

- [ ] **Step 8: 抽出器を実装する**

`lib/extraction/text.ts` を作成する。

```typescript
import { parseOfficeAsync } from 'officeparser'

/**
 * バイナリファイルからテキストを取り出す。
 * 実装を差し替えられるようインターフェースを切り、テストではモックする。
 */
export interface TextExtractor {
  extract(input: { buffer: Uint8Array; filename: string }): Promise<string>
}

export function createOfficeParserExtractor(): TextExtractor {
  return {
    async extract({ buffer }) {
      const result = await parseOfficeAsync(Buffer.from(buffer))
      return typeof result === 'string' ? result : String(result ?? '')
    },
  }
}
```

> **実装時の確認**: `officeparser` v7.8.0 のエクスポート名を実際に確認すること。
> `node -e "console.log(Object.keys(require('officeparser')))"` で列挙できる。
> 名前が異なる場合は、テキストを返す関数に合わせて上記を修正する。

- [ ] **Step 9: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 10: 実ファイルで抽出を確認する**

`docx` / `xlsx` / `pptx` / `pdf` の小さなサンプルを一時ディレクトリに作り、
次のスクリプトでテキストが取り出せることを確認する。結果は `docs/worklog/` に記録する。

```bash
node -e "
const { parseOfficeAsync } = require('officeparser');
parseOfficeAsync(require('fs').readFileSync(process.argv[1]))
  .then(t => console.log(String(t).slice(0, 300)))
  .catch(e => console.error('失敗:', e.message));
" <ファイルパス>
```

- [ ] **Step 11: コミットして PR を作成する**

```bash
git add -A
git commit -m "feat(extraction): officeparser によるテキスト抽出を追加

- 抽出テキストの前処理・長さ検証・スキャンPDF判定を実装
- TextExtractor インターフェースで実装を差し替え可能にした
- AI 関連のエラーコード6種を追加"
```

---

## Task 3: Gemini クライアントと構造化出力

**ブランチ:** `feature/gemini-client`

**Files:**
- Create: `lib/gemini/client.ts`
- Create: `lib/gemini/extract-tasks.ts`
- Create: `lib/gemini/__tests__/extract-tasks.test.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `Result` `ok` `err`
- Produces:
  - `type ExtractedTask = { title: string; description: string; priority: string; assignee: string; due_date: string; ambiguity_note: string; ai_suggestion: string }`
  - `type ExtractionResult = { tasks: ExtractedTask[]; document_summary: string; model: string; inputTokens: number; outputTokens: number }`
  - `interface TaskExtractor { extract(input: { text: string } | { pdf: Uint8Array }): Promise<Result<ExtractionResult>> }`
  - `function createGeminiTaskExtractor(): TaskExtractor`
  - `const EXTRACTION_SCHEMA`（構造化出力の JSON スキーマ）
  - `function buildPrompt(text: string): string`
  - `function parseExtractionResponse(outputText: string): Result<{ tasks: ExtractedTask[]; document_summary: string }>`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout main
git pull --ff-only
git checkout -b feature/gemini-client
```

- [ ] **Step 2: 依存を追加する**

```bash
npm install @google/genai
```

- [ ] **Step 3: 失敗するテストを書く**

`lib/gemini/__tests__/extract-tasks.test.ts` を作成する。
**実 API は呼ばない。** 応答文字列の解釈だけを検証する。

```typescript
import { describe, expect, it } from 'vitest'
import { EXTRACTION_SCHEMA, buildPrompt, parseExtractionResponse } from '@/lib/gemini/extract-tasks'

describe('buildPrompt', () => {
  it('本文を含める', () => {
    expect(buildPrompt('会議メモ')).toContain('会議メモ')
  })

  it('日本語で出力するよう指示する', () => {
    expect(buildPrompt('x')).toContain('日本語')
  })

  it('曖昧な期限を空文字にするよう指示する', () => {
    const prompt = buildPrompt('x')
    expect(prompt).toContain('YYYY-MM-DD')
    expect(prompt).toContain('ambiguity_note')
  })
})

describe('EXTRACTION_SCHEMA', () => {
  it('tasks と document_summary を必須にする', () => {
    expect(EXTRACTION_SCHEMA.required).toEqual(['tasks', 'document_summary'])
  })

  it('優先度を 3 種類に限定する', () => {
    const priority = EXTRACTION_SCHEMA.properties.tasks.items.properties.priority
    expect(priority.enum).toEqual(['high', 'medium', 'low'])
  })
})

describe('parseExtractionResponse', () => {
  const valid = JSON.stringify({
    tasks: [
      {
        title: '見積もりを提出する',
        description: '来週までに見積もりを作成して提出する',
        priority: 'high',
        assignee: '',
        due_date: '',
        ambiguity_note: '「来週」が具体的な日付を指していません。',
        ai_suggestion: '提出期限を具体的な日付で決めてください。',
      },
    ],
    document_summary: '会議メモから 1 件のタスクを抽出しました。',
  })

  it('正しい JSON を解釈する', () => {
    const result = parseExtractionResponse(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.tasks).toHaveLength(1)
      expect(result.data.tasks[0].title).toBe('見積もりを提出する')
    }
  })

  it('JSON として壊れていたら拒否する', () => {
    const result = parseExtractionResponse('これはJSONではありません')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_RESPONSE_INVALID')
  })

  it('必須項目が欠けていたら拒否する', () => {
    const result = parseExtractionResponse(JSON.stringify({ tasks: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_RESPONSE_INVALID')
  })

  it('想定外の優先度を拒否する', () => {
    const broken = JSON.parse(valid)
    broken.tasks[0].priority = 'urgent'
    const result = parseExtractionResponse(JSON.stringify(broken))
    expect(result.ok).toBe(false)
  })

  it('タスクが 0 件でも成功として扱う', () => {
    const empty = JSON.stringify({ tasks: [], document_summary: 'タスクはありません。' })
    const result = parseExtractionResponse(empty)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.tasks).toHaveLength(0)
  })
})
```

- [ ] **Step 4: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/gemini/extract-tasks` を解決できない）

- [ ] **Step 5: プロンプトとスキーマを実装する**

`lib/gemini/extract-tasks.ts` を作成する。

```typescript
import { z } from 'zod'
import { type Result, err, ok } from '@/lib/domain/result'

export type ExtractedTask = {
  title: string
  description: string
  priority: string
  assignee: string
  due_date: string
  ambiguity_note: string
  ai_suggestion: string
}

/** Gemini の構造化出力に渡す JSON スキーマ */
export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'タスク名。簡潔な動詞句にする' },
          description: { type: 'string', description: '何をするかの説明' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          assignee: { type: 'string', description: '文書から読み取れる担当者。不明なら空文字' },
          due_date: { type: 'string', description: 'YYYY-MM-DD 形式のみ。曖昧なら空文字' },
          ambiguity_note: { type: 'string', description: '記述が不透明な点。なければ空文字' },
          ai_suggestion: { type: 'string', description: 'タスク化に向けた改善案。なければ空文字' },
        },
        required: [
          'title',
          'description',
          'priority',
          'assignee',
          'due_date',
          'ambiguity_note',
          'ai_suggestion',
        ],
      },
    },
    document_summary: { type: 'string', description: 'ドキュメント全体の要約。1〜3文' },
  },
  required: ['tasks', 'document_summary'],
} as const

export function buildPrompt(text: string): string {
  return `あなたはプロジェクト管理の専門家です。次のドキュメントを読み、実行すべきタスクを抽出してください。

出力の決まり:
- すべて日本語で書いてください。
- title は簡潔な動詞句にしてください（例: 見積もりを提出する）。
- due_date は YYYY-MM-DD 形式の確定した日付のみ書いてください。
  「来週」「適宜」「なるべく早く」のような曖昧な表現の場合は due_date を空文字にし、
  その表現が曖昧であることを ambiguity_note に日本語で書いてください。
- assignee は文書から明確に読み取れる場合のみ書き、不明なら空文字にしてください。
- 記述が不透明でタスクとして実行できない点があれば ambiguity_note に指摘してください。
- タスクとして成立させるための具体的な改善案を ai_suggestion に書いてください。
- タスクが見当たらない場合は tasks を空配列にしてください。推測でタスクを作らないでください。

ドキュメント:
---
${text}
---`
}

const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  assignee: z.string(),
  due_date: z.string(),
  ambiguity_note: z.string(),
  ai_suggestion: z.string(),
})

const responseSchema = z.object({
  tasks: z.array(taskSchema),
  document_summary: z.string(),
})

export function parseExtractionResponse(
  outputText: string,
): Result<{ tasks: ExtractedTask[]; document_summary: string }> {
  let raw: unknown
  try {
    raw = JSON.parse(outputText)
  } catch {
    return err('AI_RESPONSE_INVALID', 'AI の応答を解釈できませんでした。もう一度お試しください。')
  }

  const parsed = responseSchema.safeParse(raw)
  if (!parsed.success) {
    return err('AI_RESPONSE_INVALID', 'AI の応答を解釈できませんでした。もう一度お試しください。')
  }

  return ok(parsed.data)
}
```

- [ ] **Step 6: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（gemini 9 件を含む全件）

- [ ] **Step 7: クライアントを実装する**

`lib/gemini/client.ts` を作成する。

```typescript
import { GoogleGenAI } from '@google/genai'
import { type Result, err, ok } from '@/lib/domain/result'
import {
  EXTRACTION_SCHEMA,
  type ExtractedTask,
  buildPrompt,
  parseExtractionResponse,
} from './extract-tasks'

export type ExtractionResult = {
  tasks: ExtractedTask[]
  document_summary: string
  model: string
  inputTokens: number
  outputTokens: number
}

export interface TaskExtractor {
  extract(input: { text: string } | { pdf: Uint8Array }): Promise<Result<ExtractionResult>>
}

const DEFAULT_MODEL = 'gemini-3.7-flash'
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash'

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status
  return status === 429 || status === 500 || status === 503
}

export function createGeminiTaskExtractor(): TaskExtractor {
  return {
    async extract(input) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return err('AI_NOT_CONFIGURED', 'AI 機能が設定されていません。')
      }

      const ai = new GoogleGenAI({ apiKey })
      const models = [
        process.env.GEMINI_MODEL || DEFAULT_MODEL,
        process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
      ]

      const contents =
        'pdf' in input
          ? [
              { type: 'text', text: buildPrompt('（添付の PDF を読んでください）') },
              {
                type: 'document',
                data: Buffer.from(input.pdf).toString('base64'),
                mime_type: 'application/pdf',
              },
            ]
          : [{ type: 'text', text: buildPrompt(input.text) }]

      let lastRetryable = false

      for (const model of models) {
        try {
          const interaction = await ai.interactions.create({
            model,
            input: contents,
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: EXTRACTION_SCHEMA,
            },
          })

          const parsed = parseExtractionResponse(interaction.output_text ?? '')
          if (!parsed.ok) return parsed

          const usage = interaction.usage as
            | { total_input_tokens?: number; total_output_tokens?: number }
            | undefined

          return ok({
            ...parsed.data,
            model,
            inputTokens: usage?.total_input_tokens ?? 0,
            outputTokens: usage?.total_output_tokens ?? 0,
          })
        } catch (error) {
          lastRetryable = isRetryable(error)
          if (!lastRetryable) {
            return err('AI_REQUEST_FAILED', 'AI への問い合わせに失敗しました。時間をおいてお試しください。')
          }
          // 混雑していたら次のモデルを試す
        }
      }

      return err('AI_MODEL_UNAVAILABLE', 'AI が混雑しています。時間をおいてお試しください。')
    },
  }
}
```

> **設計上の根拠**: 2026-08-30 の実機検証で `gemini-3.7-flash` が
> 500「currently experiencing high demand」を継続的に返し、
> `gemini-3.5-flash` は成功した。5xx / 429 のときにモデルを切り替える。

- [ ] **Step 8: 環境変数の雛形を更新する**

`.env.local.example` に追記する。

```bash
# Gemini API キー（サーバー専用・絶対に公開しない）
GEMINI_API_KEY=

# 使用するモデル。未設定なら gemini-3.7-flash
GEMINI_MODEL=gemini-3.7-flash

# 既定モデルが混雑しているときの代替。未設定なら gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash
```

- [ ] **Step 9: キーがクライアントに漏れないことを確認する**

```bash
npm run build
grep -rl "GEMINI_API_KEY" .next/static 2>/dev/null && echo "❌ キー名がクライアントバンドルに含まれる" || echo "✅ クライアントバンドルに含まれない"
```

- [ ] **Step 10: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 11: コミットして PR を作成する**

```bash
git add -A
git commit -m "feat(gemini): Gemini クライアントと構造化出力を追加

- Interactions API による構造化出力の呼び出しを実装
- 5xx/429 のときにフォールバックモデルへ切り替える再試行を実装
- 抽出プロンプトを日本語で定義し、曖昧な期限を不透明点に回す指示を追加
- 応答の Zod 検証とトークン使用量の取得を実装"
```

---

## Task 4: 抽出フローと提案プレビュー

**ブランチ:** `feature/task-extraction`

**Files:**
- Create: `lib/repositories/tasks.ts`, `lib/repositories/extraction-runs.ts`
- Create: `lib/usecases/extract-tasks.ts`, `lib/usecases/__tests__/extract-tasks.test.ts`
- Create: `lib/actions/extraction.ts`
- Create: `components/app/task-extract-panel.tsx`
- Modify: `app/(app)/projects/[projectId]/files/[fileId]/page.tsx`

**Interfaces:**
- Consumes: `TaskExtractor`（Task 3）、`TextExtractor`（Task 2）、
  `preprocessText` `validateExtractedText` `looksLikeScannedPdf`（Task 2）、
  `normalizeDueDate` `isTaskPriority`（Task 1）、`FileRepository` `FileVersionRepository`（P1）
- Produces:
  - `type Task = { id, projectId, sourceFileId, sourceVersion, title, description, status, priority, assignee, dueDate, ambiguityNote, aiSuggestion, origin, position, updatedAt }`
  - `interface TaskRepository { listByProject; create; createMany; update; remove }`
  - `interface ExtractionRunRepository { start; finish; fail }`
  - `type TaskSuggestion = { title; description; priority; assignee; dueDate; ambiguityNote; aiSuggestion }`
  - `function extractTasksFromFile(deps, input): Promise<Result<{ suggestions: TaskSuggestion[]; summary: string }>>`
  - Server Actions: `extractTasksAction(formData)`, `registerTasksAction(formData)`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout main
git pull --ff-only
git checkout -b feature/task-extraction
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/usecases/__tests__/extract-tasks.test.ts` を作成する。
**Gemini も officeparser もモックする。実 API を呼ばない。**

```typescript
import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/lib/domain/result'
import { extractTasksFromFile } from '@/lib/usecases/extract-tasks'

const markdownFile = {
  id: 'f1',
  projectId: 'p1',
  folderId: null,
  name: 'メモ.md',
  kind: 'markdown' as const,
  mimeType: 'text/markdown',
  size: 100,
  storagePath: null,
  currentVersion: 2,
  updatedAt: '2026-08-30T00:00:00Z',
}

const binaryFile = { ...markdownFile, id: 'f2', name: '資料.pdf', kind: 'binary' as const, storagePath: 'p1/f2/1/f2.pdf' }

function makeDeps(overrides: Partial<Parameters<typeof extractTasksFromFile>[0]> = {}) {
  return {
    files: {
      findById: vi.fn(async (id: string) => (id === 'f2' ? binaryFile : markdownFile)),
      listByProject: vi.fn(async () => []),
      create: vi.fn(),
      updateForNewVersion: vi.fn(),
      remove: vi.fn(),
    },
    versions: {
      findByVersion: vi.fn(async () => ({
        id: 'v', fileId: 'f1', version: 2,
        content: '# 会議メモ\n\n- 見積もりを出す',
        storagePath: null, size: 30, authorId: 'u1', note: '', createdAt: '',
      })),
      listByFile: vi.fn(async () => []),
      create: vi.fn(),
    },
    downloadBinary: vi.fn(async () => new Uint8Array([1, 2, 3])),
    textExtractor: { extract: vi.fn(async () => '抽出されたテキスト'.repeat(50)) },
    taskExtractor: {
      extract: vi.fn(async () =>
        ok({
          tasks: [
            {
              title: '見積もりを提出する',
              description: '来週までに提出',
              priority: 'high',
              assignee: '',
              due_date: '来週まで',
              ambiguity_note: '「来週」が不明確です。',
              ai_suggestion: '期限を日付で決めてください。',
            },
          ],
          document_summary: '要約',
          model: 'gemini-3.5-flash',
          inputTokens: 43,
          outputTokens: 290,
        }),
      ),
    },
    runs: {
      start: vi.fn(async () => ({ id: 'run1' })),
      finish: vi.fn(async () => {}),
      fail: vi.fn(async () => {}),
    },
    ...overrides,
  }
}

describe('extractTasksFromFile', () => {
  it('markdown は DB の本文を使い、テキスト抽出器を呼ばない', async () => {
    const deps = makeDeps()
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(true)
    expect(deps.textExtractor.extract).not.toHaveBeenCalled()
    expect(deps.taskExtractor.extract).toHaveBeenCalled()
  })

  it('binary は Storage から取得してテキスト抽出器に渡す', async () => {
    const deps = makeDeps()
    await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f2', userId: 'u1' })

    expect(deps.downloadBinary).toHaveBeenCalledWith('p1/f2/1/f2.pdf')
    expect(deps.textExtractor.extract).toHaveBeenCalled()
  })

  it('自然言語の期限を null にして提案に載せる', async () => {
    const deps = makeDeps()
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.suggestions[0].dueDate).toBeNull()
      expect(result.data.suggestions[0].ambiguityNote).toContain('来週')
    }
  })

  it('提案の段階ではタスクを保存しない', async () => {
    const deps = makeDeps()
    await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    // TaskRepository は依存に含めない設計。保存は登録アクションの責務
    expect('tasks' in deps).toBe(false)
  })

  it('実行記録を開始し、成功で終了させる', async () => {
    const deps = makeDeps()
    await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(deps.runs.start).toHaveBeenCalled()
    expect(deps.runs.finish).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run1', taskCount: 1, model: 'gemini-3.5-flash' }),
    )
  })

  it('存在しないファイルを拒否する', async () => {
    const deps = makeDeps({
      files: { ...makeDeps().files, findById: vi.fn(async () => null) },
    })
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'x', userId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('抽出テキストが空なら失敗として記録する', async () => {
    const deps = makeDeps({
      versions: { ...makeDeps().versions, findByVersion: vi.fn(async () => null) },
    })
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TEXT_EXTRACTION_FAILED')
    expect(deps.runs.fail).toHaveBeenCalled()
  })

  it('想定外の優先度は medium に丸める', async () => {
    const deps = makeDeps()
    deps.taskExtractor.extract = vi.fn(async () =>
      ok({
        tasks: [{
          title: 'X', description: '', priority: 'urgent', assignee: '',
          due_date: '', ambiguity_note: '', ai_suggestion: '',
        }],
        document_summary: '', model: 'm', inputTokens: 0, outputTokens: 0,
      }),
    )
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.suggestions[0].priority).toBe('medium')
  })
})
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/usecases/extract-tasks` を解決できない）

- [ ] **Step 4: ユースケースを実装する**

`lib/usecases/extract-tasks.ts` を作成する。

```typescript
import {
  looksLikeScannedPdf,
  preprocessText,
  validateExtractedText,
} from '@/lib/domain/extraction'
import { getExtension } from '@/lib/domain/files'
import { type Result, err, ok } from '@/lib/domain/result'
import { isTaskPriority, normalizeDueDate } from '@/lib/domain/tasks'
import type { TaskExtractor } from '@/lib/gemini/client'
import type { TextExtractor } from '@/lib/extraction/text'
import type { FileVersionRepository } from '@/lib/repositories/file-versions'
import type { FileRepository } from '@/lib/repositories/files'
import type { ExtractionRunRepository } from '@/lib/repositories/extraction-runs'
import type { TaskPriority } from '@/lib/domain/tasks'

export type TaskSuggestion = {
  title: string
  description: string
  priority: TaskPriority
  assignee: string
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
}

type Deps = {
  files: FileRepository
  versions: FileVersionRepository
  downloadBinary: (storagePath: string) => Promise<Uint8Array>
  textExtractor: TextExtractor
  taskExtractor: TaskExtractor
  runs: ExtractionRunRepository
}

/**
 * ファイルからタスク候補を抽出する。
 * ここではタスクを保存しない。保存はユーザーが選択した後に行う。
 */
export async function extractTasksFromFile(
  deps: Deps,
  input: { projectId: string; fileId: string; userId: string },
): Promise<Result<{ suggestions: TaskSuggestion[]; summary: string }>> {
  const file = await deps.files.findById(input.fileId)
  if (!file) return err('NOT_FOUND', 'ファイルが見つかりません。')

  const run = await deps.runs.start({
    projectId: input.projectId,
    fileId: file.id,
    fileVersion: file.currentVersion,
    userId: input.userId,
  })

  const failWith = async (error: { code: string; message: string }) => {
    await deps.runs.fail({ runId: run.id, errorMessage: `${error.code}: ${error.message}` })
  }

  // 本文を取得する
  let rawText = ''
  let pdfBuffer: Uint8Array | null = null

  if (file.kind === 'binary') {
    if (!file.storagePath) {
      const result = err('TEXT_EXTRACTION_FAILED', 'ファイルからテキストを取り出せませんでした。')
      await failWith(result.error)
      return result
    }
    const buffer = await deps.downloadBinary(file.storagePath)
    rawText = await deps.textExtractor.extract({ buffer, filename: file.name })
    if (looksLikeScannedPdf(rawText, getExtension(file.name))) {
      pdfBuffer = buffer
    }
  } else {
    const version = await deps.versions.findByVersion(file.id, file.currentVersion)
    rawText = version?.content ?? ''
  }

  const text = preprocessText(rawText)

  // スキャン PDF でなければテキストの妥当性を検証する
  if (!pdfBuffer) {
    const validated = validateExtractedText(text)
    if (!validated.ok) {
      await failWith(validated.error)
      return validated
    }
  }

  const extracted = await deps.taskExtractor.extract(
    pdfBuffer ? { pdf: pdfBuffer } : { text },
  )
  if (!extracted.ok) {
    await failWith(extracted.error)
    return extracted
  }

  const suggestions: TaskSuggestion[] = extracted.data.tasks.map((task) => ({
    title: task.title,
    description: task.description,
    priority: isTaskPriority(task.priority) ? task.priority : 'medium',
    assignee: task.assignee,
    dueDate: normalizeDueDate(task.due_date),
    ambiguityNote: task.ambiguity_note,
    aiSuggestion: task.ai_suggestion,
  }))

  await deps.runs.finish({
    runId: run.id,
    model: extracted.data.model,
    taskCount: suggestions.length,
    inputChars: text.length,
    inputTokens: extracted.data.inputTokens,
    outputTokens: extracted.data.outputTokens,
  })

  return ok({ suggestions, summary: extracted.data.document_summary })
}
```

- [ ] **Step 5: リポジトリを実装する**

`lib/repositories/extraction-runs.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ExtractionRunRepository {
  start(input: {
    projectId: string
    fileId: string
    fileVersion: number
    userId: string
  }): Promise<{ id: string }>
  finish(input: {
    runId: string
    model: string
    taskCount: number
    inputChars: number
    inputTokens: number
    outputTokens: number
  }): Promise<void>
  fail(input: { runId: string; errorMessage: string }): Promise<void>
}

export function createSupabaseExtractionRunRepository(
  supabase: SupabaseClient,
): ExtractionRunRepository {
  return {
    async start({ projectId, fileId, fileVersion, userId }) {
      const { data, error } = await supabase
        .from('extraction_runs')
        .insert({
          project_id: projectId,
          file_id: fileId,
          file_version: fileVersion,
          created_by: userId,
          status: 'running',
        })
        .select('id')
        .single()
      if (error) throw error
      return { id: (data as { id: string }).id }
    },

    async finish({ runId, model, taskCount, inputChars, inputTokens, outputTokens }) {
      const { error } = await supabase
        .from('extraction_runs')
        .update({
          status: 'succeeded',
          model,
          task_count: taskCount,
          input_chars: inputChars,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId)
      if (error) throw error
    },

    async fail({ runId, errorMessage }) {
      const { error } = await supabase
        .from('extraction_runs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId)
      if (error) throw error
    },
  }
}
```

`lib/repositories/tasks.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskPriority, TaskStatus } from '@/lib/domain/tasks'

export type Task = {
  id: string
  projectId: string
  sourceFileId: string | null
  sourceVersion: number | null
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
  origin: 'ai' | 'manual'
  position: number
  updatedAt: string
}

export type TaskInput = {
  projectId: string
  sourceFileId: string | null
  sourceVersion: number | null
  title: string
  description: string
  priority: TaskPriority
  assignee: string
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
  origin: 'ai' | 'manual'
  createdBy: string
}

export interface TaskRepository {
  listByProject(projectId: string): Promise<Task[]>
  createMany(inputs: TaskInput[]): Promise<number>
  update(id: string, patch: Partial<Omit<Task, 'id' | 'projectId'>>): Promise<void>
  remove(id: string): Promise<void>
}

type Row = {
  id: string
  project_id: string
  source_file_id: string | null
  source_version: number | null
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  due_date: string | null
  ambiguity_note: string
  ai_suggestion: string
  origin: 'ai' | 'manual'
  position: number
  updated_at: string
}

const COLUMNS =
  'id, project_id, source_file_id, source_version, title, description, status, priority, assignee, due_date, ambiguity_note, ai_suggestion, origin, position, updated_at'

function toTask(row: Row): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceFileId: row.source_file_id,
    sourceVersion: row.source_version,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    dueDate: row.due_date,
    ambiguityNote: row.ambiguity_note,
    aiSuggestion: row.ai_suggestion,
    origin: row.origin,
    position: row.position,
    updatedAt: row.updated_at,
  }
}

export function createSupabaseTaskRepository(supabase: SupabaseClient): TaskRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('tasks')
        .select(COLUMNS)
        .eq('project_id', projectId)
        .order('status')
        .order('position')
      if (error) throw error
      return (data as Row[]).map(toTask)
    },

    async createMany(inputs) {
      if (inputs.length === 0) return 0
      const { error, count } = await supabase.from('tasks').insert(
        inputs.map((input, index) => ({
          project_id: input.projectId,
          source_file_id: input.sourceFileId,
          source_version: input.sourceVersion,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assignee: input.assignee,
          due_date: input.dueDate,
          ambiguity_note: input.ambiguityNote,
          ai_suggestion: input.aiSuggestion,
          origin: input.origin,
          position: index,
          created_by: input.createdBy,
        })),
        { count: 'exact' },
      )
      if (error) throw error
      return count ?? inputs.length
    },

    async update(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.title !== undefined) row.title = patch.title
      if (patch.description !== undefined) row.description = patch.description
      if (patch.status !== undefined) row.status = patch.status
      if (patch.priority !== undefined) row.priority = patch.priority
      if (patch.assignee !== undefined) row.assignee = patch.assignee
      if (patch.dueDate !== undefined) row.due_date = patch.dueDate
      if (patch.position !== undefined) row.position = patch.position

      const { error } = await supabase.from('tasks').update(row).eq('id', id)
      if (error) throw error
    },

    async remove(id) {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
  }
}
```

- [ ] **Step 6: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（extract-tasks 8 件を含む全件）

- [ ] **Step 7: Server Action を実装する**

`lib/actions/extraction.ts` を作成する。
**応答に 20 秒以上かかるため最大実行時間を延ばす。**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { isTaskPriority } from '@/lib/domain/tasks'
import { createOfficeParserExtractor } from '@/lib/extraction/text'
import { createGeminiTaskExtractor } from '@/lib/gemini/client'
import { createSupabaseExtractionRunRepository } from '@/lib/repositories/extraction-runs'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { type TaskSuggestion, extractTasksFromFile } from '@/lib/usecases/extract-tasks'

const BUCKET = 'project-files'

export async function extractTasksAction(
  formData: FormData,
): Promise<Result<{ suggestions: TaskSuggestion[]; summary: string }>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  if (!projectId || !fileId) {
    return err('VALIDATION_ERROR', '対象のファイルが指定されていません。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    return await extractTasksFromFile(
      {
        files: createSupabaseFileRepository(supabase),
        versions: createSupabaseFileVersionRepository(supabase),
        downloadBinary: async (storagePath) => {
          const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
          if (error || !data) throw error ?? new Error('download failed')
          return new Uint8Array(await data.arrayBuffer())
        },
        textExtractor: createOfficeParserExtractor(),
        taskExtractor: createGeminiTaskExtractor(),
        runs: createSupabaseExtractionRunRepository(supabase),
      },
      { projectId, fileId, userId: user.id },
    )
  } catch {
    return err('UNKNOWN', 'タスク抽出に失敗しました。')
  }
}

export async function registerTasksAction(formData: FormData): Promise<Result<number>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  const sourceVersionRaw = String(formData.get('sourceVersion') ?? '')
  const payload = String(formData.get('suggestions') ?? '[]')

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  let suggestions: TaskSuggestion[]
  try {
    suggestions = JSON.parse(payload) as TaskSuggestion[]
  } catch {
    return err('VALIDATION_ERROR', '登録するタスクを解釈できませんでした。')
  }

  if (suggestions.length === 0) {
    return err('VALIDATION_ERROR', '登録するタスクを選んでください。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const count = await createSupabaseTaskRepository(supabase).createMany(
      suggestions.map((suggestion) => ({
        projectId,
        sourceFileId: fileId || null,
        sourceVersion: sourceVersionRaw ? Number(sourceVersionRaw) : null,
        title: suggestion.title,
        description: suggestion.description,
        priority: isTaskPriority(suggestion.priority) ? suggestion.priority : 'medium',
        assignee: suggestion.assignee,
        dueDate: suggestion.dueDate,
        ambiguityNote: suggestion.ambiguityNote,
        aiSuggestion: suggestion.aiSuggestion,
        origin: 'ai' as const,
        createdBy: user.id,
      })),
    )

    revalidatePath(`/projects/${projectId}/tasks`)
    return ok(count)
  } catch {
    return err('UNKNOWN', 'タスクを登録できませんでした。')
  }
}
```

`app/(app)/projects/[projectId]/files/[fileId]/page.tsx` の先頭に追記する。

```typescript
/** AI 抽出は 20 秒以上かかることがあるため、実行時間の上限を延ばす */
export const maxDuration = 120
```

- [ ] **Step 8: 提案プレビュー UI を実装する**

`components/app/task-extract-panel.tsx` を作成する。
**送信内容の明示と確認ダイアログを必ず入れること**（`CLAUDE.md` R-21）。

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { extractTasksAction, registerTasksAction } from '@/lib/actions/extraction'
import { PRIORITY_LABEL } from '@/lib/domain/tasks'
import type { TaskSuggestion } from '@/lib/usecases/extract-tasks'

export function TaskExtractPanel({
  projectId,
  fileId,
  fileName,
  sourceVersion,
}: {
  projectId: string
  fileId: string
  fileName: string
  sourceVersion: number
}) {
  const [suggestions, setSuggestions] = useState<TaskSuggestion[] | null>(null)
  const [summary, setSummary] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleExtract() {
    const confirmed = window.confirm(
      `「${fileName}」の本文を Google Gemini API に送信してタスクを抽出します。\n` +
        'ファイル名やプロジェクト名は送信しません。\n' +
        '実行してよろしいですか？',
    )
    if (!confirmed) return

    setMessage(null)
    setSuggestions(null)
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)

    startTransition(async () => {
      const result = await extractTasksAction(formData)
      if (result.ok) {
        setSuggestions(result.data.suggestions)
        setSummary(result.data.summary)
        setSelected(new Set(result.data.suggestions.map((_, index) => index)))
        if (result.data.suggestions.length === 0) {
          setMessage('タスクは見つかりませんでした。')
        }
      } else {
        setMessage(result.error.message)
      }
    })
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleRegister() {
    if (!suggestions) return
    const picked = suggestions.filter((_, index) => selected.has(index))
    if (picked.length === 0) {
      setMessage('登録するタスクを選んでください。')
      return
    }

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)
    formData.set('sourceVersion', String(sourceVersion))
    formData.set('suggestions', JSON.stringify(picked))

    startTransition(async () => {
      const result = await registerTasksAction(formData)
      if (result.ok) {
        setMessage(`${result.data} 件のタスクを登録しました。`)
        setSuggestions(null)
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontWeight: 600 }}>AI タスク抽出</h2>
        <Button onClick={handleExtract} disabled={isPending}>
          {isPending ? '解析中…（最大 2 分）' : 'タスクを抽出'}
        </Button>
        {message && <span style={{ fontSize: '0.85rem' }}>{message}</span>}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
        このファイルの本文が Google Gemini API に送信されます。
        ファイル名・プロジェクト名・アカウント情報は送信しません。
      </p>

      {suggestions && suggestions.length > 0 && (
        <Card style={{ display: 'grid', gap: 12 }}>
          {summary && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>{summary}</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                  />
                  <span style={{ fontWeight: 600 }}>{suggestion.title}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
                    優先度: {PRIORITY_LABEL[suggestion.priority]}
                    {suggestion.dueDate ? ` / 期限: ${suggestion.dueDate}` : ''}
                  </span>
                </label>
                {suggestion.description && (
                  <p style={{ fontSize: '0.85rem' }}>{suggestion.description}</p>
                )}
                {suggestion.ambiguityNote && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
                    ⚠️ 不透明点: {suggestion.ambiguityNote}
                  </p>
                )}
                {suggestion.aiSuggestion && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
                    💡 改善提案: {suggestion.aiSuggestion}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div>
            <Button onClick={handleRegister} disabled={isPending}>
              選択したタスクを登録（{selected.size} 件）
            </Button>
          </div>
        </Card>
      )}
    </section>
  )
}
```

ファイル画面に組み込む（`app/(app)/projects/[projectId]/files/[fileId]/page.tsx`）。

```tsx
<TaskExtractPanel
  projectId={projectId}
  fileId={fileId}
  fileName={file.name}
  sourceVersion={file.currentVersion}
/>
```

- [ ] **Step 9: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 10: 実際に動作を確認する**

```bash
npm run dev
```

1. Markdown ファイルで「タスクを抽出」を押すと確認ダイアログが出ること
2. 承諾すると解析が始まり、提案がチェックボックス付きで表示されること
3. 曖昧な期限のタスクで期限が空になり、不透明点が表示されること
4. チェックを外したタスクが登録されないこと
5. `docx` / `xlsx` / `pptx` / `pdf` でも抽出できること
6. Supabase MCP の `execute_sql` で `select status, model, task_count, input_tokens, output_tokens from public.extraction_runs order by created_at desc limit 5;` を確認する

- [ ] **Step 11: コミットして PR を作成する**

```bash
git add -A
git commit -m "feat(extraction): AIタスク抽出と提案プレビューを実装

- ファイルからテキストを取得しGeminiで抽出するユースケースを追加
- 抽出結果は保存せず提案として提示し、選択されたものだけを登録
- 自然言語の期限は空にして不透明点に回す
- 実行記録にモデル・文字数・トークン数を保存
- 送信内容の明示と確認ダイアログを実装（R-21）"
```

---

## Task 5: タスク管理画面（リスト / カンバン / 手動 CRUD）

**ブランチ:** `feature/task-management`

**Files:**
- Create: `app/(app)/projects/[projectId]/tasks/page.tsx`
- Create: `components/app/task-list.tsx`, `components/app/task-board.tsx`, `components/app/task-form.tsx`
- Create: `lib/actions/tasks.ts`
- Modify: `app/(app)/projects/[projectId]/page.tsx`（タスク画面へのリンク追加）
- Modify: `app/(app)/layout.tsx` は変更しない

**Interfaces:**
- Consumes: `TaskRepository` `Task`（Task 4）、`validateTaskTitle` `normalizeDueDate`
  `TASK_STATUSES` `STATUS_LABEL` `PRIORITY_LABEL`（Task 1）
- Produces:
  - Server Actions: `createTaskAction`, `updateTaskAction`, `deleteTaskAction`, `moveTaskAction`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout main
git pull --ff-only
git checkout -b feature/task-management
```

- [ ] **Step 2: Server Actions を実装する**

`lib/actions/tasks.ts` を作成する。

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import {
  isTaskPriority,
  isTaskStatus,
  normalizeDueDate,
  validateTaskTitle,
} from '@/lib/domain/tasks'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function context() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const validated = validateTaskTitle(String(formData.get('title') ?? ''))
  if (!validated.ok) return validated

  const priorityRaw = String(formData.get('priority') ?? 'medium')
  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).createMany([
      {
        projectId,
        sourceFileId: null,
        sourceVersion: null,
        title: validated.data,
        description: String(formData.get('description') ?? ''),
        priority: isTaskPriority(priorityRaw) ? priorityRaw : 'medium',
        assignee: String(formData.get('assignee') ?? ''),
        dueDate: normalizeDueDate(String(formData.get('dueDate') ?? '')),
        ambiguityNote: '',
        aiSuggestion: '',
        origin: 'manual',
        createdBy: user.id,
      },
    ])
  } catch {
    return err('UNKNOWN', 'タスクを作成できませんでした。')
  }

  revalidatePath(`/projects/${projectId}/tasks`)
  return ok(null)
}

export async function updateTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のタスクが指定されていません。')

  const validated = validateTaskTitle(String(formData.get('title') ?? ''))
  if (!validated.ok) return validated

  const priorityRaw = String(formData.get('priority') ?? 'medium')
  const statusRaw = String(formData.get('status') ?? 'todo')

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).update(id, {
      title: validated.data,
      description: String(formData.get('description') ?? ''),
      priority: isTaskPriority(priorityRaw) ? priorityRaw : 'medium',
      status: isTaskStatus(statusRaw) ? statusRaw : 'todo',
      assignee: String(formData.get('assignee') ?? ''),
      dueDate: normalizeDueDate(String(formData.get('dueDate') ?? '')),
    })
  } catch {
    return err('UNKNOWN', 'タスクを更新できませんでした。')
  }

  revalidatePath(`/projects/${projectId}/tasks`)
  return ok(null)
}

export async function moveTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  const statusRaw = String(formData.get('status') ?? '')

  if (!id || !isTaskStatus(statusRaw)) {
    return err('VALIDATION_ERROR', '移動先が正しくありません。')
  }

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).update(id, { status: statusRaw })
  } catch {
    return err('UNKNOWN', 'タスクを移動できませんでした。')
  }

  revalidatePath(`/projects/${projectId}/tasks`)
  return ok(null)
}

export async function deleteTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のタスクが指定されていません。')

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).remove(id)
  } catch {
    return err('UNKNOWN', 'タスクを削除できませんでした。')
  }

  revalidatePath(`/projects/${projectId}/tasks`)
  return ok(null)
}
```

- [ ] **Step 3: タスク画面を実装する**

`app/(app)/projects/[projectId]/tasks/page.tsx` を作成し、
`TaskForm`（手動追加）、`TaskList`（リスト）、`TaskBoard`（カンバン）を配置する。
表示モードは `useState` でクライアント側に持ち、切替ボタンで変更する。

カンバンは `TASK_STATUSES` の 3 列を並べ、各カードに「進行中へ」「完了へ」のような
移動ボタンを置く。ドラッグ＆ドロップは実装しない（キーボード操作でも使えるボタン方式にする）。

各タスクカードには、`ambiguityNote` と `aiSuggestion` が空でない場合のみ
折りたたみ（`<details>`）で表示する。

- [ ] **Step 4: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 5: 実際に動作を確認する**

1. タスクを手動で追加・編集・削除できること
2. リストとカンバンを切り替えられること
3. カンバンで「進行中へ」を押すとステータスが変わり、列が移動すること
4. 不透明点・改善提案が折りたたみで表示されること
5. 別ユーザーのタスクが見えないこと（Supabase MCP で RLS を確認）

- [ ] **Step 6: コミットして PR を作成する**

```bash
git add -A
git commit -m "feat(tasks): タスク管理画面を実装

- リスト表示とカンバン表示の切替を追加
- タスクの手動追加・編集・削除・ステータス移動を実装
- 不透明点と改善提案を折りたたみで表示"
```

---

## 自己レビュー結果

**1. 設計書の網羅性**

| 設計書の項目 | 対応タスク |
|---|---|
| §5.1 テキスト化方針・スキャン PDF 分岐 | Task 2 |
| §5.2 ディレクトリ構成 | Task 1〜5 |
| §6 データモデルと RLS | Task 1 |
| §7 抽出フロー（非破壊） | Task 4 |
| §7.1 出力スキーマ | Task 3 |
| §8 エラー処理 | Task 2（コード追加）+ Task 3・4（送出） |
| §3.1 モデルのフォールバック | Task 3 |
| §3.1 長い応答時間 | Task 4（`maxDuration` と待機 UI） |
| §3.1 期限の扱い | Task 1（`normalizeDueDate`）+ Task 3（プロンプト） |
| §9 テスト方針 | 全タスク |
| §10 ブランチ計画 | 各タスク Step 1 |
| §11 依存 | Task 2 / Task 3 |
| §12 環境変数 | Task 3 Step 8 |
| §13 完了条件 1〜13 | Task 4・5 の動作確認手順に対応 |

なお設計書のブランチ計画では `feature/task-improvements` を独立させていたが、
不透明点と改善提案の表示は Task 4 の提案プレビューと Task 5 のタスクカードに
自然に収まるため、本計画では**独立したブランチを設けず両タスクに含めた**。
レビュー単位としても分割する意味が薄いと判断した。

**2. プレースホルダ**

「TBD」「後で実装」の類は含まれていない。
Task 5 Step 3 のみ画面の構成を文章で示しているが、使用するコンポーネント名、
配置、状態の持ち方、表示条件を具体的に指定しており、判断の余地を残していない。

**3. 型の一貫性**

- `Result<T>` / `ok` / `err` — P1 から継承、全タスクで同一
- `TaskStatus` / `TaskPriority` — Task 1 で定義、Task 4・5 で参照
- `TaskSuggestion` — Task 4 で定義、同タスクの UI と Task 4 の登録アクションで使用
- `TaskExtractor` / `ExtractionResult` — Task 3 で定義、Task 4 で参照
- `TextExtractor` — Task 2 で定義、Task 4 で参照
- `TaskRepository` / `Task` / `TaskInput` — Task 4 で定義、Task 5 で参照
- `ExtractionRunRepository` — Task 4 で定義、同タスク内で使用
- `normalizeDueDate` は Task 1 で `string -> string | null` として定義し、
  Task 4（提案の整形）と Task 5（手動入力）の両方で同じ形で使用している
