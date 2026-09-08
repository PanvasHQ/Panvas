import React, { useEffect, useState, useRef, useMemo } from 'react';
import { notebookRepository } from '@/repositories/NotebookRepository';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';
import { PageRenderer } from './PageRenderer';
import { createEmptyDrawingData, type DrawingData, type TextObject, DEFAULT_PAGE_LAYER_ID } from './engine/drawingTypes';
import { useNotebookSettingsStore } from '@/stores/notebookSettingsStore';
import type { NotebookPage } from '@/types/notebook';
import { ViewportManager } from './engine/ViewportManager';
import { ShapeManager } from './engine/ShapeManager';
import { ImageManager } from './engine/ImageManager';
import { LayerManager } from './engine/LayerManager';
import { DrawingEngine } from './engine/DrawingEngine';
import { FileText } from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import { notebookTipTapExtensions } from './tiptapExtensions';
import {
  getStickyNoteColor,
  getStickyNoteOpacity,
  getStickyNoteShape,
  getShapeBorderRadius,
  hexToRgba,
  isStickyNote,
} from './stickyNotes';

interface InactivePagePreviewProps {
  workspaceId: string;
  notebookId: string;
  page: NotebookPage;
  width: number;
  height: number;
  scale: number;
  pageNumberText: string;
  onClick?: () => void;
  onActivate?: () => void;
}

const StaticTextPreview: React.FC<{ object: TextObject; scale: number }> = ({ object, scale }) => {
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
      className={`absolute pointer-events-none z-0 ${object.metadata?.pastePresentation === 'sticky-note' ? 'panvas-pasted-note' : object.metadata?.pastePresentation === 'mixed-paste' ? 'panvas-mixed-paste' : ''}`}
      style={{
        left: `${object.x * scale}px`,
        top: `${object.y * scale}px`,
        width: `${object.width}px`,
        minHeight: object.height ? `${object.height}px` : undefined,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        padding: isSticky ? '14px' : undefined,
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
                borderRadius: getShapeBorderRadius(stickyShape),
              }}
            />
          )}
        </div>
      )}
      <EditorContent 
        editor={editor} 
        className={`outline-none prose prose-neutral max-w-none prose-sm ${isSticky ? 'p-0' : 'p-1'}`} 
        style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
      />
    </div>
  );
};

