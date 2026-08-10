import React from 'react';
import { BookOpen, ChevronRight, FileText, Folder, FolderOpen, MoreHorizontal, Plus, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import type { Notebook, NotebookPage, NotebookSection } from '@/types/notebook';
import type { CanvasFile, Folder as WorkspaceFolder } from '@/types/workspace';

export type DropPosition = 'before' | 'inside' | 'after';

export function getReorderedIds(items: any[], draggedId: string, targetId: string, position: 'before' | 'after') {
  const filtered = items.filter(i => i.id !== draggedId);
  const targetIndex = filtered.findIndex(i => i.id === targetId);
  if (targetIndex === -1) return items.map(i => i.id);
  const draggedItem = items.find(i => i.id === draggedId);
  if (!draggedItem) return items.map(i => i.id);
  filtered.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, draggedItem);
  return filtered.map(i => i.id);
}

export function WorkspaceTree({ workspaceId }: { workspaceId: string }) {
  const { folders, notebooks, canvasFiles, moveCanvas, moveNotebook, moveFolder, reorderItems } = useWorkspaceStore();
  const [isDragOverRoot, setIsDragOverRoot] = React.useState(false);

  const rootFolders = folders.filter(folder => folder.workspaceId === workspaceId && folder.parentId === null);
  const rootNotebooks = notebooks.filter(notebook => notebook.workspaceId === workspaceId && notebook.folderId === null);
  const rootCanvases = canvasFiles.filter(canvas => canvas.workspaceId === workspaceId && canvas.folderId === null);

  const handleRootDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOverRoot(false);
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.type === 'canvas') {
        const item = canvasFiles.find(c => c.id === data.id);
        if (item && item.folderId !== null) await moveCanvas(data.id, workspaceId, null);
      }
      else if (data.type === 'notebook') {
        const item = notebooks.find(n => n.id === data.id);
        if (item && item.folderId !== null) await moveNotebook(data.id, workspaceId, null);
      }
      else if (data.type === 'folder') {
        const item = folders.find(f => f.id === data.id);
        if (item && item.parentId !== null) await moveFolder(data.id, workspaceId, null);
      }
    } catch { /* Ignore */ }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOverRoot(true); }}
      onDragLeave={() => setIsDragOverRoot(false)}
      onDrop={handleRootDrop}
      className={`space-y-0.5 min-h-[40px] rounded-md transition-colors ${isDragOverRoot ? 'bg-panvas-bg-hover/60 border border-dashed border-panvas-border-strong' : ''}`}
    >
      {rootFolders.map(folder => <FolderNode key={folder.id} folder={folder} depth={0} />)}
      {rootNotebooks.map(notebook => <NotebookNode key={notebook.id} notebook={notebook} depth={0} />)}
      {rootCanvases.map(canvas => <CanvasNode key={canvas.id} canvas={canvas} depth={0} />)}
      {rootFolders.length === 0 && rootNotebooks.length === 0 && rootCanvases.length === 0 && (
        <div className="px-2 py-3 text-center text-xs text-panvas-text-tertiary">Empty workspace</div>
      )}
    </div>
  );
}

function FolderNode({ folder, depth }: { folder: WorkspaceFolder; depth: number }) {
  const { folders, notebooks, canvasFiles, toggleFolderExpanded, moveCanvas, renameFolder, moveNotebook, moveFolder, reorderItems } = useWorkspaceStore();
  const { openContextMenu, renamingId, setRenamingId } = useUIStore();
  const [value, setValue] = React.useState(folder.name);
  const isRenaming = renamingId === folder.id;
  const save = async () => { if (value.trim() && value !== folder.name) await renameFolder(folder.id, value.trim()); setRenamingId(null); };

  const childFolders = folders.filter(item => item.parentId === folder.id);
  const childNotebooks = notebooks.filter(item => item.folderId === folder.id);
  const childCanvases = canvasFiles.filter(item => item.folderId === folder.id);
  const isExpanded = folder.isExpanded !== false;

  const handleDropItem = async (data: any, position: DropPosition) => {
    if (position === 'inside') {
      if (data.type === 'canvas') await moveCanvas(data.id, folder.workspaceId, folder.id);
      else if (data.type === 'notebook') await moveNotebook(data.id, folder.workspaceId, folder.id);
      else if (data.type === 'folder' && data.id !== folder.id) await moveFolder(data.id, folder.workspaceId, folder.id);
    } else {
      if (data.type !== 'folder') return;
      const siblings = folders.filter(f => f.workspaceId === folder.workspaceId && f.parentId === folder.parentId);
      const reorderedIds = getReorderedIds(siblings, data.id, folder.id, position);
      const draggedItem = folders.find(f => f.id === data.id);
      if (draggedItem && draggedItem.parentId !== folder.parentId) {
        await moveFolder(data.id, folder.workspaceId, folder.parentId);
      }
      await reorderItems('folder', reorderedIds);
    }
  };

  return (
    <div>
      <TreeRow
        depth={depth}
        expanded={isExpanded}
        badge={childFolders.length + childNotebooks.length + childCanvases.length || undefined}
        onClick={() => toggleFolderExpanded(folder.id)}
        onToggle={() => toggleFolderExpanded(folder.id)}
        onContextMenu={(event) => openContextMenu(event.clientX, event.clientY, folder.id, 'folder')}
        draggable
        onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }))}
        onDropItem={handleDropItem}
        acceptsDropInside
        icon={isExpanded ? <FolderOpen size={15} className="text-panvas-text-secondary" /> : <Folder size={15} className="text-panvas-text-tertiary" />}
        label={isRenaming ? <input autoFocus value={value} onChange={event => setValue(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setRenamingId(null); }} onClick={event => event.stopPropagation()} className="w-full bg-transparent outline-none" /> : folder.name}
      />
      <Collapsible open={isExpanded}>
        {childFolders.map(item => <FolderNode key={item.id} folder={item} depth={depth + 1} />)}
        {childNotebooks.map(item => <NotebookNode key={item.id} notebook={item} depth={depth + 1} />)}
        {childCanvases.map(item => <CanvasNode key={item.id} canvas={item} depth={depth + 1} />)}
      </Collapsible>
    </div>
  );
}

