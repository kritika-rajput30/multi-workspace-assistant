'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Minimal email + password auth via Supabase. Enough for a throwaway test
// account. Swap to magic-link or OAuth later if you want.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Construct the client here (not at render) so build-time prerender never
    // touches it before env vars exist.
    const supabase = createClient();
    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-semibold text-white shadow-sm">
            D
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Document Assistant</h1>
          <p className="mt-1 text-sm text-slate-500">
            Workspace-scoped RAG chat with citations and tools.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="mt-4 w-full text-center text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-indigo-600"
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </main>
  );
}
