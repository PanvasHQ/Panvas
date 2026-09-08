// ============================================
// Panvas — Original Cyber-Organic & Scientific Linework
// 100% Original decorative motifs inspired by Bézier curves, vector ink strokes, and technical diagrams
// ============================================

import React from 'react';

interface OrnamentProps {
  className?: string;
  opacity?: number;
}

/**
 * Original cyber-organic vector flourish.
 * Derived from stylus pressure trajectories and chrome Bézier curves.
 */
export const CyberVectorFlourish: React.FC<OrnamentProps> = ({ className = '', opacity = 0.25 }) => {
  return (
    <svg
      viewBox="0 0 600 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cyberChromeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="30%" stopColor="#A7D9F2" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#D8C3D4" stopOpacity="0.4" />
          <stop offset="85%" stopColor="#B5ECD8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#D6DEE2" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Primary sweeping Bézier vector ribbon */}
      <path
        d="M 20,180 C 140,220 220,40 340,90 C 440,130 520,30 580,60"
        stroke="url(#cyberChromeGrad)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Secondary harmonic trajectory */}
      <path
        d="M 60,195 C 160,230 240,60 360,105 C 450,140 500,60 560,85"
        stroke="#83C9EE"
        strokeWidth="0.6"
        strokeDasharray="4 6"
      />

      {/* Delicate organic spur accents */}
      <path
        d="M 280,75 C 300,50 320,45 335,60"
        stroke="#D6DEE2"
        strokeWidth="0.8"
      />
      <path
        d="M 390,115 C 410,135 430,130 445,115"
        stroke="#D6DEE2"
        strokeWidth="0.8"
      />

      {/* Small precision crosshair node */}
      <circle cx="340" cy="90" r="2.5" fill="#C8EAFA" />
      <line x1="334" y1="90" x2="346" y2="90" stroke="#D6DEE2" strokeWidth="0.5" />
      <line x1="340" y1="84" x2="340" y2="96" stroke="#D6DEE2" strokeWidth="0.5" />
    </svg>
  );
};

/**
 * Scientific Diagram Lines & Axis Marks
 * Inspired by astronomical diagrams and technical schematic annotations.
 */
export const ScientificDiagramMarks: React.FC<{
  width?: number | string;
  height?: number | string;
  className?: string;
  showRedAccent?: boolean;
}> = ({ className = '', showRedAccent = true }) => {
  return (
    <svg
      viewBox="0 0 400 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* Horizontal datum line */}
      <line x1="10" y1="60" x2="390" y2="60" stroke="#B8C3CA" strokeWidth="0.5" strokeOpacity="0.3" />
      
      {/* Ticks along datum */}
      <line x1="50" y1="54" x2="50" y2="66" stroke="#B8C3CA" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="150" y1="56" x2="150" y2="64" stroke="#B8C3CA" strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="250" y1="54" x2="250" y2="66" stroke="#B8C3CA" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="350" y1="56" x2="350" y2="64" stroke="#B8C3CA" strokeWidth="0.5" strokeOpacity="0.3" />

      {/* Orbit / projection arc */}
      <path
        d="M 50,60 A 100,60 0 0,1 250,60"
        stroke="#83C9EE"
        strokeWidth="0.75"
        strokeOpacity="0.35"
        strokeDasharray="2 4"
      />

      {/* Single calibration red vector ray (rare punctuation) */}
      {showRedAccent && (
        <g>
          <line x1="250" y1="60" x2="320" y2="25" stroke="#EE5B5B" strokeWidth="1" strokeOpacity="0.85" />
          <circle cx="250" cy="60" r="2" fill="#EE5B5B" />
          <circle cx="320" cy="25" r="1.5" fill="#EE5B5B" />
          <text x="326" y="27" fill="#EE5B5B" fontSize="8" fontFamily="monospace" opacity="0.85">Δv</text>
        </g>
      )}
    </svg>
  );
};

/**
 * Precision Coordinate Crosshair
 */
export const CrosshairTick: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none text-[#B8C3CA]/40 ${className}`}
      aria-hidden="true"
    >
      <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="0.75" />
      <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
};
