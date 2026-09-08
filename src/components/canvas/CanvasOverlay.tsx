// ============================================
// Panvas — Canvas Overlay (Custom Blocks)
// ============================================

import React from 'react';
import type { CustomBlock } from '@/types/canvas';
import { MarkdownBlock } from './MarkdownBlock';
import { LatexBlock } from './LatexBlock';
import { PdfBlock } from './PdfBlock';
import { CanvasVoiceNote } from './CanvasVoiceNote';

interface CanvasOverlayProps {
  blocks: CustomBlock[];
  excalidrawAPI: any;
}

export function CanvasOverlay({ blocks, excalidrawAPI }: CanvasOverlayProps) {
  // Get canvas viewport state for coordinate translation
  const appState = excalidrawAPI?.getAppState?.() || {};
  const zoom = appState.zoom?.value || 1;
  const scrollX = appState.scrollX || 0;
  const scrollY = appState.scrollY || 0;

  return (
    <div
      className="panvas-layer-canvas-decoration absolute inset-0 pointer-events-none"
      style={{ overflow: 'hidden' }}
    >
      {blocks.map(block => {
        // Translate canvas coordinates to screen coordinates
        const screenX = (block.x + scrollX) * zoom;
        const screenY = (block.y + scrollY) * zoom;
        const screenW = block.width * zoom;
        const screenH = block.height * zoom;

        return (
          <div
            key={block.id}
            className="pointer-events-auto"
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: screenW,
              minHeight: screenH,
              transform: `scale(${1})`,
              transformOrigin: 'top left',
            }}
          >
            {block.type === 'markdown' && <MarkdownBlock block={block} />}
            {block.type === 'latex' && <LatexBlock block={block} />}
            {block.type === 'pdf' && <PdfBlock block={block} />}
            {block.type === 'audio' && <CanvasVoiceNote block={block} zoom={zoom} />}
          </div>
        );
      })}
    </div>
  );
}
