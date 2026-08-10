import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { NotebookEngine } from './engine/NotebookEngine';
import type { ViewportState } from './engine/drawingTypes';
import { PageRenderer } from './PageRenderer';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { UniversalDropRouter } from '@/services/drop/UniversalDropRouter';
import { useLayoutStore } from '@/stores/layoutStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useNotebookSettingsStore } from '@/stores/notebookSettingsStore';
import { NotebookToolPropertiesPanel } from './NotebookToolPropertiesPanel';
import { NotebookFloatingToolbar } from './NotebookFloatingToolbar';
import { NotebookNavigator } from './NotebookNavigator';
import { NotebookWorkspaceControls } from './NotebookWorkspaceControls';
import { FloatingTextEditor } from './FloatingTextEditor';
import { InactivePagePreview } from './InactivePagePreview';
import { NotebookContextMenu, type ContextMenuState } from './NotebookContextMenu';
import type { Editor } from '@tiptap/react';
import { notebookRepository } from '@/repositories/NotebookRepository';
import { type TextObject, createEmptyDrawingData } from './engine/drawingTypes';

export function NotebookRenderer() {
  const { activePageId, notebookPages, notebooks, workspaces, activeNotebookSectionId } = useWorkspaceStore();
  const page = notebookPages.find(item => item.id === activePageId);
  const notebook = page ? notebooks.find(item => item.id === page.notebookId) : undefined;
  const workspace = notebook ? workspaces.find(item => item.id === notebook.workspaceId) : undefined;
  
  // Engine setup
  const notebookEngine = useMemo(() => new NotebookEngine(), []);
  const [viewport, setViewport] = useState<Readonly<ViewportState>>(() => notebookEngine.viewport.getState());
  const [toolState, setToolState] = useState(() => notebookEngine.tools.getState());
  const [pageProperties, setPageProperties] = useState(() => notebookEngine.getProperties());
  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const { isPropertiesPanelOpen } = useUIStore();
  const { notebookModeLevel, setNotebookModeLevel } = useLayoutStore();
  const { scrollDirection } = useNotebookSettingsStore();
  const setActivePage = useWorkspaceStore(s => s.setActivePage);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Sync Engine state to React
  useEffect(() => {
    const unsubViewport = notebookEngine.viewport.subscribe(setViewport);
    const unsubTools = notebookEngine.tools.subscribe(setToolState);
    const unsubProps = notebookEngine.onPropertiesChange((newProps) => {
      setPageProperties(newProps);
      if (workspace && notebook && page) {
        notebookRepository.saveDrawingData(workspace.id, notebook.id, page.id, notebookEngine.getDrawingData());
      }
    });
    
    // Subscribe to drawing changes to update textObjects state for rendering
    const unsubDrawing = notebookEngine.input.onDrawingChange(() => {
      setTextObjects([...notebookEngine.texts.getTexts()]);
    });
    // Also subscribe to history changes which might undo/redo text objects
    const unsubHistory = notebookEngine.history.subscribe(() => {
      setTextObjects([...notebookEngine.texts.getTexts()]);
    });
    return () => {
      unsubViewport();
      unsubTools();
      unsubProps();
      unsubDrawing();
      unsubHistory();
    };
  }, [notebookEngine, workspace, notebook, page]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const paperDimensions = useMemo(() => {
    let width = 794;  // Standard A4 width (96 DPI)
    let height = 1123; // Standard A4 height (96 DPI)

    if (pageProperties.pageSize === 'Letter') {
      width = 816;
      height = 1056;
    } else if (pageProperties.pageSize === 'A5') {
      width = 595;
      height = 842;
    }

    if (pageProperties.orientation === 'landscape') {
      const temp = width;
      width = height;
      height = temp;
    }

    return { width, height };
  }, [pageProperties.orientation, pageProperties.pageSize]);

  // Auto-fit zoom to fill ~85% of workspace width on initial load
  const hasAutoZoomed = useRef(false);
  useEffect(() => {
    if (containerSize.width === 0 || paperDimensions.width === 0) return;
    if (hasAutoZoomed.current) return;
    
    const targetWidth = Math.min(containerSize.width * 0.85, 1150);
    const fitZoom = Math.max(0.4, Math.min(2.5, targetWidth / paperDimensions.width));
    notebookEngine.viewport.setZoom(fitZoom);
    hasAutoZoomed.current = true;
  }, [containerSize.width, paperDimensions.width, notebookEngine]);

  // Reset auto-zoom when active page changes
  useEffect(() => {
    hasAutoZoomed.current = false;
  }, [activePageId]);
  const marginPaddingClass = useMemo(() => {
    if (pageProperties.margins === 'Narrow') return 'px-[5%] py-[5%]';
    if (pageProperties.margins === 'Wide') return 'px-[18%] py-[12%]';
    return 'px-[10%] py-[10%]';
  }, [pageProperties.margins]);

  // Panning & Zooming events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        notebookEngine.viewport.zoomBy(zoomFactor, e.clientX, e.clientY);
      }
      // Else let the browser handle native scrolling
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [notebookEngine]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isDragging = false;
    let lastX = 0, lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 1) { // Middle mouse button
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        container.setPointerCapture(e.pointerId);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      container.scrollLeft -= (e.clientX - lastX);
      container.scrollTop -= (e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (isDragging && e.button === 1) {
        isDragging = false;
        container.releasePointerCapture(e.pointerId);
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
    };
  }, [notebookEngine]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with text input or TipTap editors
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
        // Fallthrough to allow clearing selection if needed
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
        return;
      }

      const key = e.key.toLowerCase();
      
      switch (key) {
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

  // Load initial content
  useEffect(() => {
    async function loadPage() {
      if (!workspace || !notebook || !page) return;
      
      // Load Drawing (which now includes texts)
      const drawingData = await notebookRepository.loadDrawingData(workspace.id, notebook.id, page.id);
      if (!drawingData) {
        notebookEngine.setDrawingData(createEmptyDrawingData());
      } else {
        notebookEngine.setDrawingData(drawingData);
      }
      setTextObjects([...notebookEngine.texts.getTexts()]);
    }
    loadPage();
  }, [workspace?.id, notebook?.id, page?.id, notebookEngine]);

  // Mount canvas and handle autosave for drawings
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Mount the engine to the canvas
    const cssWidth = paperDimensions.width * viewport.scale;
    const cssHeight = paperDimensions.height * viewport.scale;
    notebookEngine.mount(canvasRef.current, cssWidth, cssHeight);

    // Setup autosave for drawing
    let drawingSaveTimeout: NodeJS.Timeout;
    const unsubChange = notebookEngine.history.subscribe(() => {
      clearTimeout(drawingSaveTimeout);
      drawingSaveTimeout = setTimeout(() => {
        if (workspace && notebook && page) {
          notebookRepository.saveDrawingData(workspace.id, notebook.id, page.id, notebookEngine.getDrawingData());
        }
      }, 1000);
    });

    return () => {
      unsubChange();
      clearTimeout(drawingSaveTimeout);
      notebookEngine.unmount();
    };
  }, [notebookEngine, paperDimensions, viewport.scale, workspace, notebook, page]);

  if (!activePageId) return null;
  
  // 6B: Calculate current page position
  const currentSectionPages = notebookPages
    .filter(p => p.sectionId === activeNotebookSectionId && !p.deletedAt)
    .sort((a, b) => a.order - b.order);
  const currentPageIndex = currentSectionPages.findIndex(p => p.id === activePageId);
  const totalPages = currentSectionPages.length;

  // Compute Layout for all pages in the section
  const layoutConfig = useMemo(() => {
    const isTwoPage = scrollDirection === 'two-page-horizontal';
    const isHorizontal = scrollDirection === 'horizontal';
    
    const w = paperDimensions.width * viewport.scale;
    const h = paperDimensions.height * viewport.scale;
    const gap = 40 * viewport.scale;
    const spineGap = 0;

    let totalWidth = 0;
    let totalHeight = 0;

    const positions = currentSectionPages.map((p, index) => {
      let x = 0;
      let y = 0;
      
      if (isTwoPage) {
        const pairIndex = Math.floor(index / 2);
        const isRight = index % 2 === 1;
        x = pairIndex * (w * 2 + gap) + (isRight ? w + spineGap : 0);
        y = 0;
      } else if (isHorizontal) {
        x = index * (w + gap);
        y = 0;
      } else {
        x = 0;
        y = index * (h + gap);
      }
      
      totalWidth = Math.max(totalWidth, x + w);
      totalHeight = Math.max(totalHeight, y + h);

      return { id: p.id, x, y };
    });

    return { positions, totalWidth, totalHeight };
  }, [currentSectionPages, paperDimensions, viewport.scale, scrollDirection]);

  // Keep active page centered on layout change
  useEffect(() => {
    const pos = layoutConfig.positions.find(p => p.id === activePageId);
    if (!pos || !containerRef.current || containerSize.width === 0 || containerSize.height === 0) return;
    
    // The inner container (pages) is centered within the scroll container via flexbox.
    const innerWidth = layoutConfig.totalWidth;
    const innerHeight = layoutConfig.totalHeight;
    const containerW = containerSize.width;
    const containerH = containerSize.height;
    
    // The flexbox wrapper size is totalWidth + 80, totalHeight + 120
    const wrapperW = Math.max(containerW, innerWidth + 80);
    const wrapperH = Math.max(containerH, innerHeight + 120);
    
    // Calculate the active page's center relative to the inner container's top-left
    const pageCenterX = pos.x + (paperDimensions.width * viewport.scale) / 2;
    const pageCenterY = pos.y + (paperDimensions.height * viewport.scale) / 2;
    
    // Calculate the top-left offset of the inner container within the wrapper
    const offsetX = (wrapperW - innerWidth) / 2;
    const offsetY = (wrapperH - innerHeight) / 2;
    
    // Calculate the target scroll positions to center the active page
    const targetScrollLeft = (offsetX + pageCenterX) - containerW / 2;
    const targetScrollTop = (offsetY + pageCenterY) - containerH / 2;
    
    containerRef.current.scrollTo({
      left: targetScrollLeft,
      top: targetScrollTop,
      behavior: 'instant'
    });
  }, [layoutConfig, activePageId, containerSize.width, containerSize.height, paperDimensions, viewport.scale]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    hasSelection: false,
    isTextEditing: false,
    canUndo: false,
    canRedo: false,
  });

  // Centralized command dispatcher shared between context menu & keyboard
  const executeCommand = async (command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'duplicate' | 'delete' | 'selectAll') => {
    const isTextEditing = (
      document.activeElement instanceof HTMLInputElement || 
      document.activeElement instanceof HTMLTextAreaElement ||
      !!(document.activeElement as HTMLElement)?.isContentEditable
    );

    switch (command) {
      case 'undo':
        if (notebookEngine.history.canUndo()) {
          notebookEngine.history.undo();
          setTextObjects([...notebookEngine.texts.getTexts()]);
          notebookEngine.drawing.redraw();
        }
        break;
      case 'redo':
        if (notebookEngine.history.canRedo()) {
          notebookEngine.history.redo();
          setTextObjects([...notebookEngine.texts.getTexts()]);
          notebookEngine.drawing.redraw();
        }
        break;
      case 'cut':
        if (isTextEditing) {
          document.execCommand('cut');
        } else {
          await notebookEngine.selection.cutSelection();
          setTextObjects([...notebookEngine.texts.getTexts()]);
        }
        break;
      case 'copy':
        if (isTextEditing) {
          document.execCommand('copy');
        } else {
          await notebookEngine.selection.copySelection();
        }
        break;
      case 'paste':
        if (isTextEditing) {
          document.execCommand('paste');
        } else {
          await notebookEngine.selection.pasteSelection();
          setTextObjects([...notebookEngine.texts.getTexts()]);
        }
        break;
      case 'duplicate':
        if (!isTextEditing) {
          await notebookEngine.selection.duplicateSelection();
          setTextObjects([...notebookEngine.texts.getTexts()]);
        }
        break;
      case 'delete':
        if (!isTextEditing) {
          notebookEngine.selection.deleteSelection();
          setTextObjects([...notebookEngine.texts.getTexts()]);
        }
        break;
      case 'selectAll':
        if (isTextEditing) {
          document.execCommand('selectAll');
        } else {
          notebookEngine.selection.selectAll();
        }
        break;
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTextEditing = (
        document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement ||
        !!(document.activeElement as HTMLElement)?.isContentEditable
      );

      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && (e.key === 'z' || e.key === 'Z')) {
        if (!isTextEditing) {
          e.preventDefault();
          if (e.shiftKey) {
            executeCommand('redo');
          } else {
            executeCommand('undo');
          }
        }
      } else if (isMod && (e.key === 'y' || e.key === 'Y')) {
        if (!isTextEditing) {
          e.preventDefault();
          executeCommand('redo');
        }
      } else if (isMod && (e.key === 'd' || e.key === 'D')) {
        if (!isTextEditing) {
          e.preventDefault();
          executeCommand('duplicate');
        }
      } else if (isMod && (e.key === 'a' || e.key === 'A')) {
        if (!isTextEditing) {
          e.preventDefault();
          executeCommand('selectAll');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isTextEditing && notebookEngine.selection.getSelectedElements().length > 0) {
          e.preventDefault();
          executeCommand('delete');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notebookEngine]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const hasSelection = notebookEngine.selection.getSelectedElements().length > 0;
    const isTextEditing = (
      document.activeElement instanceof HTMLInputElement || 
      document.activeElement instanceof HTMLTextAreaElement ||
      !!(document.activeElement as HTMLElement)?.isContentEditable
    );

    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      hasSelection,
      isTextEditing,
      canUndo: notebookEngine.history.canUndo(),
      canRedo: notebookEngine.history.canRedo(),
    });
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    // Only handle if not in a text editor
    if (
      e.target instanceof HTMLInputElement || 
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement).isContentEditable
    ) {
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await importImage(file);
          break;
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    await UniversalDropRouter.handleExternalDrop(e, {
      onImageDrop: async (file) => {
        await importImage(file, e.clientX, e.clientY);
      },
      onPdfDrop: () => {
        useUIStore.getState().showToast('PDFs cannot be inserted into notebook pages directly.', 'error');
      },
      onUnsupportedDrop: (file) => {
        if (file) {
          useUIStore.getState().showToast(`Unsupported file type: ${file.name}`, 'error');
        }
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    UniversalDropRouter.handleDragOver(e, ['IMAGE']);
  };

  const importImage = async (file: File, clientX?: number, clientY?: number) => {
    console.log('[DEBUG] Drag&Drop: importImage called with file:', file.name, file.type, file.size, 'at', clientX, clientY);
    const canvasFileId = activePageId;
    if (!canvasFileId) {
      console.log('[DEBUG] Drag&Drop: no activePageId');
      return;
    }
    console.log('[DEBUG] Drag&Drop: activePageId is valid:', canvasFileId);

    const reader = new FileReader();
    reader.onload = async (re) => {
      const buffer = re.target?.result as ArrayBuffer;
      if (!buffer) return;
      console.log('[DEBUG] Drag&Drop: FileReader loaded buffer');

      try {
        console.log('[DEBUG] Drag&Drop: canvasRepository.storeImage called');
        const { canvasRepository } = await import('@/repositories/CanvasRepository');
        const userId = useAuthStore.getState().user?.id || null;
        
        const mimeType = file.type || 'image/png';
        const imgData = await canvasRepository.storeImage(userId, canvasFileId, file.name, mimeType, buffer);
        console.log('[DEBUG] Drag&Drop: canvasRepository.storeImage SUCCESS, imgData:', imgData);
        
        const imgUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
        const img = new Image();
        img.onload = () => {
          console.log('[DEBUG] Drag&Drop: Image onload triggered, calc width/height');
          const viewportManager = notebookEngine.viewport;
          
          let pageX = paperDimensions.width / 2;
          let pageY = paperDimensions.height / 3;

          const canvas = canvasRef.current;
          if (clientX !== undefined && clientY !== undefined && canvas) {
            const rect = canvas.getBoundingClientRect();
            const screenX = clientX - rect.left;
            const screenY = clientY - rect.top;
            const pt = viewportManager.screenToPage(screenX, screenY);
            pageX = pt.x;
            pageY = pt.y;
          }

          let width = img.width;
          let height = img.height;
          const max = 450;
          if (width > max || height > max) {
            const ratio = Math.min(max / width, max / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const newImg = {
            type: 'image' as const,
            id: imgData.id,
            x: Math.max(10, Math.min(paperDimensions.width - width - 10, pageX - width / 2)),
            y: Math.max(10, Math.min(paperDimensions.height - height - 10, pageY - height / 2)),
            width,
            height,
            fileId: imgData.id,
            rotation: 0,
            createdAt: Date.now()
          };
          console.log('[DEBUG] Drag&Drop: generated ImageObject:', newImg);

          notebookEngine.images.cacheImage(imgData.id, img);
          notebookEngine.images.addImage(newImg);
          notebookEngine.drawing.redraw();
          console.log('[DEBUG] Drag&Drop: redraw called');
          
          // Switch to select tool and highlight the inserted image
          notebookEngine.tools.setMode('select');
          notebookEngine.selection.clearSelection();
          notebookEngine.selection.selectAt(newImg.x + 10, newImg.y + 10, false);

          notebookEngine.history.pushExecuted({
            description: 'Insert image',
            execute: () => {
              notebookEngine.images.addImage(newImg);
              notebookEngine.drawing.redraw();
            },
            undo: () => {
              notebookEngine.images.removeImage(imgData.id);
              notebookEngine.drawing.redraw();
            }
          });

          // Immediate persistence
          console.log('[DEBUG] Drag&Drop: persistence called');
          if (workspace && notebook && page) {
            notebookRepository.saveDrawingData(workspace.id, notebook.id, page.id, notebookEngine.getDrawingData());
          }

          URL.revokeObjectURL(imgUrl);
        };
        img.onerror = (err) => {
          console.error('[DEBUG] Drag&Drop: Image onload FAILED', err);
        };
        img.src = imgUrl;
      } catch (err) {
        console.error('[DEBUG] Drag&Drop: failed to store image:', err);
      }
    };
    reader.onerror = (err) => {
       console.error('[DEBUG] Drag&Drop: FileReader FAILED', err);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div 
      className="relative flex h-full w-full overflow-hidden bg-panvas-bg-primary"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      tabIndex={0}
    >
      {/* Responsive Floating Header (Fixed, outside scroll viewport) */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none gap-4">
        <div className="pointer-events-auto flex-shrink flex items-start min-w-0 max-w-[30%]">
          <NotebookNavigator />
        </div>

        <div className="pointer-events-auto flex-1 flex justify-center items-start min-w-0">
          <NotebookFloatingToolbar editor={activeEditor} engine={notebookEngine} />
        </div>

        <div className="pointer-events-auto flex-shrink-0 flex items-start">
          <NotebookWorkspaceControls />
        </div>
      </div>

      {/* Native Scrolling Viewport */}
      <main 
        ref={containerRef}
        className="notebook-viewport relative flex-1 min-w-0 min-h-0 overflow-auto bg-panvas-bg-secondary"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onContextMenu={handleContextMenu}
        onPointerDown={() => {
          if (contextMenu.isOpen) {
            setContextMenu(prev => ({ ...prev, isOpen: false }));
          }
        }}
      >

        <div 
          style={{ 
            minWidth: '100%',
            minHeight: '100%',
            width: `${layoutConfig.totalWidth + 80}px`,
            height: `${layoutConfig.totalHeight + 120}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="relative"
            style={{
              width: `${layoutConfig.totalWidth}px`,
              height: `${layoutConfig.totalHeight}px`
            }}
          >
          {layoutConfig.positions.map((pos, index) => {
            const isActive = pos.id === activePageId;
            const pageNumText = `${index + 1} / ${totalPages}`;
            
            return (
              <div 
                key={pos.id} 
                className="absolute" 
                style={{ 
                  left: pos.x, 
                  top: pos.y, 
                  width: paperDimensions.width * viewport.scale, 
                  height: paperDimensions.height * viewport.scale 
                }}
              >
                {isActive ? (
                  <PageRenderer 
                    properties={pageProperties} 
                    id={activePageId} 
                    width={paperDimensions.width * viewport.scale} 
                    height={paperDimensions.height * viewport.scale}
                    pageNumberText={pageNumText}
                  >
                    {/* Floating Text Editors */}
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
                    
                    {/* Drawing Canvas Overlay */}
                    <canvas
                      ref={canvasRef}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragOver}
                      className={`absolute inset-0 z-10 w-full h-full touch-none ${
                        toolState.mode === 'hand' ? 'cursor-grab active:cursor-grabbing' : 
                        toolState.mode === 'text' ? 'cursor-text' : 
                        toolState.mode === 'select' ? 'cursor-default' : 'cursor-crosshair'
                      }`}
                    />
                  </PageRenderer>
                ) : (
                  <InactivePagePreview 
                    workspaceId={workspace!.id}
                    notebookId={notebook!.id}
                    page={notebookPages.find(p => p.id === pos.id)!}
                    width={paperDimensions.width * viewport.scale}
                    height={paperDimensions.height * viewport.scale}
                    pageNumberText={pageNumText}
                    onClick={() => setActivePage(pos.id)}
                  />
                )}
              </div>
            );
          })}
          </div>
        </div>
      </main>

      {/* Static properties panel on the right */}
      {isPropertiesPanelOpen && (
        <NotebookToolPropertiesPanel 
          viewportEngine={notebookEngine.viewport} 
          zoom={viewport.scale} 
          properties={pageProperties}
          onUpdateProperties={(updates) => notebookEngine.setProperties(updates)}
        />
      )}

      {/* Right-click Context Menu */}
      <NotebookContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onCommand={executeCommand}
      />
    </div>
  );
}
