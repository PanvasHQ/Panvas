import { stickyPaperStyle } from './stickyNotes';
// ============================================
// Panvas — Unified Notebook Page View Component
// ============================================
// Single, persistent page representation for every page in the notebook.
// Replaces the legacy PageRenderer vs InactivePagePreview dual-component swap.
// Preserves DOM element identity, canvas state, and vector templates during scroll.

import React, { useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import { PageRenderer } from './PageRenderer';
import { FloatingTextEditor } from './FloatingTextEditor';
import { createEmptyDrawingData, type DrawingData, type TextObject, type ToolState, DEFAULT_PAGE_LAYER_ID } from './engine/drawingTypes';
import {
  getStickyNoteColor,
  getStickyNoteOpacity,
  getStickyNoteShape,
  getShapeBorderRadius,
  hexToRgba,
  isStickyNote,
} from './stickyNotes';
import type { NotebookPage, PagePropertySet } from '@/types/notebook';
import type { NotebookEngine } from './engine/NotebookEngine';
import { MAX_INACTIVE_PAGE_RENDER_ZOOM, resolveCanvasBackingScale, ViewportManager } from './engine/ViewportManager';
import { ShapeManager } from './engine/ShapeManager';
import { ImageManager } from './engine/ImageManager';
import { DrawingEngine } from './engine/DrawingEngine';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import { notebookTipTapExtensions } from './tiptapExtensions';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';
import { LayerManager } from './engine/LayerManager';
import { NotebookVoiceNote, StaticVoiceNote } from './NotebookVoiceNote';
import { textObjectStyle } from './textTypography';
import { isVoiceNoteObject } from '@/services/audio/voiceNoteObjects';
import type { AudioNote } from './engine/drawingTypes';
import { resolvePageSurfaceGeometry } from '@/lib/pageProperties';

export interface NotebookPageViewProps {
  page: NotebookPage;
  data?: DrawingData;
  properties: PagePropertySet;
  width: number;
  height: number;
  /** Current user zoom, used only to choose bounded raster backing resolution. */
  renderScale: number;
  pageNumberText: string;
  isFocused: boolean;
  toolState: ToolState;
  notebookEngine: NotebookEngine;
  /** Page currently represented by the shared live NotebookEngine scene. */
  sceneOwnerPageId?: string;
  activeEditor: Editor | null;
  setActiveEditor: (editor: Editor | null) => void;
  onActivatePage: () => void;
  handleDrop?: (e: React.DragEvent) => void;
  handleDragOver?: (e: React.DragEvent) => void;
  editable?: boolean;
  onVoiceNoteChange?: () => void;
  onVoiceNoteDelete?: (note: AudioNote) => void;
  onVoiceNoteRename?: (note: AudioNote, title: string) => void;
  onUpdateProperties?: (updates: Partial<PagePropertySet>) => void;
}

/**
 * Native-looking ink cursors keep the pen tip, rather than a crosshair centre,
 * on the document point that receives the stroke. They are deliberately small
 * and monochrome so they work on every paper colour and theme.
 */
const svgCursor = (svg: string, hotspotX: number, hotspotY: number, fallback = 'crosshair') =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, ${fallback}`;

const ERASER_CURSOR = svgCursor(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="m7 20 10-10a3 3 0 0 1 4.2 0l4.8 4.8a3 3 0 0 1 0 4.2l-8 8H9l-4-4 2-7Z" fill="#f6c7d7" stroke="#5d4650" stroke-width="1.7" stroke-linejoin="round"/><path d="m11 24 5-5" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`, 9, 25, 'cell');

