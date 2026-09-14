import React from 'react';
import { BookOpen, Columns2, MousePointer2, Pencil, Presentation, Rows2, X } from 'lucide-react';
import { useLayoutStore, type PaneLayoutMode } from '@/stores/layoutStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const layouts: Array<{ value: PaneLayoutMode; label: string }> = [
  { value: 'single', label: 'Single pane' },
  { value: 'vertical-split', label: 'Side-by-side' },
  { value: 'horizontal-split', label: 'Top and bottom' },
  { value: 'two-page', label: 'Two-page spread' },
];

/** The contextual view section is shared by notebook and PDF inspectors. */
export function WorkspaceViewInspector() {
  const { workspaceViewMode, setWorkspaceViewMode, paneLayout, setPaneLayout, secondaryPageId, setSecondaryPageId, laserMode, setLaserMode } = useLayoutStore();
  const { activePageId, notebookPages, notebooks, notebookSections } = useWorkspaceStore();
  const pages = notebookPages.filter(page => !page.deletedAt);
  const isSplit = paneLayout === 'vertical-split' || paneLayout === 'horizontal-split';

  return (
    <div className="space-y-4 text-xs">
      <section aria-labelledby="workspace-view-mode-heading">
        <h3 id="workspace-view-mode-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Document mode</h3>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-panvas-border-subtle bg-panvas-bg-secondary p-1" role="group" aria-label="Document mode">
          <ModeButton label="Edit" active={workspaceViewMode === 'edit'} onClick={() => setWorkspaceViewMode('edit')}><Pencil size={14} /></ModeButton>
          <ModeButton label="Read" active={workspaceViewMode === 'read'} onClick={() => setWorkspaceViewMode(workspaceViewMode === 'read' ? 'edit' : 'read')}><BookOpen size={14} /></ModeButton>
          <ModeButton label="Present" active={workspaceViewMode === 'present'} onClick={() => setWorkspaceViewMode(workspaceViewMode === 'present' ? 'edit' : 'present')} emphasis={workspaceViewMode === 'present'}><Presentation size={14} /></ModeButton>
        </div>
      </section>

      <section aria-labelledby="workspace-layout-heading">
        <h3 id="workspace-layout-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Layout</h3>
        <div className="flex items-center gap-2">
          {paneLayout === 'vertical-split' ? <Columns2 aria-hidden="true" size={14} className="shrink-0 text-panvas-text-tertiary" /> : paneLayout === 'horizontal-split' ? <Rows2 aria-hidden="true" size={14} className="shrink-0 text-panvas-text-tertiary" /> : <MousePointer2 aria-hidden="true" size={14} className="shrink-0 text-panvas-text-tertiary" />}
          <label className="sr-only" htmlFor="pane-layout">Pane layout</label>
          <select id="pane-layout" value={paneLayout} onChange={event => setPaneLayout(event.target.value as PaneLayoutMode)} className="panvas-control h-8 min-w-0 flex-1 px-2 text-xs focus-ring" title="Pane layout">
            {layouts.map(layout => <option key={layout.value} value={layout.value}>{layout.label}</option>)}
          </select>
        </div>
        {isSplit && <div className="mt-2">
          <label className="mb-1 block text-[11px] text-panvas-text-secondary" htmlFor="reference-page">Reference page</label>
          <select id="reference-page" value={secondaryPageId ?? ''} onChange={event => setSecondaryPageId(event.target.value || null)} className="panvas-control h-8 w-full px-2 text-xs focus-ring" title="Reference page">
            <option value="">Choose a page…</option>
            {pages.filter(page => page.id !== activePageId).map(page => {
              const notebook = notebooks.find(item => item.id === page.notebookId);
              const section = notebookSections.find(item => item.id === page.sectionId);
              const context = [notebook?.name, section?.name].filter(Boolean).join(' · ');
              return <option key={page.id} value={page.id}>{context ? `${context} · ${page.title}` : page.title}</option>;
            })}
          </select>
        </div>}
      </section>

      {workspaceViewMode === 'present' && <section aria-labelledby="workspace-laser-heading">
        <h3 id="workspace-laser-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Presentation pointer</h3>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-panvas-border-subtle bg-panvas-bg-secondary p-1" role="group" aria-label="Presentation laser">
          <button type="button" onClick={() => setLaserMode('dot')} aria-pressed={laserMode === 'dot'} className="panvas-icon-control h-8 w-auto px-2 text-xs focus-ring">Dot</button>
          <button type="button" onClick={() => setLaserMode('trail')} aria-pressed={laserMode === 'trail'} className="panvas-icon-control h-8 w-auto px-2 text-xs focus-ring">Trail</button>
        </div>
      </section>}
    </div>
  );
}

/** A side inspector for document types without the notebook page-properties controls. */
export function WorkspaceViewInspectorPanel({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
  return (
    <aside className="panvas-view-inspector panvas-layer-sheet absolute inset-y-0 right-0 flex w-72 max-w-[calc(100%-1rem)] flex-col overflow-y-auto border-l border-panvas-border-subtle bg-panvas-bg-primary shadow-2xl max-[599px]:fixed max-[599px]:inset-x-0 max-[599px]:top-auto max-[599px]:bottom-0 max-[599px]:h-auto max-[599px]:max-h-[70vh] max-[599px]:w-full max-[599px]:rounded-t-2xl max-[599px]:border-l-0 max-[599px]:border-t" role="dialog" aria-modal="false" aria-labelledby="workspace-view-inspector-title">
      <div className="flex items-center justify-between border-b border-panvas-border-subtle p-4">
        <div>
          <h2 id="workspace-view-inspector-title" className="text-sm font-semibold text-panvas-text-primary">Page &amp; view</h2>
          <p className="mt-1 text-2xs text-panvas-text-tertiary">Mode and layout for this document</p>
        </div>
        <button type="button" onClick={onClose} className="panvas-icon-control focus-ring" aria-label="Close page and view inspector" title="Close page and view inspector"><X size={15} /></button>
      </div>
      <div className="p-4"><WorkspaceViewInspector />{children && <div className="mt-4 border-t border-panvas-border-subtle pt-4">{children}</div>}</div>
    </aside>
  );
}

/** @deprecated Kept as a compatibility export; callers should use the inspector. */
export function WorkspaceViewControls() {
  return <WorkspaceViewInspectorPanel onClose={() => undefined} />;
}

function ModeButton({ label, active, emphasis = false, onClick, children }: { label: string; active: boolean; emphasis?: boolean; onClick: () => void; children: React.ReactNode }) {
  // Deliberate segmented control: equal segments, a clean selected pill, a
  // subtle hover, and one shared tone so the emphasis variant never fights
  // the selected background.
  const tone = emphasis && active
    ? 'text-panvas-accent-rose'
    : active
      ? 'text-panvas-text-primary'
      : 'text-panvas-text-secondary';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} mode`}
      aria-pressed={active}
      title={`${label} mode`}
      className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-ring ${tone} ${
        active ? 'bg-panvas-bg-active font-medium shadow-sm' : 'hover:bg-panvas-bg-hover hover:text-panvas-text-primary'
      }`}
    >
      {children}<span className="workspace-mode-label sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}
