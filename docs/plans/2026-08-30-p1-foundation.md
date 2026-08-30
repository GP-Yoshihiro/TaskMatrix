# TaskMatrix 第1フェーズ（基盤）実装計画

> **エージェント実行者へ:** 本計画は `superpowers:subagent-driven-development`（推奨）または
> `superpowers:executing-plans` を用いてタスク単位で実装すること。手順はチェックボックス
> (`- [ ]`) 形式で追跡する。

**ゴール:** 認証・プロジェクト・フォルダ/ファイル・Markdown エディタ・バージョン履歴・
ダッシュボード・プラットフォーム適応テーマを備えた、動作確認済みの基盤アプリケーションを完成させる。

**アーキテクチャ:** Next.js App Router。読み取りは Server Components、書き込みは Server Actions。
Supabase（Auth / PostgreSQL / Storage）を `@supabase/ssr` の Cookie セッションで利用し、
全テーブルで RLS を有効化する。純粋ロジックは `lib/domain` に隔離し、そこを単体テストの中心とする。

**技術スタック:** Next.js (App Router) / React / TypeScript(strict) / Tailwind CSS /
@supabase/supabase-js / @supabase/ssr / Zod / Vitest / @testing-library/react / ESLint

**設計書:** `docs/specs/2026-08-30-p1-foundation-design.md`

---

## グローバル制約

以下は全タスクの要件に暗黙的に含まれる。

- 応答・コメント・ドキュメント・コミットメッセージ・UI 文言はすべて **日本語**（`CLAUDE.md` R-02）
- 機能ごとに **新規ブランチ**を作成する。`main` へ直接コミットしない（R-03）
- 各タスクの最後に `npm run lint` → `npm run typecheck` → `npm test` → `npm run build` を実行し、
  **すべてグリーンであることを確認してからコミット**する（R-05 / R-06）
- テストを先に書き、失敗を確認してから実装する（R-12）
- Supabase プロジェクト ref: `patasstmipeqaaovfihv`（リージョン `ap-northeast-1`）
- Supabase Storage バケット名: `project-files`（private）
- ファイルサイズ上限: **25 MB**（`26214400` バイト）
- 対応拡張子: `xlsx` `docx` `pptx` `pdf` `txt` `md`
- プロジェクト上限: **1 ユーザーあたり 20 件**
- 外部 UI ライブラリ（shadcn/ui 等）は**採用しない**（R-19）
- `SUPABASE_SERVICE_ROLE_KEY` は P1 では使用しない。`.env.local.example` に記載のみ
- 秘密情報をコミット・ログ出力しない（R-14）
- 承認要求時・完了時に `say -v Kyoko "..."` で音声通知する（R-08）

---

## ファイル構成

実装で作成する主要ファイルと責務。

| ファイル | 責務 |
|---|---|
| `lib/domain/result.ts` | 全体で使う判別可能ユニオン `Result<T>` とエラーコード定義 |
| `lib/domain/projects.ts` | プロジェクト名検証・作成上限判定 |
| `lib/domain/folders.ts` | フォルダ名検証・フラット行からのツリー構築 |
| `lib/domain/files.ts` | ファイル種別判定・アップロード検証・Storage パス生成 |
| `lib/domain/diff.ts` | テキスト行差分の生成 |
| `lib/platform/theme.ts` | UA からのプラットフォーム判定・テーマ解決 |
| `lib/supabase/server.ts` | Server Component / Server Action 用クライアント生成 |
| `lib/supabase/client.ts` | ブラウザ用クライアント生成 |
| `lib/supabase/middleware.ts` | セッション更新用ヘルパ |
| `lib/repositories/*.ts` | データアクセス（インターフェース＋Supabase 実装） |
| `lib/actions/*.ts` | Server Actions（薄く保ち、判断は domain に置く） |
| `components/ui/*.tsx` | トークン駆動プリミティブ（1 セットのみ） |
| `components/app/*.tsx` | 画面固有コンポーネント |
| `app/globals.css` | デザイントークン（apple / windows × light / dark） |
| `middleware.ts` | 認証セッション更新とルート保護 |

`lib/domain` は外部依存を持たない。データアクセスもフレームワーク API も参照しない。

---

## Task 1: プロジェクト初期化と検証基盤

**ブランチ:** `chore/scaffold`

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`,
  `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`,
  `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.env.local.example`
- Create: `lib/domain/result.ts`, `lib/domain/__tests__/result.test.ts`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces:
  - `type AppErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'PROJECT_LIMIT_EXCEEDED' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE_TYPE' | 'STORAGE_ERROR' | 'UNKNOWN'`
  - `type AppError = { code: AppErrorCode; message: string }`
  - `type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }`
  - `function ok<T>(data: T): Result<T>`
  - `function err(code: AppErrorCode, message: string): Result<never>`
  - npm スクリプト: `dev` `build` `start` `lint` `typecheck` `test` `test:watch`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout main
git checkout -b chore/scaffold
```

- [ ] **Step 2: Next.js プロジェクトをカレントディレクトリに生成する**

既存の `README.md` `CLAUDE.md` `docs/` `.gitignore` を壊さないよう、カレントに直接生成する。

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --turbopack --no-git
```

競合ファイルの上書き確認が出た場合、`README.md` は **上書きしない**（No）を選ぶ。

- [ ] **Step 3: テスト環境を追加する**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

`vitest.config.ts` を作成する。

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

`vitest.setup.ts` を作成する。

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: npm スクリプトを整える**

`package.json` の `scripts` を次の内容にする。

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: 環境変数の雛形を作成する**

`.env.local.example` を作成する。

```bash
# Supabase プロジェクト URL（クライアントからも参照される）
NEXT_PUBLIC_SUPABASE_URL=https://patasstmipeqaaovfihv.supabase.co

# Supabase 匿名キー（RLS 前提。クライアントからも参照される）
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 管理操作用キー。第1フェーズでは未使用。サーバー専用であり絶対に公開しない
SUPABASE_SERVICE_ROLE_KEY=
```

`.env.local` は作成するがコミットしない（`.gitignore` の `.env*.local` で除外済み）。

- [ ] **Step 6: 失敗するテストを書く**

`lib/domain/__tests__/result.test.ts` を作成する。

```typescript
import { describe, expect, it } from 'vitest'
import { err, ok } from '@/lib/domain/result'

describe('Result', () => {
  it('ok は成功の値を保持する', () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(42)
  })

  it('err はコードと日本語メッセージを保持する', () => {
    const result = err('NOT_FOUND', '対象が見つかりません。')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toBe('対象が見つかりません。')
    }
  })
})
```

- [ ] **Step 7: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/domain/result` を解決できない）

- [ ] **Step 8: 最小の実装を書く**

`lib/domain/result.ts` を作成する。

```typescript
/** アプリケーション全体で使用するエラーコード */
export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PROJECT_LIMIT_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'STORAGE_ERROR'
  | 'UNKNOWN'

export type AppError = {
  code: AppErrorCode
  /** 利用者にそのまま表示できる日本語メッセージ */
  message: string
}

/** 成功と失敗を型で判別できる戻り値。例外を UI に投げないための土台 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: AppErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } }
}
```

- [ ] **Step 9: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（2 件）

- [ ] **Step 10: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。エラーが 1 つでもあれば次へ進まず修正する（R-06）。

- [ ] **Step 11: 開発サーバーで表示を確認する**

```bash
npm run dev
```

`http://localhost:3000` が初期ページを表示することを確認し、サーバーを停止する。

- [ ] **Step 12: コミットする**

```bash
git add -A
git commit -m "chore: Next.js/TypeScript/Tailwind/Vitest の初期構成を追加

- create-next-app による App Router 構成を作成
- Vitest と Testing Library によるテスト環境を追加
- lint/typecheck/test/build の検証スクリプトを整備
- Result 型とエラーコードを定義"
```

---

## Task 2: データベーススキーマと RLS

**ブランチ:** `chore/scaffold`（Task 1 の続き）

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `lib/domain/projects.ts`, `lib/domain/__tests__/projects.test.ts`

**Interfaces:**
- Consumes: `Result<T>`, `ok`, `err`（Task 1）
- Produces:
  - `const MAX_PROJECTS_PER_USER = 20`
  - `function canCreateProject(currentCount: number): boolean`
  - `function validateProjectName(name: string): Result<string>`
  - DB テーブル: `profiles` `projects` `folders` `files` `file_versions`
  - Storage バケット: `project-files`

- [ ] **Step 1: 失敗するテストを書く**

`lib/domain/__tests__/projects.test.ts` を作成する。

```typescript
import { describe, expect, it } from 'vitest'
import {
  MAX_PROJECTS_PER_USER,
  canCreateProject,
  validateProjectName,
} from '@/lib/domain/projects'

describe('canCreateProject', () => {
  it('上限未満なら作成できる', () => {
    expect(canCreateProject(0)).toBe(true)
    expect(canCreateProject(19)).toBe(true)
  })

  it('上限に達していたら作成できない', () => {
    expect(canCreateProject(MAX_PROJECTS_PER_USER)).toBe(false)
    expect(canCreateProject(21)).toBe(false)
  })

  it('上限は 20 件である', () => {
    expect(MAX_PROJECTS_PER_USER).toBe(20)
  })
})

describe('validateProjectName', () => {
  it('前後の空白を取り除いて受け入れる', () => {
    const result = validateProjectName('  新規プロジェクト  ')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe('新規プロジェクト')
  })

  it('空文字を拒否する', () => {
    const result = validateProjectName('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('100 文字を超える名前を拒否する', () => {
    const result = validateProjectName('あ'.repeat(101))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('ちょうど 100 文字は受け入れる', () => {
    const result = validateProjectName('あ'.repeat(100))
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/domain/projects` を解決できない）

- [ ] **Step 3: 最小の実装を書く**

`lib/domain/projects.ts` を作成する。

```typescript
import { type Result, err, ok } from './result'

/** 1 ユーザーが保有できるプロジェクトの上限 */
export const MAX_PROJECTS_PER_USER = 20

/** プロジェクト名の最大文字数 */
export const PROJECT_NAME_MAX_LENGTH = 100

export function canCreateProject(currentCount: number): boolean {
  return currentCount < MAX_PROJECTS_PER_USER
}

export function validateProjectName(name: string): Result<string> {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return err('VALIDATION_ERROR', 'プロジェクト名を入力してください。')
  }

  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
    return err(
      'VALIDATION_ERROR',
      `プロジェクト名は ${PROJECT_NAME_MAX_LENGTH} 文字以内で入力してください。`,
    )
  }

  return ok(trimmed)
}
```

- [ ] **Step 4: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（result 2 件 + projects 7 件）

- [ ] **Step 5: マイグレーション SQL を作成する**

`supabase/migrations/0001_initial_schema.sql` を作成する。

```sql
-- ============================================================
-- TaskMatrix 第1フェーズ 初期スキーマ
-- ============================================================

-- ---------- profiles ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  plan       text not null default 'free',
  theme      text not null default 'auto' check (theme in ('auto', 'apple', 'windows')),
  created_at timestamptz not null default now()
);

-- サインアップ時に profiles 行を自動生成する
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- projects ----------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

-- プロジェクト上限 20 件を DB 側でも担保する
create function public.enforce_project_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
  from public.projects
  where owner_id = new.owner_id;

  if current_count >= 20 then
    raise exception 'PROJECT_LIMIT_EXCEEDED';
  end if;

  return new;
end;
$$;

create trigger projects_limit_check
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- ---------- folders ----------
create table public.folders (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id  uuid references public.folders(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index folders_project_id_idx on public.folders (project_id);
create index folders_parent_id_idx  on public.folders (parent_id);

-- ---------- files ----------
create table public.files (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  folder_id       uuid references public.folders(id) on delete cascade,
  name            text not null,
  kind            text not null check (kind in ('markdown', 'text', 'binary')),
  mime_type       text not null default '',
  size            bigint not null default 0,
  storage_path    text,
  current_version integer not null default 1,
  created_by      uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index files_project_id_idx on public.files (project_id);
create index files_folder_id_idx  on public.files (folder_id);

-- ---------- file_versions ----------
create table public.file_versions (
  id           uuid primary key default gen_random_uuid(),
  file_id      uuid not null references public.files(id) on delete cascade,
  version      integer not null,
  content      text,
  storage_path text,
  size         bigint not null default 0,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  unique (file_id, version)
);

create index file_versions_file_id_idx on public.file_versions (file_id);

-- ============================================================
-- 行レベルセキュリティ
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.folders       enable row level security;
alter table public.files         enable row level security;
alter table public.file_versions enable row level security;

-- profiles: 本人のみ
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid()));

-- projects: 所有者のみ
create policy projects_all_own on public.projects
  for all using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- folders: 所属プロジェクトの所有者のみ
create policy folders_all_own on public.folders
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = folders.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = folders.project_id and p.owner_id = (select auth.uid())
    )
  );

