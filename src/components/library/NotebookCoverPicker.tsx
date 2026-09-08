import React, { useRef, useState } from 'react';
import { ImagePlus, Check } from 'lucide-react';
import type { NotebookCover } from '@/types/notebook';
import { DEFAULT_NOTEBOOK_COVER, NOTEBOOK_COVER_TEMPLATES, getNotebookCoverStyle } from './notebookCovers';

interface NotebookCoverPickerProps {
  value: NotebookCover;
  onChange: (cover: NotebookCover) => void;
  title?: string;
}

/** Shared cover editor for notebook creation and later shelf customization. */
export function NotebookCoverPicker({ value, onChange, title = 'Notebook cover' }: NotebookCoverPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const label = title.trim() || 'Notebook';

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl || dataUrl.length > 4_800_000) {
        setError('Cover images must be smaller than 3.5 MB.');
        return;
      }
      setError(null);
      onChange({ kind: 'image', dataUrl, position: '50% 50%' });
    };
    reader.onerror = () => setError('The cover image could not be read.');
    reader.readAsDataURL(file);
  };

  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md border border-panvas-border-default shadow-sm" style={getNotebookCoverStyle(value)} aria-label={`${label} cover preview`}>
          <span className="absolute inset-x-1.5 bottom-2 truncate rounded-sm bg-black/25 px-1 py-0.5 text-center text-[9px] font-semibold text-white">{label}</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-panvas-text-primary">Cover</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-panvas-text-tertiary">Choose a polished template or use an image. You can change this later from the shelf.</p>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="panvas-control mt-2 inline-flex h-7 items-center gap-1.5 px-2 text-[11px] focus-ring">
            <ImagePlus size={13} /> Custom image
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImage} className="sr-only" aria-label="Choose custom notebook cover image" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Cover templates">
        {NOTEBOOK_COVER_TEMPLATES.map(template => {
          const selected = value.kind === 'template' && value.id === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => { setError(null); onChange({ kind: 'template', id: template.id }); }}
              aria-pressed={selected}
              className={`group relative h-14 overflow-hidden rounded-md border text-left transition-transform hover:-translate-y-0.5 focus-ring ${selected ? 'border-panvas-accent-primary ring-2 ring-panvas-accent-primary/30' : 'border-panvas-border-default'}`}
              title={`${template.name} cover`}
            >
              <span className="absolute inset-0" style={{ background: template.background }} />
              <span className="absolute inset-x-1.5 bottom-1 truncate rounded-sm bg-black/25 px-1 py-0.5 text-center text-[9px] font-medium text-white">{template.name}</span>
              {selected && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-panvas-accent-primary text-white"><Check size={10} /></span>}
            </button>
          );
        })}
      </div>
      {value.kind === 'image' && <div className="flex items-center justify-between rounded-md border border-panvas-border-subtle bg-panvas-bg-secondary px-2 py-1.5 text-[11px] text-panvas-text-secondary"><span>Custom image selected</span><button type="button" onClick={() => onChange(DEFAULT_NOTEBOOK_COVER)} className="text-panvas-accent-blue hover:underline focus-ring">Use template</button></div>}
      {error && <p role="alert" className="text-[11px] text-panvas-text-error">{error}</p>}
    </section>
  );
}
