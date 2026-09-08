// ============================================
// Panvas — Canvas View (Excalidraw Wrapper)
// ============================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { CanvasOverlay } from './CanvasOverlay';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasLibraryDrawer } from './CanvasLibraryDrawer';
import { WelcomeScreen as PanvasWelcomeScreen } from './WelcomeScreen';
import { DefaultSidebar, convertToExcalidrawElements, loadFromBlob } from '@excalidraw/excalidraw';
import { useAutosave } from '@/hooks/useAutosave';
import { UniversalDropRouter } from '@/services/drop/UniversalDropRouter';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';
import {
  deleteCanvasLibrary,
  getCanvasLibraries,
  importCanvasLibrary,
  saveCanvasLibrary,
} from '@/services/canvas/canvasLibraryRepository';
import { PERSONAL_LIBRARY_FILE, type CanvasLibraryRecord } from '@/services/canvas/canvasLibraryModel';
import {
  captureCanvasSceneElementIds,
  createExcalidrawShapeSkeleton,
  findCurrentGestureFreedrawElement,
  recognizeCanvasGesture,
} from './canvasGestureRecognition';
import { normalizeCanvasColor } from './canvasBackgrounds';
import type { StrokePoint } from '../notebook/engine/drawingTypes';

type LibraryItems = readonly any[];
type CanvasPointerPayload = {
  pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
  button: 'down' | 'up';
  pointersMap?: unknown;
};

// Lazy-loaded Excalidraw
let ExcalidrawComponent: React.ComponentType<any> | null = null;
let MainMenuComponent: any = null;
let WelcomeScreenComponent: any = null;
let excalidrawLoaded = false;

const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
  },
};

