import { create } from 'zustand';
import { useUIStore } from './uiStore';

interface LayoutState {
  // Notebook Mode Level
  // 0: Standard Library View (All chrome visible)
  // 1: Notebook View (Chrome hidden, Notebook Pane visible)
  // 2: Full Page View (Chrome hidden, Notebook Pane hidden)
  notebookModeLevel: 0 | 1 | 2;
  setNotebookModeLevel: (level: 0 | 1 | 2) => void;
  
  // State memory for Focus mode (Level 2)
  previousPanelState: {
    libraryVisible: boolean;
    propertiesVisible: boolean;
  } | null;
  setPreviousPanelState: (state: { libraryVisible: boolean; propertiesVisible: boolean } | null) => void;

  // Notebook View specific toggles
  isNotebookPaneVisible: boolean;
  setNotebookPaneVisible: (visible: boolean) => void;
  toggleNotebookPane: () => void;

  isToolbarPinned: boolean;
  setToolbarPinned: (pinned: boolean) => void;
  
  isToolbarCollapsed: boolean;
  setToolbarCollapsed: (collapsed: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  previousPanelState: null,
  setPreviousPanelState: (state) => set({ previousPanelState: state }),

  notebookModeLevel: 0,
  setNotebookModeLevel: (level) => set({ 
    notebookModeLevel: level,
    isNotebookPaneVisible: level === 1,
  }),

  isNotebookPaneVisible: true,
  setNotebookPaneVisible: (visible) => set({ isNotebookPaneVisible: visible }),
  toggleNotebookPane: () => {
    const { notebookModeLevel, isNotebookPaneVisible } = get();
    if (notebookModeLevel === 0) {
      useUIStore.getState().toggleSidebar();
    } else {
      set({ isNotebookPaneVisible: !isNotebookPaneVisible });
    }
  },

  isToolbarPinned: true,
  setToolbarPinned: (pinned) => set({ isToolbarPinned: pinned }),

  isToolbarCollapsed: false,
  setToolbarCollapsed: (collapsed) => set({ isToolbarCollapsed: collapsed }),
}));
