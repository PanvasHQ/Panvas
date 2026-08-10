import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';

// Initialize the PDF.js worker using the Vite URL import
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

export function usePdfDocument(pdfDataId?: string) {
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const userId = useAuthStore(state => state.user?.id) || null;

  useEffect(() => {
    let isMounted = true;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const loadPdf = async () => {
      if (!pdfDataId) {
        setPdfDocument(null);
        setNumPages(0);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const pdfData = await canvasRepository.getPdf(userId, pdfDataId);
        if (!pdfData) {
          throw new Error(`PDF data not found for id: ${pdfDataId}`);
        }

        const blob = new Blob([pdfData.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        loadingTask = pdfjsLib.getDocument({ url });
        
        // Store URL on task for cleanup
        (loadingTask as any)._objectUrl = url;

        const doc = await loadingTask.promise;

        if (isMounted) {
          setPdfDocument(doc);
          setNumPages(doc.numPages);
        }
      } catch (err: any) {
        if (isMounted && err.name !== 'RenderingCancelledException' && err.name !== 'PromiseCancelledException') {
          console.error('[usePdfDocument] Failed to load PDF:', err);
          setError(err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (loadingTask && !loadingTask.destroyed) {
        const url = (loadingTask as any)._objectUrl;
        loadingTask.destroy().catch(() => {}).finally(() => {
          if (url) URL.revokeObjectURL(url);
        });
      }
    };
  }, [pdfDataId, userId]);

  return { pdfDocument, numPages, isLoading, error };
}