-- files: 所属プロジェクトの所有者のみ
create policy files_all_own on public.files
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and p.owner_id = (select auth.uid())
    )
  );

-- file_versions: 所属ファイルのプロジェクト所有者のみ
create policy file_versions_all_own on public.file_versions
  for all using (
    exists (
      select 1 from public.files f
      join public.projects p on p.id = f.project_id
      where f.id = file_versions.file_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.files f
      join public.projects p on p.id = f.project_id
      where f.id = file_versions.file_id and p.owner_id = (select auth.uid())
    )
  );

-- ============================================================
-- Storage
-- ============================================================

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

-- パスの第1階層を project_id とし、その所有者のみ操作を許可する
create policy project_files_all_own on storage.objects
  for all using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = (select auth.uid())
    )
  );
```

- [ ] **Step 6: マイグレーションを Supabase に適用する**

Supabase MCP の `apply_migration` を用い、`project_id = patasstmipeqaaovfihv`、
`name = 0001_initial_schema` として上記 SQL を適用する。

- [ ] **Step 7: 適用結果を確認する**

Supabase MCP の `list_tables`（スキーマ `public`）を実行し、
`profiles` `projects` `folders` `files` `file_versions` の 5 テーブルが存在することを確認する。

続いて `get_advisors`（`type: security`）を実行し、RLS 無効テーブルの警告が出ていないことを確認する。
警告があれば修正してから次へ進む。

- [ ] **Step 8: 環境変数を設定する**

Supabase MCP の `get_project_url` と `get_publishable_keys` で値を取得し、
`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を記入する。
`.env.local` はコミットしない。

- [ ] **Step 9: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 10: コミットする**

```bash
git add -A
git commit -m "feat(db): 初期スキーマとRLSポリシーを追加

- profiles/projects/folders/files/file_versions を定義
- 全テーブルでRLSを有効化し所有者のみアクセス可能にした
- プロジェクト上限20件をトリガーで担保
- private バケット project-files とアクセスポリシーを追加
- プロジェクト名検証と上限判定のドメインロジックを追加"
```

---

## Task 3: デザイントークン層とプラットフォームテーマ

**ブランチ:** `feature/platform-theme`

**Files:**
- Create: `lib/platform/theme.ts`, `lib/platform/__tests__/theme.test.ts`
- Create: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`
- Modify: `app/globals.css`, `app/layout.tsx`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type PlatformTheme = 'apple' | 'windows'`
  - `type ThemePreference = 'auto' | PlatformTheme`
  - `function detectPlatformFromUserAgent(userAgent: string): PlatformTheme`
  - `function resolveTheme(preference: ThemePreference, userAgent: string): PlatformTheme`
  - `const THEME_COOKIE_NAME = 'tm-theme'`
  - React コンポーネント `Button`, `Card`, `Input`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout main
git merge --no-ff chore/scaffold -m "Merge chore/scaffold"
git checkout -b feature/platform-theme
```

`main` へのマージ手順が承認されていない場合は、`chore/scaffold` から直接分岐してよい。

- [ ] **Step 2: 失敗するテストを書く**

`lib/platform/__tests__/theme.test.ts` を作成する。

```typescript
import { describe, expect, it } from 'vitest'
import { detectPlatformFromUserAgent, resolveTheme } from '@/lib/platform/theme'

const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

describe('detectPlatformFromUserAgent', () => {
  it('macOS を apple と判定する', () => {
    expect(detectPlatformFromUserAgent(MAC_UA)).toBe('apple')
  })

  it('iPhone を apple と判定する', () => {
    expect(detectPlatformFromUserAgent(IPHONE_UA)).toBe('apple')
  })

  it('iPad を apple と判定する', () => {
    expect(detectPlatformFromUserAgent(IPAD_UA)).toBe('apple')
  })

  it('Windows を windows と判定する', () => {
    expect(detectPlatformFromUserAgent(WINDOWS_UA)).toBe('windows')
  })

  it('Apple 以外は windows として扱う', () => {
    expect(detectPlatformFromUserAgent(ANDROID_UA)).toBe('windows')
  })

  it('空の UA でも例外を投げず windows を返す', () => {
    expect(detectPlatformFromUserAgent('')).toBe('windows')
  })
})

describe('resolveTheme', () => {
  it('明示指定は UA より優先される', () => {
    expect(resolveTheme('windows', MAC_UA)).toBe('windows')
    expect(resolveTheme('apple', WINDOWS_UA)).toBe('apple')
  })

  it('auto のときは UA から判定する', () => {
    expect(resolveTheme('auto', MAC_UA)).toBe('apple')
    expect(resolveTheme('auto', WINDOWS_UA)).toBe('windows')
  })
})
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/platform/theme` を解決できない）

- [ ] **Step 4: 最小の実装を書く**

`lib/platform/theme.ts` を作成する。

```typescript
/** 適用するデザイントークンの系統 */
export type PlatformTheme = 'apple' | 'windows'

/** ユーザーの設定値。auto は User-Agent による自動判定を意味する */
export type ThemePreference = 'auto' | PlatformTheme

/** 解決済みテーマを保存する Cookie 名 */
export const THEME_COOKIE_NAME = 'tm-theme'

const APPLE_PATTERN = /(Macintosh|Mac OS X|iPhone|iPad|iPod)/i

export function detectPlatformFromUserAgent(userAgent: string): PlatformTheme {
  return APPLE_PATTERN.test(userAgent) ? 'apple' : 'windows'
}

export function resolveTheme(
  preference: ThemePreference,
  userAgent: string,
): PlatformTheme {
  if (preference === 'auto') {
    return detectPlatformFromUserAgent(userAgent)
  }
  return preference
}
```

- [ ] **Step 5: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（theme 8 件を含む全件）

- [ ] **Step 6: デザイントークンを定義する**

`app/globals.css` を次の内容に置き換える。

```css
@import "tailwindcss";

/* ============================================================
   デザイントークン
   プラットフォーム（apple / windows）× 配色（light / dark）
   コンポーネントはこれらの変数のみを参照する
   ============================================================ */

:root {
  --color-bg: #ffffff;
  --color-surface: #f5f5f7;
  --color-border: #d2d2d7;
  --color-fg: #1d1d1f;
  --color-fg-muted: #6e6e73;
  --color-accent: #0071e3;
  --color-accent-fg: #ffffff;
  --color-danger: #d70015;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.06);
  --shadow-md: 0 4px 16px rgb(0 0 0 / 0.10);

  --font-ui: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif;

  --space-unit: 4px;
  --motion-duration: 320ms;
  --motion-easing: cubic-bezier(0.32, 0.72, 0, 1);
}

[data-platform="windows"] {
  --color-bg: #ffffff;
  --color-surface: #f3f3f3;
  --color-border: #e5e5e5;
  --color-fg: #1b1b1b;
  --color-fg-muted: #5d5d5d;
  --color-accent: #0067c0;
  --color-accent-fg: #ffffff;
  --color-danger: #c42b1c;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.10);
  --shadow-md: 0 2px 8px rgb(0 0 0 / 0.14);

  --font-ui: "Segoe UI Variable", "Segoe UI", "Yu Gothic UI", "Noto Sans JP", sans-serif;

  --motion-duration: 200ms;
  --motion-easing: cubic-bezier(0.1, 0.9, 0.2, 1);
}

[data-scheme="dark"] {
  --color-bg: #000000;
  --color-surface: #1c1c1e;
  --color-border: #38383a;
  --color-fg: #f5f5f7;
  --color-fg-muted: #98989d;
  --color-accent: #0a84ff;
  --color-accent-fg: #ffffff;
  --color-danger: #ff453a;
}

[data-platform="windows"][data-scheme="dark"] {
  --color-bg: #202020;
  --color-surface: #2b2b2b;
  --color-border: #3d3d3d;
  --color-fg: #ffffff;
  --color-fg-muted: #c5c5c5;
  --color-accent: #4cc2ff;
  --color-accent-fg: #003a5c;
  --color-danger: #ff99a4;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-scheme="light"]) {
    --color-bg: #000000;
    --color-surface: #1c1c1e;
    --color-border: #38383a;
    --color-fg: #f5f5f7;
    --color-fg-muted: #98989d;
    --color-accent: #0a84ff;
    --color-accent-fg: #ffffff;
    --color-danger: #ff453a;
  }
}

body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-ui);
}
```

- [ ] **Step 7: ルートレイアウトでテーマを適用する**

`app/layout.tsx` を次の内容にする。

```tsx
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import {
  THEME_COOKIE_NAME,
  type ThemePreference,
  resolveTheme,
} from '@/lib/platform/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'TaskMatrix',
  description: 'フォルダ・タスク・スケジュール管理アプリケーション',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const headerList = await headers()

  const preference =
    (cookieStore.get(THEME_COOKIE_NAME)?.value as ThemePreference | undefined) ??
    'auto'
  const platform = resolveTheme(preference, headerList.get('user-agent') ?? '')

  return (
    <html lang="ja" data-platform={platform}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: トークン駆動のプリミティブを作成する**

`components/ui/button.tsx` を作成する。

```tsx
'use client'

import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-accent)',
    color: 'var(--color-accent-fg)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--color-surface)',
    color: 'var(--color-fg)',
    border: '1px solid var(--color-border)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#ffffff',
    border: '1px solid transparent',
  },
}

/** すべての見た目をデザイントークン経由で決めるボタン */
export function Button({ variant = 'primary', style, ...props }: Props) {
  return (
    <button
      {...props}
      style={{
        ...VARIANT_STYLE[variant],
        borderRadius: 'var(--radius-md)',
        padding: 'calc(var(--space-unit) * 2.5) calc(var(--space-unit) * 4)',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.95rem',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: `all var(--motion-duration) var(--motion-easing)`,
        ...style,
      }}
    />
  )
}
```

`components/ui/card.tsx` を作成する。

```tsx
import type { HTMLAttributes } from 'react'

/** 一覧やフォームの土台になる面 */
export function Card({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'calc(var(--space-unit) * 4)',
        ...style,
      }}
    />
  )
}
```

`components/ui/input.tsx` を作成する。

```tsx
import type { InputHTMLAttributes } from 'react'

export function Input({ style, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-fg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: 'calc(var(--space-unit) * 2) calc(var(--space-unit) * 3)',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.95rem',
        width: '100%',
        ...style,
      }}
    />
  )
}
```

- [ ] **Step 9: コンポーネントのテストを書く**

`components/ui/__tests__/button.test.tsx` を作成する。

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('ラベルを表示する', () => {
    render(<Button>保存</Button>)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('disabled のとき操作できない', () => {
    render(<Button disabled>保存</Button>)
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })
})
```

- [ ] **Step 10: テストを実行する**

Run: `npm test`
Expected: PASS（全件）

- [ ] **Step 11: 検証セットを実行し、両テーマを目視確認する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
```

ブラウザの開発者ツールで `<html>` の `data-platform` を `apple` / `windows` に手動で切り替え、
角丸・影・フォント・アクセント色が変化することを確認する。

- [ ] **Step 12: コミットする**

```bash
git add -A
git commit -m "feat(theme): プラットフォーム適応デザイントークンを追加

- apple/windows × light/dark のCSS変数トークンを定義
- User-Agent からのプラットフォーム判定とテーマ解決を実装
- トークン駆動の Button/Card/Input プリミティブを追加"
```

---

## Task 4: 認証

**ブランチ:** `feature/auth`

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- Create: `middleware.ts`
- Create: `lib/actions/auth.ts`
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`
- Create: `components/app/auth-form.tsx`
- Create: `lib/domain/auth.ts`, `lib/domain/__tests__/auth.test.ts`
- Create: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `Result<T>`, `ok`, `err`（Task 1）、`Button` `Card` `Input`（Task 3）
- Produces:
  - `function createBrowserSupabaseClient(): SupabaseClient`
  - `function createServerSupabaseClient(): Promise<SupabaseClient>`
  - `function validateCredentials(email: string, password: string): Result<{ email: string; password: string }>`
  - Server Actions: `signUpAction(formData: FormData): Promise<Result<null>>`,
    `signInAction(formData: FormData): Promise<Result<null>>`,
    `signOutAction(): Promise<void>`
  - `const PASSWORD_MIN_LENGTH = 8`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b feature/auth
```

- [ ] **Step 2: Supabase パッケージを追加する**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

- [ ] **Step 3: 失敗するテストを書く**

`lib/domain/__tests__/auth.test.ts` を作成する。

```typescript
import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN_LENGTH, validateCredentials } from '@/lib/domain/auth'

describe('validateCredentials', () => {
  it('正しいメールとパスワードを受け入れる', () => {
    const result = validateCredentials('user@example.com', 'password123')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.email).toBe('user@example.com')
  })

  it('メールアドレスの前後の空白を取り除く', () => {
    const result = validateCredentials('  user@example.com  ', 'password123')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.email).toBe('user@example.com')
  })

  it('メール形式でない文字列を拒否する', () => {
    const result = validateCredentials('not-an-email', 'password123')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('空のメールを拒否する', () => {
    const result = validateCredentials('', 'password123')
    expect(result.ok).toBe(false)
  })

  it('最小長未満のパスワードを拒否する', () => {
    const result = validateCredentials('user@example.com', 'a'.repeat(PASSWORD_MIN_LENGTH - 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('ちょうど最小長のパスワードを受け入れる', () => {
    const result = validateCredentials('user@example.com', 'a'.repeat(PASSWORD_MIN_LENGTH))
    expect(result.ok).toBe(true)
  })

  it('パスワードの最小長は 8 文字である', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})
```

- [ ] **Step 4: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/domain/auth` を解決できない）

- [ ] **Step 5: 最小の実装を書く**

`lib/domain/auth.ts` を作成する。

```typescript
import { z } from 'zod'
import { type Result, err, ok } from './result'

/** パスワードの最小文字数 */
export const PASSWORD_MIN_LENGTH = 8

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
})

