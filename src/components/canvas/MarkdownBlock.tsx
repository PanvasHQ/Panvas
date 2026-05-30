// ============================================
// Panvas — Markdown Block
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CustomBlock } from '@/types/canvas';
import { useCanvasStore } from '@/stores/canvasStore';
import {
  GripVertical,
  Pencil,
  Eye,
  Trash2,
  Type,
} from 'lucide-react';

interface MarkdownBlockProps {
  block: CustomBlock;
}

export function MarkdownBlock({ block }: MarkdownBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block.content);
  const { updateBlock, deleteBlock } = useCanvasStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, blockX: block.x, blockY: block.y });

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
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
        <div className="block-type-badge markdown">
          <Type size={8} />
          <span>MD</span>
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
      <div className="p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => {
              if (e.key === 'Escape') handleSave();
            }}
            className="w-full min-h-[150px] bg-transparent text-sm text-panvas-text-primary
                       font-mono resize-none outline-none placeholder:text-panvas-text-tertiary"
            placeholder="Write markdown..."
          />
        ) : (
          <div
            className="markdown-content text-sm cursor-text"
            onDoubleClick={() => setIsEditing(true)}
          >
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            ) : (
              <p className="text-panvas-text-tertiary italic text-sm">
                Double-click to edit...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
