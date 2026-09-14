-- ============================================================
-- タスクの想定日程（何日かかるか）
--
-- 0.5 日刻みで持つ。半日で終わる作業を 1 日と数えずに済み、
-- 時間単位ほど入力の負担が増えない。
--
-- 出どころ（estimate_source）を必ず添える。
-- 資料に書かれていた数値と、作業内容からの推定を見分けられないと、
-- 根拠のない数字を書かれていた値として信じてしまう。
-- ============================================================

alter table public.tasks
  add column if not exists estimated_days numeric(5, 1)
    check (estimated_days is null or (estimated_days > 0 and estimated_days <= 365)),

  add column if not exists estimate_source text not null default ''
    check (estimate_source in ('', 'document', 'inferred'));

comment on column public.tasks.estimated_days is
  '想定日程。0.5 日刻み。null なら未設定';

comment on column public.tasks.estimate_source is
  'document=資料に書かれていた / inferred=作業内容からの推定 / 空=手入力または未設定';
