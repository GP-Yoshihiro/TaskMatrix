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

create index tasks_project_id_idx  on public.tasks (project_id);
create index tasks_board_idx       on public.tasks (project_id, status, position);
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
-- サブクエリで projects を結合するため、外側の列は必ずテーブル名で修飾する
-- （P1 で storage.foldername(name) の name が projects.name に解決され、
--   ポリシーが常に偽になる不具合を起こしたため）
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
