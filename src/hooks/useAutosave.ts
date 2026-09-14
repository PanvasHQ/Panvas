// ============================================
// Panvas — useAutosave Hook
// Hardened autosave with 1000ms debounce and dirty flag
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { mergeCanvasAppStateForPersistence } from '@/services/canvas/canvasSceneState';

export function useAutosave(activeCanvasId: string | null, activeWorkspaceId?: string | null) {
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

      const previousAppState = useCanvasStore.getState().currentData?.appState ?? {};
      try {
        await saveCanvasData({
          canvasFileId: activeCanvasId,
          elements: data.elements,
          appState: mergeCanvasAppStateForPersistence(previousAppState, data.appState),
          files: data.files,
        }, activeWorkspaceId ?? undefined);
      } catch (error) {
        isDirty.current = true;
        throw error;
      }
    },
    [activeCanvasId, activeWorkspaceId, saveCanvasData]
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
        // The store records the error; retain dirty data for the next edit/retry.
        void flushSave().catch(() => {});
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
      void flushSave().catch(() => {}); // Failure remains visible in the store.
    };
  }, [flushSave]);

  const saveNow = useCallback(async (elements: any, appState: any, files: any) => {
    isDirty.current = true;
    latestData.current = { elements, appState, files };
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
    await flushSave(elements, appState, files);
  }, [flushSave]);

  return { triggerAutosave, saveNow };
}
