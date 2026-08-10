// ============================================
// Panvas — Template Gallery Modal
// ============================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, LayoutGrid, CheckCheck } from 'lucide-react';
import type { PageTemplate, PageProperties } from '../engine/drawingTypes';
import { TEMPLATE_REGISTRY, TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateDefinition } from './TemplateRegistry.tsx';
import { useUIStore } from '@/stores/uiStore';

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
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const isInk = theme === 'ink';

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate>(currentTemplate);
  const [applyToAll, setApplyToAll] = useState(false);

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
    onSelectTemplate(selectedTemplate);
    if (applyToAll) {
      onApplyToAllPages(selectedTemplate);
    }
    onClose();
  };

  // Preview paper color
  const previewBgColor = (() => {
    if (!properties.paperColor || properties.paperColor === 'default') {
      if (isDark) return '#1e1e1e';
      if (isInk) return '#FBF8F0';
      return '#ffffff';
    }
    if (properties.paperColor === '#ffffff' && isDark) return '#1e1e1e';
    return properties.paperColor;
  })();

  const previewLineColor = isDark ? 'rgba(255, 255, 255, 0.25)' : isInk ? 'rgba(90, 78, 66, 0.3)' : 'rgba(0, 0, 0, 0.18)';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-panvas-border-default bg-panvas-bg-elevated shadow-2xl z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-panvas-border-subtle bg-panvas-bg-elevated flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-panvas-bg-secondary border border-panvas-border-subtle text-panvas-text-primary">
                <LayoutGrid size={15} />
              </div>
              <h2 className="text-sm font-semibold text-panvas-text-primary">Note Style & Templates</h2>
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
          <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-panvas-border-subtle bg-panvas-bg-secondary/40 overflow-x-auto flex-shrink-0">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors focus-ring ${
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
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredTemplates.map((template: TemplateDefinition) => {
                const isSelected = selectedTemplate === template.id;
                return (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`group relative flex flex-col rounded-lg border p-2 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'border-panvas-accent-blue bg-panvas-accent-blue/5 shadow-md ring-2 ring-panvas-accent-blue/30'
                        : 'border-panvas-border-default bg-panvas-bg-secondary hover:border-panvas-border-strong hover:shadow-sm'
                    }`}
                  >
                    {/* Faithful Live SVG Preview Thumbnail */}
                    <div
                      className="relative w-full aspect-[3/4] rounded border border-panvas-border-subtle overflow-hidden shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: previewBgColor }}
                    >
                      <svg
                        className="w-full h-full pointer-events-none"
                        viewBox="0 0 160 213"
                        preserveAspectRatio="none"
                      >
                        {template.renderSVG(160, 213, previewLineColor, isDark)}
                      </svg>

                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-panvas-accent-blue text-white shadow">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div className="mt-2 min-w-0">
                      <div className="text-xs font-semibold text-panvas-text-primary truncate">{template.name}</div>
                      <div className="text-[10px] text-panvas-text-tertiary line-clamp-1 mt-0.5">{template.description}</div>
                    </div>
                  </div>
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
                Apply to all pages in this notebook
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
                Apply Style
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
