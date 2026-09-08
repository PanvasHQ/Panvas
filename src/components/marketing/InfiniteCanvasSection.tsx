// ============================================
// Panvas — Infinite Canvas Section (Cybercore Edition)
// Spatial expansive stage: Real Local Elements & Audio recording widgets with cyber-organic ribbon
// ============================================

import React from 'react';
import { motion } from 'framer-motion';
import { CyberVectorFlourish, CrosshairTick } from './CyberOrnament';

export const InfiniteCanvasSection: React.FC = () => {
  return (
    <section id="canvas" className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden">
      
      {/* Translucent blue vector ribbon crossing behind */}
      <div className="absolute top-1/3 -right-24 w-[700px] h-[280px] pointer-events-none opacity-20 hidden lg:block">
        <CyberVectorFlourish opacity={0.3} />
      </div>

      {/* Editorial Header */}
      <div className="max-w-3xl mb-14 relative z-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#83C9EE] mb-3">
          <span>04 // SPATIAL WHITEBOARD CANVAS</span>
        </div>
        <h2 className="font-sans text-4xl sm:text-6xl font-semibold tracking-[-0.03em] text-[#F5F7F7] mb-4 text-balance">
          When the page runs out, keep going.
        </h2>
        <p className="font-sans text-base sm:text-lg text-[#B8C3CA] leading-relaxed max-w-2xl">
          When technical thoughts exceed linear margins, Panvas provides an infinite 2D canvas powered by Excalidraw with embedded local sticky notes and page-anchored voice recordings.
        </p>
      </div>

      {/* Dominant Spatial Canvas Showcase */}
      <div className="relative rounded-xl border border-[#D6DEE2]/12 bg-[#0D1115] shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden">
        
        {/* Top Control Header */}
        <div className="bg-[#14191F] border-b border-[#D6DEE2]/8 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs text-[#B8C3CA]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#83C9EE]" />
            <span>EXCALIDRAW CORE &amp; REUSABLE LOCAL ELEMENTS</span>
          </div>
          <div className="font-mono text-[10px] text-[#83C9EE] bg-[#83C9EE]/10 border border-[#83C9EE]/20 px-2 py-0.5 rounded">
            UNCONSTRAINED 2D SPACE
          </div>
        </div>

        {/* Spatial Stage: Real Local Sticky Notes + Voice Notes Audio Recording */}
        <div className="p-6 sm:p-12 bg-[#080A0D] flex flex-col md:flex-row items-center justify-center gap-8 min-h-[480px]">
          
          {/* Real Local Sticky Notes Widget */}
          <div className="w-full md:w-1/2 flex items-center justify-center">
            <div className="rounded-lg overflow-hidden border border-[#D6DEE2]/15 bg-[#14191F] shadow-2xl p-2 max-w-md w-full">
              <img
                src="/app-screenshots/StickyNotes.png"
                alt="Panvas Local Elements and Sticky Notes palette"
                className="w-full h-auto rounded object-contain"
                loading="lazy"
              />
            </div>
          </div>

          {/* Real Page Audio Recording Widget */}
          <div className="w-full md:w-1/2 flex items-center justify-center">
            <div className="rounded-lg overflow-hidden border border-[#D6DEE2]/15 bg-[#14191F] shadow-2xl p-2 max-w-md w-full">
              <img
                src="/app-screenshots/Voice_Notes.png"
                alt="Panvas Voice Notes recording and playback widget"
                className="w-full h-auto rounded object-contain"
                loading="lazy"
              />
            </div>
          </div>

        </div>

        {/* Scientific Annotations */}
        <div className="bg-[#0D1115] border-t border-[#D6DEE2]/8 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-[#B8C3CA]">
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">04.A</span>
              <span>Freeform System Architecture</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Design distributed services, entity-relationship diagrams, and state machines on an infinite vector canvas.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">04.B</span>
              <span>Reusable Local Elements</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Save sticky notes, custom engineering stamps, and schematic components into your local workspace library for quick placement.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">04.C</span>
              <span>Page-Anchored Audio Notes</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Record spoken walkthroughs and experimental observations directly attached to your canvas and notebook pages.
            </p>
          </div>

        </div>

      </div>

    </section>
  );
};
