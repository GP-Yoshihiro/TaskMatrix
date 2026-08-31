-- ============================================================
-- AI の使用量と所要時間の記録
--
-- 「残りトークン量」は保持しない。Google がその値を公開していないため
-- （モデル情報は 1 リクエストの上限を返すだけで、残高に相当する項目が無い）。
-- ここに溜まるのは実際に使った量だけである。
-- ============================================================

create table public.ai_usage_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,

  -- プロジェクトを消しても使用量の記録は残す
  project_id    uuid references public.projects(id) on delete set null,

  operation     text not null
                  check (operation in (
                    'extract_tasks', 'plan_schedule', 'answer_question', 'build_index'
                  )),

  -- 実際に応答したモデル。フォールバックが働いた場合はその結果を入れる
  model         text not null default '',

  input_tokens  integer not null default 0 check (input_tokens  >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),

  -- 送った文字数。埋め込みはトークン数を返さないため、その代替指標として使う
  input_chars   integer not null default 0 check (input_chars   >= 0),

  duration_ms   integer not null default 0 check (duration_ms   >= 0),

  -- 失敗してもトークンは消費される。記録しないと使用量が実態より少なく見えるので残す。
  -- ただし失敗時は応答が無くトークン数が分からないため 0 が入る。
  status        text not null check (status in ('succeeded', 'failed')),
  error_code    text not null default '',

  created_at    timestamptz not null default now()
);

-- 履歴ページ（新しい順の一覧・今月の集計）
create index ai_usage_logs_user_idx
  on public.ai_usage_logs (user_id, created_at desc);

-- 予測時間の算出（機能ごとの直近の成功実績）
create index ai_usage_logs_estimate_idx
  on public.ai_usage_logs (user_id, operation, created_at desc)
  where status = 'succeeded';

-- ============================================================
-- 行レベルセキュリティ
--
-- 追記のみとし、update / delete のポリシーは作らない。
-- 使用量の記録を後から書き換えられると、記録そのものの意味が失われるため。
-- ============================================================

alter table public.ai_usage_logs enable row level security;

create policy ai_usage_logs_select_own on public.ai_usage_logs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy ai_usage_logs_insert_own on public.ai_usage_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()));
