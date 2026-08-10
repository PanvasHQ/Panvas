import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Bookmark, BookOpen, CalendarClock, ChevronLeft, ChevronRight, Copy, FileText, Hand, Maximize2, MessageCircle, Minus, PanelLeftClose, PanelLeftOpen, PanelRight, Plus, Redo2, Undo2 } from 'lucide-react';
import { PdfThumbnailSidebar } from './PdfThumbnailSidebar';
import { PdfPageRenderer } from './PdfPageRenderer';
import { usePdfDocument } from '@/hooks/usePdfDocument';
import type { NotebookPage } from '@/types/notebook';
import { NotebookEngine } from '@/components/notebook/engine/NotebookEngine';
import type { ViewportState, TextObject } from '@/components/notebook/engine/drawingTypes';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { notebookRepository } from '@/repositories/NotebookRepository';
import { NotebookFloatingToolbar } from '@/components/notebook/NotebookFloatingToolbar';
import { FloatingTextEditor } from '@/components/notebook/FloatingTextEditor';
import type { Editor } from '@tiptap/react';

const iconButtonClass = 'flex h-8 w-8 items-center justify-center rounded-md text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary active:bg-panvas-bg-active focus-ring';

export function PdfWorkspace({ page }: { page?: NotebookPage }) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const { pdfDocument, numPages, isLoading, error } = usePdfDocument(page?.pdfDataId);
  const { workspaces, notebooks } = useWorkspaceStore();
  const { notebookModeLevel, setNotebookModeLevel } = useLayoutStore();
  
  const notebook = page ? notebooks.find(item => item.id === page.notebookId) : undefined;
  const workspace = notebook ? workspaces.find(item => item.id === notebook.workspaceId) : undefined;

  // Engine setup
  const notebookEngine = useMemo(() => new NotebookEngine(), []);
  const [viewport, setViewport] = useState<Readonly<ViewportState>>(() => notebookEngine.viewport.getState());
  const [toolState, setToolState] = useState(() => notebookEngine.tools.getState());
  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [paperDimensions, setPaperDimensions] = useState({ width: 794, height: 1123 });

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [sidebarWidth, setSidebarWidth] = useState(0);
  

  
  // Sidebar toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Determine PDF Page Dimensions
  useEffect(() => {
    if (!pdfDocument || numPages === 0) return;
    let isMounted = true;
    pdfDocument.getPage(currentPage).then(pdfPage => {
      if (!isMounted) return;
      const vp = pdfPage.getViewport({ scale: 1.0 });
      setPaperDimensions({ width: vp.width, height: vp.height });
    });
    return () => { isMounted = false; };
  }, [pdfDocument, currentPage, numPages]);

  // Sync Engine state to React
  useEffect(() => {
    const unsubViewport = notebookEngine.viewport.subscribe(setViewport);
    const unsubTools = notebookEngine.tools.subscribe(setToolState);
    const unsubDrawing = notebookEngine.input.onDrawingChange(() => {
      setTextObjects([...notebookEngine.texts.getTexts()]);
    });
    const unsubHistory = notebookEngine.history.subscribe(() => {
      setTextObjects([...notebookEngine.texts.getTexts()]);
    });
    return () => {
      unsubViewport();
      unsubTools();
      unsubDrawing();
      unsubHistory();
    };
  }, [notebookEngine]);

  // Container and Sidebar ResizeObservers
  useEffect(() => {
    const container = containerRef.current;
    const sidebar = sidebarRef.current;
    
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === container) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        } else if (entry.target === sidebar) {
          setSidebarWidth(entry.contentRect.width);
        }
      }
    });

    if (container) observer.observe(container);
    if (sidebar) observer.observe(sidebar);

    return () => observer.disconnect();
  }, []);

  // Auto-fit zoom to fill workspace width on initial load or page change
  const hasAutoZoomed = useRef<Record<number, boolean>>({});
  useEffect(() => {
    if (hasAutoZoomed.current[currentPage]) return;
    if (isSidebarOpen && sidebarWidth === 0) return; // Wait for the sidebar ResizeObserver to finish
    if (containerSize.width === 0 || paperDimensions.width === 0) return; // Wait for paper dimensions!
    
    const availableWidth = Math.max(100, containerSize.width - (isSidebarOpen ? sidebarWidth : 0));
    const fitZoom = (availableWidth - 40) / paperDimensions.width; // 20px padding on each side
    
    notebookEngine.viewport.setZoom(fitZoom);
    notebookEngine.viewport.setPan(0, 0);
    
    hasAutoZoomed.current[currentPage] = true;
  }, [currentPage, isSidebarOpen, sidebarWidth, containerSize.width, paperDimensions.width, notebookEngine]);

  // Reset auto-zoom flag when active page ID changes (i.e. changing notes)
  useEffect(() => {
    hasAutoZoomed.current = {};
  }, [page?.id]);

  // Panning & Zooming events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Don't intercept wheel events over the floating toolbars or sidebars
      if (e.target instanceof Element && e.target.closest('.pointer-events-auto')) {
        return;
      }
      
      e.preventDefault();
      
      if (e.ctrlKey || e.metaKey) {
        // Ctrl + Mouse Wheel = Zoom around cursor
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        notebookEngine.viewport.zoomBy(zoomFactor, e.clientX, e.clientY);
      } else {
        // Standard Mouse Wheel = Pan
        notebookEngine.viewport.pan(-e.deltaX, -e.deltaY);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [notebookEngine]);



  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === 'F11') {
        e.preventDefault();
        setNotebookModeLevel(notebookModeLevel === 2 ? 0 : 2);
        return;
      }
      
      if (e.key === 'Escape' && notebookModeLevel > 0) {
        setNotebookModeLevel(0);
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            notebookEngine.history.redo();
          } else {
            notebookEngine.history.undo();
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          notebookEngine.history.redo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          notebookEngine.selection.copySelection();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
          e.preventDefault();
          notebookEngine.selection.cutSelection();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
          e.preventDefault();
          notebookEngine.selection.pasteSelection();
        }
        
        // Bug 4: Robust zoom shortcuts
        const isZoomIn = e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd';
        const isZoomOut = e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract';
        const isZoomFit = e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0';

        if ((e.ctrlKey || e.metaKey) && isZoomIn) {
          e.preventDefault();
          notebookEngine.viewport.setZoom(notebookEngine.viewport.getState().scale + 0.25);
        }
        if ((e.ctrlKey || e.metaKey) && isZoomOut) {
          e.preventDefault();
          notebookEngine.viewport.setZoom(notebookEngine.viewport.getState().scale - 0.25);
        }
        if ((e.ctrlKey || e.metaKey) && isZoomFit) {
          e.preventDefault();
          notebookEngine.viewport.setPan(0, 0);
          const availableWidth = Math.max(100, containerSize.width - (isSidebarOpen ? sidebarWidth : 0));
          notebookEngine.viewport.setZoom((availableWidth - 40) / paperDimensions.width);
        }
        return;
      }

      const key = e.key.toLowerCase();
      
      switch (key) {
        case 'arrowleft':
          setCurrentPage(value => Math.max(1, value - 1));
          break;
        case 'arrowright':
          setCurrentPage(value => Math.min(numPages, value + 1));
          break;
        case 'v': notebookEngine.tools.setMode('select'); break;
        case 't': notebookEngine.tools.setMode('text'); break;
        case 'p': notebookEngine.tools.setDrawingTool('pen'); break;
        case 'n': notebookEngine.tools.setDrawingTool('pencil'); break;
        case 'h': notebookEngine.tools.setDrawingTool('highlighter'); break;
        case 'm': notebookEngine.tools.setDrawingTool('marker'); break;
        case 'e': notebookEngine.tools.setEraserMode('stroke'); break;
        case 'r': notebookEngine.tools.setShapeTool('rectangle'); break;
        case 'o': notebookEngine.tools.setShapeTool('ellipse'); break;
        case 'a': notebookEngine.tools.setShapeTool('arrow'); break;
        case 'l': notebookEngine.tools.setShapeTool('line'); break;
        case 'delete':
        case 'backspace':
          notebookEngine.selection.deleteSelection();
          break;
        case 'escape':
          notebookEngine.selection.clearSelection();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [notebookEngine, notebookModeLevel, setNotebookModeLevel]);

  // Load and Save PDF Page Data
  useEffect(() => {
    async function loadPageData() {
      if (!workspace || !notebook || !page) return;
      const pdfPageId = `${page.id}_pdf_${currentPage}`;
      const drawingData = await notebookRepository.loadDrawingData(workspace.id, notebook.id, pdfPageId);
      notebookEngine.setDrawingData(drawingData);
      setTextObjects([...notebookEngine.texts.getTexts()]);
    }
    loadPageData();
  }, [workspace?.id, notebook?.id, page?.id, currentPage, notebookEngine]);

  useEffect(() => {
    if (!canvasRef.current || !workspace || !notebook || !page) return;
    
    const cssWidth = paperDimensions.width * viewport.scale;
    const cssHeight = paperDimensions.height * viewport.scale;
    
    // We only mount/setCanvas. If the scale changes, we rely on the component re-rendering
    // and calling resize() rather than tearing down the whole input manager.
    // Wait, the original code called notebookEngine.mount on scale changes, which clears the context.
    // To prevent pointer capture loss on pinch-to-zoom, we only mount once.
    // However, NotebookEngine.ts doesn't have a check if it's already mounted.
    // Let's just resize it.
    notebookEngine.mount(canvasRef.current, cssWidth, cssHeight);

    return () => {
      notebookEngine.unmount();
    };
  }, [notebookEngine, paperDimensions, viewport.scale, workspace, notebook, page, currentPage]);

  useEffect(() => {
    if (!workspace || !notebook || !page) return;

    let drawingSaveTimeout: NodeJS.Timeout | null = null;
    let hasPendingSave = false;

    const flushSave = () => {
      if (hasPendingSave) {
        const pdfPageId = `${page.id}_pdf_${currentPage}`;
        notebookRepository.saveDrawingData(workspace.id, notebook.id, pdfPageId, notebookEngine.getDrawingData());
        hasPendingSave = false;
        if (drawingSaveTimeout) {
          clearTimeout(drawingSaveTimeout);
          drawingSaveTimeout = null;
        }
      }
    };

    const unsubChange = notebookEngine.history.subscribe(() => {
      hasPendingSave = true;
      if (drawingSaveTimeout) clearTimeout(drawingSaveTimeout);
      
      drawingSaveTimeout = setTimeout(() => {
        flushSave();
      }, 1000);
    });

    return () => {
      unsubChange();
      flushSave(); // Ensure pending saves are written to disk before unmounting/changing pages
    };
  }, [notebookEngine, workspace, notebook, page, currentPage]);

  if (isLoading) {
    return (
      <main className="h-full bg-panvas-bg-secondary/40 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-panvas-text-tertiary">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-panvas-text-primary mb-4"></div>
          Loading PDF...
        </div>
      </main>
    );
  }

  if (error || !pdfDocument) {
    return (
      <main className="h-full bg-panvas-bg-secondary/40 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-panvas-text-error">
          {error ? 'Failed to load PDF.' : 'No PDF document attached.'}
        </div>
      </main>
    );
  }

  return (
    <main 
      className="relative flex h-full w-full flex-col overflow-hidden bg-panvas-bg-secondary select-none"
      ref={containerRef}
    >
      {/* UI Overlays */}
      <div className="pointer-events-none absolute inset-0 z-50 flex p-4 justify-between pointer-events-none">
        
        {/* Left: Sidebar */}
        <div 
          ref={sidebarRef}
          className={`pointer-events-auto h-full max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg shadow-glass-sm border border-panvas-border-subtle bg-panvas-bg-secondary/90 backdrop-blur-sm w-48 xl:w-64 ${!isSidebarOpen ? 'hidden' : ''}`}
        >
          <PdfThumbnailSidebar 
            pdfDocument={pdfDocument} 
            numPages={numPages} 
            currentPage={currentPage} 
            onPageChange={setCurrentPage} 
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            engine={notebookEngine}
          />
        </div>

        {/* Bug 1: Persistent Reopen Button when sidebar is closed */}
        {!isSidebarOpen && (
          <div className="absolute left-4 top-4 pointer-events-auto">
            <button 
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg shadow-glass-sm border border-panvas-border-subtle bg-panvas-bg-secondary/90 backdrop-blur-sm text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary active:bg-panvas-bg-active focus-ring"
              title="Open Sidebar"
              aria-label="Open Sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
          </div>
        )}
        
        {/* Center: Top Toolbar & Bottom Navigation */}
        <div className="flex-1 flex flex-col justify-between items-center min-w-0 px-4 h-full">
          {/* Top: Notebook Floating Toolbar */}
          <div className="pointer-events-auto mt-2 w-full flex justify-center">
            <NotebookFloatingToolbar 
              engine={notebookEngine} 
              editor={activeEditor} 
              saveKey={page ? `${page.id}_pdf_${currentPage}` : undefined} 
            />
          </div>
          
          {/* Bottom: PDF Controls */}
          <div className="pointer-events-auto mb-4">
              <BottomNavigation 
                page={currentPage} 
                totalPages={numPages} 
                setPage={setCurrentPage} 
                engine={notebookEngine}
                zoom={viewport.scale}
              />
          </div>
        </div>
      </div>

      <div 
        className="absolute shadow-2xl bg-white"
        style={{
          left: viewport.offsetX + (isSidebarOpen ? sidebarWidth : 0) + Math.max(10, (Math.max(100, containerSize.width - (isSidebarOpen ? sidebarWidth : 0)) - paperDimensions.width * viewport.scale) / 2),
          top: viewport.offsetY + Math.max(30, (containerSize.height - 120 - paperDimensions.height * viewport.scale) / 2),
          width: `${paperDimensions.width * viewport.scale}px`,
          height: `${paperDimensions.height * viewport.scale}px`
        }}
      >
        {/* Base Layer: PDF Page */}
        <div className="absolute inset-0 w-full h-full">
          <PdfPageRenderer pdfDocument={pdfDocument} pageNumber={currentPage} scale={viewport.scale} />
        </div>
        
        {/* Overlay Layer: Excalidraw Canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-10 w-full h-full touch-none ${
            toolState.mode === 'hand' ? 'cursor-grab active:cursor-grabbing' : 
            toolState.mode === 'text' ? 'cursor-text' : 
            toolState.mode === 'select' ? 'cursor-default' : 'cursor-crosshair'
          }`}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Overlay Layer: Text Editors */}
        {textObjects.map(obj => (
          <FloatingTextEditor
            key={obj.id}
            object={obj}
            engine={notebookEngine}
            scale={viewport.scale}
            toolMode={toolState.mode}
            onFocus={setActiveEditor}
            onBlur={() => {}}
          />
        ))}
      </div>
    </main>
  );
}

