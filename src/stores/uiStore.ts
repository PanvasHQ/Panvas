// ============================================
// Panvas — UI Store (Zustand)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar
  isSidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;

  // Command palette
  isCommandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Modals
  isCreateDialogOpen: boolean;
  createDialogType: 'workspace' | 'folder' | 'notebook' | 'section' | 'page' | 'canvas' | null;
  createDialogParentId: string | null;
  openCreateDialog: (type: 'workspace' | 'folder' | 'notebook' | 'section' | 'page' | 'canvas', parentId?: string | null) => void;
  closeCreateDialog: () => void;

  // Context menu
  contextMenu: {
    isOpen: boolean;
    x: number;
    y: number;
    targetId: string | null;
    targetType: 'workspace' | 'folder' | 'notebook' | 'section' | 'page' | 'canvas' | null;
  };
  openContextMenu: (x: number, y: number, targetId: string, targetType: 'workspace' | 'folder' | 'notebook' | 'section' | 'page' | 'canvas') => void;
  closeContextMenu: () => void;

  // Rename
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;

  // Toast notifications
  toast: { message: string; type: 'info' | 'success' | 'error' } | null;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;

  // Theme
  theme: 'dark' | 'light' | 'ink';
  setTheme: (theme: 'dark' | 'light' | 'ink') => void;

  // New UI states
  // Deprecated: use layoutStore instead
  // isFullscreen: boolean;
  // toggleFullscreen: () => void;
  isPropertiesPanelOpen: boolean;
  togglePropertiesPanel: () => void;
  isToolbarExpanded: boolean;
  toggleToolbar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
  // Sidebar
  isSidebarOpen: true,
  sidebarWidth: 280,
  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(220, Math.min(480, width)) }),

  // Command palette
  isCommandPaletteOpen: false,
  toggleCommandPalette: () => set(s => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  // Create dialog
  isCreateDialogOpen: false,
  createDialogType: null,
  createDialogParentId: null,
  openCreateDialog: (type, parentId = null) => set({
    isCreateDialogOpen: true,
    createDialogType: type,
    createDialogParentId: parentId ?? null,
  }),
  closeCreateDialog: () => set({
    isCreateDialogOpen: false,
    createDialogType: null,
    createDialogParentId: null,
  }),

  // Context menu

  // Context menu
  contextMenu: {
    isOpen: false,
    x: 0,
    y: 0,
    targetId: null,
    targetType: null,
  },
  openContextMenu: (x, y, targetId, targetType) => set({
    contextMenu: { isOpen: true, x, y, targetId, targetType },
  }),
  closeContextMenu: () => set({
    contextMenu: { isOpen: false, x: 0, y: 0, targetId: null, targetType: null },
  }),

  // Rename
  renamingId: null,
  setRenamingId: (id) => set({ renamingId: id }),

  // Toast
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      if (get().toast?.message === message) {
        set({ toast: null });
      }
    }, 3000);
  },
  clearToast: () => set({ toast: null }),

  // Theme
  theme: (localStorage.getItem('panvas-theme') as 'dark' | 'light' | 'ink') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('panvas-theme', theme);
    set({ theme });
    
    // Apply theme to document
    const html = document.documentElement;
    html.classList.remove('dark', 'theme-ink');
    if (theme === 'dark') html.classList.add('dark');
    if (theme === 'ink') html.classList.add('theme-ink');

    if (typeof window !== 'undefined' && window.panvas?.settings?.setTheme) {
      window.panvas.settings.setTheme(theme);
    }
  },

  // New UI States
  // isFullscreen: false,
  // toggleFullscreen: () => set(s => ({ isFullscreen: !s.isFullscreen })),
  isPropertiesPanelOpen: true,
  togglePropertiesPanel: () => set(s => ({ isPropertiesPanelOpen: !s.isPropertiesPanelOpen })),
  isToolbarExpanded: true,
  toggleToolbar: () => set(s => ({ isToolbarExpanded: !s.isToolbarExpanded })),
}),
{
  name: 'panvas-ui-store',
  partialize: (state) => ({
    isSidebarOpen: state.isSidebarOpen,
    sidebarWidth: state.sidebarWidth,
    isPropertiesPanelOpen: state.isPropertiesPanelOpen,
    isToolbarExpanded: state.isToolbarExpanded,
  }),
}));
