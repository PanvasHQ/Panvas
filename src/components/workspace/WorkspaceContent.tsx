import React from 'react';
import { CanvasView } from '@/components/canvas/CanvasView';
import { NotebookRenderer } from '@/components/notebook/NotebookRenderer';
import { PdfWorkspace } from '@/components/pdf/PdfWorkspace';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function WorkspaceContent() {
  const { activePageId, notebookPages } = useWorkspaceStore();
  
  if (activePageId) {
    const activePage = notebookPages.find(p => p.id === activePageId);
    if (activePage?.type === 'pdf') {
      return <PdfWorkspace page={activePage} />;
    }
    return <NotebookRenderer />;
  }
  
  return <CanvasView />;
}
