// ============================================
// Panvas — Auth Layout
// Split-panel wrapper for all auth pages.
// Left: branding + ambient artwork. Right: form.
// ============================================

import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';

// Reusable notebook texture (same pattern as landing page)
function AuthTexture({ gridOpacity = 0.02, dotOpacity = 0.012 }: { gridOpacity?: number; dotOpacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div 
        className="absolute inset-0"
        style={{
          opacity: gridOpacity,
          backgroundImage: `
            linear-gradient(to right, #FFFFFF 1px, transparent 1px),
            linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />
      <div 
        className="absolute inset-0"
        style={{
          opacity: dotOpacity,
          backgroundImage: 'radial-gradient(circle at center, #FFFFFF 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          backgroundPosition: '8px 8px'
        }}
      />
    </div>
  );
}

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex">
      {/* ===== Left Panel — Brand + Artwork (desktop only) ===== */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden flex-col">
        {/* Ambient background artwork */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("/app-screenshots/HeroResearchWorkSpace.png")` }}
        />
        <div className="absolute inset-0 bg-[#0D0D0D]/70" />
        <AuthTexture gridOpacity={0.025} dotOpacity={0.015} />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12 xl:p-16">
          {/* Top: Logo + Brand */}
          <Link href="/">
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img 
                src="./panvas_logo.png" 
                alt="Panvas" 
                className="w-9 h-9 rounded-lg border border-white/8 group-hover:border-white/15 transition-colors" 
              />
              <span className="font-sketch text-xl text-[#E8E8E8] tracking-wide">Panvas</span>
            </motion.div>
          </Link>

          {/* Center: Product messaging */}
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="flex-1 flex flex-col justify-center max-w-md"
          >
            <div className="space-y-6">
              <div className="text-[10px] font-semibold text-[#525252] tracking-[0.2em] uppercase">
                Visual Research Workspace
              </div>
              <h1 className="text-3xl xl:text-4xl font-bold text-[#E8E8E8] tracking-tight leading-tight">
                Think. Sketch.<br />Write. Build.
              </h1>
              <p className="text-sm text-[#737373] leading-relaxed max-w-sm">
                The infinite canvas for engineers, researchers and creators. 
                Blend diagrams, code, equations and notes into one visual workspace.
              </p>
            </div>

            {/* Research note fragments */}
            <div className="mt-10 flex flex-wrap gap-2">
              {[
                '∞ Infinite Canvas',
                'Local First',
                'Cloud Sync',
                'LaTeX Ready',
              ].map((note, i) => (
                <motion.div
                  key={note}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
                  className="px-2.5 py-1 rounded-md bg-white/3 border border-white/6 text-[11px] font-medium text-[#525252]"
                >
                  {note}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom: subtle credit */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <p className="text-[11px] text-[#333333]">
              Built by Sumit Ahmed
            </p>
          </motion.div>
        </div>
      </div>

      {/* ===== Right Panel — Auth Form ===== */}
      <div className="flex-1 relative flex flex-col min-h-screen">
        <AuthTexture gridOpacity={0.018} dotOpacity={0.01} />
        
        {/* Mobile header (shown only on small screens) */}
        <div className="lg:hidden p-6 pb-0">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img src="./panvas_logo.png" alt="Panvas" className="w-7 h-7 rounded-md border border-white/8" />
              <span className="font-sketch text-lg text-[#E8E8E8] tracking-wide">Panvas</span>
            </div>
          </Link>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-[420px]"
          >
            {/* Page title */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#E8E8E8] tracking-tight">{title}</h2>
              {subtitle && (
                <p className="mt-2 text-sm text-[#737373]">{subtitle}</p>
              )}
            </div>

            {/* Form content */}
            {children}
          </motion.div>
        </div>

        {/* Bottom: back to home link */}
        <div className="p-6 pt-0 text-center lg:text-left relative z-10">
          <Link href="/">
            <span className="text-xs text-[#525252] hover:text-[#737373] transition-colors cursor-pointer">
              ← Back to home
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
