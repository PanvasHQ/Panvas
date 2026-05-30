// ============================================
// Panvas — Auth Callback Handler
// ============================================

import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, AlertCircle } from 'lucide-react';
import { authService } from '@/services/auth/AuthService';
import { useAuthStore } from '@/stores/authStore';

export function AuthCallbackHandler() {
  const [, navigate] = useLocation();
  const { initAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleCallback() {
      try {
        // Supabase handles the URL hash parsing automatically when detectSessionInUrl is true
        // We just need to check if a session was established
        const result = await authService.handleOAuthCallback();
        
        if (!mounted) return;

        if (result.error && !result.session) {
          // It's possible the URL didn't have auth tokens (e.g. user just navigated here directly)
          // or there was a genuine error.
          setError(result.error);
          return;
        }

        // Re-initialize the global auth store to pick up the new session
        await initAuth();
        
        if (!mounted) return;

        // Redirect to the app workspace
        navigate('/app');
        
      } catch (err: any) {
        if (mounted) setError(err.message || 'Authentication failed during callback processing');
      }
    }

    handleCallback();

    return () => {
      mounted = false;
    };
  }, [initAuth, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="max-w-md w-full p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[#f43f5e]/10 flex items-center justify-center">
              <AlertCircle size={24} className="text-[#f43f5e]" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-[#E8E8E8]">Authentication Failed</h2>
          <p className="text-sm text-[#737373]">{error}</p>
          <button 
            onClick={() => navigate('/auth/login')}
            className="px-4 py-2 mt-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0D] gap-4">
      <Loader2 size={28} className="text-[#A3A3A3] animate-spin" />
      <p className="text-sm text-[#737373]">Completing authentication...</p>
    </div>
  );
}
