'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workspace } from '@/lib/types';

// ============================================================================
// Dashboard shell. Layout + wiring is here; the data-loading TODOs are yours.
// Panels required by the brief:
//   - workspace switcher (top)
//   - documents in the active workspace + an upload control
//   - chat (grounded answers with citations)
//   - tool-call log
// ============================================================================

export default function DashboardClient({
  email,
  initialWorkspaces,
}: {
  email: string;
  initialWorkspaces: Workspace[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [activeId, setActiveId] = useState<string | null>(initialWorkspaces[0]?.id ?? null);

  useEffect(() => {
    // Remember the last active workspace across reloads (per-viewer convenience).
    try {
      const saved = localStorage.getItem('activeWorkspaceId');
      if (saved && workspaces.some((w) => w.id === saved)) setActiveId(saved);
    } catch {
      /* ignore */
    }
  }, [workspaces]);

  function switchWorkspace(id: string) {
    setActiveId(id);
    try {
      localStorage.setItem('activeWorkspaceId', id);
    } catch {
      /* ignore */
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function newWorkspace() {
    const name = prompt('Workspace name?')?.trim();
    if (!name) return;
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { workspace } = await res.json();
      setWorkspaces((w) => [...w, workspace]);
      switchWorkspace(workspace.id);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Workspace:</span>
          <select
            value={activeId ?? ''}
            onChange={(e) => switchWorkspace(e.target.value)}
            className="rounded border px-2 py-1"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button onClick={newWorkspace} className="rounded border px-2 py-1 text-sm">
            + New
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{email}</span>
          <button onClick={signOut} className="underline">
            Sign out
          </button>
        </div>
      </header>

      {!activeId ? (
        <p className="text-gray-500">Create a workspace to get started.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          <aside className="space-y-4">
            <Panel title="Documents">
              {/* TODO(interview): list documents for activeId (GET /api/documents?workspaceId=)
                  + an <input type="file"> that POSTs multipart to /api/upload. */}
              <p className="text-sm text-gray-400">documents panel — TODO</p>
            </Panel>
            <Panel title="Tool calls">
              {/* TODO(interview): list tool_calls for activeId, newest first. */}
              <p className="text-sm text-gray-400">tool-call log — TODO</p>
            </Panel>
          </aside>

          <main>
            <Panel title="Chat">
              {/* TODO(interview): message list + composer that POSTs
                  { workspaceId: activeId, question } to /api/chat and renders
                  answer + citations. Show the "I don't know" answer verbatim. */}
              <p className="text-sm text-gray-400">chat panel — TODO</p>
            </Panel>
          </main>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-3">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  );
}
