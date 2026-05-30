import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowLeft, Map, Clock, FastForward, CheckCircle2, ChevronRight } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';

const roadmapData = [
  {
    phase: 'Now',
    title: 'Foundation & Identity',
    icon: <CheckCircle2 className="text-[#10B981]" size={20} />,
    status: 'In Progress',
    color: 'emerald',
    items: [
      'Landing page & marketing presence',
      'Core branding & design system',
      'Authentication architecture',
      'Workspace foundation',
      'Local-first localstorage synchronization'
    ]
  },
  {
    phase: 'Next',
    title: 'Private Beta & Core Workflows',
    icon: <Clock className="text-[#3B82F6]" size={20} />,
    status: 'Upcoming',
    color: 'blue',
    items: [
      'Workspace private beta access',
      'Cloud sync improvements & resilience',
      'Visual research workflows',
      'Notion-style content block editing'
    ]
  },
  {
    phase: 'Future',
    title: 'Multiplayer & Intelligence',
    icon: <FastForward className="text-[#A3A3A3]" size={20} />,
    status: 'Planning',
    color: 'gray',
    items: [
      'Real-time multiplayer collaboration',
      'Team & shared workspaces',
      'AI-assisted canvas features',
      'Knowledge graph visualization',
      'Native mobile applications'
    ]
  }
];

export function RoadmapPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#E8E8E8] font-sans overflow-x-hidden selection:bg-white/20">
      
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-white/5 blur-[120px] rounded-full" />
      </div>

      {/* Top Nav */}
      <nav className="fixed top-0 inset-x-0 h-16 border-b border-white/5 bg-[#050505]/80 backdrop-blur-2xl z-50 flex items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
          <img src="/panvas-logo-1.png" alt="Panvas Logo" className="w-8 h-8 rounded-lg shadow-glass-sm group-hover:scale-105 transition-transform" />
          <span className="font-sketch text-xl tracking-tight text-[#E8E8E8] group-hover:text-white transition-colors">
            Panvas
          </span>
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm text-[#737373] hover:text-[#E8E8E8] transition-colors font-medium">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </nav>

      <main className="pt-32 pb-24 px-6 md:px-12 relative z-10 max-w-4xl mx-auto">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-20 text-center"
        >
          <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mx-auto mb-6 shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
            <Map size={24} className="text-[#A3A3A3]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Product Roadmap</h1>
          <p className="text-[#737373] text-lg max-w-2xl mx-auto leading-relaxed">
            Panvas is being built in the open. Here is our transparent development journey from a local-first canvas to a collaborative visual research workspace.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="space-y-6">
          {roadmapData.map((phase, idx) => (
            <motion.div 
              key={phase.phase}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 + (idx * 0.15) }}
              className="bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden group"
            >
              {/* Phase Accent Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 group-hover:bg-white/[0.04] transition-colors" />

              <div className="flex flex-col md:flex-row gap-8 relative z-10">
                {/* Phase Info */}
                <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 pb-6 md:pb-0 md:pr-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold tracking-widest uppercase text-[#737373]">{phase.phase}</span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] font-medium text-[#A3A3A3]">
                      {phase.icon}
                      <span className="hidden sm:inline">{phase.status}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-[#E8E8E8]">{phase.title}</h3>
                </div>

                {/* Items */}
                <div className="md:w-2/3 flex flex-col gap-4 justify-center">
                  {phase.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-start gap-3">
                      <ChevronRight size={16} className="text-[#525252] mt-0.5 shrink-0" />
                      <span className="text-[#A3A3A3] text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  );
}
