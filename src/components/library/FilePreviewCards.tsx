import React from 'react';
import { Archive, BookOpen, Building2, Code2, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, LayoutDashboard, ListTree, Palette, Presentation, RotateCcw, Star, Trash2, type LucideIcon } from 'lucide-react';
import type { LibraryFile } from './libraryModel';
import { NotebookCoverThumbnail } from './NotebookCoverThumbnail';

export type { LibraryFile } from './libraryModel';

const icons: Record<LibraryFile['type'], LucideIcon> = { workspace: Building2, folder: Folder, notebook: BookOpen, section: ListTree, page: FileText, canvas: LayoutDashboard, pdf: FileText, image: FileImage, video: FileVideo, audio: FileAudio, markdown: FileText, code: Code2, sheet: FileSpreadsheet, presentation: Presentation, archive: Archive };
const accents: Record<LibraryFile['type'], string> = { workspace: 'bg-panvas-bg-active', folder: 'bg-panvas-bg-active', notebook: 'bg-panvas-bg-active', section: 'bg-panvas-bg-secondary', page: 'bg-panvas-bg-secondary', canvas: 'bg-panvas-bg-secondary', pdf: 'bg-panvas-bg-secondary', image: 'bg-panvas-bg-active/70', video: 'bg-panvas-bg-secondary', audio: 'bg-panvas-bg-active/70', markdown: 'bg-panvas-bg-secondary', code: 'bg-panvas-bg-secondary', sheet: 'bg-panvas-bg-active/70', presentation: 'bg-panvas-bg-secondary', archive: 'bg-panvas-bg-secondary' };

