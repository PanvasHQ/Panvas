import { TemplatePreview } from './TemplatePreview';
// ============================================
// Panvas — Template Gallery Modal
// ============================================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, LayoutGrid, CheckCheck } from 'lucide-react';
import type { PageTemplate, PageProperties } from '../engine/drawingTypes';
import { TEMPLATE_REGISTRY, TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateDefinition } from './TemplateRegistry.tsx';
import { resolveNotebookLineColor, resolveNotebookPaperColor } from '@/lib/pageProperties';

interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: PageTemplate;
  properties: PageProperties;
  onSelectTemplate: (template: PageTemplate) => void;
  onApplyToAllPages: (template: PageTemplate) => void;
}

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  isOpen,
  onClose,
  currentTemplate,
  properties,
  onSelectTemplate,
  onApplyToAllPages,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate>(currentTemplate);
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTemplate(currentTemplate);
    setApplyToAll(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [currentTemplate, isOpen, onClose]);

  if (!isOpen) return null;

  const categories: { id: string; title: string }[] = [
    { id: 'All', title: 'All Templates' },
    ...TEMPLATE_CATEGORIES.map(c => ({ id: c.id, title: c.title })),
  ];

  const allTemplates: TemplateDefinition[] = Object.values(TEMPLATE_REGISTRY);

  const filteredTemplates: TemplateDefinition[] = selectedCategory === 'All'
    ? allTemplates
    : allTemplates.filter((t: TemplateDefinition) => t.category === selectedCategory);

  const handleApply = () => {
    if (applyToAll) onApplyToAllPages(selectedTemplate);
    else onSelectTemplate(selectedTemplate);
    onClose();
  };

  // Thumbnails preview the same persisted document colors as the page. The
  // application theme belongs to the surrounding modal chrome only.
  const previewBgColor = resolveNotebookPaperColor(properties.paperColor);
  const previewLineColor = resolveNotebookLineColor(properties.ruleLineColor);

  return (
    <AnimatePresence>
      <div className="panvas-layer-modal fixed inset-0 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="panvas-dialog-backdrop absolute inset-0"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-gallery-title"
          className="panvas-dialog relative flex w-full max-w-4xl max-h-[min(780px,88vh)] flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-panvas-border-subtle bg-panvas-bg-elevated flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-panvas-bg-secondary border border-panvas-border-subtle text-panvas-text-primary">
                <LayoutGrid size={15} />
              </div>
              <h2 id="template-gallery-title" className="text-sm font-semibold text-panvas-text-primary">Note Style & Templates</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-panvas-text-tertiary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors focus-ring"
              aria-label="Close dialog"
            >
              <X size={15} />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-panvas-border-subtle bg-panvas-bg-secondary/40 overflow-x-auto flex-shrink-0 [scrollbar-width:thin]">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                aria-pressed={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors focus-ring ${
                  selectedCategory === cat.id
                    ? 'bg-panvas-text-primary text-panvas-bg-primary shadow-sm'
                    : 'text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-hover'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Template Grid Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {filteredTemplates.map((template: TemplateDefinition) => {
                const isSelected = selectedTemplate === template.id;
                return (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    aria-pressed={isSelected}
                    className={`group relative flex min-w-0 flex-col rounded-xl border p-2.5 text-left transition-all duration-150 focus-ring ${
                      isSelected
                        ? 'border-panvas-accent-blue bg-panvas-accent-blue/5 shadow-md ring-2 ring-panvas-accent-blue/30'
                        : 'border-panvas-border-default bg-panvas-bg-secondary hover:border-panvas-border-strong hover:shadow-sm'
                    }`}
                  >
                    {/* Faithful Live SVG Preview Thumbnail */}
                    <div
                      className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-panvas-border-subtle shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: previewBgColor }}
                    >
                      <TemplatePreview template={template.id} properties={{ ...properties, ruleLineColor: previewLineColor }} backgroundColor={previewBgColor} />

                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-panvas-accent-blue text-white shadow">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div className="mt-2 min-w-0">
                      <div className="truncate text-xs font-semibold text-panvas-text-primary">{template.name}{currentTemplate === template.id && <span className="ml-1 text-2xs text-panvas-accent-blue">Current</span>}</div>
                      <div className="mt-1 line-clamp-2 min-h-[2rem] text-[10px] leading-4 text-panvas-text-secondary">{template.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-t border-panvas-border-subtle bg-panvas-bg-elevated flex-shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-panvas-text-secondary hover:text-panvas-text-primary">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={e => setApplyToAll(e.target.checked)}
                className="rounded border-panvas-border-default text-panvas-accent-blue focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center gap-1 font-medium">
                <CheckCheck size={14} className={applyToAll ? 'text-panvas-accent-blue' : 'text-panvas-text-tertiary'} />
                All note pages in this notebook (PDF pages excluded)
              </span>
            </label>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3.5 rounded-md text-xs font-medium text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors focus-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="h-8 px-4 rounded-md bg-panvas-text-primary text-panvas-bg-primary text-xs font-medium transition-all hover:opacity-90 active:scale-[0.98] shadow-sm focus-ring"
              >
                {applyToAll ? 'Apply to all note pages' : 'Apply to current page'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
