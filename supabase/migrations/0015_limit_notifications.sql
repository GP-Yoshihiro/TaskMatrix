-- ============================================================
-- 利用上限に達したことの通知
--
-- AI の費用は運用者（親）がまとめて負担している。
-- 子が上限に達して機能が止まったことを、親が知る手立てが必要になる。
--
-- 1 人 1 日 1 件にまとめる。上限に達したあとの操作すべてを記録すると、
-- 同じ内容が何十件も並び、かえって気付けなくなるため。
-- ============================================================

create table public.limit_notifications (
  id          uuid primary key default gen_random_uuid(),

  -- 上限に達した本人
  user_id     uuid not null references public.profiles(id) on delete cascade,

  -- 日本時間の日付（YYYY-MM-DD）。1 日 1 件にまとめる鍵
  reached_on  date not null,

  -- 何の上限に達したか
  reason      text not null check (reason in ('calls', 'tokens')),

  -- 親が確認した時刻。未確認のものだけを知らせる
  read_at     timestamptz,

  created_at  timestamptz not null default now(),

  -- 同じ人の同じ日は 1 件だけ
  unique (user_id, reached_on)
);

create index limit_notifications_unread_idx
  on public.limit_notifications (created_at desc)
  where read_at is null;

alter table public.limit_notifications enable row level security;

-- 自分が上限に達したことは、自分で記録する
create policy limit_notifications_insert_own on public.limit_notifications
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- 読めるのは、自分の分と、管理者（親）が見る全員分
create policy limit_notifications_select on public.limit_notifications
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin
    )
  );

-- 確認済みにできるのは管理者のみ
create policy limit_notifications_update_admin on public.limit_notifications
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin
    )
  );
