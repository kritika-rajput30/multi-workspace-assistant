// ============================================================================
// TOOL REGISTRY + SAFE DISPATCH
// ============================================================================
// "Safe tool execution" is on the quality bar:
//   - a fixed allow-list (TOOLS) — the model can't invoke anything else;
//   - zod validation of args BEFORE execute() runs;
//   - unknown tool / bad args -> a 'rejected' outcome the model can see;
//   - execute() throwing -> an 'error' outcome. runTool() NEVER throws.

import type { z } from 'zod';
import { saveTask } from './save-task';
import { sendSummary } from './send-summary';

export interface ToolContext {
  workspaceId: string;
  userId: string;
}

export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S; // zod — validates args before execute
  parameters: Record<string, unknown>; // JSON schema — what the model sees
  execute(args: z.infer<S>, ctx: ToolContext): Promise<unknown>;
}

// The allow-list. Add tools here and nowhere else.
export const TOOLS: Record<string, ToolDef> = {
  [saveTask.name]: saveTask as unknown as ToolDef,
  [sendSummary.name]: sendSummary as unknown as ToolDef,
};

export interface ToolOutcome {
  tool_name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status: 'ok' | 'error' | 'rejected';
  error?: string;
}

// Function declarations for @google/genai: one entry per tool. `parametersJsonSchema`
// lets us hand plain JSON Schema straight through.
export function getToolDeclarations() {
  return [
    {
      functionDeclarations: Object.values(TOOLS).map((t) => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.parameters,
      })),
    },
  ];
}

// Validate + run one tool call. Always resolves to a ToolOutcome — never throws.
export async function runTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  const tool = TOOLS[name];

  if (!tool) {
    return {
      tool_name: name,
      arguments: args,
      result: null,
      status: 'rejected',
      error: `unknown tool: ${name}`,
    };
  }

  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      tool_name: name,
      arguments: args,
      result: null,
      status: 'rejected',
      error: `invalid arguments: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    };
  }

  try {
    const result = await tool.execute(parsed.data, ctx);
    return {
      tool_name: name,
      arguments: parsed.data as Record<string, unknown>,
      result,
      status: 'ok',
    };
  } catch (err) {
    return {
      tool_name: name,
      arguments: parsed.data as Record<string, unknown>,
      result: null,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
