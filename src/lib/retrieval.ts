// ============================================================================
// RETRIEVAL  —  THE ISOLATION BOUNDARY
// ============================================================================
// The workspace filter is part of the vector search itself: match_chunks()
// (see supabase/schema.sql) runs `WHERE workspace_id = p_workspace_id` inside
// the same query that orders by embedding distance. We never fetch chunks and
// filter in JS — one forgotten filter there is a cross-tenant leak, so it lives
// at the lowest layer. The RLS policies on `chunks` are the second line of
// defence.
//
//   1. embedOne(question)  -> query vector (SAME model + dim as ingestion).
//   2. rpc('match_chunks', { p_workspace_id, p_query_embedding, p_match_count }).
//   3. Drop rows below RAG_MIN_SIMILARITY -> powers an honest "I don't know"
//      when the workspace has nothing relevant.

import { createAdminClient } from './supabase/admin';
import { embedOne } from './embeddings';
import type { ChunkMatch } from './types';

const MATCH_COUNT = Number(process.env.RAG_MATCH_COUNT ?? 6);
const MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY ?? 0.35);

export async function retrieveChunks(
  workspaceId: string,
  question: string,
  matchCount: number = MATCH_COUNT,
): Promise<ChunkMatch[]> {
  const queryEmbedding = await embedOne(question);

  const admin = createAdminClient();
  // supabase-js passes the number[] straight through; pgvector accepts the
  // JSON array form "[1,2,3]" as its text input.
  const { data, error } = await admin.rpc('match_chunks', {
    p_workspace_id: workspaceId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });

  if (error) throw new Error(`retrieval failed: ${error.message}`);

  const rows = (data ?? []) as ChunkMatch[];
  return rows.filter((r) => r.similarity >= MIN_SIMILARITY);
}
