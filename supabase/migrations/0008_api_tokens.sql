-- ============================================================
-- 連携トークン（iOS ショートカット / Webhook API 用）
--
-- ショートカットは Cookie を持てないため、画面と同じセッション認証が使えない。
-- API 側はサーバー専用キーで接続するため RLS を通らない。
-- そのため「操作対象をリクエストから受け取らず、トークンが決める」構造で守る。
-- 詳細は docs/specs/2026-09-01-shortcuts-api-design.md を参照。
-- ============================================================

create table public.api_tokens (
  id             uuid primary key default gen_random_uuid(),

  -- このトークンが操作できる唯一のプロジェクト。
  -- リクエスト本文でプロジェクトを指定させないため、ここが操作範囲そのものになる
  project_id     uuid not null references public.projects(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,

  name           text not null default '',

  -- 平文は保存しない。データベースが読まれても、そのままでは使えないようにする
  token_hash     text not null unique,

  -- 一覧で見分けるための接頭辞のみ。全文は発行直後の 1 回しか見せない
  display_prefix text not null default '',

  last_used_at   timestamptz,

  -- 回数制限（固定窓）。専用の記録表を作らずに済ませる
  rate_window_started_at timestamptz,
  rate_count     integer not null default 0 check (rate_count >= 0),

  created_at     timestamptz not null default now()
);

create index api_tokens_project_idx
  on public.api_tokens (project_id, created_at desc);

-- ============================================================
-- 行レベルセキュリティ
--
-- 画面から自分のプロジェクトのトークンだけを扱えるようにする。
-- API 側はサーバー専用キーのためここを通らない。
-- ============================================================

alter table public.api_tokens enable row level security;

create policy api_tokens_all_own on public.api_tokens
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = api_tokens.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = api_tokens.project_id and p.owner_id = (select auth.uid())
    )
  );
