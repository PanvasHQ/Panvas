// ============================================
// Panvas — Marketing Footer (Cybercore Edition)
// Major negative space, large subtle silver brandmark, original cyber-organic flourish
// ============================================

import React from 'react';
import { Link } from 'wouter';
import { PANVAS_RELEASE } from './releaseMetadata';
import { ArrowUpRight } from 'lucide-react';
import { CyberVectorFlourish, CrosshairTick } from './CyberOrnament';

export const MarketingFooter: React.FC = () => {
  return (
    <footer className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden text-[#B8C3CA]" role="contentinfo">
      
      {/* Background Subtle Cyber-Organic Flourish Artwork */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[800px] h-[300px] pointer-events-none opacity-20 select-none" aria-hidden="true">
        <CyberVectorFlourish opacity={0.3} />
      </div>

      <div className="relative z-10">
        
        {/* Top: Large Brand Identity & Vision */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-10 pb-16 border-b border-[#D6DEE2]/10">
          
          <div className="space-y-4 max-w-lg">
            <div className="flex items-center gap-3">
              <img
                src="/panvas_logo.png"
                alt="Panvas Brandmark"
                className="h-8 w-auto object-contain opacity-90"
              />
              <span className="font-sans text-2xl font-bold tracking-tight text-[#F5F7F7]">
                Panvas
              </span>
            </div>
            <p className="font-sans text-sm text-[#98A7B1] leading-relaxed">
              The local-first visual research workspace where structured notebooks, vector handwriting, PDF annotation, infinite canvas, and technical thinking live together.
            </p>
          </div>

          {/* Clean Horizontal Navigation */}
          <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 font-sans text-sm text-[#D6DEE2]">
            <a href="#notebooks" className="hover:text-white transition-colors">Notebooks</a>
            <a href="#ink" className="hover:text-white transition-colors">Vector Ink</a>
            <a href="#pdf" className="hover:text-white transition-colors">PDF Workbench</a>
            <a href="#canvas" className="hover:text-white transition-colors">Infinite Canvas</a>
            <a href="#local-first" className="hover:text-white transition-colors">Local-First</a>
            <Link href="/roadmap" className="hover:text-white transition-colors">Roadmap</Link>
            <a
              href={PANVAS_RELEASE.project.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <span>GitHub</span>
              <ArrowUpRight size={13} className="opacity-60" />
            </a>
          </nav>

        </div>

        {/* Middle: Legal and Trust Links */}
        <div className="py-8 flex flex-wrap items-center justify-between gap-6 font-sans text-xs text-[#708D9D] border-b border-[#D6DEE2]/6">
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[#D6DEE2] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#D6DEE2] transition-colors">Terms of Service</Link>
            <Link href="/security" className="hover:text-[#D6DEE2] transition-colors">Security Architecture</Link>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <span>{PANVAS_RELEASE.project.license}</span>
            <span>BUILD: {PANVAS_RELEASE.windows.releaseTag}</span>
          </div>
        </div>

        {/* Bottom Technical Metadata Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-[#536D7C]">
          <p>© {PANVAS_RELEASE.project.year} Panvas. Your device remains the source of truth.</p>
          <div className="flex items-center gap-4">
            <CrosshairTick size={10} className="text-[#708D9D]" />
            <span>CANONICAL STORAGE: LOCAL FILESYSTEM &amp; DEXIE IDB</span>
          </div>
        </div>

      </div>

    </footer>
  );
};
