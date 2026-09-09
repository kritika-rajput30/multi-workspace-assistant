import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server Supabase client bound to the request cookies — anon key, RLS applies,
// and it knows who the logged-in user is. Use in Server Components / route
// handlers when you want "acting as this user".
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware
            // refreshes the session.
          }
        },
      },
    },
  );
}

// Returns the authenticated user or null. Route handlers call this first and
// 401 if null.
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