export function validateCredentials(
  email: string,
  password: string,
): Result<{ email: string; password: string }> {
  const parsed = schema.safeParse({ email, password })

  if (!parsed.success) {
    const hasEmailIssue = parsed.error.issues.some((i) => i.path[0] === 'email')
    return err(
      'VALIDATION_ERROR',
      hasEmailIssue
        ? 'メールアドレスの形式が正しくありません。'
        : `パスワードは ${PASSWORD_MIN_LENGTH} 文字以上で入力してください。`,
    )
  }

  return ok(parsed.data)
}
```

- [ ] **Step 6: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（auth 7 件を含む全件）

- [ ] **Step 7: Supabase クライアントを作成する**

`lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

/** ブラウザ（Client Component）用の Supabase クライアント */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

`lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Server Component / Server Action 用の Supabase クライアント */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component からの呼び出しでは書き込めない。
            // セッション更新は middleware が担うため無視してよい。
          }
        },
      },
    },
  )
}
```

`lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** 保護対象のパス接頭辞 */
const PROTECTED_PREFIXES = ['/dashboard', '/projects', '/settings']

/** セッションを更新し、未認証なら保護ルートからログイン画面へ退避させる */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}
```

`middleware.ts`（プロジェクト直下）:

```typescript
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 8: 認証の Server Actions を作成する**

`lib/actions/auth.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { validateCredentials } from '@/lib/domain/auth'
import { type Result, err, ok } from '@/lib/domain/result'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function signUpAction(formData: FormData): Promise<Result<null>> {
  const validated = validateCredentials(
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signUp(validated.data)

  if (error) {
    return err('VALIDATION_ERROR', 'アカウントを作成できませんでした。入力内容をご確認ください。')
  }

  return ok(null)
}

export async function signInAction(formData: FormData): Promise<Result<null>> {
  const validated = validateCredentials(
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword(validated.data)

  if (error) {
    return err('UNAUTHENTICATED', 'メールアドレスまたはパスワードが正しくありません。')
  }

  return ok(null)
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 9: 認証フォームと画面を作成する**

`components/app/auth-form.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Result } from '@/lib/domain/result'

type Props = {
  title: string
  submitLabel: string
  action: (formData: FormData) => Promise<Result<null>>
  redirectTo: string
  footer: React.ReactNode
}

/** ログインとサインアップで共有する認証フォーム */
export function AuthForm({ title, submitLabel, action, redirectTo, footer }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await action(formData)
      if (result.ok) {
        router.push(redirectTo)
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <Card style={{ maxWidth: 400, margin: '10vh auto', display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{title}</h1>
      <form action={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
            メールアドレス
          </span>
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
            パスワード（8文字以上）
          </span>
          <Input name="password" type="password" autoComplete="current-password" required />
        </label>
        {message && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {message}
          </p>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? '処理中…' : submitLabel}
        </Button>
      </form>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>{footer}</div>
    </Card>
  )
}
```

`app/(auth)/login/page.tsx`:

```tsx
import Link from 'next/link'
import { AuthForm } from '@/components/app/auth-form'
import { signInAction } from '@/lib/actions/auth'

export default function LoginPage() {
  return (
    <AuthForm
      title="ログイン"
      submitLabel="ログイン"
      action={signInAction}
      redirectTo="/dashboard"
      footer={
        <>
          アカウントをお持ちでない場合は <Link href="/signup">新規登録</Link> へ。
        </>
      }
    />
  )
}
```

`app/(auth)/signup/page.tsx`:

```tsx
import Link from 'next/link'
import { AuthForm } from '@/components/app/auth-form'
import { signUpAction } from '@/lib/actions/auth'

export default function SignupPage() {
  return (
    <AuthForm
      title="新規アカウント作成"
      submitLabel="アカウントを作成"
      action={signUpAction}
      redirectTo="/dashboard"
      footer={
        <>
          すでにアカウントをお持ちの場合は <Link href="/login">ログイン</Link> へ。
        </>
      }
    />
  )
}
```

- [ ] **Step 10: アプリ内共通レイアウトを作成する**

`app/(app)/layout.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/lib/actions/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: 'calc(var(--space-unit) * 3) calc(var(--space-unit) * 5)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/dashboard" style={{ fontWeight: 600 }}>TaskMatrix</Link>
          <Link href="/projects">プロジェクト</Link>
          <Link href="/settings">設定</Link>
        </nav>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">ログアウト</Button>
        </form>
      </header>
      <main style={{ padding: 'calc(var(--space-unit) * 6)' }}>{children}</main>
    </div>
  )
}
```

- [ ] **Step 11: テストと検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 12: 実際に動作を確認する**

```bash
npm run dev
```

1. `http://localhost:3000/signup` でアカウントを作成し、`/dashboard` へ遷移すること
   （`/dashboard` は Task 9 まで未作成のため 404 でよい。遷移が起きることを確認する）
2. ログアウト後、`http://localhost:3000/projects` にアクセスすると `/login` へ転送されること
3. 誤ったパスワードでログインすると日本語のエラーが表示されること

Supabase MCP の `execute_sql` で `select id, email from public.profiles;` を実行し、
サインアップしたユーザーの `profiles` 行が自動生成されていることを確認する。

- [ ] **Step 13: コミットする**

```bash
git add -A
git commit -m "feat(auth): メールとパスワードによる認証を実装

- @supabase/ssr による Cookie セッション管理を追加
- middleware で保護ルートを未認証時にログイン画面へ転送
- サインアップ/ログイン/ログアウトの Server Action を実装
- 認証情報の検証ロジックとテストを追加"
```

---

## Task 5: プロジェクト管理（CRUD と上限 20 件）

**ブランチ:** `feature/projects`

**Files:**
- Create: `lib/repositories/projects.ts`
- Create: `lib/actions/projects.ts`
- Create: `app/(app)/projects/page.tsx`
- Create: `components/app/project-list.tsx`, `components/app/project-create-form.tsx`
- Create: `lib/actions/__tests__/projects.test.ts`

**Interfaces:**
- Consumes: `Result` `ok` `err`（Task 1）、`MAX_PROJECTS_PER_USER` `canCreateProject`
  `validateProjectName`（Task 2）、`createServerSupabaseClient`（Task 4）、UI プリミティブ（Task 3）
- Produces:
  - `type Project = { id: string; ownerId: string; name: string; description: string; createdAt: string; updatedAt: string }`
  - `interface ProjectRepository { listByOwner(ownerId: string): Promise<Project[]>; countByOwner(ownerId: string): Promise<number>; create(input: { ownerId: string; name: string }): Promise<Project>; rename(id: string, name: string): Promise<void>; remove(id: string): Promise<void> }`
  - `function createProject(repo: ProjectRepository, ownerId: string, rawName: string): Promise<Result<Project>>`
  - Server Actions: `createProjectAction(formData: FormData): Promise<Result<null>>`,
    `renameProjectAction(formData: FormData): Promise<Result<null>>`,
    `deleteProjectAction(formData: FormData): Promise<Result<null>>`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b feature/projects
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/actions/__tests__/projects.test.ts` を作成する。
リポジトリをモックし、上限判定と名前検証が Server Action の手前で効くことを検証する。

```typescript
import { describe, expect, it, vi } from 'vitest'
import { createProject } from '@/lib/actions/projects'
import type { Project, ProjectRepository } from '@/lib/repositories/projects'

const sampleProject: Project = {
  id: 'p1',
  ownerId: 'u1',
  name: '新規プロジェクト',
  description: '',
  createdAt: '2026-08-30T00:00:00Z',
  updatedAt: '2026-08-30T00:00:00Z',
}

function makeRepo(count: number): ProjectRepository {
  return {
    listByOwner: vi.fn(async () => []),
    countByOwner: vi.fn(async () => count),
    create: vi.fn(async () => sampleProject),
    rename: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
}

describe('createProject', () => {
  it('上限未満なら作成する', async () => {
    const repo = makeRepo(19)
    const result = await createProject(repo, 'u1', '新規プロジェクト')
    expect(result.ok).toBe(true)
    expect(repo.create).toHaveBeenCalledWith({ ownerId: 'u1', name: '新規プロジェクト' })
  })

  it('20 件に達していたら拒否し、作成を呼ばない', async () => {
    const repo = makeRepo(20)
    const result = await createProject(repo, 'u1', '新規プロジェクト')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROJECT_LIMIT_EXCEEDED')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('空の名前を拒否し、件数を数えない', async () => {
    const repo = makeRepo(0)
    const result = await createProject(repo, 'u1', '   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('名前の前後の空白を取り除いて渡す', async () => {
    const repo = makeRepo(0)
    await createProject(repo, 'u1', '  設計資料  ')
    expect(repo.create).toHaveBeenCalledWith({ ownerId: 'u1', name: '設計資料' })
  })
})
```

- [ ] **Step 3: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/actions/projects` と `@/lib/repositories/projects` を解決できない）

- [ ] **Step 4: リポジトリを実装する**

`lib/repositories/projects.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type Project = {
  id: string
  ownerId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

/** プロジェクトのデータアクセス。実装を差し替えられるようインターフェースを切る */
export interface ProjectRepository {
  listByOwner(ownerId: string): Promise<Project[]>
  countByOwner(ownerId: string): Promise<number>
  create(input: { ownerId: string; name: string }): Promise<Project>
  rename(id: string, name: string): Promise<void>
  remove(id: string): Promise<void>
}

type Row = {
  id: string
  owner_id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

function toProject(row: Row): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createSupabaseProjectRepository(
  supabase: SupabaseClient,
): ProjectRepository {
  return {
    async listByOwner(ownerId) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data as Row[]).map(toProject)
    },

    async countByOwner(ownerId) {
      const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
      if (error) throw error
      return count ?? 0
    },

    async create({ ownerId, name }) {
      const { data, error } = await supabase
        .from('projects')
        .insert({ owner_id: ownerId, name })
        .select('*')
        .single()
      if (error) throw error
      return toProject(data as Row)
    },

    async rename(id, name) {
      const { error } = await supabase
        .from('projects')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },

    async remove(id) {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
  }
}
```

- [ ] **Step 5: ユースケースと Server Actions を実装する**

`lib/actions/projects.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { canCreateProject, validateProjectName } from '@/lib/domain/projects'
import { type Result, err, ok } from '@/lib/domain/result'
import {
  type Project,
  type ProjectRepository,
  createSupabaseProjectRepository,
} from '@/lib/repositories/projects'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** リポジトリを外から渡せる純粋なユースケース。テスト対象はこちら */
export async function createProject(
  repo: ProjectRepository,
  ownerId: string,
  rawName: string,
): Promise<Result<Project>> {
  const validated = validateProjectName(rawName)
  if (!validated.ok) return validated

  const count = await repo.countByOwner(ownerId)
  if (!canCreateProject(count)) {
    return err(
      'PROJECT_LIMIT_EXCEEDED',
      'プロジェクトは 20 件までです。不要なプロジェクトを削除してください。',
    )
  }

  const project = await repo.create({ ownerId, name: validated.data })
  return ok(project)
}

async function currentContext() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createProjectAction(formData: FormData): Promise<Result<null>> {
  const { supabase, user } = await currentContext()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repo = createSupabaseProjectRepository(supabase)

  try {
    const result = await createProject(repo, user.id, String(formData.get('name') ?? ''))
    if (!result.ok) return result
  } catch {
    return err('UNKNOWN', 'プロジェクトを作成できませんでした。')
  }

  revalidatePath('/projects')
  return ok(null)
}

export async function renameProjectAction(formData: FormData): Promise<Result<null>> {
  const { supabase, user } = await currentContext()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const validated = validateProjectName(String(formData.get('name') ?? ''))
  if (!validated.ok) return validated

  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のプロジェクトが指定されていません。')

  try {
    await createSupabaseProjectRepository(supabase).rename(id, validated.data)
  } catch {
    return err('UNKNOWN', 'プロジェクト名を変更できませんでした。')
  }

  revalidatePath('/projects')
  return ok(null)
}

export async function deleteProjectAction(formData: FormData): Promise<Result<null>> {
  const { supabase, user } = await currentContext()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のプロジェクトが指定されていません。')

  try {
    await createSupabaseProjectRepository(supabase).remove(id)
  } catch {
    return err('UNKNOWN', 'プロジェクトを削除できませんでした。')
  }

  revalidatePath('/projects')
  return ok(null)
}
```

- [ ] **Step 6: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（projects アクション 4 件を含む全件）

- [ ] **Step 7: プロジェクト一覧画面を作成する**

`components/app/project-create-form.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProjectAction } from '@/lib/actions/projects'

export function ProjectCreateForm({ disabled }: { disabled: boolean }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await createProjectAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input name="name" placeholder="新しいプロジェクト名" disabled={disabled || isPending} />
        <Button type="submit" disabled={disabled || isPending}>作成</Button>
      </div>
      {disabled && (
        <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.85rem' }}>
          プロジェクトは 20 件までです。
        </p>
      )}
      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          {message}
        </p>
      )}
    </form>
  )
}
```

`components/app/project-list.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { deleteProjectAction } from '@/lib/actions/projects'
import type { Project } from '@/lib/repositories/projects'

export function ProjectList({ projects }: { projects: Project[] }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`プロジェクト「${name}」を削除します。含まれるフォルダとファイルもすべて削除されます。よろしいですか？`)) {
      return
    }
    const formData = new FormData()
    formData.set('id', id)
    startTransition(async () => {
      await deleteProjectAction(formData)
      router.refresh()
    })
  }

  if (projects.length === 0) {
    return (
      <p style={{ color: 'var(--color-fg-muted)' }}>
        プロジェクトがまだありません。上の入力欄から作成してください。
      </p>
    )
  }

  return (
    <ul style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', listStyle: 'none', padding: 0 }}>
      {projects.map((project) => (
        <li key={project.id}>
          <Card style={{ display: 'grid', gap: 12 }}>
            <Link href={`/projects/${project.id}`} style={{ fontWeight: 600 }}>
              {project.name}
            </Link>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
              更新: {new Date(project.updatedAt).toLocaleString('ja-JP')}
            </span>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => handleDelete(project.id, project.name)}
            >
              削除
            </Button>
          </Card>
        </li>
      ))}
    </ul>
  )
}
```

`app/(app)/projects/page.tsx`:

```tsx
import { ProjectCreateForm } from '@/components/app/project-create-form'
import { ProjectList } from '@/components/app/project-list'
import { MAX_PROJECTS_PER_USER } from '@/lib/domain/projects'
import { createSupabaseProjectRepository } from '@/lib/repositories/projects'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const projects = user
    ? await createSupabaseProjectRepository(supabase).listByOwner(user.id)
    : []

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1000 }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>プロジェクト</h1>
        <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem' }}>
          {projects.length} / {MAX_PROJECTS_PER_USER} 件
        </p>
      </header>
      <ProjectCreateForm disabled={projects.length >= MAX_PROJECTS_PER_USER} />
      <ProjectList projects={projects} />
    </div>
  )
}
```

- [ ] **Step 8: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 9: 実際に動作を確認する**

```bash
npm run dev
```

1. `/projects` でプロジェクトを作成でき、一覧に表示されること
2. 削除で確認ダイアログが出て、承諾すると一覧から消えること
3. 上限確認は Supabase MCP の `execute_sql` でテストユーザーに 20 件を投入してから行う。
   21 件目の作成が「プロジェクトは 20 件までです。」と表示されること。確認後、投入した行を削除する

- [ ] **Step 10: コミットする**

```bash
git add -A
git commit -m "feat(projects): プロジェクトのCRUDと上限20件を実装

- ProjectRepository インターフェースと Supabase 実装を追加
- 上限判定と名前検証を通す createProject ユースケースを追加
- プロジェクト一覧・作成・削除のUIを追加"
```

---

## Task 6: フォルダとファイル管理

**ブランチ:** `feature/folders-files`

**Files:**
- Create: `lib/domain/files.ts`, `lib/domain/__tests__/files.test.ts`
- Create: `lib/domain/folders.ts`, `lib/domain/__tests__/folders.test.ts`
- Create: `lib/repositories/folders.ts`, `lib/repositories/files.ts`
- Create: `lib/actions/folders.ts`, `lib/actions/files.ts`
- Create: `app/(app)/projects/[projectId]/page.tsx`
- Create: `components/app/folder-tree.tsx`, `components/app/file-upload-form.tsx`,
  `components/app/file-list.tsx`

**Interfaces:**
- Consumes: `Result` `ok` `err`（Task 1）、`createServerSupabaseClient`（Task 4）、UI プリミティブ（Task 3）
- Produces:
  - `const MAX_FILE_SIZE = 26214400`
  - `const ALLOWED_EXTENSIONS: readonly ['xlsx','docx','pptx','pdf','txt','md']`
  - `type FileKind = 'markdown' | 'text' | 'binary'`
  - `function getExtension(filename: string): string`
  - `function detectFileKind(filename: string): FileKind`
  - `function validateUpload(input: { name: string; size: number }): Result<{ name: string; kind: FileKind }>`
  - `function buildStoragePath(input: { projectId: string; fileId: string; version: number; filename: string }): string`
  - `type FolderRow = { id: string; name: string; parentId: string | null }`
  - `type FolderNode = FolderRow & { children: FolderNode[] }`
  - `function buildFolderTree(rows: FolderRow[]): FolderNode[]`
  - `function validateFolderName(name: string): Result<string>`
  - Server Actions: `createFolderAction`, `deleteFolderAction`, `uploadFileAction`,
    `deleteFileAction`, `createDownloadUrlAction`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b feature/folders-files
```

- [ ] **Step 2: ファイルドメインの失敗するテストを書く**

`lib/domain/__tests__/files.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  buildStoragePath,
  detectFileKind,
  getExtension,
  validateUpload,
} from '@/lib/domain/files'

describe('getExtension', () => {
  it('小文字の拡張子を返す', () => {
    expect(getExtension('報告書.DOCX')).toBe('docx')
    expect(getExtension('memo.md')).toBe('md')
  })

  it('複数のドットがある場合は最後の要素を返す', () => {
    expect(getExtension('a.b.pdf')).toBe('pdf')
  })

  it('拡張子がない場合は空文字を返す', () => {
    expect(getExtension('README')).toBe('')
  })
})

describe('detectFileKind', () => {
  it('md は markdown', () => {
    expect(detectFileKind('memo.md')).toBe('markdown')
  })

  it('txt は text', () => {
    expect(detectFileKind('memo.txt')).toBe('text')
  })

  it('それ以外は binary', () => {
    expect(detectFileKind('資料.pdf')).toBe('binary')
    expect(detectFileKind('表.xlsx')).toBe('binary')
  })
})

describe('validateUpload', () => {
  it('対応拡張子かつ上限以内なら受け入れる', () => {
    const result = validateUpload({ name: '資料.pdf', size: 1024 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.kind).toBe('binary')
  })

  it('非対応の拡張子を拒否する', () => {
    const result = validateUpload({ name: 'script.exe', size: 1024 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('上限ちょうどは受け入れる', () => {
    const result = validateUpload({ name: '資料.pdf', size: MAX_FILE_SIZE })
    expect(result.ok).toBe(true)
  })

  it('上限を 1 バイト超えたら拒否する', () => {
    const result = validateUpload({ name: '資料.pdf', size: MAX_FILE_SIZE + 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FILE_TOO_LARGE')
  })

  it('サイズ 0 のファイルを拒否する', () => {
    const result = validateUpload({ name: '資料.pdf', size: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('上限は 25MB である', () => {
    expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024)
  })

  it('対応拡張子は6種類である', () => {
    expect([...ALLOWED_EXTENSIONS].sort()).toEqual(
      ['docx', 'md', 'pdf', 'pptx', 'txt', 'xlsx'],
    )
  })
})

describe('buildStoragePath', () => {
  it('プロジェクトIDを先頭にした階層パスを組み立てる', () => {
    const path = buildStoragePath({
      projectId: 'proj-1',
      fileId: 'file-1',
      version: 3,
      filename: '資料.pdf',
    })
    expect(path).toBe('proj-1/file-1/3/資料.pdf')
  })

  it('パス区切り文字を含む名前を無害化する', () => {
    const path = buildStoragePath({
      projectId: 'proj-1',
      fileId: 'file-1',
      version: 1,
      filename: '../../etc/passwd',
    })
    expect(path).toBe('proj-1/file-1/1/passwd')
  })
})
```

- [ ] **Step 3: フォルダドメインの失敗するテストを書く**

`lib/domain/__tests__/folders.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { buildFolderTree, validateFolderName } from '@/lib/domain/folders'

describe('buildFolderTree', () => {
  it('空配列から空のツリーを作る', () => {
    expect(buildFolderTree([])).toEqual([])
  })

  it('親子関係を組み立てる', () => {
    const tree = buildFolderTree([
      { id: 'a', name: '設計', parentId: null },
      { id: 'b', name: '詳細設計', parentId: 'a' },
      { id: 'c', name: '議事録', parentId: null },
    ])

    expect(tree).toHaveLength(2)
    expect(tree[0].name).toBe('設計')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].name).toBe('詳細設計')
    expect(tree[1].children).toHaveLength(0)
  })

  it('3 階層を組み立てる', () => {
    const tree = buildFolderTree([
      { id: 'a', name: '1', parentId: null },
      { id: 'b', name: '2', parentId: 'a' },
      { id: 'c', name: '3', parentId: 'b' },
    ])
    expect(tree[0].children[0].children[0].name).toBe('3')
  })

  it('親が存在しない行はルート扱いにする', () => {
    const tree = buildFolderTree([{ id: 'b', name: '孤児', parentId: 'missing' }])
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('孤児')
  })

  it('同階層は名前順に並べる', () => {
    const tree = buildFolderTree([
      { id: 'b', name: 'い', parentId: null },
      { id: 'a', name: 'あ', parentId: null },
    ])
    expect(tree.map((n) => n.name)).toEqual(['あ', 'い'])
  })
})

describe('validateFolderName', () => {
  it('前後の空白を取り除いて受け入れる', () => {
    const result = validateFolderName('  設計  ')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe('設計')
  })

  it('空文字を拒否する', () => {
    expect(validateFolderName('   ').ok).toBe(false)
  })

  it('パス区切り文字を含む名前を拒否する', () => {
    expect(validateFolderName('設計/詳細').ok).toBe(false)
    expect(validateFolderName('設計\\詳細').ok).toBe(false)
  })

  it('100 文字を超える名前を拒否する', () => {
    expect(validateFolderName('あ'.repeat(101)).ok).toBe(false)
  })
})
```

- [ ] **Step 4: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/domain/files` と `@/lib/domain/folders` を解決できない）

- [ ] **Step 5: ファイルドメインを実装する**

`lib/domain/files.ts`:

```typescript
import { type Result, err, ok } from './result'

/** アップロード可能な最大バイト数（25MB） */
export const MAX_FILE_SIZE = 25 * 1024 * 1024

/** アップロードを許可する拡張子 */
export const ALLOWED_EXTENSIONS = ['xlsx', 'docx', 'pptx', 'pdf', 'txt', 'md'] as const

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

/** ファイルの扱い方。markdown/text は本文を DB に保持し、binary は Storage に置く */
export type FileKind = 'markdown' | 'text' | 'binary'

export function getExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index <= 0 || index === filename.length - 1) return ''
  return filename.slice(index + 1).toLowerCase()
}

export function detectFileKind(filename: string): FileKind {
  const extension = getExtension(filename)
  if (extension === 'md') return 'markdown'
  if (extension === 'txt') return 'text'
  return 'binary'
}

export function validateUpload(input: {
  name: string
  size: number
}): Result<{ name: string; kind: FileKind }> {
  const name = input.name.trim()

  if (name.length === 0) {
    return err('VALIDATION_ERROR', 'ファイル名が空です。')
  }

  if (input.size <= 0) {
    return err('VALIDATION_ERROR', '空のファイルはアップロードできません。')
  }

  const extension = getExtension(name)
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return err(
      'UNSUPPORTED_FILE_TYPE',
      `対応していない形式です。${ALLOWED_EXTENSIONS.join(' / ')} のいずれかを指定してください。`,
    )
  }

  if (input.size > MAX_FILE_SIZE) {
    return err('FILE_TOO_LARGE', 'ファイルサイズが 25MB を超えています。')
  }

  return ok({ name, kind: detectFileKind(name) })
}

/** Storage 上のパス。先頭を projectId にすることでアクセスポリシーが効く */
export function buildStoragePath(input: {
  projectId: string
  fileId: string
  version: number
  filename: string
}): string {
  const safeName = input.filename.split(/[/\\]/).pop() ?? 'file'
  return `${input.projectId}/${input.fileId}/${input.version}/${safeName}`
}
```

- [ ] **Step 6: フォルダドメインを実装する**

`lib/domain/folders.ts`:

```typescript
import { type Result, err, ok } from './result'

export type FolderRow = {
  id: string
  name: string
  parentId: string | null
}

export type FolderNode = FolderRow & { children: FolderNode[] }

/** フォルダ名の最大文字数 */
export const FOLDER_NAME_MAX_LENGTH = 100

/**
 * フラットな行の配列を階層ツリーに変換する。
 * 親が見つからない行はルートとして扱い、データ不整合でも表示できるようにする。
 */
export function buildFolderTree(rows: FolderRow[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>()
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] })
  }

  const roots: FolderNode[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)!
    const parent = row.parentId ? nodes.get(row.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortRecursively = (list: FolderNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    for (const node of list) sortRecursively(node.children)
  }
  sortRecursively(roots)

  return roots
}

export function validateFolderName(name: string): Result<string> {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return err('VALIDATION_ERROR', 'フォルダ名を入力してください。')
  }

  if (/[/\\]/.test(trimmed)) {
    return err('VALIDATION_ERROR', 'フォルダ名に / や \\ は使用できません。')
  }

  if (trimmed.length > FOLDER_NAME_MAX_LENGTH) {
    return err(
      'VALIDATION_ERROR',
      `フォルダ名は ${FOLDER_NAME_MAX_LENGTH} 文字以内で入力してください。`,
    )
  }

  return ok(trimmed)
}
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（files 14 件 + folders 9 件を含む全件）

- [ ] **Step 8: リポジトリを実装する**

`lib/repositories/folders.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FolderRow } from '@/lib/domain/folders'

export interface FolderRepository {
  listByProject(projectId: string): Promise<FolderRow[]>
  create(input: { projectId: string; parentId: string | null; name: string }): Promise<FolderRow>
  remove(id: string): Promise<void>
}

type Row = { id: string; name: string; parent_id: string | null }

export function createSupabaseFolderRepository(
  supabase: SupabaseClient,
): FolderRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('project_id', projectId)
      if (error) throw error
      return (data as Row[]).map((r) => ({ id: r.id, name: r.name, parentId: r.parent_id }))
    },

    async create({ projectId, parentId, name }) {
      const { data, error } = await supabase
        .from('folders')
        .insert({ project_id: projectId, parent_id: parentId, name })
        .select('id, name, parent_id')
        .single()
      if (error) throw error
      const row = data as Row
      return { id: row.id, name: row.name, parentId: row.parent_id }
    },

    async remove(id) {
      const { error } = await supabase.from('folders').delete().eq('id', id)
      if (error) throw error
    },
  }
}
```

`lib/repositories/files.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FileKind } from '@/lib/domain/files'

export type ProjectFile = {
  id: string
  projectId: string
  folderId: string | null
  name: string
  kind: FileKind
  mimeType: string
  size: number
  storagePath: string | null
  currentVersion: number
  updatedAt: string
}

export interface FileRepository {
  listByProject(projectId: string): Promise<ProjectFile[]>
  findById(id: string): Promise<ProjectFile | null>
  create(input: {
    projectId: string
    folderId: string | null
    name: string
    kind: FileKind
    mimeType: string
    size: number
    storagePath: string | null
    createdBy: string
  }): Promise<ProjectFile>
  updateForNewVersion(input: {
    id: string
    version: number
    size: number
    storagePath: string | null
  }): Promise<void>
  remove(id: string): Promise<void>
}

type Row = {
  id: string
  project_id: string
  folder_id: string | null
  name: string
  kind: FileKind
  mime_type: string
  size: number
  storage_path: string | null
  current_version: number
  updated_at: string
}

function toFile(row: Row): ProjectFile {
  return {
    id: row.id,
    projectId: row.project_id,
    folderId: row.folder_id,
    name: row.name,
    kind: row.kind,
    mimeType: row.mime_type,
    size: row.size,
    storagePath: row.storage_path,
    currentVersion: row.current_version,
    updatedAt: row.updated_at,
  }
}

const COLUMNS =
  'id, project_id, folder_id, name, kind, mime_type, size, storage_path, current_version, updated_at'

export function createSupabaseFileRepository(supabase: SupabaseClient): FileRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('files')
        .select(COLUMNS)
        .eq('project_id', projectId)
        .order('name')
      if (error) throw error
      return (data as Row[]).map(toFile)
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('files')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data ? toFile(data as Row) : null
    },

    async create(input) {
      const { data, error } = await supabase
        .from('files')
        .insert({
          project_id: input.projectId,
          folder_id: input.folderId,
          name: input.name,
          kind: input.kind,
          mime_type: input.mimeType,
          size: input.size,
          storage_path: input.storagePath,
          created_by: input.createdBy,
        })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return toFile(data as Row)
    },

    async updateForNewVersion({ id, version, size, storagePath }) {
      const { error } = await supabase
        .from('files')
        .update({
          current_version: version,
          size,
          storage_path: storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },

    async remove(id) {
      const { error } = await supabase.from('files').delete().eq('id', id)
      if (error) throw error
    },
  }
}
```

- [ ] **Step 9: Server Actions を実装する**

`lib/actions/folders.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { validateFolderName } from '@/lib/domain/folders'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseFolderRepository } from '@/lib/repositories/folders'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function createFolderAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const parentIdRaw = String(formData.get('parentId') ?? '')
  const parentId = parentIdRaw === '' ? null : parentIdRaw

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const validated = validateFolderName(String(formData.get('name') ?? ''))
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  try {
    await createSupabaseFolderRepository(supabase).create({
      projectId,
      parentId,
      name: validated.data,
    })
  } catch {
    return err('UNKNOWN', 'フォルダを作成できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

export async function deleteFolderAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のフォルダが指定されていません。')

  const supabase = await createServerSupabaseClient()
  try {
    await createSupabaseFolderRepository(supabase).remove(id)
  } catch {
    return err('UNKNOWN', 'フォルダを削除できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}
```

`lib/actions/files.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { buildStoragePath, validateUpload } from '@/lib/domain/files'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'project-files'

export async function uploadFileAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const folderIdRaw = String(formData.get('folderId') ?? '')
  const folderId = folderIdRaw === '' ? null : folderIdRaw
  const file = formData.get('file')

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')
  if (!(file instanceof File)) return err('VALIDATION_ERROR', 'ファイルを選択してください。')

  const validated = validateUpload({ name: file.name, size: file.size })
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repo = createSupabaseFileRepository(supabase)

  try {
    const isText = validated.data.kind !== 'binary'
    const created = await repo.create({
      projectId,
      folderId,
      name: validated.data.name,
      kind: validated.data.kind,
      mimeType: file.type,
      size: file.size,
      storagePath: null,
      createdBy: user.id,
    })

    if (isText) {
      const content = await file.text()
      const { error } = await supabase.from('file_versions').insert({
        file_id: created.id,
        version: 1,
        content,
        size: file.size,
        author_id: user.id,
        note: 'アップロード',
      })
      if (error) throw error
    } else {
      const path = buildStoragePath({
        projectId,
        fileId: created.id,
        version: 1,
        filename: validated.data.name,
      })
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined })
      if (uploadError) {
        await repo.remove(created.id)
        return err('STORAGE_ERROR', 'ファイルの保存に失敗しました。')
      }

      await repo.updateForNewVersion({ id: created.id, version: 1, size: file.size, storagePath: path })

      const { error } = await supabase.from('file_versions').insert({
        file_id: created.id,
        version: 1,
        storage_path: path,
        size: file.size,
        author_id: user.id,
        note: 'アップロード',
      })
      if (error) throw error
    }
  } catch {
    return err('UNKNOWN', 'ファイルを登録できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

export async function deleteFileAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のファイルが指定されていません。')

  const supabase = await createServerSupabaseClient()
  try {
    const { data } = await supabase
      .from('file_versions')
      .select('storage_path')
      .eq('file_id', id)

    const paths = (data ?? [])
      .map((row) => (row as { storage_path: string | null }).storage_path)
      .filter((p): p is string => Boolean(p))

    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths)
    }

    await createSupabaseFileRepository(supabase).remove(id)
  } catch {
    return err('UNKNOWN', 'ファイルを削除できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

/** ダウンロード用の署名付きURLを 60 秒だけ発行する */
export async function createDownloadUrlAction(
  storagePath: string,
): Promise<Result<string>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60)

  if (error || !data) {
    return err('STORAGE_ERROR', 'ダウンロードURLを発行できませんでした。')
  }

  return ok(data.signedUrl)
}
```

- [ ] **Step 10: プロジェクト詳細画面を作成する**

`components/app/file-upload-form.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { uploadFileAction } from '@/lib/actions/files'
import { ALLOWED_EXTENSIONS } from '@/lib/domain/files'

export function FileUploadForm({
  projectId,
  folderId,
}: {
  projectId: string
  folderId: string | null
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    formData.set('folderId', folderId ?? '')
    startTransition(async () => {
      const result = await uploadFileAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 8 }}>
      <input
        type="file"
        name="file"
        accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
        disabled={isPending}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'アップロード中…' : 'アップロード'}
      </Button>
      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          {message}
        </p>
      )}
    </form>
  )
}
```

`components/app/folder-tree.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFolderAction, deleteFolderAction } from '@/lib/actions/folders'
import type { FolderNode } from '@/lib/domain/folders'

function FolderItem({
  node,
  projectId,
  depth,
  onChanged,
}: {
  node: FolderNode
  projectId: string
  depth: number
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm(`フォルダ「${node.name}」と配下の内容をすべて削除します。よろしいですか？`)) return
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', node.id)
    startTransition(async () => {
      await deleteFolderAction(formData)
      onChanged()
    })
  }

  return (
    <li>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: depth * 16 }}>
        <span>📁 {node.name}</span>
        <Button variant="secondary" disabled={isPending} onClick={handleDelete}>
          削除
        </Button>
      </div>
      {node.children.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {node.children.map((child) => (
            <FolderItem
              key={child.id}
              node={child}
              projectId={projectId}
              depth={depth + 1}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FolderTree({
  projectId,
  tree,
}: {
  projectId: string
  tree: FolderNode[]
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCreate(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    startTransition(async () => {
      const result = await createFolderAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ fontWeight: 600 }}>フォルダ</h2>
      <form action={handleCreate} style={{ display: 'flex', gap: 8 }}>
        <Input name="name" placeholder="フォルダ名" disabled={isPending} />
        <select
          name="parentId"
          defaultValue=""
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            padding: '0 8px',
          }}
        >
          <option value="">ルート直下</option>
          {tree.flatMap(function flatten(node): { id: string; name: string }[] {
            return [{ id: node.id, name: node.name }, ...node.children.flatMap(flatten)]
          }).map((option) => (
            <option key={option.id} value={option.id}>{option.name} の下</option>
          ))}
        </select>
        <Button type="submit" disabled={isPending}>作成</Button>
      </form>
      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{message}</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
        {tree.map((node) => (
          <FolderItem
            key={node.id}
            node={node}
            projectId={projectId}
            depth={0}
            onChanged={() => router.refresh()}
          />
        ))}
      </ul>
    </section>
  )
}
```

`components/app/file-list.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createDownloadUrlAction, deleteFileAction } from '@/lib/actions/files'
import type { ProjectFile } from '@/lib/repositories/files'

export function FileList({
  projectId,
  files,
}: {
  projectId: string
  files: ProjectFile[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete(file: ProjectFile) {
    if (!window.confirm(`ファイル「${file.name}」を削除します。よろしいですか？`)) return
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', file.id)
    startTransition(async () => {
      await deleteFileAction(formData)
      router.refresh()
    })
  }

  function handleDownload(file: ProjectFile) {
    if (!file.storagePath) return
    startTransition(async () => {
      const result = await createDownloadUrlAction(file.storagePath!)
      if (result.ok) window.open(result.data, '_blank', 'noopener,noreferrer')
      else window.alert(result.error.message)
    })
  }

  if (files.length === 0) {
    return <p style={{ color: 'var(--color-fg-muted)' }}>ファイルがまだありません。</p>
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
      {files.map((file) => (
        <li
          key={file.id}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
          }}
        >
          <Link href={`/projects/${projectId}/files/${file.id}`}>
            📄 {file.name}
          </Link>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
            v{file.currentVersion} / {(file.size / 1024).toFixed(1)} KB
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            {file.storagePath && (
              <Button variant="secondary" disabled={isPending} onClick={() => handleDownload(file)}>
                ダウンロード
              </Button>
            )}
            <Button variant="danger" disabled={isPending} onClick={() => handleDelete(file)}>
              削除
            </Button>
          </span>
        </li>
      ))}
    </ul>
  )
}
```

`app/(app)/projects/[projectId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { FileList } from '@/components/app/file-list'
import { FileUploadForm } from '@/components/app/file-upload-form'
import { FolderTree } from '@/components/app/folder-tree'
import { buildFolderTree } from '@/lib/domain/folders'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseFolderRepository } from '@/lib/repositories/folders'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) notFound()

  const [folderRows, files] = await Promise.all([
    createSupabaseFolderRepository(supabase).listByProject(projectId),
    createSupabaseFileRepository(supabase).listByProject(projectId),
  ])

  return (
    <div style={{ display: 'grid', gap: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{project.name}</h1>
      <FolderTree projectId={projectId} tree={buildFolderTree(folderRows)} />
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ fontWeight: 600 }}>ファイル</h2>
        <FileUploadForm projectId={projectId} folderId={null} />
        <FileList projectId={projectId} files={files} />
      </section>
    </div>
  )
}
```

- [ ] **Step 11: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 12: 実際に動作を確認する**

```bash
npm run dev
```

1. フォルダを作成し、階層表示されること。子フォルダも作れること
2. `.pdf` をアップロードでき、ダウンロードボタンで開けること
3. `.md` をアップロードでき、`file_versions.content` に本文が入ること
   （Supabase MCP の `execute_sql` で `select version, left(content, 40) from public.file_versions;` を確認）
4. `.exe` を選ぶと「対応していない形式です。」と表示されること
5. ファイル削除後、Storage 上のオブジェクトも消えていること

- [ ] **Step 13: コミットする**

```bash
git add -A
git commit -m "feat(files): 階層フォルダとファイル管理を実装

- ファイル種別判定・アップロード検証・Storageパス生成を追加
- フラット行から階層ツリーを組み立てるロジックを追加
- フォルダ作成/削除、ファイルのアップロード/ダウンロード/削除を実装
- 署名付きURLによる非公開ダウンロードに対応"
```

---

## Task 7: アプリ内 Markdown エディタ

**ブランチ:** `feature/markdown-editor`

**Files:**
- Create: `lib/repositories/file-versions.ts`
- Create: `lib/actions/markdown.ts`
- Create: `app/(app)/projects/[projectId]/files/[fileId]/page.tsx`
- Create: `components/app/markdown-editor.tsx`, `components/app/markdown-create-form.tsx`
- Modify: `app/(app)/projects/[projectId]/page.tsx`（新規 Markdown 作成フォームを追加）
- Create: `lib/actions/__tests__/markdown.test.ts`

**Interfaces:**
- Consumes: `Result` `ok` `err`（Task 1）、`validateUpload` `detectFileKind`（Task 6）、
  `FileRepository` `ProjectFile`（Task 6）
- Produces:
  - `type FileVersion = { id: string; fileId: string; version: number; content: string | null; storagePath: string | null; size: number; authorId: string; note: string; createdAt: string }`
  - `interface FileVersionRepository { listByFile(fileId: string): Promise<FileVersion[]>; findByVersion(fileId: string, version: number): Promise<FileVersion | null>; create(input: { fileId: string; version: number; content: string | null; storagePath: string | null; size: number; authorId: string; note: string }): Promise<FileVersion> }`
  - `function saveMarkdown(deps: { files: FileRepository; versions: FileVersionRepository }, input: { fileId: string; content: string; authorId: string }): Promise<Result<number>>`
  - Server Actions: `createMarkdownFileAction`, `saveMarkdownAction`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b feature/markdown-editor
```

- [ ] **Step 2: Markdown 描画パッケージを追加する**

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 3: 失敗するテストを書く**

`lib/actions/__tests__/markdown.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { saveMarkdown } from '@/lib/actions/markdown'
import type { FileRepository, ProjectFile } from '@/lib/repositories/files'
import type { FileVersion, FileVersionRepository } from '@/lib/repositories/file-versions'

const existingFile: ProjectFile = {
  id: 'f1',
  projectId: 'p1',
  folderId: null,
  name: 'メモ.md',
  kind: 'markdown',
  mimeType: 'text/markdown',
  size: 10,
  storagePath: null,
  currentVersion: 2,
  updatedAt: '2026-08-30T00:00:00Z',
}

function makeDeps(file: ProjectFile | null) {
  const files: FileRepository = {
    listByProject: vi.fn(async () => []),
    findById: vi.fn(async () => file),
    create: vi.fn(async () => existingFile),
    updateForNewVersion: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
  const versions: FileVersionRepository = {
    listByFile: vi.fn(async () => [] as FileVersion[]),
    findByVersion: vi.fn(async () => null),
    create: vi.fn(async (input) => ({
      id: 'v',
      fileId: input.fileId,
      version: input.version,
      content: input.content,
      storagePath: input.storagePath,
      size: input.size,
      authorId: input.authorId,
      note: input.note,
      createdAt: '2026-08-30T00:00:00Z',
    })),
  }
  return { files, versions }
}

describe('saveMarkdown', () => {
  it('現在の版に 1 を足した新しい版を作る', async () => {
    const deps = makeDeps(existingFile)
    const result = await saveMarkdown(deps, {
      fileId: 'f1',
      content: '# 見出し',
      authorId: 'u1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(3)
    expect(deps.versions.create).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'f1', version: 3, content: '# 見出し' }),
    )
  })

  it('files の現在バージョンとサイズを更新する', async () => {
    const deps = makeDeps(existingFile)
    await saveMarkdown(deps, { fileId: 'f1', content: 'abc', authorId: 'u1' })

    expect(deps.files.updateForNewVersion).toHaveBeenCalledWith({
      id: 'f1',
      version: 3,
      size: 3,
      storagePath: null,
    })
  })

  it('存在しないファイルを拒否する', async () => {
    const deps = makeDeps(null)
    const result = await saveMarkdown(deps, { fileId: 'x', content: 'a', authorId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(deps.versions.create).not.toHaveBeenCalled()
  })

  it('binary ファイルの本文保存を拒否する', async () => {
    const deps = makeDeps({ ...existingFile, kind: 'binary' })
    const result = await saveMarkdown(deps, { fileId: 'f1', content: 'a', authorId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(deps.versions.create).not.toHaveBeenCalled()
  })

  it('マルチバイト文字をバイト長で数える', async () => {
    const deps = makeDeps(existingFile)
    await saveMarkdown(deps, { fileId: 'f1', content: 'あ', authorId: 'u1' })

    expect(deps.files.updateForNewVersion).toHaveBeenCalledWith(
      expect.objectContaining({ size: 3 }),
    )
  })
})
```

- [ ] **Step 4: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/actions/markdown` と `@/lib/repositories/file-versions` を解決できない）

- [ ] **Step 5: バージョンリポジトリを実装する**

`lib/repositories/file-versions.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type FileVersion = {
  id: string
  fileId: string
  version: number
  content: string | null
  storagePath: string | null
  size: number
  authorId: string
  note: string
  createdAt: string
}

export interface FileVersionRepository {
  listByFile(fileId: string): Promise<FileVersion[]>
  findByVersion(fileId: string, version: number): Promise<FileVersion | null>
  create(input: {
    fileId: string
    version: number
    content: string | null
    storagePath: string | null
    size: number
    authorId: string
    note: string
  }): Promise<FileVersion>
}

type Row = {
  id: string
  file_id: string
  version: number
  content: string | null
  storage_path: string | null
  size: number
  author_id: string
  note: string
  created_at: string
}

const COLUMNS = 'id, file_id, version, content, storage_path, size, author_id, note, created_at'

function toVersion(row: Row): FileVersion {
  return {
    id: row.id,
    fileId: row.file_id,
    version: row.version,
    content: row.content,
    storagePath: row.storage_path,
    size: row.size,
    authorId: row.author_id,
    note: row.note,
    createdAt: row.created_at,
  }
}

export function createSupabaseFileVersionRepository(
  supabase: SupabaseClient,
): FileVersionRepository {
  return {
    async listByFile(fileId) {
      const { data, error } = await supabase
        .from('file_versions')
        .select(COLUMNS)
        .eq('file_id', fileId)
        .order('version', { ascending: false })
      if (error) throw error
      return (data as Row[]).map(toVersion)
    },

    async findByVersion(fileId, version) {
      const { data, error } = await supabase
        .from('file_versions')
        .select(COLUMNS)
        .eq('file_id', fileId)
        .eq('version', version)
        .maybeSingle()
      if (error) throw error
      return data ? toVersion(data as Row) : null
    },

    async create(input) {
      const { data, error } = await supabase
        .from('file_versions')
        .insert({
          file_id: input.fileId,
          version: input.version,
          content: input.content,
          storage_path: input.storagePath,
          size: input.size,
          author_id: input.authorId,
          note: input.note,
        })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return toVersion(data as Row)
    },
  }
}
```

- [ ] **Step 6: Markdown のユースケースと Server Actions を実装する**

`lib/actions/markdown.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { validateUpload } from '@/lib/domain/files'
import { type Result, err, ok } from '@/lib/domain/result'
import {
  type FileVersionRepository,
  createSupabaseFileVersionRepository,
} from '@/lib/repositories/file-versions'
import { type FileRepository, createSupabaseFileRepository } from '@/lib/repositories/files'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Deps = { files: FileRepository; versions: FileVersionRepository }

/**
 * テキスト系ファイルの本文を新しい版として保存する。
 * 新しい版番号を返す。
 */
export async function saveMarkdown(
  deps: Deps,
  input: { fileId: string; content: string; authorId: string },
): Promise<Result<number>> {
  const file = await deps.files.findById(input.fileId)
  if (!file) return err('NOT_FOUND', 'ファイルが見つかりません。')

  if (file.kind === 'binary') {
    return err('VALIDATION_ERROR', 'このファイルはアプリ内で編集できません。')
  }

  const nextVersion = file.currentVersion + 1
  const size = new TextEncoder().encode(input.content).length

  await deps.versions.create({
    fileId: file.id,
    version: nextVersion,
    content: input.content,
    storagePath: null,
    size,
    authorId: input.authorId,
    note: '編集',
  })

  await deps.files.updateForNewVersion({
    id: file.id,
    version: nextVersion,
    size,
    storagePath: null,
  })

  return ok(nextVersion)
}

async function context() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createMarkdownFileAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const folderIdRaw = String(formData.get('folderId') ?? '')
  const folderId = folderIdRaw === '' ? null : folderIdRaw
  const rawName = String(formData.get('name') ?? '').trim()
  const name = rawName.endsWith('.md') ? rawName : `${rawName}.md`

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const validated = validateUpload({ name, size: 1 })
  if (!validated.ok) return validated

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const files = createSupabaseFileRepository(supabase)
    const versions = createSupabaseFileVersionRepository(supabase)

    const created = await files.create({
      projectId,
      folderId,
      name: validated.data.name,
      kind: 'markdown',
      mimeType: 'text/markdown',
      size: 0,
      storagePath: null,
      createdBy: user.id,
    })

    await versions.create({
      fileId: created.id,
      version: 1,
      content: '',
      storagePath: null,
      size: 0,
      authorId: user.id,
      note: '新規作成',
    })
  } catch {
    return err('UNKNOWN', 'ファイルを作成できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

export async function saveMarkdownAction(formData: FormData): Promise<Result<number>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  const content = String(formData.get('content') ?? '')

  if (!fileId) return err('VALIDATION_ERROR', '対象のファイルが指定されていません。')

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  let result: Result<number>
  try {
    result = await saveMarkdown(
      {
        files: createSupabaseFileRepository(supabase),
        versions: createSupabaseFileVersionRepository(supabase),
      },
      { fileId, content, authorId: user.id },
    )
  } catch {
    return err('UNKNOWN', '保存に失敗しました。')
  }

  if (result.ok) {
    revalidatePath(`/projects/${projectId}/files/${fileId}`)
    revalidatePath(`/projects/${projectId}`)
  }
  return result
}
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（markdown 5 件を含む全件）

- [ ] **Step 8: エディタ画面を作成する**

`components/app/markdown-editor.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { saveMarkdownAction } from '@/lib/actions/markdown'

export function MarkdownEditor({
  projectId,
  fileId,
  initialContent,
  version,
}: {
  projectId: string
  fileId: string
  initialContent: string
  version: number
}) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setMessage(null)
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)
    formData.set('content', content)

    startTransition(async () => {
      const result = await saveMarkdownAction(formData)
      if (result.ok) {
        setMessage(`v${result.data} として保存しました。`)
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? '保存中…' : '保存'}
        </Button>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
          現在のバージョン: v{version}
        </span>
        {message && <span style={{ fontSize: '0.85rem' }}>{message}</span>}
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <textarea
          aria-label="Markdown 本文"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          style={{
            minHeight: 420,
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.9rem',
            resize: 'vertical',
          }}
        />
        <Card style={{ minHeight: 420, overflow: 'auto' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </Card>
      </div>
    </div>
  )
}
```

`components/app/markdown-create-form.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createMarkdownFileAction } from '@/lib/actions/markdown'

export function MarkdownCreateForm({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    startTransition(async () => {
      const result = await createMarkdownFileAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input name="name" placeholder="メモ名（.md は省略可）" disabled={isPending} />
        <Button type="submit" variant="secondary" disabled={isPending}>
          Markdown を新規作成
        </Button>
      </div>
      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{message}</p>
      )}
    </form>
  )
}
```

`app/(app)/projects/[projectId]/files/[fileId]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarkdownEditor } from '@/components/app/markdown-editor'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function FilePage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>
}) {
  const { projectId, fileId } = await params
  const supabase = await createServerSupabaseClient()

  const file = await createSupabaseFileRepository(supabase).findById(fileId)
  if (!file) notFound()

  const latest = await createSupabaseFileVersionRepository(supabase).findByVersion(
    fileId,
    file.currentVersion,
  )

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{file.name}</h1>
        <Link href={`/projects/${projectId}/files/${fileId}/history`}>変更履歴</Link>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>

      {file.kind === 'binary' ? (
        <p style={{ color: 'var(--color-fg-muted)' }}>
          この形式はアプリ内で編集できません。プロジェクト画面からダウンロードしてご確認ください。
        </p>
      ) : (
        <MarkdownEditor
          projectId={projectId}
          fileId={fileId}
          initialContent={latest?.content ?? ''}
          version={file.currentVersion}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 9: プロジェクト画面に新規作成フォームを追加する**

`app/(app)/projects/[projectId]/page.tsx` の「ファイル」セクションで、
`<FileUploadForm ... />` の直前に次を挿入する。あわせて import を追加する。

```tsx
import { MarkdownCreateForm } from '@/components/app/markdown-create-form'
```

```tsx
<MarkdownCreateForm projectId={projectId} />
```

- [ ] **Step 10: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 11: 実際に動作を確認する**

```bash
npm run dev
```

1. Markdown を新規作成し、一覧に `.md` として現れること
2. エディタで本文を入力すると、右側のプレビューが即座に描画されること（表・リストを含む GFM 記法）
3. 保存すると「v2 として保存しました。」と表示され、再読み込み後も本文が残ること
4. binary ファイルを開くと編集不可の案内が出ること

- [ ] **Step 12: コミットする**

```bash
git add -A
git commit -m "feat(editor): アプリ内Markdownエディタを実装

- FileVersionRepository を追加し版の作成・取得に対応
- 保存のたびに版番号を進める saveMarkdown ユースケースを追加
- 編集とプレビューを並べたエディタ画面を追加
- プロジェクト画面から Markdown を新規作成できるようにした"
```

---

## Task 8: バージョン履歴と差分表示

**ブランチ:** `feature/version-history`

**Files:**
- Create: `lib/domain/diff.ts`, `lib/domain/__tests__/diff.test.ts`
- Create: `app/(app)/projects/[projectId]/files/[fileId]/history/page.tsx`
- Create: `components/app/version-history.tsx`

**Interfaces:**
- Consumes: `FileVersionRepository`（Task 7）、`FileRepository`（Task 6）、UI プリミティブ（Task 3）
- Produces:
  - `type DiffLine = { type: 'added' | 'removed' | 'unchanged'; value: string }`
  - `function diffLines(oldText: string, newText: string): DiffLine[]`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b feature/version-history
```

- [ ] **Step 2: 差分ライブラリを追加する**

```bash
npm install diff
npm install -D @types/diff
```

- [ ] **Step 3: 失敗するテストを書く**

`lib/domain/__tests__/diff.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { diffLines } from '@/lib/domain/diff'

describe('diffLines', () => {
  it('同一のテキストはすべて unchanged になる', () => {
    const result = diffLines('a\nb', 'a\nb')
    expect(result.every((line) => line.type === 'unchanged')).toBe(true)
    expect(result.map((l) => l.value)).toEqual(['a', 'b'])
  })

  it('追加された行を added として返す', () => {
    const result = diffLines('a', 'a\nb')
    expect(result).toContainEqual({ type: 'added', value: 'b' })
  })

  it('削除された行を removed として返す', () => {
    const result = diffLines('a\nb', 'a')
    expect(result).toContainEqual({ type: 'removed', value: 'b' })
  })

  it('変更行を removed と added の組で返す', () => {
    const result = diffLines('こんにちは', 'こんばんは')
    expect(result).toContainEqual({ type: 'removed', value: 'こんにちは' })
    expect(result).toContainEqual({ type: 'added', value: 'こんばんは' })
  })

  it('空文字同士は空配列を返す', () => {
    expect(diffLines('', '')).toEqual([])
  })

  it('空から本文への変更をすべて added として返す', () => {
    const result = diffLines('', 'a\nb')
    expect(result).toEqual([
      { type: 'added', value: 'a' },
      { type: 'added', value: 'b' },
    ])
  })
})
```

- [ ] **Step 4: テストを実行し、失敗することを確認する**

Run: `npm test`
Expected: FAIL（`@/lib/domain/diff` を解決できない）

- [ ] **Step 5: 最小の実装を書く**

`lib/domain/diff.ts`:

```typescript
import { diffLines as computeDiff } from 'diff'

export type DiffLine = {
  type: 'added' | 'removed' | 'unchanged'
  value: string
}

/**
 * 2 つのテキストを行単位で比較する。
 * 末尾の空行は差分として扱わない。
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const parts = computeDiff(oldText, newText)
  const result: DiffLine[] = []

  for (const part of parts) {
    const type: DiffLine['type'] = part.added
      ? 'added'
      : part.removed
        ? 'removed'
        : 'unchanged'

    const lines = part.value.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

    for (const value of lines) {
      result.push({ type, value })
    }
  }

  return result
}
```

- [ ] **Step 6: テストを実行し、成功することを確認する**

Run: `npm test`
Expected: PASS（diff 6 件を含む全件）

- [ ] **Step 7: 履歴画面を作成する**

`components/app/version-history.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { type DiffLine, diffLines } from '@/lib/domain/diff'
import type { FileVersion } from '@/lib/repositories/file-versions'

const LINE_STYLE: Record<DiffLine['type'], React.CSSProperties> = {
  added: { background: 'rgb(52 199 89 / 0.16)' },
  removed: { background: 'rgb(255 69 58 / 0.16)' },
  unchanged: {},
}

const PREFIX: Record<DiffLine['type'], string> = {
  added: '+ ',
  removed: '- ',
  unchanged: '  ',
}

export function VersionHistory({
  versions,
  isTextFile,
}: {
  versions: FileVersion[]
  isTextFile: boolean
}) {
  const [selected, setSelected] = useState<number>(versions[0]?.version ?? 1)

  const diff = useMemo(() => {
    if (!isTextFile) return []
    const current = versions.find((v) => v.version === selected)
    const previous = versions.find((v) => v.version === selected - 1)
    return diffLines(previous?.content ?? '', current?.content ?? '')
  }, [isTextFile, selected, versions])

  if (versions.length === 0) {
    return <p style={{ color: 'var(--color-fg-muted)' }}>履歴がまだありません。</p>
  }

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(220px, 280px) 1fr' }}>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8, alignContent: 'start' }}>
        {versions.map((version) => (
          <li key={version.id}>
            <button
              onClick={() => setSelected(version.version)}
              style={{
                width: '100%',
                textAlign: 'left',
                background:
                  version.version === selected ? 'var(--color-accent)' : 'var(--color-surface)',
                color:
                  version.version === selected ? 'var(--color-accent-fg)' : 'var(--color-fg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 10,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600 }}>v{version.version}（{version.note}）</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                {new Date(version.createdAt).toLocaleString('ja-JP')} / {version.size} バイト
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Card style={{ overflow: 'auto' }}>
        {!isTextFile ? (
          <p style={{ color: 'var(--color-fg-muted)' }}>
            この形式は差分表示に対応していません。版ごとの記録のみ保持しています。
          </p>
        ) : diff.length === 0 ? (
          <p style={{ color: 'var(--color-fg-muted)' }}>この版に変更はありません。</p>
        ) : (
          <pre style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>
            {diff.map((line, index) => (
              <div key={index} style={LINE_STYLE[line.type]}>
                {PREFIX[line.type]}
                {line.value}
              </div>
            ))}
          </pre>
        )}
      </Card>
    </div>
  )
}
```

`app/(app)/projects/[projectId]/files/[fileId]/history/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { VersionHistory } from '@/components/app/version-history'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>
}) {
  const { projectId, fileId } = await params
  const supabase = await createServerSupabaseClient()

  const file = await createSupabaseFileRepository(supabase).findById(fileId)
  if (!file) notFound()

  const versions = await createSupabaseFileVersionRepository(supabase).listByFile(fileId)

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{file.name} の変更履歴</h1>
        <Link href={`/projects/${projectId}/files/${fileId}`}>ファイルへ戻る</Link>
      </header>
      <VersionHistory versions={versions} isTextFile={file.kind !== 'binary'} />
    </div>
  )
}
```

- [ ] **Step 8: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 9: 実際に動作を確認する**

```bash
npm run dev
```

1. Markdown を 3 回編集・保存し、履歴に v1〜v4 が新しい順で並ぶこと
2. 版を選ぶと直前の版との差分が緑（追加）と赤（削除）で表示されること
3. PDF の履歴画面では「差分表示に対応していません」と案内が出ること

- [ ] **Step 10: コミットする**

```bash
git add -A
git commit -m "feat(history): バージョン履歴と差分表示を実装

- 行単位のテキスト差分を生成するドメインロジックを追加
- 版の一覧と選択した版の差分を表示する履歴画面を追加
- バイナリは版の記録のみ表示する扱いに統一"
```

---

## Task 9: ダッシュボードとテーマ設定画面

**ブランチ:** `feature/dashboard`

**Files:**
- Create: `app/(app)/dashboard/page.tsx`
- Create: `app/(app)/settings/page.tsx`
- Create: `components/app/theme-switcher.tsx`
- Create: `lib/actions/settings.ts`
- Create: `app/page.tsx`（トップからの振り分け。既存を置き換える）
- Create: `app/(app)/error.tsx`, `app/(app)/not-found.tsx`

**Interfaces:**
- Consumes: `ThemePreference` `THEME_COOKIE_NAME`（Task 3）、
  `createServerSupabaseClient`（Task 4）、UI プリミティブ（Task 3）
- Produces:
  - Server Action: `updateThemeAction(formData: FormData): Promise<Result<null>>`

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b feature/dashboard
```

- [ ] **Step 2: テーマ設定の Server Action を実装する**

`lib/actions/settings.ts`:

```typescript
'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { THEME_COOKIE_NAME, type ThemePreference } from '@/lib/platform/theme'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const VALID: ThemePreference[] = ['auto', 'apple', 'windows']

export async function updateThemeAction(formData: FormData): Promise<Result<null>> {
  const value = String(formData.get('theme') ?? '') as ThemePreference

  if (!VALID.includes(value)) {
    return err('VALIDATION_ERROR', '不正なテーマが指定されました。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const { error } = await supabase
    .from('profiles')
    .update({ theme: value })
    .eq('id', user.id)

  if (error) return err('UNKNOWN', 'テーマを保存できませんでした。')

  const cookieStore = await cookies()
  cookieStore.set(THEME_COOKIE_NAME, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  revalidatePath('/', 'layout')
  return ok(null)
}
```

- [ ] **Step 3: 設定画面を作成する**

`components/app/theme-switcher.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateThemeAction } from '@/lib/actions/settings'
import type { ThemePreference } from '@/lib/platform/theme'

const OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'auto', label: '自動', description: 'ご利用の端末に合わせて切り替えます。' },
  { value: 'apple', label: 'Apple 風', description: '大きめの角丸と柔らかい影で表示します。' },
  { value: 'windows', label: 'Windows 風', description: '控えめな角丸とはっきりした境界で表示します。' },
]

export function ThemeSwitcher({ current }: { current: ThemePreference }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSelect(value: ThemePreference) {
    setMessage(null)
    const formData = new FormData()
    formData.set('theme', value)
    startTransition(async () => {
      const result = await updateThemeAction(formData)
      if (result.ok) {
        setMessage('テーマを変更しました。')
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={option.value === current ? 'primary' : 'secondary'}
            disabled={isPending}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
        {OPTIONS.find((o) => o.value === current)?.description}
      </p>
      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}
    </div>
  )
}
```

`app/(app)/settings/page.tsx`:

```tsx
import { ThemeSwitcher } from '@/components/app/theme-switcher'
import type { ThemePreference } from '@/lib/platform/theme'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('theme, email')
    .eq('id', user!.id)
    .maybeSingle()

  const current = (profile?.theme ?? 'auto') as ThemePreference

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>設定</h1>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ fontWeight: 600 }}>アカウント</h2>
        <p style={{ color: 'var(--color-fg-muted)' }}>{profile?.email}</p>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ fontWeight: 600 }}>表示テーマ</h2>
        <ThemeSwitcher current={current} />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: ダッシュボードを作成する**

