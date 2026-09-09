import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { assertWorkspaceOwner, createAdminClient } from '@/lib/supabase/admin';
import { answerQuestion } from '@/lib/rag';

// POST /api/chat { workspaceId, question }
// Runs workspace-scoped RAG + the tool-calling loop, persists the turn and any
// tool calls, and returns the grounded answer.

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { workspaceId?: unknown; question?: unknown; debug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!workspaceId || !question) {
    return NextResponse.json({ error: 'workspaceId and question required' }, { status: 400 });
  }

  try {
    await assertWorkspaceOwner(user.id, workspaceId);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Persist the user's message even if the model call later fails — the
  // question is not lost. (quality bar: "doesn't lose work or fall over")
  const { data: userMsg } = await admin
    .from('messages')
    .insert({ workspace_id: workspaceId, role: 'user', content: question })
    .select()
    .single();

  try {
    // TODO(interview): optionally load recent history for multi-turn context.
    const result = await answerQuestion({
      workspaceId,
      question,
      debug: body.debug === true,
    });

    const { data: assistantMsg } = await admin
      .from('messages')
      .insert({
        workspace_id: workspaceId,
        role: 'assistant',
        content: result.answer,
        citations: result.citations,
      })
      .select()
      .single();

    if (result.toolCalls.length > 0) {
      await admin.from('tool_calls').insert(
        result.toolCalls.map((t) => ({
          workspace_id: workspaceId,
          message_id: assistantMsg?.id ?? null,
          tool_name: t.tool_name,
          arguments: t.arguments,
          result: t.result ?? null,
          status: t.status,
          error: t.error ?? null,
        })),
      );
    }

    return NextResponse.json({
      answer: result.answer,
      citations: result.citations,
      toolCalls: result.toolCalls,
      debug: result.debug,
      userMessageId: userMsg?.id,
    });
  } catch (err) {
    console.error('chat failed', err);
    // The user message is already saved; tell the client to retry.
    return NextResponse.json({ error: 'assistant failed, try again' }, { status: 502 });
  }
}
