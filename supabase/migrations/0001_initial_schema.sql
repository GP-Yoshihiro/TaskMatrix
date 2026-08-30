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
