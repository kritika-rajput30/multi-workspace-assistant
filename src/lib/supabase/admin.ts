import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client — BYPASSES RLS. Server-only. Never import this into a
// client component.
//
// Because RLS is off for this client, every query you run through it MUST
// filter by workspace_id yourself. That explicit filter is the isolation
// boundary the exercise is testing. RLS (see schema.sql) is only the safety net.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Helper: confirm the given user actually owns the given workspace before you
// touch any workspace-scoped data with the admin client. Call this in every
// route that takes a workspaceId from the client.
export async function assertWorkspaceOwner(userId: string, workspaceId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) throw new Error(`workspace ownership check failed: ${error.message}`);
  if (!data) throw new Error('forbidden: not your workspace');
}
