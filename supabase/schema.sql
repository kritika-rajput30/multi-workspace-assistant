-- ============================================================================
-- Multi-Workspace Document Assistant — database schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ============================================================================

-- pgvector extension (Supabase ships it; just enable it).
create extension if not exists vector;

-- ----------------------------------------------------------------------------
-- workspaces: each user owns one or more. All uploads + chat are scoped to one.
-- ----------------------------------------------------------------------------
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists workspaces_owner_idx on workspaces (owner_id);

-- ----------------------------------------------------------------------------
-- documents: one row per uploaded file, tagged with its workspace.
-- content_hash makes ingestion idempotent (re-upload = no-op).
-- ----------------------------------------------------------------------------
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  filename      text not null,
  content_hash  text not null,
  n_chunks      int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (workspace_id, content_hash)      -- same file, same workspace -> reject dup
);
create index if not exists documents_workspace_idx on documents (workspace_id);

-- ----------------------------------------------------------------------------
-- chunks: THE shared vector store. Every workspace's chunks live in this ONE
-- table. Isolation is enforced by filtering on workspace_id INSIDE the query
-- (see match_chunks below) — never after the fact in app code.
-- ----------------------------------------------------------------------------
create table if not exists chunks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  document_id   uuid not null references documents (id) on delete cascade,
  filename      text not null,           -- denormalised for cheap citations
  chunk_index   int  not null,
  content       text not null,
  -- Gemini text-embedding-004 / gemini-embedding-001 output dim = 768.
  embedding     vector(768) not null,
  created_at    timestamptz not null default now()
);
create index if not exists chunks_workspace_idx on chunks (workspace_id);

-- Approximate NN index. The WHERE workspace_id = ... filter is applied by the
-- planner alongside this index scan, so search stays scoped and fast.
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- messages: chat history per workspace.
-- ----------------------------------------------------------------------------
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  citations     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists messages_workspace_idx on messages (workspace_id, created_at);

-- ----------------------------------------------------------------------------
-- tool_calls: log of every tool the model invoked, for the dashboard.
-- ----------------------------------------------------------------------------
create table if not exists tool_calls (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  message_id    uuid references messages (id) on delete set null,
  tool_name     text not null,
  arguments     jsonb not null,
  result        jsonb,
  status        text not null check (status in ('ok', 'error', 'rejected')),
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists tool_calls_workspace_idx on tool_calls (workspace_id, created_at);

-- ----------------------------------------------------------------------------
-- tasks: written by the save_task tool. The "real side effect in the active
-- workspace" the exercise asks for.
-- ----------------------------------------------------------------------------
create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  title         text not null,
  notes         text,
  due_date      text,
  done          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists tasks_workspace_idx on tasks (workspace_id, created_at);

-- ============================================================================
-- match_chunks: workspace-scoped similarity search.
-- The p_workspace_id filter is part of the query itself. A caller can only ever
-- get back chunks from the workspace they pass in.
-- ============================================================================
create or replace function match_chunks (
  p_workspace_id  uuid,
  p_query_embedding vector(768),
  p_match_count   int default 6
)
returns table (
  id           uuid,
  document_id  uuid,
  filename     text,
  chunk_index  int,
  content      text,
  similarity   float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.filename,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from chunks c
  where c.workspace_id = p_workspace_id          -- <<< the isolation boundary
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- ============================================================================
-- Row Level Security — defence in depth. Even if a query forgets its filter,
-- Postgres will not return another user's rows.
-- ============================================================================
alter table workspaces enable row level security;
alter table documents  enable row level security;
alter table chunks     enable row level security;
alter table messages   enable row level security;
alter table tool_calls enable row level security;
alter table tasks      enable row level security;

-- drop-then-create makes this file safe to paste and run more than once
-- (Postgres has no "create policy if not exists").
drop policy if exists "own workspaces" on workspaces;
create policy "own workspaces" on workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "own documents" on documents;
create policy "own documents" on documents
  for all using (exists (select 1 from workspaces w where w.id = documents.workspace_id and w.owner_id = auth.uid()));

drop policy if exists "own chunks" on chunks;
create policy "own chunks" on chunks
  for all using (exists (select 1 from workspaces w where w.id = chunks.workspace_id and w.owner_id = auth.uid()));

drop policy if exists "own messages" on messages;
create policy "own messages" on messages
  for all using (exists (select 1 from workspaces w where w.id = messages.workspace_id and w.owner_id = auth.uid()));

drop policy if exists "own tool_calls" on tool_calls;
create policy "own tool_calls" on tool_calls
  for all using (exists (select 1 from workspaces w where w.id = tool_calls.workspace_id and w.owner_id = auth.uid()));

drop policy if exists "own tasks" on tasks;
create policy "own tasks" on tasks
  for all using (exists (select 1 from workspaces w where w.id = tasks.workspace_id and w.owner_id = auth.uid()));

-- NOTE: the API routes use the service-role key (bypasses RLS), so they MUST
-- still pass workspace_id explicitly on every query. RLS is the safety net,
-- not the primary control. If you query from the client with the anon key,
-- RLS is the primary control.
