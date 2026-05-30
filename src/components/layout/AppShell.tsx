// ============================================
// Panvas — App Shell (Main Layout)
// ============================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { useUIStore } from '@/stores/uiStore';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSidebarOpen, sidebarWidth } = useUIStore();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-panvas-bg-primary">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidebarWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 h-full overflow-hidden"
            >
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
