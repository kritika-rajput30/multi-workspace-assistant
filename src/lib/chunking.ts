// ============================================================================
// CHUNKING  —  build this during the interview.
// ============================================================================
// This is a graded decision. Be ready to explain your choices in AI_NOTES.md.
//
// A reasonable v1:
//   - Normalise whitespace first.
//   - Split on paragraph boundaries (blank lines), then pack paragraphs into
//     windows of ~800 tokens (~3200 chars) with ~100 token (~400 char) overlap.
//   - Never cut mid-sentence if you can help it.
//   - Keep the source offset / a heading trail on each chunk so citations can
//     point at "filename § section", not just the filename.
//
// Why these numbers: small enough that a retrieved chunk is mostly relevant
// signal (keeps the LLM context tight and grounded), big enough to hold a
// complete thought. Overlap stops an answer that straddles a boundary from
// being lost.
//
// Gotchas:
//   - PDFs extract with hard line breaks mid-sentence — join lines that don't
//     end in sentence punctuation before splitting.
//   - Token != char. If you want real token counts, count with a tokeniser;
//     otherwise the ~4 chars/token rule of thumb is fine for this exercise.

export interface RawChunk {
  index: number;
  content: string;
  // Optional breadcrumb for nicer citations, e.g. "Introduction > Setup".
  section?: string;
}

export interface ChunkOptions {
  targetChars?: number; // default ~3200
  overlapChars?: number; // default ~400
}

export function chunkText(_text: string, _opts: ChunkOptions = {}): RawChunk[] {
  // TODO(interview): implement.
  throw new Error('chunkText not implemented');
}
