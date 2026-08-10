// ============================================
// Panvas — Notebook Page Renderer
// ============================================

import React from 'react';
import type { PageProperties } from './engine/drawingTypes';
import { TEMPLATE_REGISTRY } from './templates/TemplateRegistry.tsx';
import { useUIStore } from '@/stores/uiStore';

export interface PageRendererProps {
  id: string;
  width: number;
  height: number;
  properties: PageProperties;
  className?: string;
  children?: React.ReactNode;
  pageNumberText?: string;
}

export const PageRenderer: React.FC<PageRendererProps> = ({ id, width, height, properties, className = '', children, pageNumberText }) => {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const isInk = theme === 'ink';

  const { template, margins, paperColor, ruleLineColor } = properties;

  // Scale relative to default A4 width (794px in portrait, 1123px in landscape)
  const baseWidth = properties.orientation === 'landscape' ? 1123 : 794;
  const scale = width / baseWidth;

  // Margin insets based on selection
  const getMarginInset = () => {
    if (margins === 'No Margin') return 0;
    let baseInset = 64; // Normal (~8%)
    if (margins === 'Narrow') baseInset = 32; // Narrow (~4%)
    if (margins === 'Wide') baseInset = 104; // Wide (~13%)
    return Math.round(baseInset * scale);
  };

  const marginInset = getMarginInset();

  // Resolve effective paper background color
  const resolvePaperColor = () => {
    if (!paperColor || paperColor === 'default') {
      if (isDark) return '#1e1e1e';
      if (isInk) return '#FBF8F0';
      return '#ffffff';
    }
    // If the paperColor is plain white and we are in dark theme without custom override,
    // ensure dark mode users get a dark canvas paper surface
    if (paperColor === '#ffffff' && isDark) {
      return '#1e1e1e';
    }
    return paperColor;
  };

  const effectiveBgColor = resolvePaperColor();

  // Resolve rule/grid line color for readability against effective background
  const resolveLineColor = () => {
    if (ruleLineColor && ruleLineColor !== '#e0e0e0') {
      return ruleLineColor;
    }
    if (isDark && (effectiveBgColor === '#1e1e1e' || effectiveBgColor === '#181818' || effectiveBgColor === '#232323')) {
      return 'rgba(255, 255, 255, 0.18)';
    }
    if (isInk) {
      return 'rgba(90, 78, 66, 0.22)';
    }
    return 'rgba(0, 0, 0, 0.12)';
  };

  const effectiveLineColor = resolveLineColor();

  // Retrieve template definition from registry
  const templateDef = TEMPLATE_REGISTRY[template] || TEMPLATE_REGISTRY.Blank;

  return (
    <div
      id={`page-${id}`}
      className={`relative shadow-2xl transition-colors duration-200 overflow-hidden ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: effectiveBgColor,
      }}
    >
      {/* Background Template SVG Layer */}
      <svg 
        className="absolute inset-0 pointer-events-none select-none"
        width={width} 
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%' }}
      >
        {templateDef.renderSVG(width, height, effectiveLineColor, isDark)}
      </svg>

      {/* Visual Margin Guidelines */}
      {marginInset > 0 && (
        <div 
          className="absolute pointer-events-none transition-all duration-200 border border-dashed"
          style={{
            left: `${marginInset}px`,
            top: `${marginInset}px`,
            width: `${Math.max(10, width - marginInset * 2)}px`,
            height: `${Math.max(10, height - marginInset * 2)}px`,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Structured Content & Drawing Layer */}
      {children}

      {/* Page Number Indicator */}
      {pageNumberText && (
        <div 
          className="absolute bottom-3 right-4 text-[11px] font-mono font-medium pointer-events-none select-none text-panvas-text-tertiary"
          style={{ opacity: 0.75 }}
        >
          {pageNumberText}
        </div>
      )}
    </div>
  );
};
