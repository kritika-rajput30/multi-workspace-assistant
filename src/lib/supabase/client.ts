'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client — uses the anon key, subject to RLS.
// Use this in client components for auth (sign in / sign up / sign out).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
