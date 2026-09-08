import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, FileText, Grid2X2, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useLayoutStore, type DocumentTab } from '@/stores/layoutStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function TabIcon({ type }: { type: DocumentTab['type'] }) {
  return type === 'canvas' ? <Grid2X2 size={13} /> : type === 'pdf' ? <FileText size={13} /> : <BookOpen size={13} />;
}

export function DocumentTabBar() {
  const [, navigate] = useLocation();
  const { openTabs, activeTabId, closeTab, setActiveTab, reorderTabs, cycleTabs, openTabInSplit } = useLayoutStore();
  const { activeCanvasId, activePageId, setActiveCanvas, setActivePage, setActiveNotebook, canvasFiles, notebookPages, notebooks } = useWorkspaceStore();
  const [contextTabId, setContextTabId] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === 'w') {
        event.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      } else if (event.key === 'Tab' && openTabs.length > 1) {
        event.preventDefault();
        cycleTabs(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, closeTab, cycleTabs, openTabs.length]);

  useEffect(() => {
    if (!activeTabId) {
      if (openTabs.length === 0 && (activeCanvasId || activePageId)) {
        setActiveCanvas(null);
        setActivePage(null);
        setActiveNotebook(null);
        navigate('/app/library');
      }
      return;
    }
    const tab = openTabs.find(item => item.id === activeTabId);
    if (!tab) return;
    if (tab.type === 'canvas') {
      if (!canvasFiles.some(item => item.id === tab.id)) return;
      setActiveCanvas(tab.id);
    } else if (tab.type === 'pdf' || tab.pageId) {
      const pageId = tab.pageId ?? tab.id;
      if (!notebookPages.some(item => item.id === pageId)) return;
      setActivePage(pageId);
    } else {
      if (!notebooks.some(item => item.id === tab.id)) return;
      void setActiveNotebook(tab.id);
    }
    navigate('/app');
  }, [activeCanvasId, activePageId, activeTabId, canvasFiles, navigate, notebookPages, notebooks, openTabs, setActiveCanvas, setActiveNotebook, setActivePage]);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setContextTabId(null);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, []);

  const activate = (tab: DocumentTab) => {
    setContextTabId(null);
    setActiveTab(tab.id);
  };

  const handleClose = (event: React.MouseEvent, tab: DocumentTab) => {
    event.stopPropagation();
    closeTab(tab.id);
  };

  const handleDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (!draggedTabId) return;
    const from = openTabs.findIndex(tab => tab.id === draggedTabId);
    if (from >= 0) reorderTabs(from, targetIndex);
    setDraggedTabId(null);
  };

  return <div ref={barRef} className="panvas-document-tabs relative flex h-9 min-w-0 items-center border-b border-panvas-border-subtle bg-panvas-bg-secondary/70 px-2" role="tablist" aria-label="Open documents">
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none]">
      {openTabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`group flex h-7 max-w-56 min-w-28 shrink-0 items-center gap-0.5 rounded-md px-1 text-xs transition-colors ${activeTabId === tab.id ? 'bg-panvas-bg-elevated text-panvas-text-primary shadow-sm' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover'}`}
          draggable
          onDragStart={() => setDraggedTabId(tab.id)}
          onDragOver={event => event.preventDefault()}
          onDrop={event => handleDrop(event, index)}
          onMouseDown={event => { if (event.button === 1) { event.preventDefault(); closeTab(tab.id); } }}
          onContextMenu={event => { event.preventDefault(); setContextTabId(tab.id); }}
        >
          <button type="button" role="tab" aria-selected={activeTabId === tab.id} onClick={() => activate(tab)} className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left focus-ring" title={tab.title}>
            <TabIcon type={tab.type} />
            <span className="min-w-0 flex-1 truncate">{tab.title}</span>
          </button>
          <button type="button" onClick={event => handleClose(event, tab)} aria-label={`Close ${tab.title}`} title={`Close ${tab.title}`} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-panvas-text-tertiary opacity-0 transition-opacity hover:bg-panvas-bg-active hover:text-panvas-text-primary focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"><X size={12} /></button>
        </div>
      ))}
      {draggedTabId && <button type="button" onDragOver={event => event.preventDefault()} onDrop={event => { const tab = openTabs.find(item => item.id === draggedTabId); if (tab?.pageId) openTabInSplit(tab.id); setDraggedTabId(null); }} className="h-7 shrink-0 rounded-md border border-dashed border-panvas-border-default px-2 text-2xs text-panvas-text-tertiary hover:bg-panvas-bg-hover">Drop for split</button>}
    </div>
    {contextTabId && <div role="menu" className="panvas-overlay absolute right-10 top-9 w-44 rounded-lg border border-panvas-border-default bg-panvas-bg-elevated p-1 shadow-glass-sm"><button type="button" role="menuitem" onClick={() => { openTabInSplit(contextTabId); setContextTabId(null); }} className="w-full rounded-md px-2.5 py-2 text-left text-xs text-panvas-text-secondary hover:bg-panvas-bg-hover">Open in Split View</button><button type="button" role="menuitem" onClick={() => { closeTab(contextTabId); setContextTabId(null); }} className="w-full rounded-md px-2.5 py-2 text-left text-xs text-panvas-text-secondary hover:bg-panvas-bg-hover">Close tab</button></div>}
  </div>;
}
