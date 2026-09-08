import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useUIStore } from './uiStore';
import { closeDocumentTab, cycleDocumentTab, openDocumentTab, reorderDocumentTabs, splitDocumentTab, type DocumentTab } from './documentTabs';
export type { DocumentTab } from './documentTabs';

export type WorkspaceViewMode = 'edit' | 'read' | 'present';
export type PaneLayoutMode = 'single' | 'vertical-split' | 'horizontal-split' | 'two-page';
export type LaserMode = 'dot' | 'trail';

interface LayoutState {
  // 0: standard chrome, 1: notebook navigator, 2: full page.
  notebookModeLevel: 0 | 1 | 2;
  setNotebookModeLevel: (level: 0 | 1 | 2) => void;
  previousPanelState: { libraryVisible: boolean; propertiesVisible: boolean } | null;
  setPreviousPanelState: (state: { libraryVisible: boolean; propertiesVisible: boolean } | null) => void;
  isNotebookPaneVisible: boolean;
  setNotebookPaneVisible: (visible: boolean) => void;
  toggleNotebookPane: () => void;
  isToolbarPinned: boolean;
  setToolbarPinned: (pinned: boolean) => void;
  isToolbarCollapsed: boolean;
  setToolbarCollapsed: (collapsed: boolean) => void;

  // View and pane state is deliberately UI-only. It never enters a page drawing,
  // undo history, export, or sync payload.
  workspaceViewMode: WorkspaceViewMode;
  setWorkspaceViewMode: (mode: WorkspaceViewMode) => void;
  paneLayout: PaneLayoutMode;
  setPaneLayout: (layout: PaneLayoutMode) => void;
  secondaryPageId: string | null;
  setSecondaryPageId: (pageId: string | null) => void;
  /** Sets an automatic same-document reference without treating it as a user choice. */
  setSuggestedSecondaryPageId: (pageId: string | null) => void;
  hasExplicitReferenceSelection: boolean;
  splitRatio: number;
  setSplitRatio: (ratio: number) => void;
  laserMode: LaserMode;
  setLaserMode: (mode: LaserMode) => void;
  openTabs: DocumentTab[];
  activeTabId: string | null;
  openTab: (tab: DocumentTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  reorderTabs: (from: number, to: number) => void;
  cycleTabs: (direction: 1 | -1) => void;
  openTabInSplit: (tabId: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      previousPanelState: null,
      setPreviousPanelState: state => set({ previousPanelState: state }),
      notebookModeLevel: 0,
      setNotebookModeLevel: level => set({ notebookModeLevel: level, isNotebookPaneVisible: level === 1 }),
      isNotebookPaneVisible: true,
      setNotebookPaneVisible: visible => set({ isNotebookPaneVisible: visible }),
      toggleNotebookPane: () => {
        const { notebookModeLevel, isNotebookPaneVisible } = get();
        if (notebookModeLevel === 0) useUIStore.getState().toggleSidebar();
        else set({ isNotebookPaneVisible: !isNotebookPaneVisible });
      },
      isToolbarPinned: true,
      setToolbarPinned: pinned => set({ isToolbarPinned: pinned }),
      isToolbarCollapsed: false,
      setToolbarCollapsed: collapsed => set({ isToolbarCollapsed: collapsed }),
      workspaceViewMode: 'edit',
      setWorkspaceViewMode: mode => set({ workspaceViewMode: mode }),
      paneLayout: 'single',
      setPaneLayout: layout => set({ paneLayout: layout }),
      secondaryPageId: null,
      hasExplicitReferenceSelection: false,
      setSecondaryPageId: pageId => set({ secondaryPageId: pageId, hasExplicitReferenceSelection: true }),
      setSuggestedSecondaryPageId: pageId => set({ secondaryPageId: pageId }),
      splitRatio: 0.5,
      setSplitRatio: ratio => set({ splitRatio: Math.max(0.25, Math.min(0.75, ratio)) }),
      laserMode: 'trail',
      setLaserMode: mode => set({ laserMode: mode }),
      openTabs: [],
      activeTabId: null,
      openTab: tab => set(state => openDocumentTab(state.openTabs, tab)),
      closeTab: tabId => set(state => {
        const result = closeDocumentTab(state.openTabs, state.activeTabId, tabId);
        const closedPageId = result.closed?.pageId;
        return {
          openTabs: result.tabs,
          activeTabId: result.activeTabId,
          ...(closedPageId && state.secondaryPageId === closedPageId ? { secondaryPageId: null, hasExplicitReferenceSelection: false } : {}),
        };
      }),
      setActiveTab: tabId => set({ activeTabId: tabId }),
      reorderTabs: (from, to) => set(state => ({ openTabs: reorderDocumentTabs(state.openTabs, from, to) })),
      cycleTabs: direction => set(state => ({ activeTabId: cycleDocumentTab(state.openTabs, state.activeTabId, direction) })),
      openTabInSplit: tabId => set(state => {
        const split = splitDocumentTab(state.openTabs, tabId);
        return split ? { secondaryPageId: split.pageId, hasExplicitReferenceSelection: true, paneLayout: 'vertical-split' } : {};
      }),
    }),
    {
      name: 'panvas-layout-store',
      partialize: state => ({
        paneLayout: state.paneLayout,
        secondaryPageId: state.secondaryPageId,
        hasExplicitReferenceSelection: state.hasExplicitReferenceSelection,
        splitRatio: state.splitRatio,
        laserMode: state.laserMode,
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        // Always restart in Edit Mode. Restoring a presentation/read state can
        // otherwise make the app appear uneditable after a crash or upgrade.
        workspaceViewMode: 'edit' as const,
      }),
    },
  ),
);
