-- ============================================================
-- TaskMatrix 第3フェーズ スケジュールと稼働条件
-- ============================================================

create table public.schedules (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text not null default '',
  weight     text not null default 'normal'
               check (weight in ('very_heavy','heavy','normal','light','very_light')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_range_valid check (ends_at > starts_at)
);

create index schedules_project_idx on public.schedules (project_id, starts_at);
create index schedules_task_idx    on public.schedules (task_id);

create table public.work_settings (
  user_id                uuid primary key references public.profiles(id) on delete cascade,
  work_days              smallint[] not null default '{1,2,3,4,5}',
  work_start             time not null default '09:00',
  work_end               time not null default '18:00',
  daily_capacity_minutes integer not null default 360,
  timezone               text not null default 'Asia/Tokyo',
  updated_at             timestamptz not null default now(),
  constraint work_settings_hours_valid check (work_end > work_start),
  constraint work_settings_capacity_positive check (daily_capacity_minutes > 0)
);

-- ============================================================
-- 行レベルセキュリティ
-- サブクエリで projects を結合するため、外側の列はテーブル名で修飾する
-- ============================================================

alter table public.schedules     enable row level security;
alter table public.work_settings enable row level security;

create policy schedules_all_own on public.schedules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = schedules.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = schedules.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy work_settings_all_own on public.work_settings
  for all
  to authenticated
  using (work_settings.user_id = (select auth.uid()))
  with check (work_settings.user_id = (select auth.uid()));
