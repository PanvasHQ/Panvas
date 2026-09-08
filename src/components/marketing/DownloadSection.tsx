// ============================================
// Panvas — Distribution & Access Section (Cybercore Edition)
// Minimal technical specifications: Windows 10/11 x64 target + Web App direct launch
// ============================================

import React from 'react';
import { motion } from 'framer-motion';
import { PANVAS_RELEASE } from './releaseMetadata';
import { captureEvent } from '@/lib/analytics';
import { Download, ExternalLink, Github, Monitor, Globe } from 'lucide-react';
import { CrosshairTick } from './CyberOrnament';

interface DownloadSectionProps {
  onOpenWorkspace: () => void;
}

export const DownloadSection: React.FC<DownloadSectionProps> = ({ onOpenWorkspace }) => {
  return (
    <section id="download" className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden">
      
      {/* Editorial Header */}
      <div className="max-w-3xl mb-14">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#83C9EE] mb-3">
          <span>06 // ACCESS &amp; PLATFORMS</span>
        </div>
        <h2 className="font-sans text-4xl sm:text-6xl font-semibold tracking-[-0.03em] text-[#F5F7F7] mb-4 text-balance">
          Access Panvas on Windows &amp; Modern Browsers.
        </h2>
        <p className="font-sans text-base sm:text-lg text-[#B8C3CA] leading-relaxed max-w-2xl">
          Choose the desktop application for native filesystem workspace persistence and WinRT handwriting recognition, or launch the web version directly in your browser.
        </p>
      </div>

      {/* Dual Distribution Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        
        {/* Dominant: Windows Desktop Installer */}
        <div className="lg:col-span-7 p-8 sm:p-10 rounded-xl border border-[#D6DEE2]/15 bg-[#0D1115] shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex flex-col justify-between relative overflow-hidden">
          
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-[#14191F] border border-[#D6DEE2]/20 flex items-center justify-center text-[#83C9EE]">
                  <Monitor size={20} />
                </div>
                <div>
                  <h3 className="font-sans text-xl font-bold text-[#F5F7F7]">Panvas for Windows</h3>
                  <p className="font-mono text-xs text-[#83C9EE] mt-0.5">{PANVAS_RELEASE.windows.releaseTag} // x64 Windows Target</p>
                </div>
              </div>
            </div>

            <p className="font-sans text-sm text-[#B8C3CA] leading-relaxed mb-6">
              Desktop application with native filesystem workspace persistence (<code className="font-mono text-xs text-[#D6DEE2] bg-white/5 px-1.5 py-0.5 rounded">%USERPROFILE%\Documents\Panvas</code>) and WinRT handwriting-to-text recognition.
            </p>

            {/* Specifications Table */}
            <div className="p-4 rounded-lg bg-[#080A0D] border border-[#D6DEE2]/8 mb-8 font-mono text-xs text-[#98A7B1] space-y-2.5">
              <div className="flex justify-between border-b border-[#D6DEE2]/5 pb-2">
                <span className="text-[#708D9D]">Target OS:</span>
                <span className="text-[#D6DEE2]">{PANVAS_RELEASE.windows.osRequirement}</span>
              </div>
              <div className="flex justify-between border-b border-[#D6DEE2]/5 pb-2">
                <span className="text-[#708D9D]">Architecture:</span>
                <span className="text-[#D6DEE2]">{PANVAS_RELEASE.windows.architecture}</span>
              </div>
              <div className="flex justify-between border-b border-[#D6DEE2]/5 pb-2">
                <span className="text-[#708D9D]">Installer Format:</span>
                <span className="text-[#D6DEE2]">{PANVAS_RELEASE.windows.installerType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#708D9D]">Default Location:</span>
                <span className="text-[#D6DEE2]">%USERPROFILE%\Documents\Panvas</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-[#D6DEE2]/8">
            <a
              href={PANVAS_RELEASE.windows.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => captureEvent('cta_click', { placement: 'download_section_windows' })}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#EEF2F3] text-[#080A0D] border border-[#B8C3CA] hover:bg-white hover:shadow-[0_4px_24px_rgba(131,201,238,0.3)] font-sans text-xs font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
            >
              <Download size={15} />
              <span>Download Setup (.exe)</span>
            </a>

            <a
              href={PANVAS_RELEASE.windows.releaseNotesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg border border-[#B8C3CA]/25 bg-[#080A0D]/80 text-[#D6DEE2] hover:text-white hover:bg-[#14191F] font-sans text-xs font-medium transition-all"
            >
              <Github size={14} />
              <span>GitHub Releases</span>
            </a>
          </div>

        </div>

        {/* Secondary: Open Panvas Web */}
        <div className="lg:col-span-5 p-8 sm:p-10 rounded-xl border border-[#D6DEE2]/12 bg-[#0D1115] shadow-[0_24px_80px_rgba(0,0,0,0.5)] flex flex-col justify-between relative overflow-hidden">
          
          <div>
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#14191F] border border-[#D6DEE2]/20 flex items-center justify-center text-[#83C9EE]">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="font-sans text-xl font-bold text-[#F5F7F7]">Panvas Web</h3>
                <p className="font-mono text-xs text-[#83C9EE] mt-0.5">Instant Browser Access</p>
              </div>
            </div>

            <p className="font-sans text-sm text-[#B8C3CA] leading-relaxed mb-6">
              Instant browser access. Primary support for modern Chromium browsers (Chrome, Edge, Brave) with origin-scoped IndexedDB local document storage.
            </p>

            <ul className="space-y-3 font-sans text-xs text-[#98A7B1] mb-8">
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#83C9EE]" />
                <span>Origin-scoped IndexedDB local document storage</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#83C9EE]" />
                <span>Full structured notebooks &amp; Excalidraw whiteboards</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#83C9EE]" />
                <span>PDF vector annotation &amp; page audio recordings</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#708D9D]" />
                <span>Firefox &amp; Safari supported on best-effort basis</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-[#D6DEE2]/8">
            <button
              type="button"
              onClick={() => {
                captureEvent('cta_click', { placement: 'download_section_web' });
                onOpenWorkspace();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#080A0D]/80 text-[#F5F7F7] border border-[#B8C3CA]/25 backdrop-blur-lg hover:bg-[#14191F] hover:border-[#D6DEE2]/50 font-sans text-xs font-medium tracking-tight transition-all duration-200 active:scale-[0.98]"
            >
              <span>Launch Panvas Web</span>
              <ExternalLink size={14} />
            </button>
          </div>

        </div>

      </div>

      {/* Trust & Release Transparency Line */}
      <div className="rounded-lg border border-[#D6DEE2]/8 bg-[#080A0D] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[#98A7B1]">
        <div className="flex items-center gap-2.5">
          <CrosshairTick size={12} className="text-[#83C9EE]" />
          <span>{PANVAS_RELEASE.windows.checksumVerificationNote}</span>
        </div>
        <div className="flex items-center gap-6 shrink-0 text-[#708D9D] text-[11px]">
          <span>TARGET: {PANVAS_RELEASE.windows.architecture}</span>
          <span>RELEASE: {PANVAS_RELEASE.windows.releaseTag}</span>
        </div>
      </div>

    </section>
  );
};
