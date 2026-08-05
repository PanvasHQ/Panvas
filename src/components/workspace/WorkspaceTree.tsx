import React from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  MoreHorizontal,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';

interface WorkspaceTreeProps {
  workspaceId: string;
}

export function WorkspaceTree({ workspaceId }: WorkspaceTreeProps) {
  const { folders, canvasFiles, activeCanvasId, setActiveCanvas } = useWorkspaceStore();
  const { openContextMenu, renamingId, setRenamingId } = useUIStore();

  const rootFolders = folders.filter(f => f.parentId === null && f.workspaceId === workspaceId);
  const rootCanvases = canvasFiles.filter(c => c.folderId === null && c.workspaceId === workspaceId);

  return (
    <div className="space-y-0.5">
      {rootFolders.map(folder => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={0}
          folders={folders}
          canvasFiles={canvasFiles}
          activeCanvasId={activeCanvasId}
          onSelectCanvas={setActiveCanvas}
          onContextMenu={openContextMenu}
          renamingId={renamingId}
          setRenamingId={setRenamingId}
        />
      ))}

      {rootCanvases.map(canvas => (
        <CanvasNode
          key={canvas.id}
          canvas={canvas}
          depth={0}
          isActive={activeCanvasId === canvas.id}
          onSelect={() => setActiveCanvas(canvas.id)}
          onContextMenu={openContextMenu}
          renamingId={renamingId}
          setRenamingId={setRenamingId}
        />
      ))}

      {rootFolders.length === 0 && rootCanvases.length === 0 && (
        <div className="px-2 py-3 text-center text-xs text-panvas-text-tertiary">
          Empty workspace
        </div>
      )}
    </div>
  );
}

interface FolderNodeProps {
  folder: { id: string; name: string; workspaceId: string; isExpanded?: boolean };
  depth: number;
  folders: { id: string; parentId: string | null; name: string; workspaceId: string; isExpanded?: boolean }[];
  canvasFiles: { id: string; folderId: string | null; name: string; isPinned: boolean }[];
  activeCanvasId: string | null;
  onSelectCanvas: (id: string | null) => void;
  onContextMenu: (x: number, y: number, targetId: string, targetType: 'workspace' | 'folder' | 'canvas') => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}

function FolderNode({
  folder,
  depth,
  folders,
  canvasFiles,
  activeCanvasId,
  onSelectCanvas,
  onContextMenu,
  renamingId,
  setRenamingId,
}: FolderNodeProps) {
  const { toggleFolderExpanded, renameFolder, moveCanvas } = useWorkspaceStore();
  const isExpanded = folder.isExpanded !== false;
  const childFolders = folders.filter(f => f.parentId === folder.id);
  const childCanvases = canvasFiles.filter(c => c.folderId === folder.id);
  const isRenaming = renamingId === folder.id;
  const [renameValue, setRenameValue] = React.useState(folder.name);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      await renameFolder(folder.id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
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
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      
      if (data.type === 'canvas') {
        await moveCanvas(data.id, folder.workspaceId, folder.id);
      }
    } catch (err) {
      console.warn('Invalid drop payload', err);
    }
  };

  return (
    <div>
      <div
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleFolderExpanded(folder.id);
          }
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border-l-2 text-sm font-medium
                    hover:bg-panvas-bg-hover transition-colors group cursor-pointer text-panvas-text-secondary
                    ${isDragOver ? 'border-panvas-text-primary bg-panvas-bg-hover' : 'border-transparent'}`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => toggleFolderExpanded(folder.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY, folder.id, 'folder');
        }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ChevronRight
          size={14}
          className={`flex-shrink-0 transition-transform duration-200 text-panvas-text-tertiary hover:text-panvas-text-primary ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        {isExpanded ? (
          <FolderOpen size={16} className="flex-shrink-0 text-panvas-text-secondary" />
        ) : (
          <Folder size={16} className="flex-shrink-0 text-panvas-text-tertiary" />
        )}

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setRenamingId(null);
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-transparent text-sm text-panvas-text-primary outline-none
                       border-b border-panvas-border-strong py-0"
          />
        ) : (
          <span className="truncate flex-1 text-left">{folder.name}</span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e.clientX, e.clientY, folder.id, 'folder');
          }}
          className="btn-icon p-1 opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {childFolders.map(cf => (
              <FolderNode
                key={cf.id}
                folder={cf}
                depth={depth + 1}
                folders={folders}
                canvasFiles={canvasFiles}
                activeCanvasId={activeCanvasId}
                onSelectCanvas={onSelectCanvas}
                onContextMenu={onContextMenu}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
              />
            ))}
            {childCanvases.map(cc => (
              <CanvasNode
                key={cc.id}
                canvas={cc}
                depth={depth + 1}
                isActive={activeCanvasId === cc.id}
                onSelect={() => onSelectCanvas(cc.id)}
                onContextMenu={onContextMenu}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CanvasNodeProps {
  canvas: { id: string; name: string; isPinned: boolean };
  depth: number;
  isActive: boolean;
  onSelect: () => void;
  onContextMenu: (x: number, y: number, targetId: string, targetType: 'workspace' | 'folder' | 'canvas') => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}

function CanvasNode({
  canvas,
  depth,
  isActive,
  onSelect,
  onContextMenu,
  renamingId,
  setRenamingId,
}: CanvasNodeProps) {
  const { renameCanvas } = useWorkspaceStore();
  const isRenaming = renamingId === canvas.id;
  const [renameValue, setRenameValue] = React.useState(canvas.name);

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== canvas.name) {
      await renameCanvas(canvas.id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'canvas', id: canvas.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md border-l-2 text-sm font-medium
                  hover:bg-panvas-bg-hover transition-colors group cursor-pointer
                  ${isActive ? 'border-panvas-text-primary bg-panvas-bg-hover text-panvas-text-primary' : 'border-transparent text-panvas-text-secondary'}`}
      style={{ paddingLeft: `${depth * 14 + 32}px` }}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY, canvas.id, 'canvas');
      }}
      draggable
      onDragStart={handleDragStart}
    >
      <FileText
        size={16}
        className={`flex-shrink-0 ${isActive ? 'text-panvas-text-primary' : 'text-panvas-text-tertiary'}`}
      />

      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={e => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setRenamingId(null);
          }}
          onClick={e => e.stopPropagation()}
          className="flex-1 bg-transparent text-sm text-panvas-text-primary outline-none
                     border-b border-panvas-border-strong py-0"
        />
      ) : (
        <span className="truncate flex-1 text-left">{canvas.name}</span>
      )}

      {canvas.isPinned && (
        <Star size={12} className="flex-shrink-0 text-panvas-accent-amber fill-panvas-accent-amber" />
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e.clientX, e.clientY, canvas.id, 'canvas');
        }}
        className="btn-icon p-1 opacity-0 group-hover:opacity-100"
      >
        <MoreHorizontal size={14} />
      </button>
    </div>
  );
}
