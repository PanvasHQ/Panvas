import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowLeft, Sparkles, Map } from 'lucide-react';

export function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#E8E8E8] font-sans selection:bg-white/20 flex flex-col relative overflow-hidden">
      
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-white/5 blur-[120px] rounded-full" />
      </div>

      {/* Top Nav */}
      <nav className="relative z-10 w-full px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
          <img src="./panvas_logo.png" alt="Panvas" className="w-8 h-8 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform" />
          <span className="font-sketch text-2xl font-bold tracking-tight text-[#E8E8E8] group-hover:text-white transition-colors">
            Panvas
          </span>
        </Link>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center relative z-10 px-6 mt-[-8vh]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="bg-[#0A0A0A]/80 backdrop-blur-3xl border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
            
            <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles size={24} className="text-[#A3A3A3]" />
            </div>

            <h1 className="text-2xl font-semibold mb-3 tracking-tight">Workspace Private Beta</h1>
            <p className="text-sm text-[#737373] mb-4 leading-relaxed px-2">
              Panvas is currently in active development.
            </p>
            <p className="text-sm text-[#737373] mb-4 leading-relaxed px-2">
              We're building a visual workspace where diagrams, notes, code, equations and research live together.
            </p>
            <p className="text-sm text-[#A3A3A3] font-medium mb-8 leading-relaxed px-2">
              The public beta will open soon.
            </p>

            <div className="flex flex-col gap-3">
              <Link href="/">
                <button className="w-full px-4 py-3 rounded-xl bg-[#E8E8E8] text-[#0D0D0D] text-sm font-semibold hover:bg-white transition-all flex items-center justify-center gap-2">
                  <ArrowLeft size={16} />
                  Back to Home
                </button>
              </Link>
              <Link href="/roadmap">
                <button className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#A3A3A3] text-sm font-semibold hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                  <Map size={16} />
                  View Roadmap
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </main>

    </div>
  );
}
