// ============================================================================
// RETRIEVAL  —  build this during the interview.  THIS IS THE ISOLATION TEST.
// ============================================================================
// The rule: the workspace filter must be part of the vector search itself, not
// applied to the results afterwards. schema.sql already gives you the
// match_chunks(p_workspace_id, p_query_embedding, p_match_count) RPC that does
// exactly this. Call it. Do NOT: fetch all chunks then .filter() in JS.
//
// Steps:
//   1. embedOne(question)  -> query vector (same model as ingestion).
//   2. admin.rpc('match_chunks', { p_workspace_id, p_query_embedding, p_match_count }).
//   3. Drop rows below RAG_MIN_SIMILARITY — this is what powers an honest
//      "I don't know" when the workspace has nothing relevant.
//   4. Return ChunkMatch[] (already ordered by similarity).
//
// Be ready to explain: why the RPC and not a client-side filter (a forgotten
// filter = cross-tenant data leak, so it must live at the lowest layer), and
// how RLS backs it up.

import { createAdminClient } from './supabase/admin';
import { embedOne } from './embeddings';
import type { ChunkMatch } from './types';

const MATCH_COUNT = Number(process.env.RAG_MATCH_COUNT ?? 6);
const MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY ?? 0.35);

export async function retrieveChunks(
  _workspaceId: string,
  _question: string,
  _matchCount: number = MATCH_COUNT,
): Promise<ChunkMatch[]> {
  // TODO(interview): implement using match_chunks RPC + MIN_SIMILARITY gate.
  void createAdminClient;
  void embedOne;
  void MIN_SIMILARITY;
  throw new Error('retrieveChunks not implemented');
}
