import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { assertWorkspaceOwner } from '@/lib/supabase/admin';
import { ingestDocument } from '@/lib/ingest';

// POST /api/upload  (multipart/form-data: file, workspaceId)
// Ingests synchronously: chunk -> embed -> store, tagged with the workspace.

export const runtime = 'nodejs'; // unpdf + node:crypto need the Node runtime
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['text/plain', 'text/markdown', 'application/pdf']);

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });

  const workspaceId = String(form.get('workspaceId') ?? '');
  const file = form.get('file');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large' }, { status: 413 });
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `unsupported type: ${file.type}` }, { status: 415 });
  }

  try {
    await assertWorkspaceOwner(user.id, workspaceId);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await ingestDocument({
      workspaceId,
      filename: file.name,
      mimeType: file.type || 'text/plain',
      bytes,
    });
    return NextResponse.json(result, { status: result.status === 'ingested' ? 201 : 200 });
  } catch (err) {
    console.error('ingest failed', err);
    return NextResponse.json({ error: 'ingestion failed' }, { status: 500 });
  }
}
