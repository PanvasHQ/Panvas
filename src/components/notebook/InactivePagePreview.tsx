import React, { useEffect, useState, useRef } from 'react';
import { notebookRepository } from '@/repositories/NotebookRepository';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';
import { PageRenderer } from './PageRenderer';
import { createEmptyDrawingData, type DrawingData } from './engine/drawingTypes';
import { useNotebookSettingsStore } from '@/stores/notebookSettingsStore';
import type { NotebookPage } from '@/types/notebook';
import { ViewportManager } from './engine/ViewportManager';
import { ShapeManager } from './engine/ShapeManager';
import { ImageManager } from './engine/ImageManager';
import { DrawingEngine } from './engine/DrawingEngine';
import { FileText } from 'lucide-react';

interface InactivePagePreviewProps {
  workspaceId: string;
  notebookId: string;
  page: NotebookPage;
  width: number;
  height: number;
  pageNumberText: string;
  onClick: () => void;
}

export const InactivePagePreview: React.FC<InactivePagePreviewProps> = ({
  workspaceId, notebookId, page, width, height, pageNumberText, onClick
}) => {
  const [data, setData] = useState<DrawingData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfError, setPdfError] = useState(false);

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

  // Preview Engine Rendering (for Default Pages)
  useEffect(() => {
    if (!data || page.type === 'pdf' || !canvasRef.current) return;
    
    const viewport = new ViewportManager();
    const shapes = new ShapeManager(viewport);
    const images = new ImageManager(viewport);
    const drawing = new DrawingEngine(viewport, shapes, images);

    drawing.setCanvas(canvasRef.current, width, height);
    
    if (data.version === 1) {
      drawing.setStrokes(data.strokes || []);
      shapes.setShapes(data.shapes || []);
      images.clearImages();
    } else {
      const objects = data.objects || [];
      drawing.setStrokes(objects.filter(o => o.type === 'stroke') as any);
      shapes.setShapes(objects.filter(o => o.type === 'shape') as any);
      images.setImages(objects.filter(o => o.type === 'image') as any);
    }
    
    drawing.redraw();

    return () => {
      images.destroy();
    };
  }, [data, page.type, width, height]);

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

        const blob = new Blob([pdfFile.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const loadingTask = pdfjsLib.getDocument({ url });
        const doc = await loadingTask.promise;
        
        // Don't revoke URL immediately since it's needed for rendering
        // It will be garbage collected or we can add formal cleanup later

        if (!mounted) {
          loadingTask.destroy();
          URL.revokeObjectURL(url);
          return;
        }
        
        // Render first page
        const pdfPage = await doc.getPage(1);
        const viewport = pdfPage.getViewport({ scale: 1.0 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Scale to fit the page dimensions while preserving aspect ratio
        const scale = Math.min(width / viewport.width, height / viewport.height) * 0.95;
        const scaledViewport = pdfPage.getViewport({ scale });
        
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

  if (!data) {
    return (
      <div 
        style={{ width, height }} 
        className="bg-panvas-bg-primary/50 animate-pulse shadow-sm flex items-center justify-center cursor-pointer transition-colors hover:ring-2 ring-panvas-accent-blue"
        onClick={onClick}
      />
    );
  }

  return (
    <div className="cursor-pointer transition-all hover:ring-2 ring-panvas-accent-blue hover:shadow-xl relative" onClick={onClick}>
      <PageRenderer
        id={page.id}
        width={width}
        height={height}
        properties={data.properties}
        pageNumberText={pageNumberText}
      >
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
