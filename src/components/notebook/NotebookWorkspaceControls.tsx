import React from 'react';
import { PanelLeft, PanelRight, Maximize2, Minimize2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useLayoutStore } from '@/stores/layoutStore';

export const NotebookWorkspaceControls: React.FC = () => {
  const { notebookModeLevel, setNotebookModeLevel, toggleNotebookPane, isNotebookPaneVisible, previousPanelState, setPreviousPanelState } = useLayoutStore();
  const { isSidebarOpen, toggleSidebar, togglePropertiesPanel, isPropertiesPanelOpen } = useUIStore();

  const handleToggleLeftPanel = () => {
    if (notebookModeLevel === 0) {
      toggleSidebar();
    } else {
      toggleNotebookPane();
    }
  };

  const handleToggleFocus = () => {
    if (notebookModeLevel !== 2) {
      // Entering Focus mode
      setPreviousPanelState({
        libraryVisible: notebookModeLevel === 0 ? isSidebarOpen : isNotebookPaneVisible,
        propertiesVisible: isPropertiesPanelOpen,
      });
      setNotebookModeLevel(2);
      
      // Force close them visually
      if (isSidebarOpen) toggleSidebar();
      if (isPropertiesPanelOpen) togglePropertiesPanel();
      if (notebookModeLevel === 1 && isNotebookPaneVisible) toggleNotebookPane();
    } else {
      // Exiting Focus mode
      setNotebookModeLevel(0); // We'll always default back to level 0 for standard layout memory
      
      if (previousPanelState) {
        if (previousPanelState.libraryVisible !== isSidebarOpen) toggleSidebar();
        if (previousPanelState.propertiesVisible !== isPropertiesPanelOpen) togglePropertiesPanel();
      }
      setPreviousPanelState(null);
    }
  };

  const isLeftPanelActive = notebookModeLevel === 0 ? isSidebarOpen : isNotebookPaneVisible;

  return (
    <div className="flex items-center gap-2 p-1.5 rounded-xl bg-panvas-bg-primary/95 backdrop-blur-xl shadow-2xl ring-1 ring-panvas-border-strong text-panvas-text-primary select-none w-max">
      {/* Full Page View */}
      <button
        type="button"
        onClick={handleToggleFocus}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ${
          notebookModeLevel === 2 
            ? 'bg-panvas-bg-hover text-panvas-text-primary' 
            : 'text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-hover'
        }`}
        title={notebookModeLevel === 2 ? "Exit Full Page View" : "Enter Full Page View"}
      >
        {notebookModeLevel === 2 ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>

      <div className="w-px h-4 bg-panvas-border-default mx-1 shrink-0"></div>

      {/* Left Navigation Panel */}
      <button
        type="button"
        onClick={handleToggleLeftPanel}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ${
          isLeftPanelActive 
            ? 'bg-panvas-bg-hover text-panvas-text-primary' 
            : 'text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-hover'
        }`}
        title={notebookModeLevel === 0 ? (isSidebarOpen ? "Hide Library" : "Show Library") : (isNotebookPaneVisible ? "Hide Notebook Navigator" : "Show Notebook Navigator")}
      >
        <PanelLeft size={16} />
      </button>

      {/* Page Properties */}
      <button
        type="button"
        onClick={togglePropertiesPanel}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ${
          isPropertiesPanelOpen 
            ? 'bg-panvas-bg-hover text-panvas-text-primary' 
            : 'text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-hover'
        }`}
        title="Toggle Page Properties"
      >
        <PanelRight size={16} />
      </button>
    </div>
  );
};
