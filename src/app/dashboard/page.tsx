import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardClient from './DashboardClient';

// Server component: gate on auth, load the user's workspaces, hand off to the
// interactive client shell.
export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: workspaces } = await admin
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  return <DashboardClient email={user.email ?? ''} initialWorkspaces={workspaces ?? []} />;
}
