// ============================================
// Panvas — Local-First Storage & Data Sovereignty Section (Cybercore Edition)
// Major visual transition: Frost-White / Pale Metal section with real CloudSync interface
// ============================================

import React from 'react';
import { motion } from 'framer-motion';
import { CrosshairTick } from './CyberOrnament';

export const LocalFirstSection: React.FC = () => {
  return (
    <section id="local-first" className="relative py-32 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden">
      
      {/* High-Contrast Frost White / Pale Metal Surface Container */}
      <div className="relative rounded-2xl bg-[#EEF2F3] text-[#080A0D] p-8 sm:p-14 lg:p-18 shadow-[0_32px_90px_rgba(0,0,0,0.45)] border border-[#D6DEE2] overflow-hidden">
        
        {/* Subtle background ambient optical wash */}
        <div
          className="absolute -top-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full pointer-events-none opacity-40 blur-[90px]"
          style={{
            background: 'radial-gradient(circle, #C8EAFA 0%, #B8C3CA 60%, transparent 80%)',
          }}
        />

        {/* Section Header */}
        <div className="max-w-3xl mb-14 relative z-10">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#536D7C] mb-3">
            <span>05 // DATA SOVEREIGNTY ARCHITECTURE</span>
          </div>
          <h2 className="font-sans text-4xl sm:text-6xl font-semibold tracking-[-0.035em] text-[#080A0D] mb-4 text-balance">
            Your device stays in charge.
          </h2>
          <p className="font-sans text-base sm:text-lg text-[#536D7C] leading-relaxed max-w-2xl">
            Panvas operates with your machine as the canonical authority. Notes and sketches persist directly to your local filesystem or IndexedDB with zero mandatory accounts and optional personal Google Drive synchronization.
          </p>
        </div>

        {/* Real Cloud Sync Application Screenshot Showcase */}
        <div className="relative rounded-xl border border-[#B8C3CA]/80 bg-[#080A0D] shadow-[0_20px_60px_rgba(8,10,13,0.3)] overflow-hidden mb-12">
          
          {/* Top Window Strip */}
          <div className="bg-[#14191F] border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between text-white select-none">
            <div className="flex items-center gap-2 font-mono text-xs text-[#D6DEE2]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#79DDBD]" />
              <span>CLOUD SYNC &amp; STORAGE AUTHORITY PREFERENCES</span>
            </div>
            <div className="font-mono text-[10px] text-[#83C9EE] bg-[#83C9EE]/10 border border-[#83C9EE]/20 px-2 py-0.5 rounded">
              DIRECT USER OAUTH ADAPTER
            </div>
          </div>

          {/* Center Stage: Real Cloud Sync Screenshot */}
          <div className="p-4 sm:p-8 bg-[#050709] flex items-center justify-center min-h-[440px]">
            <div className="w-full max-w-4xl flex items-center justify-center">
              <img
                src="/app-screenshots/CloudSync.png"
                alt="Panvas Cloud Sync and Storage Configuration Interface"
                className="w-full h-auto rounded-lg object-contain max-h-[520px] shadow-2xl border border-white/10"
                loading="lazy"
              />
            </div>
          </div>

        </div>

        {/* Minimalist Scientific Architecture Annotations (No 4-card grid!) */}
        <div className="pt-6 border-t border-[#B8C3CA]/60 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-[#536D7C]">
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#080A0D] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#536D7C]">05.A</span>
              <span>Local Filesystem &amp; IndexedDB</span>
            </div>
            <p className="leading-relaxed text-[#536D7C]">
              Direct filesystem persistence on Windows (<code className="font-mono text-2xs bg-black/5 px-1 py-0.5 rounded text-[#080A0D]">Documents/Panvas/</code>) and origin-scoped Dexie IndexedDB in browsers.
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#B8C3CA]/60 md:pl-8">
            <div className="flex items-center gap-2 text-[#080A0D] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#536D7C]">05.B</span>
              <span>Optional Google Drive Sync</span>
            </div>
            <p className="leading-relaxed text-[#536D7C]">
              Direct OAuth (PKCE on desktop, Google Identity Services on web) requesting strictly <code className="font-mono text-2xs bg-black/5 px-1 py-0.5 rounded text-[#080A0D]">drive.file</code> scope with zero intermediary Panvas servers (runtime certification in progress).
            </p>
          </div>

          <div className="space-y-1.5 md:border-l md:border-[#B8C3CA]/60 md:pl-8">
            <div className="flex items-center gap-2 text-[#080A0D] font-sans font-semibold text-sm">
              <span className="font-mono text-[10px] text-[#536D7C]">05.C</span>
              <span>Workspace Backup &amp; Restore</span>
            </div>
            <p className="leading-relaxed text-[#536D7C]">
              Export and restore complete workspaces in standard JSON archive format, keeping your research portable across environments.
            </p>
          </div>

        </div>

      </div>

    </section>
  );
};
