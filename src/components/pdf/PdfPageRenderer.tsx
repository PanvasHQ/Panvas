import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

interface PdfPageRendererProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export function PdfPageRenderer({ pdfDocument, pageNumber, scale }: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Support high-DPI displays
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          transform,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;

        // Render Text Layer
        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv && isMounted) {
          textLayerDiv.innerHTML = '';
          const textContent = await page.getTextContent();
          if (!isMounted) return;
          const textLayer = new TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport
          });
          await textLayer.render();
        }
      } catch (err: any) {
        if (isMounted && err.name !== 'RenderingCancelledException') {
          console.error('[PdfPageRenderer] Render error:', err);
          setError(err);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDocument, pageNumber, scale]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-panvas-bg-elevated text-panvas-text-error">
        Failed to render page {pageNumber}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full"
        dir="ltr"
      />
      <div 
        ref={textLayerRef} 
        className="textLayer absolute inset-0 w-full h-full" 
        style={{ '--scale-factor': scale } as React.CSSProperties}
      />
    </div>
  );
}