function dynamicInkCursor(tool: ToolState['drawingTool'], color: string): string {
  const ink = /^#[0-9a-f]{6}$/i.test(color) ? color : '#2563eb';
  if (tool === 'laser') {
    return svgCursor(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="9" fill="${ink}" fill-opacity=".18"/><circle cx="16" cy="16" r="4.5" fill="${ink}" stroke="#fff" stroke-width="1.5"/><circle cx="16" cy="16" r="1.4" fill="#fff"/></svg>`, 16, 16);
  }
  const tip = tool === 'highlighter' ? '#fef08a' : ink;
  const body = tool === 'pencil' ? '#fbfaf7' : tip;
  const accent = tool === 'highlighter' ? ink : '#24201a';
  return svgCursor(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><path d="m7 26 3.5-8L24 4.5l5.5 5.5L16 23.5 7 26Z" fill="${body}" stroke="${accent}" stroke-width="1.8" stroke-linejoin="round"/><path d="m21.5 7 5.5 5.5" fill="none" stroke="${ink}" stroke-width="2"/><path d="m7 26 6.2-2.2-4-4L7 26Z" fill="${ink}" stroke="#24201a" stroke-width="1.2" stroke-linejoin="round"/></svg>`, 7, 26);
}

function resolvePageCursor(toolState: ToolState): string | undefined {
  if (toolState.mode === 'erase') return ERASER_CURSOR;
  if (toolState.mode !== 'draw') return undefined;
  const handwritingInk = toolState.handwritingToTextEnabled
    && (toolState.drawingTool === 'pen' || toolState.drawingTool === 'pencil');
  return dynamicInkCursor(
    toolState.drawingTool,
    handwritingInk ? toolState.handwritingInkColor : toolState.color,
  );
}

function LayerCanvas({ drawing, id, width, height, scale, order }: { drawing: DrawingEngine; id: string; width: number; height: number; scale: number; order: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => ref.current ? drawing.attachLayerCanvas(id, ref.current, width, height, scale) : undefined, [drawing, id, width, height, scale]);
  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 + order * 2 }} />;
}

/**
 * Clear a canvas before it can be painted in a different page shell. A
 * clearRect alone is not enough because transforms and clipping state can
 * survive. Reset the bitmap and complete 2D state before another owner paints.
 */
function clearCanvasSurface(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  if (typeof context.reset === 'function') context.reset();
  else canvas.width = canvas.width;
}

const StaticTextPreview: React.FC<{ object: TextObject; scale: number; zIndex?: number; offset?: { x: number; y: number } }> = ({ object, scale, zIndex, offset }) => {
  const editor = useEditor({
    editable: false,
    extensions: notebookTipTapExtensions,
    content: object.content,
  });

  if (!editor) return null;

  const isSticky = isStickyNote(object);
  const stickyColor = getStickyNoteColor(object);
  const stickyOpacity = getStickyNoteOpacity(object);
  const stickyShape = getStickyNoteShape(object);
  const bgRgba = isSticky ? hexToRgba(stickyColor, stickyOpacity) : undefined;
  const legacyBg = /^#[0-9a-f]{6}$/i.test(String(object.metadata?.elementBackground ?? ''))
    ? String(object.metadata?.elementBackground)
    : undefined;

  return (
    <div
      className={`absolute pointer-events-none z-0 ${!isSticky && object.metadata?.pastePresentation === 'sticky-note' ? 'panvas-pasted-note' : object.metadata?.pastePresentation === 'mixed-paste' ? 'panvas-mixed-paste' : ''}`}
      style={{
        zIndex,
        ...textObjectStyle(object),
        left: `${(object.x + (offset?.x ?? 0)) * scale}px`,
        top: `${(object.y + (offset?.y ?? 0)) * scale}px`,
        width: `${object.width}px`,
        minHeight: object.height ? `${object.height}px` : undefined,
        height: isSticky && object.height ? `${object.height}px` : undefined,
        transform: `scale(${scale}) rotate(${object.rotation ?? 0}deg)`,
        transformOrigin: 'center',
        ...(!isSticky && /^#[0-9a-f]{6}$/i.test(String(object.metadata?.elementBackground ?? ''))
          ? { backgroundColor: String(object.metadata?.elementBackground) }
          : {}),
        ...(legacyBg && !isSticky ? { backgroundColor: legacyBg } : {}),
      }}
    >
      {isSticky && (
        <div className="absolute inset-0 -z-10 overflow-visible pointer-events-none">
          {stickyShape === 'star' ? (
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon points="50,0 63,38 100,38 69,59 82,100 50,75 18,100 31,59 0,38 37,38" fill={bgRgba} />
            </svg>
          ) : (
            <div
              className="w-full h-full shadow-md"
              style={{
                backgroundColor: bgRgba,
                ...stickyPaperStyle(object),
                borderRadius: getShapeBorderRadius(stickyShape),
              }}
            />
          )}
        </div>
      )}
      <EditorContent 
        editor={editor} 
        className={`outline-none prose prose-neutral max-w-none prose-sm ${isSticky ? 'p-0' : 'p-1'}`} 
        style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', ...(isSticky ? { height: '100%', overflow: 'hidden', padding: stickyShape === 'star' ? '34% 24% 20%' : ['circle', 'oval'].includes(stickyShape) ? '20% 18%' : '14px 16px' } : {}) }}
      />
    </div>
  );
};

