// ============================================================================
// CHUNKING  —  a graded decision. Rationale below (also in AI_NOTES.md).
// ============================================================================
// Strategy:
//   1. Normalise whitespace and repair PDF line-wrapping — join a newline that
//      isn't preceded by sentence punctuation and isn't the start of a list /
//      blank line, so a sentence broken across extracted lines is rejoined.
//   2. Split into paragraphs on blank lines.
//   3. Greedily pack paragraphs into ~TARGET_CHARS windows. A single paragraph
//      bigger than the window is hard-split on sentence boundaries first.
//   4. Carry OVERLAP_CHARS of the previous window's tail into the next window
//      so an answer that straddles a boundary is still retrievable.
//
// Sizing: ~4 chars/token rule of thumb, so a ~900 char target ≈ 225 tokens —
// small enough that a retrieved chunk is mostly relevant signal (tight, grounded
// context), big enough to hold a complete thought. Overlap stops a boundary-
// straddling answer from being lost.

export interface RawChunk {
  index: number;
  content: string;
  // Optional breadcrumb for nicer citations, e.g. "Introduction > Setup".
  section?: string;
}

export interface ChunkOptions {
  targetChars?: number;
  overlapChars?: number;
}

const TARGET_CHARS = 900;
const OVERLAP_CHARS = 150;
const HARD_MAX = 1600; // never emit a chunk longer than this

function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    // join hard-wrapped lines: a newline NOT preceded by sentence punctuation
    // and NOT followed by a blank line / list marker becomes a space.
    .replace(/([^\n.!?:;])\n(?!\n|\s*[-*•\d])/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(s: string): string[] {
  const parts = s.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return parts ? parts.map((p) => p.trim()).filter(Boolean) : [s];
}

function tail(s: string, n: number): string {
  if (s.length <= n) return s;
  const slice = s.slice(-n);
  const sp = slice.indexOf(' ');
  return sp > 0 ? slice.slice(sp + 1) : slice;
}

export function chunkText(input: string, opts: ChunkOptions = {}): RawChunk[] {
  const target = opts.targetChars ?? TARGET_CHARS;
  const overlap = opts.overlapChars ?? OVERLAP_CHARS;

  const text = normalise(input);
  if (!text) return [];

  // Explode paragraphs, pre-splitting any oversized paragraph into sentences.
  const units: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= HARD_MAX) {
      units.push(p);
      continue;
    }
    let buf = '';
    for (const sent of splitSentences(p)) {
      if (buf && (buf + ' ' + sent).length > target) {
        units.push(buf);
        buf = sent;
      } else {
        buf = buf ? buf + ' ' + sent : sent;
      }
    }
    if (buf) units.push(buf);
  }

  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    const candidate = current ? current + '\n\n' + unit : unit;
    if (candidate.length > target && current) {
      chunks.push(current);
      current = (overlap > 0 ? tail(current, overlap) + '\n\n' : '') + unit;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current);

  return chunks.map((content, index) => ({ index, content: content.trim() }));
}