`app/(app)/dashboard/page.tsx`:

```tsx
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { MAX_PROJECTS_PER_USER } from '@/lib/domain/projects'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type RecentFile = {
  id: string
  name: string
  updated_at: string
  project_id: string
  projects: { name: string } | null
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ count: projectCount }, { data: recentFiles }] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user!.id),
    supabase
      .from('files')
      .select('id, name, updated_at, project_id, projects(name)')
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  const files = (recentFiles ?? []) as unknown as RecentFile[]

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>ホーム</h1>

      <Card style={{ display: 'grid', gap: 4 }}>
        <span style={{ color: 'var(--color-fg-muted)', fontSize: '0.85rem' }}>プロジェクト</span>
        <span style={{ fontSize: '1.8rem', fontWeight: 600 }}>
          {projectCount ?? 0} / {MAX_PROJECTS_PER_USER}
        </span>
        <Link href="/projects">プロジェクト一覧へ</Link>
      </Card>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ fontWeight: 600 }}>最近の更新</h2>
        {files.length === 0 ? (
          <p style={{ color: 'var(--color-fg-muted)' }}>更新されたファイルはまだありません。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {files.map((file) => (
              <li
                key={file.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                }}
              >
                <Link href={`/projects/${file.project_id}/files/${file.id}`}>
                  📄 {file.name}
                </Link>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
                  {file.projects?.name} / {new Date(file.updated_at).toLocaleString('ja-JP')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 5: トップページとエラー画面を作成する**

`app/page.tsx`（既存を置き換える）:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  redirect(user ? '/dashboard' : '/login')
}
```

