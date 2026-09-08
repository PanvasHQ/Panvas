// ============================================
// Panvas — Cybercore & Technical Editorial Design Tokens
// Authoritative color palette, materials, and measurement constants
// ============================================

export const CYBER_PALETTE = {
  // Base Black & Graphite Layers
  bgBlack: '#050709',
  bgDark: '#080A0D',
  bgSlate: '#0D1115',
  graphite: '#14191F',
  graphiteHover: '#1A2026',

  // Frost White & Pale Metal
  frostWhite: '#F5F7F7',
  frostSurface: '#EEF2F3',
  frostMuted: '#E7ECEE',
  metalPale: '#D6DEE2',
  metalMid: '#B8C3CA',
  metalDark: '#98A7B1',

  // Icy Blue & Desaturated Steel
  icyBlueLight: '#C8EAFA',
  icyBlue: '#A7D9F2',
  icyBlueAccent: '#83C9EE',
  icyBlueVibrant: '#62B5E2',
  steelBlue: '#708D9D',
  steelDark: '#536D7C',

  // Cool Mint (Functional status only: saved / local / connected)
  mintLight: '#B5ECD8',
  mint: '#79DDBD',

  // Iridescent Blush (Optical reflection only)
  blushLight: '#ECDDE6',
  blush: '#D8C3D4',

  // Calibration Red (Rare measurement punctuation)
  redCalibration: '#EE5B5B',
} as const;

export const CYBER_MATERIALS = {
  // Frosted optical field
  glassPanel: 'bg-[#080A0D]/75 backdrop-blur-2xl border border-[#D6DEE2]/12 shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
  glassCard: 'bg-[#0D1115]/80 backdrop-blur-xl border border-[#B8C3CA]/15 shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
  
  // Specular top edge highlight
  specularTop: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
  specularTopStrong: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]',

  // Iridescent border effect
  iridescentEdge: 'border border-transparent [border-image:linear-gradient(135deg,rgba(255,255,255,0.25),rgba(167,217,242,0.2),rgba(216,195,212,0.15),rgba(181,236,216,0.15))_1]',
  
  // Button styles
  btnPrimary: 'bg-[#EEF2F3] text-[#080A0D] border border-[#B8C3CA] hover:bg-white hover:shadow-[0_4px_24px_rgba(131,201,238,0.3)] transition-all duration-200 active:scale-[0.98]',
  btnSecondary: 'bg-[#080A0D]/80 text-[#F5F7F7] border border-[#B8C3CA]/25 backdrop-blur-lg hover:bg-[#14191F] hover:border-[#D6DEE2]/50 hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-200 active:scale-[0.98]',
  
  // High-contrast Frost section button
  btnFrostPrimary: 'bg-[#080A0D] text-[#F5F7F7] border border-[#14191F] hover:bg-[#14191F] hover:shadow-[0_4px_24px_rgba(8,10,13,0.25)] transition-all duration-200 active:scale-[0.98]',
  btnFrostSecondary: 'bg-white/80 text-[#080A0D] border border-[#B8C3CA]/60 backdrop-blur-md hover:bg-white hover:border-[#708D9D] transition-all duration-200 active:scale-[0.98]',
};

export const MOTION_TIMINGS = {
  easeEditorial: [0.22, 1, 0.36, 1] as [number, number, number, number],
  durationReveal: 0.65,
  durationFast: 0.2,
  durationMedium: 0.45,
};
