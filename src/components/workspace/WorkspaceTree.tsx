// ============================================
// Panvas — Workspace Tree
// ============================================

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

  // Build tree structure
  const rootFolders = folders.filter(f => f.parentId === null);
  const rootCanvases = canvasFiles.filter(c => c.folderId === null);

  return (
    <div className="space-y-0.5">
      {/* Root Folders */}
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

      {/* Root Canvases */}
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
        <div className="px-2 py-3 text-center text-2xs text-panvas-text-tertiary">
          No items yet. Create a canvas or folder.
        </div>
      )}
    </div>
  );
}

// ---- Folder Node ----

interface FolderNodeProps {
  folder: { id: string; name: string; isExpanded?: boolean };
  depth: number;
  folders: { id: string; parentId: string | null; name: string; isExpanded?: boolean }[];
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
  const { toggleFolderExpanded, renameFolder } = useWorkspaceStore();
  const isExpanded = folder.isExpanded !== false;
  const childFolders = folders.filter(f => f.parentId === folder.id);
  const childCanvases = canvasFiles.filter(c => c.folderId === folder.id);
  const isRenaming = renamingId === folder.id;
  const [renameValue, setRenameValue] = React.useState(folder.name);

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      await renameFolder(folder.id, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div>
      <div
        className="sidebar-item group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => toggleFolderExpanded(folder.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY, folder.id, 'folder');
        }}
      >
        <ChevronRight
          size={12}
          className={`flex-shrink-0 transition-transform duration-150 text-panvas-text-tertiary ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        {isExpanded ? (
          <FolderOpen size={14} className="flex-shrink-0 text-panvas-accent-amber" />
        ) : (
          <Folder size={14} className="flex-shrink-0 text-panvas-accent-amber/70" />
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
            className="flex-1 bg-transparent text-xs text-panvas-text-primary outline-none
                       border-b border-panvas-accent-violet/50 py-0"
          />
        ) : (
          <span className="truncate text-xs">{folder.name}</span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e.clientX, e.clientY, folder.id, 'folder');
          }}
          className="ml-auto btn-icon p-0.5 opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeInOut' }}
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

// ---- Canvas Node ----

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

  return (
    <div
      className={`sidebar-item group ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY, canvas.id, 'canvas');
      }}
    >
      <FileText
        size={14}
        className={`flex-shrink-0 ${isActive ? 'text-panvas-accent-violet' : 'opacity-40'}`}
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
          className="flex-1 bg-transparent text-xs text-panvas-text-primary outline-none
                     border-b border-panvas-accent-violet/50 py-0"
        />
      ) : (
        <span className="truncate text-xs">{canvas.name}</span>
      )}

      {canvas.isPinned && (
        <Star size={10} className="flex-shrink-0 text-panvas-accent-amber fill-panvas-accent-amber" />
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e.clientX, e.clientY, canvas.id, 'canvas');
        }}
        className="ml-auto btn-icon p-0.5 opacity-0 group-hover:opacity-100"
      >
        <MoreHorizontal size={12} />
      </button>
    </div>
  );
}
