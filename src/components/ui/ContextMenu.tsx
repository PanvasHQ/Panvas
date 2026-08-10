// ============================================
// Panvas — Context Menu
// ============================================

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Pencil,
  Trash2,
  Star,
  StarOff,
  Copy,
  FolderPlus,
  Plus,
  MoveRight,
  FileText,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function ContextMenu() {
  const { contextMenu, closeContextMenu, setRenamingId, openCreateDialog } = useUIStore();
  const {
    deleteWorkspace,
    deleteFolder,
    deleteCanvas,
    deleteNotebook,
    deleteNotebookSection,
    deleteNotebookPage,
    togglePinWorkspace,
    togglePinCanvas,
    setActiveWorkspace,
    duplicateCanvas,
  } = useWorkspaceStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu.isOpen, closeContextMenu]);

  if (!contextMenu.isOpen || !contextMenu.targetId || !contextMenu.targetType) {
    return null;
  }

  const { x, y, targetId, targetType } = contextMenu;

  const menuItems: { label: string; icon: React.ReactNode; action: () => void; danger?: boolean }[] = [];

  if (targetType === 'workspace' || targetType === 'folder' || targetType === 'canvas') {
    menuItems.push({
      label: 'Rename',
      icon: <Pencil size={13} />,
      action: () => { setRenamingId(targetId); closeContextMenu(); },
    });
  }

  // Pin/Unpin (workspace and canvas only)
  if (targetType === 'workspace' || targetType === 'canvas') {
    menuItems.push({
      label: 'Toggle Pin',
      icon: <Star size={13} />,
      action: () => {
        if (targetType === 'workspace') togglePinWorkspace(targetId);
        else togglePinCanvas(targetId);
        closeContextMenu();
      },
    });
    menuItems.push({
      label: 'New Notebook',
      icon: <BookOpen size={13} />,
      action: () => { setActiveWorkspace(targetId); openCreateDialog('notebook'); closeContextMenu(); },
    });
  }

  // Add sub-items (for folders and workspaces)
  if (targetType === 'workspace') {
    menuItems.push({
      label: 'New Canvas',
      icon: <Plus size={13} />,
      action: () => {
        setActiveWorkspace(targetId);
        openCreateDialog('canvas');
        closeContextMenu();
      },
    });
    menuItems.push({
      label: 'New Folder',
      icon: <FolderPlus size={13} />,
      action: () => {
        setActiveWorkspace(targetId);
        openCreateDialog('folder');
        closeContextMenu();
      },
    });
    menuItems.push({
      label: 'New Notebook Here',
      icon: <BookOpen size={13} />,
      action: () => { openCreateDialog('notebook', targetId); closeContextMenu(); },
    });
  }

  if (targetType === 'notebook') {
    menuItems.push({
      label: 'New Section',
      icon: <FolderPlus size={13} />,
      action: () => { openCreateDialog('section', targetId); closeContextMenu(); },
    });
  }

  if (targetType === 'section') {
    menuItems.push({
      label: 'New Page',
      icon: <Plus size={13} />,
      action: () => { openCreateDialog('page', targetId); closeContextMenu(); },
    });
    menuItems.push({
      label: 'Import PDF',
      icon: <FileText size={13} />,
      action: () => { 
        // We trigger the hidden file input in NotebookSidebar by dispatching a custom event
        window.dispatchEvent(new CustomEvent('panvas:import-pdf', { detail: { sectionId: targetId } }));
        closeContextMenu(); 
      },
    });
  }

  if (targetType === 'folder') {
    menuItems.push({
      label: 'New Canvas Here',
      icon: <Plus size={13} />,
      action: () => { openCreateDialog('canvas', targetId); closeContextMenu(); },
    });
    menuItems.push({
      label: 'New Subfolder',
      icon: <FolderPlus size={13} />,
      action: () => { openCreateDialog('folder', targetId); closeContextMenu(); },
    });
  }

  if (targetType === 'canvas') {
    menuItems.push({
      label: 'Duplicate Canvas',
      icon: <Copy size={13} />,
      action: () => { duplicateCanvas(targetId); closeContextMenu(); },
    });
  }

  // Delete
  if (
    targetType === 'workspace' || 
    targetType === 'folder' || 
    targetType === 'canvas' ||
    targetType === 'notebook' ||
    targetType === 'section' ||
    targetType === 'page'
  ) {
    menuItems.push({
      label: 'Delete',
      icon: <Trash2 size={13} />,
      danger: true,
      action: () => {
        if (targetType === 'workspace') deleteWorkspace(targetId);
        else if (targetType === 'folder') deleteFolder(targetId);
        else if (targetType === 'canvas') deleteCanvas(targetId);
        else if (targetType === 'notebook') deleteNotebook(targetId);
        else if (targetType === 'section') deleteNotebookSection(targetId);
        else if (targetType === 'page') deleteNotebookPage(targetId);
        closeContextMenu();
      },
    });
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 w-48 py-1.5 rounded-lg glass-panel shadow-2xl"
      style={{
        left: Math.min(x, window.innerWidth - 200),
        top: Math.min(y, window.innerHeight - menuItems.length * 36 - 20),
      }}
    >
      {menuItems.map((item, i) => (
        <button
          key={i}
          onClick={item.action}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left
                     transition-colors duration-75
                     ${item.danger
                       ? 'text-panvas-accent-rose hover:bg-panvas-accent-rose/10'
                       : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'
                     }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
