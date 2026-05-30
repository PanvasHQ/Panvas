// ============================================
// Panvas — LaTeX Block
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { CustomBlock } from '@/types/canvas';
import { useCanvasStore } from '@/stores/canvasStore';
import {
  GripVertical,
  Pencil,
  Eye,
  Trash2,
  Sigma,
} from 'lucide-react';

interface LatexBlockProps {
  block: CustomBlock;
}

export function LatexBlock({ block }: LatexBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block.content);
  const [error, setError] = useState<string | null>(null);
  const { updateBlock, deleteBlock } = useCanvasStore();
  const renderedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, blockX: block.x, blockY: block.y });

  // Render LaTeX
  useEffect(() => {
    if (!isEditing && renderedRef.current) {
      try {
        katex.render(content || 'E = mc^2', renderedRef.current, {
          displayMode: true,
          throwOnError: false,
          errorColor: '#f43f5e',
          trust: true,
        });
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Invalid LaTeX');
      }
    }
  }, [content, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (content !== block.content) {
      updateBlock(block.id, { content });
    }
  };

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
                  ${isDragging ? 'opacity-90 shadow-glow-blue' : ''}`}
      style={{ width: '100%', minHeight: '100%' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-panvas-border-subtle
                   bg-panvas-bg-tertiary/50 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <GripVertical size={12} className="text-panvas-text-tertiary" />
        <div className="block-type-badge latex">
          <Sigma size={8} />
          <span>TeX</span>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn-icon p-1"
            title={isEditing ? 'Preview' : 'Edit'}
          >
            {isEditing ? <Eye size={12} /> : <Pencil size={12} />}
          </button>
          <button
            onClick={() => deleteBlock(block.id)}
            className="btn-icon p-1 hover:text-panvas-accent-rose"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={inputRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => {
                if (e.key === 'Escape') handleSave();
              }}
              className="w-full min-h-[60px] bg-panvas-bg-primary/50 rounded-lg p-2.5
                         text-sm text-panvas-text-primary font-mono
                         border border-panvas-border-subtle
                         resize-none outline-none focus:border-panvas-accent-blue/50
                         placeholder:text-panvas-text-tertiary"
              placeholder="Enter LaTeX equation..."
            />
            {/* Live preview while editing */}
            <div className="border-t border-panvas-border-subtle pt-2">
              <div
                ref={renderedRef}
                className="text-center overflow-x-auto py-1"
              />
            </div>
          </div>
        ) : (
          <div
            className="cursor-text text-center overflow-x-auto"
            onDoubleClick={() => setIsEditing(true)}
          >
            {error ? (
              <div className="text-sm text-panvas-accent-rose">{error}</div>
            ) : (
              <div ref={renderedRef} className="py-1" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
