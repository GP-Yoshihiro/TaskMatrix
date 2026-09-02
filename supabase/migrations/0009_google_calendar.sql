-- ============================================================
-- Google カレンダー連携
--
-- 要求する権限は calendar.app.created（このアプリが作ったカレンダーのみ）。
-- 利用者の既存の予定はアプリから見ることすらできない。
-- 詳細は docs/specs/2026-09-02-google-calendar-design.md を参照。
-- ============================================================

create table public.google_connections (
  id            uuid primary key default gen_random_uuid(),

  -- 利用者ごとに 1 つの接続
  user_id       uuid not null unique references public.profiles(id) on delete cascade,

  -- リフレッシュトークンは AES-256-GCM で暗号化して保存する。
  -- 連携トークン（api_tokens）と違い、実際に Google へ送るため平文が必要で
  -- ハッシュ化できない。鍵はデータベースの外（環境変数）に置く。
  refresh_token_encrypted text not null,

  -- このアプリが作った専用カレンダー。既存のカレンダーには触れない
  calendar_id   text not null default '',

  -- 差分同期の続きを示す印。全件取得を繰り返さないために持つ
  sync_token    text not null default '',

  connected_at   timestamptz not null default now(),
  last_synced_at timestamptz
);

-- 予定と Google の予定の対応付け。未反映なら null
alter table public.schedules
  add column google_event_id text;

create index schedules_google_event_idx
  on public.schedules (google_event_id)
  where google_event_id is not null;

-- ============================================================
-- 行レベルセキュリティ
-- ============================================================

alter table public.google_connections enable row level security;

create policy google_connections_all_own on public.google_connections
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
