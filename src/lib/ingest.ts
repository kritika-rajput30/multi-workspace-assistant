// ============================================================================
// INGESTION  (synchronous — no queue for this exercise)
// ============================================================================
// text/markdown -> utf8. application/pdf -> unpdf (getDocumentProxy + extractText),
// a serverless-safe pdf.js build (no DOMMatrix / DOM globals needed).
//
// content_hash = sha256(extracted text) is the idempotency key: the UNIQUE
// (workspace_id, content_hash) constraint turns a re-upload into a no-op
// instead of duplicate chunks or a 500. If chunk/embed/insert fails after the
// document row exists, we delete that row so a retry starts clean.
//
// Every insert carries workspace_id explicitly (admin client bypasses RLS).

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

async function extractText(input: IngestInput): Promise<string> {
  const { mimeType, bytes, filename } = input;
  const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    // Dynamic import: keep the pdf.js bundle out of the module graph for the
    // common text/markdown path.
    const { getDocumentProxy, extractText: extract } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extract(pdf, { mergePages: true });
    return text ?? '';
  }
  return bytes.toString('utf8');
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const { workspaceId, filename } = input;
  const admin = createAdminClient();

  const text = (await extractText(input)).trim();
  if (!text) throw new Error('no extractable text in upload');

  const contentHash = createHash('sha256').update(text).digest('hex');

  // Idempotency: if this exact content is already in this workspace, stop.
  const { data: existing } = await admin
    .from('documents')
    .select('id, n_chunks')
    .eq('workspace_id', workspaceId)
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (existing) {
    return {
      documentId: existing.id,
      filename,
      nChunks: existing.n_chunks,
      status: 'already_present',
    };
  }

  const { data: doc, error: docErr } = await admin
    .from('documents')
    .insert({ workspace_id: workspaceId, filename, content_hash: contentHash })
    .select('id')
    .single();

  // 23505 = unique_violation: another request ingested the same file in a race.
  if (docErr) {
    if (docErr.code === '23505') {
      const { data: race } = await admin
        .from('documents')
        .select('id, n_chunks')
        .eq('workspace_id', workspaceId)
        .eq('content_hash', contentHash)
        .single();
      return {
        documentId: race!.id,
        filename,
        nChunks: race!.n_chunks,
        status: 'already_present',
      };
    }
    throw new Error(`document insert failed: ${docErr.message}`);
  }

  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error('chunker produced 0 chunks');

    const vectors = await embedTexts(chunks.map((c) => c.content));

    const rows = chunks.map((c, i) => ({
      workspace_id: workspaceId,
      document_id: doc.id,
      filename,
      chunk_index: c.index,
      content: c.content,
      embedding: vectors[i],
    }));

    const { error: chunkErr } = await admin.from('chunks').insert(rows);
    if (chunkErr) throw new Error(`chunk insert failed: ${chunkErr.message}`);

    await admin.from('documents').update({ n_chunks: chunks.length }).eq('id', doc.id);

    return { documentId: doc.id, filename, nChunks: chunks.length, status: 'ingested' };
  } catch (err) {
    // Roll back the half-ingested document so a retry is clean.
    await admin.from('documents').delete().eq('id', doc.id);
    throw err;
  }
}
