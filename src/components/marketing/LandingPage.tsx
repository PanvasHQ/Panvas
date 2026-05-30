// ============================================
// Panvas — Landing Page (Marketing)
// ============================================

import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'wouter';
import { Footer } from '@/components/layout/Footer';
import { captureEvent } from '@/lib/analytics';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  FolderOpen,
  Compass,
  FolderTree,
  Cloud,
  HardDrive,
  Save,
  Code2,
  Sigma,
  Command,
  FileText,
  Network,
  Pin,
  FolderGit2,
  BrainCircuit,
  Search,
  Github,
  Globe,
  Mail
} from 'lucide-react';

// Import the specific assets requested by the user
import LandingPageImage from '@/Background Images/Landingpage.png';
import OrgImage from '@/Background Images/Panvas project organization interface.png';
import SyncImage from '@/Background Images/Cloud-sync interface design in dark theme.png';
import ArchImage from '@/Background Images/Digital architecture system design mockup.png';

// ============================================
// Adaptive Notebook Texture
// Per-section texture with configurable density.
// gridOpacity: 0-1 (mapped to CSS opacity)
// dotOpacity:  0-1 (mapped to CSS opacity)
// ============================================
function SectionTexture({ gridOpacity = 0.015, dotOpacity = 0.012 }: { gridOpacity?: number; dotOpacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Graph paper grid — 1px white lines, 32px spacing */}
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
      {/* Halftone dots — 1px white circles, 16px spacing, offset */}
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

export function LandingPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#E8E8E8] overflow-x-hidden font-sans">

      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 h-14 border-b border-white/5 bg-[#0D0D0D]/60 backdrop-blur-2xl backdrop-saturate-150 z-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-2.5">
          <img src="/panvas-logo-1.png" alt="Panvas Logo" className="w-7 h-7 rounded-md" />
          <span className="font-sketch text-lg text-[#E8E8E8] tracking-wide">Panvas</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={import.meta.env.VITE_MARKETING_ONLY === 'true' ? '/private-beta' : '/auth/login'}>
            <button className="px-4 py-1.5 text-sm font-medium rounded-lg text-[#A3A3A3] hover:text-[#E8E8E8] transition-colors">
              Sign In
            </button>
          </Link>
          <Link href={import.meta.env.VITE_MARKETING_ONLY === 'true' ? '/private-beta' : '/auth/signup'}>
            <button 
              onClick={() => captureEvent('cta_click', { placement: 'nav_signup' })}
              className="hidden sm:block px-4 py-1.5 text-sm font-medium rounded-lg border border-white/10 text-[#E8E8E8] hover:bg-white/5 transition-colors"
            >
              Create Account
            </button>
          </Link>
          <Link href={import.meta.env.VITE_MARKETING_ONLY === 'true' ? '/private-beta' : '/app'}>
            <button 
              onClick={() => captureEvent('cta_click', { placement: 'nav_start_drawing' })}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[#E8E8E8] text-[#0D0D0D] hover:bg-white transition-all duration-200"
            >
              Open Workspace
            </button>
          </Link>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-[82vh] pt-20 pb-8 flex items-center justify-start overflow-hidden">
        {/* Background Artwork */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${LandingPageImage}")` }}
        />
        <div className="absolute inset-0 z-0 bg-[#0D0D0D]/8 pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-b from-transparent to-[#0D0D0D] z-0 pointer-events-none" />

        {/* Hero texture — very subtle, artwork already provides interest */}
        <SectionTexture gridOpacity={0.02} dotOpacity={0.015} />

        {/* Hero Content */}
        <div className="w-full relative z-20 max-w-[1400px] mx-auto px-8 md:px-16">
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="max-w-md bg-[#0D0D0D]/12 backdrop-blur-2xl backdrop-saturate-[140%] border border-white/8 rounded-2xl p-8 md:p-10 shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center gap-2.5 mb-6">
              <img src="/panvas-logo-1.png" alt="Panvas" className="w-10 h-10 rounded-lg border border-white/8" />
              <span className="font-sketch text-xl text-[#E8E8E8] tracking-wide">Panvas</span>
            </div>

            <div className="text-[10px] font-semibold text-[#737373] tracking-[0.2em] uppercase mb-5">
              Visual Research Workspace
            </div>

            <div className="flex flex-col gap-0 mb-5">
              {['Think.', 'Sketch.', 'Write.', 'Build.'].map((word, i) => (
                <motion.h1 
                  key={word}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 + (i * 0.08), ease: "easeOut" }}
                  className="text-4xl md:text-6xl font-bold tracking-tighter text-[#E8E8E8] leading-[0.92]"
                >
                  {word}
                </motion.h1>
              ))}
            </div>
            
            <p className="text-base text-[#4B5563] max-w-sm mb-8 leading-relaxed font-medium">
              The infinite canvas for engineers, researchers and creators. Blend diagrams, code, equations, research and notes into one visual workspace.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-6 relative z-10">
              {heroChips.map((chip, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/5 border border-black/10 text-[11px] font-semibold text-[#374151]">
                  <span className="text-[#374151]">{chip.icon}</span>
                  {chip.label}
                </div>
              ))}
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="pt-5 border-t border-white/5"
            >
              <Link href={import.meta.env.VITE_MARKETING_ONLY === 'true' ? '/private-beta' : '/app'}>
                <button 
                  onClick={() => captureEvent('cta_click', { placement: 'hero_open_workspace' })}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#E8E8E8] text-[#0D0D0D] text-sm font-semibold hover:bg-white transition-all group"
                >
                  Open Workspace
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURE RIBBON ===== */}
      <div className="relative z-30 -mt-4 mb-4 max-w-[1600px] mx-auto px-8 md:px-16">
        <div className="group relative flex overflow-hidden rounded-xl bg-[#0D0D0D]/12 backdrop-blur-xl backdrop-saturate-[140%] border border-white/6 shadow-[0_4px_24px_rgba(0,0,0,0.3)] py-2.5">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0D0D0D]/70 to-transparent z-10 pointer-events-none rounded-l-xl" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0D0D0D]/70 to-transparent z-10 pointer-events-none rounded-r-xl" />
          
          <div className="flex w-max animate-premium-marquee group-hover:[animation-play-state:paused] items-center">
            {[...capabilities, ...capabilities].map((cap, i) => (
              <React.Fragment key={i}>
                <motion.div 
                  whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.06)' }}
                  className="flex items-center gap-2 px-3.5 py-1 rounded-md text-[#737373] text-[13px] font-medium tracking-wide transition-colors cursor-default hover:text-[#A3A3A3]"
                >
                  <span className="opacity-60">{cap.icon}</span>
                  {cap.label}
                </motion.div>
                <span className="text-white/10 mx-1 text-xs">·</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Gradient Transition */}
      <div className="h-40 bg-gradient-to-b from-transparent to-[#0D0D0D] -mt-40 relative z-20 pointer-events-none" />

      {/* ===== SECTION 1: Visual Thinking — Image section, texture at 3%/2% ===== */}
      <section className="relative py-28 px-8 md:px-16 overflow-hidden">
        <SectionTexture gridOpacity={0.03} dotOpacity={0.02} />
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="flex-1 space-y-6"
            >
              <div className="w-10 h-10 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center text-[#A3A3A3]">
                <BrainCircuit size={20} />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#E8E8E8] tracking-tight">
                Visual Thinking
              </h2>
              <p className="text-lg text-[#737373] leading-relaxed max-w-lg">
                Break out of linear documents. Panvas gives you the freedom to mix hand-drawn architecture diagrams, state machines, and system mind maps exactly where you need them.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8 }}
              className="flex-1 w-full"
            >
              <div className="relative rounded-xl overflow-hidden border border-white/8 shadow-[0_16px_32px_rgba(0,0,0,0.3)]">
                <img src={ArchImage} alt="Digital architecture system design" className="w-full h-auto object-cover relative z-10" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/6 rounded-xl pointer-events-none z-20" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 2: Structured Workspaces — Image section, texture at 3%/2% ===== */}
      <section className="relative py-28 px-8 md:px-16 overflow-hidden">
        <SectionTexture gridOpacity={0.03} dotOpacity={0.02} />
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              onViewportEnter={() => captureEvent('view_features', { section: 'structured_workspaces' })}
              transition={{ duration: 0.7 }}
              className="flex-1 space-y-6 lg:pl-8"
            >
              <div className="w-10 h-10 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center text-[#A3A3A3]">
                <FolderTree size={20} />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#E8E8E8] tracking-tight">
                Structured Workspaces
              </h2>
              <p className="text-lg text-[#737373] leading-relaxed max-w-lg">
                Organize your thoughts into unlimited nested folders. Pin critical architecture canvases, group related notes, and navigate your entire engineering knowledge base instantly.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8 }}
              className="flex-1 w-full"
            >
              <div className="relative rounded-xl overflow-hidden border border-white/8 shadow-[0_16px_32px_rgba(0,0,0,0.3)] bg-[#111111]">
                <img src={OrgImage} alt="Panvas project organization interface" className="w-full h-auto object-cover relative z-10" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/6 rounded-xl pointer-events-none z-20" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 3: Local First — Content-heavy, texture at 5%/3% ===== */}
      <section className="relative py-28 px-8 md:px-16 overflow-hidden">
        <SectionTexture gridOpacity={0.05} dotOpacity={0.03} />
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="flex-1 space-y-6"
            >
              <div className="w-10 h-10 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center text-[#A3A3A3]">
                <ShieldCheck size={20} />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#E8E8E8] tracking-tight">
                Local First. Cloud Ready.
              </h2>
              <p className="text-lg text-[#737373] leading-relaxed max-w-lg mb-6">
                Your data belongs to you. Panvas saves everything instantly to your local device. Work perfectly offline with zero latency, and sync seamlessly to the cloud when you're back online.
              </p>
              <ul className="space-y-3 pt-4 border-t border-white/5">
                {['Zero latency interactions', 'Works 100% offline without accounts', 'Optional end-to-end cloud sync'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-[#A3A3A3]">
                    <CheckCircle2 size={15} className="text-[#737373]" /> {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8 }}
              className="flex-1 w-full"
            >
              <div className="relative rounded-xl overflow-hidden border border-white/8 shadow-[0_16px_32px_rgba(0,0,0,0.3)] bg-[#111111] p-3">
                <img src={SyncImage} alt="Cloud-sync interface design" className="w-full h-auto object-cover rounded-lg relative z-10" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/6 rounded-xl pointer-events-none z-20" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes premium-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-premium-marquee {
          animation: premium-marquee 45s linear infinite;
          will-change: transform;
        }
      `}} />
    </div>
  );
}

const heroChips = [
  { label: "Infinite Canvas", icon: <Compass size={12} /> },
  { label: "Workspaces", icon: <FolderTree size={12} /> },
  { label: "Cloud Sync", icon: <Cloud size={12} /> },
  { label: "Local First", icon: <HardDrive size={12} /> },
  { label: "LaTeX", icon: <Sigma size={12} /> },
  { label: "Code Blocks", icon: <Code2 size={12} /> },
];

const capabilities = [
  { label: "Infinite Canvas", icon: <Compass size={15} /> },
  { label: "Workspaces", icon: <FolderTree size={15} /> },
  { label: "Nested Folders", icon: <FolderOpen size={15} /> },
  { label: "Notes", icon: <FileText size={15} /> },
  { label: "LaTeX", icon: <Sigma size={15} /> },
  { label: "Code Blocks", icon: <Code2 size={15} /> },
  { label: "Cloud Sync", icon: <Cloud size={15} /> },
  { label: "Local First", icon: <HardDrive size={15} /> },
  { label: "Autosave", icon: <Save size={15} /> },
  { label: "Pinned Canvases", icon: <Pin size={15} /> },
  { label: "Project Organization", icon: <FolderGit2 size={15} /> },
  { label: "Command Palette", icon: <Command size={15} /> },
  { label: "Research Notes", icon: <FileText size={15} /> },
  { label: "Visual Thinking", icon: <BrainCircuit size={15} /> },
  { label: "Global Search", icon: <Search size={15} /> },
  { label: "Knowledge Management", icon: <Network size={15} /> },
];