export const InactivePagePreview: React.FC<InactivePagePreviewProps> = ({
  workspaceId, notebookId, page, width, height, scale, pageNumberText, onClick, onActivate
}) => {
  const [data, setData] = useState<DrawingData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfError, setPdfError] = useState(false);

  // Preview engine instance persists across width/height changes (e.g. zoom).
  const engineRef = useRef<{ drawing: DrawingEngine; viewport: ViewportManager } | null>(null);

  // Load Drawing Data for default pages
  useEffect(() => {
    let mounted = true;
    if (page.type === 'pdf') {
      setData(createEmptyDrawingData()); // PDFs don't use regular drawing data, just need properties
      return;
    }

    notebookRepository.loadDrawingData(workspaceId, notebookId, page.id).then(loaded => {
      if (!mounted) return;
      if (loaded) {
        setData(loaded);
      } else {
        const defaultSettings = useNotebookSettingsStore.getState();
        const emptyData = createEmptyDrawingData();
        if (defaultSettings.paperColor) emptyData.properties.paperColor = defaultSettings.paperColor;
        if (defaultSettings.template) emptyData.properties.template = defaultSettings.template;
        if (defaultSettings.orientation) emptyData.properties.orientation = defaultSettings.orientation.toLowerCase() as any;
        if (defaultSettings.pageSize) emptyData.properties.pageSize = defaultSettings.pageSize;
        if (defaultSettings.margins) emptyData.properties.margins = defaultSettings.margins;
        setData(emptyData);
      }
    });
    return () => { mounted = false; };
  }, [workspaceId, notebookId, page.id, page.type]);

  // Build the preview engine and load its data. Deliberately excludes
  // width/height: this must NOT rerun on every zoom-driven size change.
  useEffect(() => {
    if (!data || page.type === 'pdf' || !canvasRef.current) return;

    const viewport = new ViewportManager();
    viewport.setZoom(scale);
    const layers = new LayerManager();
    layers.setData(data.layers, data.activeLayerId);
    const shapes = new ShapeManager(viewport, layers);
    const images = new ImageManager(viewport, layers);
    const drawing = new DrawingEngine(viewport, shapes, images, layers);

    drawing.setCanvas(canvasRef.current, width, height);

    if (data.version === 1) {
      drawing.setStrokes((data.strokes || []).map(object => ({ ...object, layerId: object.layerId ?? layers.getLayers()[0].id })));
      shapes.setShapes((data.shapes || []).map(object => ({ ...object, layerId: object.layerId ?? layers.getLayers()[0].id })));
      images.clearImages();
    } else {
      const objects = data.objects || [];
      drawing.setStrokes(objects.filter(o => o.type === 'stroke').map(object => ({ ...object, layerId: object.layerId ?? layers.getLayers()[0].id })) as any);
      shapes.setShapes(objects.filter(o => o.type === 'shape').map(object => ({ ...object, layerId: object.layerId ?? layers.getLayers()[0].id })) as any);
      images.setImages(objects.filter(o => o.type === 'image').map(object => ({ ...object, layerId: object.layerId ?? layers.getLayers()[0].id })) as any);
    }

    drawing.redraw();
    engineRef.current = { drawing, viewport };

    return () => {
      engineRef.current = null;
      images.clearImages();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, page.type]);

  // Resize the existing preview canvas when width/height/scale change (e.g. zoom),
  // without rebuilding the engine or reloading strokes/shapes/images.
  useEffect(() => {
    if (!engineRef.current || page.type === 'pdf') return;
    engineRef.current.viewport.setZoom(scale);
    engineRef.current.drawing.resize(width, height);
  }, [width, height, scale, page.type]);

  const textObjects: TextObject[] = useMemo(() => {
    if (!data || !data.objects) return [];
    const visibility = new Map((data.layers ?? []).map(layer => [layer.id, layer.visible !== false]));
    return data.objects.filter(o => o.type === 'text' && visibility.get(o.layerId ?? DEFAULT_PAGE_LAYER_ID) !== false) as TextObject[];
  }, [data]);

  // PDF Preview Rendering
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
        
        // Render first page
        const pdfPage = await doc.getPage(1);
        const viewport = pdfPage.getViewport({ scale: 1.0 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Scale to fit the page dimensions while preserving aspect ratio
        const pdfScale = Math.min(width / viewport.width, height / viewport.height) * 0.95;
        const scaledViewport = pdfPage.getViewport({ scale: pdfScale });
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await pdfPage.render({
          canvasContext: ctx,
          viewport: scaledViewport,
        }).promise;
      } catch (err) {
        console.error('Failed to load PDF preview:', err);
        if (mounted) setPdfError(true);
      }
    }

    loadPdf();
    return () => { mounted = false; };
  }, [page.type, page.pdfDataId, width, height]);

  const handleTriggerActivate = () => {
    if (onActivate) {
      onActivate();
    } else if (onClick) {
      onClick();
    }
  };

  const properties = data ? data.properties : createEmptyDrawingData().properties;

  return (
    <div 
      className="relative shadow-2xl transition-shadow" 
      onPointerDown={handleTriggerActivate}
      onClick={handleTriggerActivate}
    >
      <PageRenderer
        id={page.id}
        width={width}
        height={height}
        properties={properties}
        pageNumberText={pageNumberText}
      >
        {/* Render text objects on inactive page */}
        {textObjects.map(obj => (
          <StaticTextPreview key={obj.id} object={obj} scale={scale} />
        ))}

        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <canvas 
            ref={canvasRef} 
            className={`pointer-events-none ${page.type === 'pdf' ? 'shadow-md bg-white' : ''}`}
            style={page.type === 'default' ? { width, height } : {}}
          />
        </div>
        
        {page.type === 'pdf' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl p-4 text-white shadow-xl pointer-events-none">
            <FileText className="w-12 h-12 mb-2 opacity-90" />
            <span className="font-medium text-sm truncate max-w-[200px]">{page.title || 'PDF Document'}</span>
            <span className="text-xs opacity-70 mt-1">Click to open</span>
          </div>
        )}
      </PageRenderer>
    </div>
  );
};
