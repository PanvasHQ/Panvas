import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Cloud,
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

const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export function TopBar() {
  const [, navigate] = useLocation();
  const { isSidebarOpen, toggleSidebar, openCommandPalette, theme, setTheme } = useUIStore();
  const { 
    activeCanvasId, activePageId, activeWorkspaceId, 
    canvasFiles, workspaces, folders, notebooks, notebookSections, notebookPages,
    setActiveCanvas, setActivePage 
  } = useWorkspaceStore();
  const { isAuthenticated, signOut } = useAuthStore();
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const authMenuRef = useRef<HTMLDivElement>(null);

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
      className="h-14 flex-shrink-0 flex items-center gap-4 px-3 bg-panvas-bg-primary text-panvas-text-primary border-b border-panvas-border-subtle select-none z-20"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3" style={noDragStyle}>
        <IconButton
          label={isSidebarOpen ? 'Hide library' : 'Show library'}
          onClick={toggleSidebar}
        >
          {isSidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </IconButton>

        <button
          onClick={() => {
            setActiveCanvas(null);
            navigate('/app');
          }}
          className="flex items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-panvas-bg-hover focus-ring"
          aria-label="Open Panvas library"
        >
          <img src="./panvas-logo-1.1.png" alt="" className="h-6 w-6 rounded-md" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">Panvas</span>
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 items-center gap-1.5 text-sm text-panvas-text-secondary hidden md:flex">
          <ChevronRight size={14} className="flex-shrink-0 text-panvas-text-tertiary" />
          <button
            onClick={() => { setActiveCanvas(null); setActivePage(null); }}
            className="max-w-36 truncate rounded px-1 py-0.5 hover:text-panvas-text-primary focus-ring"
          >
            {currentWorkspace?.name ?? 'Library'}
          </button>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={14} className="flex-shrink-0 text-panvas-text-tertiary" />
              <span className={`max-w-48 truncate px-1 py-0.5 ${index === breadcrumbs.length - 1 ? 'font-medium text-panvas-text-primary' : 'hover:text-panvas-text-primary'}`}>
                {crumb.name}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="hidden flex-[0_1_34rem] justify-center lg:flex" style={noDragStyle}>
        <button
          onClick={openCommandPalette}
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-panvas-border-default bg-panvas-bg-secondary px-3 text-sm text-panvas-text-tertiary shadow-sm transition-colors hover:bg-panvas-bg-hover hover:border-panvas-border-strong focus-ring"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search Panvas</span>
          <kbd className="rounded border border-panvas-border-subtle bg-panvas-bg-primary px-1.5 py-0.5 font-mono text-2xs text-panvas-text-tertiary">Ctrl K</kbd>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5" style={noDragStyle}>
        <div className="hidden items-center pl-2 lg:flex">
          <div className="flex h-8 items-center gap-1.5 rounded-md px-2 text-2xs text-panvas-text-tertiary" title="Sync status placeholder">
            {isAuthenticated ? <Cloud size={14} /> : <CloudOff size={14} />}
            <span>{isAuthenticated ? 'Local' : 'Offline'}</span>
          </div>
        </div>

        <IconButton label={`Switch to ${theme === 'dark' ? 'light' : theme === 'light' ? 'ink' : 'dark'} theme`} onClick={cycleTheme}>
          <ThemeIcon size={16} />
        </IconButton>

        <div className="relative ml-1" ref={authMenuRef}>
          <button
            onClick={() => isAuthenticated ? setIsAuthMenuOpen(open => !open) : navigate('/auth/login')}
            className="rounded-full focus-ring"
            aria-label={isAuthenticated ? 'Open account menu' : 'Sign in'}
            aria-expanded={isAuthMenuOpen}
          >
            {isAuthenticated ? <UserAvatar size="sm" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full border border-panvas-border-default text-panvas-text-tertiary"><CloudOff size={14} /></span>}
          </button>

          {isAuthMenuOpen && isAuthenticated && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-panvas-border-default bg-panvas-bg-elevated p-1.5 shadow-glass-sm z-50">
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

        <div className="ml-2 flex-shrink-0 w-[140px] h-full" aria-hidden="true">
          {/* Spacer for native titleBarOverlay controls */}
        </div>
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
