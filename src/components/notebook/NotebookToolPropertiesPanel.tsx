// ============================================
// Panvas — Notebook Tool Properties Panel
// ============================================

import React, { useState, useEffect } from 'react';
import type { ViewportManager } from './engine/ViewportManager';
import { 
  type PageOrientationOption, 
  type PageSizeOption, 
  type PageMarginOption,
  useNotebookSettingsStore
} from '@/stores/notebookSettingsStore';
import type { PageProperties, PageTemplate } from './engine/drawingTypes';
import { Palette, CheckCheck, LayoutGrid, AlertCircle, X, UnfoldVertical } from 'lucide-react';
import { TEMPLATE_CATEGORIES, TEMPLATE_REGISTRY } from './templates/TemplateRegistry.tsx';
import { TemplateGalleryModal } from './templates/TemplateGalleryModal';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import type { NotebookPropertyBatchSnapshot } from '@/types/notebook';
import { WorkspaceViewInspector } from '@/components/workspace/WorkspaceViewControls';

interface NotebookToolPropertiesPanelProps {
  viewportEngine: ViewportManager;
  zoom: number;
  properties: PageProperties;
  onUpdateProperties: (updates: Partial<PageProperties>) => void;
  onApplyPropertiesToAll: (updates: Partial<PageProperties>) => Promise<NotebookPropertyBatchSnapshot>;
  onRestorePropertiesBatch: (snapshot: NotebookPropertyBatchSnapshot) => Promise<void>;
  /**
   * Optional: called when zoom buttons are clicked with a zoom factor (e.g. 0.9 or 1.1).
   * The caller anchors the zoom around the notebook viewport's own center
   * (container-relative), enabling anchor-based scroll correction.
   */
  onZoom?: (factor: number) => void;
}

const colorSwatches: { label: string; color: string }[] = [
  { label: 'White', color: '#ffffff' },
  { label: 'Cream', color: '#F5F5F0' },
  { label: 'Yellow', color: '#FFF9C4' },
  { label: 'Blue', color: '#E3F2FD' },
  { label: 'Pink', color: '#FCE4EC' },
  { label: 'Mint', color: '#E8F5E9' },
  { label: 'Charcoal', color: '#232323' },
];

const pageSizes: PageSizeOption[] = ['A4', 'A5', 'Letter'];
const marginsOptions: PageMarginOption[] = ['No Margin', 'Narrow', 'Normal', 'Wide'];