export function FilePreviewCard({
  file,
  selected = false,
  onSelect,
  onOpen,
  onContextMenu,
  onToggleFavorite,
  onRestore,
  onPermanentDelete,
  onTagClick,
  onCustomizeCover,
}: {
  file: LibraryFile;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onToggleFavorite?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onTagClick?: (tag: string) => void;
  onCustomizeCover?: () => void;
}) {
  const Icon = icons[file.type];
  const isTrash = Boolean(onRestore || onPermanentDelete);

  return (
    <article
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className={`panvas-library-card group relative overflow-hidden rounded-xl border bg-panvas-bg-elevated transition-[border,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-panvas-border-strong/25 hover:shadow-[0_12px_26px_rgba(32,25,18,0.07)] ${
        selected ? 'border-panvas-text-primary/40 ring-1 ring-panvas-text-primary/15' : 'border-panvas-border-default'
      }`}
    >
      <div className={`panvas-library-preview relative flex h-28 items-center justify-center border-b border-panvas-border-subtle/70 ${accents[file.type]}`}>
        <PreviewArt type={file.type} title={file.title} cover={file.cover} />

        {/* Type Icon */}
        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-md border border-panvas-border-default bg-panvas-bg-elevated/90 text-panvas-text-secondary">
          <Icon size={14} />
        </span>

        {/* Top-Right Badges/Actions */}
        <div className="absolute right-3 top-3 flex items-center gap-1">
          {/* Favorite indicator / button */}
          {!isTrash && onToggleFavorite && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onToggleFavorite();
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-md border border-panvas-border-default bg-panvas-bg-elevated/90 transition-opacity focus-ring ${
                file.isFavorite
                  ? 'text-panvas-accent-amber opacity-100'
                  : 'text-panvas-text-tertiary opacity-0 hover:text-panvas-text-primary focus:opacity-100 group-hover:opacity-100'
              }`}
              title={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={13} className={file.isFavorite ? 'fill-panvas-accent-amber text-panvas-accent-amber' : ''} />
            </button>
          )}

          {/* Notebook cover customize button */}
          {!isTrash && file.type === 'notebook' && onCustomizeCover && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onCustomizeCover();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-panvas-border-default bg-panvas-bg-elevated/90 text-panvas-text-secondary opacity-0 transition-opacity hover:bg-panvas-bg-hover hover:text-panvas-text-primary focus:opacity-100 group-hover:opacity-100 focus-ring"
              title={`Customize ${file.title} cover`}
              aria-label={`Customize ${file.title} cover`}
            >
              <Palette size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-panvas-text-primary select-none"
            title={file.title}
          >
            {file.title}
          </span>
          {isTrash ? (
            <div className="flex items-center gap-1">
              {onRestore && <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onRestore();
                }}
                className="flex h-6 items-center gap-1 rounded bg-panvas-bg-secondary px-2 text-2xs font-medium text-panvas-text-primary hover:bg-panvas-bg-active focus-ring"
                title="Restore this item"
              >
                <RotateCcw size={11} />
                Restore
              </button>}
              {onPermanentDelete && <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onPermanentDelete();
                }}
                className="flex h-6 w-6 items-center justify-center rounded bg-panvas-bg-secondary text-panvas-text-tertiary hover:bg-panvas-accent-rose/15 hover:text-panvas-accent-rose focus-ring"
                title="Delete permanently"
                aria-label={`Delete ${file.title} permanently`}
              >
                <Trash2 size={11} />
              </button>}
            </div>
          ) : (
            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-panvas-bg-secondary px-1 text-[8px] font-medium text-panvas-text-secondary">
              {file.owner}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-2xs text-panvas-text-tertiary">
          <span className="shrink-0">{file.modified}</span>
          <span>·</span>
          <span className="truncate" title={file.size}>{file.size}</span>
        </div>

        {file.originPath && (
          <div className="mt-1.5 truncate text-[11px] text-panvas-text-tertiary" title={`Origin: ${file.originPath}`}>
            {file.originPath}
          </div>
        )}

        <div className="mt-3 flex gap-1 overflow-hidden">
          {file.tags.map(tag =>
            onTagClick ? (
              <button
                type="button"
                key={tag}
                onClick={event => {
                  event.stopPropagation();
                  onTagClick(tag);
                }}
                className="truncate rounded-md bg-panvas-bg-secondary px-1.5 py-0.5 text-2xs text-panvas-text-secondary hover:bg-panvas-bg-active focus-ring"
              >
                {tag}
              </button>
            ) : (
              <span
                key={tag}
                className="truncate rounded-md bg-panvas-bg-secondary px-1.5 py-0.5 text-2xs text-panvas-text-secondary"
              >
                {tag}
              </span>
            ),
          )}
        </div>
      </div>
    </article>
  );
}

function PreviewArt({ type, title, cover }: Pick<LibraryFile, 'type' | 'title' | 'cover'>) {
  if (type === 'canvas') return <div className="relative h-16 w-28 rounded-md border border-panvas-border-default bg-panvas-bg-elevated bg-[radial-gradient(rgba(127,127,127,0.15)_0.6px,transparent_0.6px)] bg-[size:8px_8px]"><span className="absolute left-4 top-4 h-5 w-9 rounded border border-panvas-border-default bg-panvas-bg-secondary" /><span className="absolute bottom-3 right-4 h-3 w-7 rounded bg-panvas-bg-active" /></div>;
  if (type === 'notebook') return <NotebookCoverThumbnail title={title} cover={cover} />;
  if (type === 'pdf') return <div className="h-[70px] w-[54px] rounded-sm border border-panvas-border-default bg-panvas-bg-elevated p-2 shadow-sm"><span className="block h-2 w-7 bg-panvas-text-primary/30" /><span className="mt-3 block h-px w-full bg-panvas-border-default" /><span className="mt-2 block h-px w-4/5 bg-panvas-border-default" /><span className="mt-2 block h-px w-full bg-panvas-border-default" /></div>;
  if (type === 'code') return <pre className="w-32 overflow-hidden rounded-md border border-panvas-border-default bg-panvas-bg-elevated p-2 font-mono text-[8px] leading-3 text-panvas-text-secondary">{`const map =\n  ideas.map()`}</pre>;
  if (type === 'sheet') return <div className="grid h-16 w-28 grid-cols-4 grid-rows-4 overflow-hidden rounded border border-panvas-border-default bg-panvas-bg-elevated">{Array.from({ length: 16 }, (_, index) => <span key={index} className="border-b border-r border-panvas-border-subtle/60" />)}</div>;
  if (type === 'presentation') return <div className="flex h-16 w-28 items-center justify-center rounded border border-panvas-border-default bg-panvas-bg-elevated"><span className="h-5 w-14 rounded bg-panvas-bg-active" /></div>;
  if (type === 'image' || type === 'video') return <div className="relative h-16 w-28 overflow-hidden rounded border border-panvas-border-default bg-panvas-bg-elevated"><span className="absolute inset-x-0 bottom-0 h-7 bg-panvas-bg-active/80" />{type === 'video' && <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-y-[6px] border-l-[9px] border-y-transparent border-l-panvas-text-secondary" />}</div>;
  if (type === 'audio') return <div className="flex h-14 items-center gap-1">{[12, 25, 18, 34, 22, 39, 16, 28, 13].map((height, index) => <span key={index} className="w-1 rounded-full bg-panvas-text-secondary/45" style={{ height }} />)}</div>;
  return <IconPreview type={type} />;
}
function IconPreview({ type }: Pick<LibraryFile, 'type'>) { const Icon = icons[type]; return <Icon size={33} strokeWidth={1.2} className="text-panvas-text-tertiary" />; }
