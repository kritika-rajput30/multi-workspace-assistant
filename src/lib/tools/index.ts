// ============================================================================
// TOOL REGISTRY + SAFE DISPATCH
// ============================================================================
// "Safe tool execution" is on the quality bar. The shape here gives you:
//   - a fixed allow-list of tools (model can't invoke anything else);
//   - schema validation of args BEFORE execute() runs;
//   - graceful handling of unknown tool / bad args (returns a 'rejected'
//     result the model can see — never throws out of the loop, never crashes).
//
// You still implement each tool's execute() and the getToolDeclarations() /
// runTool() bodies during the interview — see the TODOs.

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
  schema: S; // zod — used to validate args before execute
  parameters: Record<string, unknown>; // JSON schema — what the model sees
  execute(args: z.infer<S>, ctx: ToolContext): Promise<unknown>;
}

// The allow-list. Add tools here and nowhere else.
export const TOOLS: Record<string, ToolDef> = {
  [saveTask.name]: saveTask as ToolDef,
  [sendSummary.name]: sendSummary as ToolDef,
};

export interface ToolOutcome {
  tool_name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status: 'ok' | 'error' | 'rejected';
  error?: string;
}

// Shape the model needs: [{ functionDeclarations: [{ name, description, parameters }] }]
export function getToolDeclarations() {
  // TODO(interview): map TOOLS -> functionDeclarations for @google/genai.
  throw new Error('getToolDeclarations not implemented');
}

// Validate + run one tool call. MUST NOT throw — always returns a ToolOutcome.
export async function runTool(
  _name: string,
  _rawArgs: unknown,
  _ctx: ToolContext,
): Promise<ToolOutcome> {
  // TODO(interview):
  //   1. tool = TOOLS[name]; if !tool -> { status: 'rejected', error: 'unknown tool' }
  //   2. parsed = tool.schema.safeParse(rawArgs);
  //      if !parsed.success -> { status: 'rejected', error: <zod message> }
  //   3. try { result = await tool.execute(parsed.data, ctx); status 'ok' }
  //      catch (e) { status 'error', error: e.message }
  //   4. (route handler persists this to tool_calls)
  throw new Error('runTool not implemented');
}
