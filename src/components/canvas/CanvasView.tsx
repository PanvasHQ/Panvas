// ============================================
// Panvas — Canvas View (Excalidraw Wrapper)
// ============================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { CanvasOverlay } from './CanvasOverlay';
import { CanvasToolbar } from './CanvasToolbar';
import { WelcomeScreen as PanvasWelcomeScreen } from './WelcomeScreen';
import { Excalidraw, MainMenu, WelcomeScreen as ExcalidrawWelcomeScreen } from '@excalidraw/excalidraw';
import { loadFromBlob } from '@excalidraw/excalidraw';
import { useAutosave } from '@/hooks/useAutosave';
import { UniversalDropRouter } from '@/services/drop/UniversalDropRouter';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';

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
  const [MainMenu, setMainMenu] = useState<any>(MainMenuComponent);
  const [ExcalidrawWelcomeScreen, setExcalidrawWelcomeScreen] = useState<any>(WelcomeScreenComponent);
  const [isLoading, setIsLoading] = useState(true);
  const [isCanvasDataReady, setIsCanvasDataReady] = useState(false);
  const isInitialLoad = useRef(true);

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
          <img src="./panvas-logo-1.1.png" alt="Panvas" className="w-12 h-12 rounded-xl shadow-glass-sm animate-pulse-subtle" />
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
      {excalidrawAPI && <CanvasToolbar />}

      {/* Excalidraw Canvas */}
      <div className="w-full h-full panvas-excalidraw-wrapper" id="excalidraw-container">
        <Excalidraw
          key={activeCanvasId}
          excalidrawAPI={setExcalidrawAPI}
          initialData={initialExcalidrawData}
          onChange={handleChange}
          theme="dark"
          UIOptions={EXCALIDRAW_UI_OPTIONS}
        >
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
                    <img src="./panvas-logo-1.1.png" alt="Panvas" className="w-full h-full rounded-2xl shadow-glass-lg relative z-10 select-none pointer-events-none" />
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
                            const canvas = await useWorkspaceStore.getState().createCanvas(null, 'New Diagram');
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
                        useUIStore.getState().showToast('Notes feature is coming soon!', 'info');
                      }}
                      className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-panvas-bg-tertiary/50 hover:bg-panvas-bg-elevated border border-white/5 hover:border-white/10 transition-all text-sm font-medium text-panvas-text-primary text-left opacity-70"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-panvas-accent-teal"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      Create Note
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
    </div>
  );
}
