// ============================================
// Panvas — Auth Guard
// ============================================

import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Cloud, ShieldAlert, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [, navigate] = useLocation();
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);

  // For Panvas, since it's local-first, we don't *hard block* the /app route.
  // Instead, we just show a soft prompt if they aren't authenticated, letting them know
  // cloud sync is disabled, but allowing them to continue offline.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Small delay before showing prompt to not be too aggressive
      const timer = setTimeout(() => setShowSoftPrompt(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setShowSoftPrompt(false);
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 size={24} className="text-[#A3A3A3] animate-spin" />
          <p className="text-sm text-[#737373]">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}

      {/* Soft prompt overlay for unauthenticated users in the workspace */}
      <AnimatePresence>
        {showSoftPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] rounded-xl glass-panel p-5 shadow-2xl border border-white/10"
          >
            <button 
              onClick={() => setShowSoftPrompt(false)} 
              className="absolute top-3 right-3 text-[#737373] hover:text-[#E8E8E8] transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert size={16} className="text-[#A3A3A3]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#E8E8E8]">Local Mode Active</h3>
                <p className="text-xs text-[#737373] mt-1 leading-relaxed">
                  You're using Panvas offline. Your data is safely stored on this device, but won't sync to the cloud.
                </p>
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={() => navigate('/auth/login')}
                    className="px-3 py-1.5 rounded-md bg-[#E8E8E8] text-[#0D0D0D] text-xs font-semibold hover:bg-white transition-colors flex items-center gap-1.5"
                  >
                    <Cloud size={12} />
                    Enable Sync
                  </button>
                  <button 
                    onClick={() => navigate('/auth/signup')}
                    className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-[#E8E8E8] text-xs font-medium hover:bg-white/10 transition-colors"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
