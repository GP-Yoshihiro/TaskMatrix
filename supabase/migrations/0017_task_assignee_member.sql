-- ============================================================
-- タスクの担当をメンバーに結び付ける
--
-- 既存の tasks.assignee（自由入力の文字列）は**残す**。
-- 名簿に無い人を今までどおり扱えるようにするためで、
-- 既存のデータもそのまま動く。
--
-- 担当の解決は「メンバーが選ばれていればその名前、無ければ自由入力の文字」とする。
--
-- 詳細は docs/specs/2026-09-14-project-members-design.md を参照。
-- ============================================================

alter table public.tasks
  add column if not exists assignee_member_id uuid
    references public.project_members(id) on delete set null;

-- メンバーを消してもタスクは消さない。担当が外れるだけで、
-- 作業そのものが無くなるわけではないため（on delete set null）

comment on column public.tasks.assignee_member_id is
  '担当のメンバー。null なら assignee（自由入力）を使う';

-- 並べ替えで担当ごとに集めるときに引く
create index if not exists tasks_assignee_member_idx
  on public.tasks (assignee_member_id)
  where assignee_member_id is not null;
