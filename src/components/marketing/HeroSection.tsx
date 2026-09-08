// ============================================
// Panvas — Hero Section (Cybercore Edition)
// Product-first asymmetric stage: Neo-Grotesk display, massive workspace, floating real UI fragment
// ============================================

import React from 'react';
import { motion } from 'framer-motion';
import { PANVAS_RELEASE } from './releaseMetadata';
import { CYBER_MATERIALS, MOTION_TIMINGS } from './cybercoreTokens';
import { captureEvent } from '@/lib/analytics';
import { Download, ArrowRight, HardDrive, BookOpen, FileText, Compass } from 'lucide-react';
import { CyberVectorFlourish, CrosshairTick } from './CyberOrnament';

interface HeroSectionProps {
  onOpenWorkspace: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenWorkspace }) => {
  return (
    <section className="relative min-h-[95vh] pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto flex flex-col justify-between overflow-hidden">
      
      {/* Subtle original cyber-organic vector flourish in top-right background */}
      <div className="absolute top-12 right-0 w-[500px] h-[200px] pointer-events-none opacity-40 hidden lg:block">
        <CyberVectorFlourish opacity={0.35} />
      </div>

      {/* Hero Top Asymmetric Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end mb-12 relative z-10">
        
        {/* Left: Main Editorial Proposition */}
        <div className="lg:col-span-8">
          
          {/* Micro Release Badge */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: MOTION_TIMINGS.easeEditorial }}
            className="inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-md border border-[#B8C3CA]/15 bg-[#0D1115]/80 backdrop-blur-md"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#79DDBD]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#D6DEE2]">
              {PANVAS_RELEASE.windows.releaseTag} // LOCAL-FIRST VISUAL WORKSPACE
            </span>
          </motion.div>

          {/* Primary Headline: Neo-Grotesk Display */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: MOTION_TIMINGS.easeEditorial }}
            className="font-sans text-5xl sm:text-7xl lg:text-8xl font-semibold tracking-[-0.035em] text-[#F5F7F7] leading-[0.95] mb-5 text-balance"
          >
            Think. Sketch.<br />
            <span className="text-[#B8C3CA]">Write. Build.</span>
          </motion.h1>

          {/* Supporting Statement */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: MOTION_TIMINGS.easeEditorial }}
            className="font-sans text-base sm:text-lg text-[#B8C3CA] max-w-2xl leading-relaxed text-balance"
          >
            The local-first visual research workspace for technical thinkers. Structured notebooks, vector ink, PDF markup, and infinite Excalidraw canvas on your terms.
          </motion.p>

        </div>

        {/* Right: Dual CTAs + Micro Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: MOTION_TIMINGS.easeEditorial }}
          className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-end items-start lg:items-end"
        >
          {/* Primary CTA: Get Windows Installer */}
          <a
            href="#download"
            onClick={(e) => {
              e.preventDefault();
              captureEvent('cta_click', { placement: 'hero_download_windows' });
              const el = document.querySelector('#download');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto lg:w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#EEF2F3] text-[#080A0D] border border-[#B8C3CA] hover:bg-white hover:shadow-[0_4px_24px_rgba(131,201,238,0.3)] font-sans text-xs font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <Download size={15} />
            <span>Download for Windows (x64)</span>
          </a>

          {/* Secondary CTA: Launch Web App */}
          <button
            type="button"
            onClick={() => {
              captureEvent('cta_click', { placement: 'hero_open_web' });
              onOpenWorkspace();
            }}
            className="w-full sm:w-auto lg:w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#080A0D]/80 text-[#F5F7F7] border border-[#B8C3CA]/25 backdrop-blur-lg hover:bg-[#14191F] hover:border-[#D6DEE2]/50 font-sans text-xs font-medium tracking-tight transition-all duration-200 active:scale-[0.98]"
          >
            <span>Open in Browser</span>
            <ArrowRight size={14} className="opacity-70" />
          </button>
        </motion.div>

      </div>

      {/* ===== Main Product Stage: Real Application Workspace ===== */}
      <motion.div
        initial={{ opacity: 0.75, scale: 1.012 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.35, ease: MOTION_TIMINGS.easeEditorial }}
        className="w-full relative max-w-7xl mx-auto mt-4"
      >
        
        {/* Floating Hardware Toolbar Cutout Accent (Entering from upper right) */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: MOTION_TIMINGS.easeEditorial }}
          className="absolute -top-6 right-4 sm:right-8 z-30 hidden sm:flex items-center gap-2 p-1.5 rounded-xl border border-[#D6DEE2]/20 bg-[#0D1115]/90 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
        >
          <img
            src="/app-screenshots/ToolBar.png"
            alt="Panvas Real Hardware Drawing Toolbar"
            className="h-8 w-auto object-contain rounded-md"
          />
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#83C9EE] pr-2">
            ● 2D INK ENGINE
          </span>
        </motion.div>

        {/* Application Window Frame */}
        <div className="relative rounded-xl border border-[#D6DEE2]/12 bg-[#0D1115] shadow-[0_32px_90px_rgba(0,0,0,0.75)] overflow-hidden group">
          
          {/* Window Chrome Header */}
          <div className="h-9 bg-[#14191F] border-b border-[#D6DEE2]/8 px-4 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            </div>

            <div className="font-mono text-[11px] text-[#B8C3CA] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#79DDBD]" />
              <span>Panvas Workspace — Engineering Research Notes</span>
            </div>

            <div className="font-mono text-[10px] text-[#708D9D] hidden sm:block">
              STORAGE: LOCAL FILESYSTEM
            </div>
          </div>

          {/* Screenshot Presentation */}
          <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-[#050709]">
            <img
              src="/app-screenshots/HeroResearchWorkSpace.png"
              alt="Panvas Visual Research Workspace application interface showing notebooks, diagrams, and code"
              className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.008]"
              loading="eager"
            />
            {/* Subtle inner specular highlight overlay */}
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />
          </div>

          {/* Bottom Technical Ribbon */}
          <div className="bg-[#0F141A] border-t border-[#D6DEE2]/8 px-4 py-2 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#98A7B1]">
            <div className="flex items-center gap-3">
              <span className="text-[#79DDBD]">● CANONICAL LOCAL STORAGE</span>
              <span>INDEXEDDB &amp; LOCAL FILESYSTEM</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#83C9EE]">ZERO MANDATORY ACCOUNTS</span>
            </div>
          </div>

        </div>

      </motion.div>

    </section>
  );
};
