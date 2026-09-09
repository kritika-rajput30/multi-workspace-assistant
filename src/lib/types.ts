// Shared types for the app. Keep DB row shapes and API payloads here.

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  workspace_id: string;
  filename: string;
  content_hash: string;
  n_chunks: number;
  created_at: string;
}

export interface ChunkMatch {
  id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

export interface Citation {
  filename: string;
  chunk_index: number;
  similarity: number;
}

export interface MessageRow {
  id: string;
  workspace_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface ToolCallRow {
  id: string;
  workspace_id: string;
  message_id: string | null;
  tool_name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status: 'ok' | 'error' | 'rejected';
  error: string | null;
  created_at: string;
}

// What answerQuestion() returns to the chat route.
export interface AnswerResult {
  answer: string;
  citations: Citation[];
  toolCalls: {
    tool_name: string;
    arguments: Record<string, unknown>;
    result: unknown;
    status: 'ok' | 'error' | 'rejected';
    error?: string;
  }[];
  // Stretch: expose what retrieval saw so the UI can prove isolation.
  debug?: {
    workspaceId: string;
    retrieved: ChunkMatch[];
  };
}
