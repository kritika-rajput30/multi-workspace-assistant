import { genai, EMBED_MODEL, EMBED_DIM } from './gemini';

// Embeds one or many texts with Gemini `gemini-embedding-001`, truncated to
// EMBED_DIM (768) dims to match vector(768) in schema.sql.
//
// This is plumbing, not the graded part — but three things to get right:
//   1. Batch. Don't call the API once per chunk.
//   2. The query embedding and the chunk embeddings must come from the SAME
//      model AND the same outputDimensionality, or cosine distance is
//      meaningless.
//   3. gemini-embedding-001 defaults to 3072 dims — pass outputDimensionality
//      explicitly or every insert into the vector(768) column will fail.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await genai.models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
    config: { outputDimensionality: EMBED_DIM },
  });

  const vectors = res.embeddings?.map((e) => e.values ?? []) ?? [];
  if (vectors.length !== texts.length) {
    throw new Error(`embedding count mismatch: got ${vectors.length}, want ${texts.length}`);
  }
  if (vectors[0]?.length !== EMBED_DIM) {
    throw new Error(`embedding dim mismatch: got ${vectors[0]?.length}, want ${EMBED_DIM}`);
  }
  return vectors;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
