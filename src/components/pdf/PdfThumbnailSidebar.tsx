import React, { useState, useEffect, useRef } from 'react';
import { Grid2X2, ListFilter, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { NotebookEngine } from '@/components/notebook/engine/NotebookEngine';

interface PdfThumbnailSidebarProps {
  pdfDocument: PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  engine: NotebookEngine;
}

export function PdfThumbnailSidebar({ pdfDocument, numPages, currentPage, onPageChange, isSidebarOpen, setIsSidebarOpen, engine }: PdfThumbnailSidebarProps) { 
  const [activeTab, setActiveTab] = useState<'Thumbnails' | 'Outline'>('Thumbnails'); 
  const [outline, setOutline] = useState<any[] | null>(null);

  useEffect(() => {
    if (pdfDocument) {
      pdfDocument.getOutline().then(data => {
        setOutline(data || []);
      }).catch(err => {
        console.error('Failed to get outline', err);
        setOutline([]);
      });
    } else {
      setOutline(null);
    }
  }, [pdfDocument]);

  const handleOutlineClick = async (dest: any) => {
    if (!pdfDocument || !dest) return;
    try {
      let explicitDest = dest;
      if (typeof dest === 'string') {
        explicitDest = await pdfDocument.getDestination(dest);
      }
      if (Array.isArray(explicitDest) && explicitDest.length > 0) {
        const pageIndex = await pdfDocument.getPageIndex(explicitDest[0]);
        onPageChange(pageIndex + 1);
      }
    } catch (err) {
      console.error('Failed to navigate to outline destination', err);
    }
  };
  
  return (
    <aside className="w-full h-full flex-shrink-0 flex flex-col" aria-label="PDF page thumbnails">
      <div className="mb-3 flex h-10 items-center justify-between border-b border-panvas-border-subtle px-2">
        <div className="flex items-center gap-1">
          <Tab label="Thumbnails" active={activeTab === 'Thumbnails'} onClick={() => setActiveTab('Thumbnails')} />
          <Tab label="Outline" active={activeTab === 'Outline'} onClick={() => setActiveTab('Outline')} />
        </div>
        <button 
          type="button" 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary active:bg-panvas-bg-active focus-ring" 
          title="Toggle Sidebar" 
          aria-label="Toggle Sidebar"
        >
          {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>
      </div>
      <div className="mb-3 flex justify-end gap-1 px-4">
        <MiniButton label="Filter thumbnails"><ListFilter size={13} /></MiniButton>
        <MiniButton label="Grid thumbnails"><Grid2X2 size={13} /></MiniButton>
      </div>
      {activeTab === 'Thumbnails' ? (
        <div className="space-y-3 px-4 pb-4 overflow-y-auto flex-1">
          {Array.from({ length: numPages }).map((_, i) => {
            const pageNum = i + 1;
            return (
              <button 
                key={pageNum} 
                type="button" 
                onClick={() => onPageChange(pageNum)} 
                aria-pressed={currentPage === pageNum} 
                className={`w-full rounded-lg p-1.5 text-left transition-colors focus-ring ${currentPage === pageNum ? 'bg-panvas-bg-active' : 'hover:bg-panvas-bg-hover'}`}
              >
                <Thumbnail page={pageNum} pdfDocument={pdfDocument} />
                <span className={`mt-1.5 block text-center text-2xs ${currentPage === pageNum ? 'font-medium text-panvas-text-primary' : 'text-panvas-text-tertiary'}`}>
                  {pageNum}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-0.5 px-4 pb-4 overflow-y-auto flex-1">
          {!outline ? (
            <div className="text-xs text-panvas-text-tertiary px-2 py-4 text-center">Loading outline...</div>
          ) : outline.length === 0 ? (
            <div className="text-xs text-panvas-text-tertiary px-2 py-4 text-center">No document outline available.</div>
          ) : (
            <OutlineTree items={outline} level={0} onNavigate={handleOutlineClick} />
          )}
        </div>
      )}
    </aside>
  ); 
}

function OutlineTree({ items, level, onNavigate }: { items: any[]; level: number; onNavigate: (dest: any) => void }) {
  if (!items || items.length === 0) return null;
  return (
    <>
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`}>
          <button 
            type="button" 
            onClick={() => onNavigate(item.dest)}
            className="flex min-h-[28px] w-full items-start rounded-md py-1 pr-2 text-left text-xs transition-colors hover:bg-panvas-bg-hover focus-ring text-panvas-text-secondary"
            style={{ paddingLeft: `${8 + level * 12}px` }}
            title={item.title}
          >
            <span className="line-clamp-2">{item.title}</span>
          </button>
          {item.items && item.items.length > 0 && (
            <OutlineTree items={item.items} level={level + 1} onNavigate={onNavigate} />
          )}
        </div>
      ))}
    </>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`h-8 border-b-2 px-1.5 text-2xs transition-colors focus-ring ${active ? 'border-panvas-text-primary text-panvas-text-primary' : 'border-transparent text-panvas-text-tertiary hover:text-panvas-text-secondary'}`}>{label}</button>; }
function MiniButton({ label, children }: { label: string; children: React.ReactNode }) { return <button type="button" title={label} aria-label={label} className="flex h-6 w-6 items-center justify-center rounded text-panvas-text-tertiary hover:bg-panvas-bg-hover hover:text-panvas-text-primary focus-ring">{children}</button>; }

function Thumbnail({ page, pdfDocument }: { page: number, pdfDocument: PDFDocumentProxy | null }) { 
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    if (!pdfDocument) return;

    const renderThumbnail = async () => {
      try {
        const pdfPage = await pdfDocument.getPage(page);
        if (!isMounted) return;

        // Render at a small fixed scale for thumbnail (width roughly ~150px)
        const unscaledViewport = pdfPage.getViewport({ scale: 1.0 });
        const scale = 150 / unscaledViewport.width;
        const viewport = pdfPage.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        renderTask = pdfPage.render({
          canvasContext: context,
          transform,
          viewport: viewport,
        });
        
        await renderTask.promise;
      } catch (err: any) {
        if (isMounted && err.name !== 'RenderingCancelledException') {
          console.error('[Thumbnail] Render error:', err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDocument, page]);

  return (
    <div className="overflow-hidden rounded-md border border-panvas-border-subtle bg-white shadow-sm flex items-center justify-center min-h-[200px]">
      <canvas ref={canvasRef} className="max-w-full" dir="ltr" />
    </div>
  ); 
}
