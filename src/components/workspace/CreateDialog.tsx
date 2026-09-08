// ============================================
// Panvas — Create Dialog
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Folder, Briefcase, BookOpen, ListTree } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { NotebookCover } from '@/types/notebook';
import { DEFAULT_NOTEBOOK_COVER } from '@/components/library/notebookCovers';
import { NotebookCoverPicker } from '@/components/library/NotebookCoverPicker';
import { validateEntityName } from '@/lib/entityName';

export function CreateDialog() {
  const {
    isCreateDialogOpen,
    createDialogType,
    createDialogParentId,
    createDialogParentType,
    closeCreateDialog,
    showToast,
  } = useUIStore();

  const { createWorkspace, createFolder, createNotebook, createNotebookSection, createNotebookPage, createCanvas, setActiveCanvas, setActivePage } = useWorkspaceStore();
  const [name, setName] = useState('');
  const [cover, setCover] = useState<NotebookCover>(DEFAULT_NOTEBOOK_COVER);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreateDialogOpen) {
      setName('');
      setCover({ ...DEFAULT_NOTEBOOK_COVER });
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
      // Filesystem-safe names (Windows reserved device names like CON/LPT1,
      // illegal characters) are rejected here with a clean error before any
      // store or repository path runs. Valid names pass through unchanged.
      const validated = validateEntityName(trimmed, current.title.toLowerCase());
      if (createDialogType === 'workspace') {
        await createWorkspace(validated);
      } else if (createDialogType === 'folder') {
        await createFolder(createDialogParentId, validated);
      } else if (createDialogType === 'notebook') {
        await createNotebook(createDialogParentId, validated, cover);
      } else if (createDialogType === 'section' && createDialogParentId) {
        await createNotebookSection(createDialogParentId, validated);
      } else if (createDialogType === 'page' && createDialogParentId) {
        const page = await createNotebookPage(createDialogParentId, validated);
        setActivePage(page.id);
      } else if (createDialogType === 'canvas') {
        const folderId = (!createDialogParentType || createDialogParentType === 'folder') ? createDialogParentId : null;
        const notebookId = createDialogParentType === 'notebook' ? createDialogParentId : null;
        const sectionId = createDialogParentType === 'section' ? createDialogParentId : null;
        const canvas = await createCanvas(folderId, notebookId, sectionId, validated);
        setActiveCanvas(canvas.id);
      }
      closeCreateDialog();
    } catch (err) {
      console.error('Failed to create:', err);
      showToast(err instanceof Error ? `Couldn't create ${current.title.toLowerCase()}: ${err.message}` : `Couldn't create ${current.title.toLowerCase()}.`, 'error');
    }
  };

  const config = {
    workspace: {
      icon: <Briefcase size={18} className="text-panvas-accent-violet" />,
      title: 'New Workspace',
      description: 'A top-level space for notebooks, canvases, and folders.',
      placeholder: 'Workspace name...',
      defaultName: 'My Workspace',
    },
    folder: {
      icon: <Folder size={18} className="text-panvas-accent-amber" />,
      title: 'New Folder',
      description: 'Keep related notebooks and canvases together.',
      placeholder: 'Folder name...',
      defaultName: 'New Folder',
    },
    notebook: {
      icon: <BookOpen size={18} className="text-panvas-accent-blue" />,
      title: 'New Notebook',
      description: 'Create a page-based workspace for writing and drawing.',
      placeholder: 'Notebook name...',
      defaultName: 'Untitled Notebook',
    },
    section: {
      icon: <ListTree size={18} className="text-panvas-accent-emerald" />,
      title: 'New Section',
      description: 'Add a focused section to the active notebook.',
      placeholder: 'Section name...',
      defaultName: 'Untitled Section',
    },
    page: {
      icon: <FileText size={18} className="text-panvas-accent-violet" />,
      title: 'New Page',
      description: 'Start a fresh page with your current notebook defaults.',
      placeholder: 'Page title...',
      defaultName: 'Untitled Page',
    },
    canvas: {
      icon: <FileText size={18} className="text-panvas-accent-blue" />,
      title: 'New Canvas',
      description: 'Open an infinite surface for visual thinking.',
      placeholder: 'Canvas name...',
      defaultName: 'Untitled Canvas',
    },
  };

  const current = createDialogType ? config[createDialogType] : config.canvas;

  if (!isCreateDialogOpen) return null;

  return (
    <AnimatePresence>
      <div className="panvas-layer-modal fixed inset-0 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="panvas-dialog-backdrop absolute inset-0"
          onClick={closeCreateDialog}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-dialog-title"
          className={`panvas-dialog relative w-full p-5 ${createDialogType === 'notebook' ? 'max-w-lg' : 'max-w-sm'}`}
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
            <div><h2 id="create-dialog-title" className="text-sm font-semibold text-panvas-text-primary">{current.title}</h2><p className="mt-1 text-[11px] leading-relaxed text-panvas-text-tertiary">{current.description}</p></div>
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
            {createDialogType === 'notebook' && <NotebookCoverPicker value={cover} onChange={setCover} title={name || 'Notebook'} />}
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
