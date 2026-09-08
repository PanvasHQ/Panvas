import { ExternalLink, Library, Search, Trash2, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PERSONAL_LIBRARY_FILE, type CanvasLibraryRecord } from '@/services/canvas/canvasLibraryModel';

interface CanvasLibraryDrawerProps {
  records: CanvasLibraryRecord[];
  loading: boolean;
  onClose: () => void;
  onOpenPersonalLibrary: () => void;
  onImport: (file: File) => Promise<void>;
  onLoad: (record: CanvasLibraryRecord) => Promise<void>;
  onDelete: (record: CanvasLibraryRecord) => Promise<void>;
}

export function CanvasLibraryDrawer({ records, loading, onClose, onOpenPersonalLibrary, onImport, onLoad, onDelete }: CanvasLibraryDrawerProps) {
  const [query, setQuery] = useState('');
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const personal = records.find((record) => record.fileName === PERSONAL_LIBRARY_FILE);
  const installed = useMemo(() => records
    .filter((record) => record.fileName !== PERSONAL_LIBRARY_FILE)
    .filter((record) => record.name.toLowerCase().includes(query.trim().toLowerCase())), [query, records]);

  const run = async (fileName: string, action: () => Promise<void>) => {
    setBusyFile(fileName);
    try { await action(); } finally { setBusyFile(null); }
  };

  return (
    <aside className="panvas-layer-drawer absolute inset-y-4 right-4 z-30 flex w-80 flex-col overflow-hidden rounded-2xl border border-panvas-border-strong bg-panvas-bg-elevated shadow-glass-lg" aria-label="Canvas library drawer">
      <header className="flex items-center gap-3 border-b border-panvas-border-subtle px-4 py-3">
        <Library size={18} className="text-panvas-accent-violet" aria-hidden="true" />
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-panvas-text-primary">Canvas libraries</h2><p className="text-xs text-panvas-text-tertiary">Local to this workspace</p></div>
        <button type="button" onClick={onClose} aria-label="Close canvas libraries" className="rounded-lg p-1.5 text-panvas-text-tertiary hover:bg-panvas-bg-hover hover:text-panvas-text-primary"><X size={16} /></button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-panvas-text-tertiary">Personal library</div>
          <button type="button" onClick={onOpenPersonalLibrary} className="flex w-full items-center gap-3 rounded-xl border border-panvas-border-subtle bg-panvas-bg-secondary p-3 text-left hover:border-panvas-border-strong hover:bg-panvas-bg-hover">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-panvas-accent-violet/15 text-panvas-accent-violet"><Library size={18} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-panvas-text-primary">Open personal library</span><span className="block text-xs text-panvas-text-tertiary">{personal?.libraryItems.length ?? 0} saved items · add selected objects and drag items onto the canvas</span></span>
          </button>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-panvas-text-tertiary">Installed libraries</span><span className="text-xs text-panvas-text-tertiary">{installed.length}</span></div>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-panvas-border-strong bg-panvas-bg-secondary px-3 py-2 focus-within:ring-2 focus-within:ring-panvas-accent-blue">
            <Search size={15} className="text-panvas-text-tertiary" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search installed libraries" className="min-w-0 flex-1 bg-transparent text-sm text-panvas-text-primary outline-none placeholder:text-panvas-text-tertiary" />
          </label>
          <div className="space-y-2">
            {loading && <p className="rounded-lg border border-panvas-border-subtle p-3 text-sm text-panvas-text-tertiary">Loading local libraries…</p>}
            {!loading && installed.length === 0 && <p className="rounded-lg border border-dashed border-panvas-border-strong p-4 text-center text-sm text-panvas-text-tertiary">No installed libraries found.</p>}
            {installed.map((record) => (
              <div key={record.fileName} className="rounded-xl border border-panvas-border-subtle bg-panvas-bg-secondary p-3">
                <div className="flex items-start gap-3"><div className="grid h-12 w-16 grid-cols-3 gap-1 rounded-lg bg-panvas-bg-primary p-2" aria-hidden="true">{record.libraryItems.slice(0, 6).map((_item, index) => <span key={index} className="rounded-sm bg-panvas-accent-violet/35" />)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-panvas-text-primary">{record.name}</p><p className="text-xs text-panvas-text-tertiary">{record.libraryItems.length} items</p></div></div>
                <div className="mt-3 flex gap-2"><button type="button" disabled={busyFile === record.fileName} onClick={() => run(record.fileName, () => onLoad(record))} className="flex-1 rounded-lg bg-panvas-bg-active px-3 py-1.5 text-xs font-medium text-panvas-text-primary hover:bg-panvas-bg-hover disabled:opacity-50">Load & open</button><button type="button" disabled={busyFile === record.fileName} onClick={() => run(record.fileName, () => onDelete(record))} aria-label={`Delete ${record.name}`} className="rounded-lg p-1.5 text-panvas-text-tertiary hover:bg-panvas-accent-rose/15 hover:text-panvas-accent-rose disabled:opacity-50"><Trash2 size={15} /></button></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="space-y-2 border-t border-panvas-border-subtle p-4">
        <input ref={inputRef} type="file" accept=".excalidrawlib,application/json" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) await run(file.name, () => onImport(file)); }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-panvas-border-strong px-3 py-2 text-sm font-medium text-panvas-text-primary hover:bg-panvas-bg-hover"><Upload size={15} /> Import .excalidrawlib</button>
        <a href="https://libraries.excalidraw.com" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary">Browse Excalidraw libraries <ExternalLink size={14} /></a>
      </footer>
    </aside>
  );
}
