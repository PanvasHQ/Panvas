// ============================================
// Panvas — Notebook Canvas Context Menu
// ============================================

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Undo2, 
  Redo2, 
  Scissors, 
  Copy, 
  ClipboardPaste, 
  CopyPlus, 
  Trash2, 
  CheckSquare,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Languages,
} from 'lucide-react';

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  hasSelection: boolean;
  isTextEditing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canConvertHandwriting: boolean;
}

export interface NotebookContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onCommand: (command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'duplicate' | 'delete' | 'selectAll' | 'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack' | 'convertHandwriting') => void;
}

export const NotebookContextMenu: React.FC<NotebookContextMenuProps> = ({
  state,
  onClose,
  onCommand,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside, window blur, or window resize
  useEffect(() => {
    if (!state.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen) return null;

  // Calculate clamped coordinates so menu never overflows screen bounds
  const menuWidth = 190;
  const menuHeight = 470;
  const clampedX = Math.max(10, Math.min(state.x, window.innerWidth - menuWidth - 10));
  const clampedY = Math.max(10, Math.min(state.y, window.innerHeight - menuHeight - 10));

  const handleAction = (cmd: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'duplicate' | 'delete' | 'selectAll' | 'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack' | 'convertHandwriting') => {
    onCommand(cmd);
    onClose();
  };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl+';

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1, ease: 'easeOut' }}
        className="panvas-overlay fixed min-w-[190px] rounded-lg border border-panvas-border-default bg-panvas-bg-elevated p-1 shadow-2xl backdrop-blur-md select-none text-xs"
        style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Undo / Redo */}
        <button
          type="button"
          disabled={!state.canUndo}
          onClick={() => handleAction('undo')}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <Undo2 size={13} className="text-panvas-text-secondary" />
            <span>Undo</span>
          </div>
          <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}Z</span>
        </button>

        <button
          type="button"
          disabled={!state.canRedo}
          onClick={() => handleAction('redo')}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <Redo2 size={13} className="text-panvas-text-secondary" />
            <span>Redo</span>
          </div>
          <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}Y</span>
        </button>

        <div className="my-1 border-t border-panvas-border-subtle" />

        {/* Cut / Copy / Paste / Duplicate */}
        {(state.hasSelection || state.isTextEditing) && (
          <button
            type="button"
            onClick={() => handleAction('cut')}
            className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <Scissors size={13} className="text-panvas-text-secondary" />
              <span>Cut</span>
            </div>
            <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}X</span>
          </button>
        )}

        {(state.hasSelection || state.isTextEditing) && (
          <button
            type="button"
            onClick={() => handleAction('copy')}
            className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <Copy size={13} className="text-panvas-text-secondary" />
              <span>Copy</span>
            </div>
            <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}C</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => handleAction('paste')}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <ClipboardPaste size={13} className="text-panvas-text-secondary" />
            <span>Paste</span>
          </div>
          <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}V</span>
        </button>

        {state.hasSelection && !state.isTextEditing && (
          <button
            type="button"
            onClick={() => handleAction('duplicate')}
            className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <CopyPlus size={13} className="text-panvas-text-secondary" />
              <span>Duplicate</span>
            </div>
            <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}D</span>
          </button>
        )}

        {state.canConvertHandwriting && !state.isTextEditing && (
          <button
            type="button"
            onClick={() => handleAction('convertHandwriting')}
            className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <Languages size={13} className="text-blue-400" />
              <span>Convert to Text</span>
            </div>
          </button>
        )}

        {state.hasSelection && !state.isTextEditing && (
          <>
            <div className="my-1 border-t border-panvas-border-subtle" />
            <button
              type="button"
              onClick={() => handleAction('bringToFront')}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2"><ChevronsUp size={13} className="text-panvas-text-secondary" /><span>Bring to Front</span></div>
              <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}Shift+]</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction('bringForward')}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2"><ChevronUp size={13} className="text-panvas-text-secondary" /><span>Bring Forward</span></div>
              <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}]</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction('sendBackward')}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2"><ChevronDown size={13} className="text-panvas-text-secondary" /><span>Send Backward</span></div>
              <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}[</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction('sendToBack')}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2"><ChevronsDown size={13} className="text-panvas-text-secondary" /><span>Send to Back</span></div>
              <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}Shift+[</span>
            </button>
          </>
        )}

        <div className="my-1 border-t border-panvas-border-subtle" />

        {/* Select All */}
        <button
          type="button"
          onClick={() => handleAction('selectAll')}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <CheckSquare size={13} className="text-panvas-text-secondary" />
            <span>Select All</span>
          </div>
          <span className="text-[10px] font-mono text-panvas-text-tertiary">{modKey}A</span>
        </button>

        {/* Delete */}
        {state.hasSelection && !state.isTextEditing && (
          <button
            type="button"
            onClick={() => handleAction('delete')}
            className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trash2 size={13} className="text-red-500" />
              <span>Delete</span>
            </div>
            <span className="text-[10px] font-mono opacity-70">Del</span>
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
