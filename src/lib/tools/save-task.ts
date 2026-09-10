import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ToolContext, ToolDef } from './index';

// save_task — the tool with a REAL side effect recorded in the active workspace.
// Writes a row to `tasks` (see supabase/schema.sql), scoped to ctx.workspaceId.

const schema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  due_date: z.string().optional(), // ISO date; kept loose for v1
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
    // args are already validated by runTool() against `schema`.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('tasks')
      .insert({
        workspace_id: ctx.workspaceId,
        title: args.title,
        notes: args.notes ?? null,
        due_date: args.due_date ?? null,
      })
      .select('id, title, created_at')
      .single();

    if (error) throw new Error(`could not save task: ${error.message}`);
    return { saved: true, task: data };
  },
};
