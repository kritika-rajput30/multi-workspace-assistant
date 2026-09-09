import { genai, EMBED_MODEL } from './gemini';

// Embeds one or many texts with Gemini. Returns one number[] per input,
// in order. text-embedding-004 => 768 dims (matches vector(768) in schema.sql).
//
// This is plumbing, not the graded part — but two things to get right:
//   1. Batch. Don't call the API once per chunk.
//   2. The query embedding and the chunk embeddings must come from the SAME
//      model, or cosine distance is meaningless.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await genai.models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
  });

  const vectors = res.embeddings?.map((e) => e.values ?? []) ?? [];
  if (vectors.length !== texts.length) {
    throw new Error(`embedding count mismatch: got ${vectors.length}, want ${texts.length}`);
  }
  return vectors;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
