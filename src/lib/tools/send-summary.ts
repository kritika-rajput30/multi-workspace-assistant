import { z } from 'zod';
import type { ToolContext, ToolDef } from './index';

// send_summary — posts a short summary to a Slack/Discord incoming webhook.
// The webhook URL is a server-only secret (SUMMARY_WEBHOOK_URL). It is never
// passed in by the model or the client.

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
  async execute(args, _ctx: ToolContext) {
    // TODO(interview):
    //   const url = process.env.SUMMARY_WEBHOOK_URL;
    //   if (!url) throw new Error('summary webhook not configured');
    //   POST { text: args.summary }  (Slack)  /  { content: args.summary } (Discord)
    //   Handle non-2xx without throwing raw fetch errors at the caller.
    //   Return { delivered: true }.
    void args;
    throw new Error('send_summary.execute not implemented');
  },
};
