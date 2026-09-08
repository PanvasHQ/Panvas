import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  CloudOff,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Search,
  Square,
  Sun,
  X,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { navigateToLibraryView } from '@/services/library/libraryRouteState';

const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;
const isElectronShell = typeof window !== 'undefined' && Boolean(window.panvas);
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform);
const isElectronOnWindows = isElectronShell && !isMac;
const ELECTRON_CAPTION_SAFE_WIDTH = 144;

export function TopBar() {
  const [, navigate] = useLocation();
  const { isSidebarOpen, toggleSidebar, openCommandPalette, theme, setTheme } = useUIStore();
  const {
    activeCanvasId, activePageId, activeWorkspaceId,
    canvasFiles, workspaces, folders, notebooks, notebookSections, notebookPages,
    setActiveCanvas, setActivePage, setActiveNotebook, setActiveNotebookSection,
  } = useWorkspaceStore();
  const { isAuthenticated, signOut } = useAuthStore();
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const authMenuRef = useRef<HTMLDivElement>(null);

  // Keep the native overlay symbols contrasting with the active theme; the
  // handler also mirrors the theme into main-process settings.
  useEffect(() => {
    window.panvas?.settings.setTheme(theme).catch(() => {});
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (authMenuRef.current && !authMenuRef.current.contains(event.target as Node)) {
        setIsAuthMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCanvas = canvasFiles.find(canvas => canvas.id === activeCanvasId);
  let currentWorkspace = workspaces.find(workspace => workspace.id === (activeCanvas?.workspaceId ?? activeWorkspaceId));

  const breadcrumbs: { id: string, name: string, type: string }[] = [];
  
  if (activePageId) {
    const page = notebookPages.find(p => p.id === activePageId);
    if (page) {
      breadcrumbs.unshift({ id: page.id, name: page.title, type: 'page' });
      const section = notebookSections.find(s => s.id === page.sectionId);
      if (section) {
        breadcrumbs.unshift({ id: section.id, name: section.name, type: 'section' });
        const notebook = notebooks.find(n => n.id === section.notebookId);
        if (notebook) {
          breadcrumbs.unshift({ id: notebook.id, name: notebook.name, type: 'notebook' });
          let currentFolderId = notebook.folderId;
          while (currentFolderId) {
            const folder = folders.find(f => f.id === currentFolderId);
            if (folder) {
              breadcrumbs.unshift({ id: folder.id, name: folder.name, type: 'folder' });
              currentFolderId = folder.parentId;
            } else {
              break;
            }
          }
          if (!currentWorkspace) currentWorkspace = workspaces.find(w => w.id === notebook.workspaceId);
        }
      }
    }
  } else if (activeCanvasId) {
    if (activeCanvas) {
      breadcrumbs.unshift({ id: activeCanvas.id, name: activeCanvas.name, type: 'canvas' });
      let currentFolderId = activeCanvas.folderId;
      while (currentFolderId) {
        const folder = folders.find(f => f.id === currentFolderId);
        if (folder) {
          breadcrumbs.unshift({ id: folder.id, name: folder.name, type: 'folder' });
          currentFolderId = folder.parentId;
        } else {
          break;
        }
      }
    }
  }
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : PenTool;

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('ink');
    else setTheme('dark');
  };

  const handleSignOut = async () => {
    setIsAuthMenuOpen(false);
    await signOut();
    navigate('/');
  };

  return (
    <header
      className="panvas-topbar panvas-layer-toolbar flex-shrink-0 relative flex items-center justify-between px-3 bg-panvas-bg-primary text-panvas-text-primary border-b border-panvas-border-subtle select-none h-11"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* LEFT ZONE: Sidebar toggle, Logo, Breadcrumbs */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5" style={noDragStyle}>
        <IconButton
          label={isSidebarOpen ? 'Hide library' : 'Show library'}
          onClick={toggleSidebar}
        >
          {isSidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </IconButton>

        <button
          onClick={() => {
            setActiveCanvas(null);
            navigateToLibraryView('library');
            navigate('/app/library');
          }}
          className="flex items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-panvas-bg-hover focus-ring flex-shrink-0"
          aria-label="Open Panvas library"
        >
          <img src="./panvas-logo-1.1.png" alt="" className="h-6 w-6 rounded-md" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">Panvas</span>
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 items-center gap-1.5 text-xs text-panvas-text-secondary hidden md:flex">
          <ChevronRight size={13} className="flex-shrink-0 text-panvas-text-tertiary" />
          <button
            onClick={() => {
              setActiveCanvas(null);
              setActivePage(null);
              setActiveNotebook(null);
              navigateToLibraryView('library');
              navigate('/app/library');
            }}
            className="max-w-28 lg:max-w-36 truncate rounded px-1 py-0.5 hover:text-panvas-text-primary focus-ring"
          >
            {currentWorkspace?.name ?? 'Library'}
          </button>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={13} className="flex-shrink-0 text-panvas-text-tertiary" />
                <button
                  type="button"
                  onClick={() => {
                    if (crumb.type === 'page') setActivePage(crumb.id);
                    else if (crumb.type === 'section') void setActiveNotebookSection(crumb.id);
                    else if (crumb.type === 'notebook') void setActiveNotebook(crumb.id);
                    else if (crumb.type === 'canvas') setActiveCanvas(crumb.id);
                    navigate('/app');
                  }}
                  className={`max-w-32 lg:max-w-44 truncate rounded px-1 py-0.5 text-left ${isLast ? 'font-medium text-panvas-text-primary cursor-default' : 'hover:text-panvas-text-primary focus-ring'}`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* CENTER ZONE: Search Panvas. On phones the field compresses to a
          compact icon action that opens the exact same command palette as
          the desktop field and the Ctrl+K shortcut. */}
      <div className="flex items-center justify-center flex-shrink-0 px-2 w-full max-w-xs sm:max-w-sm md:max-w-md min-w-0 max-[599px]:w-auto max-[599px]:px-0" style={noDragStyle}>
        <button
          onClick={openCommandPalette}
          aria-label="Search Panvas"
          title="Search Panvas (Ctrl K)"
          className="flex h-8 sm:h-9 w-full items-center gap-2 rounded-lg border border-panvas-border-default bg-panvas-bg-secondary px-3 text-xs text-panvas-text-tertiary shadow-sm transition-colors hover:bg-panvas-bg-hover hover:border-panvas-border-strong focus-ring max-[599px]:h-8 max-[599px]:w-9 max-[599px]:justify-center max-[599px]:px-0"
        >
          <Search size={14} className="flex-shrink-0" />
          <span className="flex-1 text-left truncate max-[599px]:hidden">Search Panvas</span>
          <kbd className="hidden sm:inline-block rounded border border-panvas-border-subtle bg-panvas-bg-primary px-1.5 py-0.5 font-mono text-[10px] text-panvas-text-tertiary">Ctrl K</kbd>
        </button>
      </div>

      {/* RIGHT ZONE: App controls + Native Caption Safe Spacer */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5" style={noDragStyle}>
        <div className="hidden items-center pl-1 sm:flex" style={noDragStyle}>
          <SyncIndicator />
        </div>

        <IconButton label={`Switch to ${theme === 'dark' ? 'light' : theme === 'light' ? 'ink' : 'dark'} theme`} onClick={cycleTheme}>
          <ThemeIcon size={16} />
        </IconButton>

        <div className="relative ml-0.5" ref={authMenuRef}>
          <button
            onClick={() => isAuthenticated ? setIsAuthMenuOpen(open => !open) : navigate('/auth/login')}
            className="rounded-full focus-ring flex items-center justify-center"
            aria-label={isAuthenticated ? 'Open account menu' : 'Sign in'}
            aria-expanded={isAuthMenuOpen}
          >
            {isAuthenticated ? <UserAvatar size="sm" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full border border-panvas-border-default text-panvas-text-tertiary hover:text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors"><CloudOff size={14} /></span>}
          </button>

          {isAuthMenuOpen && isAuthenticated && (
            <div className="panvas-overlay absolute right-0 mt-2 w-56 rounded-lg border border-panvas-border-default bg-panvas-bg-elevated p-1.5 shadow-glass-sm z-50">
              <div className="mb-1 flex items-center gap-3 border-b border-panvas-border-subtle px-2.5 py-2">
                <UserAvatar size="sm" />
                <span className="truncate text-xs font-medium text-panvas-text-primary">{useAuthStore.getState().user?.email}</span>
              </div>
              <AccountMenuItem onClick={() => { setIsAuthMenuOpen(false); navigate('/app/settings/account'); }}>My Account</AccountMenuItem>
              <AccountMenuItem onClick={() => { setIsAuthMenuOpen(false); navigate('/app/settings/appearance'); }}>Settings</AccountMenuItem>
              <div className="my-1 h-px bg-panvas-border-subtle" />
              <AccountMenuItem danger onClick={handleSignOut}>Sign out</AccountMenuItem>
            </div>
          )}
        </div>

        {/* Native window caption reserved safe area for Electron on Windows */}
        {isElectronOnWindows && (
          <div
            className="panvas-caption-safe-region flex-shrink-0 pointer-events-none"
            style={{ width: ELECTRON_CAPTION_SAFE_WIDTH, minWidth: ELECTRON_CAPTION_SAFE_WIDTH }}
            aria-hidden="true"
          />
        )}
      </div>
    </header>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary active:bg-panvas-bg-active focus-ring" aria-label={label} title={label}>
      {children}
    </button>
  );
}

function AccountMenuItem({ children, danger = false, onClick }: { children: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-ring ${danger ? 'text-panvas-accent-rose hover:bg-panvas-bg-hover' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'}`}>{children}</button>;
}

// No custom window controls rendered here since we rely on titleBarOverlay
