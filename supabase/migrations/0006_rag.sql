-- ============================================================
-- TaskMatrix 第4フェーズ RAG チャット
-- ============================================================

-- pgvector を有効化する。
-- 次元数 768 は固定長のため、変更するにはテーブルの作り直しが必要。
create extension if not exists vector with schema extensions;

create table public.file_chunks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  file_id      uuid not null references public.files(id) on delete cascade,
  file_version integer not null,
  chunk_index  integer not null,
  content      text not null,
  embedding    extensions.vector(768),
  created_at   timestamptz not null default now(),
  unique (file_id, file_version, chunk_index)
);

create index file_chunks_project_idx on public.file_chunks (project_id);
create index file_chunks_file_idx    on public.file_chunks (file_id);
create index file_chunks_embedding_idx
  on public.file_chunks using hnsw (embedding extensions.vector_cosine_ops);

create table public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title      text not null default '',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_sessions_project_idx
  on public.chat_sessions (project_id, updated_at desc);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  sources    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_session_idx
  on public.chat_messages (session_id, created_at);

-- ============================================================
-- 行レベルセキュリティ
-- サブクエリで projects を結合するため、外側の列はテーブル名で修飾する
-- ============================================================

alter table public.file_chunks   enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy file_chunks_all_own on public.file_chunks
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = file_chunks.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = file_chunks.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy chat_sessions_all_own on public.chat_sessions
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = chat_sessions.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = chat_sessions.project_id and p.owner_id = (select auth.uid())
    )
  );

create policy chat_messages_all_own on public.chat_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.chat_sessions s
      join public.projects p on p.id = s.project_id
      where s.id = chat_messages.session_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      join public.projects p on p.id = s.project_id
      where s.id = chat_messages.session_id and p.owner_id = (select auth.uid())
    )
  );

-- ============================================================
-- 近傍検索
--
-- ⚠️ security invoker にすること。
-- security definer にすると RLS を迂回し、他人のチャンクを返してしまう。
-- ============================================================

create function public.match_file_chunks(
  target_project_id uuid,
  query_embedding extensions.vector(768),
  match_count integer
)
returns table (
  id uuid,
  file_id uuid,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.file_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.file_chunks c
  where c.project_id = target_project_id
    and c.embedding is not null
  order by c.embedding operator(extensions.<=>) query_embedding
  limit greatest(1, least(match_count, 20));
$$;

revoke execute on function
  public.match_file_chunks(uuid, extensions.vector, integer) from public;
grant execute on function
  public.match_file_chunks(uuid, extensions.vector, integer) to authenticated;
