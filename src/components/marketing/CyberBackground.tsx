// ============================================
// Panvas — Cybercore Atmospheric Background System
// Frosted optical fields, subtle iridescent light drift, zero website grid
// ============================================

import React from 'react';

export const CyberBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none" aria-hidden="true">
      
      {/* Base deep cybercore black/slate background */}
      <div className="absolute inset-0 bg-[#050709]" />

      {/* Atmospheric Optical Field 1: Top-Right Pale Icy Light Leak */}
      <div
        className="absolute -top-[10%] right-[5%] w-[70vw] max-w-[900px] h-[60vh] max-h-[700px] rounded-full opacity-[0.07] blur-[120px]"
        style={{
          background: 'radial-gradient(ellipse at center, #83C9EE 0%, #B8C3CA 45%, transparent 70%)',
        }}
      />

      {/* Atmospheric Optical Field 2: Left-Center Ethereal Iridescent Wash */}
      <div
        className="absolute top-[35%] -left-[15%] w-[60vw] max-w-[800px] h-[70vh] rounded-full opacity-[0.04] blur-[140px]"
        style={{
          background: 'radial-gradient(circle at center, #D8C3D4 0%, #A7D9F2 50%, transparent 75%)',
        }}
      />

      {/* Atmospheric Optical Field 3: Bottom-Center Pale Steel Blue Ambient Floor */}
      <div
        className="absolute bottom-[5%] left-[20%] w-[60vw] max-w-[850px] h-[40vh] rounded-full opacity-[0.05] blur-[100px]"
        style={{
          background: 'radial-gradient(ellipse at center, #708D9D 0%, #536D7C 50%, transparent 80%)',
        }}
      />

      {/* Ultra-subtle scan / grain film (1.5% opacity) */}
      <div
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

    </div>
  );
};
