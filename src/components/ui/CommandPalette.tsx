// ============================================
// Panvas — Command Palette
// ============================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  FolderPlus,
  Plus,
  Settings,
  PanelLeftClose,
  Type,
  Sigma,
  FileUp,
  Cloud,
  Clock3,
  CornerDownRight,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const [, navigate] = useLocation();
  const { isCommandPaletteOpen, closeCommandPalette, openCreateDialog, toggleSidebar } = useUIStore();
  const { canvasFiles, setActiveCanvas } = useWorkspaceStore();
  const { addBlock, currentData } = useCanvasStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Canvas files
    canvasFiles.forEach(file => {
      items.push({
        id: `file-${file.id}`,
        label: file.name,
        category: 'Files',
        icon: <FileText size={15} className="text-panvas-text-tertiary" />,
        action: () => {
          setActiveCanvas(file.id);
          closeCommandPalette();
        },
      });
    });

    // Actions
    items.push(
      {
        id: 'new-canvas',
        label: 'New Canvas',
        category: 'Actions',
        icon: <Plus size={15} />,
        action: () => { closeCommandPalette(); openCreateDialog('canvas'); },
        shortcut: 'Ctrl+N',
      },
      {
        id: 'new-folder',
        label: 'New Folder',
        category: 'Actions',
        icon: <FolderPlus size={15} />,
        action: () => { closeCommandPalette(); openCreateDialog('folder'); },
        shortcut: 'Ctrl+Shift+N',
      },
      {
        id: 'toggle-sidebar',
        label: 'Toggle Sidebar',
        category: 'Actions',
        icon: <PanelLeftClose size={15} />,
        action: () => { closeCommandPalette(); toggleSidebar(); },
        shortcut: 'Ctrl+\\',
      },
      {
        id: 'cloud-sync',
        label: 'Cloud Sync / Sign In',
        category: 'Actions',
        icon: <Cloud size={15} />,
        action: () => { closeCommandPalette(); navigate('/auth/login'); },
      },
    );

    // Canvas blocks (only when canvas is active)
    if (currentData) {
      items.push(
        {
          id: 'add-markdown',
          label: 'Add Markdown Block',
          description: 'Place a markdown note on canvas',
          category: 'Blocks',
          icon: <Type size={15} className="text-panvas-accent-violet" />,
          action: () => {
            closeCommandPalette();
            addBlock('markdown', 100, 100);
          },
          shortcut: 'Ctrl+M',
        },
        {
          id: 'add-latex',
          label: 'Add LaTeX Block',
          description: 'Place a LaTeX equation on canvas',
          category: 'Blocks',
          icon: <Sigma size={15} className="text-panvas-accent-blue" />,
          action: () => {
            closeCommandPalette();
            addBlock('latex', 100, 200);
          },
          shortcut: 'Ctrl+E',
        },
      );
    }

    return items;
  }, [canvasFiles, currentData, setActiveCanvas, closeCommandPalette, openCreateDialog, toggleSidebar, navigate, addBlock]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      cmd => cmd.label.toLowerCase().includes(q) ||
             cmd.category.toLowerCase().includes(q) ||
             cmd.description?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filteredCommands[selectedIndex]?.action();
    } else if (e.key === 'Escape') {
      closeCommandPalette();
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeCommandPalette}
        />

        {/* Palette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full max-w-lg rounded-xl glass-panel overflow-hidden shadow-2xl"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-panvas-border-subtle">
            <Search size={16} className="text-panvas-text-tertiary flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search files and commands..."
              className="flex-1 bg-transparent text-sm text-panvas-text-primary outline-none
                         placeholder:text-panvas-text-tertiary"
              id="command-palette-input"
            />
            <kbd className="px-1.5 py-0.5 rounded text-2xs bg-panvas-bg-tertiary text-panvas-text-tertiary
                           border border-panvas-border-subtle">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[380px] overflow-y-auto py-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-panvas-text-tertiary">
                No results found
              </div>
            ) : !query.trim() ? (
              <CommandPaletteHome commands={commands} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} />
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-1.5 text-2xs font-medium text-panvas-text-tertiary uppercase tracking-wider">
                    {category}
                  </div>
                  {items.map((item, idx) => {
                    const flatIndex = filteredCommands.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm
                                   transition-colors duration-75
                                   ${flatIndex === selectedIndex
                                     ? 'bg-panvas-bg-hover text-panvas-text-primary'
                                     : 'text-panvas-text-secondary hover:bg-panvas-bg-hover/50'
                                   }`}
                      >
                        <div className="flex-shrink-0 w-5 flex items-center justify-center">
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.label}</div>
                          {item.description && (
                            <div className="text-2xs text-panvas-text-tertiary truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <kbd className="flex-shrink-0 px-1.5 py-0.5 rounded text-2xs
                                         bg-panvas-bg-tertiary text-panvas-text-tertiary
                                         border border-panvas-border-subtle">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function CommandPaletteHome({ commands, selectedIndex, setSelectedIndex }: { commands: CommandItem[]; selectedIndex: number; setSelectedIndex: (index: number) => void }) {
  const quickActions = commands.filter(command => command.category === 'Actions');
  const files = commands.filter(command => command.category === 'Files').slice(0, 4);
  return <>
    <PaletteHint icon={<Clock3 size={14} />} title="Recent Searches" description="Your recent searches will appear here." />
    <PaletteSection title="Quick Actions" items={quickActions} allItems={commands} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} />
    <PaletteSection title="Jump To" items={files} allItems={commands} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} empty="Create a canvas to jump between work." />
    <PaletteSection title="Recently Opened" items={files} allItems={commands} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} empty="Recently opened items will appear here." />
  </>;
}

function PaletteHint({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="mx-2 mb-2 flex items-center gap-3 rounded-lg border border-dashed border-panvas-border-subtle px-3 py-3 text-xs text-panvas-text-tertiary"><span>{icon}</span><div><div className="font-medium text-panvas-text-secondary">{title}</div><div className="mt-0.5 text-2xs">{description}</div></div></div>;
}

function PaletteSection({ title, items, allItems, selectedIndex, setSelectedIndex, empty }: { title: string; items: CommandItem[]; allItems: CommandItem[]; selectedIndex: number; setSelectedIndex: (index: number) => void; empty?: string }) {
  return <div className="mb-2"><div className="px-4 py-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-panvas-text-tertiary">{title}</div>{items.length === 0 && empty ? <div className="px-4 py-2 text-xs text-panvas-text-tertiary">{empty}</div> : items.map(item => { const index = allItems.indexOf(item); return <button key={`${title}-${item.id}`} onClick={item.action} onMouseEnter={() => setSelectedIndex(index)} className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${index === selectedIndex ? 'bg-panvas-bg-hover text-panvas-text-primary' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover/50'}`}><span className="flex w-5 flex-shrink-0 justify-center">{item.icon}</span><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.shortcut ? <kbd className="rounded border border-panvas-border-subtle bg-panvas-bg-tertiary px-1.5 py-0.5 text-2xs text-panvas-text-tertiary">{item.shortcut}</kbd> : <CornerDownRight size={13} className="text-panvas-text-tertiary" />}</button>; })}</div>;
}
