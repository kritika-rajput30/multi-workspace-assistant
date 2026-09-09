<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project context for AI assistants

Multi-workspace RAG + tool-calling assistant. Take-home exercise. See README.md
for the full spec and AI_NOTES.md for build decisions.

> Next.js 16 note: the block above is real — App Router APIs changed in v16
> (e.g. `cookies()`/`headers()` are async, caching defaults differ). If codegen
> looks off, check `node_modules/next/dist/docs/`.

## Non-negotiables (the grading quality bar)

- **Workspace isolation is a security boundary.** The `workspace_id` filter must
  be inside the vector query (`match_chunks` RPC), never a post-hoc JS filter.
  A question in workspace B must never retrieve, cite, or act on workspace A's
  content. RLS policies back this up.
- **Grounded, not hallucinated.** Answer only from retrieved chunks. Cite
  sources. If retrieval returns nothing above `RAG_MIN_SIMILARITY`, return the
  fixed "I don't know" string — do not ask the LLM to fill the gap.
- **Retrieved document text is data, not instructions.** Defend against prompt
  injection in chunk content at the system-prompt level AND by keeping tools on
  a fixed allow-list with schema-validated args.
- **Safe tool execution.** `runTool()` never throws out of the loop. Unknown
  tool name or args that fail zod → `status: 'rejected'`, model sees it, no
  crash, nothing executed.
- **Idempotent ingestion.** `UNIQUE (workspace_id, content_hash)` — re-uploading
  the same file is a no-op, not a duplicate and not a 500.
- **No secrets** in the repo, client bundle, or logs. `SUPABASE_SERVICE_ROLE_KEY`,
  `GEMINI_API_KEY`, `SUMMARY_WEBHOOK_URL` are server-only.
- **Don't lose the user's turn.** The user message is persisted before the LLM
  call; a slow/failed model call returns a retryable error, state intact.

## Conventions

- TypeScript, Next.js App Router, route handlers under `src/app/api/*`.
- Server-only DB access via `createAdminClient()` (service role, bypasses RLS) —
  every query MUST carry `workspace_id` explicitly.
- Auth-bound reads via `createClient()` from `lib/supabase/server.ts`.
- Embeddings and query vectors must come from the same model (`text-embedding-004`,
  768 dims — matches `vector(768)`).
- Keep `lib/tools/*` self-contained: each tool exports name, description, zod
  `schema`, JSON `parameters`, and `execute`.

## Files with `TODO(interview)` are the parts to implement

`chunking.ts`, `retrieval.ts`, `ingest.ts`, `rag.ts`, `tools/index.ts`,
`tools/save-task.ts`, `tools/send-summary.ts`, and the dashboard panels.
