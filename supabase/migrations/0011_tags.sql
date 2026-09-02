-- ============================================================
-- タグとロック
--
-- タグはファイルごとに付ける。履歴の絞り込みと、
-- 消したくないファイルの保護に使う。
-- 詳細は docs/specs/2026-09-02-history-log-design.md を参照。
-- ============================================================

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,

  -- 付いたファイルを削除させず、容量削減の対象からも外す
  locked     boolean not null default false,

  created_at timestamptz not null default now(),

  -- 同じプロジェクトに同名のタグを作らせない
  unique (project_id, name)
);

create table public.file_tags (
  file_id    uuid not null references public.files(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (file_id, tag_id)
);

create index file_tags_tag_idx on public.file_tags (tag_id);

-- ============================================================
-- 行レベルセキュリティ
-- ============================================================

alter table public.tags      enable row level security;
alter table public.file_tags enable row level security;

create policy tags_all_own on public.tags
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = tags.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tags.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy file_tags_all_own on public.file_tags
  for all to authenticated
  using (
    exists (
      select 1 from public.files f
      join public.projects p on p.id = f.project_id
      where f.id = file_tags.file_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.files f
      join public.projects p on p.id = f.project_id
      where f.id = file_tags.file_id and p.owner_id = (select auth.uid())
    )
  );

-- ============================================================
-- データベースの使用量
--
-- 履歴は半永久に残すため、上限に近づいたときだけ古い順に消す。
-- その判断に使う。
--
-- security invoker とする。RLS に依存しない値であり、
-- 権限を広げる必要がないため。
-- ============================================================

create function public.database_size_bytes()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.pg_database_size(pg_catalog.current_database())
$$;
