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
import type { PageProperties, PageTemplate, ScrollDirection } from './engine/drawingTypes';
import { Palette, CheckCheck, LayoutGrid, AlertCircle } from 'lucide-react';
import { TEMPLATE_CATEGORIES, TEMPLATE_REGISTRY } from './templates/TemplateRegistry.tsx';
import { TemplateGalleryModal } from './templates/TemplateGalleryModal';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { notebookRepository } from '@/repositories/NotebookRepository';
import { createEmptyDrawingData } from './engine/drawingTypes';

interface NotebookToolPropertiesPanelProps {
  viewportEngine: ViewportManager;
  zoom: number;
  properties: PageProperties;
  onUpdateProperties: (updates: Partial<PageProperties>) => void;
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
  onUpdateProperties 
}) => {
  const { activeWorkspaceId, activeNotebookId, activePageId, notebookPages } = useWorkspaceStore();
  const { showToast, theme } = useUIStore();
  const { scrollDirection, setScrollDirection } = useNotebookSettingsStore();
  const isDark = theme === 'dark';

  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // User-controlled scope toggle: unchecked by default
  const [applyToAllPages, setApplyToAllPages] = useState<boolean>(false);

  const handleUpdate = (updates: Partial<PageProperties>) => {
    onUpdateProperties(updates);
    if (applyToAllPages) {
      executeBatchApply(updates);
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
      showToast(`Applying changes to ${pagesInNotebook.length} pages...`, 'info');

      for (const page of pagesInNotebook) {
        // Skip updating the currently active page because onUpdateProperties already updates its state in memory,
        // and the NotebookRenderer saves it to disk on its next cycle.
        // Wait, to be safe, we can just update the disk data for all of them.
        let drawingData = await notebookRepository.loadDrawingData(activeWorkspaceId, activeNotebookId, page.id);
        if (!drawingData) {
          drawingData = createEmptyDrawingData();
        }

        drawingData.properties = { ...drawingData.properties, ...updates };

        await notebookRepository.saveDrawingData(activeWorkspaceId, activeNotebookId, page.id, drawingData);
      }

      showToast(`Successfully updated all ${pagesInNotebook.length} pages!`, 'success');
    } catch (err) {
      console.error('Failed batch apply:', err);
      showToast('Failed to apply to all pages', 'error');
    }
  };

  return (
    <>
      <aside className="hidden w-72 flex-shrink-0 border-l border-panvas-border-subtle bg-panvas-bg-primary xl:flex flex-col overflow-y-auto select-none">
        <div className="p-4 border-b border-panvas-border-subtle">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Page Properties</div>
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
                onClick={() => viewportEngine.zoomBy(0.9, window.innerWidth / 2, window.innerHeight / 2)}
                className="flex-1 rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2 py-1.5 text-xs text-panvas-text-primary hover:bg-panvas-bg-hover hover:border-panvas-border-strong active:bg-panvas-bg-active transition-colors focus-ring"
              >
                Out
              </button>
              <button 
                onClick={() => viewportEngine.reset()}
                className="flex-1 rounded-md border border-panvas-border-default bg-panvas-bg-secondary px-2 py-1.5 text-xs text-panvas-text-primary hover:bg-panvas-bg-hover hover:border-panvas-border-strong active:bg-panvas-bg-active transition-colors focus-ring"
              >
                100%
              </button>
              <button 
                onClick={() => viewportEngine.zoomBy(1.1, window.innerWidth / 2, window.innerHeight / 2)}
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
              aria-checked={applyToAllPages}
              onClick={() => setApplyToAllPages(!applyToAllPages)}
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

          {/* Scroll Direction */}
          <div className="mt-6 pt-4 border-t border-panvas-border-subtle">
            <div className="mb-3 font-medium text-panvas-text-primary">Scroll direction</div>
            <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-panvas-bg-secondary border border-panvas-border-subtle shadow-inner">
              
              <button
                type="button"
                onClick={() => setScrollDirection('vertical')}
                className={`flex flex-col items-center justify-between gap-2 px-1 py-3 rounded-lg hover:bg-panvas-bg-hover transition-colors group focus-ring ${scrollDirection === 'vertical' ? 'bg-panvas-bg-hover' : ''}`}
              >
                {/* Vertical Icon */}
                <div className={`h-6 flex flex-col items-center justify-center transition-opacity ${scrollDirection === 'vertical' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                  <div className="w-3.5 h-1 rounded-t-sm bg-panvas-text-secondary opacity-50 mb-[1px]" />
                  <div className="w-3.5 h-[14px] rounded-[3px] border border-panvas-text-primary" />
                  <div className="w-3.5 h-1 rounded-b-sm bg-panvas-text-secondary opacity-50 mt-[1px]" />
                </div>
                <span className={`text-[10px] font-medium ${scrollDirection === 'vertical' ? 'text-panvas-text-primary' : 'text-panvas-text-secondary'}`}>Vertical</span>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center mt-1 ${scrollDirection === 'vertical' ? 'border-[#ff6b4a]' : 'border-panvas-border-strong'}`}>
                  {scrollDirection === 'vertical' && <div className="w-2 h-2 rounded-full bg-[#ff6b4a]" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScrollDirection('horizontal')}
                className={`flex flex-col items-center justify-between gap-2 px-1 py-3 rounded-lg hover:bg-panvas-bg-hover transition-colors group focus-ring ${scrollDirection === 'horizontal' ? 'bg-panvas-bg-hover' : ''}`}
              >
                {/* Horizontal Icon */}
                <div className={`h-6 flex items-center justify-center transition-opacity ${scrollDirection === 'horizontal' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                  <div className="w-1 h-3.5 rounded-l-sm bg-panvas-text-secondary opacity-50 mr-[1px]" />
                  <div className="w-5 h-3.5 rounded-[3px] border border-panvas-text-primary" />
                  <div className="w-1 h-3.5 rounded-r-sm bg-panvas-text-secondary opacity-50 ml-[1px]" />
                </div>
                <span className={`text-[10px] font-medium ${scrollDirection === 'horizontal' ? 'text-panvas-text-primary' : 'text-panvas-text-secondary'}`}>Horizontal</span>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center mt-1 ${scrollDirection === 'horizontal' ? 'border-[#ff6b4a]' : 'border-panvas-border-strong'}`}>
                  {scrollDirection === 'horizontal' && <div className="w-2 h-2 rounded-full bg-[#ff6b4a]" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScrollDirection('two-page-horizontal')}
                className={`flex flex-col items-center justify-between gap-2 px-1 py-3 rounded-lg hover:bg-panvas-bg-hover transition-colors group focus-ring ${scrollDirection === 'two-page-horizontal' ? 'bg-panvas-bg-hover' : ''}`}
              >
                {/* 2-page horizontal Icon */}
                <div className={`h-6 flex items-center justify-center transition-opacity ${scrollDirection === 'two-page-horizontal' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                  <div className="w-1 h-3.5 rounded-l-sm bg-panvas-text-secondary opacity-40 mr-[1px]" />
                  <div className={`flex rounded-[3px] overflow-hidden border ${scrollDirection === 'two-page-horizontal' ? 'border-[#ff6b4a]/80 bg-[#ff6b4a]/10' : 'border-panvas-text-primary/70 bg-panvas-bg-primary'}`}>
                    <div className={`w-[11px] h-3.5 border-r ${scrollDirection === 'two-page-horizontal' ? 'border-[#ff6b4a]/40' : 'border-panvas-text-primary/30'}`} />
                    <div className="w-[11px] h-3.5" />
                  </div>
                  <div className="w-1 h-3.5 rounded-r-sm bg-panvas-text-secondary opacity-40 ml-[1px]" />
                </div>
                <span className={`text-[10px] font-medium text-center leading-[1.1] ${scrollDirection === 'two-page-horizontal' ? 'text-panvas-text-primary' : 'text-panvas-text-secondary'}`}>2-page<br/>horizontal</span>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center mt-1 ${scrollDirection === 'two-page-horizontal' ? 'border-[#ff6b4a]' : 'border-panvas-border-strong'}`}>
                  {scrollDirection === 'two-page-horizontal' && <div className="w-2 h-2 rounded-full bg-[#ff6b4a]" />}
                </div>
              </button>

            </div>
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
