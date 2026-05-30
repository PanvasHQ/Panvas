// ============================================
// Panvas — useAutosave Hook
// Hardened autosave with 1000ms debounce and dirty flag
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';

export function useAutosave(activeCanvasId: string | null) {
  const { saveCanvasData } = useCanvasStore();
  
  // Track if there are pending unsaved changes
  const isDirty = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestData = useRef<{ elements: any; appState: any; files: any } | null>(null);

  // The actual save function
  const flushSave = useCallback(
    async (elements?: any, appState?: any, files?: any) => {
      if (!activeCanvasId || !isDirty.current) return;

      const data = elements && appState
        ? { elements, appState, files }
        : latestData.current;

      if (!data) return;

      isDirty.current = false;

      await saveCanvasData({
        canvasFileId: activeCanvasId,
        elements: data.elements,
        appState: {
          viewBackgroundColor: data.appState.viewBackgroundColor,
          zoom: data.appState.zoom,
          scrollX: data.appState.scrollX,
          scrollY: data.appState.scrollY,
        },
        files: data.files,
      });
    },
    [activeCanvasId, saveCanvasData]
  );

  // Debounced wrapper called by onChange
  const triggerAutosave = useCallback(
    (elements: any, appState: any, files: any) => {
      isDirty.current = true;
      latestData.current = { elements, appState, files };

      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }

      saveTimeout.current = setTimeout(() => {
        void flushSave();
      }, 1000); // 1000ms debounce
    },
    [flushSave]
  );

  // Ensure pending saves flush when unmounting or switching canvases
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
      void flushSave();
    };
  }, [flushSave]);

  return { triggerAutosave };
}
