// ============================================
// Panvas — PDF Workbench Section (Cybercore Edition)
// Product poster composition: Dominant PDF markup stage, single red calibration mark, minimal copy
// ============================================

import React from 'react';
import { motion } from 'framer-motion';
import { CrosshairTick } from './CyberOrnament';

export const PdfWorkbenchSection: React.FC = () => {
  return (
    <section id="pdf" className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden">
      
      {/* Editorial Header */}
      <div className="max-w-3xl mb-14">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#83C9EE] mb-3">
          <span>03 // PDF RESEARCH WORKBENCH</span>
        </div>
        <h2 className="font-sans text-4xl sm:text-6xl font-semibold tracking-[-0.03em] text-[#F5F7F7] mb-4 text-balance">
          Read. Mark up. Keep moving.
        </h2>
        <p className="font-sans text-base sm:text-lg text-[#B8C3CA] leading-relaxed max-w-2xl">
          Integrated offline PDF.js rendering directly inside your notebooks. Draw vector annotations and export single pages or complete notebooks back to PDF.
        </p>
      </div>

      {/* Dominant Product Poster Showcase */}
      <div className="relative rounded-xl border border-[#D6DEE2]/12 bg-[#0D1115] shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden">
        
        {/* Top Control Header */}
        <div className="bg-[#14191F] border-b border-[#D6DEE2]/8 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs text-[#B8C3CA]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#83C9EE]" />
            <span>OFFLINE PDF.JS RENDERER // LOCAL FILE AUTHORITY</span>
          </div>
          
          {/* Single subtle scientific calibration red mark */}
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#EE5B5B] bg-[#EE5B5B]/10 border border-[#EE5B5B]/20 px-2 py-0.5 rounded">
            <span>● 1:1 VECTOR REPRODUCTION</span>
          </div>
        </div>

        {/* Center Stage: Real Export / Markup Screenshot */}
        <div className="p-4 sm:p-8 bg-[#080A0D] flex items-center justify-center min-h-[440px] relative">
          
          <div className="w-full max-w-4xl flex items-center justify-center">
            <img
              src="/app-screenshots/printNotes_ExportPDF.png"
              alt="Panvas PDF Workbench Export Dropdown and Markup Options"
              className="w-full h-auto rounded-lg object-contain max-h-[520px] shadow-2xl border border-white/8"
              loading="lazy"
            />
          </div>

          {/* Tiny scientific diagram marker tick in corner */}
          <div className="absolute bottom-4 right-4 hidden sm:block">
            <CrosshairTick size={14} className="text-[#B8C3CA]/30" />
          </div>
        </div>

        {/* Scientific Annotations */}
        <div className="bg-[#0D1115] border-t border-[#D6DEE2]/8 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-[#B8C3CA]">
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">03.A</span>
              <span>Local Offline Rendering</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Powered by local PDF.js. Sensitive research papers and textbooks render completely on your device without transmitting document streams to third parties.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">03.B</span>
              <span>Page Thumbnails &amp; Rotation</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Navigate multi-page documents via thumbnail sidebar and rotate scans (90°/180°/270°) with non-destructive coordinate preservation.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">03.C</span>
              <span>Export Page or Notebook to PDF</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Export annotated single pages or complete structured notebooks back to standardized PDF documents for academic hand-in or publishing.
            </p>
          </div>

        </div>

      </div>

    </section>
  );
};