export const NotebookToolPropertiesPanel: React.FC<NotebookToolPropertiesPanelProps> = ({ 
  viewportEngine, 
  zoom, 
  properties, 
  onUpdateProperties,
  onApplyPropertiesToAll,
  onRestorePropertiesBatch,
  onZoom,
}) => {
  const { activeWorkspaceId, activeNotebookId, notebookPages } = useWorkspaceStore();
  const { showToast, theme, togglePropertiesPanel } = useUIStore();
  const isDark = theme === 'dark';

  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // User-controlled scope toggle: unchecked by default
  const [applyToAllPages, setApplyToAllPages] = useState<boolean>(false);
  const [lastBatch, setLastBatch] = useState<NotebookPropertyBatchSnapshot | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleUpdate = (updates: Partial<PageProperties>) => {
    if (applyToAllPages) {
      void executeBatchApply(updates);
    } else {
      onUpdateProperties(updates);
    }
  };

  const addRecentColor = (color: string) => {
    setRecentColors(prev => {
      const next = [color, ...prev.filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, 6);
      localStorage.setItem('panvas-recent-colors', JSON.stringify(next));
      return next;
    });
  };

  // Color selection
  const handleColorSelect = (color: string) => {
    handleUpdate({ paperColor: color });
  };

  // Template selection
  const handleTemplateSelect = (template: PageTemplate) => {
    handleUpdate({ template });
  };

  // Batch apply properties to all pages in current notebook
  const executeBatchApply = async (updates: Partial<PageProperties>) => {
    if (!activeWorkspaceId || !activeNotebookId) {
      showToast('No active notebook selected', 'error');
      return;
    }

    const pagesInNotebook = notebookPages.filter(
      p => p.notebookId === activeNotebookId && p.type !== 'pdf' && !p.deletedAt
    );

    if (pagesInNotebook.length === 0) {
      showToast('No eligible pages in this notebook', 'info');
      return;
    }

    try {
      setIsApplying(true);
      showToast(`Applying changes to ${pagesInNotebook.length} pages...`, 'info');
      const snapshot = await onApplyPropertiesToAll(updates);
      setLastBatch(snapshot);
      showToast(`Successfully updated all ${pagesInNotebook.length} pages!`, 'success');
    } catch (err) {
      console.error('Failed batch apply:', err);
      showToast('Failed to apply to all pages', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      {/* The dim layer stays below the notebook's pinned floating header,
          while the properties sheet uses the next deliberate elevation. The
          toolbar and workspace controls stay clickable while the
          drawer is open on sub-xl windows. */}
      <button
        type="button"
        className="panvas-layer-scrim absolute inset-0 bg-black/20 xl:hidden max-[599px]:fixed"
        onClick={togglePropertiesPanel}
        aria-label="Close Page Properties"
      />
      <aside className="panvas-properties-panel panvas-layer-sheet absolute inset-y-0 right-0 flex w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-panvas-border-subtle bg-panvas-bg-primary shadow-2xl select-none xl:static xl:z-auto xl:shadow-none max-[599px]:fixed max-[599px]:inset-x-0 max-[599px]:top-auto max-[599px]:bottom-0 max-[599px]:h-auto max-[599px]:max-h-[70vh] max-[599px]:w-full max-[599px]:rounded-t-2xl max-[599px]:border-l-0 max-[599px]:border-t">
        <div className="flex items-center justify-between border-b border-panvas-border-subtle p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Page &amp; view</div>
          <button
            type="button"
            onClick={togglePropertiesPanel}
            className="flex h-7 w-7 items-center justify-center rounded-md text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary xl:hidden"
            aria-label="Close Page Properties"
            title="Close Page Properties"
          >
            <X size={15} />
          </button>
        </div>

        <div className="border-b border-panvas-border-subtle p-4">
          <WorkspaceViewInspector />
        </div>
        
        <div className="p-4 space-y-5 text-xs">
          {/* Zoom */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-panvas-text-primary">Zoom</span>
              <span className="text-panvas-text-secondary">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (onZoom) {
                    onZoom(0.9);
                  } else {
                    viewportEngine.zoomBy(0.9, window.innerWidth / 2, window.innerHeight / 2);
                  }
                }}
                className="flex-1 rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2 py-1.5 text-xs text-panvas-text-primary hover:bg-panvas-bg-hover hover:border-panvas-border-strong active:bg-panvas-bg-active transition-colors focus-ring"
              >
                Out
              </button>
              <button 
                onClick={() => {
                  if (onZoom) {
                    // Reach exactly 100% while still anchoring around the viewport center.
                    onZoom(1 / zoom);
                  } else {
                    viewportEngine.reset();
                  }
                }}
                className="flex-1 rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2 py-1.5 text-xs text-panvas-text-primary hover:bg-panvas-bg-hover hover:border-panvas-border-strong active:bg-panvas-bg-active transition-colors focus-ring"
              >
                100%
              </button>
              <button 
                onClick={() => {
                  if (onZoom) {
                    onZoom(1.1);
                  } else {
                    viewportEngine.zoomBy(1.1, window.innerWidth / 2, window.innerHeight / 2);
                  }
                }}
                className="flex-1 rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2 py-1.5 text-xs text-panvas-text-primary hover:bg-panvas-bg-hover hover:border-panvas-border-strong active:bg-panvas-bg-active transition-colors focus-ring"
              >
                In
              </button>
            </div>
          </div>

          {/* Scope Control Toggle */}
          <div className="flex items-center justify-between p-1.5 mb-2 rounded-lg bg-panvas-bg-secondary border border-panvas-border-subtle">
            <span className="font-medium text-panvas-text-primary text-[11px] ml-1">Apply to all pages</span>
            <button
              type="button"
              role="switch"
              aria-label="Apply to all pages"
              aria-checked={applyToAllPages}
              onClick={() => {
                if (applyToAllPages) {
                  setApplyToAllPages(false);
                  return;
                }
                if (window.confirm('Apply subsequent page-property changes to every non-PDF page in this notebook? Each change can be undone from this panel.')) {
                  setApplyToAllPages(true);
                }
              }}
              disabled={isApplying}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus-ring ${
                applyToAllPages ? 'bg-panvas-text-primary' : 'bg-[#e0e0e0] dark:bg-[#444]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-panvas-bg-primary shadow transition duration-200 ease-in-out ${
                  applyToAllPages ? 'translate-x-4.5 dark:translate-x-4' : 'translate-x-0.5'
                }`}
                style={{ transform: applyToAllPages ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
          {lastBatch && (
            <button
              type="button"
              className="w-full rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2 py-1.5 text-xs font-medium text-panvas-text-primary hover:bg-panvas-bg-hover focus-ring"
              onClick={async () => {
                try {
                  setIsApplying(true);
                  await onRestorePropertiesBatch(lastBatch);
                  setLastBatch(null);
                  showToast('Restored the previous page properties', 'success');
                } catch (error) {
                  console.error('Failed to restore page properties:', error);
                  showToast('Failed to restore the previous page properties', 'error');
                } finally {
                  setIsApplying(false);
                }
              }}
              disabled={isApplying}
            >
              Undo last Apply to all
            </button>
          )}

          {/* Paper Color */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-panvas-text-primary">Paper Color</span>
              {applyToAllPages && (
                <span className="text-[10px] font-medium text-panvas-accent-blue bg-panvas-accent-blue/10 px-1.5 py-0.5 rounded">Global</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {colorSwatches.map((item) => (
                <button
                  key={item.color}
                  onClick={() => handleColorSelect(item.color)}
                  className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 focus-ring ${
                    properties.paperColor.toLowerCase() === item.color.toLowerCase() 
                      ? 'ring-2 ring-panvas-text-primary ring-offset-2 ring-offset-panvas-bg-primary border-transparent' 
                      : 'border-panvas-border-default'
                  }`}
                  style={{ backgroundColor: item.color }}
                  title={item.label}
                  aria-label={`Select paper color ${item.label}`}
                />
              ))}
              <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-panvas-border-default bg-panvas-bg-secondary transition-transform hover:scale-110 hover:bg-panvas-bg-hover focus-ring" title="Custom color picker">
                <Palette size={12} className="text-panvas-text-secondary" />
                <input 
                  type="color" 
                  value={properties.paperColor}
                  onChange={(e) => {
                    handleColorSelect(e.target.value);
                  }}
                  onBlur={(e) => addRecentColor(e.target.value)}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
              </label>
            </div>

            {recentColors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {recentColors.map((color) => (
                  <button
                    key={`recent-${color}`}
                    onClick={() => handleColorSelect(color)}
                    className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 focus-ring ${
                      properties.paperColor.toLowerCase() === color.toLowerCase() 
                        ? 'ring-2 ring-panvas-text-primary ring-offset-1 ring-offset-panvas-bg-primary border-transparent' 
                        : 'border-panvas-border-default'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Background Format */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-panvas-text-primary">Background Format</span>
              {applyToAllPages && (
                <span className="text-[10px] font-medium text-panvas-accent-blue bg-panvas-accent-blue/10 px-1.5 py-0.5 rounded">Global</span>
              )}
            </div>

            <div className="flex gap-1.5 mb-2">
              <select 
                value={properties.template} 
                onChange={(e) => handleTemplateSelect(e.target.value as PageTemplate)}
                className="flex-1 min-w-0 rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2.5 py-1.5 text-xs text-panvas-text-primary focus-ring"
              >
                {TEMPLATE_CATEGORIES.map(cat => (
                  <optgroup key={cat.id} label={cat.title}>
                    {cat.templates.map(t => (
                      <option key={t} value={t}>{TEMPLATE_REGISTRY[t]?.name || t}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsGalleryOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-panvas-border-default bg-panvas-bg-secondary text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors focus-ring shrink-0"
                title="Browse template gallery preview"
                aria-label="Browse template gallery"
              >
                <LayoutGrid size={14} />
              </button>
            </div>

            {TEMPLATE_REGISTRY[properties.template]?.supportsLineColor && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-panvas-text-secondary">Line Color</span>
                <label className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-panvas-border-default shadow-sm transition-transform hover:scale-110 focus-ring" style={{ backgroundColor: properties.ruleLineColor || (isDark ? '#444444' : '#e0e0e0') }}>
                  <input 
                    type="color" 
                    value={properties.ruleLineColor || '#e0e0e0'}
                    onChange={(e) => handleUpdate({ ruleLineColor: e.target.value })}
                    className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Orientation */}
          <div>
            <div className="mb-2 font-medium text-panvas-text-primary">Orientation</div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleUpdate({ orientation: 'portrait' })}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors focus-ring ${
                  properties.orientation === 'portrait'
                    ? 'border-panvas-border-strong bg-panvas-bg-active text-panvas-text-primary font-medium shadow-sm'
                    : 'border-panvas-border-default bg-panvas-bg-secondary text-panvas-text-secondary hover:bg-panvas-bg-hover'
                }`}
              >
                Portrait
              </button>
              <button 
                onClick={() => handleUpdate({ orientation: 'landscape' })}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors focus-ring ${
                  properties.orientation === 'landscape'
                    ? 'border-panvas-border-strong bg-panvas-bg-active text-panvas-text-primary font-medium shadow-sm'
                    : 'border-panvas-border-default bg-panvas-bg-secondary text-panvas-text-secondary hover:bg-panvas-bg-hover'
                }`}
              >
                Landscape
              </button>
            </div>
          </div>

          {/* Page Size */}
          <div>
            <div className="mb-2 font-medium text-panvas-text-primary">Page Size</div>
            <select 
              value={properties.pageSize} 
              onChange={(e) => handleUpdate({ pageSize: e.target.value as PageSizeOption })}
              className="w-full rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2.5 py-1.5 text-xs text-panvas-text-primary focus-ring"
            >
              {pageSizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Margins */}
          <div>
            <div className="mb-2 font-medium text-panvas-text-primary">Margins</div>
            <select 
              value={properties.margins} 
              onChange={(e) => handleUpdate({ margins: e.target.value as PageMarginOption })}
              className="w-full rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2.5 py-1.5 text-xs text-panvas-text-primary focus-ring"
            >
              {marginsOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="rounded-lg border border-panvas-border-subtle bg-panvas-bg-secondary/55 p-3">
            <div className="flex items-center gap-2 font-medium text-panvas-text-primary"><UnfoldVertical size={15} />Expand Page</div>
            <p className="mt-1 text-2xs leading-4 text-panvas-text-tertiary">Add permanent writable space below this page.</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => handleUpdate({ extraHeight: Math.min(6000, (properties.extraHeight ?? 0) + 280) })} className="flex-1 rounded-md border border-panvas-border-default bg-panvas-bg-primary px-2 py-1.5 text-xs font-medium text-panvas-text-primary hover:bg-panvas-bg-hover focus-ring">Add space below</button>
              {(properties.extraHeight ?? 0) > 0 && <button type="button" onClick={() => handleUpdate({ extraHeight: 0 })} className="rounded-md px-2 py-1.5 text-xs text-panvas-text-secondary hover:bg-panvas-bg-hover focus-ring">Reset</button>}
            </div>
            {(properties.extraHeight ?? 0) > 0 && <div className="mt-2 font-mono text-2xs text-panvas-text-tertiary">+{Math.round(properties.extraHeight ?? 0)} px writable</div>}
          </div>
        </div>
      </aside>

      {/* Visual Template Gallery Modal */}
      <TemplateGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        currentTemplate={properties.template}
        properties={properties}
        onSelectTemplate={(t) => handleTemplateSelect(t)}
        onApplyToAllPages={(t) => executeBatchApply({ template: t })}
      />

      {/* Confirmation Modal removed */}
    </>
  );
};
