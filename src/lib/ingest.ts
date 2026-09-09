// ============================================================================
// INGESTION  —  build this during the interview.
// ============================================================================
// Called by POST /api/upload, synchronously (no queue for this exercise).
//
// Steps:
//   1. Extract text from the upload:
//        - text/plain, text/markdown  -> buffer.toString('utf8')
//        - application/pdf            -> pdf-parse (v2: `import { pdf } from 'pdf-parse'`,
//                                       then `(await pdf(buffer)).text`)
//   2. content_hash = sha256(extracted text). This is the idempotency key.
//   3. INSERT into documents (workspace_id, filename, content_hash).
//        - The UNIQUE (workspace_id, content_hash) constraint makes a re-upload
//          fail with code 23505 — catch that and return "already ingested",
//          NOT an error. That's what "ingestion is idempotent" means.
//   4. chunkText(text) -> RawChunk[].
//   5. embedTexts(chunks.map(c => c.content)) -> vectors (batched).
//   6. Bulk INSERT into chunks (workspace_id, document_id, filename,
//      chunk_index, content, embedding).
//   7. UPDATE documents SET n_chunks.
//   8. If any step after (3) throws, delete the half-ingested document row so a
//      retry starts clean (or wrap 3-7 so the doc row is only committed on
//      success).
//
// Every insert here carries workspace_id explicitly (admin client bypasses RLS).

import { createHash } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
import { chunkText } from './chunking';
import { embedTexts } from './embeddings';

export interface IngestInput {
  workspaceId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}

export interface IngestResult {
  documentId: string;
  filename: string;
  nChunks: number;
  status: 'ingested' | 'already_present';
}

export async function ingestDocument(_input: IngestInput): Promise<IngestResult> {
  // TODO(interview): implement the pipeline above.
  void createHash;
  void createAdminClient;
  void chunkText;
  void embedTexts;
  throw new Error('ingestDocument not implemented');
}
