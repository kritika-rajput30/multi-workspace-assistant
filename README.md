# Multi-Workspace Document Assistant (RAG & Tool Calling)

A web app where a signed-in user has one or more **workspaces**, uploads documents
into the active one, and chats with an assistant that answers **only from that
workspace's documents** (with citations) or honestly says it doesn't know. The
assistant can also **call tools** to take real actions. Every workspace's chunks
live in **one shared vector store**; isolation is enforced inside the query.

## Stack

| Concern            | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| App                | Next.js (App Router, TypeScript) — UI + API routes           |
| Auth               | Supabase Auth (email + password)                             |
| Vector store       | Supabase Postgres + `pgvector`, one `chunks` table           |
| LLM + tool calling | Google Gemini (`@google/genai`), `gemini-2.0-flash`          |
| Embeddings         | Gemini `text-embedding-004` (768-dim)                        |
| Notifications tool | Slack/Discord incoming webhook                               |
| Hosting            | Vercel                                                       |

## Architecture

```
Browser
  │  (Supabase auth cookie)
  ▼
Next.js middleware ── refreshes session, gates /dashboard and /api
  │
  ├─ POST /api/upload   → ingestDocument()  → chunkText → embedTexts → INSERT chunks (workspace_id tagged)
  ├─ POST /api/chat     → answerQuestion()  → retrieveChunks (match_chunks RPC, workspace-scoped)
  │                                          → grounded prompt → Gemini
  │                                          → tool loop: runTool() validates + executes → feed result back
  │                                          → persist message + tool_calls
  └─ GET  /api/workspaces
```

Isolation boundary: `match_chunks(p_workspace_id, p_query_embedding, p_match_count)`
in [`supabase/schema.sql`](supabase/schema.sql) filters on `workspace_id` **inside**
the vector search. RLS policies are a second layer. API routes use the service-role
key and therefore pass `workspace_id` explicitly on every query.

## Run locally

Prereqs: Node 20+, a free Supabase project, a free Gemini API key.

```bash
npm install
cp .env.example .env.local     # then fill in the values
```

1. **Supabase**: create a project → SQL Editor → paste and run
   [`supabase/schema.sql`](supabase/schema.sql). Copy the project URL, anon key,
   and service-role key from Project Settings → API into `.env.local`.
2. **Gemini**: get a key at <https://aistudio.google.com/apikey> → `GEMINI_API_KEY`.
3. **Webhook** (for the `send_summary` tool): create a Slack or Discord incoming
   webhook → `SUMMARY_WEBHOOK_URL`.

```bash
npm run dev        # http://localhost:3000
```

## Environment variables

See [`.env.example`](.env.example). Summary:

| Var                             | Where                          | Secret? |
| ------------------------------- | ------------------------------ | ------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Settings → API      | no      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API      | no      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Settings → API      | **yes** |
| `GEMINI_API_KEY`                | Google AI Studio               | **yes** |
| `GEMINI_CHAT_MODEL`             | default `gemini-2.0-flash`     | no      |
| `GEMINI_EMBED_MODEL`            | default `text-embedding-004`   | no      |
| `SUMMARY_WEBHOOK_URL`           | Slack/Discord                  | **yes** |
| `RAG_MATCH_COUNT`               | default `6`                    | no      |
| `RAG_MIN_SIMILARITY`            | default `0.35`                 | no      |

No secret is in the repo, in client code, or logged.

## Deploy (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add every variable from `.env.example` in Project → Settings → Environment
   Variables (production + preview).
4. In Supabase → Authentication → URL Configuration, add the Vercel domain to
   the allowed redirect URLs.
5. Deploy. The DB is already provisioned (step 1 of "Run locally").

## Testing the isolation case

1. Sign in with the throwaway account (see below).
2. Workspace **A** has a doc containing a distinctive fact
   (`The launch codeword is ORANGE-PANGOLIN.`). Ask: *"What is the launch
   codeword?"* → grounded answer with a citation.
3. Switch to Workspace **B** (different docs). Ask the same question → the
   assistant must say it doesn't know. The codeword must not appear.
4. Optional debug view shows which workspace + chunks each answer used.

Throwaway login: `___@example.com` / `___` (fill in before submitting).
Two workspaces are preloaded with sample docs under [`sample-docs/`](sample-docs/).

## Project layout

```
src/
  middleware.ts                 session refresh + route gate
  app/
    login/page.tsx              email+password auth
    dashboard/                  workspace switcher, docs, chat, tool log
    api/workspaces/route.ts     list / create
    api/upload/route.ts         multipart → ingestDocument()
    api/chat/route.ts           question → answerQuestion(), persists turn
  lib/
    supabase/{client,server,admin,middleware}.ts
    gemini.ts                   shared @google/genai client
    chunking.ts                 text → chunks               [implement]
    embeddings.ts               Gemini embeddings (batched)
    retrieval.ts                workspace-scoped vector search [implement]
    ingest.ts                   upload pipeline               [implement]
    rag.ts                      grounded answer + tool loop   [implement]
    tools/                      registry, save_task, send_summary [implement]
supabase/schema.sql             pgvector schema + match_chunks + RLS
```

See [`AI_NOTES.md`](AI_NOTES.md) for how this was built and the decisions made.