`app/(app)/error.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <h2 style={{ fontWeight: 600 }}>問題が発生しました</h2>
      <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem' }}>
        処理を完了できませんでした。時間をおいて再度お試しください。
      </p>
      <Button onClick={reset}>再試行</Button>
    </Card>
  )
}
```

`app/(app)/not-found.tsx`:

```tsx
import Link from 'next/link'
import { Card } from '@/components/ui/card'

export default function AppNotFound() {
  return (
    <Card style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <h2 style={{ fontWeight: 600 }}>お探しのページは見つかりません</h2>
      <Link href="/dashboard">ホームへ戻る</Link>
    </Card>
  )
}
```

- [ ] **Step 6: 検証セットを実行する**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: すべて成功。

- [ ] **Step 7: 実際に動作を確認する**

```bash
npm run dev
```

1. ログイン済みで `/` にアクセスすると `/dashboard` へ転送されること
2. 未ログインで `/` にアクセスすると `/login` へ転送されること
3. ダッシュボードにプロジェクト数と最近更新したファイルが並ぶこと
4. 設定画面でテーマを「Windows 風」に切り替えると、角丸・影・フォントが即座に変わること
5. 再読み込み後もテーマが保持されること
6. 存在しないファイル ID を開くと「お探しのページは見つかりません」が表示されること