function NotebookNode({ notebook, depth }: { notebook: Notebook; depth: number }) {
  const { notebooks, notebookSections, notebookPages, toggleNotebookExpanded, setActiveNotebook, renameNotebook, activeNotebookId, moveNotebookSection, reorderItems, moveNotebook } = useWorkspaceStore();
  const { openContextMenu, renamingId, setRenamingId } = useUIStore();
  const [value, setValue] = React.useState(notebook.name);
  const isRenaming = renamingId === notebook.id;
  const isActive = activeNotebookId === notebook.id;
  const save = async () => { if (value.trim() && value !== notebook.name) await renameNotebook(notebook.id, value.trim()); setRenamingId(null); };
  
  const sections = notebookSections.filter(section => section.notebookId === notebook.id);

  const handleNotebookClick = () => {
    setActiveNotebook(notebook.id);
    if (!notebook.isExpanded) {
      toggleNotebookExpanded(notebook.id);
    }
  };

  const handleDropItem = async (data: any, position: DropPosition) => {
    if (position === 'inside') {
      if (data.type === 'section') await moveNotebookSection(data.id, notebook.workspaceId, notebook.id);
    } else {
      if (data.type !== 'notebook') return;
      const siblings = notebooks.filter(n => n.workspaceId === notebook.workspaceId && n.folderId === notebook.folderId);
      const reorderedIds = getReorderedIds(siblings, data.id, notebook.id, position);
      const draggedItem = notebooks.find(n => n.id === data.id);
      if (draggedItem && draggedItem.folderId !== notebook.folderId) {
        await moveNotebook(data.id, notebook.workspaceId, notebook.folderId);
      }
      await reorderItems('notebook', reorderedIds);
    }
  };

  return (
    <div>
      <TreeRow
        depth={depth}
        active={isActive}
        expanded={notebook.isExpanded}
        badge={sections.length || undefined}
        onClick={handleNotebookClick}
        onToggle={() => { setActiveNotebook(notebook.id); toggleNotebookExpanded(notebook.id); }}
        onContextMenu={(event) => openContextMenu(event.clientX, event.clientY, notebook.id, 'notebook')}
        draggable
        onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({ type: 'notebook', id: notebook.id }))}
        onDropItem={handleDropItem}
        acceptsDropInside
        icon={<BookOpen size={15} className="text-panvas-text-secondary" />}
        label={isRenaming ? <input autoFocus value={value} onChange={event => setValue(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setRenamingId(null); }} onClick={event => event.stopPropagation()} className="w-full bg-transparent outline-none" /> : notebook.name}
      />
      <Collapsible open={notebook.isExpanded}>
        {sections.map(section => <SectionNode key={section.id} section={section} pages={notebookPages.filter(page => page.sectionId === section.id)} depth={depth + 1} />)}
        {sections.length === 0 && <TreeEmptyState depth={depth + 1} label="No sections" />}
      </Collapsible>
    </div>
  );
}

