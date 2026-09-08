// ============================================
// Panvas — Capability Ticker (Cybercore Edition)
// Continuous marquee showcasing core visual research tools & features
// ============================================

import React from 'react';
import { CAPABILITIES } from './marketingTokens';

export const CapabilityTicker: React.FC = () => {
  // Duplicate list to achieve seamless infinite scroll
  const duplicatedCapabilities = [...CAPABILITIES, ...CAPABILITIES];

  return (
    <section className="relative z-30 py-4 max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8" aria-label="System Capabilities">
      <div className="group relative flex overflow-hidden rounded-lg bg-[#0D1115]/80 backdrop-blur-xl border border-[#D6DEE2]/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] py-2.5">
        {/* Left & Right gradient fade masks */}
        <div className="absolute inset-y-0 left-0 w-16 sm:w-28 bg-gradient-to-r from-[#050709] to-transparent z-10 pointer-events-none rounded-l-lg" />
        <div className="absolute inset-y-0 right-0 w-16 sm:w-28 bg-gradient-to-l from-[#050709] to-transparent z-10 pointer-events-none rounded-r-lg" />

        <div className="flex w-max animate-ticker-scroll group-hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] items-center">
          {duplicatedCapabilities.map((cap, i) => (
            <div key={i} className="flex items-center">
              <div
                className="flex items-center gap-2 px-3 py-1 rounded text-[#B8C3CA] text-xs font-medium tracking-tight transition-colors cursor-default hover:text-white hover:bg-white/5 select-none"
              >
                <span className="text-[#83C9EE] opacity-80">{cap.icon}</span>
                <span>{cap.label}</span>
              </div>
              <span className="text-[#B8C3CA]/20 mx-2 text-[10px] select-none" aria-hidden="true">
                ✦
              </span>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker-scroll {
          animation: ticker-scroll 45s linear infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-ticker-scroll {
            animation: none;
          }
        }
      `}} />
    </section>
  );
};
