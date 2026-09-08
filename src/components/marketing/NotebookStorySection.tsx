// ============================================
// Panvas — Structured Notebooks Section (Cybercore Edition)
// Product-led asymmetric stage: Large off-center Library visual + scientific diagram callout lines
// ============================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MOTION_TIMINGS } from './cybercoreTokens';
import { CrosshairTick } from './CyberOrnament';

export const NotebookStorySection: React.FC = () => {
  const [activeView, setActiveView] = useState<'templates' | 'covers'>('templates');

  return (
    <section id="notebooks" className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden">
      
      {/* Editorial Header */}
      <div className="max-w-3xl mb-14">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#83C9EE] mb-3">
          <span>01 // HIERARCHICAL ORGANIZATION</span>
        </div>
        <h2 className="font-sans text-4xl sm:text-6xl font-semibold tracking-[-0.03em] text-[#F5F7F7] mb-4 text-balance">
          Structure when you need it.
        </h2>
        <p className="font-sans text-base sm:text-lg text-[#B8C3CA] leading-relaxed max-w-2xl">
          Escape the chaos of single-page scratchpads. Panvas organizes your research, derivations, and systems notes into a structured 5-tier workspace hierarchy.
        </p>
      </div>

      {/* Main Dominant Product Showcase (occupying 80% width with scientific annotations) */}
      <div className="relative rounded-xl border border-[#D6DEE2]/12 bg-[#0D1115] shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden">
        
        {/* Top Control Header */}
        <div className="bg-[#14191F] border-b border-[#D6DEE2]/8 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-xs text-[#B8C3CA]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#83C9EE]" />
            <span>PANVAS LIBRARY &amp; PAPER TEMPLATES</span>
          </div>

          {/* Minimalist Switcher */}
          <div className="inline-flex rounded-md bg-[#080A0D] p-0.5 border border-[#D6DEE2]/15 text-xs">
            <button
              type="button"
              onClick={() => setActiveView('templates')}
              className={`px-3 py-1 rounded font-sans text-xs transition-all ${
                activeView === 'templates'
                  ? 'bg-[#EEF2F3] text-[#080A0D] font-semibold shadow-sm'
                  : 'text-[#B8C3CA] hover:text-[#F5F7F7]'
              }`}
            >
              Paper &amp; Note Templates
            </button>
            <button
              type="button"
              onClick={() => setActiveView('covers')}
              className={`px-3 py-1 rounded font-sans text-xs transition-all ${
                activeView === 'covers'
                  ? 'bg-[#EEF2F3] text-[#080A0D] font-semibold shadow-sm'
                  : 'text-[#B8C3CA] hover:text-[#F5F7F7]'
              }`}
            >
              Notebook Covers &amp; Binding
            </button>
          </div>
        </div>

        {/* Product Visual Stage */}
        <div className="p-4 sm:p-8 bg-[#080A0D] flex items-center justify-center min-h-[460px]">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: MOTION_TIMINGS.easeEditorial }}
            className="w-full flex items-center justify-center"
          >
            <img
              src={
                activeView === 'templates'
                  ? '/app-screenshots/NotebookStyle_Template.png'
                  : '/app-screenshots/CustomizeYourNotebook.png'
              }
              alt={
                activeView === 'templates'
                  ? 'Panvas Note Style & Paper Templates Modal'
                  : 'Panvas Customize Your Notebook Modal'
              }
              className="w-full h-auto rounded-lg object-contain max-h-[580px] shadow-2xl border border-white/8"
              loading="lazy"
            />
          </motion.div>
        </div>

        {/* Scientific Diagram Annotations (Thin hairline dividers, no boxes) */}
        <div className="bg-[#0D1115] border-t border-[#D6DEE2]/8 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-[#B8C3CA]">
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">01.A</span>
              <span>5-Tier Workspace Hierarchy</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              <code className="font-mono text-2xs bg-white/5 px-1 py-0.5 rounded text-[#D6DEE2]">Workspace → Folder → Notebook → Section → Page</code> to maintain project modularity.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">01.B</span>
              <span>Technical Paper Templates</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Cornell notes, engineering grid, lined, and dot matrix layouts adapted for mathematical calculations and lecture summaries.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">01.C</span>
              <span>Tactile Covers &amp; Rich Prose</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Leather, linen, midnight, and custom artwork covers paired with native KaTeX formula typesetting and syntax-highlighted code blocks.
            </p>
          </div>

        </div>

      </div>

    </section>
  );
};
