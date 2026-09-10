import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardClient from './DashboardClient';

// Server component: gate on auth, load the user's workspaces, hand off to the
// interactive client shell. A freshly signed-up user owns no workspace yet and
// the app is unusable without one, so on the first dashboard visit we create a
// default "My Workspace" for them. Guarded on count === 0 — it runs once.
export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  let workspaces = existing ?? [];
  if (workspaces.length === 0) {
    const { data: created } = await admin
      .from('workspaces')
      .insert({ owner_id: user.id, name: 'My Workspace' })
      .select()
      .single();
    if (created) workspaces = [created];
  }

  return <DashboardClient email={user.email ?? ''} initialWorkspaces={workspaces} />;
}
