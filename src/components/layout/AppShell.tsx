// ============================================
// Panvas — App Shell (Main Layout)
// ============================================

import React, { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { DocumentTabBar } from './DocumentTabBar';
import { StatusBar } from './StatusBar';
import { useUIStore } from '@/stores/uiStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSidebarOpen, sidebarWidth } = useUIStore();
  const { notebookModeLevel, isNotebookPaneVisible, workspaceViewMode, openTabs } = useLayoutStore();
  const activePageId = useWorkspaceStore(state => state.activePageId);
  const activeCanvasId = useWorkspaceStore(state => state.activeCanvasId);
  const isMobileViewport = useIsMobileViewport();
  const [location] = useLocation();
  const hideAppChrome = notebookModeLevel > 0 || workspaceViewMode === 'present';

  // On phones the library sidebar is an overlay rather than a flex column.
  // Picking a destination (route navigation or opening a document) dismisses
  // it, Escape closes it, and the scrim tap closes it. Desktop and tablet
  // keep the inline sidebar untouched.
  const lastDismissSignalRef = useRef(`${location}|${activePageId ?? ''}|${activeCanvasId ?? ''}`);
  useEffect(() => {
    const signal = `${location}|${activePageId ?? ''}|${activeCanvasId ?? ''}`;
    if (lastDismissSignalRef.current === signal) return;
    lastDismissSignalRef.current = signal;
    if (!isMobileViewport) return;
    const { isSidebarOpen: open, toggleSidebar } = useUIStore.getState();
    if (open) toggleSidebar();
  }, [location, activePageId, activeCanvasId, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport || !isSidebarOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const { isSidebarOpen: open, toggleSidebar } = useUIStore.getState();
      if (open) toggleSidebar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileViewport, isSidebarOpen]);

  return (
    <div className="panvas-app-shell h-screen w-screen flex flex-col overflow-hidden bg-panvas-bg-primary">
      {/* Top Bar */}
      <div className={hideAppChrome ? 'hidden' : ''}>
        <TopBar />
        {openTabs.length > 0 && <DocumentTabBar />}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile scrim: phones only; desktop/tablet never render it visible. */}
        {isSidebarOpen && !hideAppChrome && (
          <button
            type="button"
            onClick={() => useUIStore.getState().toggleSidebar()}
            aria-label="Close library sidebar"
            className="fixed inset-0 z-30 bg-black/20 hidden max-[599px]:block"
          />
        )}
        {/* Main Sidebar. On phones it overlays the full-width content row
            instead of squeezing it, so document layout never changes. */}
        <div className={(hideAppChrome || !isSidebarOpen) ? 'hidden' : 'flex-shrink-0 h-full overflow-hidden max-[599px]:absolute max-[599px]:inset-y-0 max-[599px]:left-0 max-[599px]:z-40 max-[599px]:h-full max-[599px]:shadow-2xl'} style={{ width: sidebarWidth }}>
          <Sidebar />
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </div>

      {/* Status Bar */}
      <div className={hideAppChrome ? 'hidden' : ''}>
        <StatusBar />
      </div>
    </div>
  );
}
