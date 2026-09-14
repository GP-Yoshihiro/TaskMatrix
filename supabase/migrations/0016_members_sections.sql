-- ============================================================
-- プロジェクトのメンバーとセクション
--
-- 担当はこれまでタスクごとの自由入力の文字列だった。
-- 表記ゆれで同じ人が別の行に分かれるため、並べ替えの土台にできない。
--
-- メンバーは**名簿**であり、利用者アカウントとは結び付けない。
-- ログインするのは引き続きプロジェクトの所有者だけである。
--
-- 詳細は docs/specs/2026-09-14-project-members-design.md を参照。
-- ============================================================

create table public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  name       text not null check (length(trim(name)) > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 同じ名前を二重に登録させない。並べ替えの基準が割れるため
  unique (project_id, name)
);

create table public.sections (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  name       text not null check (length(trim(name)) > 0),

  -- 画面に並べる順。同じ値なら名前順にする
  position   integer not null default 0,

  created_at timestamptz not null default now(),

  unique (project_id, name)
);

-- メンバーとセクションの結び付き。**複属はここで表す**
create table public.member_sections (
  member_id  uuid not null references public.project_members(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,

  -- 付けた順。複属のとき「最初の所属」を決める基準になる
  created_at timestamptz not null default now(),

  primary key (member_id, section_id)
);

create index project_members_project_idx on public.project_members (project_id, name);
create index sections_project_idx on public.sections (project_id, position, name);
create index member_sections_section_idx on public.member_sections (section_id);

-- ============================================================
-- 行レベルセキュリティ
--
-- いずれもプロジェクトの所有者だけが読み書きできる。既存の表と揃える。
-- ============================================================

alter table public.project_members enable row level security;
alter table public.sections enable row level security;
alter table public.member_sections enable row level security;

create policy project_members_all_own on public.project_members
  for all
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy sections_all_own on public.sections
  for all
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id and p.owner_id = (select auth.uid())
    )
  );

-- 結び付きは、メンバー側の所属プロジェクトを辿って判定する
create policy member_sections_all_own on public.member_sections
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.project_members m
      join public.projects p on p.id = m.project_id
      where m.id = member_sections.member_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.project_members m
      join public.projects p on p.id = m.project_id
      where m.id = member_sections.member_id and p.owner_id = (select auth.uid())
    )
  );