- [ ] **Step 8: 他ユーザーのデータに触れないことを確認する**

Supabase MCP の `execute_sql` で 2 人目のユーザーのプロジェクト ID を調べ、
1 人目でログインした状態でその URL を開く。
「お探しのページは見つかりません」が表示され、データが漏れないことを確認する。

- [ ] **Step 9: コミットする**

```bash
git add -A
git commit -m "feat(dashboard): ホーム画面とテーマ設定画面を実装

- プロジェクト数と最近更新したファイルを表示するダッシュボードを追加
- テーマ設定をプロファイルとCookieに保存する設定画面を追加
- トップページの認証状態による振り分けを追加
- アプリ領域のエラー画面と404画面を追加"
```

---

## Task 10: GitHub 閲覧用 README の整備

**ブランチ:** `docs/readme`

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: ブランチを作成する**

```bash
git checkout -b docs/readme
```

- [ ] **Step 2: README を Markdown として整形し直す**

現在の `README.md` は仕様書がプレーンテキストのまま貼られており、GitHub 上で
表が崩れ、見出しが認識されない。次の構成に書き直す。

1. タイトルと 1 行説明、バッジ（技術スタック）
2. 概要とコンセプト
3. スクリーンショット枠（現時点では省略し、見出しも置かない）
4. 技術スタック（Markdown テーブル）
5. 主要機能（フェーズ別の実装状況を ✅ / 🚧 で明示）
6. アーキテクチャとデータ保持戦略
7. データベース構成（`mermaid` の ER 図）
8. 画面一覧（テーブル）
9. セットアップ手順（前提・インストール・環境変数・起動）
10. 開発コマンド一覧（テーブル）
11. 開発ルールへの参照（`CLAUDE.md`）とドキュメント一覧
12. ロードマップ（P1〜P4）

