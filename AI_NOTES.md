# AI_NOTES

> Fill this in as you build. The prompt says this is the part they read most
> closely — be specific and honest. Keep it to ~1 page.

## Tools & models used

- Editor / assistant: <e.g. Claude Code, Cursor> with <model>.
- How work was split: <what you drove vs what the AI drove — e.g. "AI scaffolded
  the Next.js + Supabase boilerplate and the tool-registry shape; I wrote the
  retrieval query, the grounding prompt, and the tool loop, and made the
  isolation and chunking calls myself.">

## Key decisions I made (and why)

1. **Chunking**: <size / overlap / split strategy and the reasoning>.
2. **Scoping retrieval to a workspace**: filter inside `match_chunks` (SQL
   function) on `workspace_id`, plus RLS as a second layer. Chose this over a
   client-side `.filter()` because a single forgotten filter is a cross-tenant
   leak — it has to live at the lowest layer, not in app code.
3. **Tool-calling loop**: <how you structured it — allow-list registry, zod
   validation before execute, iteration cap, how tool results are fed back>.
4. **Service choice**: <e.g. Supabase over Neon because Auth + pgvector + DB in
   one no-card project reduced moving parts under time pressure>.

## Hardest bug / wrong turn the AI led me into

<Be concrete. What did it get wrong, how did you notice, how did you fix it?
Examples of the kind of thing worth writing up:
 - embedding dimension mismatch between model and `vector(N)` column;
 - the model's tool args passing zod but the DB rejecting them;
 - retrieval returning cross-workspace rows because a filter was applied after
   the RPC instead of inside it;
 - `pdf-parse` v2 API differs from the v1 examples the AI produced;
 - RLS blocking the service-role path, or vice versa.>

## What I'd improve with more time

- Move ingestion to a background job (queue) so uploads return immediately.
- Hybrid search (keyword + vector) + a re-ranking step.
- Stream the answer token-by-token.
- Retrieval-debug view in the UI to visibly prove isolation.
- Per-request token counts + latency in the tool log.