export function CanvasView() {
  const { activeCanvasId, activeWorkspaceId } = useWorkspaceStore();
  const {
    currentData,
    loadCanvasData,
    setExcalidrawAPI,
    excalidrawAPI,
    customBlocks,
    addBlock,
    updateBlock,
  } = useCanvasStore();

  // NOTE: the `() =>` wrappers are load-bearing, not stylistic. `useState(fn)` treats a
  // function argument as a LAZY INITIALIZER and calls it during render. `MainMenu` is a
  // plain React.FC and `WelcomeScreen` is a callable object, so passing them bare made
  // React invoke them outside the <Excalidraw> provider on any remount where these
  // module-level caches were already warm. Excalidraw's TunnelsContext defaults to null,
  // so useTunnels() then threw "Cannot destructure property 'jotaiScope' of ... as it is null".
  // Keep the extra arrow so the component is stored as a VALUE.
  const [Excalidraw, setExcalidraw] = useState<React.ComponentType<any> | null>(() => ExcalidrawComponent);
  const [MainMenu, setMainMenu] = useState<any>(() => MainMenuComponent);
  const [ExcalidrawWelcomeScreen, setExcalidrawWelcomeScreen] = useState<any>(() => WelcomeScreenComponent);
  const [isLoading, setIsLoading] = useState(true);
  const [isCanvasDataReady, setIsCanvasDataReady] = useState(false);
  const [libraryManagerOpen, setLibraryManagerOpen] = useState(false);
  const [libraryRecords, setLibraryRecords] = useState<CanvasLibraryRecord[]>([]);
  const [librariesLoading, setLibrariesLoading] = useState(false);
  const [drawToShapeEnabled, setDrawToShapeEnabled] = useState(() => {
    try {
      return window.localStorage.getItem('panvas.canvas.drawToShape') === 'true';
    } catch {
      return false;
    }
  });
  const isInitialLoad = useRef(true);
  const isHydratingLibrary = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const preGestureElementIdsRef = useRef<Set<string> | null>(null);
  const gestureRef = useRef<{
    active: boolean;
    points: StrokePoint[];
    existingElementIds: Set<string>;
  }>({ active: false, points: [], existingElementIds: new Set() });

  // Load Excalidraw dynamically
  useEffect(() => {
    if (excalidrawLoaded && ExcalidrawComponent && MainMenuComponent && WelcomeScreenComponent) {
      setExcalidraw(() => ExcalidrawComponent);
      setMainMenu(() => MainMenuComponent);
      setExcalidrawWelcomeScreen(() => WelcomeScreenComponent);
      setIsLoading(false);
      return;
    }

    import('@excalidraw/excalidraw').then((mod) => {
      ExcalidrawComponent = mod.Excalidraw;
      MainMenuComponent = mod.MainMenu;
      WelcomeScreenComponent = mod.WelcomeScreen;
      excalidrawLoaded = true;
      setExcalidraw(() => mod.Excalidraw);
      setMainMenu(() => mod.MainMenu);
      setExcalidrawWelcomeScreen(() => mod.WelcomeScreen);
      setIsLoading(false);
    });
  }, []);

  // Load canvas data when active canvas changes
  useEffect(() => {
    let cancelled = false;

    if (activeCanvasId) {
      isInitialLoad.current = true;
      setIsCanvasDataReady(false);

      loadCanvasData(activeCanvasId, activeWorkspaceId ?? undefined).finally(() => {
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
  }, [activeCanvasId, activeWorkspaceId, loadCanvasData]);

  useEffect(() => {
    if (!isCanvasDataReady) return;

    const initialLoadTimer = window.setTimeout(() => {
      isInitialLoad.current = false;
    }, 100);

    return () => {
      window.clearTimeout(initialLoadTimer);
    };
  }, [activeCanvasId, isCanvasDataReady]);

  // Clean up excalidrawAPI when component unmounts OR when Excalidraw is hidden
  useEffect(() => {
    if (!isCanvasDataReady) {
      setExcalidrawAPI(null);
    }
    return () => {
      setExcalidrawAPI(null);
    };
  }, [isCanvasDataReady, setExcalidrawAPI]);
  useEffect(() => {
    if (!excalidrawAPI) return;

    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'excalidraw-library') {
        try {
          let libraryItemsToImport: any[] | null = null;
          if (data.libraryUrl) {
            const res = await fetch(data.libraryUrl);
            const library = await res.json();
            libraryItemsToImport = Array.isArray(library) ? library : library.libraryItems || library.library;
          } else if (data.library) {
            libraryItemsToImport = Array.isArray(data.library) ? data.library : data.library.libraryItems || data.library.library;
          }

          if (libraryItemsToImport) {
            await excalidrawAPI.updateLibrary({ 
              libraryItems: libraryItemsToImport, 
              prompt: false,
              merge: true,
            });
            useUIStore.getState().showToast(`Imported ${libraryItemsToImport.length} items to library!`, 'success');
          }
        } catch (err) {
          console.error('Error during library import:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback for Hash-based redirect method
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('addLibrary=')) {
        const urlParams = new URLSearchParams(hash.replace('#', '?'));
        const libraryUrl = urlParams.get('addLibrary');
        if (libraryUrl) {
          fetch(decodeURIComponent(libraryUrl))
            .then(res => res.json())
            .then(library => {
              const libraryItems = Array.isArray(library) ? library : library.libraryItems || library.library;
              if (libraryItems) {
                excalidrawAPI.updateLibrary({ libraryItems });
                useUIStore.getState().showToast(`Imported ${libraryItems.length} items from hash!`, 'success');
              }
            })
            .catch(err => console.error('Failed to fetch library from hash:', err));
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Check hash immediately in case it's already there
    if (window.location.hash.includes('addLibrary=')) {
      handleHashChange();
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI || !activeWorkspaceId) return;
    let cancelled = false;
    setLibrariesLoading(true);
    void getCanvasLibraries(activeWorkspaceId)
      .then(async (records) => {
        if (cancelled) return;
        setLibraryRecords(records);
        const libraryItems = records.flatMap((record) => [...record.libraryItems]);
        if (libraryItems.length > 0) {
          isHydratingLibrary.current = true;
          try {
            await excalidrawAPI.updateLibrary({ libraryItems: libraryItems as LibraryItems, merge: true, prompt: false });
          } finally {
            isHydratingLibrary.current = false;
          }
        }
      })
      .catch((error) => {
        console.error('Failed to load canvas libraries:', error);
        useUIStore.getState().showToast('Could not load canvas libraries', 'error');
      })
      .finally(() => { if (!cancelled) setLibrariesLoading(false); });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, excalidrawAPI]);

  const handleLibraryChange = useCallback(async (libraryItems: LibraryItems) => {
    if (!activeWorkspaceId || isHydratingLibrary.current) return;
    try {
      const personal = await saveCanvasLibrary(activeWorkspaceId, PERSONAL_LIBRARY_FILE, libraryItems);
      setLibraryRecords((records) => [...records.filter((record) => record.fileName !== PERSONAL_LIBRARY_FILE), personal]);
    } catch (error) {
      console.error('Failed to persist personal canvas library:', error);
      useUIStore.getState().showToast('Could not save the personal library', 'error');
    }
  }, [activeWorkspaceId]);

  const handleLibraryImport = useCallback(async (file: File) => {
    if (!activeWorkspaceId || !excalidrawAPI) return;
    try {
      const record = await importCanvasLibrary(activeWorkspaceId, file.name, await file.text());
      isHydratingLibrary.current = true;
      try {
        await excalidrawAPI.updateLibrary({ libraryItems: record.libraryItems as LibraryItems, merge: true, prompt: false });
      } finally {
        isHydratingLibrary.current = false;
      }
      setLibraryRecords((records) => [...records.filter((item) => item.fileName !== record.fileName), record]);
      useUIStore.getState().showToast(`Imported ${record.name}`, 'success');
    } catch (error) {
      console.error('Failed to import canvas library:', error);
      useUIStore.getState().showToast(error instanceof Error ? error.message : 'Could not import library', 'error');
    }
  }, [activeWorkspaceId, excalidrawAPI]);

  const handleLibraryLoad = useCallback(async (record: CanvasLibraryRecord) => {
    if (!excalidrawAPI) return;
    isHydratingLibrary.current = true;
    try {
      await excalidrawAPI.updateLibrary({ libraryItems: record.libraryItems as LibraryItems, merge: true, prompt: false });
      setLibraryManagerOpen(false);
      excalidrawAPI.toggleSidebar({ name: 'default', tab: 'library', force: true });
    } finally {
      isHydratingLibrary.current = false;
    }
  }, [excalidrawAPI]);

  const handleLibraryDelete = useCallback(async (record: CanvasLibraryRecord) => {
    if (!activeWorkspaceId || !excalidrawAPI) return;
    await deleteCanvasLibrary(activeWorkspaceId, record.fileName);
    const remaining = libraryRecords.filter((item) => item.fileName !== record.fileName);
    isHydratingLibrary.current = true;
    try {
      await excalidrawAPI.updateLibrary({ libraryItems: remaining.flatMap((item) => [...item.libraryItems]) as LibraryItems, merge: false, prompt: false });
    } finally {
      isHydratingLibrary.current = false;
    }
    setLibraryRecords(remaining);
    useUIStore.getState().showToast(`Removed ${record.name}`, 'success');
  }, [activeWorkspaceId, excalidrawAPI, libraryRecords]);

  const { triggerAutosave } = useAutosave(activeCanvasId);

  const handleToggleDrawToShape = useCallback(() => {
    setDrawToShapeEnabled((enabled) => {
      const next = !enabled;
      try {
        window.localStorage.setItem('panvas.canvas.drawToShape', String(next));
      } catch {
        // Local preference persistence is best-effort in restricted browser profiles.
      }
      return next;
    });
  }, []);

  const handleBackgroundColorChange = useCallback(async (color: string) => {
    const api = useCanvasStore.getState().excalidrawAPI as any;
    const normalizedColor = normalizeCanvasColor(color);
    if (!api || !activeCanvasId || !normalizedColor) return;

    api.updateScene({ appState: { viewBackgroundColor: normalizedColor }, commitToHistory: false });
    const state = api.getAppState?.() ?? {};
    const activeBackgroundColor = normalizeCanvasColor(state.viewBackgroundColor ?? '') ?? normalizedColor;
    const persistedAppState = useCanvasStore.getState().currentData?.appState ?? {};
    await useCanvasStore.getState().saveCanvasData({
      canvasFileId: activeCanvasId,
      elements: api.getSceneElements?.() ?? [],
      appState: {
        ...persistedAppState,
        viewBackgroundColor: activeBackgroundColor,
        zoom: state.zoom,
        scrollX: state.scrollX,
        scrollY: state.scrollY,
      },
      files: api.getFiles?.() ?? {},
    }, activeWorkspaceId ?? undefined);
  }, [activeCanvasId, activeWorkspaceId]);

  const replaceRecognizedGesture = useCallback((points: StrokePoint[], existingElementIds: Set<string>) => {
    const api = useCanvasStore.getState().excalidrawAPI as any;
    if (!api || !drawToShapeEnabled || points.length < 4) return;

    const appState = api.getAppState?.() ?? {};
    const recognition = recognizeCanvasGesture(points, {
      snapToAngles: Boolean(appState.objectsSnapModeEnabled),
      snapEqualSides: Boolean(appState.objectsSnapModeEnabled),
    });
    if (!recognition) return;

    const elements = [...(api.getSceneElements?.() ?? [])] as any[];
    const source = findCurrentGestureFreedrawElement(elements, existingElementIds);
    if (!source) return;

    const style = {
      strokeColor: appState.currentItemStrokeColor ?? '#1e1e1e',
      backgroundColor: appState.currentItemBackgroundColor ?? 'transparent',
      fillStyle: appState.currentItemFillStyle ?? 'solid',
      strokeWidth: appState.currentItemStrokeWidth ?? 2,
      strokeStyle: appState.currentItemStrokeStyle ?? 'solid',
      roughness: appState.currentItemRoughness ?? 1,
      opacity: appState.currentItemOpacity ?? 100,
    };
    const skeleton = createExcalidrawShapeSkeleton(recognition, style);
    const [replacement] = convertToExcalidrawElements([skeleton as any]);
    if (!replacement) return;

    api.updateScene({
      elements: [...elements.filter((element) => element.id !== source.id), replacement],
      commitToHistory: true,
    });
  }, [drawToShapeEnabled]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !excalidrawAPI || !drawToShapeEnabled) {
      preGestureElementIdsRef.current = null;
      return;
    }
    const capturePreGestureScene = () => {
      const api = useCanvasStore.getState().excalidrawAPI as any;
      preGestureElementIdsRef.current = api?.getAppState?.()?.activeTool?.type === 'freedraw'
        ? captureCanvasSceneElementIds(api.getSceneElements?.() ?? [])
        : null;
    };
    container.addEventListener('pointerdown', capturePreGestureScene, true);
    return () => {
      container.removeEventListener('pointerdown', capturePreGestureScene, true);
      preGestureElementIdsRef.current = null;
    };
  }, [drawToShapeEnabled, excalidrawAPI]);

  const handlePointerUpdate = useCallback((payload: CanvasPointerPayload) => {
    if (!drawToShapeEnabled || payload.pointer.tool !== 'pointer') {
      if (payload.button === 'up') gestureRef.current = { active: false, points: [], existingElementIds: new Set() };
      return;
    }

    const point: StrokePoint = {
      x: payload.pointer.x,
      y: payload.pointer.y,
      pressure: 1,
      t: typeof performance === 'undefined' ? Date.now() : performance.now(),
    };
    const pointerUp = payload.button === 'up';

    if (!gestureRef.current.active) {
      if (pointerUp) return;
      const api = useCanvasStore.getState().excalidrawAPI as any;
      const activeTool = api?.getAppState?.()?.activeTool?.type;
      if (activeTool !== 'freedraw') return;

      const existingElementIds = preGestureElementIdsRef.current ?? (() => {
        const elements = (api?.getSceneElements?.() ?? []).filter((e: any) => !e.isDeleted);
        const ids = captureCanvasSceneElementIds(elements);
        const editingId = api?.getAppState?.()?.editingElement?.id;
        if (editingId) ids.delete(editingId);
        return ids;
      })();
      preGestureElementIdsRef.current = null;
      if (!existingElementIds) return;
      gestureRef.current = { active: true, points: [point], existingElementIds };
      return;
    }

    // Gesture is active: collect trajectory points
    gestureRef.current.points.push(point);

    if (!pointerUp) return;
    const points = gestureRef.current.points;
    const existingElementIds = gestureRef.current.existingElementIds;
    gestureRef.current = { active: false, points: [], existingElementIds: new Set() };
    // Excalidraw commits its freehand element during pointer-up. Defer one task
    // so the replacement removes exactly that newly-created element.
    window.setTimeout(() => replaceRecognizedGesture(points, existingElementIds), 0);
  }, [drawToShapeEnabled, replaceRecognizedGesture]);

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

  // PDF and Image drag-and-drop handler
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (!activeCanvasId) return;
    
    // Check if the drop is something UniversalDropRouter handles explicitly
    const classification = UniversalDropRouter.classifyDrop(e.dataTransfer);
    
    if (classification.type === 'PDF' && classification.file) {
      e.preventDefault(); // Intercept only if it's a PDF
      const pdfFile = classification.file;
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
    } else {
      // Let Excalidraw handle images natively
      return;
    }
  }, [activeCanvasId, addBlock, updateBlock]);

  const initialExcalidrawData = React.useMemo(() => {
    if (currentData) {
      const { isLibraryOpen, isLibraryMenuDocked, ...restAppState } = currentData.appState || {};
      return {
        elements: currentData.elements,
        appState: {
          ...restAppState,
          theme: 'dark',
        },
        files: currentData.files,
      };
    }
    return {
      appState: { theme: 'dark' },
    };
  }, [currentData]);

  // No canvas selected → show welcome
  if (!activeCanvasId) {
    return <PanvasWelcomeScreen />;
  }

  // Loading states
  if (isLoading || !isCanvasDataReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-panvas-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <img src="./panvas_logo.png" alt="Panvas" className="w-12 h-12 rounded-xl shadow-glass-sm animate-pulse-subtle" />
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
      // Only preventDefault on dragOver if we are dragging a PDF, 
      // but typically we can't inspect file types easily during dragOver.
      // Actually, removing `onDragOver={e => e.preventDefault()}` entirely allows Excalidraw's container
      // to handle the dragOver event natively. If we need PDFs to drop, we *must* preventDefault.
      onDragOver={e => {
        // Excalidraw handles its own dragOver, but if we don't preventDefault here, 
        // the browser might reject drops on this outer div.
        // We'll let it be, but Excalidraw's container is full width/height anyway.
      }}
    >
      {/* Custom Panvas Toolbar */}
      {excalidrawAPI && (
        <CanvasToolbar
          libraryManagerOpen={libraryManagerOpen}
          onToggleLibraryManager={() => setLibraryManagerOpen((open) => !open)}
          drawToShapeEnabled={drawToShapeEnabled}
          onToggleDrawToShape={handleToggleDrawToShape}
          onLassoSelect={() => {
            const api = useCanvasStore.getState().excalidrawAPI as any;
            api?.setActiveTool?.({ type: 'selection', locked: false });
          }}
          onBackgroundColorChange={handleBackgroundColorChange}
        />
      )}
      {/* Excalidraw Canvas */}
      <div ref={canvasContainerRef} className="w-full h-full panvas-excalidraw-wrapper" id="excalidraw-container">
        <Excalidraw
          key={activeCanvasId}
          excalidrawAPI={setExcalidrawAPI}
          initialData={initialExcalidrawData}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          onLibraryChange={handleLibraryChange}
          theme="dark"
          UIOptions={EXCALIDRAW_UI_OPTIONS}
        >
          <DefaultSidebar />
          {MainMenu && (
            <MainMenu>
              <MainMenu.DefaultItems.LoadScene />
              <MainMenu.DefaultItems.SaveToActiveFile />
              <MainMenu.DefaultItems.Export />
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ToggleTheme />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
              <MainMenu.Separator />
              <MainMenu.ItemLink href="https://panvas.app/docs" shortcut="?">
                Panvas Documentation
              </MainMenu.ItemLink>
              <MainMenu.ItemLink href="https://github.com/sksum/panvas/issues">
                Report Bug
              </MainMenu.ItemLink>
            </MainMenu>
          )}
          {ExcalidrawWelcomeScreen && (
            <ExcalidrawWelcomeScreen>
              <ExcalidrawWelcomeScreen.Hints.MenuHint />
              <ExcalidrawWelcomeScreen.Hints.ToolbarHint />
              <ExcalidrawWelcomeScreen.Hints.HelpHint />
              <ExcalidrawWelcomeScreen.Center>
                <div className="flex flex-col items-center gap-4 w-full max-w-sm px-6 pb-24">
                  <div className="w-20 h-20 mb-2 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-tr from-panvas-accent-purple/20 to-panvas-accent-blue/20 rounded-2xl blur-xl"></div>
                    <img src="./panvas_logo.png" alt="Panvas" className="w-full h-full rounded-2xl shadow-glass-lg relative z-10 select-none pointer-events-none" />
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-panvas-text-primary text-center mb-6 select-none">
                    Welcome to Panvas
                  </div>
                  
                  <div className="flex flex-col gap-2.5 w-full pointer-events-auto">
                    <button 
                      onClick={async () => {
                        try {
                          const wsId = useWorkspaceStore.getState().activeWorkspaceId;
                          if (wsId) {
                            const canvas = await useWorkspaceStore.getState().createCanvas(null, null, null, 'New Diagram');
                            useWorkspaceStore.getState().setActiveCanvas(canvas.id);
                          }
                        } catch (e) {
                          console.error("Failed to create diagram", e);
                        }
                      }}
                      className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-panvas-bg-tertiary/50 hover:bg-panvas-bg-elevated border border-white/5 hover:border-white/10 transition-all text-sm font-medium text-panvas-text-primary text-left"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-panvas-accent-blue"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                      Create Diagram
                    </button>

                    <button 
                      onClick={() => {
                        useUIStore.getState().openCreateDialog('notebook');
                      }}
                      className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-panvas-bg-tertiary/50 hover:bg-panvas-bg-elevated border border-white/5 hover:border-white/10 transition-all text-sm font-medium text-panvas-text-primary text-left"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-panvas-accent-teal"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      New Notebook
                    </button>

                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.excalidraw,.png,.jpg,.jpeg,.svg';
                        input.onchange = async (e: any) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          try {
                            const scene = await loadFromBlob(file, null, null);
                            if (excalidrawAPI) {
                              excalidrawAPI.updateScene(scene);
                              useUIStore.getState().showToast('Imported successfully', 'success');
                            }
                          } catch (err) {
                            console.error('Failed to load file', err);
                            useUIStore.getState().showToast('Failed to load file', 'error');
                          }
                        };
                        input.click();
                      }}
                      className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-panvas-bg-tertiary/50 hover:bg-panvas-bg-elevated border border-white/5 hover:border-white/10 transition-all text-sm font-medium text-panvas-text-primary text-left"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-panvas-accent-rose"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      Import File
                    </button>
                  </div>
                </div>
              </ExcalidrawWelcomeScreen.Center>
            </ExcalidrawWelcomeScreen>
          )}
        </Excalidraw>
      </div>

      {/* Custom Blocks Overlay */}
      {customBlocks.length > 0 && excalidrawAPI && (
        <CanvasOverlay blocks={customBlocks} excalidrawAPI={excalidrawAPI} />
      )}

      {libraryManagerOpen && excalidrawAPI && (
        <CanvasLibraryDrawer
          records={libraryRecords}
          loading={librariesLoading}
          onClose={() => setLibraryManagerOpen(false)}
          onOpenPersonalLibrary={() => {
            setLibraryManagerOpen(false);
            excalidrawAPI.toggleSidebar({ name: 'default', tab: 'library', force: true });
          }}
          onImport={handleLibraryImport}
          onLoad={handleLibraryLoad}
          onDelete={handleLibraryDelete}
        />
      )}
    </div>
  );
}