export const NotebookPageView: React.FC<NotebookPageViewProps> = ({
  page,
  data,
  properties,
  width,
  height,
  renderScale,
  pageNumberText,
  isFocused,
  toolState,
  notebookEngine,
  sceneOwnerPageId = '',
  activeEditor,
  setActiveEditor,
  onActivatePage,
  handleDrop,
  handleDragOver,
  editable = true,
  onVoiceNoteChange = () => {},
  onVoiceNoteDelete = () => {},
  onVoiceNoteRename = () => {},
  onUpdateProperties,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasConfigurationRef = useRef<string | null>(null);
  const staticEngineRef = useRef<{ drawing: DrawingEngine; viewport: ViewportManager; layers: LayerManager } | null>(null);
  const [staticDrawing, setStaticDrawing] = useState<DrawingEngine | null>(null);
  const instanceIdRef = useRef<string>('');
  if (!instanceIdRef.current) {
    instanceIdRef.current = 'inst_' + Math.random().toString(36).substring(2, 8);
  }

  const pageCursor = isFocused ? resolvePageCursor(toolState) : undefined;
  const pageGeometry = useMemo(() => resolvePageSurfaceGeometry(properties), [properties]);
  const sceneReady = !isFocused || sceneOwnerPageId === page.id;
  const liveSceneReady = isFocused && sceneReady;

  // Mount active canvas to notebookEngine when focused
  useLayoutEffect(() => {
    if (!isFocused || page.type === 'pdf' || !canvasRef.current) return;

    // The canvas can have been painted by the previous focused page during
    // the React commit. Hide and clear it before binding the next scene so a
    // compositor frame can never expose Scene A inside Page B.
    clearCanvasSurface(canvasRef.current);
    notebookEngine.drawing.setScaleMultiplier(renderScale);
    notebookEngine.viewport.setPageCoordinateTransform(0, width, height, pageGeometry.source.left, pageGeometry.source.top);
    notebookEngine.mount(canvasRef.current, width, height);
    activeCanvasConfigurationRef.current = `${width}:${height}:${renderScale}`;

    return () => {
      activeCanvasConfigurationRef.current = null;
      clearCanvasSurface(canvasRef.current);
      notebookEngine.unmount();
    };
  }, [isFocused, notebookEngine, page.type, page.id]);

  // Geometry and backing-scale changes resize the mounted canvas in place. In
  // particular, Portrait/Landscape must not detach input and remount the live
  // engine while the page shell is performing its single geometry transition.
  useEffect(() => {
    if (!isFocused || page.type === 'pdf' || !activeCanvasConfigurationRef.current) return;
    const nextConfiguration = `${width}:${height}:${renderScale}`;
    notebookEngine.viewport.setPageCoordinateTransform(0, width, height, pageGeometry.source.left, pageGeometry.source.top);
    if (activeCanvasConfigurationRef.current === nextConfiguration) {
      notebookEngine.drawing.redraw();
      return;
    }
    notebookEngine.drawing.setScaleMultiplier(renderScale);
    notebookEngine.resize(width, height);
    activeCanvasConfigurationRef.current = nextConfiguration;
  }, [isFocused, notebookEngine, page.type, renderScale, width, height, pageGeometry.source.left, pageGeometry.source.top]);

  // Non-focused page static rendering (rendered in base document coordinates)
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    // The active handoff effect above owns clearing and mounting the shared
    // canvas. Do not clear it again in this later effect: React runs layout
    // effects in declaration order, and a second clear here would erase the
    // freshly loaded focused scene before its first paint.
    if (isFocused || page.type === 'pdf') return;
    if (!data) {
      clearCanvasSurface(canvasRef.current);
      return;
    }

    let engine = staticEngineRef.current;
    if (!engine) {
      const viewport = new ViewportManager();
      viewport.setZoom(1);
      const layers = new LayerManager();
      const shapes = new ShapeManager(viewport, layers);
      const images = new ImageManager(viewport, layers);
      const drawing = new DrawingEngine(viewport, shapes, images, layers);
      images.setRedrawCallback(() => drawing.redraw());
      drawing.setScaleMultiplier(Math.min(renderScale, MAX_INACTIVE_PAGE_RENDER_ZOOM));
      drawing.setCanvas(canvasRef.current, width, height);
      engine = { drawing, viewport, layers };
      staticEngineRef.current = engine;
      setStaticDrawing(drawing);
    } else {
      engine.drawing.setScaleMultiplier(Math.min(renderScale, MAX_INACTIVE_PAGE_RENDER_ZOOM));
      engine.drawing.setCanvas(canvasRef.current, width, height);
    }

    engine.viewport.setPageCoordinateTransform(0, width, height, pageGeometry.source.left, pageGeometry.source.top);

    engine.layers.setData(data.layers, data.activeLayerId);
    const fallbackLayerId = engine.layers.getLayers()[0].id;
    const withLayer = (object: any) => ({ ...object, layerId: object.layerId ?? fallbackLayerId });
    if (data.version === 1) {
      engine.drawing.setStrokes((data.strokes || []).map(withLayer));
      // @ts-ignore
      engine.drawing['shapeManager']?.setShapes((data.shapes || []).map(withLayer));
    } else {
      const objects = data.objects || [];
      engine.drawing.setStrokes(objects.filter(o => o.type === 'stroke').map(withLayer) as any);
      // @ts-ignore
      engine.drawing['shapeManager']?.setShapes(objects.filter(o => o.type === 'shape').map(withLayer) as any);
      // @ts-ignore
      engine.drawing['imageManager']?.setImages(objects.filter(o => o.type === 'image').map(withLayer) as any);
    }

    engine.drawing.redraw();
  }, [isFocused, data, width, height, page.type, renderScale, pageGeometry.source.left, pageGeometry.source.top]);

  const [layerRevision, setLayerRevision] = useState(0);
  useEffect(() => {
    if (!isFocused) return;
    const unsubLayers = notebookEngine.layers.subscribe(() => {
      setLayerRevision(rev => rev + 1);
    });
    const unsubDrawing = notebookEngine.input.onDrawingChange(() => {
      setLayerRevision(rev => rev + 1);
    });
    const unsubHistory = notebookEngine.history.subscribe(() => setLayerRevision(rev => rev + 1));
    return () => {
      unsubLayers();
      unsubDrawing();
      unsubHistory();
    };
  }, [isFocused, notebookEngine]);

  // Text objects for non-focused pages
  const staticTextObjects: TextObject[] = useMemo(() => {
    if (isFocused || !data || !data.objects) return [];
    const visibility = new Map((data.layers ?? []).map(layer => [layer.id, layer.visible !== false]));
    return data.objects.filter(o => o.type === 'text' && visibility.get(o.layerId ?? DEFAULT_PAGE_LAYER_ID) !== false) as TextObject[];
  }, [isFocused, data]);

  // Live text objects from notebookEngine when focused
  const liveTextObjects = useMemo(() => {
    if (!isFocused) return [];
    const layers = notebookEngine.layers.getLayers();
    const orderMap = new Map<string, number>();
    layers.forEach((l, idx) => orderMap.set(l.id, idx));
    return notebookEngine.texts
      .getTexts()
      .filter(object => notebookEngine.layers.isVisible(object.layerId))
      .sort((a, b) => {
        const orderA = orderMap.get(a.layerId ?? DEFAULT_PAGE_LAYER_ID) ?? 0;
        const orderB = orderMap.get(b.layerId ?? DEFAULT_PAGE_LAYER_ID) ?? 0;
        return orderA - orderB;
      });
  }, [isFocused, notebookEngine, layerRevision]);

  // PDF Preview Rendering (for PDF pages)
  useEffect(() => {
    if (page.type !== 'pdf' || !page.pdfDataId || !canvasRef.current) return;
    let mounted = true;

    async function loadPdf() {
      try {
        const userId = useAuthStore.getState().user?.id ?? null;
        const pdfFile = await canvasRepository.getPdf(userId, page.pdfDataId!);
        if (!pdfFile || !mounted) return;

        const pdfjsLib = await import('pdfjs-dist');
        // @ts-ignore
        const pdfjsWorkerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

        // Bytes are passed directly: a blob object URL would need fetch(),
        // which is unavailable on the file:// origin of the packaged app.
        // slice(0) copies: pdf.js takes ownership of the buffer.
        const bytes = new Uint8Array(pdfFile.data.slice(0));
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const doc = await loadingTask.promise;

        if (!mounted) {
          loadingTask.destroy();
          return;
        }

        const pdfPage = await doc.getPage(1);
        const viewport = pdfPage.getViewport({ scale: 1.0 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const baseScale = Math.min(width / viewport.width, height / viewport.height) * 0.95;
        const cssPdfWidth = viewport.width * baseScale;
        const cssPdfHeight = viewport.height * baseScale;
        const pageZoomDetail = isFocused
          ? renderScale
          : Math.min(renderScale, MAX_INACTIVE_PAGE_RENDER_ZOOM);
        const backingScale = resolveCanvasBackingScale(dpr, pageZoomDetail, cssPdfWidth, cssPdfHeight);
        const pdfScale = baseScale * backingScale;
        const scaledViewport = pdfPage.getViewport({ scale: pdfScale });

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.style.width = `${viewport.width * baseScale}px`;
        canvas.style.height = `${viewport.height * baseScale}px`;
        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);

        await pdfPage.render({
          canvasContext: ctx,
          viewport: scaledViewport,
        }).promise;
      } catch (err) {
        console.error('Failed to load PDF preview:', err);
      }
    }

    loadPdf();
    return () => { mounted = false; };
  }, [page.type, page.pdfDataId, width, height, renderScale, isFocused]);

  // Page activation must not fire while the Hand tool is active. Activating flips
  // focusedPageId, which runs this component's mount effect cleanup —
  // notebookEngine.unmount() -> InputManager.detach() -> canvas = null — in the middle of
  // a live pan. That is why the first hand drag started on a non-focused page appeared to
  // do nothing and only the second one worked. Panning is owned by the viewport
  // container (see NotebookRenderer), so this handler simply yields to it.
  const handlePointerDown = () => {
    if (toolState.mode === 'hand') return;
    if (!isFocused) {
      onActivatePage();
    }
  };

  const orderedLayers = isFocused ? notebookEngine.layers.getLayers() : data?.layers ?? [];
  const layeredDrawing = page.type !== 'pdf' && orderedLayers.length > 1 ? (isFocused ? notebookEngine.drawing : staticDrawing) : null;
  const textZIndex = (layerId?: string) => layeredDrawing ? 21 + Math.max(0, orderedLayers.findIndex(layer => layer.id === (layerId ?? DEFAULT_PAGE_LAYER_ID))) * 2 : undefined;

  return (
    <div 
      data-page-id={page.id}
      data-rendered-page-id={page.id}
      data-scene-owner-page-id={sceneOwnerPageId}
      data-render-ready={sceneReady ? 'true' : 'false'}
      className="relative shadow-2xl transition-shadow"
      onPointerDown={handlePointerDown}
      onClick={handlePointerDown}
    >
      <PageRenderer
        id={page.id}
        width={width}
        height={height}
        properties={properties}
        pageNumberText={pageNumberText}
        editable={isFocused && editable}
        onUpdateProperties={onUpdateProperties}
      >
        {/* Focused live TipTap text editors */}
        {liveSceneReady && layeredDrawing && orderedLayers.map((layer, order) => <LayerCanvas key={layer.id} drawing={layeredDrawing} id={layer.id} width={width} height={height} scale={renderScale} order={order} />)}
        {liveSceneReady && liveTextObjects.map(obj => isVoiceNoteObject(obj) ? (
          <NotebookVoiceNote key={obj.id} object={obj} note={notebookEngine.audio.getAll().find(note => note.id === obj.metadata.audioNoteId)} engine={notebookEngine} scale={1} offset={{ x: pageGeometry.source.left, y: pageGeometry.source.top }} bounds={{ x: -pageGeometry.source.left, y: -pageGeometry.source.top, width, height }} editable={editable && notebookEngine.texts.isEditable(obj)} onChange={onVoiceNoteChange} onDelete={onVoiceNoteDelete} onRename={onVoiceNoteRename}/>
        ) : (
          <FloatingTextEditor
            key={obj.id}
            object={obj}
            engine={notebookEngine}
            scale={1}
            pageOffset={{ x: pageGeometry.source.left, y: pageGeometry.source.top }}
            zIndex={textZIndex(obj.layerId)}
            toolMode={notebookEngine.layers.isEditable(obj.layerId) ? toolState.mode : 'hand'}
            onFocus={setActiveEditor}
            onBlur={() => {}}
          />
        ))}

        {/* Non-focused static text previews */}
        {!isFocused && staticTextObjects.map(obj => isVoiceNoteObject(obj) ? <StaticVoiceNote key={obj.id} object={obj} note={data?.audioNotes?.find(note => note.id === obj.metadata.audioNoteId)} offset={{ x: pageGeometry.source.left, y: pageGeometry.source.top }}/> : (
          <StaticTextPreview key={obj.id} object={obj} scale={1} zIndex={textZIndex(obj.layerId)} offset={{ x: pageGeometry.source.left, y: pageGeometry.source.top }} />
        ))}

        {/* Canvas Layer */}
        <canvas
          ref={canvasRef}
          data-rendered-page-id={page.id}
          data-scene-owner-page-id={sceneOwnerPageId}
          data-render-ready={sceneReady ? 'true' : 'false'}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          className={`absolute inset-0 z-10 w-full h-full ${
            isFocused ? (
              toolState.mode === 'hand' ? 'cursor-grab active:cursor-grabbing touch-none' : 
              toolState.mode === 'text' ? 'cursor-text touch-none' : 
              toolState.mode === 'select' ? 'cursor-default touch-none' : 
              'touch-none'
            ) : 'pointer-events-none'
          }`}
          style={{
            ...(pageCursor ? { cursor: pageCursor } : {}),
            // Do not expose the shared live surface until its ownership
            // marker has caught up with this physical page.
            visibility: sceneReady ? 'visible' : 'hidden',
          }}
        />

      </PageRenderer>
    </div>
  );
};