function BottomNavigation({ 
  page, totalPages, setPage, engine, zoom
}: { 
  page: number; totalPages: number; setPage: React.Dispatch<React.SetStateAction<number>>;
  engine: NotebookEngine; zoom: number;
}) { 
  const total = totalPages > 0 ? totalPages : 1;
  const zoomPercent = Math.round(zoom * 100);

  const handleZoomOut = () => engine.viewport.setZoom(zoom - 0.25);
  const handleZoomIn = () => engine.viewport.setZoom(zoom + 0.25);

  const isHandTool = engine.tools.getState().mode === 'hand';

  return (
    <div className="flex h-11 items-center gap-1 rounded-xl border border-panvas-border-default bg-panvas-bg-elevated px-2 shadow-glass-sm">
      <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} className={iconButtonClass} aria-label="Previous page"><ChevronLeft size={16} /></button>
      <span className="min-w-[60px] text-center text-xs text-panvas-text-secondary">{page} / {total}</span>
      <button type="button" onClick={() => setPage(value => Math.min(total, value + 1))} className={iconButtonClass} aria-label="Next page"><ChevronRight size={16} /></button>
      
      <span className="mx-1 h-5 w-px bg-panvas-border-subtle" />
      
      <button type="button" onClick={handleZoomOut} className={iconButtonClass} aria-label="Zoom out"><Minus size={16} /></button>
      <span className="min-w-[48px] text-center text-xs text-panvas-text-secondary">{zoomPercent}%</span>
      <button type="button" onClick={handleZoomIn} className={iconButtonClass} aria-label="Zoom in"><Plus size={16} /></button>

      <span className="mx-1 h-5 w-px bg-panvas-border-subtle" />
      
      <button 
        type="button" 
        onClick={() => {
          engine.tools.setMode(isHandTool ? 'select' : 'hand');
        }} 
        className={`${iconButtonClass} ${isHandTool ? 'bg-panvas-bg-active text-panvas-text-primary' : ''}`} 
        title="Pan Tool" 
        aria-label="Pan Tool"
      >
        <Hand size={15} />
      </button>
    </div>
  ); 
}
