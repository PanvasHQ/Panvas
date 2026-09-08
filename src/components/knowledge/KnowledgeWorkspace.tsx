import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, FileText, GitFork, Search, ShieldCheck } from 'lucide-react';
import type {
  KnowledgeHealthReport,
  KnowledgeNoteContext,
  KnowledgeNoteSummary,
  KnowledgeRelationship,
  KnowledgeResponse,
} from '@/types/knowledge';

function StatusBadge({ status }: { status?: string }) {
  const tone = status === 'disputed' ? 'bg-panvas-accent-rose/15 text-panvas-accent-rose' : status === 'draft' ? 'bg-panvas-accent-amber/15 text-panvas-accent-amber' : 'bg-panvas-accent-emerald/15 text-panvas-accent-emerald';
  return status ? <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${tone}`}>{status}</span> : null;
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-panvas-border-default p-6 text-center text-sm text-panvas-text-tertiary">{message}</div>;
}

export function KnowledgeWorkspace() {
  const [query, setQuery] = useState('Panvas Application');
  const [results, setResults] = useState<KnowledgeNoteSummary[]>([]);
  const [selected, setSelected] = useState<KnowledgeNoteContext | null>(null);
  const [related, setRelated] = useState<KnowledgeRelationship[]>([]);
  const [health, setHealth] = useState<KnowledgeHealthReport | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const api = typeof window !== 'undefined' ? window.panvas?.knowledge : undefined;

  const handleUnavailable = useCallback((response: KnowledgeResponse<unknown>) => {
    if (!response.available) setNotice(response.message);
  }, []);

  const openNote = useCallback(async (path: string) => {
    if (!api) {
      setNotice('Knowledge access is available only in the Panvas Electron application.');
      return;
    }
    setLoading(true);
    const [contextResponse, relatedResponse] = await Promise.all([
      api.get_note_context({ path }),
      api.find_related({ path, depth: 2, limit: 30 }),
    ]);
    setLoading(false);
    if (!contextResponse.available) {
      handleUnavailable(contextResponse);
      return;
    }
    setSelected(contextResponse.data);
    setRelated(relatedResponse.available ? relatedResponse.data : []);
    if (!relatedResponse.available) handleUnavailable(relatedResponse);
  }, [api, handleUnavailable]);

  const search = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    if (!api) {
      setNotice('Knowledge access is available only in the Panvas Electron application.');
      return;
    }
    if (!query.trim()) return;
    setLoading(true);
    const response = await api.search_knowledge({ query: query.trim(), limit: 12 });
    setLoading(false);
    if (!response.available) {
      handleUnavailable(response);
      setResults([]);
      return;
    }
    setNotice('');
    setResults(response.data.results);
  }, [api, handleUnavailable, query]);

  const loadHealth = useCallback(async () => {
    if (!api) {
      setNotice('Knowledge access is available only in the Panvas Electron application.');
      return;
    }
    setLoading(true);
    const response = await api.knowledge_health();
    setLoading(false);
    if (!response.available) {
      handleUnavailable(response);
      return;
    }
    setNotice('');
    setHealth(response.data);
  }, [api, handleUnavailable]);

  useEffect(() => {
    void search();
    void loadHealth();
  }, []); // The initial view intentionally performs the same read-only checks as the UI actions.

  return (
    <main className="h-full overflow-y-auto bg-panvas-bg-secondary p-6 text-panvas-text-primary">
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
        <section className="rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4 shadow-glass-sm">
          <div className="mb-4 flex items-center gap-2"><Search size={17} /><h1 className="text-sm font-semibold">Knowledge</h1></div>
          <form onSubmit={search} className="flex gap-2">
            <input className="input-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search canonical knowledge" aria-label="Search knowledge" />
            <button className="btn-icon border border-panvas-border-default" type="submit" aria-label="Search knowledge"><Search size={16} /></button>
          </form>
          <p className="mt-2 text-2xs leading-4 text-panvas-text-tertiary">Local, deterministic search over the configured Markdown vault.</p>
          <div className="mt-4 space-y-2">
            {results.map((result) => (
              <button key={result.ref.path} type="button" onClick={() => void openNote(result.ref.path)} className="w-full rounded-lg border border-panvas-border-subtle p-3 text-left hover:bg-panvas-bg-hover focus-ring">
                <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{result.ref.title}</span><StatusBadge status={result.ref.status} /></div>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-panvas-text-secondary">{result.excerpt}</p>
                <div className="mt-2 flex flex-wrap gap-1">{result.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-panvas-bg-active px-1.5 py-0.5 text-2xs text-panvas-text-tertiary">{tag}</span>)}</div>
              </button>
            ))}
            {!loading && results.length === 0 && <EmptyState message="Search a canonical note or configure the local vault path." />}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-5 shadow-glass-sm">
          {notice && <div className="mb-4 flex gap-2 rounded-lg border border-panvas-accent-amber/40 bg-panvas-accent-amber/10 p-3 text-sm text-panvas-text-secondary"><AlertCircle size={17} className="mt-0.5 shrink-0 text-panvas-accent-amber" />{notice}</div>}
          {!selected && !notice && <EmptyState message="Select a result to view its canonical note, provenance, and explicit relationships." />}
          {selected && <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-panvas-border-subtle pb-4">
              <div><div className="mb-1 flex items-center gap-2 text-panvas-text-tertiary"><FileText size={15} /><span className="font-mono text-2xs">{selected.ref.path}</span></div><h2 className="text-xl font-semibold">{selected.ref.title}</h2></div>
              <StatusBadge status={selected.ref.status} />
            </div>
            {selected.uncertainty.length > 0 && <div className="mt-4 rounded-lg border border-panvas-accent-amber/35 bg-panvas-accent-amber/10 p-3 text-xs leading-5 text-panvas-text-secondary">{selected.uncertainty.map((item) => <p key={item}>{item}</p>)}</div>}
            <article className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-panvas-text-secondary">{selected.content}</article>
          </>}
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4 shadow-glass-sm">
            <div className="flex items-center gap-2"><GitFork size={16} /><h2 className="text-sm font-semibold">Related notes</h2></div>
            <div className="mt-3 space-y-2">{related.length === 0 ? <p className="text-xs leading-5 text-panvas-text-tertiary">Select a note to inspect one- and two-hop explicit relationships.</p> : related.map((edge, index) => {
              const target = edge.direction === 'outgoing' ? edge.to : edge.from;
              return <button key={`${edge.relation}-${target.path}-${index}`} type="button" onClick={() => void openNote(target.path)} className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-panvas-bg-hover"><ArrowRight size={14} className="mt-0.5 shrink-0 text-panvas-text-tertiary" /><span><span className="block text-xs text-panvas-text-primary">{target.title}</span><span className="block text-2xs text-panvas-text-tertiary">{edge.direction} · {edge.relation}</span></span></button>;
            })}</div>
          </section>

          <section className="rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4 shadow-glass-sm">
            <div className="flex items-center gap-2"><ShieldCheck size={16} /><h2 className="text-sm font-semibold">Provenance</h2></div>
            {!selected ? <p className="mt-3 text-xs text-panvas-text-tertiary">Open a note to inspect its evidence and review state.</p> : <div className="mt-3 space-y-2 text-xs text-panvas-text-secondary">
              <p>Status: {selected.provenance.status ?? 'not recorded'}</p><p>Confidence: {selected.provenance.confidence ?? 'not recorded'}</p><p>Reviewed: {selected.provenance.reviewed ?? selected.provenance.captured ?? 'not recorded'}</p>
              {selected.provenance.sources.map((source) => <button key={source.path} type="button" onClick={() => void openNote(source.path)} className="block text-left text-panvas-text-accent hover:underline">{source.title}</button>)}
            </div>}
          </section>

          <section className="rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4 shadow-glass-sm">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><ShieldCheck size={16} /><h2 className="text-sm font-semibold">Knowledge health</h2></div><button type="button" onClick={() => void loadHealth()} className="text-2xs text-panvas-text-accent hover:underline">Refresh</button></div>
            {!health ? <p className="mt-3 text-xs text-panvas-text-tertiary">Run a read-only health check.</p> : <div className="mt-3 space-y-1.5 text-xs text-panvas-text-secondary">
              <p>{health.managedRecords} managed records · {health.markdownFiles} Markdown files</p>
              {[['Broken links', health.brokenLinks.length], ['Orphans', health.orphanRecords.length], ['Stale sources', health.staleSources.length], ['Disputed', health.disputedRecords.length], ['Planned', health.plannedRecords.length]].map(([label, count]) => <div key={String(label)} className="flex justify-between"><span>{label}</span><span className={Number(count) === 0 ? 'text-panvas-accent-emerald' : 'text-panvas-accent-amber'}>{Number(count) === 0 ? <CheckCircle2 size={13} className="inline" /> : count}</span></div>)}
            </div>}
          </section>
        </aside>
      </div>
    </main>
  );
}
