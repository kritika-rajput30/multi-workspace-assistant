import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ToolContext, ToolDef } from './index';

// save_task — the tool with a REAL side effect recorded in the active workspace.
// (The exercise requires at least one such tool.)

const schema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  due_date: z.string().optional(), // ISO date; keep loose for v1
});

export const saveTask: ToolDef<typeof schema> = {
  name: 'save_task',
  description:
    'Save a task/todo into the current workspace. Use when the user asks to remember, track, or create a task or action item.',
  schema,
  // JSON schema the model sees. Keep in sync with `schema` above.
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short task title' },
      notes: { type: 'string', description: 'Optional detail' },
      due_date: { type: 'string', description: 'Optional ISO date (YYYY-MM-DD)' },
    },
    required: ['title'],
  },
  async execute(args, ctx: ToolContext) {
    // TODO(interview): INSERT into a `tasks` table (add it to schema.sql) with
    // ctx.workspaceId. Return { id, title }. Never trust args before this point
    // — runTool() has already validated them against `schema`.
    void createAdminClient;
    void args;
    void ctx;
    throw new Error('save_task.execute not implemented');
  },
};