function SectionNode({ section, pages, depth }: { section: NotebookSection; pages: NotebookPage[]; depth: number }) {
  const { notebooks, notebookSections, notebookPages, toggleNotebookSectionExpanded, setActiveNotebookSection, renameNotebookSection, activeNotebookSectionId, moveNotebookPage, reorderItems, moveNotebookSection } = useWorkspaceStore();
  const { openContextMenu, renamingId, setRenamingId } = useUIStore();
  const [value, setValue] = React.useState(section.name);
  const isRenaming = renamingId === section.id;
  const isActive = activeNotebookSectionId === section.id;
  const save = async () => { if (value.trim() && value !== section.name) await renameNotebookSection(section.id, value.trim()); setRenamingId(null); };

  const workspaceId = notebooks.find(n => n.id === section.notebookId)?.workspaceId || '';

  const handleSectionClick = () => {
    setActiveNotebookSection(section.id);
    if (!section.isExpanded) {
      toggleNotebookSectionExpanded(section.id);
    }
  };

  const handleDropItem = async (data: any, position: DropPosition) => {
    if (position === 'inside') {
      if (data.type === 'page') await moveNotebookPage(data.id, workspaceId, section.id);
    } else {
      if (data.type !== 'section') return;
      const siblings = notebookSections.filter(s => s.notebookId === section.notebookId);
      const reorderedIds = getReorderedIds(siblings, data.id, section.id, position);
      const draggedItem = notebookSections.find(s => s.id === data.id);
      if (draggedItem && draggedItem.notebookId !== section.notebookId) {
        await moveNotebookSection(data.id, workspaceId, section.notebookId);
      }
      await reorderItems('section', reorderedIds);
    }
  };

  return (
    <div>
      <TreeRow
        depth={depth}
        active={isActive}
        expanded={section.isExpanded}
        badge={pages.length || undefined}
        onClick={handleSectionClick}
        onToggle={() => { setActiveNotebookSection(section.id); toggleNotebookSectionExpanded(section.id); }}
        onContextMenu={(event) => openContextMenu(event.clientX, event.clientY, section.id, 'section')}
        draggable
        onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({ type: 'section', id: section.id, notebookId: section.notebookId }))}
        onDropItem={handleDropItem}
        acceptsDropInside
        icon={<ChevronRight size={13} className="text-panvas-text-tertiary" />}
        label={isRenaming ? <input autoFocus value={value} onChange={event => setValue(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setRenamingId(null); }} onClick={event => event.stopPropagation()} className="w-full bg-transparent outline-none" /> : section.name}
      />
      <Collapsible open={section.isExpanded}>
        {pages.map(page => <PageNode key={page.id} page={page} depth={depth + 1} />)}
        {pages.length === 0 && <TreeEmptyState depth={depth + 1} label="No pages" />}
      </Collapsible>
    </div>
  );
}

function PageNode({ page, depth }: { page: NotebookPage; depth: number }) {
  const { notebooks, notebookSections, notebookPages, activePageId, setActivePage, renameNotebookPage, moveNotebookPage, reorderItems } = useWorkspaceStore();
  const { openContextMenu, renamingId, setRenamingId } = useUIStore();
  const [value, setValue] = React.useState(page.title);
  const isRenaming = renamingId === page.id;
  const save = async () => { if (value.trim() && value !== page.title) await renameNotebookPage(page.id, value.trim()); setRenamingId(null); };

  const section = notebookSections.find(s => s.id === page.sectionId);
  const workspaceId = section ? notebooks.find(n => n.id === section.notebookId)?.workspaceId || '' : '';

  const handleDropItem = async (data: any, position: DropPosition) => {
    if (position === 'inside') return;
    if (data.type !== 'page') return;
    const siblings = notebookPages.filter(p => p.sectionId === page.sectionId);
    const reorderedIds = getReorderedIds(siblings, data.id, page.id, position);
    const draggedItem = notebookPages.find(p => p.id === data.id);
    if (draggedItem && draggedItem.sectionId !== page.sectionId) {
      await moveNotebookPage(data.id, workspaceId, page.sectionId);
    }
    await reorderItems('page', reorderedIds);
  };

  return (
    <TreeRow
      depth={depth}
      active={activePageId === page.id}
      onClick={() => setActivePage(page.id)}
      onContextMenu={(event) => openContextMenu(event.clientX, event.clientY, page.id, 'page')}
      draggable
      onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({ type: 'page', id: page.id, sectionId: page.sectionId }))}
      onDropItem={handleDropItem}
      icon={<FileText size={15} className="text-panvas-text-tertiary" />}
      label={isRenaming ? <input autoFocus value={value} onChange={event => setValue(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setRenamingId(null); }} onClick={event => event.stopPropagation()} className="w-full bg-transparent outline-none" /> : page.title}
    />
  );
}

