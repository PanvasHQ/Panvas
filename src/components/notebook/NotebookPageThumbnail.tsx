import React from 'react';
import type { NotebookPage } from '@/types/notebook';
import { FileText } from 'lucide-react';

interface Props {
  page: NotebookPage;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  index: number;
  // Drag and drop
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragTarget?: boolean;
  dragTargetPosition?: 'top' | 'bottom' | null;
}

export const NotebookPageThumbnail: React.FC<Props> = ({ 
  page, isActive, onClick, onContextMenu, index,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  isDragTarget, dragTargetPosition
}) => {
  return (
    <div
      className={`relative w-full ${isDragTarget && dragTargetPosition === 'top' ? 'pt-2' : ''} ${isDragTarget && dragTargetPosition === 'bottom' ? 'pb-2' : ''}`}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
    >
      {isDragTarget && dragTargetPosition === 'top' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-panvas-accent-blue rounded-full pointer-events-none" />
      )}
      
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`w-full group flex flex-col items-center gap-2 p-2 rounded-lg transition-colors focus-ring
          ${isActive ? 'bg-panvas-bg-active' : 'hover:bg-panvas-bg-hover'}`}
      >
        <div className={`w-full aspect-[0.707] rounded-md border flex items-center justify-center bg-panvas-bg-elevated overflow-hidden shadow-sm transition-colors
          ${isActive ? 'border-panvas-accent-blue/50 ring-1 ring-panvas-accent-blue/50' : 'border-panvas-border-subtle group-hover:border-panvas-border-default'}`}
        >
          <div className="flex flex-col items-center justify-center text-panvas-text-tertiary gap-1">
            <FileText size={16} className={isActive ? 'text-panvas-accent-blue' : ''} />
            <span className="text-[9px] font-mono opacity-50">{index + 1}</span>
          </div>
        </div>
        <span className={`text-2xs w-full text-center truncate px-1 ${isActive ? 'font-medium text-panvas-text-primary' : 'text-panvas-text-secondary'}`}>
          {page.title || 'Untitled Page'}
        </span>
      </button>

      {isDragTarget && dragTargetPosition === 'bottom' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-panvas-accent-blue rounded-full pointer-events-none" />
      )}
    </div>
  );
};
