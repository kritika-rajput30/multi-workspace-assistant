'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Citation, Workspace } from '@/lib/types';

// ============================================================================
// Dashboard: workspace switcher, documents + upload, chat with citations,
// tool-call log, tasks. Everything is scoped to the active workspace —
// switching workspaces reloads all panels.
//
// The side-panel data (documents/messages/tool_calls/tasks) is fetched
// directly from Supabase with the browser (anon-key) client, filtered by
// workspace_id. Row Level Security (see schema.sql) restricts results to rows
// owned by the signed-in user, so this is safe without a dedicated API route.
//
// This file is UI plumbing only — it calls the real /api/upload and /api/chat
// routes, which in turn call ingestDocument()/answerQuestion(). Until those
// are implemented, upload/chat will show a graceful error (the routes already
// catch failures) rather than crash. That's expected before you build them.
// ============================================================================

interface DocRow {
  id: string;
  filename: string;
  n_chunks: number;
  created_at: string;
}
interface MsgRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
}
interface ToolRow {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status: string;
  error: string | null;
  created_at: string;
}
interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  done: boolean;
  created_at: string;
}
interface WorkspaceData {
  documents: DocRow[];
  messages: MsgRow[];
  toolCalls: ToolRow[];
  tasks: TaskRow[];
}

const EMPTY: WorkspaceData = { documents: [], messages: [], toolCalls: [], tasks: [] };