function CanvasNode({ canvas, depth }: { canvas: CanvasFile; depth: number }) {
  const { canvasFiles, activeCanvasId, setActiveCanvas, renameCanvas, moveCanvas, reorderItems } = useWorkspaceStore();
  const { openContextMenu, renamingId, setRenamingId } = useUIStore();
  const [value, setValue] = React.useState(canvas.name);
  const isRenaming = renamingId === canvas.id;
  const save = async () => { if (value.trim() && value !== canvas.name) await renameCanvas(canvas.id, value.trim()); setRenamingId(null); };

  const handleDropItem = async (data: any, position: DropPosition) => {
    if (position === 'inside') return;
    if (data.type !== 'canvas') return;
    const siblings = canvasFiles.filter(c => c.workspaceId === canvas.workspaceId && c.folderId === canvas.folderId);
    const reorderedIds = getReorderedIds(siblings, data.id, canvas.id, position);
    const draggedItem = canvasFiles.find(c => c.id === data.id);
    if (draggedItem && draggedItem.folderId !== canvas.folderId) {
      await moveCanvas(data.id, canvas.workspaceId, canvas.folderId);
    }
    await reorderItems('canvas', reorderedIds);
  };

  return (
    <TreeRow
      depth={depth}
      active={activeCanvasId === canvas.id}
      onClick={() => setActiveCanvas(canvas.id)}
      onContextMenu={(event) => openContextMenu(event.clientX, event.clientY, canvas.id, 'canvas')}
      draggable
      onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({ type: 'canvas', id: canvas.id }))}
      onDropItem={handleDropItem}
      icon={<FileText size={16} className="text-panvas-text-tertiary" />}
      label={isRenaming ? <input autoFocus value={value} onChange={event => setValue(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setRenamingId(null); }} onClick={event => event.stopPropagation()} className="w-full bg-transparent outline-none" /> : canvas.name}
      trailing={canvas.isPinned ? <Star size={12} className="text-panvas-accent-amber fill-panvas-accent-amber" /> : undefined}
    />
  );
}

function TreeRow({ depth, label, icon, expanded, active = false, onClick, onToggle, onContextMenu, trailing, badge, draggable, onDragStart, onDropItem, acceptsDropInside = false }: { depth: number; label: React.ReactNode; icon: React.ReactNode; expanded?: boolean; active?: boolean; onClick?: () => void; onToggle?: () => void; onContextMenu?: (event: React.MouseEvent) => void; trailing?: React.ReactNode; badge?: number; draggable?: boolean; onDragStart?: (event: React.DragEvent) => void; onDropItem?: (data: any | null, position: DropPosition, files?: FileList) => void; acceptsDropInside?: boolean }) {
  const activate = () => onClick?.();
  const [dragPosition, setDragPosition] = React.useState<DropPosition | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let pos: DropPosition = 'inside';
    if (y < rect.height * 0.25) pos = 'before';
    else if (y > rect.height * 0.75) pos = 'after';
    else pos = acceptsDropInside ? 'inside' : (y < rect.height / 2 ? 'before' : 'after');
    setDragPosition(pos);
  };

  const handleDragLeave = () => setDragPosition(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = dragPosition;
    setDragPosition(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw && (!e.dataTransfer.files || e.dataTransfer.files.length === 0)) return;
    try {
      const data = raw ? JSON.parse(raw) : null;
      onDropItem?.(data, pos || 'inside', e.dataTransfer.files);
    } catch {}
  };

  let dragClass = '';
  if (dragPosition === 'before') dragClass = 'before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-panvas-text-primary';
  else if (dragPosition === 'after') dragClass = 'before:absolute before:inset-x-2 before:bottom-0 before:h-px before:bg-panvas-text-primary';
  else if (dragPosition === 'inside') dragClass = 'bg-panvas-bg-hover';

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative flex h-7 items-center gap-1.5 rounded-md border-l-2 px-2 text-xs transition-colors duration-150 ${active ? 'border-panvas-text-primary bg-panvas-bg-hover text-panvas-text-primary' : 'border-transparent text-panvas-text-secondary hover:bg-panvas-bg-hover'} ${dragClass}`}
      style={{ paddingLeft: `${depth * 16 + 10}px` }}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={event => { event.stopPropagation(); onToggle(); }}
          className="flex h-4 w-4 items-center justify-center rounded text-panvas-text-tertiary hover:text-panvas-text-primary"
        >
          <ChevronRight size={13} className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
        </button>
      ) : (
        <span className="w-4" />
      )}
      <span className="flex-shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {badge !== undefined && <span className="text-2xs text-panvas-text-tertiary group-hover:hidden">{badge}</span>}
      {trailing}
      <button
        type="button"
        onClick={event => { event.stopPropagation(); onContextMenu?.(event); }}
        className="btn-icon hidden p-1 group-hover:flex"
      >
        <MoreHorizontal size={13} />
      </button>
    </div>
  );
}

function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <AnimatePresence>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="overflow-hidden">{children}</motion.div>}</AnimatePresence>;
}

function TreeEmptyState({ depth, label }: { depth: number; label: string }) {
  return <div className="h-7 px-2 text-xs italic leading-7 text-panvas-text-tertiary" style={{ paddingLeft: `${depth * 16 + 30}px` }}>{label}</div>;
}
