import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { OverlayManager } from '@/components/ui/OverlayManager';
import { ChevronRight, ChevronDown, Book, FolderOpen, FileText, Plus, ChevronRight as ChevronRightIcon } from 'lucide-react';
import type { Notebook, NotebookSection, NotebookPage } from '@/types/notebook';

interface DropdownProps {
  icon: React.ReactNode;
  label: string;
  items: { id: string; name: string }[];
  onSelect: (id: string) => void;
  activeId?: string;
}

function NavigatorDropdown({ icon, label, items, onSelect, activeId }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button 
        ref={buttonRef}
        className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors max-w-[150px] ${isOpen || activeId ? 'bg-panvas-bg-hover text-panvas-text-primary' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon}
        <span className="truncate font-medium">{label}</span>
        <ChevronDown size={14} className={`text-panvas-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <OverlayManager 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        anchorRef={buttonRef}
        placement="bottom-start"
      >
        <div className="w-48 bg-panvas-bg-elevated border border-panvas-border-subtle rounded-xl shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
            {items.length === 0 ? (
              <div className="px-2 py-2 text-xs text-panvas-text-tertiary text-center">Empty</div>
            ) : (
              items.map(item => (
                <button
                  key={item.id}
                  className={`w-full flex items-center px-2 py-1.5 text-xs rounded-md transition-colors text-left truncate focus-ring ${item.id === activeId ? 'bg-panvas-accent-blue/10 text-panvas-accent-blue font-medium' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'}`}
                  onClick={() => {
                    onSelect(item.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="truncate">{item.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </OverlayManager>
    </>
  );
}

// ─── NOTEBOOK MANAGER OVERLAY ─────────────────────────────────────────────

function NotebookManagerOverlay({ 
  notebooks, 
  sections, 
  pages, 
  activeNotebookId,
  activeSectionId,
  activePageId,
  onSelectNotebook,
  onSelectSection,
  onSelectPage,
  onClose
}: { 
  notebooks: Notebook[];
  sections: NotebookSection[];
  pages: NotebookPage[];
  activeNotebookId: string;
  activeSectionId?: string;
  activePageId: string;
  onSelectNotebook: (id: string) => void;
  onSelectSection: (id: string) => void;
  onSelectPage: (id: string) => void;
  onClose: () => void;
}) {
  const { openCreateDialog } = useUIStore();
  
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>(activeNotebookId);
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(activeSectionId);

  const selectedNotebook = notebooks.find(n => n.id === selectedNotebookId);
  const selectedSection = sections.find(s => s.id === selectedSectionId);

  const currentSections = sections.filter(s => s.notebookId === selectedNotebookId);
  const currentPages = pages.filter(p => p.sectionId === selectedSectionId);

  const handleSelectNotebook = (id: string) => {
    setSelectedNotebookId(id);
    const firstSection = sections.find(s => s.notebookId === id);
    setSelectedSectionId(firstSection?.id);
  };

  return (
    <div className="panvas-overlay flex max-h-[60vh] flex-row overflow-hidden rounded-xl border border-panvas-border-default bg-panvas-bg-elevated text-panvas-text-primary shadow-2xl max-[599px]:w-[min(24rem,calc(100vw-1.5rem))] max-[599px]:flex-col max-[599px]:overflow-y-auto">

      {/* COLUMN 1: Notebooks */}
      <div className="w-[220px] flex flex-col border-r border-panvas-border-subtle bg-panvas-bg-elevated flex-shrink-0 overflow-y-auto max-[599px]:w-full max-[599px]:border-r-0 max-[599px]:border-b">
        <div className="px-3 py-2 flex items-center justify-between border-b border-panvas-border-subtle sticky top-0 bg-panvas-bg-elevated z-10">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-panvas-text-tertiary">Notebooks</span>
        </div>
        <div className="py-1">
          <button 
            onClick={() => openCreateDialog('notebook')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-panvas-bg-hover transition-colors mb-1 text-panvas-text-tertiary hover:text-panvas-text-primary"
          >
            <Plus size={14} /> New Notebook
          </button>
          
          {notebooks.map(notebook => (
            <div 
              key={notebook.id}
              onClick={() => handleSelectNotebook(notebook.id)}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${notebook.id === selectedNotebookId ? 'bg-panvas-bg-active text-panvas-text-primary' : 'hover:bg-panvas-bg-hover text-panvas-text-secondary'}`}
            >
              <Book size={14} className={notebook.id === activeNotebookId ? 'text-panvas-accent-rose' : 'text-panvas-text-tertiary'} />
              <span className={`truncate flex-1 ${notebook.id === activeNotebookId ? 'font-medium text-panvas-text-primary' : 'text-panvas-text-secondary'}`}>
                {notebook.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* COLUMN 2: Sections */}
      <div className="w-[220px] flex flex-col border-r border-panvas-border-subtle bg-panvas-bg-secondary/60 flex-shrink-0 overflow-y-auto max-[599px]:w-full max-[599px]:border-r-0 max-[599px]:border-b">
        <div className="px-3 py-2 flex items-center justify-between border-b border-panvas-border-subtle sticky top-0 bg-panvas-bg-secondary z-10">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-panvas-text-tertiary truncate">
            {selectedNotebook?.name ?? 'No Notebook Selected'}
          </span>
        </div>
        <div className="py-1">
          {selectedNotebookId && (
            <button 
              onClick={() => openCreateDialog('section', selectedNotebookId)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-panvas-bg-hover transition-colors mb-1 text-panvas-text-tertiary hover:text-panvas-text-primary"
            >
              <Plus size={14} /> Add Section
            </button>
          )}

          {currentSections.map(section => (
            <div 
              key={section.id}
              onClick={() => setSelectedSectionId(section.id)}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${section.id === selectedSectionId ? 'bg-panvas-bg-active text-panvas-text-primary' : 'hover:bg-panvas-bg-hover text-panvas-text-secondary'}`}
            >
              <FolderOpen size={14} className={section.id === activeSectionId ? 'text-panvas-accent-blue' : 'text-panvas-text-tertiary'} />
              <span className={`truncate flex-1 ${section.id === activeSectionId ? 'font-medium text-panvas-text-primary' : 'text-panvas-text-secondary'}`}>
                {section.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* COLUMN 3: Pages */}
      <div className="w-[240px] flex flex-col bg-panvas-bg-elevated flex-shrink-0 pb-1 overflow-y-auto max-[599px]:w-full">
        <div className="px-3 py-2 flex items-center justify-between border-b border-panvas-border-subtle sticky top-0 bg-panvas-bg-elevated z-10 mb-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-panvas-text-tertiary truncate">
            {selectedSection?.name ?? 'No Section Selected'}
          </span>
        </div>
        <div className="py-1">
          {selectedSectionId && (
            <button 
              onClick={() => openCreateDialog('page', selectedSectionId)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-panvas-bg-hover transition-colors mb-1 text-panvas-text-tertiary hover:text-panvas-text-primary"
            >
              <Plus size={14} /> Add Page
            </button>
          )}

          {currentPages.map((page, index) => (
            <div 
              key={page.id}
              onClick={() => {
                onSelectPage(page.id);
                onClose();
              }}
              className={`flex flex-col gap-0.5 px-3 py-2 cursor-pointer transition-colors ${page.id === activePageId ? 'bg-panvas-bg-active text-panvas-text-primary' : 'hover:bg-panvas-bg-hover text-panvas-text-secondary'}`}
            >
              <span className={`text-xs truncate flex gap-1.5 ${page.id === activePageId ? 'font-medium text-panvas-text-primary' : 'text-panvas-text-secondary'}`}>
                <span className="opacity-50 font-mono w-3 text-right">{index + 1}.</span>
                <span>{page.title || 'Untitled Page'}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── MAIN NOTEBOOK NAVIGATOR ──────────────────────────────────────────────

export function NotebookNavigator() {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const managerRef = useRef<HTMLDivElement>(null);

  const { 
    notebooks, notebookSections, notebookPages, 
    activeWorkspaceId, activePageId, 
    setActivePage 
  } = useWorkspaceStore();
  const { notebookModeLevel, isNotebookPaneVisible } = useLayoutStore();
  const { isSidebarOpen } = useUIStore();

  const activePage = notebookPages.find(p => p.id === activePageId);
  const activeSection = notebookSections.find(s => s.id === activePage?.sectionId);
  const activeNotebook = notebooks.find(n => n.id === activePage?.notebookId);

  if (!activePage || !activeNotebook) return null;

  const currentNotebooks = notebooks.filter(n => n.workspaceId === activeNotebook.workspaceId);
  const currentSections = notebookSections.filter(s => s.notebookId === activeNotebook.id);
  const currentPages = notebookPages.filter(p => p.sectionId === activeSection?.id);

  if (notebookModeLevel === 0 && isSidebarOpen) return null;
  if (notebookModeLevel > 0 && !isNotebookPaneVisible) return null;

  const handleSelectNotebook = (notebookId: string) => {
    if (notebookId === activeNotebook.id) return;
    const firstSection = notebookSections.find(s => s.notebookId === notebookId);
    if (firstSection) {
      const firstPage = notebookPages.find(p => p.sectionId === firstSection.id);
      if (firstPage) setActivePage(firstPage.id);
    }
  };

  const handleSelectSection = (sectionId: string) => {
    if (sectionId === activeSection?.id) return;
    const firstPage = notebookPages.find(p => p.sectionId === sectionId);
    if (firstPage) setActivePage(firstPage.id);
  };

  const handleSelectPage = (pageId: string) => {
    setActivePage(pageId);
  };

  return (
    <div className="flex items-center gap-1 bg-panvas-bg-primary/80 backdrop-blur-md rounded-lg p-1 border border-panvas-border-subtle shadow-sm select-none shrink-0 min-w-0">
      
      <div ref={managerRef}>
        <button 
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors max-w-[150px]"
          onClick={() => setIsManagerOpen(!isManagerOpen)}
        >
          <Book size={14} className="text-panvas-text-tertiary" />
          <span className="truncate font-medium text-panvas-text-primary">{activeNotebook.name}</span>
          <ChevronDown size={14} className={`text-panvas-text-tertiary transition-transform ${isManagerOpen ? 'rotate-180' : ''}`} />
        </button>

        <OverlayManager
          isOpen={isManagerOpen}
          onClose={() => setIsManagerOpen(false)}
          anchorRef={managerRef}
          placement="bottom-start"
        >
          <NotebookManagerOverlay 
            notebooks={currentNotebooks}
            sections={notebookSections}
            pages={notebookPages}
            activeNotebookId={activeNotebook.id}
            activeSectionId={activeSection?.id}
            activePageId={activePage.id}
            onSelectNotebook={handleSelectNotebook}
            onSelectSection={handleSelectSection}
            onSelectPage={handleSelectPage}
            onClose={() => setIsManagerOpen(false)}
          />
        </OverlayManager>
      </div>

      <ChevronRight size={12} className="text-panvas-text-tertiary flex-shrink-0" />
      
      {activeSection && (
        <>
          <NavigatorDropdown 
            icon={<FolderOpen size={14} className="text-panvas-text-tertiary" />}
            label={activeSection.name}
            items={currentSections.map(s => ({ id: s.id, name: s.name }))}
            onSelect={handleSelectSection}
            activeId={activeSection.id}
          />
          <ChevronRight size={12} className="text-panvas-text-tertiary flex-shrink-0" />
        </>
      )}
      <NavigatorDropdown 
        icon={<FileText size={14} className="text-panvas-text-tertiary" />}
        label={activePage.title || 'Untitled Page'}
        items={currentPages.map(p => ({ id: p.id, name: p.title || 'Untitled Page' }))}
        onSelect={handleSelectPage}
        activeId={activePage.id}
      />
    </div>
  );
}
