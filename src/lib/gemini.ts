import { GoogleGenAI } from '@google/genai';

// Single shared Gemini client (chat + tool calling + embeddings all go through
// the same @google/genai SDK).
export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.0-flash';
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? 'text-embedding-004';

// Quick reference for the interview — @google/genai v2 shapes:
//
//   const res = await genai.models.generateContent({
//     model: CHAT_MODEL,
//     contents: [{ role: 'user', parts: [{ text: '...' }] }],
//     config: {
//       systemInstruction: '...',
//       tools: [{ functionDeclarations: [ ...schemas ] }],
//     },
//   });
//   res.text                         // plain answer
//   res.functionCalls                // [{ name, args }] when the model wants a tool
//
//   const emb = await genai.models.embedContent({
//     model: EMBED_MODEL,
//     contents: ['chunk text', 'another chunk'],
//   });
//   emb.embeddings[i].values         // number[]
