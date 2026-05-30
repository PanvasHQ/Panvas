// ============================================
// Panvas — PDF Block
// ============================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CustomBlock } from '@/types/canvas';
import { useCanvasStore } from '@/stores/canvasStore';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from '@/stores/authStore';
import {
  GripVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
} from 'lucide-react';

interface PdfBlockProps {
  block: CustomBlock;
}

export function PdfBlock({ block }: PdfBlockProps) {
  const { updateBlock, deleteBlock } = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(
    (block.metadata as any)?.currentPage || 1
  );
  const [totalPages, setTotalPages] = useState(
    (block.metadata as any)?.totalPages || 0
  );
  const [scale, setScale] = useState((block.metadata as any)?.scale || 1.0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, blockX: block.x, blockY: block.y });

  // Load PDF
  useEffect(() => {
    const pdfDataId = (block.metadata as any)?.pdfDataId;
    if (!pdfDataId) return;

    async function loadPdf() {
      try {
        const userId = useAuthStore.getState().user?.id ?? null;
        const pdfFile = await canvasRepository.getPdf(userId, pdfDataId);
        if (!pdfFile) return;

        const pdfjsLib = await import('pdfjs-dist');
        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const doc = await pdfjsLib.getDocument({ data: pdfFile.data }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        updateBlock(block.id, {
          metadata: { ...block.metadata, totalPages: doc.numPages },
        });
      } catch (err) {
        console.error('Failed to load PDF:', err);
      }
    }

    loadPdf();
  }, [(block.metadata as any)?.pdfDataId]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    async function renderPage() {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;
    }

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      blockX: block.x,
      blockY: block.y,
    };

    const handleMove = (me: MouseEvent) => {
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      updateBlock(block.id, {
        x: dragRef.current.blockX + dx,
        y: dragRef.current.blockY + dy,
      });
    };

    const handleUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  return (
    <div
      className={`canvas-block rounded-xl overflow-hidden
                  ${isDragging ? 'opacity-90 shadow-glow-violet' : ''}`}
      style={{ width: '100%', minHeight: '100%' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-panvas-border-subtle
                   bg-panvas-bg-tertiary/50 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <GripVertical size={12} className="text-panvas-text-tertiary" />
        <div className="block-type-badge pdf">
          <FileText size={8} />
          <span>PDF</span>
        </div>

        {/* Page Navigation */}
        {totalPages > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="btn-icon p-0.5 disabled:opacity-30"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="text-2xs text-panvas-text-secondary min-w-[40px] text-center">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="btn-icon p-0.5 disabled:opacity-30"
            >
              <ChevronRight size={12} />
            </button>

            <div className="w-px h-3 bg-panvas-border-subtle mx-1" />

            <button onClick={() => setScale((s: number) => Math.max(0.5, s - 0.25))} className="btn-icon p-0.5">
              <ZoomOut size={12} />
            </button>
            <button onClick={() => setScale((s: number) => Math.min(3, s + 0.25))} className="btn-icon p-0.5">
              <ZoomIn size={12} />
            </button>
          </div>
        )}

        <button
          onClick={() => deleteBlock(block.id)}
          className="btn-icon p-1 hover:text-panvas-accent-rose"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* PDF Canvas */}
      <div className="pdf-container p-2 overflow-auto">
        {pdfDoc ? (
          <canvas ref={canvasRef} className="mx-auto" />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-panvas-text-tertiary">
            <FileText size={32} className="mb-2 opacity-30" />
            <p className="text-xs">PDF loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}
