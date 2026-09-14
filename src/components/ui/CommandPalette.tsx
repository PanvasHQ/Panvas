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
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useAuthStore } from '@/stores/authStore';
import { navigateToLibraryView } from '@/services/library/libraryRouteState';
import {
  createLocalSearchScopeKey,
  localSearchIndex,
  rebuildLocalSearchIndex,
  type LocalSearchDocument,
  type LocalSearchSource,
} from '@/services/search/LocalSearchIndex';
import { subscribeToPageSearchSaves } from '@/services/search/searchIndexEvents';

interface CommandItem {
  id: string;
  label: string;
  description?: React.ReactNode;
  searchText?: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const [, navigate] = useLocation();
  const { isCommandPaletteOpen, closeCommandPalette, openCreateDialog, toggleSidebar } = useUIStore();
  const {
    activeWorkspaceId, folders, canvasFiles, notebooks, notebookSections, notebookPages,
    setActiveWorkspace, loadWorkspaceContents, setActiveCanvas, setActiveNotebook, setActiveNotebookSection, setActivePage,
  } = useWorkspaceStore();
  const { addBlock, currentData } = useCanvasStore();
  const userId = useAuthStore(state => state.user?.id ?? null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchDocuments, setSearchDocuments] = useState<LocalSearchDocument[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
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
        label: 'Cloud Sync',
        category: 'Actions',
        icon: <Cloud size={15} />,
        action: () => { closeCommandPalette(); navigateToLibraryView('cloud'); navigate('/app/library'); },
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

  useEffect(() => {
    if (!isCommandPaletteOpen || !activeWorkspaceId) return;
    let cancelled = false;
    const source: LocalSearchSource = {
      userId, workspaceId: activeWorkspaceId, folders, canvasFiles, notebooks,
      sections: notebookSections, pages: notebookPages,
    };
    const scopeKey = createLocalSearchScopeKey(source);
    if (localSearchIndex.isValidFor(scopeKey)) {
      setSearchDocuments([...localSearchIndex.getAll()]);
      setIsIndexing(false);
      return () => { cancelled = true; };
    }
    setIsIndexing(true);
    void rebuildLocalSearchIndex(source).then(documents => {
      if (!cancelled) setSearchDocuments(documents);
    }).catch(error => {
      console.error('[CommandPalette] Local search rebuild failed:', error);
      if (!cancelled) setSearchDocuments([]);
    }).finally(() => {
      if (!cancelled) setIsIndexing(false);
    });
    return () => { cancelled = true; };
  }, [isCommandPaletteOpen, activeWorkspaceId, userId, folders, canvasFiles, notebooks, notebookSections, notebookPages]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    return subscribeToPageSearchSaves(() => {
      setSearchDocuments([...localSearchIndex.getAll()]);
    });
  }, [isCommandPaletteOpen]);

