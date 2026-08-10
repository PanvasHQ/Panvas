import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  FileText,
  Folder,
  Plus,
  Home,
  ListTree,
  ChevronDown,
  Clock3,
  HardDrive,
  MoreHorizontal,
  Star,
  Tag,
  Trash2,
  FileUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { WorkspaceTree } from '@/components/workspace/WorkspaceTree';
import { TrashSection } from './TrashSection';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { notebookRepository } from '@/repositories/NotebookRepository';

export function Sidebar() {
  const {
    workspaces,
    activeWorkspaceId,
    expandedWorkspaceIds,
    loadRecentFiles,
    loadTrash,
    setActiveWorkspace,
    toggleWorkspaceExpanded,
    activeCanvasId,
    setActiveCanvas,
    activeNotebookId,
    setActiveNotebook,
    activeNotebookSectionId,
    activePageId,
    setActivePage,
    setActiveNotebookSection,
    notebooks,
    canvasFiles,
    deletedWorkspaces,
    deletedFolders,
    deletedCanvases,
    notebookSections
  } = useWorkspaceStore();

  const { openCreateDialog, openContextMenu, showToast } = useUIStore();
  const { user } = useAuthStore();
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importTargetSectionId = React.useRef<string | null>(null);

  const handlePdfImport = async (file: File, sectionId: string) => {
    const section = notebookSections.find(s => s.id === sectionId);
    if (!section) return;
    
    const workspaceId = workspaces.find(w => w.id === activeWorkspaceId)?.id || sectionId; 
    // ^ just a fallback, workspaceId should really be found from notebook
    const notebook = notebooks.find(n => n.id === section.notebookId);
    if (!notebook) return;

    try {
      showToast('Importing PDF...', 'info');
      const buffer = await file.arrayBuffer();
      const pdfData = await canvasRepository.storePdf(user?.id || null, 'temp', file.name, buffer);
      
      const page = await notebookRepository.createPage(
        user?.id || null,
        notebook.workspaceId,
        notebook.id,
        section.id,
        file.name,
        'pdf',
        pdfData.id
      );

      // Navigate to the newly imported page
      setActiveNotebook(notebook.id);
      setActiveNotebookSection(section.id);
      setActivePage(page.id);
      showToast(`Imported ${file.name}`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to import PDF: ${err.message}`, 'error');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf' && importTargetSectionId.current) {
      handlePdfImport(file, importTargetSectionId.current);
    } else if (file) {
      showToast('Only PDF files are supported right now.', 'error');
    }
    importTargetSectionId.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const handleImportEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.sectionId) {
        importTargetSectionId.current = customEvent.detail.sectionId;
        if (customEvent.detail.file) {
          // Direct file drop
          handlePdfImport(customEvent.detail.file, customEvent.detail.sectionId);
          importTargetSectionId.current = null;
        } else {
          // Open file picker
          fileInputRef.current?.click();
        }
      }
    };
    
    window.addEventListener('panvas:import-pdf', handleImportEvent);
    window.addEventListener('panvas:import-pdf-file', handleImportEvent);
    return () => {
      window.removeEventListener('panvas:import-pdf', handleImportEvent);
      window.removeEventListener('panvas:import-pdf-file', handleImportEvent);
    };
  }, [notebookSections, notebooks, workspaces, activeWorkspaceId, user]);

  useEffect(() => {
    loadRecentFiles();
    loadTrash();
  }, [loadRecentFiles, loadTrash]);

  return (
    <aside className="h-full w-full flex-shrink-0 flex flex-col bg-panvas-bg-primary border-r border-panvas-border-subtle text-xs">
      <input 
        type="file" 
        accept="application/pdf" 
        ref={fileInputRef} 
        onChange={handleFileInputChange}
        className="hidden" 
      />
      
      <div className="px-3 pt-3 pb-2.5 flex-shrink-0">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <span className="text-[10px] font-semibold tracking-[0.13em] text-panvas-text-tertiary uppercase">Library</span>
          <span className="text-2xs text-panvas-text-tertiary">Local</span>
        </div>
        <button
          onClick={() => setIsNewMenuOpen(open => !open)}
          className="w-full h-8 flex items-center justify-center gap-1.5 px-2 rounded-md
                     border border-panvas-border-default bg-panvas-bg-secondary text-panvas-text-primary font-medium
                     hover:bg-panvas-bg-hover hover:border-panvas-border-strong active:bg-panvas-bg-active
                     transition-colors duration-150 focus-ring"
        >
          <Plus size={14} />
          <span>New item</span>
          <ChevronDown size={13} className="ml-0.5 text-panvas-text-tertiary" />
        </button>
        {isNewMenuOpen && (
          <div className="relative">
            <div className="absolute left-0 right-0 top-1 z-30 rounded-md border border-panvas-border-default bg-panvas-bg-elevated p-1 shadow-glass-sm">
              <NewItemAction icon={<Folder size={14} />} label="New Folder" onClick={() => openCreateDialog('folder')} close={() => setIsNewMenuOpen(false)} />
              <NewItemAction icon={<BookOpen size={14} />} label="New Notebook" onClick={() => openCreateDialog('notebook')} close={() => setIsNewMenuOpen(false)} />
              <NewItemAction icon={<ListTree size={14} />} label="New Section" onClick={() => activeNotebookId ? openCreateDialog('section', activeNotebookId) : showToast('Select a notebook first', 'info')} close={() => setIsNewMenuOpen(false)} />
              <NewItemAction icon={<FileText size={14} />} label="New Page" onClick={() => activeNotebookSectionId ? openCreateDialog('page', activeNotebookSectionId) : showToast('Select a section first', 'info')} close={() => setIsNewMenuOpen(false)} />
              <div className="my-1 h-px bg-panvas-border-subtle" />
              <NewItemAction icon={<FileText size={14} />} label="New Canvas" onClick={() => openCreateDialog('canvas')} close={() => setIsNewMenuOpen(false)} />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-4">
        <nav aria-label="Library navigation" className="space-y-0.5">
          <SidebarNavItem 
            icon={<Home size={16} />} 
            label="Home" 
            isActive={!activeCanvasId && !activePageId} 
            onClick={() => { setActiveCanvas(null); setActivePage(null); setActiveNotebook(null); }} 
          />
        </nav>

        <section aria-labelledby="workspaces-heading">
          <div className="flex items-center justify-between px-2 pb-1.5 group">
            <span id="workspaces-heading" className="text-[10px] font-semibold tracking-[0.12em] text-panvas-text-tertiary uppercase">Workspaces</span>
            <button 
              onClick={() => openCreateDialog('workspace')} 
              className="p-1 -mr-1 rounded text-panvas-text-tertiary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors duration-150 focus-ring"
              aria-label="Create workspace"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-0.5">
            {workspaces.map(workspace => (
              <SidebarSection
                key={workspace.id}
                title={workspace.name}
                icon={
                  <div className={`w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-semibold
                    ${activeWorkspaceId === workspace.id ? 'bg-panvas-text-primary text-panvas-bg-primary' : 'bg-panvas-bg-active text-panvas-text-secondary'}
                  `}>
                    {workspace.name.charAt(0)}
                  </div>
                }
                actions={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openContextMenu(e.clientX, e.clientY, workspace.id, 'workspace');
                    }}
                    className="btn-icon p-1 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                }
                onHeaderClick={() => setActiveWorkspace(workspace.id)}
                isActive={activeWorkspaceId === workspace.id}
                isExpanded={expandedWorkspaceIds.has(workspace.id)}
                onToggleExpanded={() => toggleWorkspaceExpanded(workspace.id)}
                workspaceId={workspace.id}
              >
                <div className="ml-2.5 border-l border-panvas-border-subtle/70 pl-0.5">
                  <WorkspaceTree workspaceId={workspace.id} />
                </div>
              </SidebarSection>
            ))}
          </div>
        </section>


      </div>

      <div className="px-3 py-2.5 border-t border-panvas-border-subtle bg-panvas-bg-primary flex-shrink-0">
        <div className="flex items-center gap-2 text-2xs text-panvas-text-tertiary">
          <HardDrive size={13} />
          <div className="min-w-0"><div className="font-medium text-panvas-text-secondary">Local storage</div><div className="mt-0.5">Stored on this device</div></div>
        </div>
      </div>
    </aside>
  );
}

function NewItemAction({ icon, label, onClick, close }: { icon: React.ReactNode; label: string; onClick: () => void; close: () => void }) {
  return <button onClick={() => { onClick(); close(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary"><span className="text-panvas-text-tertiary">{icon}</span>{label}</button>;
}

function SidebarNavItem({ icon, label, isActive, onClick, badge, placeholder = false }: { icon: React.ReactNode, label: string, isActive?: boolean, onClick?: () => void, badge?: number, placeholder?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={placeholder}
      title={placeholder ? `${label} view will be available in a future phase` : label}
      className={`w-full h-7 flex items-center gap-2 px-2 rounded-md border-l-2 text-xs transition-colors duration-150 focus-ring
      ${isActive ? 'border-panvas-text-primary bg-panvas-bg-hover text-panvas-text-primary font-medium' : 'border-transparent text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'} ${placeholder ? 'cursor-default opacity-75' : ''}`}>
      <div className={isActive ? 'text-panvas-text-primary' : 'text-panvas-text-tertiary'}>{icon}</div>
      <span>{label}</span>
      {badge !== undefined && <span className="ml-auto min-w-4 rounded-full bg-panvas-bg-active px-1 text-center text-2xs leading-4 text-panvas-text-tertiary">{badge}</span>}
    </button>
  );
}

function ExplorerTypeRow({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return <div className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-panvas-text-secondary"><span className="text-panvas-text-tertiary">{icon}</span><span>{label}</span>{count !== undefined && <span className="ml-auto text-2xs text-panvas-text-tertiary">{count}</span>}</div>;
}

function TagChip({ label, color }: { label: string; color: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-panvas-border-subtle bg-panvas-bg-secondary px-2 py-1 text-2xs text-panvas-text-secondary"><span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />{label}</span>;
}

interface SidebarSectionProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onHeaderClick?: () => void;
  isActive?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  workspaceId?: string;
}

function SidebarSection({
  title,
  icon,
  actions,
  children,
  onHeaderClick,
  isActive,
  defaultExpanded = true,
  isExpanded: controlledIsExpanded,
  onToggleExpanded,
  workspaceId,
}: SidebarSectionProps) {
  const [localIsExpanded, setLocalIsExpanded] = React.useState(defaultExpanded);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;
  
  const handleToggle = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setLocalIsExpanded(!isExpanded);
    }
  };

  const [isDragOver, setIsDragOver] = React.useState(false);
  const { moveFolder, moveCanvas } = useWorkspaceStore();

  const handleDragOver = (e: React.DragEvent) => {
    if (!workspaceId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!workspaceId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      
      if (data.type === 'folder') {
        await moveFolder(data.id, workspaceId);
      } else if (data.type === 'canvas') {
        await moveCanvas(data.id, workspaceId, null);
      }
    } catch (err) {
      console.warn('Invalid drop payload', err);
    }
  };

  return (
    <div className="group">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          handleToggle();
          onHeaderClick?.();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggle();
            onHeaderClick?.();
          }
        }}
        className={`w-full h-7 flex items-center gap-2 px-2 rounded-md border-l-2 text-xs font-medium
                    hover:bg-panvas-bg-hover transition-colors duration-150 group cursor-pointer
                    ${isActive ? 'border-panvas-text-primary bg-panvas-bg-hover text-panvas-text-primary' : 'border-transparent text-panvas-text-secondary'}
                    ${isDragOver ? 'outline outline-1 outline-panvas-border-strong bg-panvas-bg-hover' : ''}`}
      >
        <ChevronDown
          size={13}
          className={`transition-transform duration-150 text-panvas-text-tertiary hover:text-panvas-text-primary ${isExpanded ? '' : '-rotate-90'}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        />
        {icon}
        <span className="truncate flex-1 text-left">{title}</span>
        <div className="flex items-center">{actions}</div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
