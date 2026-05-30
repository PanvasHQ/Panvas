// ============================================
// Panvas — Canvas View (Excalidraw Wrapper)
// ============================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useCanvasStore } from '@/stores/canvasStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { CanvasOverlay } from './CanvasOverlay';
import { WelcomeScreen } from './WelcomeScreen';
import { useAutosave } from '@/hooks/useAutosave';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';

// Lazy-loaded Excalidraw
let ExcalidrawComponent: React.ComponentType<any> | null = null;
let excalidrawLoaded = false;

const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
  },
};

export function CanvasView() {
  const { activeCanvasId } = useWorkspaceStore();
  const {
    currentData,
    loadCanvasData,
    setExcalidrawAPI,
    excalidrawAPI,
    customBlocks,
    addBlock,
    updateBlock,
  } = useCanvasStore();

  const [Excalidraw, setExcalidraw] = useState<React.ComponentType<any> | null>(ExcalidrawComponent);
  const [isLoading, setIsLoading] = useState(true);
  const [isCanvasDataReady, setIsCanvasDataReady] = useState(false);
  const isInitialLoad = useRef(true);

  // Load Excalidraw dynamically
  useEffect(() => {
    if (excalidrawLoaded && ExcalidrawComponent) {
      setExcalidraw(() => ExcalidrawComponent);
      setIsLoading(false);
      return;
    }

    import('@excalidraw/excalidraw').then((mod) => {
      ExcalidrawComponent = mod.Excalidraw;
      excalidrawLoaded = true;
      setExcalidraw(() => mod.Excalidraw);
      setIsLoading(false);
    });
  }, []);

  // Load canvas data when active canvas changes
  useEffect(() => {
    let cancelled = false;

    if (activeCanvasId) {
      isInitialLoad.current = true;
      setIsCanvasDataReady(false);

      loadCanvasData(activeCanvasId).finally(() => {
        if (!cancelled) {
          setIsCanvasDataReady(true);
        }
      });
    } else {
      setIsCanvasDataReady(false);
    }

    return () => {
      cancelled = true;
    };
  }, [activeCanvasId, loadCanvasData]);

  useEffect(() => {
    if (!isCanvasDataReady) return;

    const initialLoadTimer = window.setTimeout(() => {
      isInitialLoad.current = false;
    }, 100);

    return () => {
      window.clearTimeout(initialLoadTimer);
    };
  }, [activeCanvasId, isCanvasDataReady]);

  const { triggerAutosave } = useAutosave(activeCanvasId);

  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }
      
      triggerAutosave(elements, appState, files);
    },
    [triggerAutosave]
  );

  // PDF drag-and-drop handler
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (!activeCanvasId) return;
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(f => f.type === 'application/pdf');
    if (!pdfFile) return;

    const arrayBuffer = await pdfFile.arrayBuffer();
    const userId = useAuthStore.getState().user?.id ?? null;
    const stored = await canvasRepository.storePdf(userId, activeCanvasId, pdfFile.name, arrayBuffer);
    await addBlock('pdf', 100, 100, pdfFile.name);
    // Update the last block with PDF metadata
    const blocks = useCanvasStore.getState().customBlocks;
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock) {
      await updateBlock(lastBlock.id, {
        metadata: { pdfDataId: stored.id, currentPage: 1, totalPages: 0, scale: 1.0 },
      });
    }
    useUIStore.getState().showToast(`Imported ${pdfFile.name}`, 'success');
  }, [activeCanvasId, addBlock, updateBlock]);

  const initialExcalidrawData = React.useMemo(() => (currentData
    ? {
        elements: currentData.elements,
        appState: {
          ...currentData.appState,
          theme: 'dark',
        },
        files: currentData.files,
      }
    : {
        appState: { theme: 'dark' },
      }), [currentData]);

  // No canvas selected → show welcome
  if (!activeCanvasId) {
    return <WelcomeScreen />;
  }

  // Loading states
  if (isLoading || !isCanvasDataReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-panvas-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <img src="/panvas-logo-1.png" alt="Panvas" className="w-12 h-12 rounded-xl shadow-glass-sm animate-pulse-subtle" />
          <span className="text-sm text-panvas-text-tertiary mt-2">Loading canvas...</span>
        </div>
      </div>
    );
  }

  if (!Excalidraw) return null;



  return (
    <div
      className="relative w-full h-full"
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      {/* Excalidraw Canvas */}
      <div className="w-full h-full" id="excalidraw-container">
        <Excalidraw
          key={activeCanvasId}
          excalidrawAPI={setExcalidrawAPI}
          initialData={initialExcalidrawData}
          onChange={handleChange}
          theme="dark"
          UIOptions={EXCALIDRAW_UI_OPTIONS}
        />
      </div>

      {/* Custom Blocks Overlay */}
      {customBlocks.length > 0 && excalidrawAPI && (
        <CanvasOverlay blocks={customBlocks} excalidrawAPI={excalidrawAPI} />
      )}
    </div>
  );
}
