// ============================================
// Panvas — Create Dialog
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Folder, Briefcase, BookOpen, ListTree } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function CreateDialog() {
  const {
    isCreateDialogOpen,
    createDialogType,
    createDialogParentId,
    closeCreateDialog,
  } = useUIStore();

  const { createWorkspace, createFolder, createNotebook, createNotebookSection, createNotebookPage, createCanvas, setActiveCanvas, setActivePage } = useWorkspaceStore();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreateDialogOpen) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCreateDialogOpen]);

  // Handle Escape key to close dialog
  useEffect(() => {
    if (!isCreateDialogOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeCreateDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isCreateDialogOpen, closeCreateDialog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      if (createDialogType === 'workspace') {
        await createWorkspace(trimmed);
      } else if (createDialogType === 'folder') {
        await createFolder(createDialogParentId, trimmed);
      } else if (createDialogType === 'notebook') {
        await createNotebook(createDialogParentId, trimmed);
      } else if (createDialogType === 'section' && createDialogParentId) {
        await createNotebookSection(createDialogParentId, trimmed);
      } else if (createDialogType === 'page' && createDialogParentId) {
        const page = await createNotebookPage(createDialogParentId, trimmed);
        setActivePage(page.id);
      } else if (createDialogType === 'canvas') {
        const canvas = await createCanvas(createDialogParentId, trimmed);
        setActiveCanvas(canvas.id);
      }
      closeCreateDialog();
    } catch (err) {
      console.error('Failed to create:', err);
    }
  };

  const config = {
    workspace: {
      icon: <Briefcase size={18} className="text-panvas-accent-violet" />,
      title: 'New Workspace',
      placeholder: 'Workspace name...',
      defaultName: 'My Workspace',
    },
    folder: {
      icon: <Folder size={18} className="text-panvas-accent-amber" />,
      title: 'New Folder',
      placeholder: 'Folder name...',
      defaultName: 'New Folder',
    },
    notebook: {
      icon: <BookOpen size={18} className="text-panvas-accent-blue" />,
      title: 'New Notebook',
      placeholder: 'Notebook name...',
      defaultName: 'Untitled Notebook',
    },
    section: {
      icon: <ListTree size={18} className="text-panvas-accent-emerald" />,
      title: 'New Section',
      placeholder: 'Section name...',
      defaultName: 'Untitled Section',
    },
    page: {
      icon: <FileText size={18} className="text-panvas-accent-violet" />,
      title: 'New Page',
      placeholder: 'Page title...',
      defaultName: 'Untitled Page',
    },
    canvas: {
      icon: <FileText size={18} className="text-panvas-accent-blue" />,
      title: 'New Canvas',
      placeholder: 'Canvas name...',
      defaultName: 'Untitled Canvas',
    },
  };

  const current = createDialogType ? config[createDialogType] : config.canvas;

  if (!isCreateDialogOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
          onClick={closeCreateDialog}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full max-w-sm rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-5 shadow-2xl z-10"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={closeCreateDialog}
            className="absolute top-3.5 right-3.5 flex h-7 w-7 items-center justify-center rounded-md text-panvas-text-tertiary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors focus-ring"
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-panvas-bg-secondary border border-panvas-border-subtle">
              {current.icon}
            </div>
            <h2 className="text-sm font-semibold text-panvas-text-primary">
              {current.title}
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={current.placeholder}
                className="w-full h-9 px-3 rounded-lg bg-panvas-bg-primary border border-panvas-border-default text-panvas-text-primary text-xs placeholder:text-panvas-text-tertiary focus:outline-none focus:border-panvas-border-strong focus:ring-1 focus:ring-panvas-border-strong transition-colors"
                id="create-dialog-input"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={closeCreateDialog}
                className="h-8 px-3 rounded-md text-xs font-medium text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors focus-ring"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="h-8 px-4 rounded-md bg-panvas-text-primary text-panvas-bg-primary text-xs font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
              >
                Create
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