  const contentCommands = useMemo<CommandItem[]>(() => localSearchIndex.search(query).map(result => ({
    id: `content-${result.id}`,
    label: result.title,
    description: result.excerpt
      ? <HighlightedSnippet text={result.excerpt} query={query} />
      : `${result.kind} · local canonical record`,
    searchText: result.excerpt,
    category: result.matchSource === 'title' || result.matchSource === 'metadata'
      ? 'Documents, canvases, and PDFs'
      : 'Handwritten and rich-text notes',
    icon: <Search size={15} className="text-panvas-accent-blue" />,
    action: () => {
      closeCommandPalette();
      if (result.kind === 'canvas') {
        setActiveCanvas(result.id);
        navigate('/app');
        return;
      }
      if (result.kind === 'folder') {
        navigate('/app/library');
        return;
      }
      const notebookId = result.notebookId ?? (result.kind === 'notebook' ? result.id : undefined);
      if (!notebookId) return;
      void (async () => {
        if (result.workspaceId !== useWorkspaceStore.getState().activeWorkspaceId) {
          setActiveWorkspace(result.workspaceId);
          await loadWorkspaceContents(result.workspaceId);
        }
        await setActiveNotebook(notebookId);
        if (result.sectionId) await setActiveNotebookSection(result.sectionId);
        if (result.pageId) setActivePage(result.pageId);
        if (result.pdfPageNumber) sessionStorage.setItem(`panvas.pdfTargetPage.${result.pageId}`, String(result.pdfPageNumber));
        navigate('/app');
      })();
    },
  })), [query, searchDocuments, closeCommandPalette, navigate, setActiveWorkspace, loadWorkspaceContents, setActiveCanvas, setActiveNotebook, setActiveNotebookSection, setActivePage]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return [...contentCommands, ...commands.filter(
      cmd => cmd.label.toLowerCase().includes(q) ||
             cmd.category.toLowerCase().includes(q) ||
             cmd.searchText?.toLowerCase().includes(q) ||
             (typeof cmd.description === 'string' && cmd.description.toLowerCase().includes(q))
    )];
  }, [commands, contentCommands, query]);

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
      <div className="panvas-layer-modal fixed inset-0 flex items-start justify-center pt-[15vh] max-[599px]:items-center max-[599px]:p-3 max-[599px]:pt-3">
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
          className="relative w-full max-w-lg overflow-hidden rounded-xl glass-panel shadow-2xl max-[599px]:flex max-[599px]:max-h-[calc(100dvh-1.5rem)] max-[599px]:flex-col"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-panvas-border-subtle">
            <Search size={16} className="text-panvas-text-tertiary flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder={isIndexing ? 'Indexing local content…' : 'Search titles, notes, canvases, and PDFs…'}
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
          <div className="max-h-[380px] overflow-y-auto py-2 max-[599px]:min-h-0 max-[599px]:max-h-none max-[599px]:flex-1">
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

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const rawTerms = query.trim().split(/\s+/).filter(Boolean);
  if (rawTerms.length === 0) return <>{text}</>;
  const escapedTerms = rawTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = new RegExp(`(${escapedTerms.join('|')})`, 'ig');
  const normalizedTerms = new Set(rawTerms.map(term => term.toLocaleLowerCase()));
  return <>{text.split(matcher).map((part, index) => normalizedTerms.has(part.toLocaleLowerCase())
    ? <mark key={`${part}-${index}`} className="rounded-sm bg-panvas-accent-amber/25 text-inherit">{part}</mark>
    : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>)}</>;
}

function CommandPaletteHome({ commands, selectedIndex, setSelectedIndex }: { commands: CommandItem[]; selectedIndex: number; setSelectedIndex: (index: number) => void }) {
  const quickActions = commands.filter(command => command.category === 'Actions');
  const files = commands.filter(command => command.category === 'Files').slice(0, 4);
  return <>
    <PaletteSection title="Quick Actions" items={quickActions} allItems={commands} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} />
    <PaletteSection title="Open canvases" items={files} allItems={commands} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} empty="No canvases are available in this workspace yet." />
  </>;
}

function PaletteSection({ title, items, allItems, selectedIndex, setSelectedIndex, empty }: { title: string; items: CommandItem[]; allItems: CommandItem[]; selectedIndex: number; setSelectedIndex: (index: number) => void; empty?: string }) {
  return <div className="mb-2"><div className="px-4 py-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-panvas-text-tertiary">{title}</div>{items.length === 0 && empty ? <div className="mx-2 rounded-lg border border-dashed border-panvas-border-default px-3 py-3 text-xs text-panvas-text-tertiary">{empty}</div> : items.map(item => { const index = allItems.indexOf(item); return <button key={`${title}-${item.id}`} onClick={item.action} onMouseEnter={() => setSelectedIndex(index)} className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${index === selectedIndex ? 'bg-panvas-bg-hover text-panvas-text-primary' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover/50'}`}><span className="flex w-5 flex-shrink-0 justify-center">{item.icon}</span><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.shortcut && <kbd className="rounded border border-panvas-border-subtle bg-panvas-bg-tertiary px-1.5 py-0.5 text-2xs text-panvas-text-tertiary">{item.shortcut}</kbd>}</button>; })}</div>;
}
