// ============================================
// Panvas — Vector Ink Section (Cybercore Edition)
// Digital instrument aesthetic: Real handwriting canvas with floating real tool fragments & pressure ribbon
// ============================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MOTION_TIMINGS } from './cybercoreTokens';
import { CyberVectorFlourish, CrosshairTick } from './CyberOrnament';

export const VectorInkSection: React.FC = () => {
  const [activeFragment, setActiveFragment] = useState<'stationery' | 'gestures'>('stationery');

  return (
    <section id="ink" className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden">
      
      {/* Subtle faint pressure-sensitive vector ribbon crossing behind */}
      <div className="absolute top-1/2 -left-20 w-[650px] h-[260px] pointer-events-none opacity-25">
        <CyberVectorFlourish opacity={0.3} />
      </div>

      {/* Editorial Header */}
      <div className="max-w-3xl mb-14 relative z-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#83C9EE] mb-3">
          <span>02 // VECTOR INK &amp; RECOGNITION</span>
        </div>
        <h2 className="font-sans text-4xl sm:text-6xl font-semibold tracking-[-0.03em] text-[#F5F7F7] mb-4 text-balance">
          Ink that feels native.
        </h2>
        <p className="font-sans text-base sm:text-lg text-[#B8C3CA] leading-relaxed max-w-2xl">
          Draw schematics, derivations, and margin notes with hardware-accelerated vector strokes, and convert handwritten notes into editable text on Windows desktop.
        </p>
      </div>

      {/* Dominant Visual with Floating Product Fragments */}
      <div className="relative rounded-xl border border-[#D6DEE2]/12 bg-[#0D1115] shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden">
        
        {/* Top Hardware Toolbar Banner */}
        <div className="bg-[#14191F] border-b border-[#D6DEE2]/8 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/app-screenshots/ToolBar.png"
              alt="Panvas Hardware Vector Toolbar"
              className="h-8 sm:h-9 w-auto object-contain rounded-md shadow-sm border border-white/10"
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#83C9EE] hidden md:inline">
              ● HARDWARE-ACCELERATED TOOLBAR
            </span>
          </div>

          <div className="inline-flex rounded-md bg-[#080A0D] p-0.5 border border-[#D6DEE2]/15 text-xs">
            <button
              type="button"
              onClick={() => setActiveFragment('stationery')}
              className={`px-3 py-1 rounded font-sans text-xs transition-all ${
                activeFragment === 'stationery'
                  ? 'bg-[#EEF2F3] text-[#080A0D] font-semibold shadow-sm'
                  : 'text-[#B8C3CA] hover:text-[#F5F7F7]'
              }`}
            >
              Stylus &amp; Stroke Dynamics
            </button>
            <button
              type="button"
              onClick={() => setActiveFragment('gestures')}
              className={`px-3 py-1 rounded font-sans text-xs transition-all ${
                activeFragment === 'gestures'
                  ? 'bg-[#EEF2F3] text-[#080A0D] font-semibold shadow-sm'
                  : 'text-[#B8C3CA] hover:text-[#F5F7F7]'
              }`}
            >
              Canvas Gestures
            </button>
          </div>
        </div>

        {/* Center Stage: Real Handwriting Canvas + Floating Interactive Fragment */}
        <div className="p-4 sm:p-8 bg-[#080A0D] relative flex flex-col lg:flex-row items-center justify-center gap-8 min-h-[480px]">
          
          {/* Dominant Handwriting Screenshot */}
          <div className="w-full lg:w-2/3 flex items-center justify-center">
            <img
              src="/app-screenshots/Turn_Handwriting_into_text.png"
              alt="Panvas Handwriting to Text Canvas interface with vector drawing"
              className="w-full h-auto rounded-lg object-contain max-h-[560px] shadow-2xl border border-white/8"
              loading="lazy"
            />
          </div>

          {/* Floating Settings Cutout */}
          <div className="w-full lg:w-1/3 flex flex-col items-center justify-center">
            <motion.div
              key={activeFragment}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: MOTION_TIMINGS.easeEditorial }}
              className="w-full max-w-sm rounded-lg overflow-hidden border border-[#D6DEE2]/15 bg-[#14191F] shadow-2xl p-2"
            >
              <img
                src={
                  activeFragment === 'stationery'
                    ? '/app-screenshots/PreferenceStationary.png'
                    : '/app-screenshots/InkGestures.png'
                }
                alt={
                  activeFragment === 'stationery'
                    ? 'Stylus Stationery, Smoothing, and Ruler Settings'
                    : 'Ink Gestures Sheet'
                }
                className="w-full h-auto rounded object-contain"
                loading="lazy"
              />
            </motion.div>
          </div>

        </div>

        {/* Scientific Annotations (Hairline layout, no cards) */}
        <div className="bg-[#0D1115] border-t border-[#D6DEE2]/8 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-[#B8C3CA]">
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">02.A</span>
              <span>Windows Handwriting to Text</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Windows desktop builds feature native Windows Ink / WinRT handwriting recognition to convert handwritten margin notes into editable text.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">02.B</span>
              <span>Stylus Dynamics &amp; Ruler</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Calibrate stroke thickness, opacity, stabilization, pressure curves, and precision angle snapping with the digital drafting ruler.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#D6DEE2]/8 md:pl-8">
            <div className="flex items-center gap-2 text-[#F5F7F7] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#83C9EE]">02.C</span>
              <span>Heuristic Gesture Shortcuts</span>
            </div>
            <p className="leading-relaxed text-[#98A7B1]">
              Scribble-to-erase, circle-to-select, straight-line snap, and rough-shape conversion for circles, ellipses, rectangles, and squares.
            </p>
          </div>

        </div>

      </div>

    </section>
  );
};
