import { z } from 'zod';
import type { ToolContext, ToolDef } from './index';

// send_summary — posts a short summary to a Slack/Discord incoming webhook.
//
// SUMMARY_WEBHOOK_URL is a server-only secret. It is never passed in by the
// model or the client, and never logged. If it is unset we "mock" the send —
// log the text (not the URL) and return { delivered: true, mocked: true } — so
// the tool still fires end-to-end and shows up in the tool-call log. Non-2xx
// responses become a thrown Error that runTool() turns into a clean 'error'
// outcome (no raw fetch error escapes to the caller).

const schema = z.object({
  summary: z.string().min(1).max(3000),
});

export const sendSummary: ToolDef<typeof schema> = {
  name: 'send_summary',
  description:
    'Send a short summary of the conversation or an answer to the team channel. Use only when the user explicitly asks to share or post something.',
  schema,
  parameters: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'The text to post to the channel' },
    },
    required: ['summary'],
  },
  async execute(args, ctx: ToolContext) {
    const url = process.env.SUMMARY_WEBHOOK_URL;

    if (!url) {
      console.log(`[send_summary MOCK] workspace=${ctx.workspaceId} :: ${args.summary}`);
      return { delivered: true, mocked: true };
    }

    const isDiscord = url.includes('discord.com') || url.includes('discordapp.com');
    const body = isDiscord ? { content: args.summary } : { text: args.summary };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`webhook request failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (!res.ok) {
      throw new Error(`webhook returned ${res.status}`);
    }
    return { delivered: true, mocked: false };
  },
};
