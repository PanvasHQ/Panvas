// ============================================
// Panvas — App Shell (Main Layout)
// ============================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { useUIStore } from '@/stores/uiStore';
import { useLayoutStore } from '@/stores/layoutStore';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSidebarOpen, sidebarWidth } = useUIStore();
  const { notebookModeLevel, isNotebookPaneVisible } = useLayoutStore();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-panvas-bg-primary">
      {/* Top Bar */}
      <div className={notebookModeLevel > 0 ? 'hidden' : ''}>
        <TopBar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Sidebar */}
        <div className={(notebookModeLevel > 0 || !isSidebarOpen) ? 'hidden' : 'flex-shrink-0 h-full overflow-hidden'} style={{ width: sidebarWidth }}>
          <Sidebar />
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </div>

      {/* Status Bar */}
      <div className={notebookModeLevel > 0 ? 'hidden' : ''}>
        <StatusBar />
      </div>
    </div>
  );
}