注意点:

- 元の仕様の情報は削らない。整形と実装状況の追記のみ行う
- タブ区切りだった表は Markdown テーブルに直す
- ER 図は GitHub がネイティブ描画する ` ```mermaid ` ブロックで書く
- 見出しは `#` `##` `###` の 3 階層までに収める
- Supabase プロジェクト ref や URL、キーの実値は**記載しない**（`CLAUDE.md` R-01 / R-14）

- [ ] **Step 3: 表示を確認する**

Markdown プレビューで次を確認する。

- すべてのテーブルが罫線付きで描画される
- mermaid ブロックが構文エラーにならない
- 見出し階層が飛んでいない
- リンク切れがない

- [ ] **Step 4: コミットする**

```bash
git add README.md
git commit -m "docs: GitHub閲覧用にREADMEを整形

- タブ区切りの表をMarkdownテーブルに変換
- ER図をmermaidブロックで記述
- セットアップ手順と開発コマンドを追加
- フェーズ別の実装状況を明記"
```

---

## 自己レビュー結果

**1. 設計書の網羅性**

| 設計書の項目 | 対応タスク |
|---|---|
| §4 技術スタック | Task 1 |
| §5.1 Server Actions 方針 | Task 5〜9 |
| §5.2 ディレクトリ構成 | Task 1〜9 |
| §6.1 テーブル定義 | Task 2 |
| §6.2 RLS | Task 2、確認は Task 9 Step 8 |
| §6.3 プロジェクト上限 | Task 2（トリガー）+ Task 5（アクション） |
| §6.4 Storage | Task 2（バケット）+ Task 6（アップロード） |
| §6.5 バージョン履歴 | Task 6（初版）+ Task 7（更新）+ Task 8（表示） |
| §7 プラットフォーム適応 UI | Task 3 + Task 9（設定画面） |
| §8 エラー処理 | Task 1（Result）+ 各タスク + Task 9（error.tsx） |
| §9 テスト | 全タスク |
| §10 ブランチ計画 | 各タスク Step 1 |
| §11 依存パッケージ | Task 1 / 4 / 7 / 8 |
| §12 環境変数 | Task 1 Step 5、Task 2 Step 8 |
| §13 完了条件 1〜12 | Task 4 / 5 / 6 / 7 / 8 / 9 の動作確認手順に対応 |

**2. プレースホルダ**

「TBD」「後で実装」「適切なエラー処理を追加」等は含まれていない。
すべての手順に実際のコードまたは実行コマンドを記載済み。

**3. 型の一貫性**

- `Result<T>` / `ok` / `err` — Task 1 で定義し、以降すべてのタスクで同一の形で使用
- `FileKind`（`'markdown' | 'text' | 'binary'`）— Task 6 で定義、Task 7 で参照
- `ProjectFile` / `FileRepository` — Task 6 で定義、Task 7・8 で参照
- `FileVersion` / `FileVersionRepository` — Task 7 で定義、Task 8 で参照
- `FolderRow` / `FolderNode` — Task 6 で定義、同タスク内で使用
- `ThemePreference` / `THEME_COOKIE_NAME` — Task 3 で定義、Task 9 で参照
- `MAX_PROJECTS_PER_USER` — Task 2 で定義、Task 5・9 で参照

`buildStoragePath` の引数名（`projectId` / `fileId` / `version` / `filename`）は
Task 6 の定義と Task 6 の呼び出しで一致している。
