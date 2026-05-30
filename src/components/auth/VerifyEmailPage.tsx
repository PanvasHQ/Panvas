// ============================================
// Panvas — Verify Email Page
// ============================================

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { Mail, RefreshCw, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuthStore } from '@/stores/authStore';

export function VerifyEmailPage() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const email = searchParams.get('email') || '';
  
  const { resendVerification } = useAuthStore();
  
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    
    setIsResending(true);
    setStatus(null);
    
    const result = await resendVerification(email);
    
    if (result.error) {
      setStatus({ type: 'error', message: result.error });
    } else {
      setStatus({ type: 'success', message: 'Verification email sent' });
      setCooldown(60); // 60 second cooldown
    }
    
    setIsResending(false);
  };

  return (
    <AuthLayout 
      title="Check your inbox" 
      subtitle="We've sent a verification link to confirm your email address."
    >
      <div className="space-y-6">
        {/* Animated Icon */}
        <div className="flex justify-center py-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center relative"
          >
            <Mail size={28} className="text-[#A3A3A3]" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-[#E8E8E8] rounded-full flex items-center justify-center"
            >
              <CheckCircle2 size={12} className="text-[#0D0D0D]" />
            </motion.div>
          </motion.div>
        </div>

        {/* Email Address */}
        <div className="text-center p-4 rounded-lg bg-[#121212] border border-white/6">
          <p className="text-sm text-[#737373]">Verification link sent to:</p>
          <p className="font-medium text-[#E8E8E8] mt-1 break-all">{email || 'your email address'}</p>
        </div>

        {/* Status Message */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-2.5 rounded-lg p-3 border ${
              status.type === 'error' 
                ? 'bg-[#f43f5e]/8 border-[#f43f5e]/15' 
                : 'bg-[#10b981]/8 border-[#10b981]/15'
            }`}
          >
            {status.type === 'error' ? (
              <AlertCircle size={15} className="text-[#f43f5e] flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={15} className="text-[#10b981] flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-xs ${status.type === 'error' ? 'text-[#f43f5e]' : 'text-[#10b981]'}`}>
              {status.message}
            </p>
          </motion.div>
        )}

        {/* Resend Button */}
        <button
          onClick={handleResend}
          disabled={isResending || cooldown > 0 || !email}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#121212] border border-white/8 text-sm text-[#E8E8E8] font-medium hover:bg-[#1A1A1A] hover:border-white/12 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/10"
        >
          {isResending ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} className={cooldown > 0 ? "" : "opacity-60"} />
          )}
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </button>

        {/* Back to Login */}
        <div className="text-center pt-2">
          <Link href="/auth/login">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#525252] hover:text-[#A3A3A3] font-medium transition-colors cursor-pointer">
              <ArrowLeft size={12} />
              Return to sign in
            </span>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