export default function DashboardClient({
  email,
  initialWorkspaces,
}: {
  email: string;
  initialWorkspaces: Workspace[];
}) {
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  // Restore the last active workspace synchronously on first render (lazy init),
  // so we never do setState-in-effect just to hydrate from localStorage.
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('activeWorkspaceId');
      if (saved && initialWorkspaces.some((w) => w.id === saved)) return saved;
    } catch {
      /* SSR / storage blocked */
    }
    return initialWorkspaces[0]?.id ?? null;
  });
  const [data, setData] = useState<WorkspaceData>(EMPTY);

  // Fetches the four panels for a workspace directly from Supabase (RLS-scoped).
  const loadData = useCallback(async (workspaceId: string) => {
    const supabase = createClient();
    const [docs, msgs, tools, tasks] = await Promise.all([
      supabase
        .from('documents')
        .select('id, filename, n_chunks, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at'),
      supabase
        .from('messages')
        .select('id, role, content, citations, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at'),
      supabase
        .from('tool_calls')
        .select('id, tool_name, arguments, result, status, error, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('id, title, notes, due_date, done, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
    ]);
    setData({
      documents: (docs.data as DocRow[] | null) ?? [],
      messages: (msgs.data as MsgRow[] | null) ?? [],
      toolCalls: (tools.data as ToolRow[] | null) ?? [],
      tasks: (tasks.data as TaskRow[] | null) ?? [],
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    loadData(activeId).catch(() => {
      if (alive) setData(EMPTY);
    });
    return () => {
      alive = false;
    };
  }, [activeId, loadData]);

  function switchWorkspace(id: string) {
    setActiveId(id);
    setData(EMPTY);
    try {
      localStorage.setItem('activeWorkspaceId', id);
    } catch {
      /* ignore */
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
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
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
              D
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Workspace</span>
              <select
                value={activeId ?? ''}
                onChange={(e) => switchWorkspace(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                onClick={newWorkspace}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
              >
                + New
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{email}</span>
            <button onClick={signOut} className="font-medium text-slate-500 hover:text-indigo-600">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4">
        {!activeId ? (
          <p className="mt-10 text-center text-slate-500">Create a workspace to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
            <aside className="space-y-4">
              <DocumentsPanel
                workspaceId={activeId}
                docs={data.documents}
                onChange={() => loadData(activeId)}
              />
              <TasksPanel tasks={data.tasks} />
              <ToolCallsPanel toolCalls={data.toolCalls} />
            </aside>

            <main>
              <ChatPanel
                workspaceId={activeId}
                messages={data.messages}
                onTurn={() => loadData(activeId)}
              />
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function DocumentsPanel({
  workspaceId,
  docs,
  onChange,
}: {
  workspaceId: string;
  docs: DocRow[];
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append('workspaceId', workspaceId);
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg(
        body.status === 'already_present'
          ? `"${body.filename}" already ingested (${body.nChunks} chunks)`
          : `Ingested "${body.filename}" → ${body.nChunks} chunks`,
      );
      onChange();
    } else {
      setMsg(`Error: ${body.error ?? res.statusText}`);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <Panel title="Documents">
      <label
        className={`mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-3 py-4 text-center transition ${
          busy
            ? 'border-slate-200 bg-slate-50'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40'
        }`}
      >
        <span className="text-xs font-medium text-slate-600">
          {busy ? 'Uploading + embedding…' : 'Click to upload a document'}
        </span>
        <span className="text-[11px] text-slate-400">.txt · .md · .pdf</span>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="hidden"
        />
      </label>
      {msg && <p className="mb-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">{msg}</p>}
      <ul className="space-y-1.5 text-sm">
        {docs.length === 0 && <li className="text-slate-400">no documents yet</li>}
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
            <span className="truncate text-slate-700">{d.filename}</span>
            <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
              {d.n_chunks}c
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TasksPanel({ tasks }: { tasks: TaskRow[] }) {
  return (
    <Panel title={`Tasks (${tasks.length})`}>
      <ul className="space-y-1.5 text-sm">
        {tasks.length === 0 && (
          <li className="text-slate-400">no tasks — ask the assistant to save one</li>
        )}
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
            <span className="text-slate-700">
              {t.title}
              {t.due_date ? <span className="text-slate-400"> — {t.due_date}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

function ToolCallsPanel({ toolCalls }: { toolCalls: ToolRow[] }) {
  return (
    <Panel title={`Tool calls (${toolCalls.length})`}>
      <ul className="space-y-2 text-xs">
        {toolCalls.length === 0 && <li className="text-slate-400">no tool calls yet</li>}
        {toolCalls.map((t) => (
          <li key={t.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-slate-700">{t.tool_name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  STATUS_STYLES[t.status] ?? 'bg-slate-200 text-slate-600'
                }`}
              >
                {t.status}
              </span>
            </div>
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-slate-500">
              {JSON.stringify(t.arguments)}
            </pre>
            {t.error && <p className="mt-1 text-[11px] text-red-600">{t.error}</p>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ChatPanel({
  workspaceId,
  messages,
  onTurn,
}: {
  workspaceId: string;
  messages: MsgRow[];
  onTurn: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(false);
  const [lastDebug, setLastDebug] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setLastDebug(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId, question: q, debug }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setQuestion('');
        if (body.debug) setLastDebug(body.debug);
      } else {
        setError(body.error ?? res.statusText);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setBusy(false);
      onTurn();
    }
  }

  return (
    <Panel title="Chat">
      <div className="mb-3 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Ask something answerable from this workspace&apos;s documents.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                m.role === 'user'
                  ? 'rounded-tr-sm bg-indigo-600 text-white'
                  : 'rounded-tl-sm border border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              {m.content}
              {m.role === 'assistant' && m.citations?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-200 pt-2">
                  {m.citations.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600"
                    >
                      {c.filename} #{c.chunk_index} · {c.similarity.toFixed(2)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-slate-400">thinking…</p>}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {lastDebug != null && (
        <details className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-slate-500">
            retrieval debug (last turn)
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-slate-600">
            {JSON.stringify(lastDebug, null, 2)}
          </pre>
        </details>
      )}

      <div className="flex gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Ask a question…"
          className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          onClick={send}
          disabled={busy}
          className="self-end rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={debug}
          onChange={(e) => setDebug(e.target.checked)}
          className="accent-indigo-600"
        />
        include retrieval debug (shows which workspace + chunks the answer used)
      </label>
    </Panel>
  );
}
