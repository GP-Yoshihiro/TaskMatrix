-- ============================================================
-- 変更履歴
--
-- ファイルの追加・編集・削除を記録する。
-- 詳細は docs/specs/2026-09-02-history-log-design.md を参照。
-- ============================================================

create table public.history_entries (
  id             uuid primary key default gen_random_uuid(),

  project_id     uuid not null references public.projects(id) on delete cascade,

  -- 対象ファイル。**外部キーを張らない。**
  -- ファイルを消しても「誰がいつ何を消したか」を残す必要があるため、
  -- 参照制約で連鎖削除されてはならない。
  file_id        uuid,

  -- 記録時点の値を焼き込む。ファイルが消えても一覧に表示できるようにする
  file_name      text not null default '',
  file_extension text not null default '',
  file_kind      text not null default '',

  action         text not null check (action in ('created', 'updated', 'deleted')),

  -- 対応する版番号（あれば）
  version        integer,

  -- 変更箇所のみ。全文は保存しない。
  -- 半永久に残すため、毎回全文を持つと容量が早く尽きる
  changes        jsonb not null default '[]'::jsonb,

  added_count    integer not null default 0 check (added_count   >= 0),
  removed_count  integer not null default 0 check (removed_count >= 0),

  -- 変更が多すぎて一部しか保存していないか
  truncated      boolean not null default false,

  -- アカウントが消えても履歴は残す
  author_id      uuid references public.profiles(id) on delete set null,

  -- 記録時点の表示名。アカウントが消えても誰の操作か分かるようにする
  author_name    text not null default '',

  created_at     timestamptz not null default now()
);

-- 一覧（新しい順・古い順）と無限スクロール
create index history_entries_project_idx
  on public.history_entries (project_id, created_at desc, id desc);

-- ファイル名で絞り込んだときの取得
create index history_entries_file_idx
  on public.history_entries (project_id, file_id);

-- ============================================================
-- 行レベルセキュリティ
--
-- 追記のみとし、update のポリシーは作らない。
-- 変更履歴を後から書き換えられると、記録そのものの意味が失われる。
-- delete は容量削減（第 3 期）で使うため許可する。
-- ============================================================

alter table public.history_entries enable row level security;

create policy history_entries_select_own on public.history_entries
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = history_entries.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy history_entries_insert_own on public.history_entries
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = history_entries.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy history_entries_delete_own on public.history_entries
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = history_entries.project_id and p.owner_id = (select auth.uid())
    )
  );

-- ============================================================
-- 表示名
--
-- 履歴の変更者名に使う。未登録ならメールアドレスの @ より前を使うため、
-- 既定値は空文字とする。
-- ============================================================

alter table public.profiles
  add column display_name text not null default '';
