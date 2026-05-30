// ============================================
// Panvas — Create Dialog
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Folder, Briefcase } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function CreateDialog() {
  const {
    isCreateDialogOpen,
    createDialogType,
    createDialogParentId,
    closeCreateDialog,
  } = useUIStore();

  const { createWorkspace, createFolder, createCanvas, setActiveCanvas } = useWorkspaceStore();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreateDialogOpen) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCreateDialogOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      if (createDialogType === 'workspace') {
        await createWorkspace(trimmed);
      } else if (createDialogType === 'folder') {
        await createFolder(createDialogParentId, trimmed);
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
      icon: <Briefcase size={20} className="text-panvas-accent-violet" />,
      title: 'New Workspace',
      placeholder: 'Workspace name...',
      defaultName: 'My Workspace',
    },
    folder: {
      icon: <Folder size={20} className="text-panvas-accent-amber" />,
      title: 'New Folder',
      placeholder: 'Folder name...',
      defaultName: 'New Folder',
    },
    canvas: {
      icon: <FileText size={20} className="text-panvas-accent-blue" />,
      title: 'New Canvas',
      placeholder: 'Canvas name...',
      defaultName: 'Untitled Canvas',
    },
  };

  const current = createDialogType ? config[createDialogType] : config.canvas;

  if (!isCreateDialogOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeCreateDialog}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-sm rounded-xl glass-panel p-5 shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={closeCreateDialog}
            className="absolute top-3 right-3 btn-icon"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {current.icon}
            <h2 className="text-lg font-semibold text-panvas-text-primary">
              {current.title}
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={current.placeholder}
              className="input-field mb-4"
              id="create-dialog-input"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeCreateDialog}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
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
