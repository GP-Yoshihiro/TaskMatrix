-- ============================================================
-- 招待コードによる登録制限
--
-- URL を知っていれば誰でも登録できる状態をやめる。
-- Gemini API のキーはサーバー側の 1 本を全員で共有しており、
-- 登録者の AI 利用がすべて運用者の請求になるため。
--
-- 重要: この表だけでは制限にならない。
-- ブラウザ用のキーで Supabase の登録エンドポイントを直接叩けば
-- 画面を通さず登録できるため、Supabase 側の公開サインアップを
-- 無効化したうえで、サーバー側でアカウントを作ること。
-- 詳細は docs/plans/2026-09-03-invitations.md を参照。
-- ============================================================

-- 発行できるのは管理者のみ。招待された人は発行できない
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create table public.invitations (
  id             uuid primary key default gen_random_uuid(),

  -- 平文は保存しない。DB が読まれてもコードとして使えないようにする
  code_hash      text not null unique,

  -- 一覧で見分けるための先頭のみ。全文は発行直後の 1 回しか見せない
  display_prefix text not null default '',

  -- 誰に渡したかのメモ。1 コード 1 人のため、運用上ここが手掛かりになる
  note           text not null default '',

  created_by     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,

  -- 使用済みの記録。used_at が入っている行は二度と使えない
  used_at        timestamptz,
  used_by        uuid references auth.users(id) on delete set null,

  -- 手動で無効にしたとき
  revoked_at     timestamptz
);

-- 照合は「未使用のものを原子的に確保する」1 文で行う。
-- その絞り込みが速いように
create index invitations_open_idx
  on public.invitations (code_hash)
  where used_at is null and revoked_at is null;

create index invitations_created_by_idx
  on public.invitations (created_by, created_at desc);

alter table public.invitations enable row level security;

-- 管理者だけが自分の発行したコードを読み書きできる。
-- 登録時の照合はサービスロールで行うため RLS を通らない
create policy invitations_admin_select on public.invitations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

create policy invitations_admin_insert on public.invitations
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

create policy invitations_admin_update on public.invitations
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );
